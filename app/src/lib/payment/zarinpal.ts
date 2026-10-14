// پوسته اتصال زرین‌پال — پیاده‌سازی کامل در مرحله سوم طبق ADR-0003
// مستندات رسمی: https://docs.zarinpal.com
// الزامات عملیاتی ثبت‌شده در ADR-0003: ثبت IPهای مجاز سرور، اعتبارسنجی callback در سرور، مقاوم‌سازی تکرار درخواست

import type { PaymentInitiation, PaymentProvider } from './index';

export class ZarinpalProvider implements PaymentProvider {
  readonly id = 'zarinpal';
  settle(_orderId: number): PaymentInitiation {
    throw new Error('پیاده‌سازی زرین‌پال در مرحله سوم انجام می‌شود');
  }
}
