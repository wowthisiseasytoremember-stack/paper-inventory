import { GoogleGenerativeAI } from '@google/generative-ai';
import Ajv from 'ajv';

const ajv = new Ajv();

// 1. Define the Schema for Validation (The Contract)
const itemSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'A concise, descriptive title for the item.' },
    guessedId: { type: 'string', description: 'Any visible ID, serial number, or date code on the item.' },
    cleanedTranscription: { type: 'string', description: 'Corrected version of the raw OCR text.' },
    identifiedNames: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'List of people, organizations, or places mentioned.' 
    },
    historicalContext: { type: 'string', description: 'Brief context about the item based on content (e.g., "WWII Ration Card").' },
    collectorSignificance: { type: 'string', description: 'Why a collector might value this item.' },
    confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence score (0-1) in the analysis.' }
  },
  required: ['title', 'cleanedTranscription', 'identifiedNames', 'confidence'],
  additionalProperties: false
};

const validate = ajv.compile(itemSchema);

// 2. Initialize Gemini
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (process.env.DEV_AI_MOCK === 'true') {
      return null; // Signal mock mode
    }
    throw new Error('GEMINI_API_KEY is not set and mock mode is disabled.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

export interface AIResult {
  rawResponse: string;
  parsedData: any;
  durationMs: number;
}

export async function analyzeItem(rawOcrText: string, imagePath?: string): Promise<AIResult> {
  const start = Date.now();
  const model = getModel();

  if (!model) {
    // MOCK MODE
    console.log('[AI] Running in MOCK mode...');
    const mockData = {
      title: "Handwritten Historical Document (Mock)",
      guessedId: "MOCK-12345",
      cleanedTranscription: rawOcrText.slice(0, 100) + " [Cleaned by Mock AI]",
      identifiedNames: ["John Doe", "Jane Smith"],
      historicalContext: "This appears to be a mock historical document generated for testing the pipeline.",
      collectorSignificance: "High value for system verification.",
      confidence: 0.95
    };

    return {
      rawResponse: JSON.stringify(mockData),
      parsedData: mockData,
      durationMs: Date.now() - start
    };
  }

  // Construct the prompt
  const prompt = `
    You are an expert archivist and historian. Analyze the following text extracted from a document via OCR.
    
    RAW OCR TEXT:
    """
    ${rawOcrText.slice(0, 10000)} // Truncate to avoid token limits if massive
    """

    TASK:
    1. Correct OCR errors in the text.
    2. Extract key metadata.
    3. Identify historical context.
    
    OUTPUT JSON FORMAT:
    {
      "title": "String",
      "guessedId": "String (optional)",
      "cleanedTranscription": "String",
      "identifiedNames": ["String", "String"],
      "historicalContext": "String",
      "collectorSignificance": "String",
      "confidence": Number (0.0 to 1.0)
    }
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1, // Low temperature for deterministic output
        responseMimeType: "application/json",
      }
    });

    const response = result.response;
    const text = response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      console.error('AI JSON Parse Error. Raw:', text);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate against schema
    if (!validate(parsedData)) {
      console.error('AI Schema Validation Error:', validate.errors);
      throw new Error('AI response did not match required schema.');
    }

    return {
      rawResponse: text,
      parsedData: parsedData,
      durationMs: Date.now() - start
    };

  } catch (error) {
    console.error('Gemini Analysis Failed:', error);
    throw error;
  }
}
