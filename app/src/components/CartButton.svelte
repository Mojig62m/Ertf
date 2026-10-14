<script lang="ts">
  import { readCart } from '../lib/cart';

  function totalQuantity(): number {
    return readCart().reduce((acc, l) => acc + l.quantity, 0);
  }

  let count = $state(totalQuantity());

  function refresh() {
    count = totalQuantity();
  }

  $effect(() => {
    window.addEventListener('ertf-cart-changed', refresh);
    return () => {
      window.removeEventListener('ertf-cart-changed', refresh);
    };
  });
</script>

<a class="cart-link" href="/cart">سبد خرید ({count})</a>
