# Structure Map
_Re-Analyzed: 2026-02-25 · Next.js 16 + SQLite · TypeScript · Re-audit vs 2026-02-25 baseline_

## Directory Tree

```
paper-inventory/
  src/
    app/                        <- Next.js App Router pages and API routes
      api/
        admin/clear/            <- POST wipe endpoint (NO AUTH -- P0)
        collections/            <- Collection CRUD endpoints
        debug/log/              <- Debug logging endpoint (writes to disk)
        health/                 <- Health check endpoint
        items/                  <- Items CRUD + [id] sub-routes
          [id]/
            enrich/             <- Manual AI enrichment trigger
            events/             <- SSE stream for processing updates
            image/              <- Serve original image
            research/           <- Research context PATCH
            reset/              <- Reset stalled item
            retry/              <- Retry failed item
            thumbnail/          <- Serve thumbnail
        system/nuke/            <- NEW: second destructive wipe endpoint (NO AUTH -- NEW P0)
        upload/                 <- File upload handler
      collections/              <- Collection UI pages
      items/[id]/               <- Item detail page (1030 lines)
      layout.tsx                <- Root layout
      page.tsx                  <- Home page

    components/
      BespokeMagnifier.tsx      <- NEW: interactive image zoom component
      BulkUpload.tsx            <- Multi-file upload (stale closure leak -- P2)
      DebugFAB.tsx              <- Floating debug button
      ItemCard.tsx              <- Item grid card
      LayoutWrapper.tsx         <- Layout shell
      ProcessingPhaseIndicator.tsx <- Status display
      ResearchContextPanel.tsx  <- NEW: research context + purchase decision
      Sidebar.tsx               <- Navigation
      TreasureFoundEffect.tsx   <- NEW: animation component
      UploadDropzone.tsx        <- Single-file dropzone
      ValuationBlock.tsx        <- NEW: structured valuation display
      ui/toaster.tsx            <- Toast wrapper

    lib/
      ai/
        anthropic-manual.ts     <- Anthropic Claude API calls (Conductor/Expert)
        anthropic-sdk.ts        <- Anthropic SDK wrapper
        conductor.ts            <- NEW: Standalone conductor (Anthropic direct)
        config.ts               <- AI provider config (env-driven)
        expert.ts               <- NEW: Category-specific expert prompts
        gemini-client.ts        <- Gemini API client
        gemini-grounding.ts     <- Gemini grounding calls
        gemini-manual.ts        <- Gemini manual API calls
        gemini-triage.ts        <- Gemini triage calls
        index.ts                <- AI entry point (simplified, delegates to openai-manual)
        openai.ts               <- DEPRECATED: Vercel AI SDK (still present -- P1)
        openai-manual.ts        <- Active orchestrator (Conductor/Expert flow)
        openai-sdk.ts           <- OpenAI SDK direct calls
        perplexity-client.ts    <- NEW: Perplexity Sonar grounding
        prompts.ts              <- Prompt loader
        researcher.ts           <- NEW: Multi-provider researcher (Perplexity + Gemini)
        schema.ts               <- Zod output schemas
        valuator.ts             <- Structured valuation extractor

      db/
        collection.ts           <- Collection DB service
        index.ts                <- DB init + inline schema (runtime source of truth)
        items.ts                <- Item DB service (research fields added)
        schema.sql              <- Reference DDL (likely out of sync -- P1)

      ocr/
        cloud-vision.ts         <- NEW: Google Cloud Vision OCR (used by scheduler.ts)
        index.ts                <- OCR worker manager (Tesseract, used by queue/manager.ts)

      processing/
        image-processor.ts      <- Sharp-based resize + hash
        resize.ts               <- NEW: Standalone resize helper used by scheduler.ts

      queue/
        manager.ts              <- OLD queue (QueueManager class, used by upload/route.ts)

      scheduler.ts              <- NEW: Full replacement scheduler (NOT connected to upload/route.ts)
      storage.ts                <- File storage + path traversal protection
      utils.ts                  <- cn() helper

    types/
      research.ts               <- PurchaseDecision, ValueConfidence, ResearchStage types

    workers/
      ocr.worker.ts             <- Tesseract OCR worker thread

  scripts/                      <- 40+ ad-hoc diagnostic/migration TypeScript scripts
  tests/
    audit-fixes.test.js         <- 7 structural test assertions (was 5 in last audit)
  docs/                         <- EMPTY (docs/api.md from previous audit is GONE)
  data/                         <- Expected DB location (gitignored, no files)
  public/uploads/               <- File storage (gitignored)
  .env                          <- LIVE CREDENTIALS COMMITTED (P0)
  paper-inventory-488411-4f90bf2f1afc.json  <- NEW P0: GCP service account private key committed
  .gitignore                    <- .env* excluded; .json files NOT excluded
  package.json                  <- 29 production deps + 9 dev deps
  package-lock.json             <- Lock file present
  next.config.ts                <- Security headers present
  tsconfig.json                 <- TypeScript config
  pdf_reader.py                 <- Dead code: Python PDF reader (disconnected)
  roadmpa                       <- Typo filename (should be "roadmap")
  COMPS_ROADMAP.md / COMPS_ROADMAP_UPDATED.md <- Informal planning docs in root
```

## Metrics

| Metric | Value | vs Previous Audit |
|---|---|---|
| Total source files (src/) | 48 TS/TSX | +15 new files |
| API routes | 16 | +3 new routes |
| Component files | 17 TSX | +5 new components |
| AI provider modules | 13 TS | +6 new AI files |
| Test files | 1 (7 assertions) | +2 assertions, same 1 file |
| Test:src ratio | ~2% | No change |
| Direct dependencies | 29 | Same |
| Languages | TypeScript 90%, TSX 8%, Python 1%, JSON 1% | Similar |

## New Files Since Last Audit

| File | Purpose |
|---|---|
| `src/lib/scheduler.ts` | New processing orchestrator (replaces queue/manager.ts intent) |
| `src/lib/ai/conductor.ts` | Standalone item categorization via Claude |
| `src/lib/ai/expert.ts` | Category-specific appraisal via Claude |
| `src/lib/ai/researcher.ts` | Multi-provider research (Perplexity + Gemini) |
| `src/lib/ai/perplexity-client.ts` | Perplexity Sonar grounding client |
| `src/lib/ocr/cloud-vision.ts` | Google Cloud Vision OCR (replaces Tesseract in new scheduler) |
| `src/lib/processing/resize.ts` | Standalone resize helper for scheduler.ts |
| `src/app/api/system/nuke/route.ts` | Second unauthenticated destructive endpoint |
| `paper-inventory-488411-4f90bf2f1afc.json` | GCP service account private key in repo root |
| `src/components/ResearchContextPanel.tsx` | Research/purchase decision UI |
| `src/components/ValuationBlock.tsx` | Structured valuation display |
| `src/components/BespokeMagnifier.tsx` | Hover magnifier for images |
| `src/types/research.ts` | Research domain types |

## Files Deleted Since Last Audit

| File | Previous Status |
|---|---|
| `docs/api.md` | Written by previous audit Phase 5 -- now deleted |
