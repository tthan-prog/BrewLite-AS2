import { buildPaymentUrl, phpUrlencode, responseMessage, sign, signData, verify, vnpDate } from './vnpay-signature';

const SECRET = 'unit-test-secret';
const params = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: 'TESTTMN1',
  vnp_Amount: '7380000',
  vnp_TxnRef: 'abc',
  vnp_OrderInfo: 'Thanh toan don hang BrewLite 12',
  vnp_ReturnUrl: 'https://brewlite-as2-web.onrender.com/checkout/vnpay-return',
};

describe('Chữ ký VNPay (FR-21)', () => {
  it('mã hóa như urlencode của PHP: dấu cách thành +, mã hóa cả !\'()*~', () => {
    expect(phpUrlencode("a b!'()*~/:")).toBe('a+b%21%27%28%29%2A%7E%2F%3A');
    expect(phpUrlencode('Đơn')).toBe('%C4%90%C6%A1n');
  });

  it('sắp xếp khóa theo bảng chữ cái, bỏ giá trị rỗng và các trường chữ ký', () => {
    const data = signData({ vnp_TxnRef: '1', vnp_Amount: '100', vnp_BankCode: '', vnp_SecureHash: 'x', vnp_SecureHashType: 'y', other: 'z' });
    expect(data).toBe('vnp_Amount=100&vnp_TxnRef=1');
  });

  it('chữ ký HMAC-SHA512 dạng hex 128 ký tự; URL thanh toán chứa chuỗi đã ký', () => {
    const hash = sign(params, SECRET);
    expect(hash).toMatch(/^[a-f0-9]{128}$/);
    const url = buildPaymentUrl('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', params, SECRET);
    expect(url).toBe(`https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${signData(params)}&vnp_SecureHash=${hash}`);
    expect(url).toContain('vnp_OrderInfo=Thanh+toan+don+hang+BrewLite+12');
    expect(url).toContain('vnp_ReturnUrl=https%3A%2F%2Fbrewlite-as2-web.onrender.com%2Fcheckout%2Fvnpay-return');
  });

  it('verify: đúng chữ ký thì true; sửa bất kỳ trường nào, sai secret hoặc thiếu chữ ký thì false', () => {
    const signed = { ...params, vnp_SecureHash: sign(params, SECRET), vnp_SecureHashType: 'HmacSHA512' };
    expect(verify(signed, SECRET)).toBe(true);
    expect(verify({ ...signed, vnp_SecureHash: signed.vnp_SecureHash.toUpperCase() }, SECRET)).toBe(true);
    expect(verify({ ...signed, vnp_Amount: '100' }, SECRET)).toBe(false);
    expect(verify(signed, 'secret-khac')).toBe(false);
    expect(verify(params, SECRET)).toBe(false);
    expect(verify({ ...params, vnp_SecureHash: 'abc' }, SECRET)).toBe(false);
  });

  it('thời gian theo GMT+7 dạng yyyyMMddHHmmss', () => {
    expect(vnpDate(new Date('2026-11-15T20:05:09Z'))).toBe('20261116030509');
  });

  it('thông báo tiếng Việt cho mã phản hồi', () => {
    expect(responseMessage('24')).toBe('Khách hàng hủy giao dịch');
    expect(responseMessage('99')).toBe('Giao dịch VNPay không thành công (mã 99)');
  });
});
