import { describe, expect, test } from 'vitest';
import { applyPercentDiscount, effectivePrice, lineTotal, shippingFor, subtotalOf } from '../src/lib/money';
import { FREE_SHIPPING_THRESHOLD_RIALS, SHIPPING_FLAT_RIALS } from '../src/lib/config';

describe('محاسبات ریالی (R14)', () => {
  test('قلم سفارش: قیمت واحد ضربدر تعداد', () => {
    expect(lineTotal(4500000, 3)).toBe(13500000);
    expect(lineTotal(189000, 1)).toBe(189000);
  });

  test('ورودی اعشاری یا نامنفی منفی رد می‌شود', () => {
    expect(() => lineTotal(10.5, 1)).toThrow();
    expect(() => lineTotal(-1000, 1)).toThrow();
    expect(() => lineTotal(1000, 0)).toThrow();
  });

  test('قیمت مؤثر با کسر تخفیف صحیح', () => {
    expect(effectivePrice(1000000, 250000)).toBe(750000);
    expect(() => effectivePrice(100000, 200000)).toThrow();
  });

  test('جمع سبد', () => {
    expect(subtotalOf([13500000, 189000, 0])).toBe(13689000);
    expect(subtotalOf([])).toBe(0);
  });

  test('ارسال رایگان دقیقاً از سقف خرید', () => {
    // سقف ارسال رایگان می‌تواند null باشد (تصمیم باز مالک)؛ در آن حالت این آزمون معنادار نیست.
    if (FREE_SHIPPING_THRESHOLD_RIALS === null) {
      expect(shippingFor(999_999_999)).toBe(SHIPPING_FLAT_RIALS);
      return;
    }
    const threshold: number = FREE_SHIPPING_THRESHOLD_RIALS;
    expect(shippingFor(threshold - 1)).toBe(SHIPPING_FLAT_RIALS);
    expect(shippingFor(threshold)).toBe(0);
    expect(shippingFor(0)).toBe(SHIPPING_FLAT_RIALS);
  });

  test('تخفیف درصدی با کف عدد صحیح و بدون خطای اعشار', () => {
    expect(applyPercentDiscount(999, 15)).toBe(149);
    expect(applyPercentDiscount(1000000, 25)).toBe(250000);
    expect(() => applyPercentDiscount(1000, 101)).toThrow();
  });

  test('خطای گردکردن: هیچ حاصل نباید اعشاری باشد', () => {
    const unit = 333333;
    const qty = 3;
    const total = lineTotal(unit, qty);
    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe(999999);
  });
});
