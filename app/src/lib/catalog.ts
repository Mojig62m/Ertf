import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import * as t from '../db/schema';
import { DEFAULT_PAGE_SIZE } from './config';

export type CatalogQuery = {
  category: string | null;
  brand: string | null;
  q: string | null;
  min: number | null;
  max: number | null;
  sort: string | null;
  page: number;
  pageSize: number;
  attrs: Record<string, string[]>;
};

type CategoryRow = typeof t.categories.$inferSelect;
type FacetValue = { slug: string; label: string; count: number };
type FacetDef = { slug: string; name: string; unit: string | null; values: FacetValue[] };

function toInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function paramsToQuery(sp: URLSearchParams): CatalogQuery {
  const query: CatalogQuery = {
    category: sp.get('category'),
    brand: sp.get('brand'),
    q: sp.get('q'),
    min: toInt(sp.get('min')),
    max: toInt(sp.get('max')),
    sort: sp.get('sort'),
    page: Math.max(1, toInt(sp.get('page')) ?? 1),
    pageSize: Math.min(48, toInt(sp.get('page_size')) ?? DEFAULT_PAGE_SIZE),
    attrs: {},
  };
  for (const [key, value] of sp.entries()) {
    if (key.startsWith('a_') && value) {
      const defSlug = key.slice(2);
      const list = query.attrs[defSlug] ?? [];
      list.push(value);
      query.attrs[defSlug] = list;
    }
  }
  return query;
}

export async function listCategories() {
  return db
    .select({ id: t.categories.id, slug: t.categories.slug, name: t.categories.name })
    .from(t.categories)
    .orderBy(asc(t.categories.sortOrder));
}

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
    categories: catRows.map((cat) => ({ slug: cat.slug, name: cat.name, count: countMap.get(cat.id) ?? 0 })),
  };
}

export async function listProducts(query: CatalogQuery) {
  const category = query.category
    ? ((await db.select().from(t.categories).where(eq(t.categories.slug, query.category)))[0] ?? null)
    : null;
  if (query.category && !category) {
    return { items: [], total: 0, page: query.page, pageSize: query.pageSize, facets: null };
  }

  const conds: (SQL | undefined)[] = [];
  if (category) conds.push(eq(t.products.categoryId, category.id));
  if (query.brand) conds.push(eq(t.products.brand, query.brand));
  if (query.min !== null) conds.push(gte(t.products.priceRials, query.min));
  if (query.max !== null) conds.push(lte(t.products.priceRials, query.max));
  if (query.q) {
    const like = '%' + query.q + '%';
    conds.push(or(ilike(t.products.name, like), ilike(t.products.description, like)));
  }
  for (const [defSlug, valueSlugs] of Object.entries(query.attrs)) {
    if (valueSlugs.length === 0) continue;
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
  const sort = query.sort ?? 'newest';
  const sortExpr =
    sort === 'price_asc' ? asc(t.products.priceRials) : sort === 'price_desc' ? desc(t.products.priceRials) : desc(t.products.id);

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
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const facets = await buildFacets(category);
  return { items, total, page: query.page, pageSize: query.pageSize, facets };
}

export async function productBySlug(slug: string) {
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
  if (!row) return null;
  const attributes = await db
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
  return { product: row, attributes, availableQuantity: inv?.quantity ?? 0 };
}
