/**
 * ITEM DEEP DIVE ENRICHMENT API
 *
 * Triggers full AI pipeline with optional model overrides for A/B testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
import { runFullPipeline, AnalysisOptions } from '@/lib/ai';
import path from 'path';
import fs from 'fs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const body = await req.json().catch(() => ({}));

    const item = ItemService.getById(id);
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    if (!item.originalImagePath) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const imagePathToUse = item.resizedImagePath || item.originalImagePath;
    const absoluteImagePath = path.isAbsolute(imagePathToUse!)
      ? imagePathToUse!
      : path.join(process.cwd(), 'public', imagePathToUse!.replace(/^\//, ''));

    const options: AnalysisOptions = {
      baselineModel: body.baselineModel,
      deepDiveModel: body.deepDiveModel,
      enableGrounding: body.enableGrounding,
      customPrompt: body.prompt,
    };

    console.log(`[Enrich API] Starting for ${id}`, options);

    const result = await runFullPipeline(absoluteImagePath, item.rawOcr || '', options);

    // Log interaction
    const logFile = path.join(process.cwd(), 'ai-prompt-debug.txt');
    const logEntry = `[${new Date().toISOString()}] ENRICHMENT [${id}] cat=${result.category} grounding=${result.groundingUsed}\n` +
                     `OPTIONS: ${JSON.stringify(options)}\n` +
                     `RESULT: ${JSON.stringify(result.deepDive, null, 2)}\n---\n`;
    fs.appendFileSync(logFile, logEntry);

    // Store old analysis in history
    let analysisHistory = [];
    if (item.analysis_history) {
      try { analysisHistory = JSON.parse(item.analysis_history); } catch {}
    }
    if (item.historicalContext || item.valuation) {
      analysisHistory.push({
        timestamp: new Date().toISOString(),
        prompt: body.prompt || 'DEFAULT',
        models: { baseline: options.baselineModel, deepDive: options.deepDiveModel },
        historicalContext: item.historicalContext,
        collectorSignificance: item.collectorSignificance,
        valuation: item.valuation,
      });
    }

    // Merge respecting locked fields
    const lockedFields: string[] = (item as any).lockedFields
      ? JSON.parse((item as any).lockedFields) : [];

    const candidateUpdates: Record<string, any> = {
      ...result.merged,
      analysis_history: JSON.stringify(analysisHistory),
    };

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(candidateUpdates)) {
      if (!lockedFields.includes(key)) updates[key] = value;
    }

    ItemService.updateMetadata(id, updates);

    return NextResponse.json({ success: true, category: result.category, groundingUsed: result.groundingUsed, item: ItemService.getById(id) });
  } catch (error: any) {
    console.error('[Enrich API] Error:', error);
    return NextResponse.json({ error: 'Enrichment failed', details: error.message }, { status: 500 });
  }
}
