/**
 * AI SCHEMAS
 * 
 * Defines the structured output expected from Anthropic.
 * Used for Zod validation and type inference.
 */

import { z } from 'zod';

export const IdentifiedNameSchema = z.object({
  name: z.string().describe("Name of a person, business, or entity"),
  type: z.enum(['person', 'business', 'location', 'unknown']).describe("Type of entity"),
  confidence: z.number().min(0).max(1).describe("Confidence score (0-1)")
});

export const ItemMetadataSchema = z.object({
  title: z.string().describe("A concise, descriptive title for the item (e.g., 'Target Receipt - Groceries')"),
  guessedId: z.string().optional().describe("A guessed identifier if visible (e.g., Receipt #, Invoice #)"),
  cleanedTranscription: z.string().describe("Corrected and formatted full text of the item"),
  confidence: z.number().min(0).max(1).describe("Overall confidence in the extraction"),
  identifiedNames: z.array(IdentifiedNameSchema).describe("List of people, businesses, or locations found"),
  historicalContext: z.string().optional().describe("Detailed historical context, origin, or detected era"),
  collectorSignificance: z.string().optional().describe("Why this is significant to collectors, including rarity or uniqueness"),
  valuation: z.string().optional().describe("An estimated market value or collector value if applicable, with brief reasoning"),
  tags: z.array(z.string()).describe("List of relevant tags (e.g., 'receipt', '1990s', 'grocery')")
});

export type ItemMetadata = z.infer<typeof ItemMetadataSchema>;
