import { hardware, models, runtimes, benchmarks, GiB } from './catalogue.js';
import { calculate, validateHardware, rankHardware } from './calculator.js';

const $ = id => document.getElementById(id);
const state = { mode: 'model', hardwareId: 'mini-pro-48', modelId: 'qwen32', bits: 4, cacheBits: 16, context: 4096, currency: 'USD', customPriceCurrency: 'USD', overrides: new Map(), comparison: [], detail: null };
const labels = { comfortable: 'Comfortable fit', tight: 'Tight fit', offload: 'CPU offload', insufficient: 'Doesn’t fit', unavailable: 'Unavailable' };
const resident = result => ['comfortable', 'tight'].includes(result.status);
const gib = bytes => `${(bytes / GiB).toLocaleString('en-US', { maximumFractionDigits: 1 })} GiB`;
const number = id => $(id).value.trim() === '' ? null : Number($(id).value);
const price = h => h.price == null ? 'Add a quote' : new Intl.NumberFormat('en-US', { style: 'currency', currency: h.currency, maximumFractionDigits: 0 }).format(h.price);

function el(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value != null) element.setAttribute(key === 'className' ? 'class' : key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child != null) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}
function link(label, href) { return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label); }
function action(text, className, handler, attributes = {}) {
  const button = el('button', { type: 'button', className, ...attributes }, text);
  button.addEventListener('click', handler);
  return button;
}
function badge(result) { return el('span', { className: `badge ${result.status}` }, labels[result.status]); }
function quoted(h) { return state.overrides.has(h.id) ? { ...h, ...state.overrides.get(h.id), priceBasis: 'Your session quote' } : h; }
function customHardware() {
  const platform = $('custom-platform').value;
  const topology = platform === 'cuda' ? 'dedicated' : platform === 'cpu' ? 'cpu' : 'unified';
  return { id: 'custom', name: 'Your custom machine', platform, topology, ramBytes: number('custom-ram') === null ? null : number('custom-ram') * GiB, vramBytes: topology === 'dedicated' ? (number('custom-vram') === null ? null : number('custom-vram') * GiB) : 0,
    bandwidthGBs: number('custom-bandwidth'), price: number('custom-price'), currency: number('custom-price') === null ? state.currency : state.customPriceCurrency, priceBasis: 'Your session quote', condition: 'custom', availability: 'Your configuration', verifiedAt: 'User supplied', sources: [], runtimeIds: runtimes.filter(r => r.id !== 'mlx' && r.platforms.includes(platform)).map(r => r.id), detail: 'User-entered specifications', note: 'Confirm driver support, CPU instruction support, and usable GPU allocation with your runtime. Custom integrated-memory GPU allocations may be lower than total RAM.' };
}
function allHardware() {
  return hardware.map(quoted).concat(state.hardwareId === 'custom' || state.comparison.includes('custom') ? [quoted(customHardware())] : []);
}
function currentHardware() { return allHardware().find(h => h.id === state.hardwareId); }
function currentModel() { return models.find(m => m.id === state.modelId); }
function settings(h) {
  return { bits: state.bits, cacheBits: state.cacheBits, context: state.context, ...(h.id === 'custom' && number('custom-reserve') !== null ? { reserveBytes: number('custom-reserve') * GiB } : {}) };
}
function estimate(h, m) { return calculate(h, m, settings(h), runtimes, benchmarks); }

function readControls({ clamp = false } = {}) {
  state.modelId = $('model-select').value;
  state.hardwareId = $('hardware-select').value;
  state.bits = Number($('bits').value);
  state.cacheBits = Number($('cache-bits').value);
  state.context = number('context');
  state.currency = $('currency').value;
  const max = currentModel().maxContext;
  $('context').max = String(max);
  if (clamp && state.context > max) {
    state.context = max;
    $('context').value = String(max);
    $('context-help').textContent = `Context reduced to this model’s ${max.toLocaleString()} token limit. Prompt + generated tokens · one user`;
  }
}
function updateControls() {
  const isHardware = state.mode === 'hardware';
  $('hardware-field').hidden = !isHardware;
  $('custom-hardware').hidden = state.hardwareId !== 'custom';
  $('custom-vram-field').hidden = $('custom-platform').value !== 'cuda';
  document.querySelector('label[for="custom-price"]').textContent = `Complete-system price (${number('custom-price') === null ? state.currency : state.customPriceCurrency})`;
  $('mode-model').setAttribute('aria-pressed', String(!isHardware));
  $('mode-hardware').setAttribute('aria-pressed', String(isHardware));
  $('mode-description').textContent = isHardware ? 'Pick your machine. Explore its model options.' : 'Pick a model. Find its next machine.';
  $('model-label').textContent = isHardware ? 'Model for comparison' : 'Choose a model';
  $('model-note').textContent = `${currentModel().purpose} · ${currentModel().activeParameters ? `${(currentModel().parameters / 1e9).toFixed(1)}B stored / ${(currentModel().activeParameters / 1e9).toFixed(1)}B active` : `${(currentModel().parameters / 1e9).toFixed(1)}B parameters`}`;
  $('context-value').textContent = Number.isFinite(state.context) ? `${state.context.toLocaleString()} tokens` : '';
  for (const button of document.querySelectorAll('[data-context]')) {
    button.disabled = Number(button.dataset.context) > currentModel().maxContext;
    button.setAttribute('aria-pressed', String(Number(button.dataset.context) === state.context));
  }
}

function stat(label, value, note, primary = false) {
  return el('div', { className: `stat${primary ? ' primary' : ''}` }, el('p', { className: 'stat-label' }, label), el('p', { className: 'stat-value' }, value), el('p', { className: 'stat-note' }, note));
}
function memoryBar(result) {
  if (!result.availableBytes) return null;
  return el('div', { className: `mini-bar ${result.status}`, 'aria-hidden': 'true' }, ...[result.weightsBytes, result.cacheBytes, result.workspaceBytes].map(bytes => el('span', { style: `width:${Math.min(100, bytes / result.availableBytes * 100)}%;flex-shrink:0` })));
}
function memoryCell(h, m, r) {
  if (state.mode === 'hardware') return el('td', {}, el('span', { className: 'memory-value' }, r.requiredBytes ? gib(r.requiredBytes) : '—'), el('span', { className: 'memory-label' }, `total at ${state.bits}-bit`));
  const capacity = h.topology === 'dedicated' ? h.vramBytes : h.ramBytes;
  return el('td', {}, el('span', { className: 'memory-value' }, Number.isFinite(capacity) ? gib(capacity) : '—'), el('span', { className: 'memory-label' }, h.topology === 'dedicated' ? 'dedicated VRAM' : h.topology === 'unified' ? 'unified memory' : 'system RAM'));
}
function resultRow(h, m, r, picks) {
  const isHardware = state.mode === 'hardware';
  const title = isHardware ? m.name : h.name;
  const selected = state.comparison.includes(h.id);
  const compare = action(selected ? '✓' : '+', 'compare-button', () => toggleComparison(h.id), { 'aria-label': `${selected ? 'Remove' : 'Compare'} ${h.name}`, 'aria-pressed': String(selected), title: state.comparison.length >= 3 && !selected ? 'Remove a machine before adding another' : `Compare ${h.name}` });
  if (!selected && state.comparison.length >= 3) compare.disabled = true;
  let pick = null;
  if (!isHardware && picks.comfortable === h.id) pick = 'LOWEST COMFORTABLE BUDGET';
  else if (!isHardware && picks.resident === h.id) pick = 'LOWEST RESIDENT BUDGET';
  const name = action('', 'record-name', () => openDetails(h.id, m.id));
  name.append(el('span', { className: 'machine-name' }, title), el('span', { className: 'machine-detail' }, isHardware ? m.purpose : h.detail));
  const p = el('td', {}, el('span', { className: 'price' }, price(h)), el('span', { className: 'price-label' }, h.priceBasis.includes('Historical') ? 'Historical MSRP' : h.priceBasis.includes('Announced') ? 'Announced MSRP' : h.priceBasis === 'Your session quote' ? 'Your quote' : 'Planning budget'));
  if (h.currency !== state.currency) p.append(el('span', { className: 'price-label' }, `${h.currency} reference · excluded`));
  const speed = r.performance.benchmark;
  return el('tr', { className: pick ? 'recommended' : null },
    el('td', {}, pick ? el('span', { className: 'pick-label' }, pick) : null, el('div', { className: 'name-cell' }, el('span', { className: 'machine-icon', 'aria-hidden': 'true' }, isHardware ? '◇' : h.topology === 'dedicated' ? '▥' : h.platform === 'cpu' ? '▤' : '▣'), name)),
    memoryCell(h, m, r),
    el('td', {}, badge(r), el('span', { className: 'fit-note' }, r.requiredBytes ? `${gib(r.requiredBytes)} / ${gib(r.availableBytes)} usable` : 'Check inputs'), memoryBar(r)),
    p,
    el('td', {}, el('span', { className: 'machine-detail' }, speed ? `${speed.tokensPerSecond} tok/s measured` : 'Unbenchmarked'), el('span', { className: 'benchmark-note' }, r.performance.bandwidthCeiling ? `≤ ${Math.floor(r.performance.bandwidthCeiling)} tok/s ceiling*` : 'No speed claim'), action('Details ↗', 'text-button', () => openDetails(h.id, m.id))),
    el('td', {}, isHardware ? action('View', 'text-button', () => { if (!selected && state.comparison.length < 3) state.comparison.push(h.id); $('model-select').value = m.id; readControls({ clamp: true }); render(); document.querySelector('#comparison-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, { 'aria-label': `Use ${m.name} for comparison`, ...(!selected && state.comparison.length >= 3 ? { disabled: '' } : {}) }) : compare)
  );
}

function render() {
  updateControls();
  const selectedHardware = currentHardware();
  const selectedModel = currentModel();
  const hardwareList = allHardware();
  const ranked = rankHardware(hardwareList, state.currency);
  const data = state.mode === 'hardware' ? models.map(m => ({ h: selectedHardware, m, r: estimate(selectedHardware, m) })) : [...ranked, ...hardwareList.filter(h => h.currency !== state.currency)].map(h => ({ h, m: selectedModel, r: estimate(h, selectedModel) }));
  const invalid = state.hardwareId === 'custom' ? validateHardware(selectedHardware) : [];
  if (!Number.isInteger(state.context) || state.context < 1 || state.context > selectedModel.maxContext) invalid.push(`Enter a whole context length between 1 and ${selectedModel.maxContext.toLocaleString()}.`);
  if (state.hardwareId === 'custom') {
    const customResult = estimate(selectedHardware, selectedModel);
    if (customResult.status === 'unavailable' && !invalid.length) invalid.push(customResult.reason);
  }
  $('input-errors').textContent = invalid.join(' ');
  const eligible = data.filter(d => resident(d.r));
  const purchasable = data.filter(d => d.h.currency === state.currency && d.h.price !== null && resident(d.r));
  const picks = { comfortable: purchasable.find(d => d.r.status === 'comfortable')?.h.id, resident: purchasable[0]?.h.id };
  const chosen = data.find(d => d.m.id === state.modelId) ?? data[0];
  if (state.mode === 'model') {
    const cheapest = purchasable.find(d => d.r.status === 'comfortable');
    const footprint = estimate(hardware[0], selectedModel);
    $('overview').replaceChildren(
      stat('MODEL MEMORY FOOTPRINT', footprint.requiredBytes ? gib(footprint.requiredBytes) : '—', `${state.bits}-bit weights + context + workspace`, true),
      stat('FITS ENTIRELY IN MEMORY', `${eligible.length} / ${data.length}`, 'Configurations · comfortable or tight'),
      stat('LOWEST COMFORTABLE BUDGET', cheapest ? price(cheapest.h) : 'No quote', cheapest ? (cheapest.h.priceBasis === 'Your session quote' ? 'Your session quote · not a speed claim' : cheapest.h.condition === 'used' ? 'Used planning budget · not a speed claim' : 'Reference budget · verify before buying') : `Add a compatible ${state.currency} quote`)
    );
  } else {
    $('overview').replaceChildren(
      stat('YOUR EXECUTION MEMORY', chosen?.r.availableBytes ? gib(chosen.r.availableBytes) : '—', 'After OS reserve / GPU allocation cap', true),
      stat('MODELS FIT IN MEMORY', `${eligible.length} / ${data.length}`, 'At your selected context & quantization'),
      stat('COMPLETE-SYSTEM COST', price(selectedHardware), selectedHardware.priceBasis)
    );
  }
  const filtered = $('compatible-only').checked ? data.filter(d => resident(d.r) || d.r.status === 'offload') : data;
  $('results-title').textContent = state.mode === 'hardware' ? 'Your model shortlist' : 'Your hardware shortlist';
  $('result-summary').textContent = `${filtered.length} results · ${state.mode === 'model' ? selectedModel.name : selectedHardware.name} · ${state.bits}-bit · ${Number.isFinite(state.context) ? state.context.toLocaleString() : '—'} context`;
  $('sort-note').textContent = state.mode === 'hardware' ? 'SMALLEST TO LARGEST MODEL' : 'SORTED BY SYSTEM COST ↑';
  const table = el('table', { className: 'results-table' }, el('caption', { className: 'sr-only' }, 'Memory, cost, and performance evidence for your settings'), el('thead', {}, el('tr', {}, ...[state.mode === 'hardware' ? 'MODEL' : 'HARDWARE', state.mode === 'hardware' ? 'REQUIRED' : 'MEMORY', 'MEMORY FIT', 'SYSTEM COST', 'PERFORMANCE', state.mode === 'hardware' ? 'SELECT' : 'COMPARE'].map(t => el('th', { scope: 'col' }, t)))), el('tbody', {}, ...filtered.map(({ h, m, r }) => resultRow(h, m, r, picks))));
  $('results').replaceChildren(filtered.length ? table : el('p', { className: 'empty-message' }, 'No compatible configurations at these settings. Try a smaller model, shorter context, or turn off the compatibility filter.'));
  renderComparison();
}

function toggleComparison(id) {
  if (state.comparison.includes(id)) state.comparison = state.comparison.filter(existing => existing !== id);
  else if (state.comparison.length < 3) state.comparison.push(id);
  render();
  // Preserve keyboard position when the results list is replaced.
  const button = [...document.querySelectorAll('.compare-button')].find(b => b.getAttribute('aria-label') === `${state.comparison.includes(id) ? 'Remove' : 'Compare'} ${allHardware().find(h => h.id === id).name}`);
  button?.focus({ preventScroll: true });
}

function renderComparison() {
  const container = $('comparison');
  if (!state.comparison.length) {
    container.className = 'comparison-empty';
    container.replaceChildren(el('span', { 'aria-hidden': 'true' }, '⊞'), el('h3', {}, 'A little perspective helps.'), el('p', {}, 'Use the + buttons in your results to compare machines with the same model and settings.'));
    return;
  }
  container.className = '';
  const m = currentModel();
  const records = state.comparison.map(id => allHardware().find(h => h.id === id)).filter(Boolean).map(h => ({ h, r: estimate(h, m) }));
  const row = (title, values) => el('tr', {}, el('th', { scope: 'row' }, title), ...values.map(v => el('td', {}, v)));
  const table = el('table', { className: 'comparison-table' },
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Same model. Same settings.'), ...records.map(({ h }) => el('th', { scope: 'col' }, h.name, action('Remove ×', 'remove-button', () => { state.comparison = state.comparison.filter(id => id !== h.id); render(); }, { 'aria-label': `Remove ${h.name} from comparison` }))))),
    el('tbody', {}, row('Complete-system price', records.map(({ h }) => `${price(h)} · ${h.currency}`)), row('Price basis', records.map(({ h }) => h.priceBasis)), row('Memory fit', records.map(({ r }) => badge(r))), row('Required / usable memory', records.map(({ r }) => r.requiredBytes ? `${gib(r.requiredBytes)} / ${gib(r.availableBytes)}` : 'Unavailable')), row('Measured performance', records.map(({ r }) => r.performance.benchmark ? `${r.performance.benchmark.tokensPerSecond} tok/s` : 'Unbenchmarked')), row('Bandwidth ceiling, not expected speed', records.map(({ r }) => r.performance.bandwidthCeiling ? `≤ ${Math.floor(r.performance.bandwidthCeiling)} tok/s` : 'Unavailable')), row('Compatible software', records.map(({ r }) => r.runtimeIds.map(id => runtimes.find(rt => rt.id === id).name).join(', ') || 'No documented runtime')))
  );
  container.replaceChildren(el('p', { className: 'compare-meta' }, `${m.name} · ${state.bits}-bit · ${Number.isFinite(state.context) ? state.context.toLocaleString() : '—'} total context tokens · ${state.cacheBits === 16 ? 'FP16' : state.cacheBits + '-bit'} cache. Different currencies are not converted.`), el('div', { className: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Side-by-side hardware comparison' }, table));
}

function openDetails(hardwareId, modelId) {
  state.detail = { hardwareId, modelId };
  const h = allHardware().find(item => item.id === hardwareId);
  const m = models.find(item => item.id === modelId);
  const r = estimate(h, m);
  const content = $('detail-content');
  content.replaceChildren(el('h2', { id: 'detail-title' }, h.name), el('p', {}, `${h.detail} · ${h.availability}`), badge(r), el('p', {}, r.reason), el('h3', {}, `${m.name} · ${state.bits}-bit · ${state.context?.toLocaleString() ?? '—'} tokens`));
  const breakdown = el('dl', { className: 'breakdown' });
  for (const [label, bytes] of [['Model weights', r.weightsBytes], ['Context cache', r.cacheBytes], ['Runtime workspace', r.workspaceBytes], ['Usable execution memory', r.availableBytes]]) {
    breakdown.append(el('div', {}, el('dt', {}, label), el('dd', {}, r.requiredBytes ? gib(bytes) : '—')));
  }
  content.append(breakdown, el('p', {}, `Weights use ${r.weightsEstimated ? 'an estimate (parameters × bits ÷ 8 + 10%); no matching GGUF size is recorded' : r.weightsRounded ? 'the published rounded GGUF size' : 'the summed GGUF file size'}. Runtime workspace and OS reserves are planning allowances. Verify actual runtime allocation before purchasing.`), el('p', {}, `Model license: ${m.license}. Context limit: ${m.maxContext.toLocaleString()} tokens without extensions.`));
  if (m.activeParameters) content.append(el('p', {}, 'Mixture of experts: the entire stored model must fit; its active-parameter count does not determine storage memory.'));
  if (h.note) content.append(el('p', {}, h.note));
  content.append(el('h3', {}, 'Performance evidence'), el('p', {}, r.performance.benchmark ? `${r.performance.benchmark.tokensPerSecond} tokens/second measured. ${r.performance.benchmark.conditions}` : 'No matching measured benchmark is bundled. Memory fit alone does not establish responsiveness.'));
  if (r.performance.benchmark) content.append(link('Benchmark source ↗', r.performance.benchmark.source));
  if (r.performance.bandwidthCeiling) content.append(el('p', {}, `≤ ${Math.floor(r.performance.bandwidthCeiling)} tokens/second — bandwidth ceiling, not expected speed. Actual decoding is affected by compute, cache traffic, context depth, runtime and thermals.`));
  content.append(el('h3', {}, 'Software & getting started'), el('p', {}, 'Documentation guidance, not a setup tested on your machine. Exact model repository:'), link(`Qwen/${m.artifactUrl.split('/').pop()} ↗`, m.artifactUrl));
  for (const id of r.runtimeIds) {
    const rt = runtimes.find(item => item.id === id);
    content.append(el('div', { className: 'runtime-block' }, link(`${rt.name} ↗`, rt.docsUrl), el('p', {}, rt.setupNote)));
  }
  if (h.platform === 'mac') content.append(el('div', { className: 'runtime-block' }, link('Alternative format: MLX-LM ↗', runtimes.find(rt => rt.id === 'mlx').docsUrl), el('p', {}, runtimes.find(rt => rt.id === 'mlx').setupNote)));
  if (h.setupUrl || h.platform === 'spark') content.append(link('NVIDIA DGX Spark ARM64 / GB10 setup recipe ↗', h.setupUrl ?? 'https://build.nvidia.com/spark/llama-cpp/overview'));
  const priceSummary = el('p', {}, `${price(h)} ${h.currency} · ${h.priceBasis}. Excludes tax and shipping.`);
  content.append(el('h3', {}, 'Complete-system price'), priceSummary);
  if (h.priceBreakdown) content.append(el('p', {}, `Reference budget components: ${h.priceBreakdown}`));
  const input = el('input', { className: 'price-input', id: 'quote-price', type: 'number', min: '0', step: 'any', placeholder: 'Leave blank to restore reference', value: state.overrides.get(h.id)?.currency === state.currency ? state.overrides.get(h.id).price : '' });
  const feedback = el('p', { className: 'dialog-feedback', role: 'status' });
  const save = action(`Save ${state.currency} quote`, 'button', () => {
    const value = input.value.trim() === '' ? null : Number(input.value);
    if (value !== null && (!Number.isFinite(value) || value < 0)) { feedback.textContent = 'Enter a price of zero or greater.'; return; }
    if (value === null) state.overrides.delete(h.id);
    else state.overrides.set(h.id, { price: value, currency: state.currency });
    render();
    const updated = quoted(hardware.find(item => item.id === h.id) ?? customHardware());
    priceSummary.textContent = `${price(updated)} ${updated.currency} · ${updated.priceBasis}. Excludes tax and shipping.`;
    feedback.textContent = value === null ? 'Reference price restored.' : `${state.currency} quote saved for this session.`;
  });
  content.append(el('div', { className: 'dialog-price' }, el('div', { className: 'field' }, el('label', { for: 'quote-price' }, `Your complete-system quote (${state.currency})`), input), save), feedback, el('h3', {}, 'Sources & verification'), el('p', {}, `Hardware checked: ${h.verifiedAt}. Model checked: ${m.verifiedAt}. Prices and stock can change.`));
  const sources = el('div', { className: 'source-links' });
  h.sources.forEach((url, i) => sources.append(link(`Hardware reference ${i + 1} ↗`, url)));
  sources.append(link('Model architecture ↗', m.sources[0]), link('GGUF artifacts & published sizes ↗', m.artifactUrl));
  content.append(sources);
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
}

$('hardware-select').replaceChildren(...hardware.map(h => el('option', { value: h.id }, `${h.name} · ${gib(h.topology === 'dedicated' ? h.vramBytes : h.ramBytes)}`)), el('option', { value: 'custom' }, '+ My custom hardware'));
$('model-select').replaceChildren(...models.map(m => el('option', { value: m.id }, m.name)));
$('hardware-select').value = state.hardwareId;
$('model-select').value = state.modelId;
for (const mode of ['hardware', 'model']) $('mode-' + mode).addEventListener('click', () => { state.mode = mode; render(); });
for (const id of ['hardware-select', 'model-select', 'bits', 'cache-bits', 'currency', 'compatible-only', 'custom-platform']) $(id).addEventListener('change', () => { readControls({ clamp: id === 'model-select' }); render(); });
for (const id of ['context', 'custom-ram', 'custom-vram', 'custom-bandwidth', 'custom-reserve', 'custom-price']) $(id).addEventListener('input', () => { if (id === 'custom-price') state.customPriceCurrency = state.currency; readControls(); render(); });
for (const button of document.querySelectorAll('[data-context]')) button.addEventListener('click', () => { $('context').value = button.dataset.context; readControls(); render(); });
$('reset-prices').addEventListener('click', () => { state.overrides.clear(); render(); $('result-summary').textContent += ' · Edited prices reset.'; });
$('close-dialog').addEventListener('click', () => $('detail-dialog').close());
$('detail-dialog').addEventListener('click', event => { if (event.target === $('detail-dialog')) { const r = $('detail-dialog').getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $('detail-dialog').close(); } });
render();
