import { defineConfig } from 'drizzle-kit';

// رفع B6: هیچ fallback لوکال‌هاستی وجود ندارد.
// اجرای drizzle-kit بدون DATABASE_URL باید بلند شکست بخورد.
const url = process.env.DATABASE_URL;
if (!url || url.trim() === '') {
  throw new Error(
    'DATABASE_URL برای اجرای drizzle-kit الزامی است و هیچ مقدار پیش‌فرضی ندارد. نمونه: postgres://user:pass@host:5432/ertf',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: url.trim() },
  strict: true,
  verbose: true,
});
