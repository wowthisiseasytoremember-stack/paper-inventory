import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  const GEN_AI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!GEN_AI_KEY) {
    console.error("Missing API Key");
    return;
  }

  const genAI = new GoogleGenerativeAI(GEN_AI_KEY);
  try {
    // List models is not directly exposed in the same way in all SDK versions 
    // but we can try a simple generation with a known model to verify.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent("test");
    console.log("SUCCESS with gemini-1.5-flash-latest:", result.response.text());
  } catch (e: any) {
    console.error("FAILED with gemini-1.5-flash-latest:", e.message);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const result = await model.generateContent("test");
        console.log("SUCCESS with gemini-1.5-pro-latest:", result.response.text());
    } catch (e2: any) {
        console.error("FAILED with gemini-1.5-pro-latest:", e2.message);
    }
  }
}

listModels();
