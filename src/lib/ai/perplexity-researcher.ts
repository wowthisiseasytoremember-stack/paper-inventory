/**
 * Perplexity Researcher
 * Uses Perplexity sonar-pro (live web search) for deep dive market research.
 * Replaces the Gemini grounding step — Perplexity returns citations + actual
 * sold price data from eBay, auction houses, and collector forums.
 */

import OpenAI from 'openai';

export interface PerplexityResearchResult {
  notes: string;
  citations: string[];
  raw_response: string;
}

export async function runPerplexityResearcher(
  category: string,
  ocrText: string,
  title?: string,
): Promise<PerplexityResearchResult> {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('[Perplexity Researcher] No API key — skipping research step.');
    return { notes: 'Research step skipped (no API key).', citations: [], raw_response: '' };
  }

  const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  });

  const itemRef = title ? `Identified as: "${title}"` : '';
  const prompt = `You are an expert researcher for vintage collectibles, paper ephemera, and antiques.

Item category: ${category}
${itemRef}

[OCR / EXTRACTED TEXT]:
${ocrText.slice(0, 3000)}

Using web search, research this specific item and provide:

1. **Historical context** — What is this item? When was it made? Who made/published/issued it?
2. **Collector significance** — Why do collectors want this? Any notable features (first edition, rare variant, notable signature, etc.)?
3. **Current market — sold prices** — Find actual SOLD listings on eBay, Etsy, Heritage Auctions, or similar. Give specific dollar amounts and dates where possible.
4. **Market trend** — Is this category rising, falling, or stable in collector demand?
5. **Value factors** — What specific attributes drive price up or down (condition, completeness, grade, edition)?

Be specific. Cite actual sale data. This research will be handed to a senior appraiser to set a final sale price.`;

  try {
    const response = await client.chat.completions.create({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2048,
    });

    const text = response.choices[0]?.message?.content || '';
    // Perplexity returns citations on the response object (non-standard field)
    const citations: string[] = (response as any).citations || [];

    console.log(`[Perplexity Researcher] Research complete. ${citations.length} citations.`);

    return {
      notes: text,
      citations,
      raw_response: JSON.stringify({ text, citations }),
    };
  } catch (err: any) {
    console.error(`[Perplexity Researcher] Error: ${err.message}`);
    // Non-fatal — pipeline continues without research notes
    return {
      notes: 'Perplexity research step failed or unavailable.',
      citations: [],
      raw_response: err.message,
    };
  }
}
