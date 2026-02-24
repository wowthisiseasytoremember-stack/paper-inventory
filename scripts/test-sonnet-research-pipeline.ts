import { runResearcher } from './src/lib/ai/researcher';
import { runExpert } from './src/lib/ai/expert';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testPipeline() {
  const sampleOcrText = `MARVEL COMICS $1.25 US APPROVED $1.60 CAN 1 MAY UK 95p BY THE COMICS CODE SA AUTHORITY PURCELL RAM A

--- Web Entities (Knowledge Graph) ---
- Comics (79.8%)
- Comic book (73.3%)
- Marvel Comics (72.3%)
-  (72.3%)
- Cover date (56.8%)`;

  console.log('1. Testing Researcher AI with Search Grounding...');
  let researchData = '';
  try {
    const researchResult = await runResearcher('comic_books', sampleOcrText);
    console.log('--- Researcher Output ---');
    console.log(researchResult.notes);
    researchData = researchResult.notes;
  } catch (err) {
    console.error(err);
  }

  console.log('
2. Testing Expert AI (Sonnet) with Research Data...');
  try {
    const expertResult = await runExpert('comic_books', sampleOcrText, researchData);
    console.log('--- Expert Output (JSON) ---');
    console.log(JSON.stringify(expertResult, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testPipeline();
