/**
 * E2E SMOKE TEST
 * Runs the full pipeline manually for a test asset.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local specifically
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { performCloudVisionOCR } from '../src/lib/ocr/cloud-vision';
import { runConductor } from '../src/lib/ai/conductor';
import { runPerplexityResearcher } from '../src/lib/ai/perplexity-researcher';
import { extractValuation } from '../src/lib/ai/valuator';

async function runTest() {
  const imageName = process.argv[2] || 'smoke-test.jpg';
  console.log('🏁 Starting E2E Smoke Test for: ' + imageName);
  
  const testImagePath = path.join(process.cwd(), 'test-assets', imageName);
  console.log('📸 Image Path: ' + testImagePath);

  try {
    // 1. OCR
    console.log('\n--- [1/5] OCR (Google Cloud Vision) ---');
    const ocrResult = await performCloudVisionOCR(testImagePath);
    console.log('✅ Text Extracted (' + ocrResult.text.length + ' chars)');
    
    const entities = ocrResult.webEntities?.map(e => e.description).join(', ') || 'None';
    console.log('✅ Web Entities: ' + entities);

    const fullOcrText = ocrResult.text + (ocrResult.webEntities?.length ? '\n\n--- Web Entities ---\n' + ocrResult.webEntities.map(e => '- ' + e.description).join('\n') : '');

    // Prepare image for Conductor
    const imageBuffer = fs.readFileSync(testImagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // 2. Conductor
    console.log('\n--- [2/5] CONDUCTOR (Categorization) ---');
    const conductorResult = await runConductor(fullOcrText, imageBase64);
    console.log('✅ Category: ' + conductorResult.category);
    console.log('✅ Basic ID: ' + conductorResult.basic_id);
    console.log('✅ Confidence: ' + conductorResult.confidence_score);

    // 3. Perplexity
    console.log('\n--- [3/4] PERPLEXITY (Market Research) ---');
    const researchResult = await runPerplexityResearcher(conductorResult.category, fullOcrText, conductorResult.basic_id);
    console.log('✅ Citations: ' + researchResult.citations.length);
    console.log('✅ Research Note Preview: ' + researchResult.notes.substring(0, 200) + '...');

    // 4. Valuator
    console.log('\n--- [4/4] VALUATOR (Pricing & Archival Synthesis) ---');
    const valuationResult = await extractValuation(
      conductorResult.basic_id,
      conductorResult.category,
      fullOcrText,
      researchResult.notes
    );
    
    if (valuationResult) {
        console.log('✅ Formal Title: ' + valuationResult.title);
        console.log('✅ Estimated Value: $' + valuationResult.estimated_value_point);
        console.log('✅ Confidence: ' + valuationResult.value_confidence);
        console.log('✅ Potential Value: ' + valuationResult.potential_value_factors);
        console.log('✅ Reasoning: ' + valuationResult.value_reasoning);
    } else {
        console.log('⚠️  Valuation Result was null');
    }

    console.log('\n🏆 E2E PIPELINE TEST PASSED');
  } catch (err: any) {
    console.error('\n❌ TEST FAILED: ' + err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

runTest();
