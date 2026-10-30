export const GiB = 1024 ** 3;
export const verifiedAt = '2026-10-17';

export const runtimes = [
  { id: 'llama', name: 'llama.cpp', platforms: ['mac', 'mac-intel', 'cuda', 'spark', 'vulkan', 'cpu'], formats: ['GGUF'], partialOffload: true, docsUrl: 'https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md', setupNote: 'Install a build for your platform (Metal, CUDA, Vulkan, or CPU). Open the model card below and download the matching GGUF quantization. Set the total context to the value used here.' },
  { id: 'lmstudio', name: 'LM Studio', platforms: ['mac', 'cuda', 'vulkan', 'cpu'], formats: ['GGUF', 'MLX'], partialOffload: true, docsUrl: 'https://lmstudio.ai/docs/app/system-requirements', setupNote: 'Install LM Studio, search for the exact GGUF repository below, select Q4_K_M or Q8_0 to match this estimate, and set context before loading. CPU PCs need AVX2; Vulkan support depends on the GPU driver.' },
  { id: 'ollama', name: 'Ollama', platforms: ['mac', 'cuda', 'spark', 'cpu'], formats: ['GGUF'], partialOffload: true, docsUrl: 'https://docs.ollama.com/import', setupNote: 'Install Ollama, import the matching GGUF artifact, and configure num_ctx to match this estimate. Defaults and downloaded quantizations can differ; check them before comparing memory.' },
  { id: 'mlx', name: 'MLX-LM', platforms: ['mac'], formats: ['MLX'], partialOffload: false, docsUrl: 'https://github.com/ml-explore/mlx-lm', setupNote: 'Apple silicon only. Convert the original model to MLX or find a matching MLX Community checkpoint. MLX artifact sizes differ: the figures here apply to GGUF, so recalculate from your actual MLX weights.' },
];

const appleMini = 'https://support.apple.com/en-gb/121555';
const appleStudio = 'https://www.apple.com/newsroom/2025/03/apple-unveils-new-mac-studio-the-most-powerful-mac-ever/';
const spark = 'https://docs.nvidia.com/dgx/dgx-spark/hardware.html';
const gpu = name => `https://www.nvidia.com/en-us/geforce/graphics-cards/${name}/`;

function machine(id, name, platform, topology, ram, vram, bandwidthGBs, price, priceBasis, sources, extra = {}) {
  return { id, name, platform, topology, ramBytes: ram * GiB, vramBytes: vram * GiB, bandwidthGBs, price, currency: 'USD', priceBasis, condition: 'new', availability: 'Reference configuration; check local stock', sources, verifiedAt,
    runtimeIds: runtimes.filter(r => r.platforms.includes(platform) && r.id !== 'mlx').map(r => r.id), ...extra };
}

// Prices labeled "planning budget" are editable examples, not retailer quotes.
export const hardware = [
  machine('studio-m5ultra-512', 'Mac Studio · M5 Ultra', 'mac', 'unified', 512, 0, 1200, 22299, 'Reported 2026 price (1 TB SSD); verify with Apple', ['https://www.apple.com/mac-studio/specs/'], { tier: 'High capacity', detail: '512 GiB unified · 80-core GPU · 1 TB SSD', availability: 'Reported late-October 2026 availability' }),
  machine('studio-m5ultra-256', 'Mac Studio · M5 Ultra', 'mac', 'unified', 256, 0, 1200, 10800, 'Illustrative estimate; verify with Apple', ['https://www.apple.com/mac-studio/specs/'], { tier: 'High capacity', detail: '256 GiB unified · 80-core GPU · 1 TB SSD', availability: 'On sale since September 2026; price is an estimate' }),
  machine('studio-m5ultra-96', 'Mac Studio · M5 Ultra', 'mac', 'unified', 96, 0, 1200, 5499, 'Reported 2026 starting price; verify with Apple', ['https://www.apple.com/mac-studio/specs/'], { tier: 'High capacity', detail: '96 GiB unified · 64-core GPU · 1 TB SSD', availability: 'On sale since September 2026' }),
  machine('spark-128', 'NVIDIA DGX Spark', 'spark', 'unified', 128, 0, 273, 4699, 'Announced MSRP (Feb 2026); verify current price', [spark, 'https://forums.developer.nvidia.com/t/2-23-2026-price-change-announcement/361713'], { tier: 'AI workstation', detail: 'GB10 · 128 GiB unified · 4 TB SSD', setupUrl: 'https://build.nvidia.com/spark/llama-cpp/overview', note: 'Use the NVIDIA ARM64 / GB10 build instructions. Unified memory is shared with the OS.' }),
  machine('rtx5090', 'GeForce RTX 5090 desktop', 'cuda', 'dedicated', 64, 32, 1792, 3500, 'Illustrative complete-system budget', [gpu('50-series/rtx-5090')], { tier: 'High throughput', detail: '32 GiB VRAM · 64 GiB host RAM', priceBreakdown: '$2,000 GPU allowance + $1,500 host allowance', note: 'Planning allowances, not current component quotes. Use a recent CUDA build with Blackwell support.' }),
  machine('ryzen-128', 'Ryzen AI Max+ 395 PC', 'vulkan', 'unified', 128, 0, null, 2500, 'Illustrative complete-system budget', ['https://www.amd.com/en/blogs/2025/amd-ryzen-ai-max-395-processor-breakthrough-ai-.html'], { tier: 'Integrated GPU', detail: '128 GiB shared RAM · Radeon 8060S', executionLimitBytes: 96 * GiB, note: 'Conservatively cap GPU execution at the documented 96 GiB graphics allocation; driver/BIOS setup is required.' }),
  machine('mini-m5pro-64', 'Mac mini · M5 Pro', 'mac', 'unified', 64, 0, 307, 2500, 'Illustrative planning budget', ['https://www.apple.com/mac-mini/specs/'], { tier: 'Compact desktop', detail: '64 GiB unified · 20-core GPU option · 512 GB SSD', availability: 'New 2026 model; configuration price is an estimate, verify with Apple' }),
  machine('mini-m5pro-24', 'Mac mini · M5 Pro', 'mac', 'unified', 24, 0, 307, 1699, 'Reported 2026 starting price; verify with Apple', ['https://www.apple.com/mac-mini/specs/'], { tier: 'Compact desktop', detail: '24 GiB unified · 16-core GPU · 512 GB SSD', availability: 'New 2026 model' }),
  machine('mini-m6-32', 'Mac mini · M6', 'mac', 'unified', 32, 0, 170, 1299, 'Illustrative planning budget', ['https://www.apple.com/mac-mini/specs/'], { tier: 'Everyday local AI', detail: '32 GiB unified · 12-core GPU · 512 GB SSD', availability: 'New 2026 model; configuration price is an estimate, verify with Apple' }),
  machine('mini-m6-16', 'Mac mini · M6', 'mac', 'unified', 16, 0, 153, 899, 'Reported 2026 starting price; verify with Apple', ['https://www.apple.com/mac-mini/specs/'], { tier: 'Entry Apple silicon', detail: '16 GiB unified · 12-core GPU · 256 GB SSD', availability: 'New 2026 base model' }),
  machine('mini-pro-48', 'Mac mini · M4 Pro', 'mac', 'unified', 48, 0, 273, 2000, 'Illustrative planning budget', [appleMini], { tier: 'Compact desktop', detail: '48 GiB unified · 512 GB SSD', availability: 'Documented configuration; verify ordering availability' }),
  machine('rtx5070ti', 'GeForce RTX 5070 Ti desktop', 'cuda', 'dedicated', 32, 16, 896, 1800, 'Illustrative complete-system budget', [gpu('50-series/rtx-5070-family')], { tier: 'High-value GPU', detail: '16 GiB VRAM · 32 GiB host RAM', priceBreakdown: '$750 GPU allowance (launch MSRP) + $1,050 host allowance', note: 'Planning allowances, not current component quotes. Use a recent CUDA build with Blackwell support.' }),
  machine('rtx4060ti', 'GeForce RTX 4060 Ti desktop', 'cuda', 'dedicated', 32, 16, 288, 1100, 'Illustrative complete-system budget', [gpu('40-series/rtx-4060-4060ti')], { tier: 'Midrange GPU', detail: '16 GiB VRAM · 32 GiB host RAM', priceBreakdown: '$450 GPU allowance + $650 host allowance' }),
  machine('mini-24', 'Mac mini · M4', 'mac', 'unified', 24, 0, 120, 800, 'Illustrative planning budget', [appleMini], { tier: 'Everyday local AI', detail: '24 GiB unified · 256 GB SSD' }),
  machine('air-m4-32', 'MacBook Air · M4', 'mac', 'unified', 32, 0, 120, 1300, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/122209'], { tier: 'Laptop', detail: '2025 · 13-inch · 32 GiB unified', condition: 'used', availability: 'Historical configuration; check used/refurbished stock', note: 'Fanless laptop: sustained workloads may throttle. Bandwidth is a theoretical ceiling, not measured generation speed.' }),
  machine('air-m5-32', 'MacBook Air · M5', 'mac', 'unified', 32, 0, 153, 1700, 'Illustrative complete-laptop budget', ['https://support.apple.com/en-us/126321'], { tier: 'Laptop', detail: '2026 · 15-inch · 32 GiB unified', condition: 'new', availability: 'Reference configuration; verify ordering availability', note: 'Fanless laptop: sustained workloads may throttle. Bandwidth is a theoretical ceiling, not measured generation speed.' }),
  machine('book-m3-pro-36', 'MacBook Pro · M3 Pro', 'mac', 'unified', 36, 0, 150, 1700, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/117737'], { tier: 'Laptop', detail: '2023 · 16-inch · 18-core GPU · 36 GiB unified', condition: 'used', availability: 'Historical configuration; check used/refurbished stock' }),
  machine('book-m4-pro-48', 'MacBook Pro · M4 Pro', 'mac', 'unified', 48, 0, 273, 2400, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/121554'], { tier: 'Laptop', detail: '2024 · 16-inch · 20-core GPU · 48 GiB unified', condition: 'used', availability: 'Historical configuration; check used/refurbished stock' }),
  machine('book-m5-pro-64', 'MacBook Pro · M5 Pro', 'mac', 'unified', 64, 0, 307, 3500, 'Illustrative complete-laptop budget', ['https://support.apple.com/en-us/126318'], { tier: 'Laptop', detail: '2026 · 14-inch · 20-core GPU · 64 GiB unified', condition: 'new', availability: 'Reference configuration; verify ordering availability' }),
  machine('book-m2-max-96', 'MacBook Pro · M2 Max', 'mac', 'unified', 96, 0, 400, 2200, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/111838'], { tier: 'Laptop', detail: '2023 · 16-inch · 38-core GPU · 96 GiB unified', condition: 'used', availability: 'Historical configuration; check used/refurbished stock' }),
  machine('book-m3-max-128', 'MacBook Pro · M3 Max', 'mac', 'unified', 128, 0, 400, 3200, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/117737'], { tier: 'Laptop', detail: '2023 · 16-inch · 40-core GPU · 128 GiB unified', condition: 'used', availability: 'Historical configuration; check used/refurbished stock' }),
  machine('book-m4-max-128', 'MacBook Pro · M4 Max', 'mac', 'unified', 128, 0, 546, 4000, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/121554'], { tier: 'Laptop', detail: '2024 · 16-inch · 40-core GPU · 128 GiB unified', condition: 'used', availability: 'Historical configuration; check used/refurbished stock' }),
  machine('book-m5-max-128', 'MacBook Pro · M5 Max', 'mac', 'unified', 128, 0, 614, 5500, 'Illustrative complete-laptop budget', ['https://support.apple.com/en-us/126318'], { tier: 'Laptop', detail: '2026 · 14-inch · 40-core GPU · 128 GiB unified', condition: 'new', availability: 'Reference configuration; verify ordering availability' }),
  machine('intel-16-64', 'MacBook Pro · Intel Core i9', 'mac-intel', 'cpu', 64, 0, null, 650, 'Illustrative used-laptop budget', ['https://support.apple.com/en-us/111932'], { tier: 'Intel laptop · CPU', detail: '2019 · 16-inch · Radeon Pro 5500M 8 GiB · 64 GiB RAM', condition: 'used', availability: 'Historical configuration; used market only', note: 'Conservative CPU-only estimate. Build llama.cpp for Intel macOS with Metal disabled (-DGGML_METAL=OFF) and run with -ngl 0. Integrated graphics and any separate Radeon VRAM are excluded. GPU acceleration requires separate validation; MLX-LM and Apple-silicon-only apps do not apply. Check macOS and build-tool requirements before buying.' }),
  machine('cpu-16', '16 GiB CPU-only PC', 'cpu', 'cpu', 16, 0, null, 250, 'Illustrative used-system budget', ['https://github.com/ggml-org/llama.cpp'], { tier: 'Start small', condition: 'used', detail: 'Generic x64 AVX2 CPU · no GPU', availability: 'Generic planning configuration', note: 'CPU generation speed depends on the processor and memory channels; no throughput estimate is available.' }),
];

// Cache layer groups (see calculator.js). Gemma 4 global layers share K and V, but both are counted to stay conservative.
const gqa = (layers, kvHeads, headDim, window) => ({ layers, perToken: 2 * kvHeads * headDim, ...(window ? { window } : {}) });
const mla = (layers, rank, rope) => ({ layers, perToken: rank + rope });
// Gated DeltaNet layers: FP32 recurrent state (value heads × key dim × value dim) plus the short-convolution state.
const deltaNet = (layers, keyHeads, valueHeads, kernel = 4, dim = 128) => layers * (valueHeads * dim * dim + (kernel - 1) * (2 * keyHeads + valueHeads) * dim) * 4;

function model(id, repo, parameters, cache, maxContext, q4GB, q8GB, extra = {}) {
  const { org = 'Qwen', gguf, ...rest } = extra;
  const modelUrl = `https://huggingface.co/${org}/${repo}`;
  const artifactUrl = gguf ?? `${modelUrl}-GGUF`;
  // Sizes are summed GGUF file bytes; a null size falls back to the nominal-bit estimate in calculator.js.
  const weight = (gb, quant) => ({ bytes: gb == null ? null : Math.round(gb * 1e9), source: artifactUrl, quant });
  return { id, name: repo, parameters: parameters * 1e9, cache, maxContext, modelUrl, artifactUrl,
    sources: [`${modelUrl}/blob/main/config.json`, artifactUrl], verifiedAt, runtimeIds: ['llama', 'lmstudio', 'ollama'],
    weightsByBits: { 4: weight(q4GB, 'Q4_K_M'), 8: weight(q8GB, 'Q8_0') }, ...rest };
}

const lms = repo => `https://huggingface.co/lmstudio-community/${repo}-GGUF`;
const unsloth = repo => `https://huggingface.co/unsloth/${repo}-GGUF`;
const bartowski = repo => `https://huggingface.co/bartowski/${repo}-GGUF`;
const K = 1024;

// maxContext is the longest documented length; nativeContext marks models that reach it only with YaRN rope scaling.
// Parameter counts are Hugging Face safetensors totals, so they include vision and multi-token-prediction weights.
export const models = [
  model('gemma4-26b', 'gemma-4-26B-A4B-it', 25.81, [gqa(25, 8, 256, 1024), gqa(5, 2, 512)], 256 * K, 16.947541728, 27.321628544, { org: 'google', name: 'Gemma 4 26B-A4B', gguf: unsloth('gemma-4-26B-A4B-it'), activeParameters: 4e9, purpose: 'Fast multimodal MoE', license: 'Apache 2.0' }),
  model('qwen38-27b', 'Qwen3.8-27B', 27.78, [gqa(16, 4, 256)], 1_000_000, 16.810714336, 29.047084256, { nativeContext: 256 * K, gguf: lms('Qwen3.8-27B'), stateBytes: deltaNet(48, 16, 48), purpose: 'Latest dense Qwen', license: 'Apache 2.0' }),
  model('gemma4-31b', 'gemma-4-31B-it', 31.27, [gqa(50, 16, 256, 1024), gqa(10, 4, 512)], 256 * K, 18.32373344, 33.150364736, { org: 'google', name: 'Gemma 4 31B', gguf: unsloth('gemma-4-31B-it'), purpose: 'Largest dense Gemma', license: 'Apache 2.0' }),
  model('mistral-medium-35', 'Mistral-Medium-3.5-128B', 127.7, [gqa(88, 8, 128)], 256 * K, 78.409343008, 132.85442384, { org: 'mistralai', name: 'Mistral Medium 3.5 128B', gguf: bartowski('mistralai_Mistral-Medium-3.5-128B'), purpose: 'Large dense model', license: 'Modified MIT — revenue limits apply' }),
  // 125B core + 51B n-gram embedding + 4B MTP, 6B active (model card).
  model('qwen38-flash-next', 'Qwen3.8-Flash-Next', 180, [gqa(12, 2, 256)], 1_000_000, 119.15072224, 188.224949792, { nativeContext: 256 * K, gguf: lms('Qwen3.8-Flash-Next'), stateBytes: deltaNet(36, 16, 48), activeParameters: 6e9, purpose: 'Sparse hybrid MoE', license: 'Qwen Community License — check use terms' }),
  // Sparse attention keeps a 4-head x 128-dim indexer key per token on all 60 layers (counted in full); 4B+ MTP and vision weights included in parameters.
  model('minimax-m31-flash', 'MiniMax-M3.1-Flash', 220.49, [gqa(60, 4, 128), { layers: 60, perToken: 512 }], 1024 * K, 249.4, 259.08, { org: 'MiniMaxAI', gguf: unsloth('MiniMax-M3.1-Flash'), purpose: 'Fast multimodal agent MoE', license: 'MiniMax Community License — check use terms' }),
  model('qwen35-397b', 'Qwen3.5-397B-A17B', 403.4, [gqa(15, 2, 256)], 1_010_000, 240.590681792, 421.507365024, { nativeContext: 256 * K, gguf: lms('Qwen3.5-397B-A17B'), stateBytes: deltaNet(45, 16, 64), activeParameters: 17e9, purpose: 'Flagship open Qwen', license: 'Apache 2.0' }),
  model('minimax-m3', 'MiniMax-M3', 427.04, [gqa(60, 4, 128), { layers: 60, perToken: 512 }], 1024 * K, 261.28, 453.61, { org: 'MiniMaxAI', gguf: bartowski('MiniMax-M3'), purpose: 'Flagship multimodal agent MoE', license: 'MiniMax Community License — check use terms' }),
  // DeepSeek sparse attention adds a 128-dim indexer key per token on top of the MLA latent.
  model('dsv32', 'DeepSeek-V3.2', 685.4, [mla(61, 512, 64), { layers: 61, perToken: 128 }], 160 * K, 405.39802432, 713.286531616, { org: 'deepseek-ai', gguf: unsloth('DeepSeek-V3.2'), activeParameters: 37e9, purpose: 'Sparse-attention MoE', license: 'MIT' }),
  // No Q4_K_M GGUF is published; 4-bit uses the nominal estimate. 40B active is the GLM-5 family figure.
  model('glm53', 'GLM-5.3', 753.3, [mla(78, 512, 64), { layers: 21, perToken: 128 }], 1024 * K, null, 801.357677216, { org: 'zai-org', gguf: unsloth('GLM-5.3'), activeParameters: 40e9, purpose: 'Frontier coding MoE', license: 'GLM-5.3 license — check use terms' }),
  model('kimi-k2-thinking', 'Kimi-K2-Thinking', 1026.4, [mla(61, 512, 64)], 256 * K, 624.017304704, 1091.053888384, { org: 'moonshotai', gguf: bartowski('moonshotai_Kimi-K2-Thinking'), activeParameters: 32e9, purpose: 'Trillion-parameter MoE', license: 'Modified MIT — check use terms' }),
];

export const benchmarks = [];
