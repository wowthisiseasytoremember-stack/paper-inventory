import { runExpert } from '../src/lib/ai/expert';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const sampleOcrText = `MARVEL COMICS $1.25 US APPROVED $1.60 CAN 1 MAY UK 95p BY THE COMICS CODE SA AUTHORITY PURCELL RAM A

--- Web Entities (Knowledge Graph) ---
- Comics (79.8%)
- Comic book (73.3%)
- Marvel Comics (72.3%)
-  (72.3%)
- Cover date (56.8%)`;

  console.log('Testing Expert AI with Search Grounding...');
  try {
    const result = await runExpert('comic_books', sampleOcrText);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
