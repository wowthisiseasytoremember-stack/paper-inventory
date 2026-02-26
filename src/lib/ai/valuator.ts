// src/lib/ai/valuator.ts
// Runs AFTER the expert pass. Takes the full item context and produces
// structured valuation fields.

import Anthropic from '@anthropic-ai/sdk';
import { getAIConfig } from './config';

export interface ValuationOutput {
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: 'high' | 'medium' | 'low';
  is_high_value: boolean;
  ebay_keywords: string;
  value_reasoning: string;
}

const VALUATION_PROMPT = `You are a senior appraiser specializing in vintage collectibles, ephemera, and paper goods.

You will be given:
- Item identification and category
- Expert extraction (historical context, collector significance, condition, value signals)
- Market research from Perplexity (live web search with actual sold prices and citations)

Your job is to synthesize ALL of this into a final, grounded sale valuation.

Respond ONLY with valid JSON matching this exact schema:
{
  "estimated_value_low": <number or null — conservative floor price in USD>,
  "estimated_value_high": <number or null — optimistic ceiling price in USD>,
  "estimated_value_point": <number or null — single best estimate for pricing/listing in USD>,
  "value_confidence": "high" | "medium" | "low",
  "is_high_value": <boolean — true if item is likely worth $75 or more>,
  "ebay_keywords": "<3-6 specific search terms a buyer would use, comma separated>",
  "value_reasoning": "<2-3 sentences synthesizing the market research and expert notes into a pricing rationale>"
}

Rules:
- Anchor your estimates to the ACTUAL sold prices in the market research — do not guess blindly
- If market research found specific comps, use them as your primary reference
- If no sold data exists, use "low" confidence and wider low/high range
- is_high_value = true for anything likely $75+
- ebay_keywords should be SPECIFIC (e.g. "1952 topps baseball card grade 4" not "baseball card")
- Do NOT include dollar signs in numeric fields — numbers only`;

async function callTextAI(prompt: string): Promise<string> {
  const config = getAIConfig();
  
  if (config.provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: "You are a senior expert appraiser. Respond only with JSON.",
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "{" }
      ],
      temperature: 0,
    });
    return "{" + (response.content[0] as any).text;
  }

  // Fallback to Gemini
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BACKUP || "";
  if (!geminiKey) throw new Error("No API keys available for valuator");

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 512 }
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
  historicalContext: string,
  collectorSignificance: string,
  rawSignals: string,      // estimated_value_signals from expert pass
  ocrText: string,
  researchNotes?: string,  // Perplexity market research with actual sold prices
): Promise<ValuationOutput | null> {
  const prompt = `${VALUATION_PROMPT}

## Item Details
- Title: ${title}
- Category: ${category}
- Historical Context: ${historicalContext}
- Collector Significance: ${collectorSignificance}
- OCR Text: ${ocrText?.slice(0, 500) || 'none'}
- Expert Value Signals: ${rawSignals}

## Market Research (Perplexity Live Web Search)
${researchNotes || 'No market research available — use expert signals only.'}`;

  try {
    const raw = await callTextAI(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      estimated_value_low: typeof parsed.estimated_value_low === 'number' ? parsed.estimated_value_low : null,
      estimated_value_high: typeof parsed.estimated_value_high === 'number' ? parsed.estimated_value_high : null,
      estimated_value_point: typeof parsed.estimated_value_point === 'number' ? parsed.estimated_value_point : null,
      value_confidence: ['high','medium','low'].includes(parsed.value_confidence) ? parsed.value_confidence : 'low',
      is_high_value: Boolean(parsed.is_high_value),
      ebay_keywords: parsed.ebay_keywords || '',
      value_reasoning: parsed.value_reasoning || '',
    };
  } catch (e) {
    console.error('[Valuator] Failed to parse valuation:', e);
    return null;
  }
}
