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
    assert.ok(m.parameters > 0 && m.cache.length > 0, m.id);
    assert.ok(m.cache.every(g => g.layers > 0 && g.perToken > 0), m.id);
    assert.ok(m.maxContext >= 4096);
    for (const bits of [4, 8]) {
      const weight = m.weightsByBits[bits];
      assert.ok(weight && weight.source);
      assert.ok(weight.bytes === null || weight.bytes > 0);
    }
  }
  assert.ok(models.some(m => m.activeParameters && m.parameters > m.activeParameters));
});

test('frontier models reach the largest presets: 397B and DeepSeek V3.2 Q4 fit 512 GiB, Kimi K2 does not', () => {
  const studio = hardware.find(h => h.id === 'studio-ultra-512');
  const run = (id, bits) => calculate(studio, models.find(m => m.id === id), { bits, context: 32768 }, runtimes);
  assert.equal(run('qwen35-397b', 4).status, 'comfortable');
  const ds = run('dsv32', 4);
  assert.equal(ds.status, 'tight');
  assert.equal(ds.cacheBytes, 61 * (576 + 128) * 32768 * 2);
  assert.equal(run('dsv32', 8).status, 'insufficient');
  assert.equal(run('kimi-k2-thinking', 4).status, 'insufficient');
  assert.ok(run('glm53', 4).weightsEstimated);
});

test('hybrid and sliding-window models keep long-context caches small', () => {
  const at = (id, context) => calculate(hardware.find(h => h.id === 'studio-ultra-512'), models.find(m => m.id === id), { bits: 4, context }, runtimes).cacheBytes;
  // Gemma 4 sliding layers stop at 1,024 tokens; only the 10 global layers grow.
  assert.equal(at('gemma4-31b', 131072) - at('gemma4-31b', 65536), 10 * 2 * 4 * 512 * 65536 * 2);
  // Qwen3.8-27B: only 16 of 64 layers keep a KV cache, plus fixed DeltaNet state.
  assert.ok(at('qwen38-27b', 131072) < 10 * GiB);
});

test('models whose context passes the native length say so', () => {
  for (const m of models.filter(m => m.nativeContext)) assert.ok(m.nativeContext < m.maxContext, m.id);
  assert.ok(models.some(m => m.maxContext >= 1_000_000));
});
