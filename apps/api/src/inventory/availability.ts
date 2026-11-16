import { CupOptions, CupSize, MAX_QUANTITY_PER_LINE, RecipeLine } from './recipe-calculator';
import { NeedLine, orderNeeds } from './order-needs';

/**
 * Tính số ly làm được theo size, topping và cả giỏ hàng (FR-04, FR-16).
 * Dùng cho:
 *  - khách: POST /products/availability (giới hạn ở MAX_QUANTITY_PER_LINE để không lộ tồn kho);
 *  - nhân viên: GET /ingredients/recipes (số ly thật theo tồn kho hiện tại).
 */

export type Stock = Map<number, number>;

/** Lượng từng nguyên liệu cho đúng 1 ly của dòng (đã gồm topping). */
export function perCupNeeds(line: Omit<NeedLine, 'quantity'>): Map<number, number> {
  return orderNeeds([{ ...line, quantity: 1 }]);
}

/** Số ly làm được với một lượng tồn kho, không giới hạn trên. Không cần nguyên liệu nào thì trả Infinity. */
export function cupsFromStock(perCup: Map<number, number>, stock: Stock): number {
  let cups = Infinity;
  for (const [id, need] of perCup) {
    if (need <= 0) continue;
    cups = Math.min(cups, Math.floor(Math.max(0, stock.get(id) ?? 0) / need));
  }
  return cups;
}

/** Nguyên liệu làm số ly ít nhất (nguyên liệu "giới hạn"); null nếu không dùng nguyên liệu nào. */
export function limitingIngredient(perCup: Map<number, number>, stock: Stock): number | null {
  let best: { id: number; cups: number } | null = null;
  for (const [id, need] of perCup) {
    if (need <= 0) continue;
    const cups = Math.floor(Math.max(0, stock.get(id) ?? 0) / need);
    if (!best || cups < best.cups) best = { id, cups };
  }
  return best?.id ?? null;
}

/** Trừ đi nhu cầu của các dòng khác trong giỏ để biết phần còn lại cho dòng đang xét. */
function remainingStock(stock: Stock, used: Map<number, number>): Stock {
  const left = new Map(stock);
  for (const [id, amount] of used) left.set(id, (left.get(id) ?? 0) - amount);
  return left;
}

export interface LineAvailability {
  /** Số ly tối đa của dòng này khi giữ nguyên số lượng các dòng khác (0–MAX_QUANTITY_PER_LINE). */
  maxQuantity: number;
  /** Số lượng đang yêu cầu có làm được không. */
  ok: boolean;
}

/**
 * Với từng dòng của giỏ: số ly tối đa còn đặt được nếu các dòng khác giữ nguyên số lượng.
 * Hai dòng dùng chung nguyên liệu thì tranh nhau phần tồn kho (AS1: "hai dòng cùng món tranh nhau nguyên liệu").
 * Món không có công thức thì 0 ly (chưa bán).
 */
export function cartAvailability(lines: NeedLine[], stock: Stock): LineAvailability[] {
  return lines.map((line, index) => {
    if (line.recipe.length === 0) return { maxQuantity: 0, ok: false };
    const others = orderNeeds(lines.filter((_, i) => i !== index));
    const cups = cupsFromStock(perCupNeeds(line), remainingStock(stock, others));
    const maxQuantity = Math.max(0, Math.min(MAX_QUANTITY_PER_LINE, cups));
    return { maxQuantity, ok: line.quantity <= maxQuantity };
  });
}

/** Số ly từng size (đường, đá 100%) với tồn kho hiện tại, không giới hạn trên: dùng cho bảng công thức của nhân viên. */
export function cupsBySize(recipe: RecipeLine[], stock: Stock): Record<CupSize, number> {
  const result = {} as Record<CupSize, number>;
  for (const size of ['S', 'M', 'L'] as CupSize[]) {
    const options: CupOptions = { size, sugar: 100, ice: 100 };
    const cups = recipe.length === 0 ? 0 : cupsFromStock(perCupNeeds({ productId: 0, options, recipe, toppingRecipes: [] }), stock);
    result[size] = Number.isFinite(cups) ? cups : 0;
  }
  return result;
}
