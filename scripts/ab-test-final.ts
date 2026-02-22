
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import * as dotenv from "dotenv";

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!; 
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

Output the analysis in strict JSON format. NO markdown, JSON only:
{
  "title": "Concise definitive title (Archival Format)",
  "guessedId": "Unique ID / Serial Number found, or null",
  "cleanedTranscription": "Verbatim reconstruction of all text",
  "confidence": 0.9,
  "identifiedNames": [{"name": "Name", "type": "person|organization|location", "confidence": 0.9}],
  "historicalContext": "Detailed historic narrative",
  "collectorSignificance": "Rarity and condition factors",
  "valuation": "Estimated value with logical reasoning",
  "tags": ["era-tag", "item-type", "condition-tag", "significance-level"]
}
`;

const PROMPT_V2 = `
${PROMPT_V1.replace("Extract ALL text in its logical reading order. Maintain exact hierarchy, line breaks, and whitespace in 'cleanedTranscription'.", "Extract ALL text in its logical reading order. For handwritten 19th-century documents, decipher script/cursive meticulously. Leave [illegible] for truly unreadable words.")}
`;

const PROMPT_V3 = `
${PROMPT_V2.replace("Estimate current market value (e.g., \"$15 - $35\" or \"Institutional Value\"). Justify based on historical importance and physical condition observed.", "Provide a realistic auction estimate for paper ephemera collectors (e.g., \"$10 - $25\"). If handwritten or signed by a notable historical figure (e.g., railroad executives), adjust value significantly upwards. Explain your reasoning.")}
`;

const PROMPT_V4 = `
${PROMPT_V3.replace("Determine the correct 'Upright' orientation of the document based on the text flow and structural markers.", "Mentally rotate the image until the primary text is upright before beginning analysis. Specifically identify handwritten signatures vs printed forms.")}
`;

async function testPrompt(name: string, prompt: string, base64: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType: "image/jpeg" } },
    ]);
    const text = result.response.text();
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    return { error: error.message };
  }
}

async function runTests() {
  const results: any = {};
  
  for (const [imgName, imgPath] of Object.entries(IMAGES)) {
    console.log(`\nTesting image: ${imgName}...`);
    if (!fs.existsSync(imgPath)) continue;

    console.log(`  -> Compressing image...`);
    const resizedBuffer = await sharp(imgPath)
        .rotate()
        .resize(1000, 1000, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
    const base64 = resizedBuffer.toString("base64");
    
    console.log(`  -> V1 (Baseline)...`);
    const v1 = await testPrompt("V1_Baseline", PROMPT_V1, base64);
    
    console.log(`  -> V2 (Handwriting focus)...`);
    const v2 = await testPrompt("V2_Handwriting", PROMPT_V2, base64);

    console.log(`  -> V3 (Auction Value focus)...`);
    const v3 = await testPrompt("V3_AuctionValue", PROMPT_V3, base64);
    
    console.log(`  -> V4 (Rotation & Signatures)...`);
    const v4 = await testPrompt("V4_RotateAndSignatures", PROMPT_V4, base64);

    results[imgName] = { V1: v1, V2: v2, V3: v3, V4: v4 };
    fs.writeFileSync("ab-test-final.json", JSON.stringify(results, null, 2));
  }

  console.log("\n✅ Tests complete. Saved to ab-test-final.json");
}

runTests();
