import { GoogleGenerativeAI } from '@google/generative-ai';

export type DeepDiveCategory = 'comics_1990s' | 'drg_railroadiana' | 'other';

function getApiKey(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

function heuristicCategory(baselineData: any): DeepDiveCategory {
  const title = String(baselineData?.title || '');
  const transcription = String(baselineData?.transcription || '');
  const tags = Array.isArray(baselineData?.tags) ? baselineData.tags.join(' ') : '';
  const text = `${title} ${transcription} ${tags}`.toLowerCase();

  const drgSignals = [
    'd&rg',
    'd & rg',
    'd.r.g.',
    'denver & rio grande',
    'denver and rio grande',
    'rio grande western',
    'd&rgw',
    'denver rio grande'
  ];
  if (drgSignals.some(s => text.includes(s))) return 'drg_railroadiana';

  const comicSignals = ['comic', 'comics', 'marvel', 'dc', 'image', 'issue', '#'];
  const hasComicSignal = comicSignals.some(s => text.includes(s));
  const has1990s = /\b199\d\b/.test(text);
  if (hasComicSignal && (has1990s || text.includes('199'))) return 'comics_1990s';

  return 'other';
}

export async function categorizeForDeepDive(baselineData: any): Promise<DeepDiveCategory> {
  if (process.env.DEV_AI_MOCK === 'true') return heuristicCategory(baselineData);

  const apiKey = getApiKey();
  if (!apiKey) return heuristicCategory(baselineData);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
Classify this item into one category:
- comics_1990s
- drg_railroadiana (Denver & Rio Grande railroadiana, early 1900s)
- other

Return JSON only: {"category":"...","confidence":0.0-1.0,"reason":"short"}

TITLE: ${baselineData?.title || 'N/A'}
TRANSCRIPTION: ${(baselineData?.transcription || '').slice(0, 4000)}
TAGS: ${Array.isArray(baselineData?.tags) ? baselineData.tags.join(', ') : 'N/A'}
    `.trim();

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const category = parsed?.category as DeepDiveCategory;

    if (category === 'comics_1990s' || category === 'drg_railroadiana') {
      return category;
    }
  } catch (err) {
    console.warn('[GeminiTriage] Falling back to heuristic.', err);
  }

  return heuristicCategory(baselineData);
}
