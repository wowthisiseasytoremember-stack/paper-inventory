# Multi-Stage Enrichment Architecture & Codebase Audit

## 1. Proposed Multi-Stage Pipeline Architecture

The current system relies on a parallel triage/grounding approach followed by a fallback chain. The newly intended architecture shifts to a **strict, multi-stage sequential enrichment pipeline** where each model is used for its specialized strength, rather than acting as a simple fallback.

### The Target Pipeline Flow:
1. **Stage 1: Identification & Categorization (Gemini 2.5 Flash + OCR)**
   * **Role:** High-speed vision and text extraction.
   * **Action:** Parses the image and OCR text to extract baseline metadata (title, tags, names) and categorizes the item (e.g., `comics_1990s`, `drg_railroadiana`).
2. **Stage 2: Research & Grounding (Perplexity / `sonar`)**
   * **Role:** Real-time internet search and market analysis.
   * **Action:** Takes the structured ID from Stage 1 and performs targeted searches to find real-world market comps (sold prices) and historical facts.
3. **Stage 3: Deep Dive & Synthesis (Claude 3.5 Sonnet)**
   * **Role:** Expert reasoning and nuanced valuation.
   * **Action:** Ingests the baseline extraction (Stage 1) *and* the Perplexity grounding research (Stage 2). Sonnet acts as the ultimate authority to synthesize the final valuation, historical context, and collector significance.
4. **Safety Net (Fallbacks)**
   * If Sonnet fails (e.g., rate limits), **Gemini** takes over the synthesis.
   * If Gemini fails, **Groq** acts as the final text-only fallback.

---

## 2. Codebase Audit: Bugs & Logic Gaps

Reviewing the current codebase against this proposed architecture reveals several logic gaps that need addressing before implementation:

### A. Architectural Mismatches in `src/lib/ai/index.ts`
* **Gap:** Grounding and Triage are currently executing in parallel (`Promise.all`). In the new architecture, Perplexity (Grounding) needs the categorized output from Triage to run the correct search queries, and Sonnet needs Perplexity's output. The pipeline must be refactored to be strictly sequential.
* **Gap:** The `DEEP_DIVE_FALLBACKS` array currently places `claude-sonnet` and `perplexity` as fallbacks for each other. They need to be separated into distinct pipeline stages rather than existing in the same fallback pool.

### B. Worker Queue Logic (`src/lib/queue/manager.ts`)
* **Bug:** When a user clicks "Retry" on an errored item, its status is set back to `queued`. The worker queue currently checks `if (item.status === 'queued')` to run OCR. This means retrying an AI failure forces a complete re-run of the expensive OCR process.
  * *Fix:* Change the gate to `if (!item.rawOcr)` so OCR is only run if it hasn't successfully completed before.
* **Bug/Gap:** The watchdog timer resets stale locks to `error` and increments `retryCount`. However, because it sets the status to `error`, the item will never be picked up by the queue again automatically. It requires manual user intervention.

### C. Live Updates & Database
* **Gap:** The newly implemented SSE endpoint polls the SQLite database every 1 second per client. For a bespoke, single-user app, this is acceptable. However, if multiple tabs are open, this will cause unnecessary DB read pressure. Transitioning to a Node.js `EventEmitter` for local processes would be cleaner.

---

## 3. Nested Projects & Utilities Audit

The project directory contains several nested tools, scripts, and legacy files. Here is an audit of their utility:

### `architectural-planner` (Gemini Skill)
* **What it is:** A custom `.skill` definition containing a `SKILL.md` file.
* **Utility:** High. It defines a strict 3-phase planning protocol (Inquiry -> Granular Plan -> Revision) designed to prevent AI agents from writing premature code. It enforces asking leading questions to lock down constraints. This should be utilized extensively before major refactors.

### `pdf_reader.py` (Standalone Python Script)
* **What it is:** A robust Python wrapper around `pdfminer.six` for extracting text, layout, and images from PDF files.
* **Utility:** Currently disconnected. The Next.js upload API (`/api/upload`) strictly checks magic bytes for images (`image/jpeg`, `image/png`, etc.) and rejects PDFs. If the inventory app needs to process PDF catalogs or multi-page ephemera documents, this script is highly valuable but requires a Node.js child-process bridge to be integrated into the worker queue.

### `scripts/` (Diagnostic Suite)
* **What it is:** A collection of TypeScript/JavaScript runner files (e.g., `start-worker.ts`, `test-deep-dive-ab.ts`, `test-ocr.ts`).
* **Utility:** High, but prone to drift. These scripts are excellent for isolated A/B testing of prompts without spinning up the UI. However, they need to be updated to reflect the new Perplexity grounding logic, as they currently assume Gemini handles grounding.

### `tests/` (Node.js Test Runner)
* **What it is:** Contains `audit-fixes.test.js` using the native `node:test` module.
* **Utility:** It uses naive string matching (`fs.readFileSync().includes()`) to verify that certain code blocks exist (e.g., ensuring `rawOcr` isn't overwritten). While rudimentary, it acts as a fast regression check. It should be expanded to verify the new sequential pipeline logic once implemented.