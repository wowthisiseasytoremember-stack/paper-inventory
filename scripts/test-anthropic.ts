
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function testAnthropic() {
  console.log("--- Testing Anthropic (Claude 3.5 Sonnet) via AI SDK ---");
  const imagePath = "public/training-data/dd_mayo_denver.jpg";
  
  if (!fs.existsSync(imagePath)) {
    console.error(`Image not found: ${imagePath}`);
    return;
  }

  const imageBuffer = fs.readFileSync(imagePath);

  try {
    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this document image in extreme detail. Identify the item, its historical significance, and estimated value. Output JSON only.",
            },
            {
              type: "image",
              image: imageBuffer,
            },
          ],
        },
      ],
    });

    console.log(text);
  } catch (error: any) {
    console.error("Anthropic failed:", error.message);
  }
}

testAnthropic();
