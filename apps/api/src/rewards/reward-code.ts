import { randomInt } from 'node:crypto';

// Bỏ các ký tự dễ nhầm (0/O, 1/I/L) để nhân viên đọc mã tại quầy
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Mã quà dạng BL-XXXXXXXX, sinh bằng bộ sinh số ngẫu nhiên an toàn (FR-19). */
export function rewardCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `BL-${code}`;
}
