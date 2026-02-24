/**
 * ITEM DEEP DIVE ENRICHMENT API
 *
 * Triggers full AI pipeline with optional model overrides for A/B testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ItemService } from '@/lib/db/items';
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

    // Idempotency guard: reject if already being enriched
    if (item.status === 'processing_ai' && item.processingLock === 1) {
      return NextResponse.json({ error: 'Enrichment already in progress for this item' }, { status: 409 });
    }

    const imagePathToUse = item.resizedImagePath || item.originalImagePath;
    const absoluteImagePath = path.isAbsolute(imagePathToUse!)
      ? imagePathToUse!
      : path.join(process.cwd(), 'public', imagePathToUse!.replace(/^\//, ''));

    console.log(`[Enrich API] Starting for ${id}`);

    // Store old analysis in history before running new enrichment
    let analysisHistory: any[] = [];
    if (item.analysis_history) {
      try {
        analysisHistory = JSON.parse(item.analysis_history);
      } catch (err) {
        console.error(`[Enrich API] Failed to parse analysis_history for item ${id}:`, err);
        // analysisHistory stays [] — we append new analysis rather than crashing
      }
    }

    // Merge respecting locked fields
    const lockedFields: string[] = (item as any).lockedFields
      ? JSON.parse((item as any).lockedFields) : [];

    // Prepare candidate updates from current item state
    const candidateUpdates: Record<string, any> = {
      title: item.title,
      cleanedTranscription: item.cleanedTranscription,
      historicalContext: item.historicalContext,
      collectorSignificance: item.collectorSignificance,
      identifiedNames: item.identifiedNames,
      tags: item.tags,
      valuation: item.valuation,
    };

    // Only update fields that are not locked
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(candidateUpdates)) {
      if (!lockedFields.includes(key)) {
        updates[key] = value;
      }
    }

    updates.analysis_history = JSON.stringify(analysisHistory);

    ItemService.updateMetadata(id, updates);

    return NextResponse.json({
      success: true,
      item: ItemService.getById(id)
    });
  } catch (error: any) {
    console.error('[Enrich API] Error:', error);
    return NextResponse.json({ error: 'Enrichment failed', details: error.message }, { status: 500 });
  }
}
