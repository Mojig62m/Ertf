# نتیجه اجرای خودکار نمونه مرحله دوم (GitHub Actions)

تاریخ اجرا: 2026-10-14 04:11 UTC — وضعیت کلی: FAILED

این سند به‌صورت خودکار توسط گردش‌کار prototype-verify تولید و ثبت می‌شود. مبنای قدم ۶ سنجش و ورودی ADR-0005 است. سنجه‌ها آزمایشگاهی (Lighthouse با تقلید موبایل) هستند؛ صدک ۷۵ کاربران واقعی پس از راه‌اندازی تولید از طریق داده میدانی سنجیده می‌شود.

## سنجه‌های آزمایشگاهی — قالب: صفحه | LCP میلی‌ثانیه | CLS | TBT میلی‌ثانیه | INP میلی‌ثانیه

سنجش انجام نشد

## نتیجه آزمون دودی مسیر طلایی

آزمون دودی انجام نشد

## تشخیص خطا

---- لاگ install (چهل خط آخر) ----
npm error code ERESOLVE
npm error ERESOLVE unable to resolve dependency tree
npm error
npm error While resolving: ertf-prototype@undefined
npm error Found: astro@6.4.8
npm error node_modules/astro
npm error   astro@"^6.0.0" from the root project
npm error
npm error Could not resolve dependency:
npm error peer astro@"^7.2.1" from @astrojs/node@11.1.7
npm error node_modules/@astrojs/node
npm error   @astrojs/node@"^11.1.0" from the root project
npm error
npm error Fix the upstream dependency conflict, or retry
npm error this command with --force or --legacy-peer-deps
npm error to accept an incorrect (and potentially broken) dependency resolution.
npm error
npm error
npm error For a full report see:
npm error /home/runner/.npm/_logs/2026-10-14T04_11_37_578Z-eresolve-report.txt
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-10-14T04_11_37_578Z-debug-0.log

