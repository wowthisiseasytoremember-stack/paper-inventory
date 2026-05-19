/**
 * Conductor — Inventory Item Triage
 *
 * ARCHITECTURE (Action Layer Principle):
 * ┌─────────────────────────────────────────────────┐
 * │ Code (Automation Layer)                         │
 * │ • heuristicRouter() — keyword-based category    │
 * │   assignment. No LLM call.                      │
 * │ • Routes item data to correct LLM task based    │
 * │   on category.                                  │
 * ├─────────────────────────────────────────────────┤
 * │ LLM (Action Layer)                              │
 * │ • identifyItem() — given known category,        │
 * │   extracts: basic_id, description, features.    │
 * │   Does NOT decide the category.                 │
 * └─────────────────────────────────────────────────┘
 *
 * ANTI-PATTERN FIXED:
 * Before: LLM was asked to categorize items into
 * inventory buckets (comic_books, railroadiana, etc.)
 * and the category output determined routing.
 *
 * After: Code assigns category via keywords/patterns.
 * LLM only identifies and describes the item.
 * Category-driven routing is deterministic.
 */

import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from './config';

let anthropicInstance: Anthropic | null = null;

function getAnthropic() {
  if (!anthropicInstance) {
    anthropicInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicInstance;
}

export interface ConductorResult {
  category: string;
  confidence_score: number;
  basic_id: string;
  raw_response: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// (A) DETERMINISTIC CATEGORY ROUTER (Automation Layer)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Pure keyword/pattern matching — no LLM involved.
// Assigns items to inventory buckets based on observable text signals.
// This ensures routing is predictable and debuggable.
//
// If replaced with a lookup table, the system would route identically.
// The LLM is only called for item identification (data extraction),
// never for routing decisions.

export type InventoryCategory =
  | 'comic_books'
  | 'railroadiana'
  | 'aerospace_technical'
  | 'serial_publications'
  | 'analog_media_electronics'
  | 'stamps_postal'
  | 'geographic_media'
  | 'general_vintage_ephemera';

interface HeuristicSignal {
  category: InventoryCategory;
  weight: number; // higher = stronger match
}

/**
 * Deterministic category router.
 *
 * Inspects OCR text and web entities for keyword/pattern matches.
 * Returns the highest-weighted matching category.
 * No LLM call — pure code.
 */
function heuristicRouter(ocrText: string, webEntities?: string): InventoryCategory {
  const text = `${ocrText} ${webEntities || ''}`.toLowerCase();
  const signals: HeuristicSignal[] = [];

  // ── comic_books ────────────────────────────────────────────────────
  let comicWeight = 0;
  const comicPatterns = [
    /\b(comic|comics)\b/, 30,
    /\b(marvel|dc comics|image comics|dark horse|vertigo)\b/, 50,
    /\b(graphic novel|trade paperback|tpb|omnibus)\b/, 40,
    /\b(issue #?\d+|vol\.?\s*\d+)\b/, 25,
    /\b(198\d|199\d)\s*(comic|issue|series)\b/, 20,
    /#\d{1,3}\b/, 10,  // issue numbers like #142
  ];
  for (let i = 0; i < comicPatterns.length; i += 2) {
    if (comicPatterns[i].test(text)) comicWeight += comicPatterns[i + 1] as number;
  }
  if (comicWeight > 0) signals.push({ category: 'comic_books', weight: comicWeight });

  // ── railroadiana ───────────────────────────────────────────────────
  let railWeight = 0;
  const railPatterns = [
    /\b(d&rg|d & rg|d\.r\.g\.|denver & rio grande|denver and rio grande|rio grande)\b/, 60,
    /\b(railroad|railway|rail road)\b/, 40,
    /\b(timetable|schedule|route map|train schedule)\b/, 35,
    /\b(union pacific|santa fe|southern pacific|bnsf|norfolk southern|csx|amtrak)\b/, 50,
    /\b(locomotive|engine|depot|station|platform|track)\b/, 20,
    /\b(19\d{2})\s*(timetable|schedule|rail)\b/, 15,
  ];
  for (let i = 0; i < railPatterns.length; i += 2) {
    if (railPatterns[i].test(text)) railWeight += railPatterns[i + 1] as number;
  }
  if (railWeight > 0) signals.push({ category: 'railroadiana', weight: railWeight });

  // ── aerospace_technical ────────────────────────────────────────────
  let aeroWeight = 0;
  const aeroPatterns = [
    /\b(aerospace|aeronautical|aviation|aircraft|rocket|spacecraft)\b/, 40,
    /\b(nasa|boeing|lockheed|northrop|gruman|raytheon|spacex|blue origin)\b/, 50,
    /\b(confidential|internal|secret|classified)\s+(document|memo|report)\b/, 35,
    /\b(d-\d{4,}|engineering\s+drawing|technical\s+manual|specification)\b/, 30,
    /\b(air force|navy|military|defense)\s+(contract|spec|manual)\b/, 25,
  ];
  for (let i = 0; i < aeroPatterns.length; i += 2) {
    if (aeroPatterns[i].test(text)) aeroWeight += aeroPatterns[i + 1] as number;
  }
  if (aeroWeight > 0) signals.push({ category: 'aerospace_technical', weight: aeroWeight });

  // ── serial_publications ────────────────────────────────────────────
  let serialWeight = 0;
  const serialPatterns = [
    /\b(magazine|journal|periodical|bulletin|newsletter|digest)\b/, 35,
    /\b(vol\.?\s*\d+|volume\s+\d+|issue\s+\d+|no\.\s*\d+)\b/, 30,
    /\b(monthly|weekly|quarterly|annual)\s+(magazine|journal|review)\b/, 25,
    /\b(19\d{2}|20\d{2})\s*(magazine|journal|issue)\b/, 15,
  ];
  for (let i = 0; i < serialPatterns.length; i += 2) {
    if (serialPatterns[i].test(text)) serialWeight += serialPatterns[i + 1] as number;
  }
  if (serialWeight > 0) signals.push({ category: 'serial_publications', weight: serialWeight });

  // ── analog_media_electronics ───────────────────────────────────────
  let analogWeight = 0;
  const analogPatterns = [
    /\b(vinyl|record|album|lp|45 rpm|33 rpm)\b/, 40,
    /\b(cassette|8-track|reel to reel|audio tape)\b/, 35,
    /\b(laserdisc|vhs|betamax|dvd|blu-ray)\b/, 30,
    /\b(stereo|amplifier|speaker|turntable|receiver|radio|ham radio)\b/, 25,
    /\b(vintage\s+audio|vintage\s+electronics)\b/, 20,
  ];
  for (let i = 0; i < analogPatterns.length; i += 2) {
    if (analogPatterns[i].test(text)) analogWeight += analogPatterns[i + 1] as number;
  }
  if (analogWeight > 0) signals.push({ category: 'analog_media_electronics', weight: analogWeight });

  // ── stamps_postal ──────────────────────────────────────────────────
  let stampWeight = 0;
  const stampPatterns = [
    /\b(stamp|postage|philatelic|first day cover|fdc)\b/, 40,
    /\b(postal|mail|airmail|cancelation|perforated)\b/, 25,
    /\b(\d+¢|\d+ cents|postage\s+due)\b/, 20,
  ];
  for (let i = 0; i < stampPatterns.length; i += 2) {
    if (stampPatterns[i].test(text)) stampWeight += stampPatterns[i + 1] as number;
  }
  if (stampWeight > 0) signals.push({ category: 'stamps_postal', weight: stampWeight });

  // ── geographic_media ───────────────────────────────────────────────
  let geoWeight = 0;
  const geoPatterns = [
    /\b(map|atlas|chart|topographic|cartography|globe)\b/, 40,
    /\b(topography|survey|coordinates|longitude|latitude)\b/, 30,
    /\b(geological|geography|navigation|nautical chart)\b/, 25,
  ];
  for (let i = 0; i < geoPatterns.length; i += 2) {
    if (geoPatterns[i].test(text)) geoWeight += geoPatterns[i + 1] as number;
  }
  if (geoWeight > 0) signals.push({ category: 'geographic_media', weight: geoWeight });

  // ── Select highest-weighted category ───────────────────────────────
  if (signals.length > 0) {
    signals.sort((a, b) => b.weight - a.weight);
    // Only return specific category if weight exceeds threshold (avoids false positives)
    if (signals[0].weight >= 25) return signals[0].category;
  }

  return 'general_vintage_ephemera';
}

// ═══════════════════════════════════════════════════════════════════════════════
// (B) LLM ITEM IDENTIFICATION (Action Layer)
// ═══════════════════════════════════════════════════════════════════════════════
//
// The LLM is given a KNOWN category and asked ONLY to identify the item.
// It does NOT decide the category — that's already set by heuristicRouter.

const IDENTIFY_PROMPT = (category: string) => `You are an item identification specialist for a vintage inventory system.

The item has been classified as: ${category}

Your ONLY job is to provide a concise identification of the specific item based on the OCR text provided.

### Rules
1. NEVER guess the category — it's already determined.
2. Identify the specific item (title, date, maker) if the evidence supports it.
3. If you cannot identify the item from the OCR text, state "Unidentified Item".
4. State the basis for your identification if it's from visual patterns or contextual clues.
5. Keep basic_id to 5-15 words.

### Output Format
Respond with a JSON object:
{
  "basic_id": "A concise (5-15 word) identification of the item",
  "confidence_score": 0.0-1.0,
  "key_features": ["feature1", "feature2"]
}`;

async function callIdentifyLLM(prompt: string, imageBase64?: string): Promise<string> {
  const anthropic = getAnthropic();
  const content: any[] = [{ type: 'text', text: prompt }];

  if (imageBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: imageBase64,
      },
    });
  }

  const message = await anthropic.messages.create({
    model: MODELS.CONDUCTOR,
    max_tokens: 1024,
    temperature: 0,
    messages: [{ role: 'user', content }],
  });
  return message.content[0].type === 'text' ? message.content[0].text : '';
}

interface IdentificationResult {
  basic_id: string;
  confidence_score: number;
  key_features: string[];
}

/**
 * Identify an item using the LLM.
 *
 * The category is already determined by heuristicRouter.
 * The LLM's only job is to identify what the specific item is.
 * This is pure data extraction — no routing decisions.
 */
async function identifyItem(ocrText: string, category: InventoryCategory, imageBase64?: string): Promise<IdentificationResult> {
  const prompt = `${IDENTIFY_PROMPT(category)}\n\n[OCR TEXT]:\n${ocrText}`;
  const responseText = await callIdentifyLLM(prompt, imageBase64);

  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]) as IdentificationResult;
  } catch {
    // If parsing fails, return conservative defaults
    return {
      basic_id: 'Unidentified Item',
      confidence_score: 0.5,
      key_features: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// (C) PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════
//
// 1. Code: heuristicRouter() assigns category (Automation)
// 2. LLM: identifyItem() extracts item details (Action)
// 3. Code: combines results into ConductorResult

export async function runConductor(ocrText: string, imageBase64?: string): Promise<ConductorResult> {
  try {
    // Step 1: DETERMINISTIC ROUTING — pure code, no LLM
    const category = heuristicRouter(ocrText);

    // Step 2: LLM IDENTIFICATION — action layer, pure data extraction
    const identification = await identifyItem(ocrText, category, imageBase64);

    // Step 3: Combine results
    return {
      category,
      confidence_score: identification.confidence_score,
      basic_id: identification.basic_id,
      raw_response: JSON.stringify(identification),
    };
  } catch (err: any) {
    throw new Error(`[Conductor Error] ${err.message}`);
  }
}

// Export the deterministic router for use in tests and other modules
export { heuristicRouter };
