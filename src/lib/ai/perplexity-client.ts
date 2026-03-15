/**
 * PERPLEXITY AI CLIENT
 * 
 * Used for web-grounded research via the Sonar models.
 */

export interface PerplexityResearchResult {
  notes: string;
  raw_response: string;
}

export async function runPerplexityResearch(
  category: string,
  ocrText: string
): Promise<PerplexityResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not set');
  }

  const prompt = `You are an expert researcher for vintage collectibles. 
Based on the following OCR text, find accurate historical context, collector significance, and current market data.
The item has been categorized as: ${category}.

[OCR TEXT]:
${ocrText}

Provide a concise summary of your findings to assist a senior appraiser in evaluating this item.`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro', // Using Sonar Pro as the balanced 2026 choice
        messages: [
          { role: 'system', content: 'Be a precise and helpful researcher. Focus on facts and market data.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const notes = data.choices[0].message.content;

    return {
      notes,
      raw_response: JSON.stringify(data)
    };
  } catch (err: any) {
    console.error(`[Perplexity Error] ${err.message}`);
    throw err;
  }
}
