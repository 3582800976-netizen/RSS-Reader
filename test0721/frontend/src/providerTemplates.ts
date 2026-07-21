/**
 * OpenAI-compatible vendor presets.
 * Selecting a vendor auto-fills display name + Base URL (+ optional default model).
 * Users still paste their own API Key and may override model / URL.
 */

export type LlmVendorTemplate = {
  id: string;
  label: string;
  /** Prefilled Provider display name */
  name: string;
  base_url: string;
  /** Suggested default model id (user can change) */
  default_model?: string;
  /** Short hint shown under the form */
  hint?: string;
};

/** id === "custom" means keep manual Base URL */
export const CUSTOM_VENDOR_ID = "custom";

export const LLM_VENDOR_TEMPLATES: LlmVendorTemplate[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    name: "DeepSeek",
    base_url: "https://api.deepseek.com",
    default_model: "deepseek-chat",
    hint: "国内常用；也可用 deepseek-reasoner",
  },
  {
    id: "openai",
    label: "OpenAI",
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    default_model: "gpt-4o-mini",
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI（需改资源名）",
    name: "Azure OpenAI",
    base_url: "https://YOUR_RESOURCE.openai.azure.com",
    default_model: "gpt-4o-mini",
    hint: "请把 YOUR_RESOURCE 换成你的 Azure 资源名",
  },
  {
    id: "moonshot",
    label: "Moonshot / Kimi",
    name: "Moonshot",
    base_url: "https://api.moonshot.cn/v1",
    default_model: "moonshot-v1-8k",
  },
  {
    id: "qwen-dashscope",
    label: "通义千问 / 阿里云 DashScope",
    name: "Qwen DashScope",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    default_model: "qwen-turbo",
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    name: "智谱 GLM",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    default_model: "glm-4-flash",
  },
  {
    id: "baichuan",
    label: "百川 Baichuan",
    name: "Baichuan",
    base_url: "https://api.baichuan-ai.com/v1",
    default_model: "Baichuan4-Turbo",
  },
  {
    id: "minimax",
    label: "MiniMax",
    name: "MiniMax",
    base_url: "https://api.minimax.chat/v1",
    default_model: "MiniMax-Text-01",
  },
  {
    id: "stepfun",
    label: "阶跃星辰 StepFun",
    name: "StepFun",
    base_url: "https://api.stepfun.com/v1",
    default_model: "step-1-8k",
  },
  {
    id: "yi",
    label: "零一万物 Yi",
    name: "Yi",
    base_url: "https://api.lingyiwanwu.com/v1",
    default_model: "yi-lightning",
  },
  {
    id: "siliconflow",
    label: "硅基流动 SiliconFlow",
    name: "SiliconFlow",
    base_url: "https://api.siliconflow.cn/v1",
    default_model: "deepseek-ai/DeepSeek-V3",
  },
  {
    id: "doubao",
    label: "火山方舟 / 豆包（需改端点）",
    name: "Doubao Ark",
    base_url: "https://ark.cn-beijing.volces.com/api/v3",
    default_model: "doubao-pro-32k",
    hint: "模型名常为接入点 ID，以控制台为准",
  },
  {
    id: "hunyuan",
    label: "腾讯混元",
    name: "Hunyuan",
    base_url: "https://api.hunyuan.cloud.tencent.com/v1",
    default_model: "hunyuan-turbo",
  },
  {
    id: "spark",
    label: "讯飞星火（OpenAI 兼容网关）",
    name: "Spark",
    base_url: "https://spark-api-open.xf-yun.com/v1",
    default_model: "generalv3.5",
  },
  {
    id: "sensenova",
    label: "商汤日日新 SenseNova",
    name: "SenseNova",
    base_url: "https://api.sensenova.cn/compatible-mode/v1",
    default_model: "SenseChat-5",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    name: "Mistral",
    base_url: "https://api.mistral.ai/v1",
    default_model: "mistral-small-latest",
  },
  {
    id: "groq",
    label: "Groq",
    name: "Groq",
    base_url: "https://api.groq.com/openai/v1",
    default_model: "llama-3.3-70b-versatile",
  },
  {
    id: "together",
    label: "Together AI",
    name: "Together",
    base_url: "https://api.together.xyz/v1",
    default_model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    name: "Fireworks",
    base_url: "https://api.fireworks.ai/inference/v1",
    default_model: "accounts/fireworks/models/llama-v3p1-8b-instruct",
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    name: "DeepInfra",
    base_url: "https://api.deepinfra.com/v1/openai",
    default_model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    name: "OpenRouter",
    base_url: "https://openrouter.ai/api/v1",
    default_model: "openai/gpt-4o-mini",
    hint: "统一网关，模型名形如 vendor/model",
  },
  {
    id: "xai",
    label: "xAI Grok",
    name: "xAI",
    base_url: "https://api.x.ai/v1",
    default_model: "grok-2-latest",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    name: "Perplexity",
    base_url: "https://api.perplexity.ai",
    default_model: "sonar",
  },
  {
    id: "github-models",
    label: "GitHub Models",
    name: "GitHub Models",
    base_url: "https://models.inference.ai.azure.com",
    default_model: "gpt-4o-mini",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    name: "NVIDIA NIM",
    base_url: "https://integrate.api.nvidia.com/v1",
    default_model: "meta/llama-3.1-8b-instruct",
  },
  {
    id: "ollama",
    label: "Ollama（本地）",
    name: "Ollama",
    base_url: "http://127.0.0.1:11434/v1",
    default_model: "llama3.2",
    hint: "本地服务，API Key 可随意填写",
  },
  {
    id: "lmstudio",
    label: "LM Studio（本地）",
    name: "LM Studio",
    base_url: "http://127.0.0.1:1234/v1",
    default_model: "local-model",
    hint: "以 LM Studio 里实际模型名为准",
  },
  {
    id: "vllm",
    label: "vLLM / 自建（本地）",
    name: "vLLM",
    base_url: "http://127.0.0.1:8000/v1",
    default_model: "default",
    hint: "按你的部署端口与模型名修改",
  },
];

export function findVendorTemplate(id: string): LlmVendorTemplate | undefined {
  return LLM_VENDOR_TEMPLATES.find((t) => t.id === id);
}
