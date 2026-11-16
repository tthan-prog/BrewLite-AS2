/** Cờ tồn kho cho nhân viên (FR-17): hết, sắp hết (≤ ngưỡng), còn đủ. */
export type StockFlag = 'OUT' | 'LOW' | 'OK';

export function stockFlag(stock: number, lowThreshold: number): StockFlag {
  if (stock <= 0) return 'OUT';
  if (stock <= lowThreshold) return 'LOW';
  return 'OK';
}
