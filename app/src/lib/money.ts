import { FREE_SHIPPING_THRESHOLD_RIALS, SHIPPING_FLAT_RIALS } from './config';

// همه مبالغ ریالی، اعداد صحیح امن (safe integer) هستند؛ هیچ مقدار اعشاری مجاز نیست (R14)

export function assertRials(amount: number, label = 'amount'): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(label + ' باید عدد صحیح و نامنفی باشد');
  }
}

export function effectivePrice(priceRials: number, discountRials: number): number {
  assertRials(priceRials, 'priceRials');
  assertRials(discountRials, 'discountRials');
  if (discountRials > priceRials) {
    throw new Error('تخفیف از قیمت بیشتر است');
  }
  return priceRials - discountRials;
}

export function lineTotal(unitPriceRials: number, quantity: number): number {
  assertRials(unitPriceRials, 'unitPriceRials');
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('تعداد نامعتبر است');
  }
  const total = unitPriceRials * quantity;
  if (!Number.isSafeInteger(total)) {
    throw new Error('مبلغ قلم سفارش خارج از محدوده امن است');
  }
  return total;
}

export function subtotalOf(lineTotals: number[]): number {
  let sum = 0;
  for (const value of lineTotals) {
    assertRials(value, 'lineTotal');
    if (!Number.isSafeInteger(sum + value)) {
      throw new Error('جمع سبد خارج از محدوده امن است');
    }
    sum += value;
  }
  return sum;
}

export function shippingFor(subtotalRials: number): number {
  assertRials(subtotalRials, 'subtotalRials');
  if (FREE_SHIPPING_THRESHOLD_RIALS !== null && subtotalRials >= FREE_SHIPPING_THRESHOLD_RIALS) {
    return 0;
  }
  return SHIPPING_FLAT_RIALS;
}

export function applyPercentDiscount(amountRials: number, percent: number): number {
  assertRials(amountRials, 'amountRials');
  if (!Number.isSafeInteger(percent) || percent < 0 || percent > 100) {
    throw new Error('درصد نامعتبر است');
  }
  const scaled = amountRials * percent;
  if (!Number.isSafeInteger(scaled)) {
    throw new Error('مبلغ خارج از محدوده امن است');
  }
  return Math.floor(scaled / 100);
}
