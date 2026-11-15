/**
 * Cổng thanh toán mô phỏng cho Ví và Thẻ (FR-08). Không có tiền thật.
 * Quy ước để demo và test:
 *  - CARD: số thẻ 12–19 chữ số, phải qua kiểm tra Luhn. Thẻ DECLINED_CARD luôn bị từ chối.
 *  - WALLET: ví mô phỏng có hạn mức WALLET_LIMIT mỗi giao dịch.
 */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type GatewayMethod = 'WALLET' | 'CARD';

export interface ChargeRequest {
  orderId: number;
  method: GatewayMethod;
  amount: number;
  cardNumber?: string;
}

export interface ChargeResult {
  success: boolean;
  reason?: string;
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

export const DECLINED_CARD = '4000000000000002';
export const SUCCESS_CARD = '4242424242424242';
export const WALLET_LIMIT = 2_000_000;

export function luhnValid(number: string): boolean {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let digit = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export class MockPaymentGateway implements PaymentGateway {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.amount <= 0) return { success: false, reason: 'Số tiền không hợp lệ' };
    if (request.method === 'WALLET') {
      return request.amount > WALLET_LIMIT
        ? { success: false, reason: 'Số dư ví không đủ' }
        : { success: true };
    }
    const card = request.cardNumber ?? '';
    if (!luhnValid(card)) return { success: false, reason: 'Số thẻ không hợp lệ' };
    if (card === DECLINED_CARD) return { success: false, reason: 'Thẻ bị ngân hàng từ chối' };
    return { success: true };
  }
}
