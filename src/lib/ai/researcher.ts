/**
 * Researcher AI
 * Orchestrates multi-provider research (Gemini or Perplexity)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { runPerplexityResearch } from './perplexity-client';

export interface ResearchResult {
  notes: string;
  raw_response: string;
  provider: string;
}

export async function runResearcher(
  category: string,
  ocrText: string
): Promise<ResearchResult> {
  // 1. Try Perplexity (Primary for Grounding)
  if (process.env.PERPLEXITY_API_KEY) {
    try {
      const result = await runPerplexityResearch(category, ocrText);
      return {
        ...result,
        provider: 'perplexity'
      };
    } catch (err: any) {
      console.warn(`[Researcher] Perplexity failed, falling back to Gemini...`, err.message);
    }
  }

  // 2. Try Gemini (Secondary)
  if (process.env.GEMINI_API_KEY) {
    try {
      return await runGeminiResearch(category, ocrText);
    } catch (err: any) {
      console.warn(`[Researcher] Gemini failed...`, err.message);
    }
  }

  // 3. Graceful Failure (Return empty notes to allow pipeline to continue)
  return {
    notes: "Research step failed or unavailable. Continuing with extraction only.",
    raw_response: "All research providers failed or were unconfigured.",
    provider: 'none'
  };
}

async function runGeminiResearch(category: string, ocrText: string): Promise<ResearchResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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
    provider: 'gemini'
  };
}
