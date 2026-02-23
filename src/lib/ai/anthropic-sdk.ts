/**
 * ANTHROPIC CLIENT (Official SDK)
 *
 * Uses the official `@anthropic-ai/sdk` package.
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { ItemMetadata, ItemMetadataSchema } from './schema';

const MAX_RETRIES = 3;

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
  const anthropic = new Anthropic();
  
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const modelName = model || 'claude-3-5-sonnet-20240620';

  console.log(`[AI-Anthropic-SDK] Calling ${modelName}...`);

  const response = await anthropic.messages.create({
    model: modelName,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: userText },
        {
          type: 'image',
          source: { 
            type: 'base64', 
            media_type: mimeType, 
            data: base64Image 
          }
        }
      ]
    }]
  });

  const textBlock = response.content.find(c => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text returned from Anthropic');
  }

  const text = textBlock.text;
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  console.log('[AI-Anthropic-SDK] Analysis Successful.');
  return parsed;
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
