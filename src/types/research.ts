// src/types/research.ts

export type PurchaseDecision = 'undecided' | 'interested' | 'purchased' | 'passed';
export type ValueConfidence = 'high' | 'medium' | 'low';
export type ResearchStage = 'identified' | 'valued' | 'reviewed' | 'exported';

export interface ResearchContext {
  research_location: string | null;      // where the item was found
  asking_price: string | null;           // seller's price (free text)
  purchase_decision: PurchaseDecision;
  research_notes: string | null;
  research_stage: ResearchStage;
}

export interface ValuationResult {
  estimated_value_low: number | null;    // floor price
  estimated_value_high: number | null;   // ceiling price
  estimated_value_point: number | null;  // single best estimate
  value_confidence: ValueConfidence | null;
  is_high_value: boolean;               // true if AI flags notable value
  ebay_keywords: string | null;         // comma-separated eBay search terms
}

export interface ResearchItem extends ResearchContext, ValuationResult {
  id: string;
  status: string;
  title: string | null;
  category: string | null;
  confidence: number | null;
  thumbnailPath: string | null;
  originalImagePath: string | null;
  cleanedTranscription: string | null;
  identifiedNames: string | null;
  historicalContext: string | null;
  collectorSignificance: string | null;
  tags: string;
  createdAt: string;
  processedAt: string | null;
  collection_id: string | null;
  user_decision: string;
}

// For the card grid (lightweight, no heavy text fields)
export interface ResearchCardItem {
  id: string;
  status: string;
  title: string | null;
  category: string | null;
  thumbnailPath: string | null;
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: ValueConfidence | null;
  is_high_value: boolean;
  purchase_decision: PurchaseDecision;
  research_location: string | null;
  createdAt: string;
}
