
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

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

Output the analysis in strict JSON format. NO markdown, JSON only.
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

async function testPrompt(name: string, prompt: string, imageBuffer: Buffer) {
  try {
    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      messages: [
        {
          role: "user",
          content: [
             { type: "image", image: imageBuffer },
             { type: "text", text: prompt }
          ]
        }
      ]
    });
    
    // Clean it up
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

    const imageBuffer = fs.readFileSync(imgPath);
    
    console.log(`  -> V1 (Baseline)...`);
    const v1 = await testPrompt("V1_Baseline", PROMPT_V1, imageBuffer);
    
    console.log(`  -> V2 (Handwriting focus)...`);
    const v2 = await testPrompt("V2_Handwriting", PROMPT_V2, imageBuffer);

    console.log(`  -> V3 (Auction Value focus)...`);
    const v3 = await testPrompt("V3_AuctionValue", PROMPT_V3, imageBuffer);
    
    console.log(`  -> V4 (Rotation & Signatures)...`);
    const v4 = await testPrompt("V4_RotateAndSignatures", PROMPT_V4, imageBuffer);

    results[imgName] = { V1: v1, V2: v2, V3: v3, V4: v4 };
    fs.writeFileSync("ab-test-anthropic.json", JSON.stringify(results, null, 2));
  }

  console.log("\n✅ Tests complete. Saved to ab-test-anthropic.json");
}

runTests();
