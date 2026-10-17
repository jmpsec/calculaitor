import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, validateHardware, rankHardware } from '../dist/calculator.js';
const G = 1024 ** 3;
const hw = { id: 'pc', platform: 'cpu', topology: 'cpu', ramBytes: 16 * G, vramBytes: 0, bandwidthGBs: 100, runtimeIds: ['llama'], price: 100, currency: 'USD' };
const model = { id: 'm', parameters: 2e9, cache: [{ layers: 2, perToken: 2 * 2 * 64 }], maxContext: 32768, runtimeIds: ['llama'], weightsByBits: { 4: { bytes: 2 * G }, 8: { bytes: 4 * G } } };
const rt = [{ id: 'llama', platforms: ['cpu', 'cuda'], partialOffload: true }];
const settings = { bits: 4, context: 4096 };
const calc = (h = hw, m = model, s = settings, r = rt, b = []) => calculate(h, m, s, r, b);

test('memory uses artifact bytes, FP16 GQA cache, and a separate workspace allowance', () => {
  const r = calc();
  assert.equal(r.weightsBytes, 2 * G);
  assert.equal(r.cacheBytes, 4194304);
  assert.equal(r.workspaceBytes, G);
  assert.equal(r.requiredBytes, 3225419776);
  assert.equal(r.availableBytes, 12 * G);
  assert.equal(r.status, 'comfortable');
  assert.equal(calc(hw, model, { ...settings, context: 8192 }).cacheBytes, 8388608);
});
test('fallback includes quantization overhead and stores full MoE weights', () => {
  const m = { ...model, parameters: 20e9, activeParameters: 2e9, weightsByBits: { 4: { bytes: null } } };
  const r = calc(hw, m);
  assert.equal(r.weightsBytes, 11e9);
  assert.equal(r.weightsEstimated, true);
  assert.equal(r.performance.bandwidthCeiling, null);
});
test('unified memory cannot be added to itself or augmented by a VRAM field', () => {
  const r = calc({ ...hw, topology: 'unified', vramBytes: 16 * G });
  assert.equal(r.availableBytes, 12 * G);
});
test('10% of available memory is comfortable, zero remaining is tight', () => {
  const m = { ...model, cache: [{ layers: 1, perToken: 2 }], weightsByBits: { 4: { bytes: 8 * G - 4 } } };
  const exact = calc({ ...hw, ramBytes: 13 * G }, m, { bits: 4, context: 1 });
  assert.equal(exact.availableBytes, 9 * G);
  assert.equal(exact.remainingBytes, 0);
  assert.equal(exact.status, 'tight');
  const boundary = calc({ ...hw, ramBytes: 14 * G }, m, { bits: 4, context: 1 });
  assert.equal(boundary.availableBytes, 10 * G);
  assert.equal(boundary.status, 'comfortable');
});
test('large memory uses proportional reserves and workspace', () => {
  const r = calc({ ...hw, ramBytes: 100 * G }, { ...model, weightsByBits: { 4: { bytes: 40 * G } } });
  assert.equal(r.availableBytes, 85 * G);
  assert.equal(r.workspaceBytes, 2 * G);
});
test('dedicated fit reserves VRAM and only falls back to compatible conservative host offload', () => {
  const gpu = { ...hw, platform: 'cuda', topology: 'dedicated', vramBytes: 4 * G };
  assert.equal(calc({ ...gpu, vramBytes: 8 * G }).availableBytes, 7 * G);
  assert.equal(calc(gpu).status, 'offload');
  assert.equal(calc(gpu).performance.bandwidthCeiling, null);
  assert.equal(calc(gpu, model, settings, [{ ...rt[0], partialOffload: false }]).status, 'insufficient');
  assert.equal(calc({ ...gpu, ramBytes: 4 * G }).status, 'insufficient');
  assert.equal(calc({ ...gpu, vramBytes: 100 * G }).availableBytes, 95 * G);
});
test('graphics allocation cap limits shared memory without double subtraction', () => {
  assert.equal(calc({ ...hw, topology: 'unified', ramBytes: 128 * G, executionLimitBytes: 96 * G }).availableBytes, 96 * G);
});
test('unknown runtime or cache architecture gives an unavailable result', () => {
  assert.equal(calc(hw, model, settings, []).status, 'unavailable');
  assert.equal(calc(hw, { ...model, cache: [] }).status, 'unavailable');
  assert.equal(calc(hw, model, settings, [{ ...rt[0], platforms: ['mac'] }]).status, 'unavailable');
});
test('invalid inputs never escape as NaN results', () => {
  for (const ramBytes of ['', NaN, Infinity, -G, 0, null]) {
    assert.ok(validateHardware({ ...hw, ramBytes }).length);
    assert.equal(calc({ ...hw, ramBytes }).status, 'unavailable');
  }
  for (const s of [{ bits: 3, context: 4096 }, { bits: 4, context: 0 }, { bits: 4, context: 32769 }, { bits: 4, context: 2.5 }, { ...settings, reserveBytes: -1 }, { ...settings, reserveBytes: 17 * G }]) {
    assert.equal(calc(hw, model, s).status, 'unavailable');
  }
  assert.ok(validateHardware({ ...hw, price: '' }).length);
  assert.ok(validateHardware({ ...hw, bandwidthGBs: -1 }).length);
  assert.ok(validateHardware({ ...hw, topology: 'dedicated', vramBytes: null }).length);
  assert.equal(calc({ ...hw, ramBytes: 2 * G }).availableBytes, 0);
});
test('reserve override applies only to the execution pool and accepts zero', () => {
  assert.equal(calc(hw, model, { ...settings, reserveBytes: 0 }).availableBytes, 16 * G);
  assert.equal(calc(hw, model, { ...settings, reserveBytes: 16 * G }).status, 'insufficient');
});
test('bandwidth ceiling is theoretical and no benchmark is inferred', () => {
  const r = calc();
  assert.equal(r.performance.benchmark, null);
  assert.equal(r.performance.bandwidthCeiling, 100e9 / (2 * G));
  assert.equal(calc({ ...hw, bandwidthGBs: null }).performance.bandwidthCeiling, null);
  const benchmark = { hardwareId: 'pc', modelId: 'm', bits: 4, context: 4096, runtimeId: 'llama', runtimeVersion: 'b123', tokensPerSecond: 20, source: 'https://example.com/bench', conditions: 'single user' };
  assert.equal(calc(hw, model, settings, rt, [benchmark]).performance.benchmark.tokensPerSecond, 20);
  assert.equal(calc(hw, model, { ...settings, context: 8192 }, rt, [benchmark]).performance.benchmark, null);
});
test('rank keeps currencies separate, unknown price last, and an explicit zero valid', () => {
  const list = [{ ...hw, id: 'unknown', price: null }, { ...hw, id: 'eur', price: 1, currency: 'EUR' }, { ...hw, id: 'first' }, { ...hw, id: 'free', price: 0 }, { ...hw, id: 'second' }];
  assert.deepEqual(rankHardware(list, 'USD').map(h => h.id), ['free', 'first', 'second', 'unknown']);
  assert.equal(list[0].id, 'unknown');
});

test('quantized KV cache shrinks cache; invalid precision rejected', () => {
  const full = calc().cacheBytes;
  assert.equal(calc(hw, model, { ...settings, cacheBits: 8 }).cacheBytes, full * 34 / 64);
  assert.equal(calc(hw, model, { ...settings, cacheBits: 4 }).cacheBytes, full * 18 / 64);
  assert.equal(calc(hw, model, { ...settings, cacheBits: 5 }).status, 'unavailable');
});

test('sliding-window layers stop at the window; linear-attention state is fixed and unquantized', () => {
  const hybrid = { ...model, cache: [{ layers: 2, perToken: 256 }, { layers: 4, perToken: 256, window: 1024 }], stateBytes: 1000 };
  assert.equal(calc(hw, hybrid).cacheBytes, (2 * 4096 + 4 * 1024) * 256 * 2 + 1000);
  assert.equal(calc(hw, hybrid, { ...settings, cacheBits: 8 }).cacheBytes, (2 * 4096 + 4 * 1024) * 256 * 34 / 32 + 1000);
  assert.equal(calc(hw, { ...hybrid, cache: [{ layers: 2, perToken: 256, window: 0 }] }).status, 'unavailable');
});
