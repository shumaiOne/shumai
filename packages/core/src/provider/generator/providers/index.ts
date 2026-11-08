// Every built-in provider catalog. Add new providers here.

import type { ProviderDefinition } from '../define'
import amazonBedrock from './amazon-bedrock'
import antLing from './ant-ling'
import anthropic from './anthropic'
import azure from './azure'
import baseten from './baseten'
import cerebras from './cerebras'
import cloudflareAiGateway from './cloudflare-ai-gateway'
import cloudflareWorkersAi from './cloudflare-workers-ai'
import deepseek from './deepseek'
import fireworks from './fireworks'
import githubCopilot from './github-copilot'
import google from './google'
import googleVertex from './google-vertex'
import groq from './groq'
import huggingface from './huggingface'
import kimiCoding from './kimi-coding'
import meta from './meta'
import minimax from './minimax'
import minimaxCn from './minimax-cn'
import mistral from './mistral'
import moonshotai from './moonshotai'
import moonshotaiCn from './moonshotai-cn'
import nvidia from './nvidia'
import openai from './openai'
import openaiCodex from './openai-codex'
import opencode from './opencode'
import opencodeGo from './opencode-go'
import openrouter from './openrouter'
import qwenTokenPlan from './qwen-token-plan'
import qwenTokenPlanCn from './qwen-token-plan-cn'
import qwenTokenPlanIndividual from './qwen-token-plan-individual'
import qwenTokenPlanIndividualCn from './qwen-token-plan-individual-cn'
import together from './together'
import vercelAiGateway from './vercel-ai-gateway'
import xai from './xai'
import xiaomi from './xiaomi'
import xiaomiTokenPlanAms from './xiaomi-token-plan-ams'
import xiaomiTokenPlanCn from './xiaomi-token-plan-cn'
import xiaomiTokenPlanSgp from './xiaomi-token-plan-sgp'
import zai from './zai'
import zaiCodingCn from './zai-coding-cn'

export const PROVIDERS: readonly ProviderDefinition[] = [
  amazonBedrock,
  antLing,
  anthropic,
  azure,
  baseten,
  cerebras,
  cloudflareAiGateway,
  cloudflareWorkersAi,
  deepseek,
  fireworks,
  githubCopilot,
  googleVertex,
  google,
  groq,
  huggingface,
  kimiCoding,
  meta,
  minimaxCn,
  minimax,
  mistral,
  moonshotaiCn,
  moonshotai,
  nvidia,
  openaiCodex,
  openai,
  opencodeGo,
  opencode,
  openrouter,
  qwenTokenPlanCn,
  qwenTokenPlanIndividual,
  qwenTokenPlanIndividualCn,
  qwenTokenPlan,
  together,
  vercelAiGateway,
  xai,
  xiaomiTokenPlanAms,
  xiaomiTokenPlanCn,
  xiaomiTokenPlanSgp,
  xiaomi,
  zaiCodingCn,
  zai,
]
