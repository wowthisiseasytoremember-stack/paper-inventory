/**
 * ITEM DEEP DIVE ENRICHMENT API
 * 
 * Triggers the Phase 2 OpenAI "Deep Dive" historical research.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
import { enrichDeepDive } from '@/lib/ai/openai-manual';
import path from 'path';
import fs from 'fs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

    // 1. Get custom prompt from body if exists
    const body = await req.json().catch(() => ({}));
    const customPrompt = body.prompt;

    // 2. Fetch Item
    const item = ItemService.getById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (!item.originalImagePath) {
      return NextResponse.json({ error: 'Cannot enrich item without an image' }, { status: 400 });
    }

    // 3. Resolve image path
    const imagePathToUse = item.resizedImagePath || item.originalImagePath;
    if (!imagePathToUse) {
       return NextResponse.json({ error: 'Cannot enrich item without an image' }, { status: 400 });
    }
    
    // Support both absolute and relative paths
    const absoluteImagePath = path.isAbsolute(imagePathToUse)
      ? imagePathToUse
      : path.join(process.cwd(), 'public', imagePathToUse.replace(/^\//, ''));

    // 4. Prepare Baseline Context for the AI
    const baselineData = {
      title: item.title,
      transcription: item.cleanedTranscription,
      identifiedNames: item.identifiedNames ? JSON.parse(item.identifiedNames) : [],
      tags: item.tags ? JSON.parse(item.tags as string) : []
    };

    console.log(`[Enrich API] Starting Deep Dive for Item: ${item.id} ${customPrompt ? '(Custom Prompt Used)' : ''}`);

    // 5. Execute Deep Dive (OpenAI GPT-4o)
    const deepDiveResult = await enrichDeepDive(absoluteImagePath, baselineData, customPrompt);

    // 6. Log the interaction
    const logFile = path.join(process.cwd(), 'ai-prompt-debug.txt');
    const logEntry = `[${new Date().toISOString()}] ENRICHMENT_CALL [${item.id}]\n` +
                     `PROMPT: ${customPrompt || 'DEFAULT'}\n` +
                     `RESULT: ${JSON.stringify(deepDiveResult, null, 2)}\n` +
                     `---\n`;
    fs.appendFileSync(logFile, logEntry);

    // 7. Store old analysis in history
    const historyEntry = {
      timestamp: new Date().toISOString(),
      prompt: customPrompt || 'DEFAULT',
      historicalContext: item.historicalContext,
      collectorSignificance: item.collectorSignificance,
      valuation: item.valuation,
      verification_questions: item.verification_questions
    };

    let analysisHistory = [];
    if (item.analysis_history) {
        try {
            analysisHistory = JSON.parse(item.analysis_history);
        } catch (e) {
            console.error("Failed to parse analysis_history", e);
        }
    }
    
    // Only push if there was actually data to save
    if (item.historicalContext || item.valuation) {
        analysisHistory.push(historyEntry);
    }

    // 8. Merge Results & Update Database
    const existingTags = new Set(baselineData.tags);
    deepDiveResult.tags.forEach((t: string) => existingTags.add(t));

    const mergedNames = deepDiveResult.identifiedNames && deepDiveResult.identifiedNames.length > 0
      ? deepDiveResult.identifiedNames
      : baselineData.identifiedNames;

    const updates = {
      title: deepDiveResult.title || item.title,
      historicalContext: deepDiveResult.historicalContext,
      collectorSignificance: deepDiveResult.collectorSignificance,
      valuation: deepDiveResult.valuation,
      verification_questions: deepDiveResult.verificationQuestions ? JSON.stringify(deepDiveResult.verificationQuestions) : undefined,
      identifiedNames: JSON.stringify(mergedNames),
      tags: JSON.stringify(Array.from(existingTags)),
      analysis_history: JSON.stringify(analysisHistory)
    };

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
