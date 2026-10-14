CREATE TABLE "attribute_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"def_id" integer NOT NULL,
	"slug" text NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "attr_value_slug_uq" UNIQUE("def_id","slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_attribute_defs" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_attr_def_slug_uq" UNIQUE("category_id","slug")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"is_digital" boolean DEFAULT false NOT NULL,
	"unit_price_rials" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_rials" bigint NOT NULL,
	"license_key" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_city" text NOT NULL,
	"customer_address" text NOT NULL,
	"customer_postal_code" text NOT NULL,
	"subtotal_rials" bigint NOT NULL,
	"shipping_rials" bigint NOT NULL,
	"total_rials" bigint NOT NULL,
	"status" text DEFAULT 'paid_simulated' NOT NULL,
	"payment_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"product_id" integer NOT NULL,
	"value_id" integer NOT NULL,
	CONSTRAINT "product_attribute_values_product_id_value_id_pk" PRIMARY KEY("product_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"price_rials" bigint NOT NULL,
	"discount_rials" bigint DEFAULT 0 NOT NULL,
	"is_digital" boolean DEFAULT false NOT NULL,
	"image_url" text DEFAULT '/images/placeholder.svg' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_def_id_category_attribute_defs_id_fk" FOREIGN KEY ("def_id") REFERENCES "public"."category_attribute_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attribute_defs" ADD CONSTRAINT "category_attribute_defs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_value_id_attribute_values_id_fk" FOREIGN KEY ("value_id") REFERENCES "public"."attribute_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "pav_value_idx" ON "product_attribute_values" USING btree ("value_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");