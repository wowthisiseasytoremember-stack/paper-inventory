/**
 * OPENAI CLIENT (Official SDK)
 *
 * Uses the official `openai` package and structured outputs.
 */

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ItemMetadata, ItemMetadataSchema } from './schema';
import { getPrompt, CONDUCTOR_PROMPT_FILE } from './prompts';

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

export async function analyzeImage(
  imagePath: string,
  ocrText: string
): Promise<ItemMetadata> {
  const openai = new OpenAI();
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);
  const modelName = process.env.BASELINE_MODEL || 'gpt-4o';

  console.log(`[AI-OpenAI-SDK] Analyzing image with ${modelName}`);

  const response = await openai.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: getPrompt(CONDUCTOR_PROMPT_FILE) + '\nEnsure your response is valid JSON matching the exact schema requested.' },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: ocrText ? `OCR Hint (may contain errors):\n${ocrText.substring(0, 5000)}` : 'No OCR text available. Rely on visual analysis.'
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      }
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('Failed to get output from OpenAI');
  }

  return JSON.parse(content) as ItemMetadata;
}

export interface DeepDiveResult {
  title: string;
  historicalContext: string;
  collectorSignificance: string;
  valuation: string;
  verificationQuestions?: string[];
  identifiedNames: Array<{
    name: string;
    type: string;
    confidence: number;
    historicalNote?: string;
  }>;
  tags: string[];
}

export async function enrichDeepDiveRaw(
  imagePath: string,
  systemPrompt: string,
  userText: string,
  model?: string
): Promise<DeepDiveResult> {
  const openai = new OpenAI();
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);
  const modelName = model || process.env.DEEP_DIVE_MODEL || 'gpt-4o';

  console.log(`[AI-OpenAI-SDK] Deep dive raw with ${modelName}`);

  const response = await openai.chat.completions.create({
    model: modelName,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }
    ],
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Empty response from OpenAI');

  return JSON.parse(content) as DeepDiveResult;
}
