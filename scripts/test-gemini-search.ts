import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [
      {
        // @ts-ignore
        googleSearch: {}
      }
    ]
  });

  const result = await model.generateContent("What is the current price of Action Comics #1?");
  console.log(result.response.text());
}

run().catch(console.error);
