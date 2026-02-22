/**
 * GOOGLE GEMINI PRO CLIENT (Upgraded)
 * 
 * Using Gemini 2.0 Pro Experimental for high-accuracy archival analysis.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { ItemMetadata } from "./schema";

const GEN_AI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!GEN_AI_KEY) {
  throw new Error("Missing GOOGLE_API_KEY or GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEN_AI_KEY);

const PROMPT = `
You are a master archivist, ephemera historian, and forensic document analyst.
Analyze this document image with extreme precision and structural awareness.

CRITICAL INSTRUCTION: ORIENTATION
Determine the correct 'Upright' orientation of the document based on the text flow and structural markers. 
If the text is sideways or upside down in the image, your analysis must still treat the logical 'Top' of the document as the reference point for transcription and identification.

Your tasks:
1. Verbatim Transcription: Extract ALL text in its logical reading order. Maintain exact hierarchy, line breaks, and whitespace in 'cleanedTranscription'.
2. Historical Synthesis: Determine the era, origin, and cultural context. Be detailed and specific about dates or printing methods found.
3. Collector Significance: Evaluate rarity. Look for specific signatures, stamps, unique typography, or watermark markers.
4. Valuation: Estimate current market value (e.g., "$15 - $35" or "Institutional Value"). Justify based on historical importance and physical condition observed.
5. Entity Extraction: Identify people, organizations, and specific geographic locations.

Output the analysis in strict JSON format:
{
  "title": "Concise definitive title (Archival Format)",
  "guessedId": "Unique ID / Serial Number found, or null",
  "cleanedTranscription": "Verbatim reconstruction of all text",
  "confidence": 0-1,
  "identifiedNames": [{"name": "Name", "type": "person|organization|location", "confidence": 0.9}],
  "historicalContext": "Detailed historic narrative",
  "collectorSignificance": "Rarity and condition factors",
  "valuation": "Estimated value with logical reasoning",
  "tags": ["era-tag", "item-type", "condition-tag", "significance-level"]
}

Output JSON ONLY. No markdown.
`;

export async function analyzeImage(imagePath: string, ocrHint: string): Promise<ItemMetadata> {
  try {
    // Upgrading to gemini-2.0-pro-exp-02-05 (or similar Pro model)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" });

    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString("base64");

    const ext = imagePath.split('.').pop()?.toLowerCase();
    let mimeType = "image/jpeg";
    if (ext === 'png') mimeType = "image/png";
    if (ext === 'webp') mimeType = "image/webp";

    const promptParts = [PROMPT];
    if (ocrHint) {
        promptParts.push(`\nOCR Hint (Tesseract): ${ocrHint}`);
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
    
    // Clean JSON response
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const data = JSON.parse(jsonStr);
      return {
        title: data.title || "Untitled",
        guessedId: data.guessedId,
        cleanedTranscription: data.cleanedTranscription,
        confidence: data.confidence || 0.8,
        identifiedNames: Array.isArray(data.identifiedNames) ? data.identifiedNames : [],
        historicalContext: data.historicalContext,
        collectorSignificance: data.collectorSignificance,
        valuation: data.valuation,
        tags: Array.isArray(data.tags) ? data.tags : []
      };
    } catch (parseError) {
        console.error("Gemini Pro JSON Parse Error:", text);
        throw new Error("AI output was non-parseable");
    }

  } catch (error) {
    console.error("Gemini Pro Analysis Failed:", error);
    throw error;
  }
}
