/**
 * AI ORCHESTRATOR
 * 
 * Implements the Conductor/Expert enrichment flow with Anthropic (Claude) as primary.
 * Fallbacks to OpenAI or Gemini as needed.
 */

import fs from 'fs';
import { ItemMetadata, ConductorResponse, ExpertResponse } from './schema';
import { AIConfig, getAIConfig } from './config';
import { getPrompt, EXPERT_PROMPT_MAP, CONDUCTOR_PROMPT_FILE } from './prompts';
import { routeItemAnthropic, appraiseItemAnthropic } from './anthropic-manual';
import { routeItemGemini, appraiseItemGemini } from './gemini-manual';

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

export async function analyzeImage(
  imagePath: string,
  ocrText: string,
  config: AIConfig = getAIConfig(),
  onRouteComplete?: (route: ConductorResponse) => void
): Promise<ItemMetadata> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`[AI] Using ${config.provider} (Attempt ${attempt + 1})...`);

      // 1. Route
      let route: ConductorResponse;
      if (config.provider === 'anthropic' && apiKey) {
        route = await routeItemAnthropic(imagePath, ocrText);
      } else {
        // Fallback or secondary logic (using Gemini as current active fallback)
        route = await routeItemGemini(imagePath, ocrText);
      }

      if (onRouteComplete) {
        onRouteComplete(route);
      }
      
      // 2. Appraise
      let appraisal: ExpertResponse;
      if (config.provider === 'anthropic' && apiKey) {
        appraisal = await appraiseItemAnthropic(route.category, imagePath, ocrText);
      } else {
        appraisal = await appraiseItemGemini(route.category, imagePath, ocrText);
      }
      
      // 3. Combine
      return {
        title: appraisal.identification,
        cleanedTranscription: ocrText, 
        confidence: route.confidence_score,
        identifiedNames: [], 
        tags: [route.category, ...(appraisal.comp_search_keywords || [])],
        valuation: appraisal.estimated_value, 
        ai_category: route.category,
        identification: appraisal.identification,
        estimated_value: appraisal.estimated_value,
        liquidity_score: appraisal.liquidity_score,
        target_buy_price: appraisal.target_buy_price,
        ebay_title: appraisal.identification,
        comp_search_keywords: appraisal.comp_search_keywords,
        visible_flaws: appraisal.visible_flaws,
        dealer_gut_check: appraisal.dealer_gut_check,
        research_pathways: appraisal.research_pathways,
        uncertain_fields: appraisal.uncertain_fields,
        item_specifics: appraisal.item_specifics
      };

    } catch (error: any) {
      attempt++;
      if (attempt > MAX_RETRIES) throw error;
      const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.warn(`[AI Orchestrator] Attempt ${attempt} failed. Retrying...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('AI_ANALYSIS_FAILED');
}

export async function enrichDeepDive(imagePath: string, baselineData: any, config: AIConfig = getAIConfig()): Promise<any> {
    return analyzeImage(imagePath, baselineData.cleanedTranscription || '', config);
}
