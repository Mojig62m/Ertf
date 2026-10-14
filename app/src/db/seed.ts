import { db, closeDb } from './client';
import * as t from './schema';

// مولد شبه‌تصادفی قطعی برای تکرارپذیری seed
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
const rnd = makeRandom(42);

type ValueSpec = [slug: string, label: string];
type DefSpec = { slug: string; name: string; unit: string | null; values: ValueSpec[] };
type ProductSpec = {
  slug: string;
  name: string;
  brand: string;
  priceRials: number;
  discountRials?: number;
  isDigital?: boolean;
};
type CategorySpec = { slug: string; name: string; defs: DefSpec[]; products: ProductSpec[] };

const CATEGORIES: CategorySpec[] = [
  {
    slug: 'digital-gear',
    name: 'لوازم دیجیتال',
    defs: [
      { slug: 'color', name: 'رنگ', unit: null, values: [['black', 'مشکی'], ['silver', 'نقره‌ای'], ['white', 'سفید']] },
      { slug: 'capacity', name: 'ظرفیت', unit: 'گیگابایت', values: [['128', '۱۲۸'], ['256', '۲۵۶'], ['512', '۵۱۲']] },
    ],
    products: [
      { slug: 'wireless-headphones', name: 'هدفون بی‌سیم', brand: 'آوید', priceRials: 4500000 },
      { slug: 'smart-watch', name: 'ساعت هوشمند', brand: 'آوید', priceRials: 12500000 },
      { slug: 'bluetooth-speaker', name: 'اسپیکر بلوتوث', brand: 'تکنوا', priceRials: 3200000, discountRials: 300000 },
      { slug: 'power-bank', name: 'پاوربانک ۲۰۰۰۰', brand: 'لومِن', priceRials: 2450000 },
      { slug: 'external-hdd', name: 'هارد اکسترنال', brand: 'سِرو', priceRials: 5900000 },
      { slug: 'wireless-mouse', name: 'ماوس بی‌سیم', brand: 'آوید', priceRials: 890000 },
      { slug: 'mechanical-keyboard', name: 'کیبورد مکانیکال', brand: 'تکنوا', priceRials: 4100000 },
      { slug: 'usb-c-cable', name: 'کابل شارژ USB-C', brand: 'لومِن', priceRials: 189000 },
      { slug: 'antivirus-license', name: 'لایسنس آنتی‌ویروس یک‌ساله', brand: 'سِیف‌کد', priceRials: 1250000, isDigital: true },
      { slug: 'accounting-license', name: 'لایسنس نرم‌افزار حسابداری', brand: 'داتیس', priceRials: 7800000, isDigital: true },
    ],
  },
  {
    slug: 'home-kitchen',
    name: 'خانه و آشپزخانه',
    defs: [
      { slug: 'material', name: 'جنس', unit: null, values: [['steel', 'استیل'], ['ceramic', 'سرامیک'], ['wood', 'چوب']] },
      { slug: 'color', name: 'رنگ', unit: null, values: [['white', 'سفید'], ['cream', 'کرم'], ['gray', 'طوسی']] },
    ],
    products: [
      { slug: 'cookware-set', name: 'ست قابلمه', brand: 'خانه‌بان', priceRials: 6800000 },
      { slug: 'electric-kettle', name: 'کتری برقی', brand: 'لیمو', priceRials: 3450000 },
      { slug: 'tea-maker', name: 'قوری چای‌ساز', brand: 'لیمو', priceRials: 4200000, discountRials: 400000 },
      { slug: 'juicer', name: 'آبمیوه‌گیری', brand: 'پارس‌الکترو', priceRials: 5100000 },
      { slug: 'spice-grinder', name: 'آسیاب ادویه', brand: 'خانه‌بان', priceRials: 1850000 },
      { slug: 'dinnerware-set', name: 'ست ظروف', brand: 'ویترین', priceRials: 7300000 },
      { slug: 'cutlery-set', name: 'سرویس قاشق چنگال', brand: 'ویترین', priceRials: 2900000 },
      { slug: 'cutting-board', name: 'تخته کار', brand: 'چوب‌آرا', priceRials: 780000 },
      { slug: 'colander', name: 'آبکش', brand: 'خانه‌بان', priceRials: 420000 },
      { slug: 'spice-box', name: 'جاادویه', brand: 'چوب‌آرا', priceRials: 650000 },
    ],
  },
  {
    slug: 'apparel',
    name: 'پوشاک',
    defs: [
      { slug: 'size', name: 'سایز', unit: null, values: [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']] },
      { slug: 'color', name: 'رنگ', unit: null, values: [['black', 'مشکی'], ['navy', 'سرمه‌ای'], ['olive', 'زیتونی']] },
    ],
    products: [
      { slug: 'cotton-tshirt', name: 'تی‌شرت نخی', brand: 'ماهور', priceRials: 890000 },
      { slug: 'men-shirt', name: 'پیراهن مردانه', brand: 'ماهور', priceRials: 1650000 },
      { slug: 'jeans', name: 'شلوار جین', brand: 'دنیم‌کده', priceRials: 3200000 },
      { slug: 'jacket', name: 'کاپشن', brand: 'شالیک', priceRials: 4800000, discountRials: 600000 },
      { slug: 'sweater', name: 'پلیور', brand: 'شالیک', priceRials: 2100000 },
      { slug: 'scarf', name: 'شال', brand: 'رعنا', priceRials: 750000 },
      { slug: 'manteau', name: 'مانتو', brand: 'رعنا', priceRials: 3900000 },
      { slug: 'leather-belt', name: 'کمربند چرمی', brand: 'چرم‌سرا', priceRials: 1200000 },
      { slug: 'skirt', name: 'دامن', brand: 'دنیم‌کده', priceRials: 1950000 },
      { slug: 'knit-hat', name: 'کلاه بافت', brand: 'شالیک', priceRials: 480000 },
    ],
  },
  {
    slug: 'books-stationery',
    name: 'کتاب و لوازم تحریر',
    defs: [
      { slug: 'cover', name: 'نوع جلد', unit: null, values: [['soft', 'شومیز'], ['hard', 'سخت‌جلد'], ['pocket', 'جیبی']] },
      { slug: 'pages', name: 'تعداد صفحات', unit: null, values: [['lt200', 'زیر ۲۰۰'], ['200-400', '۲۰۰ تا ۴۰۰'], ['gt400', 'بالای ۴۰۰']] },
    ],
    products: [
      { slug: 'novel-shadows', name: 'رمان «سایه‌ها»', brand: 'نشر آفتاب', priceRials: 320000 },
      { slug: 'book-history', name: 'کتاب تاریخ ایران', brand: 'نشر آگاه', priceRials: 480000 },
      { slug: 'book-programming', name: 'کتاب آموزش برنامه‌نویسی', brand: 'نشر فنی', priceRials: 890000 },
      { slug: 'notebook-200', name: 'دفتر ۲۰۰ برگ', brand: 'خُرد', priceRials: 95000 },
      { slug: 'pen-pack', name: 'بسته خودکار', brand: 'خُرد', priceRials: 180000 },
      { slug: 'colored-pencils', name: 'مدادرنگی', brand: 'رنگین', priceRials: 340000 },
      { slug: 'file-folder', name: 'فایل پوشه', brand: 'خُرد', priceRials: 120000 },
      { slug: 'glue', name: 'چسب مایع', brand: 'خُرد', priceRials: 60000 },
      { slug: 'protractor', name: 'زاویه‌یاب', brand: 'فنی‌آرا', priceRials: 85000 },
      { slug: 'calculator', name: 'ماشین‌حساب', brand: 'فنی‌آرا', priceRials: 690000 },
    ],
  },
  {
    slug: 'sport-health',
    name: 'ورزش و سلامت',
    defs: [
      { slug: 'weight', name: 'وزن', unit: 'کیلوگرم', values: [['5', '۵'], ['10', '۱۰'], ['15', '۱۵']] },
      { slug: 'level', name: 'سطح', unit: null, values: [['beginner', 'مبتدی'], ['intermediate', 'متوسط'], ['advanced', 'پیشرفته']] },
    ],
    products: [
      { slug: 'dumbbell', name: 'دمبل', brand: 'آیرون', priceRials: 950000 },
      { slug: 'hiking-backpack', name: 'کوله کوهنوردی', brand: 'قله', priceRials: 4300000 },
      { slug: 'yoga-mat', name: 'متبس ورزشی', brand: 'آسا', priceRials: 1150000 },
      { slug: 'jump-rope', name: 'طناب تمرین', brand: 'آیرون', priceRials: 320000 },
      { slug: 'football', name: 'توپ فوتبال', brand: 'قله', priceRials: 890000 },
      { slug: 'gym-bag', name: 'ساک ورزشی', brand: 'آسا', priceRials: 1450000 },
      { slug: 'water-bottle', name: 'بطری آب', brand: 'آسا', priceRials: 380000 },
      { slug: 'gym-gloves', name: 'دستکش ورزشی', brand: 'آیرون', priceRials: 520000 },
      { slug: 'fitness-band', name: 'مچ‌بند پایش فعالیت', brand: 'پالس', priceRials: 2950000 },
      { slug: 'massage-gun', name: 'ماساژور دستی', brand: 'پالس', priceRials: 5600000, discountRials: 700000 },
    ],
  },
];

async function main() {
  await db.delete(t.orderItems);
  await db.delete(t.orders);
  await db.delete(t.productAttributeValues);
  await db.delete(t.inventory);
  await db.delete(t.products);
  await db.delete(t.attributeValues);
  await db.delete(t.categoryAttributeDefs);
  await db.delete(t.categories);

  let productCount = 0;
  for (const [catIndex, spec] of CATEGORIES.entries()) {
    const [cat] = await db
      .insert(t.categories)
      .values({ slug: spec.slug, name: spec.name, sortOrder: catIndex })
      .returning();
    const valueIdsByDef = new Map<string, number[]>();
    for (const [defIndex, def] of spec.defs.entries()) {
      const [defRow] = await db
        .insert(t.categoryAttributeDefs)
        .values({ categoryId: cat.id, slug: def.slug, name: def.name, unit: def.unit, sortOrder: defIndex })
        .returning();
      const ids: number[] = [];
      for (const [valueIndex, [valueSlug, label]] of def.values.entries()) {
        const [valueRow] = await db
          .insert(t.attributeValues)
          .values({ defId: defRow.id, slug: valueSlug, value: label, sortOrder: valueIndex })
          .returning();
        ids.push(valueRow.id);
      }
      valueIdsByDef.set(def.slug, ids);
    }
    for (const [productIndex, product] of spec.products.entries()) {
      const [productRow] = await db
        .insert(t.products)
        .values({
          categoryId: cat.id,
          slug: product.slug,
          name: product.name,
          description: 'خرید ' + product.name + ' با ارسال سریع از ارتِف.',
          brand: product.brand,
          priceRials: product.priceRials,
          discountRials: product.discountRials ?? 0,
          isDigital: product.isDigital ?? false,
        })
        .returning();
      productCount += 1;
      await db.insert(t.inventory).values({ productId: productRow.id, quantity: 3 + Math.floor(rnd() * 38) });
      if (!product.isDigital) {
        for (const [defIndex, def] of spec.defs.entries()) {
          const ids = valueIdsByDef.get(def.slug) ?? [];
          if (ids.length === 0) continue;
          const valueId = ids[(productIndex + defIndex) % ids.length];
          await db.insert(t.productAttributeValues).values({ productId: productRow.id, valueId });
        }
      }
    }
  }
  console.log('seed complete: ' + productCount + ' products in ' + CATEGORIES.length + ' categories');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
