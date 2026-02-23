/**
 * AI SCHEMAS
 * 
 * Defines the structured output expected from Anthropic.
 * Used for Zod validation and type inference.
 */

import { z } from 'zod';

export const IdentifiedNameSchema = z.object({
  name: z.string(),
  type: z.string().transform(t => {
    // Normalize common variants to our enum
    const map: Record<string, string> = {
      'organization': 'business', 'company': 'business', 'org': 'business',
      'place': 'location', 'city': 'location', 'state': 'location', 'country': 'location',
      'individual': 'person', 'human': 'person',
    };
    return map[t.toLowerCase()] || (['person', 'business', 'location'].includes(t.toLowerCase()) ? t.toLowerCase() : 'unknown');
  }),
  confidence: z.number().min(0).max(1).default(0.5)
});

export const ItemMetadataSchema = z.object({
  title: z.string(),
  guessedId: z.string().default(''),
  cleanedTranscription: z.string(),
  confidence: z.number().min(0).max(1).default(0.5),
  identifiedNames: z.array(IdentifiedNameSchema).default([]),
  historicalContext: z.string().default(''),
  collectorSignificance: z.string().default(''),
  valuation: z.string().default(''),
  tags: z.array(z.string()).default([])
});

export type ItemMetadata = z.infer<typeof ItemMetadataSchema>;
