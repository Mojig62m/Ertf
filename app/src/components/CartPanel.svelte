<script lang="ts">
  import { cartTotals, readCart, removeFromCart, setQuantity } from '../lib/cart';
  import type { CartLine } from '../lib/cart';
  import { formatRials } from '../lib/format';

  let lines = $state(readCart());

  function refresh() {
    lines = readCart();
  }

  $effect(() => {
    window.addEventListener('ertf-cart-changed', refresh);
    return () => {
      window.removeEventListener('ertf-cart-changed', refresh);
    };
  });

  const totals = $derived(cartTotals(lines));
</script>

{#if lines.length === 0}
  <p>سبد خرید شما خالی است.</p>
  <p><a class="btn" href="/catalog">رفتن به کاتالوگ</a></p>
{:else}
  <table class="simple">
    <thead>
      <tr>
        <th>محصول</th>
        <th>قیمت واحد</th>
        <th>تعداد</th>
        <th>جمع</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each lines as line (line.productId)}
        <tr>
          <td>
            <a href={'/product/' + line.slug}>{line.name}</a>
            {#if line.isDigital}<span class="badge">دیجیتال</span>{/if}
          </td>
          <td>{formatRials(line.unitPriceRials)}</td>
          <td>
            <span class="qty-controls">
              <button onclick={() => setQuantity(line.productId, line.quantity - 1)} disabled={line.quantity <= 1}>−</button>
              <span>{line.quantity}</span>
              <button onclick={() => setQuantity(line.productId, line.quantity + 1)} disabled={line.quantity >= 20}>+</button>
            </span>
          </td>
          <td>{formatRials(line.unitPriceRials * line.quantity)}</td>
          <td>
            <button class="btn danger" onclick={() => removeFromCart(line.productId)}>حذف</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p>جمع کالاها: {formatRials(totals.subtotal)}</p>
  <p>ارسال: {totals.shipping === 0 ? 'رایگان' : formatRials(totals.shipping)}</p>
  <p class="price">مبلغ قابل پرداخت: {formatRials(totals.total)}</p>
  <a class="btn" href="/checkout">ادامه تسویه</a>
{/if}
