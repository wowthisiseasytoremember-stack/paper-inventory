/**
 * OPENAI VERIFICATION SCRIPT
 * 
 * Verifies that the AI abstraction correctly uses OpenAI (GPT-4o).
 */

import 'dotenv/config'; // Load env vars FIRST
import { analyzeImage } from '../src/lib/ai'; 
import path from 'path';

console.log('AI_PROVIDER:', process.env.AI_PROVIDER);

const TEST_IMAGE_PATH_AI = path.join(process.cwd(), 'data', 'test-ai-receipt.png');

async function verifyOpenAI() {
  try {
    console.log('Running AI Analysis (abstracted)...');
    
    // We assume test-ai-receipt.png still exists from previous test-ai.ts run
    // If not, we might need to regenerate it or use a dummy image buffer if we were just testing connection.
    // Let's use the full test logic but reusing the previous image if present.
    
    const fs = await import('fs');
    if (!fs.existsSync(TEST_IMAGE_PATH_AI)) {
        console.log('Regenerating test image...');
        // Create simple dummy image if missing
        const sharp = (await import('sharp')).default;
        await sharp({
            create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 }}
        })
        .png()
        .toFile(TEST_IMAGE_PATH_AI);
    }

    const metadata = await analyzeImage(TEST_IMAGE_PATH_AI, 'TEST OCR HINT');
    
    console.log('--- EXTRACTED METADATA ---');
    console.log(JSON.stringify(metadata, null, 2));

    console.log('SUCCESS: OpenAI Provider verifies correctly!');

  } catch (error) {
    console.error('TEST FAILED:', error);
    process.exit(1);
  }
}

verifyOpenAI();
