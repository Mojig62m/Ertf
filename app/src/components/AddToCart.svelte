<script lang="ts">
  import { addToCart } from '../lib/cart';

  let {
    productId,
    name,
    slug,
    unitPriceRials,
    isDigital,
  }: { productId: number; name: string; slug: string; unitPriceRials: number; isDigital: boolean } = $props();

  let qty = $state(1);
  let done = $state(false);

  function add() {
    addToCart({ productId, name, slug, unitPriceRials, isDigital }, qty);
    done = true;
    setTimeout(() => {
      done = false;
    }, 1500);
  }
</script>

<div class="add-to-cart">
  <label>
    تعداد
    <input type="number" min="1" max="20" bind:value={qty} />
  </label>
  <button class="btn" onclick={add} disabled={qty < 1 || qty > 20}>
    {done ? 'به سبد اضافه شد' : 'افزودن به سبد'}
  </button>
</div>
