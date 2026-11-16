import { cartAvailability, cupsBySize, cupsFromStock, limitingIngredient, perCupNeeds } from './availability';
import { NeedLine } from './order-needs';
import { CupSize } from './recipe-calculator';

// Nguyên liệu: 1 cà phê (g), 2 sữa (ml), 3 đường (g, theo mức đường), 4 đá (g, theo mức đá), 5 trân châu (g)
const ing = (id: number, stock: number, sugarScaled = false, iceScaled = false) => ({ id, stock, sugarScaled, iceScaled });
const coffee = ing(1, 100);
const milk = ing(2, 1000);
const sugar = ing(3, 1000, true);
const ice = ing(4, 10_000, false, true);
const recipe = [
  { quantity: 20, ingredient: coffee },
  { quantity: 30, ingredient: milk },
  { quantity: 10, ingredient: sugar },
  { quantity: 100, ingredient: ice },
];
const pearl = [{ quantity: 40, ingredient: { id: 5 } }];
const stock = new Map([[1, 100], [2, 1000], [3, 1000], [4, 10_000], [5, 100]]);

const line = (quantity: number, size: CupSize = 'S', toppingRecipes: NeedLine['toppingRecipes'] = [], sugarLevel = 100): NeedLine => ({
  productId: 1,
  quantity,
  options: { size, sugar: sugarLevel, ice: 100 },
  recipe,
  toppingRecipes,
});

describe('Số ly làm được theo size, topping và giỏ hàng', () => {
  it('size lớn dùng nhiều nguyên liệu hơn: cà phê 100g, mỗi ly S=20, M=25, L=30 → 5, 4, 3 ly', () => {
    expect(cupsBySize(recipe, stock)).toEqual({ S: 5, M: 4, L: 3 });
  });

  it('size L không đủ dù size S còn đủ', () => {
    const [s] = cartAvailability([line(4, 'S')], stock);
    const [l] = cartAvailability([line(4, 'L')], stock);
    expect(s).toEqual({ maxQuantity: 5, ok: true });
    expect(l).toEqual({ maxQuantity: 3, ok: false });
  });

  it('topping trừ nguyên liệu riêng, nhân số ly; hết nguyên liệu topping thì giới hạn theo topping', () => {
    expect(perCupNeeds(line(1, 'S', [pearl])).get(5)).toBe(40);
    // trân châu 100g, mỗi ly 40g → 2 ly dù cà phê đủ 5 ly
    expect(cartAvailability([line(1, 'S', [pearl])], stock)[0].maxQuantity).toBe(2);
    expect(limitingIngredient(perCupNeeds(line(1, 'S', [pearl])), stock)).toBe(5);
    const noPearl = new Map(stock).set(5, 0);
    expect(cartAvailability([line(1, 'S', [pearl])], noPearl)[0]).toEqual({ maxQuantity: 0, ok: false });
  });

  it('hai dòng cùng món tranh nhau nguyên liệu: kho đủ 5 ly S, dòng 1 đặt 3 thì dòng 2 còn tối đa 2', () => {
    const result = cartAvailability([line(3), line(3, 'S', [], 50)], stock);
    expect(result[0]).toEqual({ maxQuantity: 2, ok: false });
    expect(result[1]).toEqual({ maxQuantity: 2, ok: false });
    expect(cartAvailability([line(3), line(2)], stock).every((r) => r.ok)).toBe(true);
  });

  it('giới hạn 50 ly mỗi dòng dù nguyên liệu còn nhiều', () => {
    const plenty = new Map([[1, 1_000_000], [2, 1_000_000], [3, 1_000_000], [4, 1_000_000]]);
    expect(cartAvailability([line(50)], plenty)[0]).toEqual({ maxQuantity: 50, ok: true });
    expect(cupsBySize(recipe, plenty).S).toBe(10_000); // đá 100g mỗi ly là giới hạn, không cắt ở 50
  });

  it('mức đường 0% không cần đường; món không có công thức thì 0 ly', () => {
    const noSugar = new Map(stock).set(3, 0);
    expect(cartAvailability([line(1, 'S', [], 0)], noSugar)[0].maxQuantity).toBe(5);
    expect(cartAvailability([line(1)], noSugar)[0].maxQuantity).toBe(0);
    expect(cartAvailability([{ ...line(1), recipe: [] }], stock)[0]).toEqual({ maxQuantity: 0, ok: false });
    expect(cupsBySize([], stock)).toEqual({ S: 0, M: 0, L: 0 });
  });

  it('tồn kho âm hoặc thiếu trong bảng coi như 0', () => {
    expect(cupsFromStock(new Map([[1, 20]]), new Map([[1, -5]]))).toBe(0);
    expect(cupsFromStock(new Map([[9, 1]]), new Map())).toBe(0);
    expect(cupsFromStock(new Map(), stock)).toBe(Infinity);
  });
});
