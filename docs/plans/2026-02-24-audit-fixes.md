# Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all CRITICAL and HIGH ROI findings from the operator audit: broken FTS5 triggers in live DB, 4 unresolved merge conflicts, silent catch blocks, and a non-idempotent enrich endpoint.

**Architecture:** The runtime source of truth for the schema is `src/lib/db/index.ts` (not `schema.sql`). The "Updated upstream" side of every merge conflict is correct — it reflects the current architecture (multi-model AI router, analysis_history, verification_questions). The "Stashed changes" side is an older iteration that was superseded. All conflict resolutions should keep "Updated upstream" and discard "Stashed changes".

**Tech Stack:** Next.js 15, better-sqlite3, TypeScript, React 19, Sonner (toasts)

---

## Overview of Issues

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Live DB has old broken FTS5 triggers | CRITICAL | `src/lib/db/index.ts` |
| 2 | Merge conflict in `items.ts` | CRITICAL | `src/lib/db/items.ts` |
| 3 | Merge conflict in `enrich/route.ts` | CRITICAL | `src/app/api/items/[id]/enrich/route.ts` |
| 4 | Merge conflict in `ai/index.ts` | CRITICAL | `src/lib/ai/index.ts` |
| 5 | Merge conflict in `page.tsx` | CRITICAL | `src/app/items/[id]/page.tsx` |
| 6 | Silent `catch {}` in fetchCollections | HIGH | `src/app/items/[id]/page.tsx:231` |
| 7 | Silent `catch {}` parsing analysis_history | HIGH | `src/app/api/items/[id]/enrich/route.ts:56` |
| 8 | Silent `catch {}` in DebugFAB localStorage | LOW | `src/components/DebugFAB.tsx:25,29` |
| 9 | Non-idempotent enrich endpoint | HIGH | `src/app/api/items/[id]/enrich/route.ts` |
| 10 | `schema.sql` out of sync with runtime | STRUCTURAL | `src/lib/db/schema.sql` |

---

## Task 1: Fix Broken FTS5 Triggers in Live Database

**Context:** `src/lib/db/index.ts` uses `CREATE TRIGGER IF NOT EXISTS` — meaning if the old broken triggers already exist in the live `data/dev.db`, they will NOT be replaced by the correct ones. The old triggers referenced columns `identification`, `dealer_gut_check`, `ai_category` which don't exist in the items table, causing all INSERT/UPDATE/DELETE to fail silently or error.

**Fix:** Add a migration block that drops and recreates the FTS5 triggers unconditionally.

**Files:**
- Modify: `src/lib/db/index.ts` (after line ~141, in the migrations section)

**Step 1: Add trigger migration after the existing migration blocks**

In `src/lib/db/index.ts`, after the `analysis_history` migration (around line 141), add:

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

**Step 2: Verify the migration runs correctly**
Start the dev server (`npm run dev`) and check console output for:
`[Migration] FTS5 triggers recreated with correct columns.`

---

## Task 2: Resolve Merge Conflict — `src/lib/db/items.ts`

**Context:** The conflict is in the `Item` interface and `updateMetadata` EDITABLE whitelist. "Updated upstream" is correct — it has `verification_questions`, `collection_id`, `analysis_history` which the current system uses. "Stashed changes" has old reseller fields (`ai_category`, `dealer_gut_check`, etc.) from a prior design.

**Also note:** The `create()` method at line 73 references `user_decision` column which does NOT exist in the current schema. This must be removed.

**Files:**
- Modify: `src/lib/db/items.ts`

**Step 1: Resolve conflict in `Item` interface (lines 43-62)**

Keep ONLY the "Updated upstream" block:
```typescript
  verification_questions?: string; // JSON
  collection_id?: string;
  analysis_history?: string; // JSON array of past deep dives
```

Remove everything from `<<<<<<< Updated upstream` through `>>>>>>> Stashed changes`.

**Step 2: Resolve conflict in `updateMetadata` EDITABLE array (lines 210-219)**

Keep ONLY the "Updated upstream" block:
```typescript
    const EDITABLE = [
      'title', 'guessedId', 'cleanedTranscription', 'confidence',
      'identifiedNames', 'historicalContext', 'collectorSignificance',
      'tags', 'valuation', 'verification_questions',
      'collection_id', 'analysis_history', 'lockedFields'
    ];
```

**Step 3: Fix the `create()` method to remove `user_decision` column reference**

Current broken code at line 73:
```typescript
    const stmt = db.prepare(`
      INSERT INTO items (id, originalFilename, originalImagePath, mimeType, fileSize, status, originalHash, statusUpdatedAt, user_decision)
      VALUES (?, ?, ?, ?, ?, 'queued', ?, CURRENT_TIMESTAMP, 'none')
    `);
    stmt.run(id, filename, originalPath, mimeType, fileSize, originalHash ?? null);
```

Fix — remove `user_decision` (column doesn't exist in schema):
```typescript
    const stmt = db.prepare(`
      INSERT INTO items (id, originalFilename, originalImagePath, mimeType, fileSize, status, originalHash, statusUpdatedAt)
      VALUES (?, ?, ?, ?, ?, 'queued', ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, filename, originalPath, mimeType, fileSize, originalHash ?? null);
```

**Step 4: Verify no more conflict markers**
```bash
grep -n "<<<<<<\|=======\|>>>>>>>" src/lib/db/items.ts
```
Expected: no output (no conflicts remaining)

---

## Task 3: Resolve Merge Conflict — `src/app/api/items/[id]/enrich/route.ts`

**Context:** Two conflict zones. Zone 1 (lines 9-14): import statements. Zone 2 (lines 83-109): dead code block. "Updated upstream" uses `runFullPipeline` from `@/lib/ai` which is the current multi-model router. "Stashed changes" used `enrichDeepDive` from `openai-manual` — superseded.

**Files:**
- Modify: `src/app/api/items/[id]/enrich/route.ts`

**Step 1: Resolve import conflict (lines 9-14)**

Keep ONLY:
```typescript
import { runFullPipeline, AnalysisOptions } from '@/lib/ai';
```

**Step 2: Remove the dead code block in the second conflict (lines 83-109)**

The second conflict zone starts at `<<<<<<< Updated upstream` after the `for` loop for locked fields (line 83). The "Updated upstream" side is EMPTY (just a blank line before `ItemService.updateMetadata`). Keep that — delete the entire "Stashed changes" block which contains the old `enrichDeepDive` call.

Final result should go directly from the locked fields loop to:
```typescript
    ItemService.updateMetadata(id, updates);

    return NextResponse.json({ success: true, ... });
```

**Step 3: Verify no more conflict markers**
```bash
grep -n "<<<<<<\|=======\|>>>>>>>" src/app/api/items/[id]/enrich/route.ts
```
Expected: no output

---

## Task 4: Resolve Merge Conflict — `src/lib/ai/index.ts`

**Context:** Conflict is at the very top (lines 1-44). "Updated upstream" is the full multi-model AI router (correct). "Stashed changes" is a tiny 3-function stub that only calls `openai-manual`. Keep upstream entirely.

**Files:**
- Modify: `src/lib/ai/index.ts`

**Step 1: Resolve the conflict at lines 1-44**

The file comment block and `AnalysisOptions` interface are in the "Updated upstream" side. The "Stashed changes" side introduces a simple `analyzeImage` stub that throws for non-openai providers. The upstream version's `analyzeImage` function at line 212 is the correct one.

Remove the conflict markers and keep everything from the "Updated upstream" side. The closing `}` at line 44 closes the `AnalysisOptions` interface — keep it.

The final top of the file should read:
```typescript
/**
 * AI PROVIDER ROUTER (v3)
 * ...
 */

import { ItemMetadata, ItemMetadataSchema } from './schema';
import { BASELINE_SYSTEM_PROMPT, ... } from './prompts';
...

export interface AnalysisOptions {
  baselineModel?: string;
  deepDiveModel?: string;
  enableGrounding?: boolean;
  customPrompt?: string;
}
```

**Step 2: Verify**
```bash
grep -n "<<<<<<\|=======\|>>>>>>>" src/lib/ai/index.ts
```
Expected: no output

---

## Task 5: Resolve Merge Conflict — `src/app/items/[id]/page.tsx`

**Context:** The conflict (around line 264) is between `useInlineEdit` hook (upstream) vs keyboard navigation `useEffect` (stashed). Need to read the full conflict zone to resolve correctly.

**Files:**
- Modify: `src/app/items/[id]/page.tsx`

**Step 1: Read the full conflict zone**

Read lines 260-320 of the file to see both sides of the conflict before resolving.

**Step 2: Keep "Updated upstream" side**

The upstream version uses `useInlineEdit(id, fetchItem)` which is the correct hook-based approach for the current codebase. Keep it, discard the keyboard navigation block from stashed (it was a prior experiment).

**Step 3: Verify**
```bash
grep -n "<<<<<<\|=======\|>>>>>>>" src/app/items/[id]/page.tsx
```
Expected: no output

---

## Task 6: Fix Silent `catch {}` Blocks

**Context:** Silent catches hide real errors. For client-side network calls, log to console.error at minimum. For localStorage (DebugFAB), `catch { return null }` is actually acceptable — localStorage failures are non-critical and surfacing them as errors would be noisy. The `fetchCollections` catch is the most important to fix.

**Files:**
- Modify: `src/app/items/[id]/page.tsx` (line 231)
- Modify: `src/app/api/items/[id]/enrich/route.ts` (line 56)

**Step 1: Fix `fetchCollections` silent catch in `page.tsx`**

Current (line 227-232):
```typescript
  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      if (res.ok) setCollections(await res.json());
    } catch {}
  };
```

Fix:
```typescript
  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      if (res.ok) setCollections(await res.json());
    } catch (err) {
      console.error('[fetchCollections] Failed to load collections:', err);
    }
  };
```

**Step 2: Fix silent `catch {}` when parsing `analysis_history` in enrich route**

Current (line 54-57 in enrich/route.ts):
```typescript
    let analysisHistory = [];
    if (item.analysis_history) {
      try { analysisHistory = JSON.parse(item.analysis_history); } catch {}
    }
```

Fix — log the parse error so corrupted data is visible:
```typescript
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

---

## Task 7: Add Idempotency Check to Enrich Endpoint

**Context:** If `/api/items/[id]/enrich` is called twice in quick succession (network retry, double-click), it will run the full AI pipeline twice and append duplicate entries to `analysis_history`. Fix: check if the item is already in `processing_ai` status and reject duplicates. Also check if a recent successful analysis exists.

**Files:**
- Modify: `src/app/api/items/[id]/enrich/route.ts`

**Step 1: Add idempotency guard after item fetch (around line 28)**

After:
```typescript
    if (!item.originalImagePath) return NextResponse.json({ error: 'No image' }, { status: 400 });
```

Add:
```typescript
    // Idempotency guard: reject if already being enriched
    if (item.status === 'processing_ai' && item.processingLock === 1) {
      return NextResponse.json({ error: 'Enrichment already in progress for this item' }, { status: 409 });
    }
```

**Step 2: Verify the endpoint still works end-to-end**

Trigger an enrich from the UI. Confirm only one analysis entry is appended to `analysis_history`.

---

## Task 8: Sync `schema.sql` to Match Runtime Schema

**Context:** `schema.sql` is documented as a reference file (not runtime). It's out of sync with `index.ts` — it references the old broken FTS5 columns. Update it to match the current runtime schema so it's useful as documentation.

**Files:**
- Modify: `src/lib/db/schema.sql`

**Step 1: Replace the FTS5 virtual table and triggers in schema.sql**

Replace the FTS5 block (lines 77-105) with the correct columns matching `index.ts`:

```sql
-- FTS5 Virtual Table for Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title,
    cleanedTranscription,
    identifiedNames,
    content='items',
    content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames)
  VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames);
END;

CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames)
  VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames);
END;

CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, cleanedTranscription, identifiedNames)
  VALUES('delete', old.rowid, old.title, old.cleanedTranscription, old.identifiedNames);
  INSERT INTO items_fts(rowid, title, cleanedTranscription, identifiedNames)
  VALUES (new.rowid, new.title, new.cleanedTranscription, new.identifiedNames);
END;
```

**Step 2: Add missing columns to `items` table in schema.sql**

Add `lockedFields`, `statusUpdatedAt` to the table definition — they exist in the runtime schema but are missing from schema.sql.

---

## Final Verification

After all tasks complete:

**Step 1: Check for any remaining conflict markers**
```bash
grep -rn "<<<<<<\|=======\|>>>>>>>" src/
```
Expected: no output

**Step 2: TypeScript compilation check**
```bash
npx tsc --noEmit
```
Expected: 0 errors

**Step 3: Start dev server and confirm it boots**
```bash
npm run dev
```
Expected: Server starts, console shows `[Migration] FTS5 triggers recreated with correct columns.`

**Step 4: Test a full item upload → enrich flow manually**
- Upload an image
- Confirm it processes through the state machine without errors
- Click enrich
- Confirm analysis_history shows exactly 1 entry
- Click enrich again immediately
- Confirm you get a 409 response (already in progress) or the second call is blocked

---

## Health Score After Fixes

| Before | After |
|--------|-------|
| 2/10 | ~6/10 |

Remaining work to reach 8/10: centralized server-side logging, naming convention standardization, dependency audit.
