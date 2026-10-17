const GiB = 1024 ** 3;
const positive = value => Number.isFinite(value) && value > 0;
const nonnegative = value => Number.isFinite(value) && value >= 0;
const hostReserve = bytes => Math.max(4 * GiB, bytes * 0.15);

export function validateHardware(hardware) {
  const errors = [];
  if (!positive(hardware.ramBytes)) errors.push('System RAM must be a positive number.');
  if (!['cpu', 'unified', 'dedicated'].includes(hardware.topology)) errors.push('Choose a memory topology.');
  if (hardware.topology === 'dedicated' && !positive(hardware.vramBytes)) errors.push('Dedicated GPU memory must be a positive number.');
  if (hardware.bandwidthGBs != null && !positive(hardware.bandwidthGBs)) errors.push('Bandwidth must be positive or left blank.');
  if (hardware.price !== null && !nonnegative(hardware.price)) errors.push('Price must be zero or greater, or left blank.');
  if (hardware.executionLimitBytes != null && (!positive(hardware.executionLimitBytes) || hardware.executionLimitBytes > hardware.ramBytes)) errors.push('Graphics allocation must fit within system RAM.');
  return errors;
}

export function calculate(hardware, model, settings, runtimes, benchmarks = []) {
  const result = { status: 'unavailable', weightsBytes: 0, weightsEstimated: false, cacheBytes: 0, workspaceBytes: 0, requiredBytes: 0, availableBytes: 0, remainingBytes: 0, runtimeIds: [], performance: { benchmark: null, bandwidthCeiling: null }, reason: '' };
  const errors = validateHardware(hardware);
  const artifact = model.weightsByBits?.[settings.bits];
  if (!artifact || ![4, 8].includes(settings.bits)) errors.push('Choose a documented quantization.');
  if (!Number.isInteger(settings.context) || settings.context < 1 || settings.context > model.maxContext) errors.push(`Context must be a whole number from 1 to ${model.maxContext}.`);
  if (model.cacheArchitecture !== 'gqa') errors.push('Memory estimation is unavailable for this cache architecture.');
  if (![model.parameters, model.layers, model.kvHeads, model.headDim, model.maxContext].every(positive)) errors.push('Model architecture metadata is incomplete.');
  const pool = hardware.topology === 'dedicated' ? hardware.vramBytes : hardware.ramBytes;
  if (settings.reserveBytes != null && (!nonnegative(settings.reserveBytes) || settings.reserveBytes > pool)) errors.push('Reserved memory must be between zero and the execution memory capacity.');
  if (artifact?.bytes != null && !positive(artifact.bytes)) errors.push('Artifact size is invalid.');
  if (errors.length) return { ...result, reason: errors.join(' ') };

  const compatible = runtimes.filter(r => hardware.runtimeIds?.includes(r.id) && model.runtimeIds?.includes(r.id) && r.platforms.includes(hardware.platform));
  result.runtimeIds = compatible.map(r => r.id);
  result.weightsBytes = artifact.bytes ?? model.parameters * settings.bits / 8 * 1.1;
  result.weightsEstimated = artifact.bytes == null;
  result.weightsRounded = artifact.rounded === true;
  result.cacheBytes = 2 * model.layers * model.kvHeads * model.headDim * settings.context * 2;
  result.workspaceBytes = Math.max(GiB, result.weightsBytes * 0.05);
  result.requiredBytes = result.weightsBytes + result.cacheBytes + result.workspaceBytes;
  const reserve = settings.reserveBytes ?? (hardware.topology === 'dedicated' ? Math.max(GiB, pool * 0.05) : hostReserve(pool));
  result.availableBytes = Math.max(0, Math.min(pool - reserve, hardware.executionLimitBytes ?? Infinity));
  result.remainingBytes = result.availableBytes - result.requiredBytes;
  if (!compatible.length) return { ...result, reason: 'No documented runtime path for this platform and model.' };

  if (result.remainingBytes >= 0) {
    result.status = result.remainingBytes >= result.availableBytes * 0.1 ? 'comfortable' : 'tight';
    result.reason = result.status === 'comfortable' ? 'Fits with at least 10% of usable execution memory remaining.' : 'Fits on paper, with less than 10% headroom. Leave room for runtime variation.';
  } else if (hardware.topology === 'dedicated' && result.requiredBytes <= Math.max(0, hardware.ramBytes - hostReserve(hardware.ramBytes)) && compatible.some(r => r.partialOffload)) {
    result.status = 'offload';
    result.runtimeIds = compatible.filter(r => r.partialOffload).map(r => r.id);
    result.reason = 'Does not fit entirely in VRAM. A conservative full host-RAM fit is possible with partial GPU offload; speed is unmeasured.';
  } else {
    result.status = 'insufficient';
    result.reason = 'Insufficient usable memory for this model, context, and workspace allowance.';
  }

  const resident = ['comfortable', 'tight'].includes(result.status);
  if (resident && !model.activeParameters && positive(hardware.bandwidthGBs)) {
    result.performance.bandwidthCeiling = hardware.bandwidthGBs * 1e9 / result.weightsBytes;
  }
  result.performance.benchmark = resident ? benchmarks.find(b => b.hardwareId === hardware.id && b.modelId === model.id && b.bits === settings.bits && b.context === settings.context && result.runtimeIds.includes(b.runtimeId) && b.runtimeVersion && b.source && b.conditions && positive(b.tokensPerSecond)) ?? null : null;
  return result;
}

export function rankHardware(hardware, currency) {
  return hardware.filter(h => h.currency === currency).toSorted((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
}
