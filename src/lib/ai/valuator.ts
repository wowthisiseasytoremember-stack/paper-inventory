// src/lib/ai/valuator.ts
// Synthesizes archival context and pricing valuation.

import Anthropic from '@anthropic-ai/sdk';
import { getAIConfig, MODELS } from './config';

export interface ValuationOutput {
  title: string;
  historical_context: string;
  collector_significance: string;
  identified_names: string[];
  visible_condition_issues: string[];
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: 'high' | 'medium' | 'low';
  is_high_value: boolean;
  ebay_keywords: string;
  value_reasoning: string;
  potential_value_factors: string;
}

const VALUATION_PROMPT = `You are a senior appraiser and archivist specializing in vintage collectibles, ephemera, and paper goods.

You will be given:
- Item identification and category
- OCR text and Web Entities
- Market research from Perplexity (live web search)

Your job is to synthesize this into a final identification, deep archival context, and a grounded sale valuation.

### ARCHIVAL & VALUATION SCHEMA:
Respond ONLY with valid JSON matching this schema:
{
  "title": "<string — formal archival title>",
  "historical_context": "<string — deep synthesis of the item's history and era>",
  "collector_significance": "<string — why this matters to collectors, rarity signals>",
  "identified_names": ["<string>", "..."],
  "visible_condition_issues": ["<string>", "..."],
  "estimated_value_low": <number or null>,
  "estimated_value_high": <number or null>,
  "estimated_value_point": <number or null>,
  "value_confidence": "high" | "medium" | "low",
  "is_high_value": <boolean>,
  "ebay_keywords": "<string — 3-6 specific search terms>",
  "value_reasoning": "<string — pricing rationale>",
  "potential_value_factors": "<string — what WOULD make this more valuable? e.g. 'Highly valuable if part of a full run', 'Premium for misprints on page 4', etc.>"
}

### STRICT GROUNDING RULES:
1. **PRIORITIZE EVIDENCE:** Anchor estimates to ACTUAL sold prices in the research.
2. **FALLBACK TO CATEGORY:** If data is scarce, provide estimates based on category/era standards and state "Based on category-wide historical data...".
3. **VALUE UPSIDE:** Even if the current item is low-value, identify factors that would make it a "treasure" (e.g. rare variants, signatures, provenance).
4. **NO HALLUCINATIONS:** NEVER invent specific sold prices.`;

let anthropicInstance: Anthropic | null = null;

function getAnthropic() {
  if (!anthropicInstance) {
    anthropicInstance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicInstance;
}

async function callTextAI(prompt: string): Promise<string> {
  const config = getAIConfig();
  
  if (config.provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: MODELS.VALUATOR,
      max_tokens: 2048,
      system: "You are a senior expert appraiser. Respond ONLY with a single valid JSON object. No pre-amble, no markdown blocks, just the raw JSON.",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0,
    });
    return (response.content[0] as any).text;
  }

  // Fallback to Gemini
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BACKUP || "";
  if (!geminiKey) throw new Error("No API keys available for valuator");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 1024 }
    })
  });
  if (!res.ok) throw new Error(`Gemini Error: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty content from Gemini");
  return text;
}

export async function extractValuation(
  title: string,
  category: string,
  ocrText: string,
  researchNotes?: string,
): Promise<ValuationOutput | null> {
  const prompt = `${VALUATION_PROMPT}

## Item Details
- Basic ID: ${title}
- Category: ${category}
- OCR Text & Web Entities: ${ocrText?.slice(0, 3000) || 'none'}

## Market Research (Perplexity Live Web Search)
${researchNotes || 'No market research available — use category standards.'}`;

  try {
    const raw = await callTextAI(prompt);
    
    // Robust extraction for potentially wrapped JSON
    let jsonContent = raw;
    const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1];
    } else {
        const objectMatch = raw.match(/\{[\s\S]*\}/);
        if (objectMatch) jsonContent = objectMatch[0];
    }

    let parsed: any;
    try {
        parsed = JSON.parse(jsonContent);
    } catch (parseError) {
        console.warn('[Valuator] JSON Parse failed, returning basic ID as title.');
        return {
            title: title,
            historical_context: 'Archival notes unavailable due to system error.',
            collector_significance: 'Significance data unavailable.',
            identified_names: [],
            visible_condition_issues: [],
            estimated_value_low: null,
            estimated_value_high: null,
            estimated_value_point: null,
            value_confidence: 'low',
            is_high_value: false,
            ebay_keywords: '',
            value_reasoning: 'Valuation failed during synthesis.',
            potential_value_factors: 'Contact archivist for deep dive.'
        };
    }

    return {
      title: parsed.title || title,
      historical_context: parsed.historical_context || '',
      collector_significance: parsed.collector_significance || '',
      identified_names: Array.isArray(parsed.identified_names) ? parsed.identified_names : [],
      visible_condition_issues: Array.isArray(parsed.visible_condition_issues) ? parsed.visible_condition_issues : [],
      estimated_value_low: typeof parsed.estimated_value_low === 'number' ? parsed.estimated_value_low : null,
      estimated_value_high: typeof parsed.estimated_value_high === 'number' ? parsed.estimated_value_high : null,
      estimated_value_point: typeof parsed.estimated_value_point === 'number' ? parsed.estimated_value_point : null,
      value_confidence: ['high','medium','low'].includes(parsed.value_confidence) ? parsed.value_confidence : 'low',
      is_high_value: Boolean(parsed.is_high_value),
      ebay_keywords: parsed.ebay_keywords || '',
      value_reasoning: parsed.value_reasoning || '',
      potential_value_factors: parsed.potential_value_factors || '',
    };
  } catch (e) {
    console.error('[Valuator] Failed to parse valuation:', e);
    throw e;
  }
}
