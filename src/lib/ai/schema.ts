/**
 * AI SCHEMAS
 * 
 * Defines the structured output expected from OpenAI Experts.
 * Used for Zod validation and type inference.
 */

import { z } from 'zod';

// --- CONDUCTOR (ROUTER) SCHEMA ---
export const ConductorResponseSchema = z.object({
  category: z.enum([
    'comic_books',
    'railroadiana',
    'aerospace_technical',
    'serial_publications',
    'analog_media_electronics',
    'stamps_postal',
    'geographic_media',
    'general_vintage_ephemera'
  ]).describe("The category the item best fits into."),
  confidence_score: z.number().min(0).max(1).describe("Confidence in the categorization.")
});

export type ConductorResponse = z.infer<typeof ConductorResponseSchema>;

// --- EXPERT APPRAISER SCHEMA ---
export const ExpertResponseSchema = z.object({
  identification: z.string().describe("Clear, accurate, human-readable name of the item. No SEO stuffing."),
  estimated_value: z.string().describe("Realistic market value range (e.g., '$40 - $60')."),
  liquidity_score: z.number().min(1).max(10).describe("How fast this item typically sells (1 = very slow, 10 = instant)."),
  target_buy_price: z.string().describe("Maximum recommended purchase price to ensure a healthy margin (e.g., 'Max Buy: $15')."),
  comp_search_keywords: z.array(z.string()).max(5).describe("Specific phrases for eBay 'Sold Items' search."),
  visible_flaws: z.array(z.string()).describe("Bulleted list of visible condition issues."),
  historical_context_brief: z.string().nullable().optional().describe("One short sentence of historical context if it adds value."),
  item_specifics: z.record(z.string(), z.string()).describe("Key-value pairs for eBay Item Specifics."),
  dealer_gut_check: z.string().describe("Quick take on desirability, rarity, and price bracket."),
  uncertain_fields: z.array(z.string()).optional().describe("Fields where the AI is not 100% certain."),
  research_pathways: z.array(z.string()).describe("Specific steps or resources for the user to verify identity/value.")
});

export type ExpertResponse = z.infer<typeof ExpertResponseSchema>;

// --- LEGACY/COMBINED SCHEMA (for backward compatibility in some parts of the app) ---
export const ItemMetadataSchema = z.object({
  title: z.string(),
  guessedId: z.string().optional(),
  cleanedTranscription: z.string(),
  confidence: z.number(),
  identifiedNames: z.array(z.object({
    name: z.string(),
    type: z.string(),
    confidence: z.number()
  })),
  historicalContext: z.string().optional(),
  collectorSignificance: z.string().optional(),
  valuation: z.string().optional(),
  tags: z.array(z.string()),
  ai_category: z.string().optional()
});

export type ItemMetadata = z.infer<typeof ItemMetadataSchema>;
