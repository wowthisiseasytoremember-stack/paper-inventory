/**
 * AI CONFIGURATION
 *
 * Centralized config for swappable AI providers and model settings.
 */

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  fallbackProvider: AIProvider | null;
  routerModel: string;
  baselineModel: string;
  deepDiveModel: string;
  routerTemperature: number;
  baselineTemperature: number;
  deepDiveTemperature: number;
  routerOcrChars: number;
  maxOcrChars: number;
}

const DEFAULT_CONFIG: AIConfig = {
  provider: 'anthropic', // Switched to Anthropic as primary
  fallbackProvider: 'openai',
  routerModel: 'claude-3-haiku-20240307',
  baselineModel: 'claude-3-haiku-20240307',
  deepDiveModel: 'claude-3-haiku-20240307',
  routerTemperature: 0,
  baselineTemperature: 0,
  deepDiveTemperature: 0.2,
  routerOcrChars: 1000,
  maxOcrChars: 5000
};

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getAIConfig(): AIConfig {
  return {
    provider: (process.env.AI_PROVIDER as AIProvider) || DEFAULT_CONFIG.provider,
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER as AIProvider) || DEFAULT_CONFIG.fallbackProvider,
    routerModel: process.env.ROUTER_MODEL || DEFAULT_CONFIG.routerModel,
    baselineModel: process.env.BASELINE_MODEL || DEFAULT_CONFIG.baselineModel,
    deepDiveModel: process.env.DEEP_DIVE_MODEL || DEFAULT_CONFIG.deepDiveModel,
    routerTemperature: parseNumber(process.env.ROUTER_TEMPERATURE, DEFAULT_CONFIG.routerTemperature),
    baselineTemperature: parseNumber(process.env.BASELINE_TEMPERATURE, DEFAULT_CONFIG.baselineTemperature),
    deepDiveTemperature: parseNumber(process.env.DEEP_DIVE_TEMPERATURE, DEFAULT_CONFIG.deepDiveTemperature),
    routerOcrChars: parseNumber(process.env.ROUTER_OCR_CHARS, DEFAULT_CONFIG.routerOcrChars),
    maxOcrChars: parseNumber(process.env.AI_MAX_OCR_CHARS, DEFAULT_CONFIG.maxOcrChars)
  };
}
