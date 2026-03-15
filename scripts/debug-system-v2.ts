import 'dotenv/config';
import { runConductor } from '../src/lib/ai/conductor';
import { runResearcher } from '../src/lib/ai/researcher';
import { runExpert } from '../src/lib/ai/expert';

async function runSystemDiagnostics() {
  console.log('🚀 SYSTEM DIAGNOSTICS V2 (2026)');
  console.log('-------------------------------');

  const testCases = [
    {
      name: 'Standard Railroadiana',
      ocr: 'Union Pacific Railroad Employee Timetable No. 14, September 26, 1954. Nebraska Division.'
    },
    {
      name: '1990s Comic Book',
      ocr: 'The Uncanny X-Men #266, First appearance of Gambit. August 1990. Marvel Comics.'
    }
  ];

  for (const tc of testCases) {
    console.log('\n[TEST CASE: ' + tc.name + ']');
    try {
      // 1. Conductor
      console.log('-> Running Conductor...');
      const conductor = await runConductor(tc.ocr);
      console.log('   Result: ' + conductor.category + ' (' + (conductor.confidence_score * 100).toFixed(1) + '%)');

      // 2. Researcher (PERPLEXITY PRIMARY)
      console.log('-> Running Researcher (Perplexity Primary)...');
      const researcher = await runResearcher(conductor.category, tc.ocr);
      console.log('   Provider Used: ' + researcher.provider.toUpperCase());
      console.log('   Notes Snippet: ' + researcher.notes.substring(0, 150) + '...');

      // 3. Expert
      console.log('-> Running Expert (Standardized Mapping)...');
      const expert = await runExpert(conductor.category, tc.ocr, researcher.notes);
      console.log('   Identification: ' + expert.identification);
      console.log('   Value Estimate: ' + expert.estimated_value);
      console.log('   Search Terms:   ' + expert.ebay_search_keywords.join(', '));

      console.log('✅ ' + tc.name + ' PASSED');
    } catch (err: any) {
      console.error('❌ ' + tc.name + ' FAILED:', err.message);
    }
  }

  console.log('\n-------------------------------');
  console.log('DIAGNOSTICS COMPLETE');
}

runSystemDiagnostics().catch(console.error);
