import { ingredientNeed, maxCups, MAX_QUANTITY_PER_LINE, RecipeLine } from './recipe-calculator';

const line = (quantity: number, stock: number, sugarScaled = false, iceScaled = false): RecipeLine => ({
  quantity,
  ingredient: { id: 1, stock, sugarScaled, iceScaled },
});

describe('recipe-calculator', () => {
  it('nhân hệ số size và làm tròn lên', () => {
    expect(ingredientNeed(line(18, 1000), { size: 'S', sugar: 100, ice: 100 })).toBe(18);
    expect(ingredientNeed(line(18, 1000), { size: 'M', sugar: 100, ice: 100 })).toBe(23); // 22.5 -> 23
    expect(ingredientNeed(line(18, 1000), { size: 'L', sugar: 100, ice: 100 })).toBe(27);
  });

  it('nhân theo mức đường và đá cho nguyên liệu được đánh dấu', () => {
    expect(ingredientNeed(line(10, 1000, true), { size: 'S', sugar: 50, ice: 100 })).toBe(5);
    expect(ingredientNeed(line(120, 1000, false, true), { size: 'S', sugar: 100, ice: 0 })).toBe(0);
    expect(ingredientNeed(line(120, 1000, false, true), { size: 'M', sugar: 100, ice: 30 })).toBe(45);
  });

  it('số ly còn pha được lấy theo nguyên liệu ít nhất', () => {
    expect(maxCups([line(18, 90), line(30, 6000)])).toBe(5);
  });

  it('giới hạn ở số ly tối đa một dòng để không lộ tồn kho', () => {
    expect(maxCups([line(1, 100000)])).toBe(MAX_QUANTITY_PER_LINE);
  });

  it('trả 0 khi thiếu nguyên liệu hoặc món không có công thức', () => {
    expect(maxCups([line(18, 10)])).toBe(0);
    expect(maxCups([])).toBe(0);
  });

  it('bỏ qua nguyên liệu có nhu cầu bằng 0 (ví dụ không đá)', () => {
    expect(maxCups([line(120, 0, false, true), line(10, 100)], { size: 'S', sugar: 100, ice: 0 })).toBe(10);
  });
});
