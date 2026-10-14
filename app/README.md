# نمونه فنی ارتِف — اپلیکیشن (Astro 7 + Svelte + Hono + PostgreSQL)

مسیر طلایی: خانه، کاتالوگ با فیلتر چندوجهی، محصول، سبد، تسویه، تأیید سفارش.
برنامه مصوب: `docs/04-delivery/golive-master-plan.md` — تصمیم استک/رانتایم: `docs/01-governance/decision-records/ADR-0005-stack-runtime-golive.md`

## پیش‌نیازها

- Node.js نسخهٔ **۲۲٫۱۲ یا بالاتر** (الزام Astro 7)؛ رانتایم توصیه‌شده برای تولید: **Node 24 LTS**
- PostgreSQL نسخهٔ ۱۶
- Docker (اختیاری، برای اجرای کانتینری)

## راه‌اندازی سریع با Docker (توصیه‌شده)

```bash
docker compose up -d --build
# مرورگر: http://localhost:4321
```

این دستور به‌ترتیب: دیتابیس را بالا می‌آورد، **مهاجرت‌های نسخه‌دار** را اجرا می‌کند (`migrate`)، سپس اپ را با ایمیج تولید اجرا می‌کند.

## راه‌اندازی محلی (توسعه)

```bash
cp .env.example .env          # DATABASE_URL را در صورت نیاز تنظیم کنید
docker compose up -d db       # فقط دیتابیس
npm ci                        # نصب قطعی بر پایهٔ lockfile
npm run db:migrate            # اعمال مهاجرت‌های نسخه‌دار
npm run db:seed               # ۵۰ محصول نمونه
npm run dev                   # http://localhost:4321
```

> نکته: از این پس `npm install` بدون خطای ERESOLVE کار می‌کند، زیرا lockfile ثبت شده و نسخه‌ها هم‌تراز شده‌اند. دیگر نیازی به `--legacy-peer-deps` نیست.

## متغیرهای محیطی

| متغیر | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | رشتهٔ اتصال PostgreSQL. **هیچ fallback ندارد**؛ نبودش باعث شکست بلند می‌شود. |
| `NODE_ENV` | — | `development` | `development` \| `test` \| `production` |
| `PORT` | — | `4321` | پورت HTTP |
| `DB_POOL_MAX` | — | `10` | حداکثر اتصال هم‌زمان دیتابیس |
| `LOG_LEVEL` | — | `info` | `debug` \| `info` \| `warn` \| `error` |
| `APP_VERSION` | — | `dev` | نسخهٔ ثبت‌شده در لاگ ساختاریافته (در CI از SHA گیت) |

## اسکریپت‌ها

| اسکریپت | کار |
|---|---|
| `npm run dev` | سرور توسعه |
| `npm run build` | ساخت نسخهٔ تولید (`dist/server/entry.mjs`) |
| `npm start` | اجرای سرور تولید |
| `npm run check` | تایپ‌چک (`astro check`) |
| `npm test` | آزمون‌های واحد (Vitest) |
| `npm run db:generate` | تولید مهاجرت از طرح |
| `npm run db:migrate` | اعمال مهاجرت‌ها (تولید) |
| `npm run db:push` | همگام‌سازی مستقیم طرح (فقط توسعه) |
| `npm run db:seed` | بارگذاری دادهٔ نمونه |

## نقاط پایانی API

- `GET /api/health` — زنده‌بودن (liveness؛ بدون وابستگی)
- `GET /api/health/ready` — آمادگی (readiness؛ اتصال واقعی دیتابیس؛ در نبود DB کد ۵۰۳)
- `GET /api/categories` — فهرست دسته‌ها
- `GET /api/products` — کاتالوگ: `category`, `brand`, `q`, `min`, `max`, `sort`, `page`, `page_size` و فیلتر ویژگی مانند `a_color=black`
- `GET /api/products/:slug` — جزئیات محصول، ویژگی‌ها و موجودی
- `POST /api/orders` — ثبت سفارش با `idempotencyKey`؛ پاسخ تکراری، همان سفارش قبلی است
- `GET /api/orders/:id` — سفارش و اقلام آن

هر پاسخ سرصفحهٔ `x-request-id` دارد و رویدادها به‌صورت لاگ ساختاریافتهٔ JSON ثبت می‌شوند.

## استقرار در تولید

۱. **پیکربندی:** متغیرها را از سرویس مدیریت اسرار (Secret Manager) تغذیه کنید. هرگز `.env` واقعی را کامیت نکنید.
۲. **مهاجرت:** پیش از هر انتشار، `npm run db:migrate` را در یک گام جدا (سرویس `migrate` در compose یا job CI) اجرا کنید — نه `db:push`.
۳. **ساخت:** `docker build --target runtime -t ertf-app .`
۴. **اجرا:** کانتینر با `PORT` و `HOST=0.0.0.0`؛ ایمیج غیر root اجرا می‌شود و `HEALTHCHECK` روی `/api/health/ready` تنظیم است.
۵. **تأیید:** پس از بالا آمدن، `BASE_URL=http://host:4321 bash scripts/smoke.sh` را اجرا کنید (نیازمند `curl` و `jq`).
۶. **بازگشت نسخه:** ایمیج نسخهٔ پیشین را دوباره اجرا کنید؛ مهاجرت‌ها فقط رو به جلو و سازگار (expand–contract) طراحی می‌شوند.

## آزمون دودی

```bash
BASE_URL=http://localhost:4321 bash scripts/smoke.sh
```

## لایهٔ پرداخت

انتزاع مستقل از تأمین‌کننده در `src/lib/payment`: امروز `SimulatedProvider` فعال است؛ `ZarinpalProvider` در همان نقطه در مرحله سوم جایگزین می‌شود (ADR-0003). جابه‌جایی تأمین‌کننده، تغییری در جریان سفارش، موجودی و محاسبات ایجاد نمی‌کند.

## نسل‌جدید — قابلیت‌های پیاده‌شده

- **Server Islands** (`src/components/StockIsland.astro`): پوستهٔ صفحه استاتیک می‌ماند و قیمت/موجودی لحظه‌ای به‌صورت قطعهٔ تأخیری استریم می‌شود.
- **پیش‌واکشی هوشمند (Speculation Rules)**: ناوبری آنی با راهبرد `hover` (تنظیم در `astro.config.mjs`).
- **راهنمای اولویت تصویر**: `fetchpriority="high"` روی تصویر LCP و `loading="lazy"` برای بقیه.
- **مشاهده‌پذیری**: لاگ ساختاریافتهٔ JSON + شناسهٔ درخواست + probe آمادگی دیتابیس.

## ناوردهای رعایت‌شده

- محاسبهٔ قیمت فقط در سرور؛ کلاینت فقط شناسهٔ محصول و تعداد می‌فرستد
- کلید idempotency برای جلوگیری از سفارش تکراری (R05)
- تمام مبالغ ریالی عدد صحیح؛ آزمون‌پذیر (R14)
- PostgreSQL منبع حقیقت؛ هیچ وضعیت تجاری در کلاینت یا کش نگه داشته نمی‌شود
- اقلام دیجیتال در لحظهٔ ثبت سفارش لایسنس `ERF` دریافت می‌کنند
- **بدون راز در کد یا مخزن**؛ `DATABASE_URL` بدون fallback (ASVS ۵)

## ساده‌سازی‌های شناخته‌شدهٔ نمونه

- شمارش وجه‌های فیلتر فقط در محدودهٔ دسته است، بدون اعمال سایر فیلترها
- پرداخت شبیه‌سازی‌شده است؛ اتصال sandbox زرین‌پال در مرحله سوم طبق برنامه
