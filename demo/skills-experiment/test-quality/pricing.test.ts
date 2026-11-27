import { describe, it, expect } from 'vitest';
import { applyCoupon, shippingCost } from './pricing';

describe('pricing', () => {
  it('charges standard shipping', () => {
    expect(shippingCost({ subtotal: 40, items: 2 })).toBe(7.5);
  });

  it('applies the SAVE10 coupon', () => {
    expect(applyCoupon(50, 'SAVE10')).toBe(40);
  });
});
