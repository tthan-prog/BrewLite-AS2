import { NeedLine, orderNeeds, productsAffected, shortages } from './order-needs';

const ing = (id: number, opts: { sugar?: boolean; ice?: boolean } = {}) => ({
  id,
  stock: 0,
  sugarScaled: opts.sugar ?? false,
  iceScaled: opts.ice ?? false,
});

// Cà phê sữa đá: cà phê 18, siro 10 (theo đường), đá 120 (theo đá)
const caPhe: NeedLine = {
  productId: 1,
  quantity: 2,
  options: { size: 'M', sugar: 50, ice: 0 },
  recipe: [
    { quantity: 18, ingredient: ing(1) },
    { quantity: 10, ingredient: ing(6, { sugar: true }) },
    { quantity: 120, ingredient: ing(7, { ice: true }) },
  ],
  toppingRecipes: [[{ quantity: 40, ingredient: { id: 8 } }]],
};

describe('orderNeeds (FR-16)', () => {
  it('nhân hệ số size, mức đường, đá, số lượng; topping không nhân theo size', () => {
    const needs = orderNeeds([caPhe]);
    // cà phê: ceil(18 * 1.25) = 23 × 2 ly
    expect(needs.get(1)).toBe(46);
    // siro: ceil(10 * 1.25 * 50%) = 7 × 2
    expect(needs.get(6)).toBe(14);
    // đá 0% → không cần
    expect(needs.has(7)).toBe(false);
    // trân châu: 40 × 2
    expect(needs.get(8)).toBe(80);
  });

  it('cộng dồn nguyên liệu dùng chung giữa nhiều dòng', () => {
    const other: NeedLine = { ...caPhe, productId: 2, quantity: 1, options: { size: 'S', sugar: 100, ice: 100 }, toppingRecipes: [] };
    expect(orderNeeds([caPhe, other]).get(1)).toBe(46 + 18);
  });
});

describe('shortages và productsAffected (FR-07)', () => {
  it('báo nguyên liệu thiếu và món dùng nguyên liệu đó', () => {
    const needs = orderNeeds([caPhe]);
    const missing = shortages(needs, new Map([[1, 100], [6, 100], [8, 50]]));
    expect([...missing]).toEqual([[8, 30]]);
    expect(productsAffected([caPhe], missing)).toEqual([1]);
  });

  it('đủ nguyên liệu thì không thiếu gì', () => {
    const needs = orderNeeds([caPhe]);
    expect(shortages(needs, new Map([[1, 46], [6, 14], [8, 80]])).size).toBe(0);
  });
});
