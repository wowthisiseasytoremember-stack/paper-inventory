/**
 * Researcher AI
 * Uses Gemini with Google Search Grounding to find context and market data
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ResearchResult {
  notes: string;
  raw_response: string;
}

export async function runResearcher(
  category: string,
  ocrText: string
): Promise<ResearchResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [
        {
          // @ts-ignore
          googleSearch: {}
        }
      ]
    });

    const prompt = `You are an expert researcher for vintage collectibles. 
Based on the following OCR text and extracted Web Entities (if any), use the Google Search tool to find accurate historical context, collector significance, and current market data.
The item has been categorized as: ${category}.

[OCR TEXT & WEB ENTITIES]:
${ocrText}

Provide a concise summary of your findings to assist a senior appraiser in evaluating this item.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return {
      notes: responseText,
      raw_response: responseText,
    };
  } catch (err: any) {
    console.error(`[Researcher Error] ${err.message}`);
    // If researcher fails, return empty notes so pipeline can continue
    return {
      notes: "Research step failed or unavailable.",
      raw_response: err.message,
    };
  }
}
