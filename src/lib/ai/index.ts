/**
 * AI PROVIDER ABSTRACTION
 *
 * Centralized selection based on config.
 * Provider implementations live in their own modules.
 */

import { ItemMetadata } from './schema';
import * as openaiClient from './openai-manual';
import { getAIConfig } from './config';

export async function analyzeImage(imagePath: string, ocrText: string, onRouteComplete?: (route: any) => void): Promise<ItemMetadata> {
  const config = getAIConfig();
  switch (config.provider) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
      return openaiClient.analyzeImage(imagePath, ocrText, config, onRouteComplete);
    default:
      throw new Error(`AI_PROVIDER_UNSUPPORTED: ${config.provider}`);
  }
}

