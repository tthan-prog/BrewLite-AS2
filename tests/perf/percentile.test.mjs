// Unit test cho hàm tính phân vị của PERF-T01. Chạy: node --test tests/perf
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentile } from './products-latency.mjs';

const ms = Array.from({ length: 20 }, (_, i) => (i + 1) * 10); // 10, 20, ..., 200 (đã sắp xếp)

test('p95 của 20 mẫu là mẫu thứ 19 (nearest-rank)', () => {
  assert.equal(percentile(ms, 95), 190);
});

test('p100 là giá trị lớn nhất, p50 là trung vị dưới', () => {
  assert.equal(percentile(ms, 100), 200);
  assert.equal(percentile(ms, 50), 100);
});

test('một mẫu duy nhất', () => {
  assert.equal(percentile([42], 95), 42);
});

test('đúng tiêu chí NFR-01: 1 yêu cầu chậm trong 20 vẫn đạt, 2 yêu cầu chậm thì trượt', () => {
  const oneSlow = [...Array(19).fill(80), 900].sort((a, b) => a - b);
  const twoSlow = [...Array(18).fill(80), 900, 950].sort((a, b) => a - b);
  assert.ok(percentile(oneSlow, 95) < 500);
  assert.ok(percentile(twoSlow, 95) >= 500);
});
