# Google Cloud Vision Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Test Google Cloud Vision credentials, fix database/pipeline bugs, integrate GCV for OCR, wire AI enrichment, get full pipeline working end-to-end.

**Architecture:** GCV test validates credentials → Milestone 1 fixes stabilize DB → Scheduler routes jobs → GCV replaces worker OCR → Conductor routes to Expert → Results stored in DB.

**Tech Stack:** Next.js 15, Better-SQLite3, TypeScript, Google Cloud Vision API, Anthropic Claude, Sharp, worker_threads

---

## Phase 1: Verify GCV Credentials (Tasks 1.1 - 1.5)

### Task 1.1: Create GCV Test Script Structure

**Files:**
- Create: `scripts/test-vision.ts`

**Step 1: Create the test script file**

```typescript
#!/usr/bin/env node
/**
 * GCV Test Script
 * Tests Google Cloud Vision API credentials and OCR on 4 test images
 */

import path from 'path';
import fs from 'fs';

const TEST_IMAGES_DIR = 'C:/Users/wowth/Downloads/Photos-1-001';
const testImages = [
  '20260117_202149.jpg',
  '20260117_202152.jpg',
  '20260117_202141.jpg',
  '20260117_202145.jpg'
];

console.log('🧪 Starting Google Cloud Vision Test...\n');

// TODO: Implement Vision client + test calls
console.log('Test images found:');
testImages.forEach(img => {
  const fullPath = path.join(TEST_IMAGES_DIR, img);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? '✅' : '❌'} ${img}`);
});
```

**Step 2: Verify file created**

```bash
cat scripts/test-vision.ts
```

Expected: File exists with structure above.

**Step 3: Commit**

```bash
git add scripts/test-vision.ts
git commit -m "test: scaffold GCV test script"
```

---

### Task 1.2: Initialize Google Cloud Vision Client

**Files:**
- Modify: `scripts/test-vision.ts`

**Step 1: Check package.json for Vision dependency**

```bash
grep "@google-cloud/vision" package.json
```

If not present, install:
```bash
npm install @google-cloud/vision
```

**Step 2: Add Vision client initialization to test script**

Replace the `// TODO: Implement Vision client...` section:

```typescript
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Initialize Vision client (uses GOOGLE_APPLICATION_CREDENTIALS env var)
let client: ImageAnnotatorClient;

try {
  client = new ImageAnnotatorClient();
  console.log('✅ Vision client initialized\n');
} catch (err: any) {
  console.error('❌ Failed to initialize Vision client:');
  console.error(`   Error: ${err.message}`);
  console.error(`   Make sure GOOGLE_APPLICATION_CREDENTIALS points to valid service key`);
  process.exit(1);
}
```

**Step 3: Verify syntax**

```bash
npx ts-node scripts/test-vision.ts
```

Expected: Should print "✅ Vision client initialized" (or error about missing env var, which is OK).

**Step 4: Commit**

```bash
git add scripts/test-vision.ts
git commit -m "test: initialize GCV client"
```

---

### Task 1.3: Implement OCR Test Loop

**Files:**
- Modify: `scripts/test-vision.ts`

**Step 1: Add OCR testing logic**

After the Vision client initialization, add:

```typescript
async function testOCR() {
  console.log('🔍 Testing OCR on 4 comic images...\n');

  let successCount = 0;
  let failureCount = 0;

  for (const imageName of testImages) {
    const fullPath = path.join(TEST_IMAGES_DIR, imageName);

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  ${imageName}: File not found, skipping`);
      continue;
    }

    try {
      // Read image file
      const imageBuffer = fs.readFileSync(fullPath);
      const base64Image = imageBuffer.toString('base64');

      // Call Vision API
      const request = {
        image: { content: base64Image },
      };

      const [result] = await client.textDetection(request);
      const detections = result.textAnnotations || [];

      if (detections.length === 0) {
        console.log(`⚠️  ${imageName}: No text detected`);
        failureCount++;
        continue;
      }

      // First result is full text
      const fullText = detections[0].description || '';
      const textPreview = fullText.substring(0, 100).replace(/\n/g, ' ');
      const confidence = detections[0].confidence || 0;

      console.log(`✅ ${imageName}`);
      console.log(`   Text: "${textPreview}..."`);
      console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%\n`);

      successCount++;
    } catch (err: any) {
      console.log(`❌ ${imageName}: ${err.message}\n`);
      failureCount++;
    }
  }

  // Summary
  console.log(`\n📊 Results: ${successCount}/${testImages.length} succeeded`);
  if (failureCount > 0) {
    console.error(`⚠️  ${failureCount} images failed`);
    process.exit(1);
  }
}

// Run test
testOCR().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 2: Verify file**

```bash
npx ts-node scripts/test-vision.ts
```

Expected: Should attempt to read images and call Vision API. Will fail if `GOOGLE_APPLICATION_CREDENTIALS` not set (that's OK, we test next).

**Step 3: Commit**

```bash
git add scripts/test-vision.ts
git commit -m "test: implement OCR test loop for 4 images"
```

---

### Task 1.4: Run GCV Test Against Your Comics

**Files:**
- None (running existing script)

**Step 1: Verify .env.local has Google Cloud credentials**

```bash
grep "GOOGLE_APPLICATION_CREDENTIALS\|GOOGLE_CLOUD_PROJECT" .env.local
```

Expected:
```
GOOGLE_APPLICATION_CREDENTIALS="C:\Users\wowth\Documents\projects\paper-inventory\paper-inventory-488411-4f90bf2f1afc.json"
GOOGLE_CLOUD_PROJECT="paper-inventory-488411"
```

If missing, add to `.env.local`.

**Step 2: Source .env and run test**

```bash
set -a; source .env.local; set +a
npx ts-node scripts/test-vision.ts
```

Expected output (if successful):
```
🧪 Starting Google Cloud Vision Test...

✅ Vision client initialized

🔍 Testing OCR on 4 comic images...

✅ 20260117_202149.jpg
   Text: "BLACK WIDOW ACTION COMICS..."
   Confidence: 95.3%

✅ 20260117_202152.jpg
   Text: "STORY BY REBECCA STRONG..."
   Confidence: 88.7%

... (more images)

📊 Results: 4/4 succeeded
```

**Step 3: If test fails:**

Debug based on error:
- **"GOOGLE_APPLICATION_CREDENTIALS not set":** Add to `.env.local`
- **"Service account key file not found":** Verify JSON file path is correct
- **"Permission denied":** Check service account has `roles/ml.viewer` and `roles/ml.admin`
- **"Quota exceeded":** Wait, GCV has monthly free tier

**Step 4: Document results**

Create a test results file:

```bash
npx ts-node scripts/test-vision.ts > data/logs/gcv-test-results.log 2>&1
cat data/logs/gcv-test-results.log
```

**Step 5: Commit**

```bash
git add data/logs/gcv-test-results.log
git commit -m "test: GCV credentials verified, all 4 images passed OCR"
```

---

### Task 1.5: Celebrate & Checkpoint

**Files:**
- None

**Step 1: Verify Phase 1 complete**

- [ ] GCV test script created and runs
- [ ] All 4 comic images return extracted text
- [ ] Confidence scores visible
- [ ] Test results logged

**Step 2: Log success**

```bash
echo "✅ Phase 1 Complete: GCV Credentials Verified" >> docs/PROGRESS.md
```

**Step 3: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "checkpoint: Phase 1 complete - GCV credentials verified"
```

---

## Phase 2: Fix Database + Activate Scheduler (Tasks 2.1 - 2.8)

**Note:** These tasks should be done in parallel with Milestone 1 fixes. If another IDE is fixing merge conflicts, focus on Tasks 2.5-2.8 (FTS5 triggers, scheduler activation, image resizing).

### Task 2.1: Verify Merge Conflicts Resolved

**Files:**
- Check: `src/lib/db/items.ts`
- Check: `src/app/api/items/[id]/enrich/route.ts`
- Check: `src/lib/ai/index.ts`
- Check: `src/app/items/[id]/page.tsx`

**Step 1: Scan for conflict markers**

```bash
grep -rn "<<<<<<\|=======\|>>>>>>>" src/
```

Expected: No output (all conflicts resolved).

If conflicts exist, refer to `docs/plans/2026-02-24-audit-fixes.md` for resolution steps.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit (if needed)**

```bash
git status
# If changes exist from conflict resolution:
git add src/
git commit -m "fix: resolve merge conflicts"
```

---

### Task 2.2: Fix FTS5 Triggers in Database

**Files:**
- Modify: `src/lib/db/index.ts:141` (after `analysis_history` migration)

**Step 1: Open the database initialization file**

```bash
cat src/lib/db/index.ts | head -150 | tail -50
```

Find the migrations section (look for comments about migrations).

**Step 2: Add FTS5 trigger migration**

After the `analysis_history` migration block, add:

```typescript
  // Migration: drop and recreate FTS5 triggers to fix broken column references
  // Old triggers referenced non-existent columns (identification, dealer_gut_check, ai_category).
  // DROP + recreate is safe — the FTS table is rebuilt from content='items'.
  try {
    db.exec(`
      DROP TRIGGER IF EXISTS items_ai;
      DROP TRIGGER IF EXISTS items_ad;
      DROP TRIGGER IF EXISTS items_au;

      CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames)
        VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames);
      END;

      CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames)
        VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames);
      END;

      CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames)
        VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames);
        INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames)
        VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames);
      END;
    `);
    console.log('[Migration] FTS5 triggers recreated with correct columns.');
  } catch (e: any) {
    console.error('[Migration] Failed to recreate FTS5 triggers:', e.message);
  }
```

**Step 3: Test**

```bash
npm run dev
```

In console, look for: `[Migration] FTS5 triggers recreated with correct columns.`

If you see it, migration ran successfully. Ctrl+C to stop.

**Step 4: Commit**

```bash
git add src/lib/db/index.ts
git commit -m "fix: recreate FTS5 triggers with correct columns"
```

---

### Task 2.3: Fix Silent Error Catches

**Files:**
- Modify: `src/app/items/[id]/page.tsx:231`
- Modify: `src/app/api/items/[id]/enrich/route.ts:56`

**Step 1: Fix fetchCollections in page.tsx**

Find the `fetchCollections` function and replace:

```typescript
// OLD:
const fetchCollections = async () => {
  try {
    const res = await fetch('/api/collections');
    if (res.ok) setCollections(await res.json());
  } catch {}
};

// NEW:
const fetchCollections = async () => {
  try {
    const res = await fetch('/api/collections');
    if (res.ok) setCollections(await res.json());
  } catch (err) {
    console.error('[fetchCollections] Failed to load collections:', err);
  }
};
```

**Step 2: Fix analysis_history parsing in enrich/route.ts**

Find the JSON.parse block and replace:

```typescript
// OLD:
let analysisHistory = [];
if (item.analysis_history) {
  try { analysisHistory = JSON.parse(item.analysis_history); } catch {}
}

// NEW:
let analysisHistory: any[] = [];
if (item.analysis_history) {
  try {
    analysisHistory = JSON.parse(item.analysis_history);
  } catch (err) {
    console.error(`[Enrich API] Failed to parse analysis_history for item ${id}:`, err);
    // analysisHistory stays [] — we append new analysis rather than crashing
  }
}
```

**Step 3: Verify no more silent catches**

```bash
grep -n "catch\s*{" src/app/items/[id]/page.tsx src/app/api/items/[id]/enrich/route.ts
```

Expected: Lines should now have error logging.

**Step 4: Commit**

```bash
git add src/app/items/[id]/page.tsx src/app/api/items/[id]/enrich/route.ts
git commit -m "fix: add error logging to silent catch blocks"
```

---

### Task 2.4: Add Idempotency Guard to Enrich Endpoint

**Files:**
- Modify: `src/app/api/items/[id]/enrich/route.ts:28`

**Step 1: Find the section after fetching item**

Look for:
```typescript
if (!item.originalImagePath) return NextResponse.json({ error: 'No image' }, { status: 400 });
```

**Step 2: Add idempotency check right after**

```typescript
    // Idempotency guard: reject if already being enriched
    if (item.status === 'processing_ai' && item.processingLock === 1) {
      return NextResponse.json({ error: 'Enrichment already in progress for this item' }, { status: 409 });
    }
```

**Step 3: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/app/api/items/[id]/enrich/route.ts
git commit -m "fix: add idempotency guard to enrich endpoint"
```

---

### Task 2.5: Create Worker Start Script

**Files:**
- Create: `scripts/start-worker.ts`

**Step 1: Create the script**

```typescript
#!/usr/bin/env node
/**
 * Background Worker Starter
 * Runs the processing scheduler loop independently from Next.js
 */

import { startProcessingLoop } from '@/lib/scheduler';

console.log('🚀 Starting background worker...');
console.log('Press Ctrl+C to stop\n');

// Start the processing loop
startProcessingLoop().catch((err) => {
  console.error('[Worker Fatal Error]', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down worker...');
  process.exit(0);
});
```

**Step 2: Verify file created**

```bash
cat scripts/start-worker.ts
```

**Step 3: Commit**

```bash
git add scripts/start-worker.ts
git commit -m "feat: add background worker start script"
```

---

### Task 2.6: Implement Image Resizing with Sharp

**Files:**
- Create: `src/lib/processing/resize.ts`
- Modify: `src/lib/scheduler.ts` (add resize stage)

**Step 1: Create resize handler**

Create `src/lib/processing/resize.ts`:

```typescript
/**
 * Image Resizing with Sharp
 * Generates thumbnail (300px) and web version (1024px)
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const THUMBNAIL_WIDTH = 300;
const WEB_WIDTH = 1024;
const QUALITY = 80;

export async function resizeImage(originalPath: string, itemId: string, outputDir: string = 'data/resized'): Promise<{
  thumbnailPath: string;
  resizedPath: string;
  durationMs: number;
}> {
  const startTime = Date.now();

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const thumbnailPath = path.join(outputDir, `${itemId}-thumb.jpg`);
  const resizedPath = path.join(outputDir, `${itemId}-web.jpg`);

  try {
    // Create thumbnail
    await sharp(originalPath)
      .resize(THUMBNAIL_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(thumbnailPath);

    // Create web version
    await sharp(originalPath)
      .resize(WEB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(resizedPath);

    const durationMs = Date.now() - startTime;

    console.log(`[Resize] ${itemId}: thumbnail + web version created (${durationMs}ms)`);

    return { thumbnailPath, resizedPath, durationMs };
  } catch (err: any) {
    throw new Error(`[Resize Failed] ${itemId}: ${err.message}`);
  }
}
```

**Step 2: Update scheduler to use resize**

In `src/lib/scheduler.ts`, find the `processing_resize` stage and replace with:

```typescript
    if (item.status === 'processing_resize') {
      try {
        const { thumbnailPath, resizedPath, durationMs } = await resizeImage(item.originalImagePath, item.id);

        // Update DB
        ItemService.updateMetadata(item.id, {
          thumbnailPath,
          resizedImagePath: resizedPath,
          resizeDurationMs: durationMs,
          statusUpdatedAt: new Date().toISOString()
        });

        // Update status
        db.prepare(`UPDATE items SET status = 'resize_complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: resize complete`);
      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: resize failed -`, err.message);
        db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
          .run(err.message, new Date().toISOString(), item.id);
      }
      continue;
    }
```

**Step 3: Verify Sharp is installed**

```bash
grep "sharp" package.json
```

If not present:
```bash
npm install sharp
```

**Step 4: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/lib/processing/resize.ts src/lib/scheduler.ts
git commit -m "feat: implement image resizing with Sharp"
```

---

### Task 2.7: Stub OCR Stage for Google Cloud Vision

**Files:**
- Modify: `src/lib/scheduler.ts` (add GCV call)

**Step 1: Update scheduler OCR stage**

In `src/lib/scheduler.ts`, find `processing_ocr` stage and replace with:

```typescript
    if (item.status === 'processing_ocr') {
      try {
        // TODO: Replace with actual GCV call (Task 3.1)
        // For now, just move to next stage
        console.log(`[Scheduler] ${item.id}: OCR pending (will use GCV in next phase)`);

        // Stub: set dummy OCR result
        ItemService.updateMetadata(item.id, {
          rawOcr: '[OCR PENDING - Google Cloud Vision integration in progress]'
        });

        db.prepare(`UPDATE items SET status = 'ocr_complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: OCR failed -`, err.message);
        db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
          .run(err.message, new Date().toISOString(), item.id);
      }
      continue;
    }
```

**Step 2: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "feat: stub OCR stage (GCV integration next)"
```

---

### Task 2.8: Test Scheduler Activation

**Files:**
- None (running existing code)

**Step 1: Start dev server**

```bash
npm run dev
```

Wait for "ready on http://localhost:3000".

**Step 2: In another terminal, start worker**

```bash
npx ts-node scripts/start-worker.ts
```

Expected: Worker starts, logs "Processing queue...".

**Step 3: Upload a test image via API**

```bash
curl -F "file=@/path/to/test/image.jpg" http://localhost:3000/api/upload
```

Expected response:
```json
{
  "success": true,
  "id": "uuid-here",
  "status": "queued"
}
```

**Step 4: Watch scheduler logs**

In worker terminal, you should see:
```
[Scheduler] uuid-here: resize complete
[Scheduler] uuid-here: OCR pending...
```

**Step 5: If hangs or errors:**

Check logs in `data/logs/` and debug based on error message.

**Step 6: Commit (if all works)**

```bash
git add .
git commit -m "checkpoint: Phase 2 complete - database and scheduler working"
```

---

## Phase 3: Integrate Google Cloud Vision (Tasks 3.1 - 3.3)

### Task 3.1: Create GCV OCR Handler

**Files:**
- Create: `src/lib/ocr/cloud-vision.ts`

**Step 1: Create the GCV OCR handler**

```typescript
/**
 * Google Cloud Vision OCR Handler
 * Replaces worker-based OCR with Vision API calls
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';

let visionClient: ImageAnnotatorClient | null = null;

export function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return visionClient;
}

export interface OCRResult {
  text: string;
  confidence: number;
  duration_ms: number;
}

export async function performCloudVisionOCR(filePath: string): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const client = getVisionClient();
    const request = {
      image: { content: require('fs').readFileSync(filePath).toString('base64') },
    };

    const [result] = await client.textDetection(request);
    const annotations = result.textAnnotations || [];

    if (annotations.length === 0) {
      return {
        text: '[No text detected]',
        confidence: 0,
        duration_ms: Date.now() - startTime,
      };
    }

    // First annotation is the full text
    const fullText = annotations[0].description || '';
    const confidence = annotations[0].confidence || 0;

    return {
      text: fullText,
      confidence,
      duration_ms: Date.now() - startTime,
    };
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Handle specific errors
    if (err.message.includes('quota')) {
      throw new Error(`[GCV_QUOTA_EXCEEDED] ${err.message}`);
    }
    if (err.message.includes('auth') || err.message.includes('credentials')) {
      throw new Error(`[GCV_AUTH_ERROR] ${err.message}`);
    }
    if (err.message.includes('timeout')) {
      throw new Error(`[GCV_TIMEOUT] ${err.message}`);
    }

    throw new Error(`[GCV_ERROR] ${err.message}`);
  }
}
```

**Step 2: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/lib/ocr/cloud-vision.ts
git commit -m "feat: implement Google Cloud Vision OCR handler"
```

---

### Task 3.2: Update Scheduler to Use GCV

**Files:**
- Modify: `src/lib/scheduler.ts` (replace OCR stub)

**Step 1: Import GCV handler at top of scheduler**

```typescript
import { performCloudVisionOCR } from '@/lib/ocr/cloud-vision';
```

**Step 2: Replace OCR stub with actual GCV call**

Replace the `processing_ocr` stage:

```typescript
    if (item.status === 'processing_ocr') {
      try {
        const ocrResult = await performCloudVisionOCR(item.originalImagePath);

        ItemService.updateMetadata(item.id, {
          rawOcr: ocrResult.text,
          confidence: ocrResult.confidence,
          ocrDurationMs: ocrResult.duration_ms
        });

        db.prepare(`UPDATE items SET status = 'ocr_complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: OCR complete (confidence: ${(ocrResult.confidence * 100).toFixed(1)}%)`);

      } catch (err: any) {
        // Handle specific errors
        if (err.message.includes('QUOTA_EXCEEDED')) {
          console.warn(`[Scheduler] ${item.id}: GCV quota exceeded, retrying later`);
          db.prepare(`UPDATE items SET status = 'ocr_pending_retry', statusUpdatedAt = ? WHERE id = ?`)
            .run(new Date().toISOString(), item.id);
        } else {
          console.error(`[Scheduler] ${item.id}: OCR failed -`, err.message);
          db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
            .run(err.message, new Date().toISOString(), item.id);
        }
      }
      continue;
    }

    // Handle retry state
    if (item.status === 'ocr_pending_retry') {
      console.log(`[Scheduler] ${item.id}: retrying OCR...`);
      // Move back to processing_ocr to retry
      db.prepare(`UPDATE items SET status = 'processing_ocr', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);
      continue;
    }
```

**Step 3: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "feat: wire Google Cloud Vision into OCR pipeline"
```

---

### Task 3.3: Test GCV Integration

**Files:**
- None (running code)

**Step 1: Ensure services running**

Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
npx ts-node scripts/start-worker.ts
```

**Step 2: Upload one of your comic test images**

```bash
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202149.jpg" http://localhost:3000/api/upload
```

Note the returned `id`.

**Step 3: Watch worker logs**

In Terminal 2, you should see:
```
[Scheduler] <id>: resize complete
[Scheduler] <id>: OCR complete (confidence: 95.3%)
```

**Step 4: Verify OCR data in DB**

```bash
# Stop dev server first (Ctrl+C)
sqlite3 data/dev.db
SELECT id, status, confidence, rawOcr FROM items ORDER BY createdAt DESC LIMIT 1;
```

Expected: Row shows OCR text extracted + confidence score.

**Step 5: Commit**

```bash
git add .
git commit -m "checkpoint: Phase 3 complete - GCV OCR integrated"
```

---

## Phase 4: Wire AI Enrichment (Tasks 4.1 - 4.3)

### Task 4.1: Implement Conductor Prompt

**Files:**
- Create: `src/lib/ai/conductor.ts`

**Step 1: Create conductor handler**

```typescript
/**
 * Conductor AI Router
 * Categorizes items into buckets (comic_books, railroadiana, etc.)
 */

import Anthropic from '@anthropic-ai/sdk';
import { CONDUCTOR_PROMPT } from '@/lib/ai/prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ConductorResult {
  category: string;
  confidence_score: number;
  raw_response: string;
}

export async function runConductor(ocrText: string, imageBase64?: string): Promise<ConductorResult> {
  try {
    // Build message with image if available
    const content: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: `${CONDUCTOR_PROMPT}\n\n[OCR TEXT]:\n${ocrText}`,
      },
    ];

    if (imageBase64) {
      (content as Array<any>).unshift({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    let result: ConductorResult;
    try {
      // Extract JSON from response (may have extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      result = JSON.parse(jsonMatch[0]) as ConductorResult;
    } catch {
      // If parsing fails, return error category
      result = {
        category: 'general_vintage_ephemera',
        confidence_score: 0.5,
        raw_response: responseText,
      };
    }

    result.raw_response = responseText;
    return result;
  } catch (err: any) {
    throw new Error(`[Conductor Error] ${err.message}`);
  }
}
```

**Step 2: Create conductor prompt file**

Create `src/lib/ai/prompts/conductor.ts`:

```typescript
export const CONDUCTOR_PROMPT = `You are the "Triage Router" for a vast inventory of vintage goods, ephemera, and specialized collectibles.
Your sole purpose is to analyze the provided image (and any preliminary OCR text) and accurately categorize it into ONE of the specific buckets listed below.

**PRIORITY: ACCURACY.** If you are unsure between two categories, choose the one that seems most likely but indicate a lower confidence score. If it truly does not fit, use general_vintage_ephemera.

### Available Categories & Rules

1. comic_books - Comic books, graphic novels, primarily 1980s-1990s. KEY INDICATORS: Stylized character art, comic book format, barcodes, issue numbers.

2. railroadiana - Timetables, tickets, internal memos, and route maps specifically related to railways. KEY INDICATORS: Train logos, schedule grids, railway company names.

3. aerospace_technical - Internal documents, manuals, specs from aerospace companies. KEY INDICATORS: "D-numbers", "Confidential/Internal" stamps, engineering diagrams.

4. serial_publications - Vintage magazines, modern magazines, trade journals. KEY INDICATORS: Glossy covers, date/month/year, volume/issue numbers.

5. analog_media_electronics - Vinyl records, cassette tapes, laserdiscs, vintage audio gear. KEY INDICATORS: Center labels, track listings, model numbers.

6. stamps_postal - Stamps, First Day Covers, postal history. KEY INDICATORS: Perforated edges, denomination values, cancellation marks.

7. geographic_media - Old maps, charts, atlases. KEY INDICATORS: Topography, cartography, compass roses.

8. general_vintage_ephemera - The fallback category. Postcards, photos, ads, junk journal material.

### Output Instructions
You must respond with a JSON object:
{ "category": "...", "confidence_score": 0.85 }
`;
```

**Step 3: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/lib/ai/conductor.ts src/lib/ai/prompts/conductor.ts
git commit -m "feat: implement Conductor AI router"
```

---

### Task 4.2: Implement Expert Dispatcher

**Files:**
- Create: `src/lib/ai/expert.ts`
- Create: `src/lib/ai/prompts/experts.ts`

**Step 1: Create expert dispatcher**

```typescript
/**
 * Expert AI Dispatcher
 * Routes to category-specific expert prompts
 */

import Anthropic from '@anthropic-ai/sdk';
import { EXPERT_PROMPTS } from '@/lib/ai/prompts/experts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExpertResult {
  title: string;
  identified_names: string[];
  historical_context: string;
  collector_significance: string;
  estimated_value_signals: string[];
  visible_condition_issues: string[];
  ebay_search_keywords: string[];
  raw_response: string;
}

export async function runExpert(
  category: string,
  ocrText: string,
  imageBase64?: string
): Promise<ExpertResult> {
  const expertPrompt = EXPERT_PROMPTS[category as keyof typeof EXPERT_PROMPTS] || EXPERT_PROMPTS.general_vintage_ephemera;

  try {
    const content: Anthropic.MessageParam['content'] = [
      {
        type: 'text',
        text: `${expertPrompt}\n\n[OCR TEXT]:\n${ocrText}`,
      },
    ];

    if (imageBase64) {
      (content as Array<any>).unshift({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON
    let result: ExpertResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      result = JSON.parse(jsonMatch[0]) as ExpertResult;
    } catch {
      result = {
        title: '[Unable to extract]',
        identified_names: [],
        historical_context: '[Extraction failed]',
        collector_significance: '[N/A]',
        estimated_value_signals: [],
        visible_condition_issues: [],
        ebay_search_keywords: [],
        raw_response: responseText,
      };
    }

    result.raw_response = responseText;
    return result;
  } catch (err: any) {
    throw new Error(`[Expert Error] ${err.message}`);
  }
}
```

**Step 2: Create expert prompts**

Create `src/lib/ai/prompts/experts.ts`:

```typescript
export const EXPERT_PROMPTS = {
  comic_books: `You are an expert comic book appraiser. Analyze this comic and extract: title, issue number, condition flaws, value indicators (first appearance, variant cover, Newsstand vs Direct). Return JSON: { "title": "...", "identified_names": [...], "collector_significance": "...", "estimated_value_signals": [...], "visible_condition_issues": [...], "ebay_search_keywords": [...] }`,

  railroadiana: `You are a railroad history expert. Extract: railroad company, line/route, document type (timetable/ticket/memo), historical significance, condition. Return JSON with same fields.`,

  aerospace_technical: `You are an aerospace technical document expert. Extract: company (NASA/Rockwell/etc), program, document type, classification level, significance. Return JSON with same fields.`,

  serial_publications: `You are a vintage magazine expert. Extract: title, publication date, issue number, notable articles, rarity signals. Return JSON with same fields.`,

  analog_media_electronics: `You are a vintage audio/electronics expert. Extract: format (vinyl/cassette/etc), artist/band, album title, edition rarity, condition. Return JSON with same fields.`,

  stamps_postal: `You are a philately expert. Extract: country, denomination, issue date, cancel type, rarity indicators. Return JSON with same fields.`,

  geographic_media: `You are a cartography expert. Extract: map type, region, date, cartographer, historical significance. Return JSON with same fields.`,

  general_vintage_ephemera: `You are a general vintage items appraiser. Extract: item type, date, subject matter, condition, rarity signals. Return JSON with same fields.`,
};
```

**Step 3: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/lib/ai/expert.ts src/lib/ai/prompts/experts.ts
git commit -m "feat: implement Expert AI dispatcher with category prompts"
```

---

### Task 4.3: Wire Conductor + Expert into Scheduler

**Files:**
- Modify: `src/lib/scheduler.ts` (add AI enrichment stage)

**Step 1: Import AI functions at top**

```typescript
import { runConductor } from '@/lib/ai/conductor';
import { runExpert } from '@/lib/ai/expert';
```

**Step 2: Add processing_ai stage**

After `ocr_complete` stage, add:

```typescript
    if (item.status === 'processing_ai') {
      try {
        // Step 1: Run Conductor to categorize
        const conductorResult = await runConductor(item.rawOcr);
        console.log(`[Scheduler] ${item.id}: Conductor categorized as "${conductorResult.category}" (confidence: ${conductorResult.confidence_score})`);

        // Step 2: Run Expert for detailed extraction
        const expertResult = await runExpert(conductorResult.category, item.rawOcr);

        // Step 3: Build analysis history entry
        const analysisEntry = {
          timestamp: new Date().toISOString(),
          category: conductorResult.category,
          conductor_confidence: conductorResult.confidence_score,
          expert_extracted_title: expertResult.title,
          extracted_fields: {
            identified_names: expertResult.identified_names,
            historical_context: expertResult.historical_context,
            collector_significance: expertResult.collector_significance,
            estimated_value_signals: expertResult.estimated_value_signals,
            condition_issues: expertResult.visible_condition_issues,
            ebay_keywords: expertResult.ebay_search_keywords,
          },
        };

        // Parse existing analysis_history
        let analysisHistory = [];
        if (item.analysis_history) {
          try {
            analysisHistory = JSON.parse(item.analysis_history);
          } catch (err) {
            console.warn(`[Scheduler] ${item.id}: Could not parse existing analysis_history`);
          }
        }
        analysisHistory.push(analysisEntry);

        // Step 4: Update DB
        ItemService.updateMetadata(item.id, {
          title: expertResult.title,
          identifiedNames: JSON.stringify(expertResult.identified_names),
          historicalContext: expertResult.historical_context,
          collectorSignificance: expertResult.collector_significance,
          analysis_history: JSON.stringify(analysisHistory),
        });

        db.prepare(`UPDATE items SET status = 'complete', statusUpdatedAt = ? WHERE id = ?`)
          .run(new Date().toISOString(), item.id);

        console.log(`[Scheduler] ${item.id}: Enrichment complete - "${expertResult.title}"`);

      } catch (err: any) {
        console.error(`[Scheduler] ${item.id}: AI enrichment failed -`, err.message);
        db.prepare(`UPDATE items SET status = 'error', errorMessage = ?, statusUpdatedAt = ? WHERE id = ?`)
          .run(err.message, new Date().toISOString(), item.id);
      }
      continue;
    }
```

**Step 3: Update pipeline flow**

After `ocr_complete`, add transition to AI:

```typescript
    if (item.status === 'ocr_complete') {
      db.prepare(`UPDATE items SET status = 'processing_ai', statusUpdatedAt = ? WHERE id = ?`)
        .run(new Date().toISOString(), item.id);
      continue;
    }
```

**Step 4: Verify syntax**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "feat: wire Conductor + Expert AI into processing pipeline"
```

---

## Phase 5: End-to-End Test (Tasks 5.1 - 5.2)

### Task 5.1: Full Pipeline Test with Real Comic

**Files:**
- None (running code)

**Step 1: Start services**

Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
npx ts-node scripts/start-worker.ts
```

**Step 2: Upload one of your comics**

```bash
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202149.jpg" http://localhost:3000/api/upload
```

Note the returned `id`.

**Step 3: Watch terminal 2 for full flow**

Expected sequence:
```
[Scheduler] <id>: resize complete
[Scheduler] <id>: OCR complete (confidence: 95.3%)
[Scheduler] <id>: Conductor categorized as "comic_books" (confidence: 0.98)
[Scheduler] <id>: Enrichment complete - "Black Widow #234"
```

**Step 4: Query results**

```bash
# Stop dev server first
sqlite3 data/dev.db
SELECT id, status, title, identifiedNames, analysis_history FROM items ORDER BY createdAt DESC LIMIT 1;
```

Expected: Row with populated title, names, analysis history.

**Step 5: Commit**

```bash
git add .
git commit -m "checkpoint: Phase 5 complete - full pipeline working end-to-end"
```

---

### Task 5.2: Test All 4 Comics

**Files:**
- None (running code)

**Step 1: Keep services running from Task 5.1**

**Step 2: Upload remaining 3 comics**

```bash
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202152.jpg" http://localhost:3000/api/upload
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202141.jpg" http://localhost:3000/api/upload
curl -F "file=@C:/Users/wowth/Downloads/Photos-1-001/20260117_202145.jpg" http://localhost:3000/api/upload
```

**Step 3: Monitor completion**

Watch Terminal 2 for each comic to reach `complete` status.

**Step 4: Final verification**

```bash
sqlite3 data/dev.db
SELECT COUNT(*), status FROM items GROUP BY status;
```

Expected: 4 items in `complete` status.

**Step 5: Celebrate! 🎉**

```bash
git add .
git commit -m "feat: all 4 test comics processed successfully - pipeline complete!"
```

---

## Success Checklist

- [ ] Phase 1: GCV test passes on 4 comic images
- [ ] Phase 2: Database fixed, scheduler activated, image resizing works
- [ ] Phase 3: Google Cloud Vision integrated, OCR extracts text
- [ ] Phase 4: Conductor categorizes, Expert extracts reseller data
- [ ] Phase 5: Upload → full pipeline → database has enriched results

**If all checked:** Pipeline is working and ready for UI development! 🚀

---

## Troubleshooting

### "GOOGLE_APPLICATION_CREDENTIALS not set"
```bash
export GOOGLE_APPLICATION_CREDENTIALS="C:\Users\wowth\Documents\projects\paper-inventory\paper-inventory-488411-4f90bf2f1afc.json"
npx ts-node scripts/test-vision.ts
```

### "database is locked"
- Too many processes accessing DB at once
- Fix: Ensure only 1 dev server + 1 worker running
- Restart both services

### "Vision API quota exceeded"
- GCV has monthly free tier
- Wait 24-30 days or upgrade project

### "AI response is malformed"
- Check Anthropic API status
- Ensure `ANTHROPIC_API_KEY` is valid
- Check logs: `tail -f data/logs/*.log`

---

**Status:** Ready for execution!
**Total Estimated Time:** 5-6 hours
**Next Step:** Choose execution mode below
