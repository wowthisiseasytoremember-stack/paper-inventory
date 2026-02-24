/**
 * Expert AI Dispatcher
 * Routes to category-specific expert prompts
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXPERT_PROMPTS: Record<string, string> = {
  comic_books: `You are an expert comic book appraiser. Analyze this comic and extract: title, issue number, condition flaws, value indicators (first appearance, variant cover, Newsstand vs Direct). Return JSON: { "title": "...", "identified_names": [...], "historical_context": "...", "collector_significance": "...", "estimated_value_signals": [...], "visible_condition_issues": [...], "ebay_search_keywords": [...] }`,

  railroadiana: `You are a railroad history expert. Extract: railroad company, line/route, document type (timetable/ticket/memo), historical significance, condition. Return JSON with same fields.`,

  aerospace_technical: `You are an aerospace technical document expert. Extract: company (NASA/Rockwell/etc), program, document type, classification level, significance. Return JSON with same fields.`,

  serial_publications: `You are a vintage magazine expert. Extract: title, publication date, issue number, notable articles, rarity signals. Return JSON with same fields.`,

  analog_media_electronics: `You are a vintage audio/electronics expert. Extract: format (vinyl/cassette/etc), artist/band, album title, edition rarity, condition. Return JSON with same fields.`,

  stamps_postal: `You are a philately expert. Extract: country, denomination, issue date, cancel type, rarity indicators. Return JSON with same fields.`,

  geographic_media: `You are a cartography expert. Extract: map type, region, date, cartographer, historical significance. Return JSON with same fields.`,

  general_vintage_ephemera: `You are a general vintage items appraiser. Extract: item type, date, subject matter, condition, rarity signals. Return JSON with same fields.`,
};

export interface ExpertResult {
  title: string;
  identified_names: string[];
  historical_context: string;
  collector_significance: string;
  estimated_value_signals: string[];
  visible_condition_issues: string[];
  ebay_search_keywords: string[];
  raw_response: string;
}

export async function runExpert(
  category: string,
  ocrText: string,
  imageBase64?: string
): Promise<ExpertResult> {
  const expertPrompt = EXPERT_PROMPTS[category] || EXPERT_PROMPTS.general_vintage_ephemera;

  try {
    const content: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: `${expertPrompt}\n\n[OCR TEXT]:\n${ocrText}`,
      },
    ];

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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
      if (!jsonMatch) throw new Error('No JSON found');
      result = JSON.parse(jsonMatch[0]) as ExpertResult;
    } catch {
      result = {
        title: '[Unable to extract]',
        identified_names: [],
        historical_context: '[Extraction failed]',
        collector_significance: '[N/A]',
        estimated_value_signals: [],
        visible_condition_issues: [],
        ebay_search_keywords: [],
        raw_response: responseText,
      };
    }

    result.raw_response = responseText;
    return result;
  } catch (err: any) {
    throw new Error(`[Expert Error] ${err.message}`);
  }
}
