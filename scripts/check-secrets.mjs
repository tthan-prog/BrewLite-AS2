#!/usr/bin/env node
// SEC-T01 – kiểm chứng NFR-03: secret không nằm trong repository.
// Quét mọi tệp Git đang theo dõi (git ls-files), không cần thư viện ngoài.
// Trượt (exit 1) khi:
//   1. có tệp .env thật được commit (chỉ cho phép .env.example);
//   2. nội dung khớp mẫu secret thật: khóa riêng, token GitHub, khóa AWS, URL deploy hook Render,
//      chuỗi kết nối PostgreSQL có mật khẩu trỏ tới máy chủ ngoài máy local/CI,
//      VNPAY_HASH_SECRET hoặc JWT_SECRET gán giá trị không phải giá trị mẫu.
// Chạy: node scripts/check-secrets.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

const BINARY = /\.(png|jpe?g|gif|ico|webp|pdf|woff2?|ttf|otf|zip|gz|lock)$/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'db', 'postgres', 'host', 'HOST']);
// Giá trị mẫu hoặc chỉ dùng cho CI, test, máy local (vd 'doi-gia-tri-nay', 'unit-test-secret'):
// không phải secret thật. Secret thật là chuỗi ngẫu nhiên, không chứa các từ này.
const PLACEHOLDER = /^$|^[<$*x]|test|\bci\b|^ci-|local|dev|example|demo|placeholder|change[-_]?me|your[-_]|doi-gia-tri|thay-bang/i;

const RULES = [
  { name: 'Khóa riêng (private key)', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'Token GitHub', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: 'Khóa truy cập AWS', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'URL deploy hook Render', re: /api\.render\.com\/deploy\/srv-[a-z0-9]+\?key=[A-Za-z0-9_-]+/ },
];

const findings = [];

for (const file of files) {
  const base = file.split('/').at(-1);
  if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') {
    findings.push({ file, line: 0, rule: 'Tệp .env bị commit', text: base });
    continue;
  }
  if (BINARY.test(file)) continue;
  let text;
  try {
    if (statSync(file).size > 2_000_000) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // tệp đã xóa khỏi thư mục làm việc
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) findings.push({ file, line: i + 1, rule: rule.name, text: line.trim() });
    }
    for (const m of line.matchAll(/postgres(?:ql)?:\/\/([^:@\s/]+):([^@\s]+)@([^:/\s?]+)/g)) {
      const [, , password, host] = m;
      if (!LOCAL_HOSTS.has(host) && !PLACEHOLDER.test(password)) {
        findings.push({ file, line: i + 1, rule: 'Chuỗi kết nối database có mật khẩu', text: m[0] });
      }
    }
    const assign = line.match(/\b(VNPAY_HASH_SECRET|JWT_SECRET)\s*[:=]\s*["']?([^"'\s#]*)/);
    if (assign && !PLACEHOLDER.test(assign[2]) && !assign[2].startsWith('$')) {
      findings.push({ file, line: i + 1, rule: `${assign[1]} có giá trị thật`, text: `${assign[1]}=***` });
    }
  });
}

const mask = (s) => s.replace(/(:\/\/[^:]+:)[^@]+@/, '$1***@').replace(/(key=)[A-Za-z0-9_-]+/, '$1***').slice(0, 120);
console.log(`SEC-T01 (NFR-03) – quét ${files.length} tệp Git đang theo dõi`);
if (findings.length === 0) {
  console.log('  Kết quả: ĐẠT – không thấy secret hay tệp .env trong repository');
} else {
  for (const f of findings) console.log(`  ${f.file}${f.line ? ':' + f.line : ''}  ${f.rule}  ${mask(f.text)}`);
  console.log(`  Kết quả: KHÔNG ĐẠT – ${findings.length} vị trí cần kiểm tra`);
  process.exitCode = 1;
}
