/**
 * Quick test: run Perplexity researcher against real item OCR text
 * Usage: npx tsx scripts/test-perplexity.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { runPerplexityResearcher } from '../src/lib/ai/perplexity-researcher';

const TEST_ITEMS = [
  {
    label: 'Blackweb Comic (Inks Inks Comics)',
    category: 'comic_books',
    ocr: `BLACKWEB
INKS INKS COMICS
Issue #1
Superhero character in red and black costume with spider/web theme
Purple and yellow explosion background
Barcode visible bottom left`,
  },
  {
    label: 'Vintage SNES Ad Page — Alien 3 / T2 Judgment Day',
    category: 'serial_publications',
    ocr: `BAD TO THE BONE!
ALIEN 3 — SUPER NINTENDO
T2 TERMINATOR 2 JUDGMENT DAY — SUPER NINTENDO
FEEL THE TERROR! EXPLOSIVE FIREPOWER! DESTROY CYBERDYNE RESEARCH! HASTA LA VISTA BABY!
THE FUTURE IS IN YOUR HANDS AS A LONE WARRIOR IN THE ULTIMATE METAL-WRENCHING
CAPTAIN GLORY — NIGHTLINER
BACK ON SUPER NES!
Nintendo licensed product`,
  },
];

async function main() {
  for (const item of TEST_ITEMS) {
    console.log('\n' + '='.repeat(70));
    console.log(`ITEM: ${item.label}`);
    console.log(`CATEGORY: ${item.category}`);
    console.log('='.repeat(70));
    console.log('Calling Perplexity sonar-pro...\n');

    const start = Date.now();
    const result = await runPerplexityResearcher(item.category, item.ocr);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`--- RESEARCH NOTES (${elapsed}s) ---`);
    console.log(result.notes);

    if (result.citations.length > 0) {
      console.log(`\n--- CITATIONS (${result.citations.length}) ---`);
      result.citations.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
    } else {
      console.log('\n(no citations returned)');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Test complete.');
}

main().catch(console.error);
