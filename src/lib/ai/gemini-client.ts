import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { ItemMetadataSchema, ItemMetadata } from './schema';
import { BASELINE_SYSTEM_PROMPT } from './prompts';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.tiff': 'image/tiff', '.tif': 'image/tiff',
  };
  return map[ext] || 'image/png';
}

function getModel(modelName?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName || 'gemini-2.0-flash',
    systemInstruction: BASELINE_SYSTEM_PROMPT,
  });
}

export interface AIResult {
  rawResponse: string;
  parsedData: ItemMetadata;
  durationMs: number;
}

export async function analyzeItem(rawOcrText: string, imagePath?: string, modelName?: string): Promise<AIResult> {
  const start = Date.now();
  const model = getModel(modelName);

  if (!model) {
    console.log('[AI-Gemini] Running in MOCK mode (no GEMINI_API_KEY)...');
    const mock: ItemMetadata = {
      title: 'Unidentified Document (Mock)',
      guessedId: '',
      cleanedTranscription: rawOcrText.slice(0, 100),
      confidence: 0.1,
      identifiedNames: [],
      historicalContext: '',
      collectorSignificance: '',
      valuation: '',
      tags: ['mock'],
    };
    return { rawResponse: JSON.stringify(mock), parsedData: mock, durationMs: Date.now() - start };
  }

  const parts: any[] = [
    { text: rawOcrText ? `OCR Hint (may contain errors):\n${rawOcrText.substring(0, 5000)}` : 'No OCR text available. Rely on visual analysis.' }
  ];

  if (imagePath && fs.existsSync(imagePath)) {
    const buffer = fs.readFileSync(imagePath);
    parts.push({
      inline_data: {
        mime_type: getMimeType(imagePath),
        data: buffer.toString('base64')
      }
    });
  }

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
  });

  const text = result.response.text();
  const raw = JSON.parse(text);
  const parsed = ItemMetadataSchema.parse(raw);

  return { rawResponse: text, parsedData: parsed, durationMs: Date.now() - start };
}
