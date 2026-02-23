/**
 * ANTHROPIC CLIENT (Manual Fetch)
 *
 * Uses raw fetch to call Claude. Same pattern as openai-manual.ts.
 */

import fs from 'fs';
import path from 'path';
import { ItemMetadata, ItemMetadataSchema } from './schema';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return map[ext] || 'image/png';
}

export async function callAnthropic(
  systemPrompt: string,
  imagePath: string,
  userText: string,
  model?: string
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const modelName = model || 'claude-sonnet-4-20250514';

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`[AI-Anthropic] Calling ${modelName} (Attempt ${attempt + 1}/${MAX_RETRIES + 1})`);

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: userText },
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType, data: base64Image }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      console.log('[AI-Anthropic] Analysis Successful.');
      return parsed;

    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(`ANTHROPIC_FAILED: Max retries exceeded. Last error: ${error.message}`);
      }
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI-Anthropic] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('ANTHROPIC_FAILED: Unknown error');
}

export async function analyzeImageAnthropic(
  imagePath: string,
  ocrText: string,
  systemPrompt: string,
  model?: string
): Promise<ItemMetadata> {
  const userText = ocrText
    ? `OCR Hint (may contain errors):\n${ocrText.substring(0, 5000)}`
    : 'No OCR text available. Rely on visual analysis.';

  const raw = await callAnthropic(systemPrompt, imagePath, userText, model);
  return ItemMetadataSchema.parse(raw);
}
