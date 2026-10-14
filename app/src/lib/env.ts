// پیکربندی محیط — بدون مقدار پیش‌فرض پنهان (رفع B6: حذف fallback لوکال‌هاست)
// اصل حاکم: نبود یک متغیر حیاتی باید زودهنگام و بلند شکست بخورد؛
// نه اینکه سرور خاموش و بی‌صدا به localhost وصل شود و در تولید داده اشتباه بنویسد.
//
// نکته: این تابع تنبل (lazy) است تا زمان build (که هیچ DB‌ای وجود ندارد) خطا ندهد
// و فقط در لحظهٔ نخستین استفاده در زمان اجرا اعتبارسنجی کند.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type NodeEnv = 'development' | 'test' | 'production';

export type AppEnv = {
  NODE_ENV: NodeEnv;
  DATABASE_URL: string;
  DB_POOL_MAX: number;
  PORT: number;
  LOG_LEVEL: LogLevel;
  APP_VERSION: string;
};

let cached: AppEnv | null = null;

function readRequired(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      'متغیر محیطی الزامی «' +
        name +
        '» تعریف نشده است. آن را در محیط استقرار (Secret Manager) یا فایل .env تنظیم کنید — نمونه: .env.example',
    );
  }
  return value.trim();
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error('متغیر محیطی «' + name + '» باید عدد صحیح مثبت باشد');
  }
  return n;
}

function readEnum<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = raw.trim() as T;
  if (!allowed.includes(value)) {
    throw new Error('مقدار «' + name + '» نامعتبر است؛ مقادیر مجاز: ' + allowed.join(' | '));
  }
  return value;
}

export function env(): AppEnv {
  if (cached) return cached;
  cached = {
    NODE_ENV: readEnum<NodeEnv>('NODE_ENV', ['development', 'test', 'production'], 'development'),
    DATABASE_URL: readRequired('DATABASE_URL'),
    DB_POOL_MAX: readInt('DB_POOL_MAX', 10),
    PORT: readInt('PORT', 4321),
    LOG_LEVEL: readEnum<LogLevel>('LOG_LEVEL', ['debug', 'info', 'warn', 'error'], 'info'),
    APP_VERSION: process.env.APP_VERSION?.trim() || 'dev',
  };
  return cached;
}

/** فقط برای آزمون‌ها: پاک‌کردن حافظهٔ پیکربندی */
export function resetEnvCache(): void {
  cached = null;
}
