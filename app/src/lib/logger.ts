// لاگ ساختاریافته (JSON) — رفع B8 و الزام ASVS «لاگ بدون داده شخصی یا اسرار»
// هر خط یک شیء JSON است تا در سیستم‌های پایش (Loki/ELK/Datadog) قابل جست‌وجو باشد.
//
// قاعدهٔ حریم خصوصی: هرگز نام، تلفن، نشانی، ایمیل یا شماره کارت مشتری در لاگ ثبت نمی‌شود.
// شناسه‌هایی که ثبت می‌شوند فقط شناسهٔ فنی سفارش و شناسهٔ درخواست هستند.

import { env, type LogLevel } from './env';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, msg: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[env().LOG_LEVEL]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    service: 'ertf-app',
    version: env().APP_VERSION,
    env: env().NODE_ENV,
    ...fields,
  });
  // خطا و هشدار روی stderr، بقیه روی stdout — تا ابزارهای پایش بتوانند تفکیک کنند
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  debug: (msg: string, fields?: LogFields): void => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields): void => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields): void => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields): void => emit('error', msg, fields),
};

/** نرمال‌سازی خطا برای لاگ بدون افشای جزئیات داخلی به مشتری */
export function errorFields(err: unknown): LogFields {
  if (err instanceof Error) return { errorName: err.name, errorMessage: err.message, stack: err.stack };
  return { errorMessage: String(err) };
}
