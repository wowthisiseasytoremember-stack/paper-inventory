
import { analyzeImage } from "./src/lib/ai/google";
import * as dotenv from "dotenv";

dotenv.config();

async function testIntegratedPrompt() {
  console.log("Testing new production Google Gemini prompt...");
  try {
    const result = await analyzeImage("public/uploads/original/image2.jpg", "");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
  }
}

testIntegratedPrompt();
