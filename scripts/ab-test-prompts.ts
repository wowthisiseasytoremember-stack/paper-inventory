
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const GOOGLE_API_KEY = "AIzaSyBIsSOJFJbM0fANbqHWWn6a_ce6iWRUQo0"; 
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const imagePath = "public/uploads/original/0a44bf64-3a87-484b-ab61-de1659a950ac.jpg";

const PROMPT_A = `
You are an expert document archivist. Analyze this image.
1. Transcribe all text.
2. Determine historical context.
3. Estimate valuation.
Output JSON only.
`;

const PROMPT_B = `
You are a forensic document analyst and historical valuation expert.
Analyze this document image with extreme precision and structural awareness.

Determine the 'Logical Vertical' orientation based on text.
Extract text verbatim. Note rarity and collector significance.

Fields:
"title", "guessedId", "cleanedTranscription", "historicalContext", "collectorSignificance", "valuation", "tags"

Output JSON only.
`;

const PROMPT_C = `
Identify this artifact as if you are a high-end auction house specialist (Sotheby's/Christie's).
Look for watermarks, print type (litho vs engrave), and historical provenance clues.
Be extremely detailed in "historicalContext".
Estimate valuation with a specific "Low - High" range and reasoning.

Output JSON only.
`;

async function testPrompt(name: string, prompt: string, modelName: string) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString("base64");

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    return response.text();
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

async function run() {
  const results: any = {};
  results.A = await testPrompt("Prompt A", PROMPT_A, "gemini-2.0-flash");
  results.B = await testPrompt("Prompt B", PROMPT_B, "gemini-2.0-flash");
  results.C = await testPrompt("Prompt C", PROMPT_C, "gemini-2.0-flash");
  fs.writeFileSync("ab-test-results.json", JSON.stringify(results, null, 2));
  console.log("Results saved to ab-test-results.json");
}

run();
