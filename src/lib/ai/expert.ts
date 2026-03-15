/**
 * Expert AI Dispatcher
 * Routes to category-specific expert prompts
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXPERT_PROMPTS: Record<string, string> = {
  comic_books: `You are an expert comic book appraiser. Analyze this comic and extract the following data.
REQUIRED FIELDS:
- identification: Title and Issue Number (e.g. "The Amazing Spider-Man #129")
- historical_context: Key history (e.g. First Appearance of Punisher)
- collector_significance: Why collectors want it
- estimated_value: Market range (e.g. "$50 - $150")
- ebay_search_keywords: 3-5 keywords for searching comps`,

  railroadiana: `You are a railroad history expert. Analyze this document and extract:
REQUIRED FIELDS:
- identification: Company and Document Type (e.g. "Santa Fe 1954 Timetable")
- historical_context: Route and era significance
- collector_significance: Rarity and interest level
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,

  aerospace_technical: `You are an aerospace technical document expert. Analyze and extract:
REQUIRED FIELDS:
- identification: Company and Document Title
- historical_context: Program (NASA, Apollo, etc)
- collector_significance: Historical importance
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,

  serial_publications: `You are a vintage magazine expert. Analyze and extract:
REQUIRED FIELDS:
- identification: Title and Date
- historical_context: Notable content or cover star
- collector_significance: Rarity or historical importance
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,

  analog_media_electronics: `You are a vintage audio/electronics expert. Analyze and extract:
REQUIRED FIELDS:
- identification: Artist, Title, and Format
- historical_context: Edition or release era
- collector_significance: Rarity/collectibility
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,

  stamps_postal: `You are a philately expert. Analyze and extract:
REQUIRED FIELDS:
- identification: Country, Denomination, and Issue
- historical_context: Postal history context
- collector_significance: Philatelic interest
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,

  geographic_media: `You are a cartography expert. Analyze and extract:
REQUIRED FIELDS:
- identification: Map/Chart Type and Region
- historical_context: Date and cartographer
- collector_significance: Historical significance
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,

  general_vintage_ephemera: `You are a general vintage items appraiser. Analyze and extract:
REQUIRED FIELDS:
- identification: Item name/type
- historical_context: Subject matter and date
- collector_significance: Interest level
- estimated_value: Market range
- ebay_search_keywords: 3-5 keywords`,
};

export interface ExpertResult {
  identification: string;
  historical_context: string;
  collector_significance: string;
  estimated_value: string;
  ebay_search_keywords: string[];
  raw_response: string;
  // keeping old names for safety in interface but we will use the new ones
  title?: string; 
}

export async function runExpert(
  category: string,
  ocrText: string,
  researchData?: string,
  imageBase64?: string
): Promise<ExpertResult> {
  const expertPrompt = EXPERT_PROMPTS[category] || EXPERT_PROMPTS.general_vintage_ephemera;

  try {
    const promptText = researchData 
      ? `${expertPrompt}\n\n[OCR TEXT & WEB ENTITIES]:\n${ocrText}\n\n[RESEARCHER NOTES (Google Search Grounding)]:\n${researchData}`
      : `${expertPrompt}\n\n[OCR TEXT & WEB ENTITIES]:\n${ocrText}`;

    const content: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: `${promptText}\n\nIMPORTANT: You must respond ONLY with a valid JSON object.`,
      },
    ];

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON
    let result: ExpertResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      const parsed = JSON.parse(jsonMatch[0]);
      
      result = {
        identification: parsed.identification || parsed.title || '[Unable to identify]',
        historical_context: parsed.historical_context || '[No context extracted]',
        collector_significance: parsed.collector_significance || '[N/A]',
        estimated_value: parsed.estimated_value || '[Unknown]',
        ebay_search_keywords: Array.isArray(parsed.ebay_search_keywords) ? parsed.ebay_search_keywords : [],
        raw_response: responseText,
        title: parsed.identification || parsed.title // For backward compatibility
      };
    } catch (err: any) {
      console.error('[Expert Parsing Error]', err.message);
      console.error('Raw Response that failed to parse:', responseText);
      result = {
        identification: '[Unable to extract]',
        historical_context: '[Extraction failed]',
        collector_significance: '[N/A]',
        estimated_value: '[Unknown]',
        ebay_search_keywords: [],
        raw_response: responseText,
        title: '[Unable to extract]'
      };
    }

    result.raw_response = responseText;
    return result;
  } catch (err: any) {
    throw new Error(`[Expert Error] ${err.message}`);
  }
}
