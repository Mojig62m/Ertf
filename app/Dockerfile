# syntax=docker/dockerfile:1

# =============================================================
#  ارتِف — ایمیج تولید
#  اهداف: تکرارپذیری، اجرای غیر root، بیلد چندمرحله‌ای، سطح حملهٔ کم
#  نکته: node:22-bookworm-slim (glibc) به‌جای alpine انتخاب شد تا افزونه‌های
#  بومی مانند sharp (libvips) بدون مشکل لینک شوند — قابلیت اطمینان بر حجم.
# =============================================================

########## مرحله ۱ — وابستگی‌ها ##########
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

########## مرحله ۲ — ساخت ##########
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

########## مرحله ۳ — اجرای مهاجرت‌ها (یک‌بار پیش از انتشار) ##########
# این مرحله وابستگی‌های کامل (شامل drizzle-kit) را دارد و فقط برای اجرای
# مهاجرت نسخه‌دار دیتابیس استفاده می‌شود؛ در زمان اجرای اپ بارگذاری نمی‌شود.
FROM build AS migrator
CMD ["npm", "run", "db:migrate"]

########## مرحله ۴ — زمان اجرا (فقط وابستگی تولید) ##########
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4321
ENV HOST=0.0.0.0

# اجرای غیر root
RUN groupadd --system --gid 1001 ertf \
  && useradd --system --uid 1001 --gid ertf --create-home ertf

# فقط وابستگی‌های تولید (بدون vitest/drizzle-kit/typescript)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist

USER ertf
EXPOSE 4321

# بررسی سلامت آمادگی: اتصال واقعی به دیتابیس (نه فقط زنده‌بودن پروسه)
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
