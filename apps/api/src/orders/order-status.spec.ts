import { OrderStatus } from '@prisma/client';
import { canTransition, ORDER_TRANSITIONS } from './order-status';

const ALL = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];

describe('máy trạng thái đơn (FR-10)', () => {
  it.each([
    ['PENDING', 'PAID'],
    ['PENDING', 'PAYMENT_FAILED'],
    ['PENDING', 'CANCELLED'],
    ['PAYMENT_FAILED', 'PAID'],
    ['PAYMENT_FAILED', 'CANCELLED'],
    ['PAID', 'PREPARING'],
    ['PAID', 'CANCELLED'],
    ['PREPARING', 'READY'],
    ['READY', 'COMPLETED'],
  ] as Array<[OrderStatus, OrderStatus]>)('cho phép %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('đúng 9 chuyển trạng thái hợp lệ, còn lại đều bị chặn', () => {
    let allowed = 0;
    for (const from of ALL) for (const to of ALL) if (canTransition(from, to)) allowed++;
    expect(allowed).toBe(9);
  });

  it.each([
    ['PENDING', 'PREPARING'],
    ['PREPARING', 'CANCELLED'],
    ['READY', 'PREPARING'],
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'PAID'],
  ] as Array<[OrderStatus, OrderStatus]>)('chặn %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
