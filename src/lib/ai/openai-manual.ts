/**
 * OPENAI CLIENT (Manual Fetch)
 * 
 * Bypasses Vercel AI SDK to prevent native module crashes on Windows.
 * Uses native fetch to call GPT-4o with JSON mode.
 */

import fs from 'fs';
import { ItemMetadata } from './schema';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export async function analyzeImage(
  imagePath: string, 
  ocrText: string
): Promise<ItemMetadata> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`[AI-Manual] Analyzing image with OpenAI (Attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an expert archivist. Analyze the image and OCR text. 
              
              Return a JSON object strictly matching this schema:
              {
                "title": "string",
                "guessedId": "string (optional)",
                "cleanedTranscription": "string",
                "confidence": number (0-1),
                "identifiedNames": [
                  { "name": "string", "type": "person" | "business" | "location" | "unknown", "confidence": number }
                ],
                "historicalContext": "string (optional)",
                "collectorSignificance": "string (optional)",
                "tags": ["string"]
              }
              `
            },
            {
              role: 'user',
              content: [
                { 
                  type: 'text', 
                  text: `OCR Hint:\n${ocrText.substring(0, 5000)}` 
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0,
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON
      const result = JSON.parse(content);
      
      // Basic validation (or use Zod parse if strictness needed here, but keeping it simple/crash-free)
      if (!result.title || !result.cleanedTranscription) {
          throw new Error('Incomplete JSON response');
      }

      console.log('[AI-Manual] Analysis Successful.');
      return result as ItemMetadata;

    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(`AI_ANALYSIS_FAILED: Max retries exceeded. Last error: ${error.message}`);
      }
      
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI-Manual] Attempt ${attempt} failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('AI_ANALYSIS_FAILED: Unknown error');
}
