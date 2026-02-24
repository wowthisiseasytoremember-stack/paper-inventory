/**
 * ITEM DEEP DIVE ENRICHMENT API
 * 
 * Triggers the Phase 2 OpenAI "Deep Dive" historical research.
 * Receives the item ID, fetches baseline data & the original image,
 * sends it to the research model, and updates the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
import { enrichDeepDive } from '@/lib/ai/openai-manual';
import { getAIConfig } from '@/lib/ai/config';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

    // 1. Fetch Item
    const item = ItemService.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (!item.originalImagePath) {
      return NextResponse.json({ error: 'Cannot enrich item without an image' }, { status: 400 });
    }

    // 2. Resolve image path
    const imagePathToUse = item.resizedImagePath || item.originalImagePath;
    if (!imagePathToUse) {
       return NextResponse.json({ error: 'Cannot enrich item without an image' }, { status: 400 });
    }
    
    // Support both absolute and relative paths
    const absoluteImagePath = path.isAbsolute(imagePathToUse)
      ? imagePathToUse
      : path.join(process.cwd(), 'public', imagePathToUse.replace(/^\//, ''));

    // 2. Prepare Baseline Context for the AI
    const baselineData = {
      title: item.title,
      transcription: item.cleanedTranscription,
      identifiedNames: item.identifiedNames ? JSON.parse(item.identifiedNames) : [],
      tags: item.tags ? JSON.parse(item.tags as string) : []
    };

    console.log(`[Enrich API] Starting Deep Dive for Item: ${item.id}`);

    // 3. Execute Deep Dive (OpenAI GPT-4o)
    const deepDiveResult = await enrichDeepDive(absoluteImagePath, baselineData, getAIConfig());

    // 4. Merge Results & Update Database
    // We append specific research tags and update core fields with the massive new markdown narratives
    const existingTags = new Set(baselineData.tags);
    deepDiveResult.tags.forEach((t: string) => existingTags.add(t));

    // The AI might return the names in a slightly different structure during deep dive,
    // so we merge identified names intelligently, or just overwrite if the deep dive added 'historicalNote's.
    const mergedNames = deepDiveResult.identifiedNames && deepDiveResult.identifiedNames.length > 0
      ? deepDiveResult.identifiedNames
      : baselineData.identifiedNames;

    const updates = {
      title: deepDiveResult.title || item.title, // Keep original if Deep Dive didn't refine it
      historicalContext: deepDiveResult.historicalContext,
      collectorSignificance: deepDiveResult.collectorSignificance,
      valuation: deepDiveResult.valuation,
      identifiedNames: JSON.stringify(mergedNames),
      tags: JSON.stringify(Array.from(existingTags))
    };

    // Use updateMetadata which has a strict whitelist
    ItemService.updateMetadata(id, updates);

    console.log(`[Enrich API] Deep Dive Complete for: ${item.id}`);

    return NextResponse.json({ success: true, item: ItemService.getById(id) });

  } catch (error: any) {
    console.error('[Enrich API] Deep Dive Error:', error);
    return NextResponse.json({ 
      error: 'Deep Dive Failed. Ensure OpenAI API Key is valid and image is accessible.',
      details: error.message 
    }, { status: 500 });
  }
}
