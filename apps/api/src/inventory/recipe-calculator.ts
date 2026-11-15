/**
 * Tính nhu cầu nguyên liệu theo công thức (FR-16, ADR 005).
 * Công thức lưu cho 1 ly size S; size M, L nhân hệ số; nguyên liệu đánh dấu
 * sugarScaled / iceScaled nhân theo mức đường / đá khách chọn. Luôn làm tròn lên.
 */

export type CupSize = 'S' | 'M' | 'L';

export const SIZE_MULTIPLIER: Record<CupSize, number> = { S: 1, M: 1.25, L: 1.5 };
export const SIZE_SURCHARGE: Record<CupSize, number> = { S: 0, M: 5000, L: 10000 };
export const SUGAR_ICE_LEVELS = [0, 30, 50, 70, 100] as const;
/** Số ly tối đa trên một dòng giỏ hàng (FR-04). */
export const MAX_QUANTITY_PER_LINE = 50;

export interface RecipeLine {
  quantity: number;
  ingredient: {
    id: number;
    stock: number;
    sugarScaled: boolean;
    iceScaled: boolean;
  };
}

export interface CupOptions {
  size: CupSize;
  sugar: number;
  ice: number;
}

export const DEFAULT_CUP: CupOptions = { size: 'S', sugar: 100, ice: 100 };

/** Lượng một nguyên liệu cần cho 1 ly với tùy chọn đã chọn. */
export function ingredientNeed(line: RecipeLine, options: CupOptions): number {
  let amount = line.quantity * SIZE_MULTIPLIER[options.size];
  if (line.ingredient.sugarScaled) amount = (amount * options.sugar) / 100;
  if (line.ingredient.iceScaled) amount = (amount * options.ice) / 100;
  return Math.ceil(amount);
}

/**
 * Số ly còn pha được với tồn kho hiện tại, giới hạn ở MAX_QUANTITY_PER_LINE
 * để không lộ số tồn kho thật. Món không có công thức thì không bán được (0).
 */
export function maxCups(recipe: RecipeLine[], options: CupOptions = DEFAULT_CUP): number {
  if (recipe.length === 0) return 0;
  let cups = MAX_QUANTITY_PER_LINE;
  for (const line of recipe) {
    const need = ingredientNeed(line, options);
    if (need <= 0) continue;
    cups = Math.min(cups, Math.floor(line.ingredient.stock / need));
  }
  return Math.max(0, cups);
}
