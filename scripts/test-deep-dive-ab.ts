import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

const IMAGE_PATH = "public/uploads/original/image3.jpg"; // D.D. Mayo Letter (Receipt)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;

const MOCK_BASELINE = JSON.stringify({
  "title": "Denver and Rio Grande Railroad Co. Letter, 1890",
  "cleanedTranscription": "THE DENVER AND RIO GRANDE RAILROAD CO.\\nEXPRESS DEPARTMENT.\\nDenver, Colorado, Sept. 15th 1890\\nD. D. MAYO, GENERAL AGENT,\\n1609 LAWRENCE STREET.\\nMr. M. M. Hastings\\nAgent Delta\\nDear Sir\\nPlease notify Mr. Stephan that\\nour rate on laundry matter, is\\n\"pound rate\" or 3/4c per pound No\\ncharge less than 75c. Same must\\nbe used to show what it is\\nYours truly\\nD. D. Mayo",
  "identifiedNames": [
    { "name": "D. D. Mayo", "type": "person", "confidence": 0.9 },
    { "name": "M. M. Hastings", "type": "person", "confidence": 0.9 },
    { "name": "Denver and Rio Grande Railroad Co.", "type": "organization", "confidence": 1.0 }
  ]
});

const DEEP_DIVE_PROMPT = `You are a Senior Auction House Specialist and Master Archivist. 
You are performing a "Deep Dive" secondary analysis on a piece of paper ephemera.

You will be provided with:
1. The raw image of the document.
2. A JSON string containing the 'Baseline Extraction' (transcription, basic entities) performed by a junior archivist.

BASELINE EXTRACTION:
${MOCK_BASELINE}

YOUR CRITICAL TASKS:
1. Verification: Review the junior archivist's transcription and extracted entities against the image. If they misread a critical signature or date, correct it.
2. Exhaustive Historical Research: Use your extensive pre-trained knowledge to research the identified entities (people, organizations, locations). 
   - Tell me absolutely everything you know about D.D. Mayo of the Denver & Rio Grande Railroad.
3. Niche Market Valuation: Re-evaluate the item's auction value specifically within niche collector markets (e.g., "Railroadiana", "Postal History").
   - Signatures of notable executives carry massive premiums. Adjust the valuation upwards significantly if verified.
   - Explain your valuation reasoning in deep detail.

Output a highly detailed text report. Do not output JSON for this test, just give me your full thought process and analysis.`;

async function testOpenAI(base64Image: string) {
  console.log("\\n\\n==========================================");
  console.log("🤖 TESTING OPENAI (gpt-4o) 🤖");
  console.log("==========================================\\n");
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: DEEP_DIVE_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      temperature: 0.2, // Low temp for more factual analysis
    })
  });

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    console.log(data.choices[0].message.content);
  } else {
    console.log("Error:", data);
  }
}

async function testGemini(base64Image: string) {
  console.log("\\n\\n==========================================");
  console.log("🌌 TESTING GOOGLE (gemini-2.0-pro-exp-02-05) 🌌");
  console.log("==========================================\\n");
  
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  try {
    const result = await model.generateContent([
      DEEP_DIVE_PROMPT,
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
    ]);
    console.log(result.response.text());
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}

async function run() {
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const base64Image = imageBuffer.toString("base64");
  
  await testOpenAI(base64Image);
  await testGemini(base64Image);
}

run();
