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

## AI Architecture: Heuristic + LLM Classification

Two-layer design separating routing logic from LLM work:

**Layer 1 — Heuristic Router (Automation Layer, pure code, no LLM cost)**
- `heuristicRouter()` in `src/lib/ai/conductor.ts` scans OCR text against weighted keyword patterns
- Deterministically assigns one of 8 categories: `comic_books`, `railroadiana`, `aerospace_technical`, `serial_publications`, `analog_media_electronics`, `stamps_postal`, `geographic_media`, `general_vintage_ephemera`
- Deterministic, debuggable, zero cost per item

**Layer 2 — LLM Identification (Action Layer)**
- `identifyItem()` receives the **already-known** category from Layer 1
- Extracts: title, description, features via Claude (primary)
- Never decides the category — that's fixed by the heuristic router

**Research & Valuation**
- `runResearcher()` queries Perplexity AI (primary) or Gemini with Google Search grounding
- `runValuation()` (Claude/Gemini) synthesizes OCR + category + research into structured appraisal with estimated value range, confidence score, eBay keywords, collector significance

## Key Files

### AI Pipeline (`src/lib/ai/`)
| File | Purpose |
|------|---------|
| `conductor.ts` | Heuristic category router + LLM item identification. Central orchestrator. |
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

1. **Automation before AI**: Heuristic routing costs nothing and is deterministic. LLMs are only used for tasks requiring semantic understanding (item identification, valuation).
2. **Atomic operations**: SQLite row-level locks prevent duplicate processing. Crash recovery resets stale locks on startup.
3. **Worker isolation**: OCR runs in dedicated worker thread with timeout to avoid blocking main thread.
4. **Deterministic routing**: Category assignment is pure code — no LLM involved. This means the same input always produces the same category.


## Hardening Rules
- **Closeout Sync (inviolable):** Always write a per-session closeout entry to `~/brain/memory/ichabod/_close-log.md` and append a matching structured JSON line to `~/brain/memory/ichabod/_close-log.jsonl` using the closeout schema. Ensure you include the correct `linear.issue_key` so the watcher syncs it to the Linear board.
