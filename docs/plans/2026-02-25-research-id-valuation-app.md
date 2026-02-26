# Research / ID / Valuation App — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform paper-inventory from a generic document processor into a best-in-class field research tool — photograph an item anywhere, get instant AI identification + valuation, save the research record forever regardless of purchase decision.

**Architecture:** Keep the existing Next.js + SQLite + multi-provider AI foundation (it's solid). Layer on: a research-context data model (where found, asking price, purchase decision), a two-tier AI pipeline (fast Flash ID → deep Pro valuation), polished Framer Motion queue animations from paper-pixie-pro, high-value flagging with visual rewards, a complete detail page, advanced filtering, and CSV/JSON export.

**Tech Stack:** Next.js 16, React 19, TypeScript, Better-SQLite3 (WAL), Sharp, Tesseract.js, Anthropic Claude (primary AI), Gemini Flash (fast tier), Framer Motion 12, Tailwind CSS, Sonner toasts.

**Source repos for reference (all cloned inside this project folder):**
- `paper-pixie-pro/` — animations, queue UX, strategy export
- `box-audit-system/apps/vault/` — two-tier AI, shutter/treasure animations
- `rork-ephemera-sorter/` — filter UI, confidence visualization
- `ARCHIVED-rork-reseller-inventory-dashboard/` — Zod AI schemas, behavioral alerts
- `VINTAGE-SOLO-PUBLIC/` — multi-provider fallback pattern

---

## Phase 1 — Research Context Data Model

> The single most important change. Right now items are "documents being processed." They need to become "research records" with field context.

### [x] Task 1: Add Research Fields via Migration

**Files:**
- Modify: `src/lib/db/index.ts` (migration block at bottom of `initSchema()`)

The existing migration pattern uses try/catch ALTER TABLE blocks. Add these columns to items:

**Step 1: Add migration block at the end of `initSchema()`**

```typescript
// Migration: research context fields
const researchMigrations = [
  `ALTER TABLE items ADD COLUMN research_location TEXT`,           // "Goodwill on Main St", "Rose Bowl Flea Market"
  `ALTER TABLE items ADD COLUMN asking_price TEXT`,                // what the seller wants — free text ("$40", "make offer")
  `ALTER TABLE items ADD COLUMN purchase_decision TEXT DEFAULT 'undecided' CHECK(purchase_decision IN ('undecided','interested','purchased','passed'))`,
  `ALTER TABLE items ADD COLUMN research_notes TEXT`,              // freeform field notes
  `ALTER TABLE items ADD COLUMN estimated_value_low REAL`,         // parsed from AI — floor
  `ALTER TABLE items ADD COLUMN estimated_value_high REAL`,        // parsed from AI — ceiling
  `ALTER TABLE items ADD COLUMN estimated_value_point REAL`,       // single best estimate
  `ALTER TABLE items ADD COLUMN value_confidence TEXT`,            // 'high'|'medium'|'low'
  `ALTER TABLE items ADD COLUMN is_high_value INTEGER DEFAULT 0`,  // 1 if AI flags as notable value
  `ALTER TABLE items ADD COLUMN ebay_keywords TEXT`,               // AI-suggested eBay search terms
  `ALTER TABLE items ADD COLUMN category TEXT`,                    // top-level category from conductor
  `ALTER TABLE items ADD COLUMN research_stage TEXT DEFAULT 'identified' CHECK(research_stage IN ('identified','valued','reviewed','exported'))`,
];

for (const sql of researchMigrations) {
  try {
    db.exec(sql);
    const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
    console.log(`[Migration] Added column: ${col}`);
  } catch (e) {
    // Column already exists — expected on existing DBs
  }
}
```

**Step 2: Update FTS triggers to also index research_location and research_notes**

```typescript
// After the migration block, re-create FTS to include new fields
// (SQLite FTS5 virtual tables can't be altered, but triggers can be replaced)
try {
  db.exec(`DROP TRIGGER IF EXISTS items_ai`);
  db.exec(`DROP TRIGGER IF EXISTS items_ad`);
  db.exec(`DROP TRIGGER IF EXISTS items_au`);
  // Re-create with new fields added (append-only to existing FTS table is safe)
} catch (e) {}
```

> Note: The FTS5 virtual table schema can't be changed without dropping and recreating it (which would wipe search index). For now, just add triggers that include the new fields on new rows. Existing rows will be re-indexed next time they're updated.

**Step 3: Verify migration runs without errors**
```bash
cd C:/Users/wowth/Documents/projects/paper-inventory
npm run dev
# Open http://localhost:3000 — check server console for "[Migration] Added column:" lines
# No red errors = good
```

**Step 4: Commit**
```bash
git add src/lib/db/index.ts
git commit -m "feat: add research context columns to items table"
```

---

### [x] Task 2: Update TypeScript Types

**Files:**
- Create: `src/types/research.ts`
- Modify: `src/lib/db/items.ts` (update return types on getItem, listItems)

**Step 1: Create the research types file**

```typescript
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
```

**Step 2: Update `src/lib/db/items.ts` — add new fields to SELECT queries**

Find the `getItem` and `listItems` functions. Add the new columns to the SELECT. Example:

```typescript
// In listItems SELECT, add:
research_location, asking_price, purchase_decision, research_notes,
estimated_value_low, estimated_value_high, estimated_value_point,
value_confidence, is_high_value, ebay_keywords, category, research_stage
```

**Step 3: Verify TypeScript compiles**
```bash
npx tsc --noEmit
# Expected: no errors
```

**Step 4: Commit**
```bash
git add src/types/research.ts src/lib/db/items.ts
git commit -m "feat: TypeScript types for research context and valuation"
```

---

## Phase 2 — Two-Tier AI Pipeline

> Currently paper-inventory runs one AI pass (conductor → expert). We're adding a second tier: a fast "Flash" identification pass that runs immediately, followed by an async deep "Valuation" pass that extracts structured pricing.

### [x] Task 3: Valuation Extractor Service

The existing `expert.ts` extracts `estimated_value_signals[]` — plain text hints like "similar items sell for $40-80 on eBay." We need to parse those into structured numbers AND add a dedicated valuation prompt that asks for explicit price ranges.

**Files:**
- Create: `src/lib/ai/valuator.ts`

**Step 1: Create the valuator**

```typescript
// src/lib/ai/valuator.ts
// Runs AFTER the expert pass. Takes the full item context and produces
// structured valuation fields.

import { callAI } from './index';

export interface ValuationOutput {
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: 'high' | 'medium' | 'low';
  is_high_value: boolean;
  ebay_keywords: string;
  value_reasoning: string;
}

const VALUATION_PROMPT = `You are an expert appraiser specializing in vintage collectibles, ephemera, and paper goods.

Given the following item description, provide a structured valuation.

Respond ONLY with valid JSON matching this exact schema:
{
  "estimated_value_low": <number or null — floor price in USD>,
  "estimated_value_high": <number or null — ceiling price in USD>,
  "estimated_value_point": <number or null — single best estimate in USD>,
  "value_confidence": "high" | "medium" | "low",
  "is_high_value": <boolean — true if item is likely worth $75 or more>,
  "ebay_keywords": "<3-6 specific search terms a buyer would use, comma separated>",
  "value_reasoning": "<1-2 sentences explaining the valuation>"
}

Rules:
- Base estimates on ACTUAL recent eBay sold listings for this type of item
- If you genuinely cannot estimate, use null for price fields and "low" confidence
- is_high_value = true for anything likely $75+
- ebay_keywords should be SPECIFIC (e.g. "1952 topps baseball card grade 4" not "baseball card")
- Do NOT include dollar signs in numeric fields — numbers only`;

export async function extractValuation(
  title: string,
  category: string,
  historicalContext: string,
  collectorSignificance: string,
  rawSignals: string,      // the existing estimated_value_signals from expert pass
  ocrText: string,
): Promise<ValuationOutput | null> {
  const prompt = `${VALUATION_PROMPT}

Item Details:
- Title: ${title}
- Category: ${category}
- Historical Context: ${historicalContext}
- Collector Significance: ${collectorSignificance}
- OCR Text: ${ocrText?.slice(0, 500) || 'none'}
- Previous Value Signals: ${rawSignals}`;

  try {
    const raw = await callAI(prompt, undefined, { maxTokens: 512, temperature: 0 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      estimated_value_low: typeof parsed.estimated_value_low === 'number' ? parsed.estimated_value_low : null,
      estimated_value_high: typeof parsed.estimated_value_high === 'number' ? parsed.estimated_value_high : null,
      estimated_value_point: typeof parsed.estimated_value_point === 'number' ? parsed.estimated_value_point : null,
      value_confidence: ['high','medium','low'].includes(parsed.value_confidence) ? parsed.value_confidence : 'low',
      is_high_value: Boolean(parsed.is_high_value),
      ebay_keywords: parsed.ebay_keywords || '',
      value_reasoning: parsed.value_reasoning || '',
    };
  } catch (e) {
    console.error('[Valuator] Failed to parse valuation:', e);
    return null;
  }
}
```

**Step 2: Verify it compiles**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add src/lib/ai/valuator.ts
git commit -m "feat: structured valuation extractor AI service"
```

---

### [x] Task 4: Wire Valuation into Queue Manager

**Files:**
- Modify: `src/lib/queue/manager.ts`
- Modify: `src/lib/db/items.ts` (add `updateValuation` function)

**Step 1: Add `updateValuation` to items DB service**

```typescript
// src/lib/db/items.ts — add this function

export function updateValuation(id: string, v: {
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: string;
  is_high_value: boolean;
  ebay_keywords: string;
}) {
  db.prepare(`
    UPDATE items SET
      estimated_value_low = ?,
      estimated_value_high = ?,
      estimated_value_point = ?,
      value_confidence = ?,
      is_high_value = ?,
      ebay_keywords = ?,
      research_stage = 'valued',
      statusUpdatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    v.estimated_value_low,
    v.estimated_value_high,
    v.estimated_value_point,
    v.value_confidence,
    v.is_high_value ? 1 : 0,
    v.ebay_keywords,
    id
  );
}
```

**Step 2: In queue manager, call valuator after AI expert pass completes**

In `src/lib/queue/manager.ts`, find where status is set to `'complete'` after the AI pass. Before that final status update, call the valuator:

```typescript
import { extractValuation } from '../ai/valuator';
import { updateValuation } from '../db/items';

// After expert pass, before setting status to 'complete':
const item = getItem(itemId); // fetch current item state
if (item && item.title && item.historicalContext) {
  const valuation = await extractValuation(
    item.title,
    item.category || '',
    item.historicalContext || '',
    item.collectorSignificance || '',
    // Parse estimated_value_signals from AI response if available
    item.aiRawResponse ? extractSignalsFromResponse(item.aiRawResponse) : '',
    item.cleanedTranscription || '',
  );
  if (valuation) {
    updateValuation(itemId, valuation);
  }
}
```

> Note: `extractSignalsFromResponse` is a small helper that pulls `estimated_value_signals` array from the raw AI JSON. Add it near the top of manager.ts:

```typescript
function extractSignalsFromResponse(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const signals = parsed?.estimated_value_signals || parsed?.value_signals || [];
    return Array.isArray(signals) ? signals.join('; ') : '';
  } catch { return ''; }
}
```

**Step 3: Test by uploading a test image and watching logs**
```bash
npm run dev
# Upload an image in the UI
# Watch console for: [Valuator] or any JSON parse errors
# After processing completes, check DB:
# sqlite3 data/dev.db "SELECT id, title, estimated_value_point, is_high_value FROM items LIMIT 5;"
```

**Step 4: Commit**
```bash
git add src/lib/ai/valuator.ts src/lib/db/items.ts src/lib/queue/manager.ts
git commit -m "feat: wire valuation extractor into processing queue"
```

---

## Phase 3 — Queue Animations (from paper-pixie-pro)

> The current card grid uses basic Framer Motion fade. paper-pixie-pro has a much better pattern: scale 0.85→1 entrance, layout reflow, and a "processing" overlay with blur + spinner. Port it.

### [x] Task 5: Upgrade ItemCard Animations

**Files:**
- Modify: `src/components/ItemCard.tsx`
- Modify: `src/app/page.tsx` (grid wrapper)

**Step 1: Update ItemCard to use scale entrance + layout animation**

Replace the current `<motion.div>` (which has no entrance animation) with:

```tsx
// src/components/ItemCard.tsx — replace the motion.div wrapper

<motion.div
  layout
  initial={{ opacity: 0, scale: 0.88 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.88 }}
  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
  className="relative bg-[var(--surface-800)] rounded-[6px] overflow-hidden hover-lift flex flex-col min-h-[420px] satin-shadow border border-transparent hover:border-[var(--glass-01)]"
>
```

**Step 2: Add `AnimatePresence` to the grid in `src/app/page.tsx`**

Find where the grid maps over items. Wrap with AnimatePresence:

```tsx
import { AnimatePresence, motion } from 'framer-motion';

// In the grid:
<AnimatePresence mode="popLayout">
  {items.map((item, idx) => (
    <ItemCard key={item.id} item={item} />
  ))}
</AnimatePresence>
```

> `mode="popLayout"` is important — it lets removed items animate out without blocking layout.

**Step 3: Improve the processing overlay on ItemCard**

Replace the existing processing overlay with a backdrop-blur spinner matching paper-pixie-pro's style:

```tsx
{/* Processing overlay — replaces existing */}
{!isComplete && !isError && (
  <div className="absolute inset-0 bg-[var(--surface-800)]/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10">
    <RefreshCw size={20} className="text-[var(--accent-warm)] animate-spin" />
    <span className="text-[10px] font-semibold text-[var(--accent-warm)] uppercase tracking-widest">
      {item.status === 'processing_ai' ? 'Identifying…' :
       item.status === 'processing_ocr' ? 'Reading…' :
       item.status === 'processing_resize' ? 'Processing…' :
       'Queued'}
    </span>
  </div>
)}
```

**Step 4: Add high-value visual treatment to ItemCard**

When `item.is_high_value` is true, add a gold ring:

```tsx
// Add to the motion.div className conditionally:
const cardClass = cn(
  "relative bg-[var(--surface-800)] rounded-[6px] overflow-hidden hover-lift flex flex-col min-h-[420px] satin-shadow border transition-colors",
  item.is_high_value
    ? "border-[var(--accent-warm)] shadow-[0_0_16px_rgba(191,164,106,0.25)]"
    : "border-transparent hover:border-[var(--glass-01)]"
);
```

**Step 5: Visual test — upload 3 images and watch them enter the grid**
- Cards should scale up from 0.88 → 1.0 as they appear
- Processing overlay should show correct stage text
- Grid should reflow smoothly when cards complete

**Step 6: Commit**
```bash
git add src/components/ItemCard.tsx src/app/page.tsx
git commit -m "feat: Framer Motion scale entrance + AnimatePresence grid + processing overlay"
```

---

### [x] Task 6: "Thinking" Phase Cycler During Processing

> paper-pixie-pro cycles through descriptive phases ("Reading text...", "Identifying publisher...", "Checking value signals...") while AI runs. Port this to the upload/queue area.

**Files:**
- Create: `src/components/ProcessingPhaseIndicator.tsx`
- Modify: `src/components/UploadDropzone.tsx` (or wherever the upload status is shown)

**Step 1: Create ProcessingPhaseIndicator**

```tsx
// src/components/ProcessingPhaseIndicator.tsx
"use client";
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const PHASES = [
  { icon: "🔍", text: "Reading text…" },
  { icon: "🏷️", text: "Identifying item…" },
  { icon: "📚", text: "Checking historical context…" },
  { icon: "💰", text: "Estimating value…" },
  { icon: "🔎", text: "Finding comparable sales…" },
  { icon: "✨", text: "Finalizing research record…" },
];

export function ProcessingPhaseIndicator({ isActive }: { isActive: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % PHASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-3 py-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-2"
        >
          <span className="text-lg">{PHASES[phase].icon}</span>
          <span className="text-sm text-[var(--text-200)] font-medium">
            {PHASES[phase].text}
          </span>
        </motion.div>
      </AnimatePresence>
      {/* Progress dots */}
      <div className="flex gap-1 ml-auto">
        {PHASES.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === phase ? 'bg-[var(--accent-warm)]' : 'bg-[var(--surface-600)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add to the page — show when there are items in processing state**

In `src/app/page.tsx`, determine if any items are currently processing:

```tsx
import { ProcessingPhaseIndicator } from '@/components/ProcessingPhaseIndicator';

// Near top of component:
const hasProcessing = items.some(i =>
  ['queued','processing_ocr','ocr_complete','processing_resize','resize_complete','processing_ai']
  .includes(i.status)
);

// In JSX, above the grid:
<ProcessingPhaseIndicator isActive={hasProcessing} />
```

**Step 3: Test — upload an image and watch the phase text cycle**

**Step 4: Commit**
```bash
git add src/components/ProcessingPhaseIndicator.tsx src/app/page.tsx
git commit -m "feat: thinking phase cycler during AI processing"
```

---

### [x] Task 7: High-Value "Treasure Found" Flash Effect

> From VAULT: when a high-value item completes processing, flash the screen white and show a gold shimmer on the card. Pure dopamine.

**Files:**
- Create: `src/components/TreasureFoundEffect.tsx`
- Modify: `src/app/page.tsx` (trigger on new high-value completions)

**Step 1: Create TreasureFoundEffect**

```tsx
// src/components/TreasureFoundEffect.tsx
"use client";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function TreasureFoundEffect({ trigger }: { trigger: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 600);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-white/20 pointer-events-none z-50"
        />
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Track newly completed high-value items in page.tsx**

```tsx
import { TreasureFoundEffect } from '@/components/TreasureFoundEffect';

// In the polling/refresh logic, detect when an item transitions to
// complete with is_high_value=true:
const [treasureTrigger, setTreasureTrigger] = useState(false);
const prevItemsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  const completedHighValue = items.filter(
    i => i.status === 'complete' && i.is_high_value && !prevItemsRef.current.has(i.id)
  );
  if (completedHighValue.length > 0) {
    setTreasureTrigger(t => !t); // toggle to re-trigger
  }
  // Update the seen set
  items.forEach(i => {
    if (i.status === 'complete') prevItemsRef.current.add(i.id);
  });
}, [items]);

// In JSX:
<TreasureFoundEffect trigger={treasureTrigger} />
```

**Step 3: Test — upload an image of something clearly valuable (a signed baseball card, rare coin photo, etc.) and watch for the white flash**

> Note: The AI needs to return `is_high_value: true` for this to trigger. You may need to test with a known valuable item.

**Step 4: Commit**
```bash
git add src/components/TreasureFoundEffect.tsx src/app/page.tsx
git commit -m "feat: treasure found flash effect for high-value items"
```

---

## Phase 4 — Research Context UI

> The most user-facing change. Items need a way to capture WHERE you found it, WHAT they're asking, and your DECISION (interested / passed / purchased).

### Task 8: Research Context Panel on Detail Page

The detail page at `src/app/items/[id]/page.tsx` is currently incomplete per the audit. This task builds the research context section.

**Files:**
- Create: `src/components/ResearchContextPanel.tsx`
- Modify: `src/app/items/[id]/page.tsx`
- Create: `src/app/api/items/[id]/research/route.ts`

**Step 1: Create the PATCH API endpoint**

```typescript
// src/app/api/items/[id]/research/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed = ['research_location','asking_price','purchase_decision','research_notes'];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), params.id];
  db.prepare(`UPDATE items SET ${sets}, statusUpdatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  return NextResponse.json({ ok: true });
}
```

**Step 2: Create ResearchContextPanel component**

```tsx
// src/components/ResearchContextPanel.tsx
"use client";
import { useState } from 'react';
import { MapPin, DollarSign, StickyNote, CheckCircle, XCircle, Star, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PurchaseDecision } from '@/types/research';

const DECISIONS: { value: PurchaseDecision; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'interested', label: 'Interested', icon: <Star size={14} />, color: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
  { value: 'purchased', label: 'Purchased', icon: <CheckCircle size={14} />, color: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { value: 'passed', label: 'Passed', icon: <XCircle size={14} />, color: 'text-red-400 border-red-400/40 bg-red-400/10' },
  { value: 'undecided', label: 'Undecided', icon: <HelpCircle size={14} />, color: 'text-[var(--text-300)] border-[var(--glass-01)] bg-transparent' },
];

interface Props {
  itemId: string;
  initial: {
    research_location: string | null;
    asking_price: string | null;
    purchase_decision: PurchaseDecision;
    research_notes: string | null;
  };
}

export function ResearchContextPanel({ itemId, initial }: Props) {
  const [location, setLocation] = useState(initial.research_location || '');
  const [askingPrice, setAskingPrice] = useState(initial.asking_price || '');
  const [decision, setDecision] = useState<PurchaseDecision>(initial.purchase_decision);
  const [notes, setNotes] = useState(initial.research_notes || '');
  const [saving, setSaving] = useState(false);

  async function save(patch: Record<string, string>) {
    setSaving(true);
    await fetch(`/api/items/${itemId}/research`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-200)] uppercase tracking-wider">Research Context</h3>

      {/* Purchase Decision */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-2 block">Decision</label>
        <div className="flex flex-wrap gap-2">
          {DECISIONS.map(d => (
            <button
              key={d.value}
              onClick={() => { setDecision(d.value); save({ purchase_decision: d.value }); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                decision === d.value ? d.color : "text-[var(--text-300)] border-[var(--glass-01)] hover:border-[var(--glass-02)]"
              )}
            >
              {d.icon}{d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Where Found */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-1 flex items-center gap-1">
          <MapPin size={11} /> Where Found
        </label>
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          onBlur={() => save({ research_location: location })}
          placeholder="e.g. Rose Bowl Flea Market, Booth 42"
          className="w-full bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-100)] placeholder:text-[var(--text-400)] focus:outline-none focus:border-[var(--accent-warm)]/50"
        />
      </div>

      {/* Asking Price */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-1 flex items-center gap-1">
          <DollarSign size={11} /> Asking Price
        </label>
        <input
          value={askingPrice}
          onChange={e => setAskingPrice(e.target.value)}
          onBlur={() => save({ asking_price: askingPrice })}
          placeholder='e.g. "$40", "Make offer", "Free bin"'
          className="w-full bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-100)] placeholder:text-[var(--text-400)] focus:outline-none focus:border-[var(--accent-warm)]/50"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-[var(--text-300)] mb-1 flex items-center gap-1">
          <StickyNote size={11} /> Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => save({ research_notes: notes })}
          placeholder="Condition observations, seller info, gut feelings…"
          rows={3}
          className="w-full bg-[var(--surface-780)] border border-[var(--glass-01)] rounded-[4px] px-3 py-2 text-sm text-[var(--text-100)] placeholder:text-[var(--text-400)] focus:outline-none focus:border-[var(--accent-warm)]/50 resize-none"
        />
      </div>

      {saving && <p className="text-xs text-[var(--text-400)]">Saving…</p>}
    </div>
  );
}
```

**Step 3: Add ResearchContextPanel to the detail page**

In `src/app/items/[id]/page.tsx`, fetch the research fields and render the panel in a sidebar or below the AI results:

```tsx
import { ResearchContextPanel } from '@/components/ResearchContextPanel';

// In the page, after fetching item data:
<ResearchContextPanel
  itemId={item.id}
  initial={{
    research_location: item.research_location,
    asking_price: item.asking_price,
    purchase_decision: item.purchase_decision || 'undecided',
    research_notes: item.research_notes,
  }}
/>
```

**Step 4: Test — open an item detail page, fill in location and decision, refresh — values should persist**

**Step 5: Commit**
```bash
git add src/components/ResearchContextPanel.tsx src/app/api/items/[id]/research/route.ts src/app/items/[id]/page.tsx
git commit -m "feat: research context panel (location, asking price, decision, notes)"
```

---

## Phase 5 — Valuation Display

### Task 9: Structured Valuation Block on Detail Page + Card

**Files:**
- Create: `src/components/ValuationBlock.tsx`
- Modify: `src/components/ItemCard.tsx` (replace regex-parsed value with structured display)

**Step 1: Create ValuationBlock component**

```tsx
// src/components/ValuationBlock.tsx
"use client";
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValueConfidence } from '@/types/research';

interface Props {
  estimated_value_low: number | null;
  estimated_value_high: number | null;
  estimated_value_point: number | null;
  value_confidence: ValueConfidence | null;
  is_high_value: boolean;
  ebay_keywords: string | null;
  compact?: boolean; // true for card, false for detail page
}

const confidenceColors: Record<ValueConfidence, string> = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-[var(--text-400)]',
};

export function ValuationBlock({
  estimated_value_low, estimated_value_high, estimated_value_point,
  value_confidence, is_high_value, ebay_keywords, compact = false
}: Props) {
  const hasValue = estimated_value_point !== null || estimated_value_low !== null;

  if (!hasValue) {
    return <p className="text-sm text-[var(--text-400)] italic">Valuation pending…</p>;
  }

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const displayRange = estimated_value_low !== null && estimated_value_high !== null
    ? `${fmt(estimated_value_low)} – ${fmt(estimated_value_high)}`
    : null;

  const displayPoint = estimated_value_point !== null ? fmt(estimated_value_point) : null;

  const ebayUrl = ebay_keywords
    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebay_keywords)}&LH_Sold=1&LH_Complete=1`
    : null;

  if (compact) {
    return (
      <div className="flex items-baseline gap-2">
        <span className={cn("text-[18px] font-bold font-serif tracking-tight", is_high_value ? "text-[var(--accent-warm)]" : "text-[var(--text-100)]")}>
          {displayPoint || displayRange}
        </span>
        {value_confidence && (
          <span className={cn("text-[10px] font-medium uppercase", confidenceColors[value_confidence])}>
            {value_confidence}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3 flex-wrap">
        {displayPoint && (
          <span className={cn("text-3xl font-bold font-serif tracking-tight", is_high_value ? "text-[var(--accent-warm)]" : "text-[var(--text-100)]")}>
            {displayPoint}
          </span>
        )}
        {displayRange && (
          <span className="text-lg text-[var(--text-200)]">{displayRange}</span>
        )}
        {is_high_value && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-warm)]/20 text-[var(--accent-warm)] border border-[var(--accent-warm)]/30">
            HIGH VALUE
          </span>
        )}
      </div>

      {value_confidence && (
        <p className={cn("text-xs font-medium", confidenceColors[value_confidence])}>
          {value_confidence.charAt(0).toUpperCase() + value_confidence.slice(1)} confidence
        </p>
      )}

      {ebayUrl && (
        <a
          href={ebayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-300)] hover:text-[var(--accent-warm)] transition-colors"
        >
          <ExternalLink size={11} />
          Search sold listings: {ebay_keywords}
        </a>
      )}
    </div>
  );
}
```

**Step 2: Update ItemCard to use ValuationBlock (compact mode)**

Replace the existing `displayValue` parsing logic in `src/components/ItemCard.tsx` with:

```tsx
import { ValuationBlock } from './ValuationBlock';

// Remove the existing displayValue computation and replace the footer value section with:
<ValuationBlock
  estimated_value_low={item.estimated_value_low}
  estimated_value_high={item.estimated_value_high}
  estimated_value_point={item.estimated_value_point}
  value_confidence={item.value_confidence}
  is_high_value={item.is_high_value}
  ebay_keywords={item.ebay_keywords}
  compact
/>
```

**Step 3: Add ValuationBlock to detail page**

In `src/app/items/[id]/page.tsx`, replace any existing valuation text display:

```tsx
import { ValuationBlock } from '@/components/ValuationBlock';

<ValuationBlock
  estimated_value_low={item.estimated_value_low}
  estimated_value_high={item.estimated_value_high}
  estimated_value_point={item.estimated_value_point}
  value_confidence={item.value_confidence}
  is_high_value={item.is_high_value}
  ebay_keywords={item.ebay_keywords}
/>
```

**Step 4: Commit**
```bash
git add src/components/ValuationBlock.tsx src/components/ItemCard.tsx src/app/items/[id]/page.tsx
git commit -m "feat: structured valuation display with confidence + eBay search link"
```

---

## Phase 6 — Advanced Filtering

> From rork-ephemera-sorter: dynamic chip filters that populate from actual data, confidence visualization, decision-based filtering.

### Task 10: Filter Bar with Decision + Value + Category Chips

**Files:**
- Create: `src/components/FilterBar.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/api/items/route.ts` (add filter params)

**Step 1: Update the items list API to accept filter params**

In `src/app/api/items/route.ts`, add query param handling:

```typescript
// Add to the GET handler:
const url = new URL(req.url);
const decision = url.searchParams.get('decision');      // 'interested'|'purchased'|'passed'|'undecided'
const highValue = url.searchParams.get('high_value');   // '1'
const category = url.searchParams.get('category');      // category string

// Add to the WHERE clause builder:
const conditions: string[] = ['deletedAt IS NULL'];
const params: (string | number)[] = [];

if (decision) { conditions.push('purchase_decision = ?'); params.push(decision); }
if (highValue === '1') { conditions.push('is_high_value = 1'); }
if (category) { conditions.push('category = ?'); params.push(category); }
```

**Step 2: Create FilterBar component**

```tsx
// src/components/FilterBar.tsx
"use client";
import { cn } from '@/lib/utils';
import { Star, CheckCircle, XCircle, Gem } from 'lucide-react';

export interface FilterState {
  decision: string | null;
  high_value: boolean;
  category: string | null;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  categories: string[]; // available categories from current items
  counts: {
    interested: number;
    purchased: number;
    passed: number;
    high_value: number;
  };
}

export function FilterBar({ filters, onChange, categories, counts }: Props) {
  const toggle = (key: keyof FilterState, value: string | boolean | null) => {
    const current = filters[key];
    onChange({ ...filters, [key]: current === value ? null : value });
  };

  const chipClass = (active: boolean, color?: string) => cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none",
    active
      ? color || "bg-[var(--accent-warm)]/20 border-[var(--accent-warm)]/40 text-[var(--accent-warm)]"
      : "bg-transparent border-[var(--glass-01)] text-[var(--text-300)] hover:border-[var(--glass-02)] hover:text-[var(--text-200)]"
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        className={chipClass(filters.high_value, "bg-yellow-400/10 border-yellow-400/40 text-yellow-400")}
        onClick={() => toggle('high_value', true)}
      >
        <Gem size={11} /> High Value {counts.high_value > 0 && `(${counts.high_value})`}
      </button>

      <button
        className={chipClass(filters.decision === 'interested')}
        onClick={() => toggle('decision', 'interested')}
      >
        <Star size={11} /> Interested {counts.interested > 0 && `(${counts.interested})`}
      </button>

      <button
        className={chipClass(filters.decision === 'purchased', "bg-green-400/10 border-green-400/40 text-green-400")}
        onClick={() => toggle('decision', 'purchased')}
      >
        <CheckCircle size={11} /> Purchased {counts.purchased > 0 && `(${counts.purchased})`}
      </button>

      <button
        className={chipClass(filters.decision === 'passed', "bg-red-400/10 border-red-400/40 text-red-400")}
        onClick={() => toggle('decision', 'passed')}
      >
        <XCircle size={11} /> Passed {counts.passed > 0 && `(${counts.passed})`}
      </button>

      {/* Dynamic category chips */}
      {categories.map(cat => (
        <button
          key={cat}
          className={chipClass(filters.category === cat)}
          onClick={() => toggle('category', cat)}
        >
          {cat}
        </button>
      ))}

      {/* Clear all */}
      {(filters.decision || filters.high_value || filters.category) && (
        <button
          className="text-xs text-[var(--text-400)] hover:text-[var(--text-200)] underline"
          onClick={() => onChange({ decision: null, high_value: false, category: null })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
```

**Step 3: Wire FilterBar into the dashboard page**

In `src/app/page.tsx`:

```tsx
import { FilterBar, FilterState } from '@/components/FilterBar';

const [filters, setFilters] = useState<FilterState>({
  decision: null, high_value: false, category: null
});

// Pass filter params to the items fetch:
const params = new URLSearchParams();
if (filters.decision) params.set('decision', filters.decision);
if (filters.high_value) params.set('high_value', '1');
if (filters.category) params.set('category', filters.category);

// Derive available categories from current items:
const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

// Derive counts:
const counts = {
  interested: items.filter(i => i.purchase_decision === 'interested').length,
  purchased: items.filter(i => i.purchase_decision === 'purchased').length,
  passed: items.filter(i => i.purchase_decision === 'passed').length,
  high_value: items.filter(i => i.is_high_value).length,
};

// In JSX, above the grid:
<FilterBar filters={filters} onChange={setFilters} categories={categories} counts={counts} />
```

**Step 4: Test — add a few items, set different decisions, verify chips filter correctly**

**Step 5: Commit**
```bash
git add src/components/FilterBar.tsx src/app/page.tsx src/app/api/items/route.ts
git commit -m "feat: filter bar with decision/high-value/category chips"
```

---

## Phase 7 — Confidence Visualization

> From rork-ephemera-sorter: a small color-coded confidence bar on each card and detail page.

### Task 11: Confidence Badge Component

**Files:**
- Create: `src/components/ConfidenceBadge.tsx`
- Modify: `src/components/ItemCard.tsx`
- Modify: `src/app/items/[id]/page.tsx`

**Step 1: Create ConfidenceBadge**

```tsx
// src/components/ConfidenceBadge.tsx
import { cn } from '@/lib/utils';

interface Props {
  confidence: number | null; // 0.0 - 1.0
  showLabel?: boolean;
}

export function ConfidenceBadge({ confidence, showLabel = false }: Props) {
  if (confidence === null) return null;

  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  const textColor = pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-1.5">
      {/* Mini bar */}
      <div className="w-10 h-1 bg-[var(--surface-600)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className={cn("text-[10px] font-medium", textColor)}>{pct}%</span>
      )}
    </div>
  );
}
```

**Step 2: Add to ItemCard footer**

```tsx
import { ConfidenceBadge } from './ConfidenceBadge';

// In the card footer, below the title:
<ConfidenceBadge confidence={item.confidence} />
```

**Step 3: Add to detail page with label**

```tsx
<ConfidenceBadge confidence={item.confidence} showLabel />
```

**Step 4: Commit**
```bash
git add src/components/ConfidenceBadge.tsx src/components/ItemCard.tsx src/app/items/[id]/page.tsx
git commit -m "feat: confidence visualization bar on cards and detail page"
```

---

## Phase 8 — Export System

> From paper-pixie-pro: export research records to CSV, JSON, and eBay-formatted text.

### Task 12: Export API Endpoint + UI

**Files:**
- Create: `src/app/api/export/route.ts`
- Create: `src/components/ExportMenu.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create export API**

```typescript
// src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') || 'csv'; // 'csv' | 'json'
  const decision = url.searchParams.get('decision');

  let query = `SELECT id, title, category, estimated_value_point, estimated_value_low, estimated_value_high,
    value_confidence, is_high_value, ebay_keywords, purchase_decision, research_location,
    asking_price, research_notes, historicalContext, collectorSignificance, tags, createdAt
    FROM items WHERE deletedAt IS NULL AND status = 'complete'`;
  const params: string[] = [];
  if (decision) { query += ' AND purchase_decision = ?'; params.push(decision); }
  query += ' ORDER BY createdAt DESC';

  const items = db.prepare(query).all(...params) as Record<string, unknown>[];

  if (format === 'json') {
    return new NextResponse(JSON.stringify(items, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="research-export-${Date.now()}.json"`,
      },
    });
  }

  // CSV
  const headers = ['title','category','estimated_value','value_range','confidence','high_value',
    'ebay_keywords','decision','location','asking_price','notes','historical_context','created'];
  const rows = items.map(i => [
    i.title, i.category,
    i.estimated_value_point ?? '',
    i.estimated_value_low && i.estimated_value_high ? `${i.estimated_value_low}-${i.estimated_value_high}` : '',
    i.value_confidence, i.is_high_value ? 'YES' : '',
    i.ebay_keywords, i.purchase_decision,
    i.research_location, i.asking_price, i.research_notes,
    i.historicalContext, i.createdAt,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="research-export-${Date.now()}.csv"`,
    },
  });
}
```

**Step 2: Create ExportMenu component**

```tsx
// src/components/ExportMenu.tsx
"use client";
import { Download } from 'lucide-react';
import { useState } from 'react';

export function ExportMenu() {
  const [open, setOpen] = useState(false);

  const download = (format: 'csv' | 'json', decision?: string) => {
    const params = new URLSearchParams({ format });
    if (decision) params.set('decision', decision);
    window.location.href = `/api/export?${params}`;
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-[var(--surface-780)] border border-[var(--glass-01)] text-sm text-[var(--text-200)] hover:border-[var(--glass-02)] transition-colors"
      >
        <Download size={14} />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--surface-800)] border border-[var(--glass-01)] rounded-[6px] shadow-lg z-20 min-w-[180px] py-1">
          {[
            { label: 'All research (CSV)', action: () => download('csv') },
            { label: 'All research (JSON)', action: () => download('json') },
            { label: 'Interested only (CSV)', action: () => download('csv', 'interested') },
            { label: 'Purchased only (CSV)', action: () => download('csv', 'purchased') },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-4 py-2 text-sm text-[var(--text-200)] hover:bg-[var(--surface-780)] hover:text-[var(--text-100)] transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add ExportMenu to dashboard header**

```tsx
import { ExportMenu } from '@/components/ExportMenu';
// In the header/toolbar area of page.tsx:
<ExportMenu />
```

**Step 4: Test — export all items as CSV, verify it downloads correctly**

**Step 5: Commit**
```bash
git add src/app/api/export/route.ts src/components/ExportMenu.tsx src/app/page.tsx
git commit -m "feat: export research records to CSV and JSON"
```

---

## Phase 9 — Complete the Detail Page

> The audit noted the detail page is incomplete. This task wires everything together into a proper research record view.

### Task 13: Complete Detail Page Layout

**Files:**
- Modify: `src/app/items/[id]/page.tsx`

The detail page should have this two-column layout:
- **Left column (60%):** Image (with BespokeMagnifier), AI identification results, OCR transcript
- **Right column (40%):** ValuationBlock, ResearchContextPanel, ConfidenceBadge, tags, eBay link, delete/retry actions

**Step 1: Read the current detail page**
```bash
# Review current state:
cat src/app/items/[id]/page.tsx
```

**Step 2: Restructure into two-column layout**

```tsx
// Full layout skeleton:
<div className="min-h-screen bg-[var(--surface-900)] text-[var(--text-100)]">
  {/* Header */}
  <div className="border-b border-[var(--glass-01)] px-6 py-4 flex items-center justify-between">
    <Link href="/" className="text-sm text-[var(--text-300)] hover:text-[var(--text-100)] flex items-center gap-2">
      ← All Research
    </Link>
    <div className="flex items-center gap-2">
      {/* Status badge, retry button, delete */}
    </div>
  </div>

  {/* Two-column body */}
  <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">
    {/* Left: Image + AI Results */}
    <div className="space-y-6">
      {/* Image with magnifier */}
      <BespokeMagnifier src={`/api/items/${item.id}/image`} />

      {/* AI Identification */}
      <section>
        <h2>{item.title}</h2>
        <p>{item.historicalContext}</p>
        <p>{item.collectorSignificance}</p>
      </section>

      {/* OCR Transcript (collapsible) */}
      <details>
        <summary>OCR Transcript</summary>
        <pre>{item.cleanedTranscription}</pre>
      </details>
    </div>

    {/* Right: Research data */}
    <div className="space-y-6">
      {/* Valuation */}
      <section>
        <h3>Valuation</h3>
        <ValuationBlock {...valuationProps} />
      </section>

      {/* Confidence */}
      <ConfidenceBadge confidence={item.confidence} showLabel />

      {/* Research Context */}
      <ResearchContextPanel itemId={item.id} initial={researchContext} />

      {/* Tags */}
      {/* Analysis history (collapsible) */}
    </div>
  </div>
</div>
```

**Step 3: Verify all components render without errors**
```bash
npm run dev
# Navigate to an item detail page
# Check for hydration errors or missing props in browser console
```

**Step 4: Commit**
```bash
git add src/app/items/[id]/page.tsx
git commit -m "feat: complete two-column detail page layout"
```

---

## Phase 10 — Polish & QA

### Task 14: Dashboard Header Stats Bar

Show at-a-glance research stats at the top of the dashboard.

**Files:**
- Create: `src/components/StatsBar.tsx`
- Modify: `src/app/page.tsx`

```tsx
// src/components/StatsBar.tsx
interface Props {
  total: number;
  complete: number;
  high_value: number;
  interested: number;
  total_value: number | null;
}

export function StatsBar({ total, complete, high_value, interested, total_value }: Props) {
  return (
    <div className="flex flex-wrap gap-6 text-sm">
      <Stat label="Researched" value={total} />
      <Stat label="Identified" value={complete} />
      <Stat label="High Value" value={high_value} highlight />
      <Stat label="Interested" value={interested} />
      {total_value !== null && (
        <Stat label="Est. Total Value" value={`$${total_value.toLocaleString()}`} highlight />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <div className={highlight ? "text-[var(--accent-warm)] font-bold text-lg" : "text-[var(--text-100)] font-semibold text-lg"}>
        {value}
      </div>
      <div className="text-[var(--text-400)] text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}
```

**Commit:**
```bash
git add src/components/StatsBar.tsx src/app/page.tsx
git commit -m "feat: stats bar showing research totals and estimated value"
```

---

### Task 15: Write AUDIT.md for paper-inventory itself

**Files:**
- Create: `AUDIT.md` (root of paper-inventory)

Document the final state of the app, what was built, and what's next.

```bash
git add AUDIT.md
git commit -m "docs: AUDIT.md for paper-inventory current state"
```

---

### Task 16: End-to-End Smoke Test

**Step 1: Start the app**
```bash
npm run dev
```

**Step 2: Walk the full research workflow**
1. Drop an image into the upload zone
2. Watch processing phase indicator cycle through phases
3. Card appears with scale-in animation, shows "Queued" overlay
4. Card transitions through processing states (Reading → Identifying → Estimating value)
5. Card completes — shows title and valuation
6. If high value → white flash fires
7. Click card → detail page loads with two columns
8. Fill in: where found, asking price, set decision to "Interested"
9. Refresh page → values persisted
10. Apply "Interested" filter chip → only that card shown
11. Export → CSV downloads with correct data

**Step 3: Fix any broken steps before shipping**

**Step 4: Final commit**
```bash
git add -A
git commit -m "feat: research/ID/valuation app — complete MVP"
```

---

## Summary of Changes

| Phase | What | Source |
|-------|------|--------|
| 1 | Research context DB fields + TypeScript types | New |
| 2 | Valuation extractor AI service + queue integration | New (patterns from VAULT) |
| 3 | Scale-in card animation, AnimatePresence grid, processing overlay | paper-pixie-pro |
| 3 | Thinking phase cycler | paper-pixie-pro |
| 3 | Treasure found flash effect | box-audit-system/vault |
| 4 | Research context panel (location, asking price, decision, notes) | New |
| 5 | Structured valuation block with eBay search link | New |
| 6 | Filter bar with dynamic chips | rork-ephemera-sorter |
| 7 | Confidence visualization bar | rork-ephemera-sorter |
| 8 | Export to CSV/JSON | paper-pixie-pro |
| 9 | Complete detail page two-column layout | New |
| 10 | Stats bar, AUDIT.md, smoke test | New |

## What's Intentionally Deferred

- Live eBay API pricing (links to search are provided instead — add API key later)
- Auth / multi-user (single-user local app is the right scope for now)
- Voice input (add after MVP, patterns in BOXAUDIT-VERSION2)
- Mobile PWA (detail page needs responsive work beyond this plan)
- Bulk operations (edit multiple items — add in v2)
