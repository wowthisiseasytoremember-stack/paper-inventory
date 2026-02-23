# Paper Inventory — Handoff Guide

> For any IDE/model picking up this project. Read this before touching code.

---

## Current State (Feb 23, 2026)

**The pipeline works end-to-end:**
```
Upload photo → OCR (Tesseract) → Resize (Sharp) → Baseline ID (Gemini 2.0 Flash)
  → Triage (Gemini 2.5 Flash categorizes: comics_1990s / drg_railroadiana / other)
  → Grounding (Gemini + Google Search finds eBay sold listings)
  → Deep Dive (GPT-4o with category-specific prompt + grounding context)
  → Complete (merged metadata in SQLite)
```

**Debug FAB** (bottom-right bug icon on item detail pages) lets you hot-swap models and prompts per-run.

**API keys in `.env`:** Gemini, OpenAI, Anthropic — all active and tested.

---

## A/B Testing Workflow (For the User)

### Quick A/B test on a single item:
1. Open any item detail page
2. Click the bug icon (bottom-right) to open Neural Console
3. Change Deep Dive model: `gpt-4o` vs `claude-sonnet` vs `gemini-2.5-flash`
4. Click RUN PIPELINE
5. Result saves to `analysis_history` JSON column — previous results preserved
6. Compare in `ai-prompt-debug.txt` (project root) — every run is logged with timestamp, model, and full result

### Batch A/B across multiple items:
```bash
# Re-enrich all complete items with a specific model combo
curl -X POST http://localhost:3000/api/items/<ID>/enrich \
  -H 'Content-Type: application/json' \
  -d '{"baselineModel":"gemini-2.0-flash","deepDiveModel":"claude-sonnet","enableGrounding":true}'
```

A simple script to batch this (any IDE can write it):
- Query all items with status='complete' from SQLite
- For each, POST to `/api/items/{id}/enrich` with the model config you want to test
- Add a 2-second delay between calls to avoid rate limits
- Results land in `analysis_history` on each item for comparison

---

## Cleanup Tasks (Any IDE Can Do These)

### 1. Delete dead OpenAI SDK file
`src/lib/ai/openai.ts` — uses Vercel AI SDK which crashes on Windows. We replaced it with `openai-manual.ts`. Delete it.

### 2. Remove unused npm packages
```bash
npm uninstall @ai-sdk/anthropic @ai-sdk/openai ai
```
These were the Vercel AI SDK packages. We use raw `fetch` now.

### 3. Delete stale log files from project root
These are debug artifacts from previous sessions:
- `ab-test-anthropic.json`
- `ab-test-deep-dive.log` / `ab-test-deep-dive2.log`
- `ab-test-deep-dive-utf8.log` / `ab-test-deep-dive2-utf8.log`
- `ab-test-final.json`
- `ab-test-results.json` / `ab-test-results-iteration-2.json`
- `ai-debug.log`
- `test-ai.log`
- `build.log`
- `tsc.log`
- `worker.log` / `worker_debug.log`

Keep `ai-prompt-debug.txt` (active log) and `inventory.db`.

### 4. Clean up legacy test scripts
`scripts/` folder likely has old test scripts referencing deleted modules (like `../src/lib/ai/google`). Check each — delete if it imports something that doesn't exist.

---

## Feature Ideas (Prioritized)

### HIGH VALUE — Build These

**1. Batch Upload Progress UI**
- The bulk uploader exists (`BulkUpload` component) but there's no real-time progress indicator
- Add a simple polling component that hits `GET /api/items?status=processing_*` every 3 seconds
- Show: "12/50 items processed — 3 in OCR, 2 in AI, 7 complete"
- This is critical for the 1000-2000 item backlog

**2. Retry Failed Items Button**
- Items with `status='error'` need a one-click retry
- Already partially exists: `POST /api/items/{id}/retry`
- Add a "Retry All Failed" button to the dashboard that loops through error items and sets them back to `queued`

**3. Export to CSV**
- User needs to list items for sale. Add a `GET /api/export/csv` endpoint
- Columns: title, valuation, tags, category, historicalContext, collectorSignificance
- Any IDE can build this — just query all complete items and format as CSV

**4. Valuation Summary Dashboard**
- Simple aggregation: total estimated value (sum of "Likely" from valuation strings), count by category, count by value tier
- Parse the valuation string "Low: $X — High: $Y — Likely: $Z" with a regex

### NICE TO HAVE

**5. Side-by-side A/B comparison view**
- `analysis_history` stores every past enrichment run with timestamp + model info
- Build a UI that shows two runs side-by-side: valuation, historical context, significance
- Helps the user decide which model combo produces the best results

**6. Cost tracking**
- Log estimated token usage per call (approximate from input/output length)
- Show running total in the debug FAB: "Session cost: ~$2.40"
- Gemini Flash is ~$0.001/item, GPT-4o is ~$0.03/item, Claude is ~$0.02/item

**7. Category-specific list views**
- Filter dashboard by triage category
- "Show me all D&RG items" / "Show me all comics" / "Show me everything else"
- Just a query param on the items list API

---

## Prompt Tuning Notes

The prompts live in `src/lib/ai/prompts.ts`. Here's what to watch for after running real items through:

### Comics (1990s)
- The prompt says "be blunt about overprinted/common issues" — verify it actually IS blunt
- If it's overvaluing common #1 issues (X-Men, Spawn, etc.), add specific examples to the prompt: "Issues like Spawn #1, X-Men #1 (1991), and most hologram/foil covers had print runs of 1M+ and are worth $1-5 raw"
- Check if grounding actually finds CGC census data — if not, the prompt hint may need adjusting

### D&RG Railroadiana
- This is a niche market — grounding may struggle to find comps
- If comps come back empty, the deep dive should still be useful from training knowledge
- Consider adding specific dealer names to the grounding search hints: "search 'Denver Rio Grande' on eBay, Trainz.com, and railroadiana.com"

### General Ephemera
- Broadest category — prompt is generic by design
- Watch for items that should be comics or D&RG but got triaged as "other" — triage prompt may need more signals

---

## Architecture Reference

```
src/lib/ai/
├── index.ts              ← ROUTER: analyzeImage() and runFullPipeline()
├── gemini-client.ts      ← Baseline ID (Gemini 2.0 Flash)
├── gemini-triage.ts      ← Category classification (Gemini 2.5 Flash)
├── gemini-grounding.ts   ← Google Search for eBay comps (Gemini 2.5 Flash)
├── openai-manual.ts      ← GPT-4o via raw fetch (baseline + deep dive)
├── anthropic-manual.ts   ← Claude via raw fetch (baseline + deep dive)
├── prompts.ts            ← All system prompts (baseline, deep dive, category overrides)
└── schema.ts             ← Zod schemas for validation

src/lib/queue/manager.ts  ← State machine: queued→OCR→resize→AI→complete
src/lib/db/items.ts       ← SQLite CRUD + atomic locking
src/components/DebugFAB.tsx ← Hot-swap model controls
```

### How the router works:
- Model name prefix determines provider: `gemini-*` → Google, `gpt-*` → OpenAI, `claude-*` → Anthropic
- `runFullPipeline()` chains all 4 stages and returns merged result
- `analyzeImage()` runs baseline only (used by queue for fast first pass — but queue now uses `runFullPipeline`)

### Key env vars:
| Var | Used by |
|-----|---------|
| `GEMINI_API_KEY` | gemini-client, gemini-triage, gemini-grounding |
| `OPENAI_API_KEY` | openai-manual (baseline + deep dive + normalizer) |
| `ANTHROPIC_API_KEY` | anthropic-manual |
| `BASELINE_MODEL` | Override default baseline model (optional) |
| `DEEP_DIVE_MODEL` | Override default deep dive model (optional) |

---

## Running the Backlog (1000-2000 Items)

### Strategy:
1. **Start dev server**: `npm run dev`
2. **Upload in batches of 50-100** via the bulk uploader UI (dashboard)
3. Queue processes 10 concurrent items — each takes ~20-30 seconds for the full pipeline
4. 100 items ≈ 5-10 minutes
5. 2000 items ≈ 2-3 hours
6. **Estimated API cost** at default settings (Gemini baseline + Gemini grounding + GPT-4o deep dive): ~$0.05/item = **~$50-100 for 2000 items**

### Cost optimization:
- Skip grounding on the first pass (toggle OFF in FAB or set `enableGrounding: false`). Saves ~$0.01/item.
- Use `gpt-4o-mini` for deep dive on the first pass. ~$0.005/item instead of $0.03.
- Then selectively re-enrich high-value items with full grounding + GPT-4o.

### If items get stuck:
- Check `status='error'` items in the DB
- Common cause: API rate limit. Wait 60 seconds, retry.
- Watchdog auto-resets stuck locks after 5 minutes.
- Nuclear option: `POST /api/admin/clear` resets everything (careful — wipes DB).
