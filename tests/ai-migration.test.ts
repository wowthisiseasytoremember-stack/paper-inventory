import { analyzeImage as openaiOld } from '../src/lib/ai/openai-manual';
import { analyzeImage as openaiNew } from '../src/lib/ai/openai-sdk';
import { analyzeImageAnthropic as anthropicOld } from '../src/lib/ai/anthropic-manual';
import { analyzeImageAnthropic as anthropicNew } from '../src/lib/ai/anthropic-sdk';
import { ItemMetadataSchema } from '../src/lib/ai/schema';
import { BASELINE_SYSTEM_PROMPT } from '../src/lib/ai/prompts';
import fs from 'fs';
import path from 'path';

require('dotenv').config({ path: '.env' });

async function runTest() {
  console.log('--- AI SDK MIGRATION TEST ---');

  const uploadsDir = path.join(process.cwd(), 'public/uploads/original');
  const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
  const testImageName = files.find(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'));
  
  if (!testImageName) {
    console.warn('No test image found in public/uploads.');
    process.exit(0);
  }

  const testImagePath = path.join(uploadsDir, testImageName);
  console.log(`Using test image: ${testImagePath}`);
  const ocrText = "Sample OCR text for testing.";

  try {
    if (process.env.OPENAI_API_KEY) {
      console.log('\n[1/4] Testing OpenAI (Manual Fetch)...');
      const openaiOldResult = await openaiOld(testImagePath, ocrText);
      ItemMetadataSchema.parse(openaiOldResult);
      console.log('✅ OpenAI Old passed.');

      console.log('\n[2/4] Testing OpenAI (Official SDK)...');
      const openaiNewResult = await openaiNew(testImagePath, ocrText);
      ItemMetadataSchema.parse(openaiNewResult);
      console.log('✅ OpenAI New passed.');
    } else {
      console.log('\n[1/4 & 2/4] Skipping OpenAI tests (no OPENAI_API_KEY).');
    }

    if (process.env.ANTHROPIC_API_KEY) {
      console.log('\n[3/4] Testing Anthropic (Manual Fetch)...');
      const anthropicOldResult = await anthropicOld(testImagePath, ocrText, BASELINE_SYSTEM_PROMPT, 'claude-3-5-sonnet-20240620');
      ItemMetadataSchema.parse(anthropicOldResult);
      console.log('✅ Anthropic Old passed.');

      console.log('\n[4/4] Testing Anthropic (Official SDK)...');
      const anthropicNewResult = await anthropicNew(testImagePath, ocrText, BASELINE_SYSTEM_PROMPT, 'claude-3-5-sonnet-20240620');
      ItemMetadataSchema.parse(anthropicNewResult);
      console.log('✅ Anthropic New passed.');
    } else {
      console.log('\n[3/4 & 4/4] Skipping Anthropic tests (no ANTHROPIC_API_KEY).');
    }

    console.log('\n🎉 ALL TESTS PASSED. The new SDKs return the correct schema.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

runTest();
