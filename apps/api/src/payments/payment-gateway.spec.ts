import { DECLINED_CARD, luhnValid, MockPaymentGateway, SUCCESS_CARD, WALLET_LIMIT } from './payment-gateway';

describe('cổng thanh toán mô phỏng (FR-08)', () => {
  const gateway = new MockPaymentGateway();

  it('kiểm tra Luhn', () => {
    expect(luhnValid(SUCCESS_CARD)).toBe(true);
    expect(luhnValid(DECLINED_CARD)).toBe(true);
    expect(luhnValid('4242424242424241')).toBe(false);
    expect(luhnValid('abc')).toBe(false);
  });

  it('Ví: thành công trong hạn mức, thất bại khi vượt', async () => {
    expect(await gateway.charge({ orderId: 1, method: 'WALLET', amount: 50000 })).toEqual({ success: true });
    expect(await gateway.charge({ orderId: 1, method: 'WALLET', amount: WALLET_LIMIT + 1 })).toEqual({
      success: false,
      reason: 'Số dư ví không đủ',
    });
  });

  it('Thẻ: thẻ hợp lệ thành công, thẻ bị từ chối và số thẻ sai thất bại', async () => {
    expect((await gateway.charge({ orderId: 1, method: 'CARD', amount: 50000, cardNumber: SUCCESS_CARD })).success).toBe(true);
    expect(await gateway.charge({ orderId: 1, method: 'CARD', amount: 50000, cardNumber: DECLINED_CARD })).toEqual({
      success: false,
      reason: 'Thẻ bị ngân hàng từ chối',
    });
    expect((await gateway.charge({ orderId: 1, method: 'CARD', amount: 50000, cardNumber: '1234' })).reason).toBe(
      'Số thẻ không hợp lệ',
    );
  });
});
