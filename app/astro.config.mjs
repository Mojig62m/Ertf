import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import svelte from '@astrojs/svelte';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [svelte()],

  // ناوبری آنی (نسل‌جدید): پیش‌واکشی هوشمند لینک‌ها.
  // Astro از Speculation Rules API در مرورگرهای مدرن استفاده می‌کند و در
  // مرورگرهای قدیمی‌تر به prefetch معمولی عقب‌نشینی می‌کند.
  // راهبرد «hover» انتخاب شد تا در کاتالوگ‌های بزرگ، پهنای‌باند بی‌دلیل مصرف نشود.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  // فشرده‌سازی HTML تولیدی برای کاهش بایت‌های انتقال
  compressHTML: true,
});
