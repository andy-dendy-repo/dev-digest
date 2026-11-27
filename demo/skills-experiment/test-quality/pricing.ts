export interface Cart {
  subtotal: number;
  items: number;
  coupon?: string;
}

/** Shipping fee for a cart. Free for empty carts, big orders and the FREESHIP coupon. */
export function shippingCost(cart: Cart): number {
  if (cart.items === 0) return 0;
  if (cart.subtotal >= 100) return 0;
  if (cart.coupon === 'FREESHIP') return 0;
  return cart.items > 5 ? 12.5 : 7.5;
}

/** Subtotal after a coupon: SAVE10 takes $10 off, PCT<n> takes n% off (1–50). */
export function applyCoupon(subtotal: number, coupon?: string): number {
  if (!coupon) return subtotal;
  if (coupon === 'SAVE10') return Math.max(0, subtotal - 10);
  if (coupon.startsWith('PCT')) {
    const pct = Number(coupon.slice(3));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 50) throw new Error('invalid coupon');
    return subtotal * (1 - pct / 100);
  }
  throw new Error('unknown coupon');
}
