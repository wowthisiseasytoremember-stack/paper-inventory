
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const GOOGLE_API_KEY = "AIzaSyBIsSOJFJbM0fANbqHWWn6a_ce6iWRUQo0"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

const IMAGES = {
  comic: "public/uploads/original/0a44bf64-3a87-484b-ab61-de1659a950ac.jpg",
  freightReceipt: "public/uploads/original/image1.jpg",
  railroadLetter: "public/uploads/original/image2.jpg",
  mercantileLetter: "public/uploads/original/image3.jpg"
};

const PROMPT_V1 = `
You are a forensic document analyst and historical valuation expert.
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

const PROMPT_V2 = `
${PROMPT_V1.replace("Extract ALL text in its logical reading order. Maintain exact hierarchy, line breaks, and whitespace in 'cleanedTranscription'.", "Extract ALL text in its logical reading order. For handwritten documents, decipher cursive meticulously. Maintain exact hierarchy, line breaks, and whitespace in 'cleanedTranscription'. Leave [illegible] for truly unreadable words.")}
`;

async function testPrompt(name: string, prompt: string, imageBase64: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0 },
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
    }

    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { error: error.message };
  }
}

async function runTests() {
  const results: any = {};
  
  let i = 0;
  for (const [imgName, imgPath] of Object.entries(IMAGES)) {
    console.log(`\n[${++i}/4] Testing image: ${imgName}...`);
    
    if (!fs.existsSync(imgPath)) {
       console.log(`  -> File not found: ${imgPath}`);
       continue;
    }

    // Shrink the image significantly so we don't timeout the HTTP base64 upload
    console.log(`  -> Processing image (compressing)...`);
    const resizedBuffer = await sharp(imgPath)
        .rotate()
        .resize(1000, 1000, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
    const base64 = resizedBuffer.toString("base64");
    
    console.log(`  -> Running V1 (Baseline)...`);
    const v1 = await testPrompt("V1_Baseline", PROMPT_V1, base64);
    
    await new Promise(r => setTimeout(r, 4000));
    
    console.log(`  -> Running V2 (Handwriting focus)...`);
    const v2 = await testPrompt("V2_Handwriting", PROMPT_V2, base64);

    results[imgName] = { V1_Baseline: v1, V2_Handwriting: v2 };
    fs.writeFileSync("ab-test-results-iteration-2.json", JSON.stringify(results, null, 2));
    
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log("\n✅ Tests complete. Results saved to ab-test-results-iteration-2.json");
}

runTests();
