/**
 * ANTHROPIC AI CLIENT (Claude 3.5 Sonnet)
 * 
 * Handles interaction with Anthropic API for image analysis.
 * Uses Vercel AI SDK 'generateObject' for structured JSON output.
 * Implements exponential backoff retry logic (Circuit Breaker).
 */

import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { ItemMetadataSchema, ItemMetadata } from './schema';
import fs from 'fs';
import { BASELINE_SYSTEM_PROMPT } from './prompts';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export async function analyzeImage(
  imagePath: string, 
  ocrText: string
): Promise<ItemMetadata> {
  const imageBuffer = fs.readFileSync(imagePath);
  
  // Exponential Backoff Loop
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const modelName = process.env.BASELINE_MODEL || 'claude-3-5-sonnet-20240620';
      console.log(`[AI] Analyzing image with ${modelName} (Attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
      
      const apiCall = generateObject({
        model: anthropic(modelName),
        schema: ItemMetadataSchema,
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `${BASELINE_SYSTEM_PROMPT}
                
OCR HINT:
${ocrText.substring(0, 5000)}` 
              },
              { 
                type: 'image', 
                image: imageBuffer
              }
            ],
          },
        ],
        temperature: 0, // Deterministic
      });

      // 60-second hard timeout for the AI call
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('AI Context Timeout (60s)')), 60000)
      );

      const result = await Promise.race([apiCall, timeoutPromise]);

      console.log('[AI] Analysis Successful.');
      return result.object;

    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(`AI_ANALYSIS_FAILED: Max retries exceeded. Last error: ${error.message}`);
      }
      
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('AI_ANALYSIS_FAILED: Unknown error');
}
