# Roadmap to Avoid "Stuck IDE" & Locking Issues

This document outlines the current state of the PaperTrail Lite project and provides strict guidelines for future development to prevent resource locking (specifically SQLite) and IDE performance issues.

## 🛑 Critical Rules (The "Anti-Stuck" Protocol)

1.  **NEVER** open the `data/dev.db` file in an external SQLite viewer (like DB Browser for SQLite) while the Next.js server is running. This **WILL** cause a lock and hang the server. Stop the server first.
2.  **Singleton Database Connection**: Always import `db` from `@/lib/db/index`. Never create a `new Database()` instance in your code. We have implemented a global singleton to handle Next.js hot-reloading.
3.  **Heavy Processing in Workers**: Do not put OCR, Image Resizing, or AI calls in the main API routes. The `scheduler.ts` and `worker` threads are designed to handle this asynchronously.
4.  **Filesystem Watchers**: We have added `data/` and `*.db*` to `.gitignore`. If your IDE is still indexing these files, mark the `data` directory as "Excluded" in your IDE settings manually.

## ✅ Completed Tasks (Current Status)

-   [x] **Project Hygiene**:
    -   Cleaned `.gitignore` to exclude heavy binary files.
    -   Removed dead `prisma` code.
    -   Implemented SQLite Singleton pattern.
-   [x] **Database Architecture**:
    -   Schema finalized (`items`, `items_fts`).
    -   Repository layer (`lib/db/items.ts`) created for safe, atomic operations.
-   [x] **Processing Pipeline**:
    -   `scheduler.ts` created to poll queue and dispatch jobs.
    -   `ocr.worker.ts` integrated (basic text extraction).
-   [x] **Ingestion**:
    -   `POST /api/upload` endpoint created.
    -   Validates files, saves to disk, and creates DB entries.

## 📝 Immediate Next Steps (The Roadmap)

### 1. Activate the Scheduler
Currently, the scheduler logic exists but isn't running automatically.
-   **Task**: Create a script `scripts/start-worker.ts` that imports `startProcessingLoop` and runs it.
-   **Why**: Running it as a separate process from Next.js is safer for memory and locking.
-   **Command**: `npx tsx scripts/start-worker.ts`

### 2. Implement Image Resizing
-   **Task**: Implement the `processing_resize` stage in `scheduler.ts`.
-   **Tool**: Use `sharp`.
-   **Goal**: Create a thumbnail (300px width) and a web-optimized version (1024px width).
-   **Output**: Update `thumbnailPath` and `resizedImagePath` in DB.

### 3. Implement Gemini AI Integration
-   **Task**: Implement the `processing_ai` stage in `scheduler.ts`.
-   **Tool**: `@google/generative-ai`.
-   **Goal**: Send the *text* (OCR result) + *image* (optional) to Gemini.
-   **Prompt**: "Extract the title, date, key names, and summary from this document."
-   **Output**: Save JSON response to `aiRawResponse` and parse into `identifiedNames`.

### 4. Build the Frontend Dashboard
-   **Task**: Create a page to list items (`SELECT * FROM items ORDER BY createdAt DESC`).
-   **Feature**: Real-time polling (every 3s) to show status changes (Queued -> OCR -> Complete).

## 💡 How to Resume Work safely

1.  **Start the Server**: `npm run dev`
2.  **Start the Worker (Optional but recommended)**: `npx tsx scripts/start-worker.ts` (Create this file first!)
3.  **Test Upload**: Use Postman or `curl` to POST a file to `http://localhost:3000/api/upload`.

```bash
curl -F "file=@/path/to/image.jpg" http://localhost:3000/api/upload
```

4.  **Check Status**: Query the DB (after stopping server) OR check logs.

---
**Last Updated**: February 19, 2026
