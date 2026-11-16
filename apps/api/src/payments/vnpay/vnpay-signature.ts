import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Ký và kiểm tra chữ ký VNPay phiên bản 2.1.0 (FR-21, ADR 004).
 * Giống code mẫu PHP của VNPay: sắp xếp khóa theo bảng chữ cái, ghép
 * urlencode(key)=urlencode(value) bằng "&", rồi HMAC-SHA512 với vnp_HashSecret.
 */

export type VnpParams = Record<string, string>;

/** Mã hóa giống hàm urlencode của PHP (dấu cách thành "+", mã hóa cả !'()*~). */
export function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/** Chuỗi dữ liệu để ký: chỉ các tham số vnp_* có giá trị, trừ vnp_SecureHash và vnp_SecureHashType. */
export function signData(params: VnpParams): string {
  return Object.keys(params)
    .filter((k) => k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${phpUrlencode(k)}=${phpUrlencode(String(params[k]))}`)
    .join('&');
}

export function sign(params: VnpParams, secret: string): string {
  return createHmac('sha512', secret).update(Buffer.from(signData(params), 'utf-8')).digest('hex');
}

/** URL chuyển khách sang cổng VNPay: chuỗi query chính là chuỗi đã ký, thêm vnp_SecureHash ở cuối. */
export function buildPaymentUrl(baseUrl: string, params: VnpParams, secret: string): string {
  return `${baseUrl}?${signData(params)}&vnp_SecureHash=${sign(params, secret)}`;
}

/** Kiểm tra chữ ký của dữ liệu VNPay gửi về (Return URL, IPN), so sánh an toàn về thời gian. */
export function verify(query: Record<string, unknown>, secret: string): boolean {
  const received = typeof query.vnp_SecureHash === 'string' ? query.vnp_SecureHash.toLowerCase() : '';
  if (!/^[a-f0-9]{128}$/.test(received)) return false;
  const params: VnpParams = {};
  for (const [k, v] of Object.entries(query)) if (typeof v === 'string') params[k] = v;
  const expected = sign(params, secret);
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

/** Thời gian theo múi giờ GMT+7 dạng yyyyMMddHHmmss mà VNPay yêu cầu. */
export function vnpDate(date: Date): string {
  const t = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`;
}

/** Thông báo tiếng Việt cho một số mã phản hồi thường gặp (vnp_ResponseCode). */
export function responseMessage(code: string): string {
  const messages: Record<string, string> = {
    '00': 'Giao dịch thành công',
    '07': 'Giao dịch bị nghi ngờ gian lận',
    '09': 'Thẻ hoặc tài khoản chưa đăng ký Internet Banking',
    '10': 'Xác thực thông tin thẻ hoặc tài khoản sai quá 3 lần',
    '11': 'Hết thời gian chờ thanh toán',
    '12': 'Thẻ hoặc tài khoản bị khóa',
    '13': 'Sai mật khẩu xác thực giao dịch (OTP)',
    '24': 'Khách hàng hủy giao dịch',
    '51': 'Tài khoản không đủ số dư',
    '65': 'Tài khoản vượt quá hạn mức giao dịch trong ngày',
    '75': 'Ngân hàng thanh toán đang bảo trì',
    '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
  };
  return messages[code] ?? `Giao dịch VNPay không thành công (mã ${code})`;
}
