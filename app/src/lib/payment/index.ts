import { randomBytes } from 'node:crypto';

// انتزاع مستقل از تأمین‌کننده پرداخت — الزام ADR-0003
// امروز: شبیه‌سازی؛ مرحله سوم: زرین‌پال؛ آینده: افزودن تأمین‌کننده دوم فقط با یک کلاس جدید

export type PaymentInitiation = {
  paymentRef: string;
  status: 'paid_simulated' | 'pending';
};

export interface PaymentProvider {
  readonly id: string;
  /** پس از ثبت سفارش، تسویه را نهایی می‌کند؛ در تولید واقعی، کاربر به درگاه میزبان‌شده هدایت می‌شود */
  settle(orderId: number): PaymentInitiation;
}

export class SimulatedProvider implements PaymentProvider {
  readonly id = 'simulated';
  settle(orderId: number): PaymentInitiation {
    const ref = 'SIM-' + orderId + '-' + randomBytes(4).toString('hex').toUpperCase();
    return { paymentRef: ref, status: 'paid_simulated' };
  }
}

export function getPaymentProvider(): PaymentProvider {
  // در مرحله سوم، این تابع بر اساس پیکربندی، ZarinpalProvider را برمی‌گرداند (ADR-0003)
  return new SimulatedProvider();
}
