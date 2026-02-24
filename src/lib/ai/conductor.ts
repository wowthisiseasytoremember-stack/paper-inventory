/**
 * Conductor AI Router
 * Categorizes items into buckets (comic_books, railroadiana, etc.)
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CONDUCTOR_PROMPT = `You are the "Triage Router" for a vast inventory of vintage goods, ephemera, and specialized collectibles.
Your sole purpose is to analyze the provided image (and any preliminary OCR text) and accurately categorize it into ONE of the specific buckets listed below.

**PRIORITY: ACCURACY.** If you are unsure between two categories, choose the one that seems most likely but indicate a lower confidence score. If it truly does not fit, use general_vintage_ephemera.

### Available Categories & Rules

1. comic_books - Comic books, graphic novels, primarily 1980s-1990s. KEY INDICATORS: Stylized character art, comic book format, barcodes, issue numbers.

2. railroadiana - Timetables, tickets, internal memos, and route maps specifically related to railways. KEY INDICATORS: Train logos, schedule grids, railway company names.

3. aerospace_technical - Internal documents, manuals, specs from aerospace companies. KEY INDICATORS: "D-numbers", "Confidential/Internal" stamps, engineering diagrams.

4. serial_publications - Vintage magazines, modern magazines, trade journals. KEY INDICATORS: Glossy covers, date/month/year, volume/issue numbers.

5. analog_media_electronics - Vinyl records, cassette tapes, laserdiscs, vintage audio gear. KEY INDICATORS: Center labels, track listings, model numbers.

6. stamps_postal - Stamps, First Day Covers, postal history. KEY INDICATORS: Perforated edges, denomination values, cancellation marks.

7. geographic_media - Old maps, charts, atlases. KEY INDICATORS: Topography, cartography, compass roses.

8. general_vintage_ephemera - The fallback category. Postcards, photos, ads, junk journal material.

### Output Instructions
You must respond with a JSON object:
{ "category": "...", "confidence_score": 0.85 }`;

export interface ConductorResult {
  category: string;
  confidence_score: number;
  raw_response: string;
}

export async function runConductor(ocrText: string, imageBase64?: string): Promise<ConductorResult> {
  try {
    // Build message with image if available
    const content: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: `${CONDUCTOR_PROMPT}\n\n[OCR TEXT]:\n${ocrText}`,
      },
    ];

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    let result: ConductorResult;
    try {
      // Extract JSON from response (may have extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      result = JSON.parse(jsonMatch[0]) as ConductorResult;
    } catch {
      // If parsing fails, return error category
      result = {
        category: 'general_vintage_ephemera',
        confidence_score: 0.5,
        raw_response: responseText,
      };
    }

    result.raw_response = responseText;
    return result;
  } catch (err: any) {
    throw new Error(`[Conductor Error] ${err.message}`);
  }
}
