#!/usr/bin/env node
// PERF-T01 – kiểm chứng NFR-01: GET /products phản hồi nhanh với dữ liệu seed.
// Tiêu chí (SRS): 95% trong 20 yêu cầu liên tiếp dưới 500 ms khi chạy cục bộ.
// Không cần thư viện ngoài (Node.js >= 18 có sẵn fetch).
//
// Cách dùng:
//   node tests/perf/products-latency.mjs                       # http://localhost:3001
//   node tests/perf/products-latency.mjs --url https://brewlite-as2-api-k8xj.onrender.com --report-only
// Tùy chọn: --url, --path (/products), --requests (20), --warmup (1), --percentile (95),
//           --threshold-ms (500), --report-only (chỉ in kết quả, không đánh trượt), --json <file>

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const opts = {
    url: process.env.PERF_BASE_URL || 'http://localhost:3001',
    path: '/products',
    requests: 20,
    warmup: 1,
    percentile: 95,
    thresholdMs: 500,
    reportOnly: false,
    json: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Thiếu giá trị cho ${a}`);
      return v;
    };
    if (a === '--url') opts.url = next();
    else if (a === '--path') opts.path = next();
    else if (a === '--requests') opts.requests = Number(next());
    else if (a === '--warmup') opts.warmup = Number(next());
    else if (a === '--percentile') opts.percentile = Number(next());
    else if (a === '--threshold-ms') opts.thresholdMs = Number(next());
    else if (a === '--report-only') opts.reportOnly = true;
    else if (a === '--json') opts.json = next();
    else throw new Error(`Tùy chọn không hợp lệ: ${a}`);
  }
  for (const k of ['requests', 'warmup', 'percentile', 'thresholdMs']) {
    if (!Number.isFinite(opts[k]) || opts[k] < 0) throw new Error(`Giá trị ${k} không hợp lệ`);
  }
  if (opts.requests < 1 || opts.percentile <= 0 || opts.percentile > 100) {
    throw new Error('requests phải >= 1 và percentile trong (0, 100]');
  }
  return opts;
}

// Phân vị theo phương pháp nearest-rank: giá trị nhỏ nhất mà ít nhất p% mẫu không vượt quá.
export function percentile(sortedMs, p) {
  const rank = Math.ceil((p / 100) * sortedMs.length);
  return sortedMs[Math.min(sortedMs.length, Math.max(1, rank)) - 1];
}

async function timedGet(target) {
  const start = performance.now();
  const res = await fetch(target, { headers: { accept: 'application/json' } });
  const body = await res.text(); // đọc hết body để đo đủ thời gian phản hồi
  const ms = performance.now() - start;
  if (!res.ok) throw new Error(`${target} trả HTTP ${res.status}`);
  let items;
  try {
    items = JSON.parse(body);
  } catch {
    throw new Error(`${target} không trả JSON`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`${target} không trả danh sách món (database chưa seed?)`);
  }
  return ms;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const target = opts.url.replace(/\/+$/, '') + opts.path;
  for (let i = 0; i < opts.warmup; i++) await timedGet(target);

  const samples = [];
  for (let i = 0; i < opts.requests; i++) samples.push(await timedGet(target)); // liên tiếp, không song song

  const sorted = [...samples].sort((a, b) => a - b);
  const r = (v) => Math.round(v * 10) / 10;
  const result = {
    test: 'PERF-T01',
    requirement: 'NFR-01',
    target,
    requests: opts.requests,
    warmup: opts.warmup,
    minMs: r(sorted[0]),
    avgMs: r(samples.reduce((s, v) => s + v, 0) / samples.length),
    pMs: r(percentile(sorted, opts.percentile)),
    percentile: opts.percentile,
    maxMs: r(sorted.at(-1)),
    thresholdMs: opts.thresholdMs,
    underThreshold: samples.filter((v) => v < opts.thresholdMs).length,
    at: new Date().toISOString(),
  };
  result.passed = result.pMs < opts.thresholdMs;

  console.log(`PERF-T01 (NFR-01) – GET ${target}`);
  console.log(`  ${opts.requests} yêu cầu liên tiếp (bỏ ${opts.warmup} lần khởi động)`);
  console.log(`  min ${result.minMs} ms · trung bình ${result.avgMs} ms · p${opts.percentile} ${result.pMs} ms · max ${result.maxMs} ms`);
  console.log(`  ${result.underThreshold}/${opts.requests} yêu cầu dưới ${opts.thresholdMs} ms`);
  console.log(
    `  Kết quả: ${result.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'} (p${opts.percentile} ${result.passed ? '<' : '>='} ${opts.thresholdMs} ms)` +
      (opts.reportOnly ? ' – chế độ chỉ báo cáo' : ''),
  );
  if (opts.json) writeFileSync(opts.json, JSON.stringify(result, null, 2) + '\n');
  if (!result.passed && !opts.reportOnly) process.exitCode = 1;
}

// Chỉ chạy khi gọi trực tiếp; khi import (unit test) thì chỉ dùng hàm percentile.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((err) => {
  console.error(`PERF-T01 lỗi: ${err.message}`);
  process.exitCode = 1;
});
