---
schema: agents-md/v1

project: paper-inventory
initiative: personal-data
family: automation

what: >-
  Turns bulk photos of vintage paper collectibles and ephemera into catalogued, appraised inventory. Each upload runs OCR → LLM-based category classification (conductor prompt, NOT a free heuristic router) → LLM identification (Claude primary) → Perplexity market research → valuation with confidence score. Output is a searchable local archive with per-item research notes and export. Built for Crosslist pipeline integration.
goal: >-
  Keep available for niche/rare paper items that Crosslist AI cannot classify well. If reviving, wire output to crosslist-ts-integration draft format.
status: paused
stack: [typescript, nextjs, react, sqlite, tesseract, tailwind, anthropic, perplexity, gemini]

modules:
  - name: App
    path: src
    does: Next.js App Router UI — upload, item browser, valuation and research views.
    status: shipped
  - name: Background worker
    path: scripts/start-worker.ts
    does: Runs the OCR / identify / research / value pipeline outside the request cycle.
    status: shipped
  - name: Bulk ingest
    path: scripts/ingest-and-process.ts
    does: Ingests a folder of images and pushes them through the pipeline.
    status: shipped

depends_on: []
feeds: [crosslist-ts-integration]
updated: 2026-08-10 14:46 UTC
---
# CLAUDE.md — Paper Inventory

Last updated: 2026-05-19

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `next: 16.1.6`) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| State | Zustand + TanStack React Query |
| Database | SQLite via `better-sqlite3` (local, zero-infrastructure) |
| OCR | Tesseract.js (worker threads) + Google Cloud Vision |
| Image Processing | Sharp, Jimp, `browser-image-compression` |
| AI Providers | Anthropic Claude (primary), Google Gemini, OpenAI, Perplexity AI |
| Schema Validation | Zod |
| Queue | `p-queue` with atomic SQLite locking |
| Build | tsx/ts-node for scripts, ESLint |

## AI Architecture: LLM Router + Appraisal (doc-accuracy warning)

⚠ DOC-ACCURACY FLAG (2026-08-17): Earlier docs claimed a deterministic, free "heuristic keyword router" (`heuristicRouter()`) in `conductor.ts`. **That function does not exist.** Category routing is LLM-based. See Known Issues below.

**Routing (Layer 1 — LLM)**
- `runConductor()` in `conductor.ts` (and `routeItemAnthropic` / `routeItemGemini` in `*-manual.ts`) classify each item into one of 8 categories via an LLM call using `CONDUCTOR_PROMPT.md` (or the shorter inline conductor prompt). Not free, not deterministic.
- `categorizeForDeepDive()` in `gemini-triage.ts` is a secondary classifier (comics_1990s / drg_railroadiana / other) with a keyword fallback.

**Appraisal (Layer 2 — LLM)**
- The LIVE pipeline (`src/lib/ai/index.ts` → `*-manual.ts`) calls `appraiseItemAnthropic/Gemini`, which loads the dealer-voice expert prompts from `docs/prompts/experts/*.md` + `EXPERT_BASE_PROMPT.md` + `EXPERT_BASE_SCHEMA.json`.
- Two DORMANT alternate appraisal paths also exist: `expert.ts` (`runExpert`, inline prompts) and `valuator.ts` (`extractValuation`, archivist voice + `railroad-domain.ts`). They are NOT in the primary pipeline.

**Research & Valuation**
- `runPerplexityResearcher()` (primary, live sold-price comps, 8 category prompts) or `runResearcher()` (Gemini grounding fallback).
- `getGroundedResearch()` (gemini-grounding.ts) returns comps JSON.

## Key Files

### AI Pipeline (`src/lib/ai/`)
| File | Purpose |
|------|---------|
| `conductor.ts` | LLM-based category router (`runConductor`) + `routeItemAnthropic/Gemini` in `*-manual.ts`. **No `heuristicRouter()` exists** (docs were wrong). |
| `researcher.ts` | Market research via Perplexity (primary) or Gemini (fallback) |
| `valuator.ts` | Valuation synthesis: historical context, condition, estimated value range |
| `config.ts` | AI provider configuration and model constants |
| `schema.ts` | Zod schemas for AI output validation |
| `prompts.ts` | Shared prompt templates |
| `gemini-triage.ts` | Gemini-based triage fallback |
| `perplexity-client.ts` | Perplexity API wrapper |
| `perplexity-researcher.ts` | Perplexity research orchestration |
| `openai.ts` / `openai-sdk.ts` | OpenAI integration |
| `anthropic-sdk.ts` | Anthropic Claude SDK integration |

### Database (`src/lib/db/`)
| File | Purpose |
|------|---------|
| `schema.sql` | Full SQLite schema: items table (state machine with status enum), collections, FTS5 full-text search |
| `items.ts` | Item CRUD with atomic locking, strict state transitions, soft delete |
| `index.ts` | DB connection and initialization |
| `collection.ts` | Collection CRUD |

### Processing (`src/lib/processing/`)
| File | Purpose |
|------|---------|
| `image-processor.ts` | Image resize, thumbnail generation, format conversion via Sharp |
| `resize.ts` | Dedicated resize pipeline |

### Queue & Scheduling
| File | Purpose |
|------|---------|
| `src/lib/queue/manager.ts` | Job queue with atomic SQLite locking, watchdog (5-min lock timeout) |
| `src/lib/scheduler.ts` | Background task scheduler |
| `src/workers/ocr.worker.ts` | OCR worker thread (Tesseract.js, 120s timeout) |

### Frontend (`src/components/`)
| File | Purpose |
|------|---------|
| `BulkUpload.tsx` | Drag-and-drop upload with progress |
| `ItemCard.tsx` | Grid/list item card display |
| `ItemDetailModal.tsx` | Detail and valuation modal |
| `StatsBar.tsx` | Archive statistics dashboard |
| `FilterBar.tsx` | Category and status filters |
| `Sidebar.tsx` | Navigation sidebar |
| `ExportMenu.tsx` | CSV export functionality |
| `ValuationBlock.tsx` | Valuation display component |
| `ResearchContextPanel.tsx` | Research context display |

### API Routes (`src/app/api/`)
| File | Purpose |
|------|---------|
| `items/route.ts` | List, create items |
| `items/[id]/route.ts` | Get, update, delete single item |
| `items/[id]/research/route.ts` | Trigger research for item |
| `items/[id]/enrich/route.ts` | Trigger AI enrichment |
| `upload/route.ts` | File upload endpoint |
| `export/route.ts` | CSV export |
| `collections/route.ts` | Collection CRUD |

### App Pages (`src/app/`)
| File | Purpose |
|------|---------|
| `page.tsx` | Dashboard / Archive Vault |
| `layout.tsx` | Root layout |
| `items/[id]/page.tsx` | Item detail page |
| `collections/page.tsx` | Collections listing |
| `collections/[id]/page.tsx` | Collection detail |

### State
| File | Purpose |
|------|---------|
| `src/store/itemStore.ts` | Zustand store for UI state |
| `src/hooks/useItems.ts` | React Query hooks for data fetching |

### Scripts (`scripts/`)
| File | Purpose |
|------|---------|
| `start-worker.ts` | Background processing worker entry point |
| `init-db.ts` | Database initialization |
| `bulk-ingest.ts` | Bulk item ingestion |
| `run-tests.js` | Test runner |
| `e2e-smoke-test.ts` | End-to-end smoke test |
| `smoke-test.ts` | Basic smoke test |
| `test-pipeline-e2e.ts` | Full pipeline end-to-end test |

## Database Notes

- **State machine**: items transition through `queued → processing_ocr → ocr_complete → processing_resize → resize_complete → processing_ai → complete` (or `error` at any point)
- **Atomic locking**: `processingLock` column (0/1) with watchdog (`watchdogLockedAt`) that clears stale locks >5 min
- **Deduplication**: by `contentHash` (UNIQUE constraint)
- **Soft delete**: `deletedAt` timestamp, items not purged
- **FTS5**: Full-text search via `items_fts` virtual table with sync triggers on insert/update/delete
- **Timing metrics**: `ocrDurationMs`, `resizeDurationMs`, `aiDurationMs`, `totalProcessingMs`
- **Multi-provider fallback**: If primary AI provider fails, falls back gracefully. Research can proceed without API key (returns empty notes).

## Key Principles

1. **Automation before AI (ASPIRATIONAL, NOT CURRENT)**: Docs previously claimed heuristic routing costs nothing and is deterministic. In reality routing is LLM-based. A free deterministic `heuristicRouter()` was planned but never implemented — see Known Issues.
2. **Atomic operations**: SQLite row-level locks prevent duplicate processing. Crash recovery resets stale locks on startup.
3. **Worker isolation**: OCR runs in dedicated worker thread with timeout to avoid blocking main thread.
4. **Routing is LLM-based (not deterministic)**: Category assignment uses an LLM call. The same input may produce different categories across runs/models. (A deterministic keyword router was planned but does not exist in code.)


## Known Issues — Doc Accuracy (logged 2026-08-17)

- **Phantom heuristic router:** AGENTS.md/CLAUDE.md and the wiki previously claimed a free deterministic keyword router (`heuristicRouter()` in `conductor.ts`). It does not exist. Routing is LLM-based (`runConductor` / `routeItemAnthropic` / `routeItemGemini`). The "Automation before AI" / "Deterministic routing" principles were inaccurate and have been corrected above.
- **Three overlapping appraisal prompt sets:**
  - **(B) Dealer-voice markdown experts** in `docs/prompts/experts/*.md` — the LIVE path via `index.ts`.
  - **(C) `expert.ts` inline prompts** (`runExpert`) — dormant.
  - **(D) `valuator.ts` archivist prompt** (`extractValuation`) + `railroad-domain.ts` — dormant.
  Tuning prompts without knowing which path runs will silently not apply. Pick one voice if consolidating.
- **Two conductor versions:** `CONDUCTOR_PROMPT.md` (used by live pipeline) and the shorter inline conductor in `conductor.ts` (`runConductor`). They overlap.
- **Research layer:** Perplegity (live, primary) + two Gemini fallbacks (`researcher.ts`, `gemini-grounding.ts`).
- **Full prompt dump:** `~/audits/ephemera-recon/PAPER-INVENTORY-ALL-PROMPTS.md`.
- **railroad-valuator merged in (2026-08-17):** its railroad-historian domain prompt was ported into `railroadiana` via `railroad-domain.ts`; railroad-valuator is now SUPERSEDED.

## Hardening Rules
- **Closeout Sync (inviolable):** Always write a per-session closeout entry to `~/brain/memory/ichabod/_close-log.md` and append a matching structured JSON line to `~/brain/memory/ichabod/_close-log.jsonl` using the closeout schema. Ensure you include the correct `linear.issue_key` so the watcher syncs it to the Linear board.
