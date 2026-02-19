/**
 * AI PROVIDER ABSTRACTION
 * 
 * Dynamically selects the AI provider based on environment configuration.
 * Allows seamless switching between Anthropic and OpenAI.
 */

import { ItemMetadata } from './schema';
import * as anthropicClient from './anthropic';
import * as openaiClient from './openai-manual';
import * as googleClient from './google';

// Supported Providers
type AIProvider = 'anthropic' | 'openai' | 'google';

// Configuration
const PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) || 'google'; // Defaulting to Google now

console.log(`[AI] Using Provider: ${PROVIDER}`);

export async function analyzeImage(imagePath: string, ocrText: string): Promise<ItemMetadata> {
  switch (PROVIDER) {
    case 'anthropic':
      return anthropicClient.analyzeImage(imagePath, ocrText);
    case 'openai':
      return openaiClient.analyzeImage(imagePath, ocrText);
    case 'google':
      return googleClient.analyzeImage(imagePath, ocrText);
    default:
      throw new Error(`Unsupported AI Provider: ${PROVIDER}`);
  }
}
