import { rewardCode } from './reward-code';

describe('rewardCode (FR-19)', () => {
  it('dạng BL- và 8 ký tự không dễ nhầm', () => {
    for (let i = 0; i < 200; i++) expect(rewardCode()).toMatch(/^BL-[A-HJKMNP-Z2-9]{8}$/);
  });
  it('không lặp trong 1.000 lần sinh', () => {
    expect(new Set(Array.from({ length: 1000 }, () => rewardCode())).size).toBe(1000);
  });
});
