export interface MarketComp {
  description: string;
  soldPrice: string;
  date: string;
  platform: string;
  condition?: string;
}

export interface GroundedResearch {
  summary: string;
  comps: MarketComp[];
  keyFindings: string[];
  sources: Array<{ title: string; url: string; snippet?: string }>;
  searchQueries: string[];
  rawText?: string;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

function getApiKey(): string | null {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
}

function buildPrompt(baselineData: any): string {
  const title = baselineData?.title || 'Unknown item';
  const transcription = String(baselineData?.transcription || '').slice(0, 4000);
  const tags = Array.isArray(baselineData?.tags) ? baselineData.tags.join(', ') : '';
  const names = Array.isArray(baselineData?.identifiedNames)
    ? baselineData.identifiedNames.map((n: any) => n?.name || n).join(', ')
    : '';

  return `
You are a collectibles market research assistant. Use Google Search to find REAL pricing data.

PRIORITY SEARCHES (in order):
1. eBay SOLD listings — search "site:ebay.com sold" + item description. Sold prices are the only reliable comps.
2. Heritage Auctions, LiveAuctioneers — completed auction results.
3. Collector forums, price guides, CGC census (for comics).
4. Dealer sites specializing in the item's niche.

ITEM:
Title: ${title}
Transcription: ${transcription || 'N/A'}
Tags: ${tags || 'N/A'}
Names/Orgs: ${names || 'N/A'}

Return JSON only:
{
  "summary": "2-4 sentences: what it is, why collectors care, how common/rare",
  "comps": [
    {"description": "what sold", "soldPrice": "$X", "date": "YYYY-MM or approximate", "platform": "eBay/Heritage/etc", "condition": "if known"}
  ],
  "keyFindings": ["bullet 1 — pricing trend or rarity signal", "bullet 2"],
  "sources": [{"title": "source title", "url": "https://...", "snippet": "relevant detail"}],
  "searchQueries": ["the searches you ran"]
}

RULES:
- Only include comps with ACTUAL sold prices you found. Do not invent prices.
- If no comps found, return empty comps array and say so in summary.
- For 1990s comics: search CGC census + eBay sold for graded copies. Note if overprinted/common.
- For railroadiana (D&RG): search railroad memorabilia dealers, eBay "Denver Rio Grande" sold.
- Max 6 comps. Prefer recent sales (last 2 years).
  `.trim();
}

function extractGroundingSources(groundingMetadata: any): Array<{ title: string; url: string }> {
  const chunks = groundingMetadata?.groundingChunks || [];
  const sources: Array<{ title: string; url: string }> = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (web?.uri) {
      sources.push({ title: web.title || 'Source', url: web.uri });
    }
  }
  return sources;
}

function mergeSources(
  a: Array<{ title: string; url: string; snippet?: string }>,
  b: Array<{ title: string; url: string; snippet?: string }>
) {
  const byUrl = new Map<string, { title: string; url: string; snippet?: string }>();
  for (const source of [...a, ...b]) {
    if (!source?.url) continue;
    if (!byUrl.has(source.url)) {
      byUrl.set(source.url, source);
    }
  }
  return Array.from(byUrl.values()).slice(0, 6);
}

export async function getGroundedResearch(baselineData: any): Promise<GroundedResearch | null> {
  if (process.env.DEV_AI_MOCK === 'true') {
    return {
      summary: 'Mock grounded research summary.',
      comps: [],
      keyFindings: ['Mock finding 1', 'Mock finding 2'],
      sources: [],
      searchQueries: []
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[GeminiGrounding] No API key found. Skipping grounded research.');
    return null;
  }

  const modelName = process.env.GEMINI_GROUNDING_MODEL || DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${modelName}:generateContent`;
  const prompt = buildPrompt(baselineData);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    throw new Error(`[GeminiGrounding] HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p: any) => p?.text || '').join('\n') || '';

  let parsed: GroundedResearch | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  const groundingMetadata = candidate?.groundingMetadata;
  const metadataSources = extractGroundingSources(groundingMetadata).map(s => ({
    title: s.title,
    url: s.url
  }));

  const sources = mergeSources(parsed?.sources || [], metadataSources);
  const searchQueries = parsed?.searchQueries || groundingMetadata?.webSearchQueries || [];

  return {
    summary: parsed?.summary || 'No grounded summary provided.',
    comps: Array.isArray(parsed?.comps) ? parsed.comps : [],
    keyFindings: parsed?.keyFindings || [],
    sources,
    searchQueries,
    rawText: text
  };
}
