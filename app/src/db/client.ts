import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../lib/env';

// اتصال به PostgreSQL — منبع حقیقت (ناوردای ۱ خط پایه معماری).
// راهبرد: ساخت تنبل (lazy) اتصال.
//  ۱) زمان build بدون DB نباید خطا بدهد.
//  ۲) نبود DATABASE_URL در زمان اجرا باید بلند شکست بخورد (نه fallback پنهان).

let sqlClient: ReturnType<typeof postgres> | null = null;
let instance: PostgresJsDatabase<typeof schema> | null = null;

function init(): PostgresJsDatabase<typeof schema> {
  if (instance) return instance;
  const cfg = env();
  sqlClient = postgres(cfg.DATABASE_URL, {
    max: cfg.DB_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
    // اتصال‌های بیکار را نگه ندار؛ برای محیط‌های کانتینری مهم است
    max_lifetime: 60 * 30,
  });
  instance = drizzle(sqlClient, { schema });
  return instance;
}

/**
 * نمونهٔ drizzle با API ثابت `db.select()` / `db.transaction()`.
 * با Proxy، اتصال فقط در نخستین فراخوانی ساخته می‌شود.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    const real = init() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

/** بستن تمیز اتصال‌ها — برای خاموشی نرم (graceful shutdown) و آزمون‌ها */
export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    instance = null;
  }
}
