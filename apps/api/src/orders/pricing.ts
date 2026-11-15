import { SIZE_SURCHARGE, CupSize } from '../inventory/recipe-calculator';

/** Giá 1 ly = giá món + phụ phí size + tổng giá topping (FR-03, FR-04). Giá do máy chủ tính. */
export function unitPrice(basePrice: number, size: CupSize, toppingPrices: number[]): number {
  return basePrice + SIZE_SURCHARGE[size] + toppingPrices.reduce((s, p) => s + p, 0);
}

export interface PromotionRule {
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrder: number;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
}

/** Lý do mã khuyến mãi không dùng được, hoặc null nếu hợp lệ (FR-13). */
export function promotionError(promo: PromotionRule | null, subtotal: number, now: Date): string | null {
  if (!promo) return 'Mã khuyến mãi không tồn tại';
  if (promo.expiresAt && promo.expiresAt.getTime() < now.getTime()) return 'Mã khuyến mãi đã hết hạn';
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) return 'Mã khuyến mãi đã hết lượt sử dụng';
  if (subtotal < promo.minOrder) {
    return `Đơn tối thiểu ${promo.minOrder.toLocaleString('vi-VN')}đ để dùng mã này`;
  }
  return null;
}

/** Số tiền giảm, không vượt quá tạm tính. PERCENT làm tròn xuống tới đồng. */
export function discountAmount(promo: Pick<PromotionRule, 'type' | 'value'>, subtotal: number): number {
  const raw = promo.type === 'PERCENT' ? Math.floor((subtotal * promo.value) / 100) : promo.value;
  return Math.max(0, Math.min(raw, subtotal));
}

/** Điểm thưởng: 1 điểm cho mỗi 10.000đ của tổng tiền đã thanh toán (FR-14). */
export function loyaltyPoints(total: number): number {
  return Math.floor(total / 10000);
}
