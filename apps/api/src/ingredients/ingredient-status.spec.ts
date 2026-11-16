import { stockFlag } from './ingredient-status';

describe('stockFlag (FR-17)', () => {
  it('hết khi tồn kho bằng 0, sắp hết khi không vượt ngưỡng, còn lại là đủ', () => {
    expect(stockFlag(0, 500)).toBe('OUT');
    expect(stockFlag(500, 500)).toBe('LOW');
    expect(stockFlag(1, 500)).toBe('LOW');
    expect(stockFlag(501, 500)).toBe('OK');
    expect(stockFlag(10, 0)).toBe('OK');
  });
});
