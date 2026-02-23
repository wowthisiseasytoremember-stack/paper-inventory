/**
 * OPENAI CLIENT (Manual Fetch)
 * 
 * Bypasses Vercel AI SDK to prevent native module crashes on Windows.
 * Uses native fetch to call GPT-4o with JSON mode.
 */

import fs from 'fs';
import path from 'path';
import { ItemMetadata, ItemMetadataSchema } from './schema';
import { BASELINE_SYSTEM_PROMPT } from './prompts';
import { getGroundedResearch } from './gemini-grounding';
import { categorizeForDeepDive } from './gemini-triage';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const NORMALIZER_MODEL = 'gpt-4o-mini';

/**
 * Detects mime type from file extension.
 */
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

/**
 * NORMALIZER: Takes raw/messy AI output and forces it into the Zod schema.
 * Uses gpt-4o-mini for speed and cost.
 */
async function normalizeToSchema(rawJson: any, apiKey: string): Promise<ItemMetadata> {
  // First, try direct Zod parse — if the model got it right, skip the normalizer
  const directParse = ItemMetadataSchema.safeParse(rawJson);
  if (directParse.success) {
    console.log('[Normalizer] Direct parse succeeded, skipping normalizer call.');
    return directParse.data;
  }

  console.warn('[Normalizer] Direct parse failed, running gpt-4o-mini normalizer...', directParse.error.issues.map(i => `${i.path}: ${i.message}`));

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: NORMALIZER_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Convert this JSON into the exact schema below. Fix field names and types. Do not invent data.

{"title":"string","guessedId":"string","cleanedTranscription":"string","confidence":0.5,"tags":["string"]}

Map variants: "transcription"→"cleanedTranscription", "id"/"number"/"identifier"→"guessedId".
Missing fields: empty string or empty array. Missing confidence: 0.5.
Any extra fields (identifiedNames, historicalContext, valuation, etc.) — drop them.`
        },
        {
          role: 'user',
          content: JSON.stringify(rawJson)
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Normalizer HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const normalized = JSON.parse(data.choices[0].message.content);

  // Validate with Zod — if this still fails, we have a real problem
  const result = ItemMetadataSchema.safeParse(normalized);
  if (!result.success) {
    console.error('[Normalizer] Still failed after normalization:', result.error.issues);
    // Last resort: manually construct a minimal valid object from whatever we have
    return {
      title: normalized.title || rawJson.title || 'Unidentified Document',
      guessedId: String(normalized.guessedId || rawJson.guessedId || ''),
      cleanedTranscription: normalized.cleanedTranscription || rawJson.cleanedTranscription || rawJson.transcription || '',
      confidence: Number(normalized.confidence || rawJson.confidence) || 0.5,
      identifiedNames: Array.isArray(normalized.identifiedNames) ? normalized.identifiedNames : [],
      historicalContext: String(normalized.historicalContext || rawJson.historicalContext || ''),
      collectorSignificance: String(normalized.collectorSignificance || rawJson.collectorSignificance || ''),
      valuation: String(normalized.valuation || rawJson.valuation || ''),
      tags: Array.isArray(normalized.tags) ? normalized.tags : [],
    };
  }

  console.log('[Normalizer] Successfully normalized output.');
  return result.data;
}

export async function analyzeImage(
  imagePath: string,
  ocrText: string
): Promise<ItemMetadata> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const modelName = process.env.BASELINE_MODEL || 'gpt-4o';
      console.log(`[AI-Manual] Analyzing image with ${modelName} (Attempt ${attempt + 1}/${MAX_RETRIES + 1}), mime: ${mimeType}`);

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: BASELINE_SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: ocrText ? `OCR Hint (may contain errors):\n${ocrText.substring(0, 5000)}` : 'No OCR text available. Rely on visual analysis.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse raw JSON from model
      const rawResult = JSON.parse(content);

      // Run through normalizer (tries Zod first, falls back to gpt-4o-mini)
      const result = await normalizeToSchema(rawResult, apiKey);

      console.log('[AI-Manual] Analysis Successful.');
      return result;

    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(`AI_ANALYSIS_FAILED: Max retries exceeded. Last error: ${error.message}`);
      }

      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI-Manual] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('AI_ANALYSIS_FAILED: Unknown error');
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

/**
 * Raw deep dive — accepts pre-built system prompt and user content.
 * Used by the AI router which handles triage/grounding externally.
 */
export async function enrichDeepDiveRaw(
  imagePath: string,
  systemPrompt: string,
  userText: string,
  model?: string
): Promise<DeepDiveResult> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const modelName = model || process.env.DEEP_DIVE_MODEL || 'gpt-4o';
      console.log(`[AI-DeepDive-Raw] Running with ${modelName} (Attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
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
        })
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);

      const data = await response.json();
      const content = data.choices[0].message.content;
      if (!content) throw new Error('Empty response from OpenAI');

      console.log('[AI-DeepDive-Raw] Analysis Successful.');
      return JSON.parse(content) as DeepDiveResult;
    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) throw new Error(`DEEP_DIVE_FAILED: Max retries exceeded. Last error: ${error.message}`);
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI-DeepDive-Raw] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('DEEP_DIVE_FAILED: Unknown error');
}

/**
 * Legacy deep dive — does its own triage + grounding. Kept for backward compat with enrich route.
 */
export async function enrichDeepDive(
  imagePath: string,
  baselineData: any,
  customSystemPrompt?: string
): Promise<DeepDiveResult> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = getMimeType(imagePath);
  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[AI-DeepDive] Running in MOCK mode...');
    return {
      title: baselineData.title + " (Deep Dive Mock)",
      historicalContext: "This is a mocked deep dive historical context.",
      collectorSignificance: "Mocked collector significance.",
      valuation: "Low: $100 — High: $200 — Likely: $150 (Deep Dive Mock)",
      identifiedNames: baselineData.identifiedNames || [],
      tags: baselineData.tags || ["mock"]
    };
  }

  const apiUrl = process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1/chat/completions' : 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

  const { DEEP_DIVE_SYSTEM_PROMPT } = require('./prompts');
  const { DEEP_DIVE_PROMPT_COMICS_90S, DEEP_DIVE_PROMPT_DRG } = require('./prompts');
  let systemPrompt = customSystemPrompt || DEEP_DIVE_SYSTEM_PROMPT;

  if (!customSystemPrompt) {
    try {
      const category = await categorizeForDeepDive(baselineData);
      if (category === 'comics_1990s') {
        systemPrompt = DEEP_DIVE_PROMPT_COMICS_90S;
      } else if (category === 'drg_railroadiana') {
        systemPrompt = DEEP_DIVE_PROMPT_DRG;
      }
    } catch (err: any) {
      console.warn('[AI-DeepDive] Category triage failed. Using default prompt.', err?.message || err);
    }
  }

  let groundedResearchText = '';
  try {
    const grounded = await getGroundedResearch(baselineData);
    if (grounded) {
      const findings = grounded.keyFindings.length > 0
        ? grounded.keyFindings.map(f => `- ${f}`).join('\n')
        : '- None';
      const sources = grounded.sources.length > 0
        ? grounded.sources.map(s => `- ${s.title}: ${s.url}`).join('\n')
        : '- None';
      const queries = grounded.searchQueries.length > 0
        ? grounded.searchQueries.map(q => `- ${q}`).join('\n')
        : '- None';

      groundedResearchText =
        `GROUNDING_RESEARCH (Gemini + Google Search):\n` +
        `Summary: ${grounded.summary}\n` +
        `Key Findings:\n${findings}\n` +
        `Sources:\n${sources}\n` +
        `Search Queries:\n${queries}\n`;
    }
  } catch (err: any) {
    console.warn('[AI-DeepDive] Grounded research failed. Continuing without it.', err?.message || err);
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const modelName = process.env.OPENAI_API_KEY ? (process.env.DEEP_DIVE_MODEL || 'gpt-4o') : 'gemini-1.5-pro';
      console.log(`[AI-DeepDive] Running exhaustive research with ${modelName} (Attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: `BASELINE EXTRACTION:\n${JSON.stringify(baselineData, null, 2)}\n\n${groundedResearchText || 'GROUNDING_RESEARCH: none'}` 
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0.2, // Low temp for more factual analysis
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const result = JSON.parse(content);
      
      console.log('[AI-DeepDive] Analysis Successful.');
      return result as DeepDiveResult;

    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(`DEEP_DIVE_FAILED: Max retries exceeded. Last error: ${error.message}`);
      }
      
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI-DeepDive] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('DEEP_DIVE_FAILED: Unknown error');
}
