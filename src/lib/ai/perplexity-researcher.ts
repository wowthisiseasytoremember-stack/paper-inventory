/**
 * Perplexity Researcher
 * Uses Perplexity sonar-pro (live web search) for deep dive market research.
 * Replaces the Gemini grounding step — Perplexity returns citations + actual
 * sold price data from eBay, auction houses, and collector forums.
 */

import OpenAI from 'openai';

export interface PerplexityResearchResult {
  notes: string;
  citations: string[];
  raw_response: string;
}

const CATEGORY_PROMPTS: Record<string, string> = {
  comic_books: `You are a comic book market researcher with deep knowledge of the collector market.
Search for this specific comic book and provide:
1. **Publisher & issue details** — publisher, issue number, publication date, print run if known
2. **Key value signals** — first appearances, origin issues, notable variants (newsstand vs direct, holofoil, error prints), creator significance
3. **CGC/CBCS census data** — how many copies have been graded and at what grades
4. **Sold prices** — recent eBay SOLD listings with grade, price, and date. Check Heritage Auctions and ComicLink too.
5. **Market trend** — is this title/era/publisher rising or falling with collectors?
6. **Raw vs graded value gap** — what does an ungraded copy typically sell for vs a slabbed 9.8?`,

  railroadiana: `You are a railroadiana specialist and paper ephemera researcher.
Search for this specific railroad document and provide:
1. **Railroad company & document type** — which line, what kind of document (timetable, ticket, memo, map, pass), approximate date
2. **Historical significance** — was this railroad notable? Any significant routes, mergers, or eras represented?
3. **Collector community** — key collector clubs (Railroadiana Collectors Association, etc.), specialized auction houses
4. **Sold prices** — recent eBay SOLD listings, Ruby Lane, or specialized railroad ephemera auctions with prices and dates
5. **Rarity factors** — what makes certain railroad documents more valuable (pre-1900, defunct railroads, color lithography, specific routes)
6. **Market trend** — is railroadiana demand rising, stable, or declining?`,

  aerospace_technical: `You are a researcher specializing in aerospace and military technical document collecting.
Search for this specific document and provide:
1. **Company & program** — which aerospace company (NASA, Rockwell, Boeing, Grumman, etc.), which program or aircraft
2. **Document classification & type** — was it classified? Engineering drawing, spec sheet, internal memo?
3. **Historical significance** — is this from a notable program (Apollo, Space Shuttle, SR-71, etc.)?
4. **Collector market** — who buys these? Space memorabilia auction houses (RR Auction, Heritage, Bonhams Space)
5. **Sold prices** — comparable documents sold at auction or on eBay with prices and dates
6. **Authenticity factors** — what makes these valuable vs. reproductions (original stamps, signatures, correct paper stock)`,

  serial_publications: `You are a vintage magazine and serial publication researcher.
Search for this specific magazine or publication and provide:
1. **Publication details** — title, issue date, volume/issue number, publisher
2. **Notable content** — any significant articles, cover subjects, advertisements, or features that drive collector interest
3. **Key value drivers** — first issues, notable covers (celebrities, events), significant advertisements (early tech, cars, games)
4. **Sold prices** — recent eBay SOLD listings, Etsy sales, or magazine dealer prices with condition and date
5. **Condition impact** — how much does condition (address label, mailing crease, loose pages) affect value for this title?
6. **Market trend** — is this genre/era of publication rising with collectors?`,

  analog_media_electronics: `You are a vintage vinyl record, cassette, and analog media researcher.
Search for this specific item and provide:
1. **Release details** — artist, title, label, catalog number, pressing country and year
2. **Pressing significance** — original vs. repress, promo copy, colored vinyl, limited edition — any matrix/runout etchings noted
3. **Discogs market data** — search Discogs for this specific pressing's sales history, median price, and current listings
4. **eBay sold prices** — recent completed sales with condition and price
5. **Grading impact** — VG+ vs NM price difference for this specific record
6. **Market trend** — is this artist/label/genre rising or falling on the collector market?`,

  stamps_postal: `You are a philatelist and postal history researcher.
Search for this specific stamp or postal item and provide:
1. **Scott catalog identification** — Scott number, country, year of issue, denomination
2. **Variety & condition specifics** — mint vs. used, centering, cancel type (manuscript, machine, CDS), gum status
3. **Census/population data** — how common is this stamp in high grade?
4. **Sold prices** — recent auction results from Siegel, Spink, Kelleher, H.R. Harmer, or eBay Philately with prices and dates
5. **Key value factors** — what makes this stamp more valuable (inverts, color errors, rare cancels, first day covers)
6. **Market trend** — is this country/era of philately rising or falling with collectors?`,

  geographic_media: `You are an antique map and cartography researcher.
Search for this specific map and provide:
1. **Cartographer & publisher** — who made it, who published it, what atlas or series it came from, date
2. **Geographic & historical significance** — what region, what era, any notable features (early depiction, political boundaries of the time)
3. **Condition factors specific to maps** — hand coloring (original vs. later), foxing, centerfold, margins, trimming
4. **Sold prices** — recent Barry Lawrence Ruderman, Old World Auctions, Antique Map Price Record, or eBay sold listings with prices and dates
5. **Rarity** — how many examples are known? Is this from a common atlas or a scarce publication?
6. **Market trend** — is this cartographer, region, or era of mapping currently in demand?`,

  general_vintage_ephemera: `You are a vintage paper ephemera and antique document researcher.
Search for this specific item and provide:
1. **Item identification** — what exactly is this? Type, date, origin, publisher or issuer
2. **Collector category** — which collecting niche does this fall into (advertising, trade cards, postcards, photographs, broadsides, etc.)?
3. **Comparable sold prices** — recent eBay SOLD listings, Etsy, Ruby Lane, or auction houses for similar items with prices and dates
4. **Key value drivers** — subject matter, graphic quality, condition, age, regional interest, celebrity/brand connection
5. **Market trend** — is interest in this type of ephemera rising, stable, or falling?
6. **Where collectors find these** — which platforms/venues are most active for this type of item?`,
};

export async function runPerplexityResearcher(
  category: string,
  ocrText: string,
  title?: string,
): Promise<PerplexityResearchResult> {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('[Perplexity Researcher] No API key — skipping research step.');
    return { notes: 'Research step skipped (no API key).', citations: [], raw_response: '' };
  }

  const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  });

  const categoryPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.general_vintage_ephemera;
  const itemRef = title ? `Identified as: "${title}"` : '';
  const prompt = `${categoryPrompt}

${itemRef}

[OCR / EXTRACTED TEXT]:
${ocrText.slice(0, 3000)}

Be specific with dollar amounts and dates. Cite actual sold listings. This research goes directly to a senior appraiser setting a final sale price.`;

  try {
    const response = await client.chat.completions.create({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2048,
    });

    const text = response.choices[0]?.message?.content || '';
    // Perplexity returns citations on the response object (non-standard field)
    const citations: string[] = (response as any).citations || [];

    console.log(`[Perplexity Researcher] Research complete. ${citations.length} citations.`);

    return {
      notes: text,
      citations,
      raw_response: JSON.stringify({ text, citations }),
    };
  } catch (err: any) {
    console.error(`[Perplexity Researcher] Error: ${err.message}`);
    // Non-fatal — pipeline continues without research notes
    return {
      notes: 'Perplexity research step failed or unavailable.',
      citations: [],
      raw_response: err.message,
    };
  }
}
