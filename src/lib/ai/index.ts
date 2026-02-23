/**
 * AI PROVIDER ROUTER (v3)
 *
 * Single entry point. Routes by model prefix. Auto-fallback on failure.
 * Parallelizes triage + grounding for speed.
 * Default deep dive: gemini-2.5-flash (fast + free).
 * Groq as text-only last-resort fallback.
 */

import { ItemMetadata, ItemMetadataSchema } from './schema';
import { BASELINE_SYSTEM_PROMPT, DEEP_DIVE_SYSTEM_PROMPT, DEEP_DIVE_PROMPT_COMICS_90S, DEEP_DIVE_PROMPT_DRG } from './prompts';
import { categorizeForDeepDive, DeepDiveCategory } from './gemini-triage';
import { getGroundedResearch, GroundedResearch } from './gemini-grounding';
import { DeepDiveResult } from './openai-manual';

export interface AnalysisOptions {
  baselineModel?: string;
  deepDiveModel?: string;
  enableGrounding?: boolean;
  customPrompt?: string;
}

export interface PipelineCallbacks {
  onBaselineComplete?: (baseline: ItemMetadata) => void;
}

export interface FullAnalysisResult {
  baseline: ItemMetadata;
  deepDive: DeepDiveResult;
  category: DeepDiveCategory;
  groundingUsed: boolean;
  merged: Record<string, any>;
}

const DEFAULTS = {
  baselineModel: 'gemini-2.0-flash',
  deepDiveModel: 'gemini-2.5-flash',  // Fast + free. Claude available via FAB for premium.
  enableGrounding: true,
};

// Fallback chains: if preferred model fails, try next. Groq is always last (text-only).
const DEEP_DIVE_FALLBACKS: Record<string, string[]> = {
  'gpt-4o':           ['claude-sonnet', 'gemini-2.5-flash', 'groq'],
  'claude-sonnet':    ['gemini-2.5-flash', 'gpt-4o', 'groq'],
  'gemini-2.5-flash': ['claude-sonnet', 'gpt-4o', 'groq'],
  'groq':             ['gemini-2.5-flash', 'claude-sonnet'],
};

const BASELINE_FALLBACKS: Record<string, string[]> = {
  'gemini-2.0-flash': ['gpt-4o-mini', 'claude-sonnet'],
  'gpt-4o-mini':      ['gemini-2.0-flash', 'claude-sonnet'],
  'gpt-4o':           ['gemini-2.0-flash', 'claude-sonnet'],
};

export const AVAILABLE_MODELS = {
  baseline: ['gemini-2.0-flash', 'claude-sonnet'],
  deepDive: ['gemini-2.5-flash', 'claude-sonnet', 'groq'],
  grounding: ['gemini-2.5-flash'],
};

// ---- Provider dispatch ----

function resolveAnthropicModel(shortName: string): string {
  if (shortName === 'claude-sonnet') return 'claude-sonnet-4-20250514';
  return shortName;
}

async function callBaseline(imagePath: string, ocrText: string, model: string): Promise<ItemMetadata> {
  if (model.startsWith('gemini')) {
    const { analyzeItem } = await import('./gemini-client');
    const result = await analyzeItem(ocrText, imagePath, model);
    return result.parsedData;
  }
  if (model.startsWith('gpt')) {
    const { analyzeImage: analyzeOpenAI } = await import('./openai-sdk');
    return analyzeOpenAI(imagePath, ocrText);
  }
  if (model.startsWith('claude')) {
    const { analyzeImageAnthropic } = await import('./anthropic-sdk');
    return analyzeImageAnthropic(imagePath, ocrText, BASELINE_SYSTEM_PROMPT, resolveAnthropicModel(model));
  }
  throw new Error(`Unknown model: ${model}`);
}

async function callGeminiDeepDive(imagePath: string, systemPrompt: string, userContent: string, model: string): Promise<DeepDiveResult> {
  const fs = await import('fs');
  const path = await import('path');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });

  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const mimeType = mimeMap[ext] || 'image/png';

  const result = await geminiModel.generateContent([
    userContent,
    { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
  ]);

  return JSON.parse(result.response.text()) as DeepDiveResult;
}

async function callGroqDeepDive(systemPrompt: string, userContent: string): Promise<DeepDiveResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is missing');

  console.log('[AI-Router] Groq deep dive (text-only fallback, no image)');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent + '\n\n(Note: Image not available. Rely on baseline extraction and grounding research above.)' },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) throw new Error(`Groq HTTP ${response.status}: ${await response.text()}`);

  const data = await response.json();
  const content = data.choices[0].message.content;
  if (!content) throw new Error('Empty response from Groq');
  return JSON.parse(content) as DeepDiveResult;
}

async function callDeepDive(imagePath: string, systemPrompt: string, userContent: string, model: string): Promise<DeepDiveResult> {
  if (model.startsWith('gpt')) {
    const { enrichDeepDiveRaw } = await import('./openai-sdk');
    return enrichDeepDiveRaw(imagePath, systemPrompt, userContent, model);
  }
  if (model.startsWith('claude')) {
    const { callAnthropic } = await import('./anthropic-sdk');
    return await callAnthropic(systemPrompt, imagePath, userContent, resolveAnthropicModel(model)) as DeepDiveResult;
  }
  if (model.startsWith('gemini')) {
    return callGeminiDeepDive(imagePath, systemPrompt, userContent, model);
  }
  if (model === 'groq' || model.startsWith('llama')) {
    return callGroqDeepDive(systemPrompt, userContent);
  }
  throw new Error(`Unknown model: ${model}`);
}

/** Try a model, then its fallback chain */
async function withFallback<T>(
  preferred: string,
  fallbacks: Record<string, string[]>,
  fn: (model: string) => Promise<T>,
  label: string
): Promise<T> {
  const chain = [preferred, ...(fallbacks[preferred] || [])];
  let lastError: Error | null = null;

  for (const model of chain) {
    try {
      return await fn(model);
    } catch (err: any) {
      lastError = err;
      const isQuota = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('insufficient');
      const isMissing = err.message?.includes('missing') || err.message?.includes('MISSING');
      if (isQuota || isMissing) {
        console.warn(`[AI-Router] ${label} ${model} failed (${isQuota ? 'quota' : 'no key'}), trying next...`);
        continue;
      }
      // Non-quota error — don't fallback, it's a real problem
      throw err;
    }
  }
  throw lastError || new Error(`All ${label} models exhausted`);
}

// ---- Main entry points ----

export async function analyzeImage(imagePath: string, ocrText: string, options?: AnalysisOptions): Promise<ItemMetadata> {
  const model = options?.baselineModel || DEFAULTS.baselineModel;
  return withFallback(model, BASELINE_FALLBACKS, (m) => callBaseline(imagePath, ocrText, m), 'Baseline');
}

export async function runFullPipeline(
  imagePath: string,
  ocrText: string,
  options?: AnalysisOptions,
  callbacks?: PipelineCallbacks
): Promise<FullAnalysisResult> {
  const baselineModel = options?.baselineModel || DEFAULTS.baselineModel;
  const deepDiveModel = options?.deepDiveModel || DEFAULTS.deepDiveModel;
  const enableGrounding = options?.enableGrounding ?? DEFAULTS.enableGrounding;

  // Stage 1: Baseline (with fallback)
  console.log(`[AI-Router] Stage 1: Baseline (${baselineModel})`);
  const baseline = await withFallback(
    baselineModel, BASELINE_FALLBACKS,
    (m) => callBaseline(imagePath, ocrText, m), 'Baseline'
  );

  // Notify caller immediately — lets UI show title/tags before deep dive finishes
  callbacks?.onBaselineComplete?.(baseline);

  const baselineData = {
    title: baseline.title,
    transcription: baseline.cleanedTranscription,
    identifiedNames: baseline.identifiedNames,
    tags: baseline.tags || [],
  };

  // Stage 2 + 3: Triage AND Grounding IN PARALLEL
  console.log(`[AI-Router] Stage 2+3: Triage + Grounding (parallel)`);
  const [category, grounded] = await Promise.all([
    categorizeForDeepDive(baselineData).catch((err: any) => {
      console.warn('[AI-Router] Triage failed:', err?.message);
      return 'other' as DeepDiveCategory;
    }),
    enableGrounding
      ? getGroundedResearch(baselineData).catch((err: any) => {
          console.warn('[AI-Router] Grounding failed:', err?.message);
          return null as GroundedResearch | null;
        })
      : Promise.resolve(null as GroundedResearch | null),
  ]);

  console.log(`[AI-Router] Category: ${category}`);

  // Build prompts
  let systemPrompt = options?.customPrompt || DEEP_DIVE_SYSTEM_PROMPT;
  if (!options?.customPrompt) {
    if (category === 'comics_1990s') systemPrompt = DEEP_DIVE_PROMPT_COMICS_90S;
    else if (category === 'drg_railroadiana') systemPrompt = DEEP_DIVE_PROMPT_DRG;
  }

  let groundingText = '';
  let groundingUsed = false;
  if (grounded) {
    groundingUsed = true;
    const comps = Array.isArray(grounded.comps) && grounded.comps.length > 0
      ? grounded.comps.map(c => `- ${c.description} | ${c.soldPrice} | ${c.date} | ${c.platform}${c.condition ? ' | ' + c.condition : ''}`).join('\n')
      : '- No comps found';
    const findings = grounded.keyFindings.length > 0
      ? grounded.keyFindings.map(f => `- ${f}`).join('\n') : '- None';
    const sources = grounded.sources.length > 0
      ? grounded.sources.map(s => `- ${s.title}: ${s.url}`).join('\n') : '- None';
    groundingText =
      `GROUNDING_RESEARCH (Gemini + Google Search):\n` +
      `Summary: ${grounded.summary}\n` +
      `Market Comps (SOLD prices):\n${comps}\n` +
      `Key Findings:\n${findings}\n` +
      `Sources:\n${sources}\n`;
  }

  const userContent = `BASELINE EXTRACTION:\n${JSON.stringify(baselineData, null, 2)}\n\n${groundingText || 'GROUNDING_RESEARCH: none'}`;

  // Stage 4: Deep Dive (with fallback)
  console.log(`[AI-Router] Stage 4: Deep Dive (${deepDiveModel})`);
  const deepDive = await withFallback(
    deepDiveModel, DEEP_DIVE_FALLBACKS,
    (m) => callDeepDive(imagePath, systemPrompt, userContent, m), 'DeepDive'
  );

  // Merge
  const mergedTags = Array.from(new Set([...(baseline.tags || []), ...(deepDive.tags || [])]));
  const mergedNames = deepDive.identifiedNames?.length > 0
    ? deepDive.identifiedNames : (baseline.identifiedNames || []);

  return {
    baseline, deepDive, category, groundingUsed,
    merged: {
      title: deepDive.title || baseline.title,
      guessedId: baseline.guessedId,
      cleanedTranscription: baseline.cleanedTranscription,
      confidence: baseline.confidence,
      identifiedNames: JSON.stringify(mergedNames),
      historicalContext: deepDive.historicalContext,
      collectorSignificance: deepDive.collectorSignificance,
      valuation: deepDive.valuation,
      verification_questions: deepDive.verificationQuestions ? JSON.stringify(deepDive.verificationQuestions) : undefined,
      tags: JSON.stringify(mergedTags),
    }
  };
}
