# PaperTrail Lite: Armor-Plated Implementation Spec

## 1. Data Model (Better-SQLite3)

### Item Schema (SQL)

- `id`: TEXT PRIMARY KEY (UUID)
- `status`: TEXT NOT NULL (queued, processing_ocr, ocr_complete, processing_resize, resize_complete, processing_ai, complete, error)
- `processingLock`: INTEGER DEFAULT 0
- `retryCount`: INTEGER DEFAULT 0
- `watchdogLockedAt`: DATETIME
- `errorMessage`: TEXT
- `originalHash`: TEXT
- `contentHash`: TEXT UNIQUE
- `title`: TEXT
- `guessedId`: TEXT
- `rawOcr`: TEXT
- `cleanedTranscription`: TEXT
- `confidence`: REAL
- `identifiedNames`: TEXT (JSON)
- `historicalContext`: TEXT
- `collectorSignificance`: TEXT
- `aiRawResponse`: TEXT
- `originalImagePath`: TEXT
- `resizedImagePath`: TEXT
- `thumbnailPath`: TEXT
- `ocrDurationMs`: INTEGER
- `resizeDurationMs`: INTEGER
- `aiDurationMs`: INTEGER
- `totalProcessingMs`: INTEGER
- `createdAt`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `processedAt`: DATETIME
- `deletedAt`: DATETIME (Soft delete)

### Full-Text Search (FTS5)

- Native `item_fts` virtual table indexing `title`, `cleanedTranscription`, and `identifiedNames`.
- Sync via SQL Triggers on `INSERT` and `UPDATE`.

---

## 2. Risk Mitigation Strategies

### OCR Worker Isolation

- **Isolation**: `./workers/ocr.worker.ts` using `worker_threads`.
- **Watchdog**: 120s timeout with `worker.terminate()`.
- **Pre-filtering**: Reject > 25MB or > 5000px before worker.

### Queue & Locking

- **Source of Truth**: Database-level locking (`processingLock = true`).
- **Startup Recovery**: Reset/Re-queue any non-complete jobs on server boot.
- **Stage Gating**: Each function strictly verifies `item.status` before execution.

### Secure File Handling

- **UUID Renaming**: Never use original filenames.
- **MIME Validation**: Verify via magic bytes (file-type).
- **Metadata Stripping**: Sharp-based EXIF removal before AI or hashing.

### Gemini Robustness

- **Validation**: Strict Ajv JSON Schema validation of all LLM outputs.
- **Circuit Breaker**: 3 retries with exponential backoff; mark as `ai_failed` on exhaustion.
- **Mock Mode**: Fully deterministic local development mode.

### Secure Config

- **Loopback Only**: `POST /api/config/key` restricted to `127.0.0.1` / `::1`.
- **Permissions**: `.local-config.json` written with `0o600` permissions.

---

## 3. Implementation Phases

1. **Phase 1: Foundation**: Next.js init, Better-SQLite3 setup, Storage init.
2. **Phase 2: The Armor**: Worker thread, Queue locking, Secure config.
3. **Phase 3: The Pipeline**: Sharp/OCR/Gemini orchestration.
4. **Phase 4: The Interface**: Deterministic progress UI, FTS search, Dashboard.
5. **Phase 5: Reliability**: Startup hooks, health checks, seed scripts.

---

## 4. Non-Negotiable Architecture Requirements (Guardrails)

### 1. Concurrency & Background Work

- **Isolation**: OCR and Gemini calls must never run in the main request thread.
- **Persistence**: Queue state must be in DB. No in-memory-only queues.
- **Restart-Safe**: On startup, any non-complete job must be reset to `queued` and `processingLock` cleared.
- **Watchdog**: All background tasks must have hard timeouts (120s for OCR, 60s for AI).

### 2. State Machine Integrity

- **Atomicity**: Stage transitions must be atomic DB updates.
- **Gating**: Each process must validate the `status` before execution.
- **No Skipping**: Transitions must follow the strict 8-stage sequence.

### 3. Absolute File Security

- **Identity**: Filenames must be UUID-based; original names stored separately.
- **Validation**: MIME type verified via magic bytes (file-type).
- **Paths**: Use `path.join(process.cwd(), ...)` for all file operations.
- **Sanitization**: EXIF/GPS must be stripped before any hashing or AI upload.

### 4. LLM Robustness

- **Validation**: Every Gemini response must pass Ajv JSON schema validation.
- **Circuit Breaker**: Max 3 retries with exponential backoff.
- **Observability**: Store raw AI responses and track durations per stage.

### 5. Deduplication & Hashing

- **Normalization**: Hash only after metadata stripping.
- **Constraint**: `contentHash` must be unique at the DB level.
- **Collision Handling**: Returns existing item instead of re-processing.

### 6. Security Surface

- **Loopback Only**: Config writes restricted to `127.0.0.1`.
- **Restricted PATCH**: Use a strict whitelist for editable fields; ignore system/status fields.
- **Permissions**: Sensitive files (.local-config.json) must use `0o600`.

### 7. Memory & Performance

- **Streaming**: Use Sharp streams for resizing and thumbnails.
- **Boundaries**: Enforce max image size (25MB) and max megapixels.
- **Concurrency**: Bounded queue for background processing (max 1-3).

---

## 5. IDE Enforcement Policies

To ensure project integrity, the following rules are non-negotiable for all generated code:

- **Deterministic AI**: Pinned `temperature=0` and schema-validated (Ajv) responses.
- **Atomic Stages**: Every background job must check `status` before entry and transition atomically.
- **Unlock Guarantee**: All locks must be released in `finally` blocks.
- **Secure File Ops**: UUID-based naming, magic-byte validation, and `path.join` absolute paths.
- **Dedupe Policy**: Hash only after metadata stripping; enforce uniqueness at DB level.
- **Startup Recovery**: Automatic reset of non-terminal jobs on app boot.
- **Local-Only Config**: Loopback checks and set permissions (`0o600`) for config writes.
- **Observability**: Health checks, structured logging, and duration tracking per stage.

---

## 6. Change Log (Append-only)

> [!NOTE]
> Timestamped newest at the top.

- **2026-02-19 11:00**: Integrated `SYSTEM_DOCTRINE.md` into project root and confirmed global memory persistence. Moved `IMPLEMENTATION_PLAN.md` to project root for permanence.
- **2026-02-19 10:57**: Pivoted from Prisma to `better-sqlite3` due to environment-specific path resolution issues on Windows. Updated implementation plan and schema.
- **2026-02-19 10:47**: Initialized local Git repository and made the first commit with Next.js foundation.
- **2026-02-19 10:00**: Hardened implementation plan with 8-stage state machine and worker thread isolation.
- **2026-02-19 09:54**: Project initialized with Next.js 14+, TailwindCSS, and basic requirements.

## 7. What We Have Tried (Archival Log)

- **Prisma Initialization on Windows**: Attempted multiple paths (relative, absolute, hardcoded, environment injection). All failed with exit code 1 or path resolution errors. (Status: **Pivoted to Better-SQLite3**).
- **Next.js Project Creation**: Initially hung on interactive prompts. Re-run with `--yes` and non-interactive flags. (Status: **Succeeded**).
- **Storage Initialization**: Recursive directory creation for uploads and logs. (Status: **Succeeded**).
