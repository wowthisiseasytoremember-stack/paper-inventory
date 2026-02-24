import 'dotenv/config';
import { analyzeImage } from '../src/lib/ai/openai-manual';
import path from 'path';
import fs from 'fs';

async function testAnthropicPipeline() {
  console.log('🚀 TESTING CORE AI PIPELINE (Anthropic Only)...');
  
  // Use the D.D. Mayo letter image directly
  const testImagePath = 'C:\\Users\\wowth\\Documents\\projects\\20260207_010826.jpg';
  
  if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found at', testImagePath);
      process.exit(1);
  }

  try {
    const result = await analyzeImage(testImagePath, 'D&RGW RAILROAD TIMETABLE');
    console.log('✅ AI SUCCESS!');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('❌ AI FAILED:', err.message);
  }
}

testAnthropicPipeline();
