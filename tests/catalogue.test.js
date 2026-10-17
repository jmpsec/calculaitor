import test from 'node:test';
import assert from 'node:assert/strict';
import { hardware, models, runtimes, benchmarks, GiB } from '../dist/catalogue.js';
import { calculate } from '../dist/calculator.js';

test('MacBook presets cover M-series generations and keep Intel execution separate', () => {
  for (const generation of [1, 2, 3, 4, 5]) {
    for (const family of ['Air', 'Pro']) {
      assert.ok(hardware.some(h => h.name.includes(`MacBook ${family}`) && h.name.endsWith(`M${generation}${family === 'Pro' ? ' Max' : ''}`)), `${family} M${generation}`);
    }
  }
  const intel = hardware.filter(h => h.platform === 'mac-intel');
  assert.ok(intel.length >= 2);
  for (const h of intel) {
    assert.equal(h.topology, 'cpu');
    assert.equal(h.vramBytes, 0);
    assert.equal(h.bandwidthGBs, null);
    const result = calculate(h, models[0], { bits: 4, context: 4096 }, runtimes);
    assert.deepEqual(result.runtimeIds, ['llama']);
    assert.ok(result.availableBytes <= h.ramBytes - 4 * GiB);
    assert.equal(result.performance.bandwidthCeiling, null);
  }
});

test('catalogue records are unique, sourced, dated, and connected to valid runtimes', () => {
  assert.ok(hardware.length >= 10);
  assert.ok(models.length >= 8);
  const ids = new Set(runtimes.map(r => r.id));
  for (const records of [hardware, models, runtimes]) {
    assert.equal(new Set(records.map(r => r.id)).size, records.length);
  }
  for (const record of [...hardware, ...models]) {
    assert.ok(record.sources.length > 0, record.id);
    assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const source of record.sources) assert.equal(new URL(source).protocol, 'https:');
    assert.ok(record.runtimeIds.every(id => ids.has(id)), record.id);
  }
  assert.ok(Array.isArray(benchmarks));
});

test('hardware covers premium through minimum viable without pretending a GPU is a full PC', () => {
  for (const family of ['Mac Studio', 'DGX Spark', 'Mac mini', 'RTX', 'Ryzen', 'CPU']) {
    assert.ok(hardware.some(h => h.name.includes(family)), family);
  }
  assert.ok(hardware.some(h => h.condition === 'used'));
  for (const h of hardware) {
    assert.ok(h.ramBytes > 0);
    assert.ok(['unified', 'dedicated', 'cpu'].includes(h.topology));
    if (h.topology === 'dedicated') assert.ok(h.vramBytes > 0);
    assert.ok(h.price === null || (Number.isFinite(h.price) && h.price >= 0));
    assert.ok(h.priceBasis && h.currency && h.availability);
    if (h.name.includes('RTX')) assert.ok(h.priceBreakdown.includes('host'));
  }
});

test('model cache metadata and quantization sources are usable', () => {
  for (const m of models) {
    assert.ok(m.parameters > 0 && m.layers > 0 && m.kvHeads > 0 && m.headDim > 0, m.id);
    assert.ok(m.maxContext >= 4096);
    for (const bits of [4, 8]) {
      const weight = m.weightsByBits[bits];
      assert.ok(weight && weight.source);
      assert.ok(weight.bytes === null || weight.bytes > 0);
    }
  }
  assert.ok(models.some(m => m.activeParameters && m.parameters > m.activeParameters));
});
