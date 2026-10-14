<script lang="ts">
  import { clearCart, readCart } from '../lib/cart';

  let name = $state('');
  let phone = $state('');
  let city = $state('');
  let address = $state('');
  let postalCode = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  function makeIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'key-' + String(Date.now()) + '-' + String(Math.random());
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const lines = readCart();
    if (lines.length === 0) {
      error = 'سبد خرید خالی است';
      return;
    }
    busy = true;
    error = null;
    try {
      const body = {
        idempotencyKey: makeIdempotencyKey(),
        customer: { name, phone, city, address, postalCode },
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        error = data && data.error ? data.error : 'ثبت سفارش ناموفق بود';
        busy = false;
        return;
      }
      clearCart();
      window.location.href = '/order/' + String(data.order.id);
    } catch {
      error = 'ارتباط با سرور برقرار نشد';
      busy = false;
    }
  }
</script>

<form class="checkout-form" onsubmit={submit}>
  <label>نام و نام خانوادگی <input type="text" bind:value={name} required /></label>
  <label>شماره موبایل <input type="tel" bind:value={phone} required /></label>
  <label>شهر <input type="text" bind:value={city} required /></label>
  <label>نشانی <textarea bind:value={address} rows="3" required></textarea></label>
  <label>کد پستی <input type="text" bind:value={postalCode} required /></label>
  {#if error}<p class="form-error">{error}</p>{/if}
  <button class="btn" type="submit" disabled={busy}>{busy ? 'در حال ثبت سفارش…' : 'ثبت سفارش و پرداخت شبیه‌سازی‌شده'}</button>
</form>
