import { shippingFor, subtotalOf } from './money';

export type CartLine = {
  productId: number;
  name: string;
  slug: string;
  unitPriceRials: number;
  quantity: number;
  isDigital: boolean;
};

const KEY = 'ertf_cart_v1';
const CHANGE_EVENT = 'ertf-cart-changed';

export function readCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => typeof l?.productId === 'number' && typeof l?.quantity === 'number');
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function addToCart(line: Omit<CartLine, 'quantity'>, quantity: number): void {
  const lines = readCart();
  const existing = lines.find((l) => l.productId === line.productId);
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else lines.push({ ...line, quantity: Math.min(20, Math.max(1, quantity)) });
  write(lines);
}

export function setQuantity(productId: number, quantity: number): void {
  const lines = readCart().map((l) =>
    l.productId === productId ? { ...l, quantity: Math.min(20, Math.max(1, quantity)) } : l,
  );
  write(lines);
}

export function removeFromCart(productId: number): void {
  write(readCart().filter((l) => l.productId !== productId));
}

export function clearCart(): void {
  write([]);
}

export function cartTotals(lines: CartLine[]): { subtotal: number; shipping: number; total: number } {
  const subtotal = subtotalOf(lines.map((l) => l.unitPriceRials * l.quantity));
  const shipping = shippingFor(subtotal);
  return { subtotal, shipping, total: subtotal + shipping };
}
