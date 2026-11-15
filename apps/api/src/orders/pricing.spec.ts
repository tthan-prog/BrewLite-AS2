import { discountAmount, loyaltyPoints, PromotionRule, promotionError, unitPrice } from './pricing';

const promo = (over: Partial<PromotionRule> = {}): PromotionRule => ({
  type: 'PERCENT',
  value: 10,
  minOrder: 50000,
  expiresAt: new Date('2027-12-31'),
  usageLimit: 100,
  usedCount: 0,
  ...over,
});
const now = new Date('2026-11-15T12:00:00Z');

describe('unitPrice (FR-03, FR-04)', () => {
  it('cộng phụ phí size và giá topping', () => {
    expect(unitPrice(29000, 'S', [])).toBe(29000);
    expect(unitPrice(29000, 'M', [7000])).toBe(41000);
    expect(unitPrice(29000, 'L', [7000, 6000])).toBe(52000);
  });
});

describe('promotionError (FR-13)', () => {
  it('mã hợp lệ trả null', () => {
    expect(promotionError(promo(), 60000, now)).toBeNull();
  });
  it('mã không tồn tại, hết hạn, hết lượt, chưa đủ đơn tối thiểu', () => {
    expect(promotionError(null, 60000, now)).toBe('Mã khuyến mãi không tồn tại');
    expect(promotionError(promo({ expiresAt: new Date('2025-01-01') }), 60000, now)).toBe('Mã khuyến mãi đã hết hạn');
    expect(promotionError(promo({ usageLimit: 5, usedCount: 5 }), 60000, now)).toBe('Mã khuyến mãi đã hết lượt sử dụng');
    expect(promotionError(promo(), 49999, now)).toMatch(/Đơn tối thiểu 50.000đ/);
  });
  it('không giới hạn lượt và không hạn dùng vẫn hợp lệ', () => {
    expect(promotionError(promo({ usageLimit: null, expiresAt: null, minOrder: 0 }), 1000, now)).toBeNull();
  });
});

describe('discountAmount (FR-13)', () => {
  it('PERCENT làm tròn xuống, FIXED không vượt tạm tính', () => {
    expect(discountAmount({ type: 'PERCENT', value: 10 }, 87500)).toBe(8750);
    expect(discountAmount({ type: 'PERCENT', value: 15 }, 33333)).toBe(4999);
    expect(discountAmount({ type: 'FIXED', value: 20000 }, 150000)).toBe(20000);
    expect(discountAmount({ type: 'FIXED', value: 20000 }, 15000)).toBe(15000);
  });
});

describe('loyaltyPoints (FR-14)', () => {
  it('1 điểm cho mỗi 10.000đ', () => {
    expect(loyaltyPoints(9999)).toBe(0);
    expect(loyaltyPoints(10000)).toBe(1);
    expect(loyaltyPoints(87500)).toBe(8);
  });
});
