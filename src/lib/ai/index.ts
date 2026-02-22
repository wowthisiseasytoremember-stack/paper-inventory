/**
 * AI PROVIDER ABSTRACTION
 * 
 * Dynamically selects the AI provider based on environment configuration.
 * Allows seamless switching between Anthropic and OpenAI.
 */

import { ItemMetadata } from './schema';
import * as openaiClient from './openai-manual';

export async function analyzeImage(imagePath: string, ocrText: string): Promise<ItemMetadata> {
  console.log(`[AI] Using OpenAI GPT-4o for analysis`);
  return openaiClient.analyzeImage(imagePath, ocrText);
}

