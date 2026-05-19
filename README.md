# Paper Inventory

An AI-powered inventory management system for vintage collectibles, ephemera, and paper goods. Upload photos of items — Paper Inventory automatically classifies, researches, and appraises them.

## Purpose

Managing a vintage/collectibles inventory is tedious. Paper Inventory automates the pipeline from photo to catalog entry:

1. **Upload** images in bulk — drag-and-drop or file picker
2. **OCR** extracts text via Tesseract.js (worker-thread isolated) or Google Cloud Vision
3. **Heuristic classification** assigns a category (comic books, railroadiana, aerospace tech, stamps, maps, etc.) using pure keyword matching — no LLM latency or cost
4. **LLM identification** extracts title, description, and features (powered by Claude)
5. **Research** gathers market context via Perplexity AI or Gemini with Google Search grounding
6. **Valuation** synthesizes everything into an appraised value range with confidence scoring

The result: a searchable, filterable archive with per-item valuations, research notes, purchase decisions, and export capabilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router) |
| Language | **TypeScript** |
| UI | **React 19**, **Tailwind CSS 4**, **Framer Motion** |
| State | **Zustand** + **TanStack React Query** |
| Database | **SQLite** via `better-sqlite3` (local, zero-infrastructure) |
| OCR | **Tesseract.js** (worker threads) + **Google Cloud Vision** |
| Image Processing | **Sharp**, **Jimp**, `browser-image-compression` |
| AI Providers | **Anthropic Claude**, **Google Gemini**, **OpenAI**, **Perplexity AI** |
| Schema Validation | **Zod** |
| Queue | `p-queue` with atomic SQLite locking |

## AI Classification Pipeline

Paper Inventory uses a **two-layer architecture** that separates routing logic from LLM work:

### Layer 1: Heuristic Router (Automation Layer)
Pure code — no AI call. A `heuristicRouter()` scans OCR text and web entities against weighted keyword patterns to deterministically assign one of eight inventory categories:

- `comic_books` — Marvel, DC, issue numbers, graphic novels
- `railroadiana` — timetables, Union Pacific, D&RG, train ephemera
- `aerospace_technical` — NASA, Boeing, classified documents, engineering drawings
- `serial_publications` — magazines, journals, periodicals
- `analog_media_electronics` — vinyl, cassettes, VHS, vintage audio
- `stamps_postal` — postage, first day covers, philatelic
- `geographic_media` — maps, atlases, charts, topography
- `general_vintage_ephemera` — catch-all fallback

This ensures routing is deterministic, debuggable, and costs nothing.

### Layer 2: LLM Identification (Action Layer)
The LLM (Claude, Gemini, or OpenAI) receives the **already-known category** and performs pure data extraction: item title, description, key features. It never decides the category — that's fixed by the heuristic router.

### Research & Valuation
- **Researcher** queries Perplexity AI (primary) or Gemini with Google Search grounding to find current market data
- **Valuator** (Claude/Gemini) synthesizes OCR text, category, and research results into a structured appraisal with estimated value range, confidence score, eBay keywords, and collector significance

## Getting Started

### Prerequisites

- Node.js 20+
- One or more AI provider API keys (set in `.env`):
  - `ANTHROPIC_API_KEY` — Claude for item identification & valuation
  - `GEMINI_API_KEY` — Gemini for research (Google Search grounding)
  - `PERPLEXITY_API_KEY` — Perplexity for live market research
  - `OPENAI_API_KEY` — OpenAI fallback
  - `GOOGLE_CLOUD_VISION_API_KEY` — optional, for cloud OCR

### Install & Run

```bash
npm install
npm run dev
```

Opens at `http://localhost:3001`.

### Environment Variables

Copy `.env.example` to `.env` and configure at minimum one AI provider:

```
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
PERPLEXITY_API_KEY=pplx-...
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3001) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run worker` | Run background processing worker |
| `npm run lint` | ESLint |
| `npm run test` | Run test suite |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Dashboard / Archive Vault
│   ├── layout.tsx          # Root layout
│   ├── items/[id]/         # Item detail page
│   └── collections/        # Collection views
├── components/             # UI components
│   ├── BulkUpload.tsx      # Drag-and-drop upload with progress
│   ├── ItemCard.tsx        # Grid/list item card
│   ├── ItemDetailModal.tsx # Detail & valuation modal
│   ├── StatsBar.tsx        # Archive statistics
│   ├── FilterBar.tsx       # Category & status filters
│   └── ...
├── lib/
│   ├── ai/                 # AI pipeline
│   │   ├── conductor.ts    # Heuristic router + LLM identification
│   │   ├── researcher.ts   # Market research (Perplexity / Gemini)
│   │   ├── valuator.ts     # Valuation synthesis
│   │   ├── schema.ts       # Zod schemas for AI output
│   │   └── config.ts       # AI provider configuration
│   ├── db/                 # Database layer (SQLite)
│   │   ├── items.ts        # Item CRUD with atomic locking
│   │   └── collection.ts   # Collection CRUD
│   ├── ocr/                # OCR service (Tesseract worker)
│   ├── processing/         # Image resize & thumbnail generation
│   ├── queue/              # Job queue with atomic locking
│   ├── scheduler.ts        # Background task scheduler
│   └── storage.ts          # File storage management
└── store/
    └── itemStore.ts        # Zustand store
```

## Architecture Notes

- **Atomic job locking**: Items are processed one stage at a time with SQLite row-level locks. Crash recovery resets stale locks on startup. A watchdog clears locks held longer than 5 minutes.
- **Worker threads**: OCR runs in an isolated worker thread with a 120-second timeout to avoid blocking the main thread.
- **Multi-provider fallback**: If the primary AI provider fails, the system falls back gracefully. Research can proceed without an API key (returns empty notes).
- **Deduplication**: Items are deduplicated by file hash before processing.
- **Soft delete**: Items are soft-deleted (`deletedAt` timestamp) rather than purged.
