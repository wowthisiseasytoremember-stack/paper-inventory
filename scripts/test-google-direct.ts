import { analyzeImage } from '../src/lib/ai/google';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const files = fs.readdirSync('public/uploads/resized');
    if (files.length === 0) throw new Error("No files found");
    const realImg = 'public/uploads/resized/' + files[0];
    console.log('Testing google client directly with', realImg);
    const result = await analyzeImage(realImg, 'test text');
    console.log('Result:', result);
  } catch (e: any) {
    fs.writeFileSync('test-error-google.json', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    console.error('Direct catch error written to test-error-google.json');
  }
}

test();
