import { eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import * as t from '../db/schema';
import { effectivePrice, lineTotal, shippingFor, subtotalOf } from '../lib/money';
import { listCategories, paramsToQuery, listProducts, productBySlug } from '../lib/catalog';
import { getPaymentProvider } from '../lib/payment';
import { logger, errorFields } from '../lib/logger';

export const api = new Hono().basePath('/api');

class OrderError extends Error {}

// درز قابلیت جابه‌جایی رانتایم: استفاده از Web Crypto استاندارد (globalThis.crypto)
// به‌جای node:crypto — روی Node، Bun، Deno و Workers یکسان کار می‌کند.
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateLicenseKey(): string {
  const hex = randomHex(6).toUpperCase();
  return 'ERF-' + hex.slice(0, 4) + '-' + hex.slice(4, 8) + '-' + hex.slice(8, 12);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

// --- میان‌افزار: شناسهٔ درخواست + لاگ ساختاریافته (بدون داده شخصی) ---
api.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id')?.trim() || globalThis.crypto.randomUUID();
  c.header('x-request-id', requestId);
  const started = Date.now();
  await next();
  logger.info('http_request', {
    requestId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs: Date.now() - started,
  });
});

// زنده‌بودن (liveness): بدون وابستگی — برای probe سطح پروسه
api.get('/health', (c) => c.json({ ok: true, status: 'live' }));

// آمادگی (readiness): اتصال واقعی دیتابیس را می‌سنجد — برای load balancer و صف استقرار (رفع B8)
api.get('/health/ready', async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ ok: true, status: 'ready' });
  } catch (err) {
    logger.error('readiness_probe_failed', errorFields(err));
    return c.json({ ok: false, status: 'not_ready' }, 503);
  }
});

api.get('/categories', async (c) => c.json({ items: await listCategories() }));

api.get('/products', async (c) => {
  const query = paramsToQuery(new URL(c.req.url).searchParams);
  return c.json(await listProducts(query));
});

api.get('/products/:slug', async (c) => {
  const data = await productBySlug(c.req.param('slug'));
  if (!data) return c.json({ error: 'محصول یافت نشد' }, 404);
  return c.json(data);
});

type OrderItemInput = { productId: number; quantity: number };
type OrderInput = {
  idempotencyKey: string;
  customer: { name: string; phone: string; city: string; address: string; postalCode: string };
  items: OrderItemInput[];
};

api.post('/orders', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'بدنه درخواست معتبر نیست' }, 400);
  }
  const b = body as Partial<OrderInput>;
  if (!isNonEmptyString(b.idempotencyKey) || b.idempotencyKey.length > 128) {
    return c.json({ error: 'کلید تکرارناپذیری نامعتبر است' }, 400);
  }
  const cust = b.customer;
  if (
    !cust ||
    !isNonEmptyString(cust.name) ||
    !isNonEmptyString(cust.phone) ||
    !isNonEmptyString(cust.city) ||
    !isNonEmptyString(cust.address) ||
    !isNonEmptyString(cust.postalCode)
  ) {
    return c.json({ error: 'اطلاعات مشتری کامل نیست' }, 400);
  }
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) {
    return c.json({ error: 'فهرست اقلام نامعتبر است' }, 400);
  }
  for (const item of b.items) {
    if (!isPositiveInt(item?.productId) || !isPositiveInt(item?.quantity) || item.quantity > 20) {
      return c.json({ error: 'قلم سفارش نامعتبر است' }, 400);
    }
  }

  // مقادیر اعتبارسنجی‌شده را در متغیرهای محلی نگه می‌داریم تا نوع‌ها در closure حفظ شوند (رفع B3)
  const idempotencyKey: string = b.idempotencyKey;
  const customer = {
    name: cust.name.trim(),
    phone: cust.phone.trim(),
    city: cust.city.trim(),
    address: cust.address.trim(),
    postalCode: cust.postalCode.trim(),
  };

  const mergedMap = new Map<number, number>();
  for (const item of b.items) {
    mergedMap.set(item.productId, (mergedMap.get(item.productId) ?? 0) + item.quantity);
  }
  const merged = [...mergedMap.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  const productIds = merged.map((m) => m.productId);

  const existing = (await db.select().from(t.orders).where(eq(t.orders.idempotencyKey, idempotencyKey)))[0];
  if (existing) {
    const existingItems = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, existing.id));
    return c.json({ order: existing, items: existingItems, replay: true });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const invRows = await tx
        .select()
        .from(t.inventory)
        .where(inArray(t.inventory.productId, productIds))
        .for('update');
      const invMap = new Map(invRows.map((r) => [r.productId, r.quantity]));
      const prodRows = await tx.select().from(t.products).where(inArray(t.products.id, productIds));
      const prodMap = new Map(prodRows.map((p) => [p.id, p]));

      const lines: {
        product: typeof t.products.$inferSelect;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }[] = [];
      for (const item of merged) {
        const product = prodMap.get(item.productId);
        if (!product) throw new OrderError('محصولی با شناسه ' + item.productId + ' یافت نشد');
        const available = invMap.get(item.productId) ?? 0;
        if (available < item.quantity) throw new OrderError('موجودی کافی نیست: ' + product.name);
        const unitPrice = effectivePrice(product.priceRials, product.discountRials);
        lines.push({ product, quantity: item.quantity, unitPrice, lineTotal: lineTotal(unitPrice, item.quantity) });
      }

      const subtotal = subtotalOf(lines.map((l) => l.lineTotal));
      const shipping = shippingFor(subtotal);
      const total = subtotal + shipping;

      const [order] = await tx
        .insert(t.orders)
        .values({
          idempotencyKey,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerCity: customer.city,
          customerAddress: customer.address,
          customerPostalCode: customer.postalCode,
          subtotalRials: subtotal,
          shippingRials: shipping,
          totalRials: total,
          status: 'pending',
          paymentRef: 'PENDING',
        })
        .returning();

      // نقطه جابه‌جایی شبیه‌سازی با درگاه واقعی — تنها محل تغییر، همین فراخوانی است (ADR-0003)
      const payment = getPaymentProvider().settle(order.id);
      const [updated] = await tx
        .update(t.orders)
        .set({ paymentRef: payment.paymentRef, status: payment.status })
        .where(eq(t.orders.id, order.id))
        .returning();

      const itemRows = await tx
        .insert(t.orderItems)
        .values(
          lines.map((l) => ({
            orderId: order.id,
            productId: l.product.id,
            productName: l.product.name,
            isDigital: l.product.isDigital,
            unitPriceRials: l.unitPrice,
            quantity: l.quantity,
            lineTotalRials: l.lineTotal,
            licenseKey: l.product.isDigital ? generateLicenseKey() : null,
          })),
        )
        .returning();

      for (const l of lines) {
        await tx
          .update(t.inventory)
          .set({ quantity: (invMap.get(l.product.id) ?? 0) - l.quantity })
          .where(eq(t.inventory.productId, l.product.id));
      }
      return { order: updated, items: itemRows };
    });
    logger.info('order_created', { orderId: result.order.id, itemCount: result.items.length, totalRials: result.order.totalRials });
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof OrderError) return c.json({ error: err.message }, 409);
    logger.error('order_failed', errorFields(err));
    return c.json({ error: 'ایجاد سفارش ناموفق بود' }, 500);
  }
});

api.get('/orders/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'شناسه نامعتبر است' }, 400);
  const order = (await db.select().from(t.orders).where(eq(t.orders.id, id)))[0];
  if (!order) return c.json({ error: 'سفارش یافت نشد' }, 404);
  const items = await db.select().from(t.orderItems).where(eq(t.orderItems.orderId, id));
  return c.json({ order, items });
});

api.onError((err, c) => {
  logger.error('api_unhandled_error', errorFields(err));
  return c.json({ error: 'خطای داخلی سرور' }, 500);
});
