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

CRITICAL INSTRUCTION: ORIENTATION & HANDWRITING
Mentally rotate the image until the primary text is upright before beginning analysis.
Extract ALL text in its logical reading order. For handwritten 19th-century documents, decipher script/cursive meticulously. Do not use [illegible] unless the word is completely destroyed; use context to make an educated extraction.

Your tasks:
1. Verbatim Transcription: Extract ALL text. Maintain exact hierarchy, line breaks, and whitespace in 'cleanedTranscription'.
2. Historical Synthesis: Determine the era, origin, and cultural context. Be detailed and specific about dates or printing methods found.
3. Collector Significance: Evaluate rarity. Specifically identify handwritten signatures vs printed forms. 
4. Valuation: Provide a realistic auction estimate for paper ephemera collectors (e.g., "$10 - $25"). 
   * CRITICAL VALUE MODIFIER: If the document is signed by a notable historical figure, or belongs to a highly collectible niche (e.g., "Railroadiana", Denver & Rio Grande executives like D.D. Mayo, Military generals, etc.), adjust the value significantly upwards. Explain your reasoning.
5. Entity Extraction: Identify people, organizations, and specific geographic locations.

Output the analysis in strict JSON format:
{
  "title": "Concise definitive title (Archival Format)",
  "guessedId": "Unique ID / Serial Number found, or null",
  "cleanedTranscription": "Verbatim reconstruction of all text",
  "confidence": 0.9,
  "identifiedNames": [{"name": "Name", "type": "person|organization|location", "confidence": 0.9}],
  "historicalContext": "Detailed historic narrative",
  "collectorSignificance": "Rarity and condition factors. Emphasize notable signatures.",
  "valuation": "Estimated auction value with logical reasoning based on niche collector demand.",
  "tags": ["era-tag", "item-type", "condition-tag", "niche-market"]
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
