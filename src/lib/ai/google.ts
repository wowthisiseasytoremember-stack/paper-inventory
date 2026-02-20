/**
 * GOOGLE GEMINI CLIENT
 * 
 * Handles interaction with Google Gemini Pro Vision (or Flash) API.
 * Returns structured metadata matching the Zod schema.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { ItemMetadata, IdentifiedNameSchema } from "./schema"; // Reuse schema
import { z } from "zod";

const GEN_AI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!GEN_AI_KEY) {
  throw new Error("Missing GOOGLE_API_KEY or GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

// Schema Definition for Prompt (Gemini doesn't support strict JSON schema enforcement in the same way as OpenAI yet, 
// strictly speaking, but we can prompt for it. Or use the new responseSchema if available.
// For robustness, we will prompt efficiently.)

const PROMPT = `
You are an expert archivist and OCR engine. 
1. Transcribe ALL visible text from this image into the 'cleanedTranscription' field. Be verbatim.
2. Analyze the image and extract the following metadata in strict JSON format.

1. title: A short, descriptive title (e.g., "Home Depot Receipt - Paint").
2. guessedId: A likely unique ID printed on the document (e.g., Invoice #, Receipt #). If none, null.
3. cleanedTranscription: The FULL text content of the document.
4. confidence: 0-1 confidence score.
5. identifiedNames: A list of names/companies found.
6. historicalContext: Any detected date or location context.
7. collectorSignificance: Why this might be important?
8. tags: A list of relevant tags (e.g. "receipt", "hardware", "paint").

Output JSON only. No markdown code blocks.
`;

export async function analyzeImage(imagePath: string, ocrHint: string): Promise<ItemMetadata> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // gemini-1.5-flash deprecated in v1beta; 2.0-flash is the active successor

    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString("base64");

    // Determine MIME type
    const ext = imagePath.split('.').pop()?.toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === 'png') mimeType = "image/png";
    if (ext === 'webp') mimeType = "image/webp";
    if (ext === 'heic') mimeType = "image/heic";

    const promptParts = [PROMPT];
    if (ocrHint && ocrHint.trim().length > 0) {
        promptParts.push(`\nContext from previous OCR pass (use if helpful, but prioritize image): ${ocrHint}`);
    } else {
        promptParts.push(`\nNo previous OCR available. You are the sole source of text extraction.`);
    }

    const result = await model.generateContent([
      promptParts.join('\n'),
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Clean code blocks if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const data = JSON.parse(jsonStr);
      // Map to ItemMetadata interface
      return {
        title: data.title || "Untitled",
        guessedId: data.guessedId,
        cleanedTranscription: data.cleanedTranscription,
        confidence: data.confidence || 0.5,
        identifiedNames: Array.isArray(data.identifiedNames) 
            ? data.identifiedNames.map((n: string | {name: string}) => typeof n === 'string' ? { name: n, type: 'organization', confidence: 0.8 } : n)
            : [],
        historicalContext: data.historicalContext,
        collectorSignificance: data.collectorSignificance,
        tags: Array.isArray(data.tags) ? data.tags : []
      };
    } catch (parseError) {
        console.error("Gemini JSON Parse Error:", text);
        throw new Error("Failed to parse Gemini response");
    }

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
}
