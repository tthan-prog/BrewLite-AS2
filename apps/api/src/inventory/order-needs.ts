import { CupOptions, ingredientNeed, RecipeLine } from './recipe-calculator';

/** Một dòng đơn dùng để tính nguyên liệu (FR-07, FR-16). */
export interface NeedLine {
  productId: number;
  quantity: number;
  options: CupOptions;
  recipe: RecipeLine[];
  /** Công thức của từng topping đã chọn; topping không nhân theo size, đường, đá. */
  toppingRecipes: Array<Array<{ quantity: number; ingredient: { id: number } }>>;
}

/** Tổng lượng từng nguyên liệu cần cho cả đơn: Map<ingredientId, lượng>. */
export function orderNeeds(lines: NeedLine[]): Map<number, number> {
  const needs = new Map<number, number>();
  const add = (id: number, amount: number) => needs.set(id, (needs.get(id) ?? 0) + amount);
  for (const line of lines) {
    for (const r of line.recipe) add(r.ingredient.id, ingredientNeed(r, line.options) * line.quantity);
    for (const recipe of line.toppingRecipes) {
      for (const r of recipe) add(r.ingredient.id, r.quantity * line.quantity);
    }
  }
  for (const [id, amount] of needs) if (amount <= 0) needs.delete(id);
  return needs;
}

/** Nguyên liệu không đủ: id → lượng còn thiếu. Rỗng nghĩa là đủ cho cả đơn. */
export function shortages(needs: Map<number, number>, stock: Map<number, number>): Map<number, number> {
  const missing = new Map<number, number>();
  for (const [id, amount] of needs) {
    const have = stock.get(id) ?? 0;
    if (have < amount) missing.set(id, amount - have);
  }
  return missing;
}

/** Các sản phẩm trong đơn dùng tới nguyên liệu bị thiếu (để báo "món thiếu"). */
export function productsAffected(lines: NeedLine[], missing: Map<number, number>): number[] {
  const ids = new Set<number>();
  for (const line of lines) {
    const used = [...line.recipe, ...line.toppingRecipes.flat()].some((r) => missing.has(r.ingredient.id));
    if (used) ids.add(line.productId);
  }
  return [...ids];
}
