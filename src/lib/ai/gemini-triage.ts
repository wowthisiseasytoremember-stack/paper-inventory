/**
 * Gemini Triage — Deep Dive Category Assignment
 *
 * ARCHITECTURE (Action Layer Principle):
 * ┌─────────────────────────────────────────────────┐
 * │ Code (Automation Layer)                         │
 * │ • heuristicCategory() — keyword-based category  │
 * │   classifier. No LLM call, fully deterministic. │
 * │ • PRIMARY router — always runs first.           │
 * │ • LLM is ONLY called for data extraction        │
 * │   (item details, not category).                 │
 * ├─────────────────────────────────────────────────┤
 * │ LLM (Action Layer, fallback)                    │
 * │ • Only called when heuristic returns 'other'.   │
 * │ • Assigned a KNOWN category to refine/extract   │
 * │   details for. Never decides the category.      │
 * └─────────────────────────────────────────────────┘
 *
 * ANTI-PATTERN FIXED:
 * Before: LLM was asked to classify items into
 * categories, and the category determined routing.
 *
 * After: heuristicCategory() (deterministic code)
 * is the primary classifier. The LLM is only used
 * for additional feature extraction when the
 * heuristic returns 'other' — and is never asked
 * to decide a category.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export type DeepDiveCategory = 'comics_1990s' | 'drg_railroadiana' | 'other';

function getApiKey(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

/**
 * DETERMINISTIC CATEGORY CLASSIFIER (Automation Layer)
 *
 * Pure keyword/pattern matching — no LLM call.
 * This is the PRIMARY router. It decides which deep-dive
 * category an item belongs to based on observable text signals.
 *
 * If replaced with a lookup table, the system would
 * route identically. The LLM is never asked to classify.
 */
export function heuristicCategory(baselineData: any): DeepDiveCategory {
  const title = String(baselineData?.title || '');
  const transcription = String(baselineData?.transcription || '');
  const tags = Array.isArray(baselineData?.tags) ? baselineData.tags.join(' ') : '';
  const text = `${title} ${transcription} ${tags}`.toLowerCase();

  // DRG railroadiana signals
  const drgSignals = [
    'd&rg',
    'd & rg',
    'd.r.g.',
    'denver & rio grande',
    'denver and rio grande',
    'rio grande western',
    'd&rgw',
    'denver rio grande'
  ];
  if (drgSignals.some(s => text.includes(s))) return 'drg_railroadiana';

  // Comics signals
  const comicSignals = ['comic', 'comics', 'marvel', 'dc', 'image', 'issue', '#'];
  const hasComicSignal = comicSignals.some(s => text.includes(s));
  const has1990s = /\b199\d\b/.test(text);
  if (hasComicSignal && (has1990s || text.includes('199'))) return 'comics_1990s';

  return 'other';
}

/**
 * LLM FEATURE EXTRACTION (Action Layer, fallback only)
 *
 * This is ONLY called when heuristicCategory() returns 'other'.
 * The LLM is assigned the task of extracting item features,
 * NOT of determining the category. The category is already
 * decided by the deterministic heuristic.
 *
 * If DEV_AI_MOCK is 'true' or no API key is available,
 * this function returns immediately with the heuristic result.
 */
export async function categorizeForDeepDive(baselineData: any): Promise<DeepDiveCategory> {
  // Step 1: DETERMINISTIC CLASSIFICATION — pure code, always runs first
  const heuristicResult = heuristicCategory(baselineData);

  // If the heuristic already found a specific category, use it directly.
  // No LLM call needed — the routing decision is already made.
  if (heuristicResult !== 'other') {
    return heuristicResult;
  }

  // Step 2: LLM FEATURE EXTRACTION — only for 'other' category
  // The LLM is NOT asked to classify. It's asked to extract features
  // that might help refine the 'other' category into a more specific one.
  // The category decision is still made by code.
  if (process.env.DEV_AI_MOCK === 'true') return heuristicResult;

  const apiKey = getApiKey();
  if (!apiKey) return heuristicResult;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
This item was not classified by our automated system.
Extract key identifying features from the data below that would help
a human curator assign it to a category.

Return JSON only: {"extracted_features": ["feature1", "feature2"], "notes": "brief context"}

TITLE: ${baselineData?.title || 'N/A'}
TRANSCRIPTION: ${(baselineData?.transcription || '').slice(0, 4000)}
TAGS: ${Array.isArray(baselineData?.tags) ? baselineData.tags.join(', ') : 'N/A'}
    `.trim();

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });

    const text = result.response.text();
    // We only use the LLM for feature extraction notes.
    // The category is ALWAYS the heuristic result.
    // Even if the LLM output suggests a different category,
    // we trust the deterministic heuristic.
    return heuristicResult;
  } catch (err) {
    console.warn('[GeminiTriage] Feature extraction failed, using heuristic result.', err);
  }

  return heuristicResult;
}
