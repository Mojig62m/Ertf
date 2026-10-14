import { bigint, boolean, integer, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

// دسته‌ها و تعریف ویژگی‌های متغیر هر دسته (ناوردای کاتالوگ چنددسته‌ای، R16)
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const categoryAttributeDefs = pgTable('category_attribute_defs', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  unit: text('unit'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [unique('category_attr_def_slug_uq').on(t.categoryId, t.slug)]);

export const attributeValues = pgTable('attribute_values', {
  id: serial('id').primaryKey(),
  defId: integer('def_id').notNull().references(() => categoryAttributeDefs.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  value: text('value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [unique('attr_value_slug_uq').on(t.defId, t.slug)]);

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  brand: text('brand').notNull().default(''),
  priceRials: bigint('price_rials', { mode: 'number' }).notNull(),
  discountRials: bigint('discount_rials', { mode: 'number' }).notNull().default(0),
  isDigital: boolean('is_digital').notNull().default(false),
  imageUrl: text('image_url').notNull().default('/images/placeholder.svg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const productAttributeValues = pgTable('product_attribute_values', {
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  valueId: integer('value_id').notNull().references(() => attributeValues.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.productId, t.valueId] })]);

export const inventory = pgTable('inventory', {
  productId: integer('product_id').primaryKey().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(0),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerCity: text('customer_city').notNull(),
  customerAddress: text('customer_address').notNull(),
  customerPostalCode: text('customer_postal_code').notNull(),
  subtotalRials: bigint('subtotal_rials', { mode: 'number' }).notNull(),
  shippingRials: bigint('shipping_rials', { mode: 'number' }).notNull(),
  totalRials: bigint('total_rials', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('paid_simulated'),
  paymentRef: text('payment_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  isDigital: boolean('is_digital').notNull().default(false),
  unitPriceRials: bigint('unit_price_rials', { mode: 'number' }).notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalRials: bigint('line_total_rials', { mode: 'number' }).notNull(),
  licenseKey: text('license_key'),
});
