import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import 'dotenv/config';

console.log('API Key First 10 chars:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));

async function main() {
  try {
    const { text } = await generateText({
      model: anthropic('claude-3-5-sonnet-20240620'),
      prompt: 'Hello world',
    });
    console.log('Success:', text);
  } catch (error: any) {
    console.error('Failure:', error);
    if (error.responseBody) {
       console.error('Response Body:', await error.responseBody.text());
    }
    console.error('Full Error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
}

main();
