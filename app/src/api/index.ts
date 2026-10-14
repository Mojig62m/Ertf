import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import * as t from '../db/schema';
import { DEFAULT_PAGE_SIZE } from '../lib/config';
import { effectivePrice, lineTotal, shippingFor, subtotalOf } from '../lib/money';

export const api = new Hono().basePath('/api');

type CategoryRow = typeof t.categories.$inferSelect;
type FacetValue = { slug: string; label: string; count: number };
type FacetDef = { slug: string; name: string; unit: string | null; values: FacetValue[] };

class OrderError extends Error {}

function toInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function generateLicenseKey(): string {
  const hex = randomBytes(6).toString('hex').toUpperCase();
  return 'ERF-' + hex.slice(0, 4) + '-' + hex.slice(4, 8) + '-' + hex.slice(8, 12);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

api.get('/health', (c) => c.json({ ok: true }));

api.get('/categories', async (c) => {
  const items = await db
    .select({ id: t.categories.id, slug: t.categories.slug, name: t.categories.name })
    .from(t.categories)
    .orderBy(asc(t.categories.sortOrder));
  return c.json({ items });
});

async function buildFacets(category: CategoryRow | null) {
  if (category) {
    const catProducts = await db
      .select({ id: t.products.id, brand: t.products.brand, price: t.products.priceRials })
      .from(t.products)
      .where(eq(t.products.categoryId, category.id));
    const brandCounts = new Map<string, number>();
    let priceMin = Number.MAX_SAFE_INTEGER;
    let priceMax = 0;
    for (const p of catProducts) {
      brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
      if (p.price < priceMin) priceMin = p.price;
      if (p.price > priceMax) priceMax = p.price;
    }
    // ساده‌سازی نمونه: شمارش وجه‌ها فقط در محدوده دسته، بدون اعمال سایر فیلترها
    const attrRows = await db
      .select({
        defSlug: t.categoryAttributeDefs.slug,
        defName: t.categoryAttributeDefs.name,
        defUnit: t.categoryAttributeDefs.unit,
        defSort: t.categoryAttributeDefs.sortOrder,
        valueSlug: t.attributeValues.slug,
        valueLabel: t.attributeValues.value,
        valueSort: t.attributeValues.sortOrder,
      })
      .from(t.productAttributeValues)
      .innerJoin(t.attributeValues, eq(t.attributeValues.id, t.productAttributeValues.valueId))
      .innerJoin(t.categoryAttributeDefs, eq(t.categoryAttributeDefs.id, t.attributeValues.defId))
      .where(eq(t.categoryAttributeDefs.categoryId, category.id))
      .orderBy(asc(t.categoryAttributeDefs.sortOrder), asc(t.attributeValues.sortOrder));
    const defs = new Map<string, FacetDef>();
    for (const row of attrRows) {
      const def = defs.get(row.defSlug) ?? { slug: row.defSlug, name: row.defName, unit: row.defUnit, values: [] };
      const existing = def.values.find((v) => v.slug === row.valueSlug);
      if (existing) existing.count += 1;
      else def.values.push({ slug: row.valueSlug, label: row.valueLabel, count: 1 });
      defs.set(row.defSlug, def);
    }
    return {
      type: 'category' as const,
      brands: [...brandCounts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      priceRange: catProducts.length === 0 ? null : { min: priceMin, max: priceMax },
      attributes: [...defs.values()],
    };
  }
  const catRows = await db
    .select({ id: t.categories.id, slug: t.categories.slug, name: t.categories.name, sortOrder: t.categories.sortOrder })
    .from(t.categories)
    .orderBy(asc(t.categories.sortOrder));
  const productRows = await db.select({ categoryId: t.products.categoryId }).from(t.products);
  const countMap = new Map<number, number>();
  for (const row of productRows) countMap.set(row.categoryId, (countMap.get(row.categoryId) ?? 0) + 1);
  return {
    type: 'root' as const,
    categories: catRows.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      count: countMap.get(cat.id) ?? 0,
    })),
  };
}

api.get('/products', async (c) => {
  const url = new URL(c.req.url);
  const categorySlug = url.searchParams.get('category');
  const brand = url.searchParams.get('brand');
  const q = url.searchParams.get('q');
  const min = toInt(url.searchParams.get('min'));
  const max = toInt(url.searchParams.get('max'));
  const sort = url.searchParams.get('sort') ?? 'newest';
  const page = Math.max(1, toInt(url.searchParams.get('page')) ?? 1);
  const pageSize = Math.min(48, toInt(url.searchParams.get('page_size')) ?? DEFAULT_PAGE_SIZE);

  const attrFilters = new Map<string, string[]>();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith('a_') && value) {
      const defSlug = key.slice(2);
      const list = attrFilters.get(defSlug) ?? [];
      list.push(value);
      attrFilters.set(defSlug, list);
    }
  }

  const category = categorySlug
    ? ((await db.select().from(t.categories).where(eq(t.categories.slug, categorySlug)))[0] ?? null)
    : null;
  if (categorySlug && !category) {
    return c.json({ items: [], total: 0, page, pageSize, facets: null });
  }

  const conds: (SQL | undefined)[] = [];
  if (category) conds.push(eq(t.products.categoryId, category.id));
  if (brand) conds.push(eq(t.products.brand, brand));
  if (min !== null) conds.push(gte(t.products.priceRials, min));
  if (max !== null) conds.push(lte(t.products.priceRials, max));
  if (q) {
    const like = '%' + q + '%';
    conds.push(or(ilike(t.products.name, like), ilike(t.products.description, like)));
  }
  for (const [defSlug, valueSlugs] of attrFilters) {
    conds.push(
      exists(
        db
          .select({ one: t.productAttributeValues.productId })
          .from(t.productAttributeValues)
          .innerJoin(t.attributeValues, eq(t.attributeValues.id, t.productAttributeValues.valueId))
          .innerJoin(t.categoryAttributeDefs, eq(t.categoryAttributeDefs.id, t.attributeValues.defId))
          .where(
            and(
              eq(t.productAttributeValues.productId, t.products.id),
              eq(t.categoryAttributeDefs.slug, defSlug),
              inArray(t.attributeValues.slug, valueSlugs),
            ),
          ),
      ),
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const total = where ? await db.$count(t.products, where) : await db.$count(t.products);
  const sortExpr =
    sort === 'price_asc'
      ? asc(t.products.priceRials)
      : sort === 'price_desc'
        ? desc(t.products.priceRials)
        : desc(t.products.id);

  const items = await db
    .select({
      id: t.products.id,
      slug: t.products.slug,
      name: t.products.name,
      brand: t.products.brand,
      priceRials: t.products.priceRials,
      discountRials: t.products.discountRials,
      isDigital: t.products.isDigital,
      imageUrl: t.products.imageUrl,
      categorySlug: t.categories.slug,
      categoryName: t.categories.name,
    })
    .from(t.products)
    .innerJoin(t.categories, eq(t.categories.id, t.products.categoryId))
    .where(where)
    .orderBy(sortExpr)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const facets = await buildFacets(category);
  return c.json({ items, total, page, pageSize, facets });
});

api.get('/products/:slug', async (c) => {
  const slug = c.req.param('slug');
  const row = (
    await db
      .select({
        id: t.products.id,
        slug: t.products.slug,
        name: t.products.name,
        description: t.products.description,
        brand: t.products.brand,
        priceRials: t.products.priceRials,
        discountRials: t.products.discountRials,
        isDigital: t.products.isDigital,
        imageUrl: t.products.imageUrl,
        categorySlug: t.categories.slug,
        categoryName: t.categories.name,
      })
      .from(t.products)
      .innerJoin(t.categories, eq(t.categories.id, t.products.categoryId))
      .where(eq(t.products.slug, slug))
      .limit(1)
  )[0];
  if (!row) return c.json({ error: 'محصول یافت نشد' }, 404);
  const attrs = await db
    .select({
      defSlug: t.categoryAttributeDefs.slug,
      defName: t.categoryAttributeDefs.name,
      defUnit: t.categoryAttributeDefs.unit,
      valueLabel: t.attributeValues.value,
    })
    .from(t.productAttributeValues)
    .innerJoin(t.attributeValues, eq(t.attributeValues.id, t.productAttributeValues.valueId))
    .innerJoin(t.categoryAttributeDefs, eq(t.categoryAttributeDefs.id, t.attributeValues.defId))
    .where(eq(t.productAttributeValues.productId, row.id));
  const inv = (await db.select().from(t.inventory).where(eq(t.inventory.productId, row.id)))[0];
  return c.json({ product: row, attributes: attrs, availableQuantity: inv?.quantity ?? 0 });
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
  const mergedMap = new Map<number, number>();
  for (const item of b.items) {
    mergedMap.set(item.productId, (mergedMap.get(item.productId) ?? 0) + item.quantity);
  }
  const merged = [...mergedMap.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  const productIds = merged.map((m) => m.productId);

  const existing = (await db.select().from(t.orders).where(eq(t.orders.idempotencyKey, b.idempotencyKey)))[0];
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
          idempotencyKey: b.idempotencyKey,
          customerName: cust.name.trim(),
          customerPhone: cust.phone.trim(),
          customerCity: cust.city.trim(),
          customerAddress: cust.address.trim(),
          customerPostalCode: cust.postalCode.trim(),
          subtotalRials: subtotal,
          shippingRials: shipping,
          totalRials: total,
          status: 'paid_simulated',
          paymentRef: 'PENDING',
        })
        .returning();
      const paymentRef = 'SIM-' + order.id + '-' + randomBytes(4).toString('hex').toUpperCase();
      const [updated] = await tx.update(t.orders).set({ paymentRef }).where(eq(t.orders.id, order.id)).returning();

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
    return c.json(result, 201);
  } catch (err) {
    if (err instanceof OrderError) return c.json({ error: err.message }, 409);
    console.error('order failure', err);
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
  console.error('api error', err);
  return c.json({ error: 'خطای داخلی سرور' }, 500);
});
