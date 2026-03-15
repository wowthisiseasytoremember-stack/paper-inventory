# Real-Time Enrichment API & Codebase Audit

## Part 1: Real-Time API Specification

### 1. Data Schema (SQLite)
The append-only log ensures all intermediate AI reasoning is permanently recorded.
*   **Table:** `item_enrichment_logs`
*   **`id`** (`TEXT PRIMARY KEY`): Unique UUID for the log entry.
*   **`item_id`** (`TEXT NOT NULL`): Foreign key to `items(id)`. Cascades on delete.
*   **`event_type`** (`TEXT NOT NULL`): Enum-style string (e.g., `baseline_complete`, `triage_complete`, `grounding_complete`, `deep_dive_complete`).
*   **`model`** (`TEXT`): The specific model used for this stage (e.g., `gemini-2.0-flash`, `sonar`, `claude-sonnet`).
*   **`payload`** (`TEXT NOT NULL`): Stringified JSON containing the raw data output of the event.
*   **`timestamp`** (`DATETIME`): Defaults to `CURRENT_TIMESTAMP`.

### 2. API Endpoints

**A. Manual Enrichment Trigger**
*   **Method:** `POST`
*   **Path:** `/api/items/[id]/enrich`
*   **Purpose:** Forces a re-run of the AI pipeline with optional model overrides.
*   **Validation:**
    *   `[id]` must resolve to an existing item.
    *   Item must have a valid `originalImagePath` or `resizedImagePath`.
*   **Response (Success):** `200 OK` - `{"success": true, "category": "...", "groundingUsed": true/false, "item": { ... }}`
*   **Response (Error):** `400/404/500` - `{"error": "...", "details": "..."}`

**B. Real-Time Event Stream**
*   **Method:** `GET`
*   **Path:** `/api/items/[id]/events`
*   **Purpose:** Server-Sent Events (SSE) stream for live UI updates.
*   **Response Format:**
    *   `event: itemUpdate
data: {"id": "...", "status": "...", ...}

`
    *   `event: logsUpdate
data: [{"event_type": "...", "payload": "{...}"}]

`
*   **Security Headers:**
    *   `Cache-Control: no-cache, no-transform`
    *   `Connection: keep-alive`

### 3. Non-Functional Requirements
*   **Performance Target:** Event latency < 1000ms. Throughput managed via `p-queue` (concurrency: 3) to prevent API rate limiting.
*   **Logging Fields:** `item_id`, `event_type`, `model`, `timestamp`, `payload`. File system logging also maintained in `ai-prompt-debug.txt`.
*   **Idempotency Key:** Implicit via SQLite row locking (`processingLock = 1`) and file MD5 hashing on upload (`originalHash`).
*   **Rate Limiting:** Managed implicitly by the outgoing worker queue rather than incoming request limits.

---

## Part 2: Codebase Audit & Logic Gaps

### 1. The Queue & Processing Pipeline
*   **Watchdog Retry Logic:** The `QueueManager` has a watchdog that detects stale locks (timeout > 5 minutes). It increments `retryCount` but immediately sets the status to `error`. This requires the user to manually click "Retry" in the UI rather than automatically re-queueing the item for background processing (which is usually the intent of a `retryCount`).
*   **Pipeline Re-entry:** When an item is retried (status goes back to `queued`), the `processFullPipeline` function checks `if (item.status === 'queued')` to run OCR. If OCR previously succeeded but the AI stage failed, retrying the item forces OCR to run again, wasting time and resources. 
*   **Solution Suggestion:** Change the OCR gate to check `if (!item.rawOcr)` instead of just `if (item.status === 'queued')`.

### 2. AI Fallback Chains
*   **Sonnet Persistence:** The user expressed a desire to replace `claude-sonnet`. While Perplexity (`sonar`) was added to the fallback chain, `claude-sonnet` remains in the arrays (e.g., `['gemini-2.5-flash', 'claude-sonnet', 'perplexity', 'groq']`). If Gemini fails, the system will still attempt to use Claude before falling back to Perplexity.
*   **Solution Suggestion:** Remove `claude-sonnet` from the fallback arrays entirely if it is consistently failing or no longer desired.

### 3. Nested Projects & Utilities
*   **`pdf_reader.py`:** There is a standalone Python script in the root directory utilizing `pdfminer.six`. 
    *   **Purpose:** It extracts text and layout information from PDF files.
    *   **Logic Gap:** The current upload API (`/api/upload`) strictly enforces magic bytes for images (`image/jpeg`, `image/png`, `image/webp`, `image/heic`). If the intent is to ingest PDF collections of paper ephemera, this Python script is currently disconnected from the main Next.js/TypeScript ingestion pipeline. It would require a bridge (like a child process execution in the worker) to be useful.
*   **`architectural-planner`:** A custom Gemini skill located in the `architectural-planner` directory.
    *   **Purpose:** Contains a `SKILL.md` defining a strict 3-phase planning protocol for AI agents to prevent premature coding and enforce granular architectural planning. This is a highly valuable meta-tool for future development.
*   **`scripts/` Directory:** Contains a robust suite of diagnostic tools (`diag-gemini.ts`, `test-deep-dive-ab.ts`, `test-ocr.ts`). These are excellent for isolated testing but should be kept in sync as the main AI pipeline (`src/lib/ai/index.ts`) evolves (e.g., ensuring Perplexity is added to the A/B testing scripts).

### 4. Database Concurrency
*   **SSE Polling:** The new SSE endpoint polls the database every 1 second. While SQLite WAL mode handles this fine for a single-user app, if the app is ever deployed for multiple users, 1-second DB polling per active client connection will cause CPU and IO bottlenecks. 
*   **Solution Suggestion (Future-proofing):** Transition to an event-emitter pattern within the Node.js process where the `ItemService` broadcasts an event when a row updates, rather than having the API route poll the DB.