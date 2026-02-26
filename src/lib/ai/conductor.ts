/**
 * Conductor AI Router
 * Categorizes items into buckets (comic_books, railroadiana, etc.)
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

const CONDUCTOR_PROMPT = `You are the "Triage Router" for a vast inventory of vintage goods, ephemera, and specialized collectibles.
Your sole purpose is to analyze the provided OCR text and accurately categorize it and provide a BASIC IDENTIFICATION.

### STRICT GROUNDING RULES:
1. **NEVER GUESS:** If the OCR and image do not provide enough evidence for a specific identification, state "Unidentified Item" in basic_id.
2. **PRIORITIZE EVIDENCE:** Use the "Web Entities" section (Google Knowledge Graph) as your primary anchor for truth.
3. **NO HALLUCINATIONS:** Do not use training data to invent specific titles or dates that are not present in the input. 
4. **STATE YOUR BASIS:** If your identification is based on visual patterns or category-wide historical data (e.g. "Likely 1940s timetable based on layout"), you MUST explicitly state that in basic_id.

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
{ 
  "category": "...", 
  "confidence_score": 0.85,
  "basic_id": "A concise (5-10 word) identification of the item based on the OCR text"
}`;
export interface ConductorResult {
  category: string;
  confidence_score: number;
  basic_id: string;
  raw_response: string;
}

async function callConductorAI(prompt: string, imageBase64?: string): Promise<string> {
  // If it starts with 'gemini', use Gemini
  if (MODELS.CONDUCTOR.startsWith('gemini')) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_BACKUP || "";
    if (!geminiKey) throw new Error("No Gemini API key for Conductor");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.CONDUCTOR}:generateContent?key=${geminiKey}`;
    
    const contents: any[] = [{
        parts: [{ text: prompt }]
    }];

    if (imageBase64) {
        contents[0].parts.push({
            inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64
            }
        });
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { 
            temperature: 0, 
            maxOutputTokens: 512,
            response_mime_type: "application/json"
        }
      })
    });
    if (!res.ok) throw new Error(`Gemini Error: ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty content from Gemini");
    return text;
  }

  // Otherwise fallback to Anthropic
  const anthropic = getAnthropic();
  
  const content: any[] = [{
    type: 'text',
    text: prompt,
  }];

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
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });
  return message.content[0].type === 'text' ? message.content[0].text : '';
}

export async function runConductor(ocrText: string, imageBase64?: string): Promise<ConductorResult> {
  try {
    const prompt = `${CONDUCTOR_PROMPT}\n\n[OCR TEXT]:\n${ocrText}`;
    const responseText = await callConductorAI(prompt, imageBase64);

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
        basic_id: 'Unidentified Item',
        raw_response: responseText,
      };
    }

    result.raw_response = responseText;
    return result;
  } catch (err: any) {
    throw new Error(`[Conductor Error] ${err.message}`);
  }
}
