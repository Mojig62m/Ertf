# راهنمای استقرار (Runbook) — ارتِف

نسخه ۱٫۰ — گام‌به‌گام برای انتشار در تولید. مرجع: `golive-master-plan.md`.

---

## ۰. پیش‌نیازها

- Node.js **≥ ۲۲٫۱۲** (رانتایم توصیه‌شده: Node 24 LTS)
- Docker (برای ساخت و اجرای ایمیج)
- PostgreSQL 16 در دسترس
- دسترسی به سرویس مدیریت اسرار محیط هدف
- دامنه و گواهی TLS

## ۱. متغیرهای محیطی (از سرویس مدیریت اسرار)

| متغیر | الزامی | یادداشت |
|---|---|---|
| `DATABASE_URL` | ✅ | بدون fallback؛ نبودش شکست بلند |
| `NODE_ENV` | — | `production` |
| `PORT` | — | پیش‌فرض `4321` |
| `DB_POOL_MAX` | — | پیش‌فرض `10` |
| `LOG_LEVEL` | — | `info` در تولید |
| `APP_VERSION` | — | از SHA گیت |

## ۲. ساخت

```bash
docker build --target runtime -t ertf-app:<version> .
```

## ۳. مهاجرت دیتابیس (گام جدا، پیش از اجرای اپ)

```bash
# با سرویس migrate در compose یا یک job یک‌باره
DATABASE_URL=... npm run db:migrate
```

> هرگز در تولید `db:push` اجرا نکنید. مهاجرت‌ها فقط رو به جلو و سازگار (expand–contract) طراحی می‌شوند.

## ۴. اجرا

```bash
docker run -d --name ertf-app \
  -p 4321:4321 \
  -e DATABASE_URL=... -e NODE_ENV=production -e HOST=0.0.0.0 \
  ertf-app:<version>
```

یا با compose: `docker compose up -d --build` (زنجیرهٔ db → migrate → app).

## ۵. تأیید پس از استقرار

```bash
curl -sf http://HOST:4321/api/health        # {ok:true,status:"live"}
curl -sf http://HOST:4321/api/health/ready   # {ok:true,status:"ready"}
BASE_URL=http://HOST:4321 bash scripts/smoke.sh
```

انتظار: خروجی smoke با «۰ ناموفق».

## ۶. بازگشت نسخه (Rollback)

۱. ایمیج نسخهٔ پایدار پیشین را دوباره اجرا کنید.
۲. اگر مهاجرت جدید اعمال شده، **مهاجرت معکوس اجرا نکنید**؛ طرح باید سازگار به عقب باشد.
۳. `ready` و smoke را دوباره اجرا کنید.

## ۷. پایش پس از انتشار

- نرخ خطای ۵xx، تأخیر p95، شکست `/api/health/ready`.
- نرخ ناموفق پرداخت (پس از اتصال زرین‌پال).
- بودجهٔ خطا (SLO) مبنای تصمیم توقف/ادامهٔ انتشار.

## ۸. عیب‌یابی سریع

| نشانه | علت محتمل | اقدام |
|---|---|---|
| `ready` کد ۵۰۳ | قطع دیتابیس | بررسی `DATABASE_URL` و سلامت DB |
| خطای راه‌اندازی «متغیر … تعریف نشده» | نبود راز | تنظیم در سرویس اسرار |
| `ERESOLVE` هنگام نصب | نبود lockfile | استفاده از `npm ci` با lockfile مخزن |
| اپ بالا نمی‌آید | مهاجرت اجرا نشده | اجرای گام ۳ |
