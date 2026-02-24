import 'dotenv/config';
import { analyzeImage } from '../src/lib/ai/openai-manual';
import path from 'path';
import fs from 'fs';

async function testCorePipeline() {
  console.log('🚀 TESTING CORE AI PIPELINE (OpenAI Only)...');
  
  // Use one of the existing resized images for the test
  const testImagePath = path.join(process.cwd(), 'public', 'uploads', 'resized', '01af157c-a962-454d-b425-b2acec087bb8.webp');
  
  if (!fs.existsSync(testImagePath)) {
      console.error('❌ Test image not found at', testImagePath);
      process.exit(1);
  }

  try {
    const result = await analyzeImage(testImagePath, 'D&RGW RAILROAD TIMETABLE');
    console.log('✅ AI SUCCESS!');
    console.log('ID:', result.title);
    console.log('Value:', result.valuation);
    console.log('Liquidity:', result.liquidity_score);
    console.log('Buy Target:', result.target_buy_price);
  } catch (err: any) {
    console.error('❌ AI FAILED:', err.message);
  }
}

testCorePipeline();
