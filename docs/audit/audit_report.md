# Codebase Audit & Technical Review Report

This report summarizes the findings of a comprehensive audit of the `paper-inventory` system.

## 🚨 Critical Bugs & Logic Breaks

| Finding                    | Impact | Description                                                                                                                               |
| :------------------------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Broken Path Resolution** | High   | `api/items/[id]/enrich/route.ts` incorrectly joins an absolute DB path with `process.cwd()`, breaking the "Deep Dive" feature on Windows. |
| **Ghost Job Processing**   | Medium | `ItemService.lockNext` does not check `deletedAt IS NULL`. Soft-deleted items will still be processed by the background queue.            |
| **Missing Watchdog**       | Medium | Stall detection (`watchdogLockedAt`) is recorded but never acted upon during runtime. Stalled jobs remain locked until server restart.    |
| **Hash Collision Crash**   | Medium | Unhandled SQL uniqueness errors if a `contentHash` collision occurs during stage transition in `QueueManager`.                            |

## ⚠️ Architectural Smells (Intelligent Pushback)

1.  **Main-Thread Heavy Lifting**: Image processing (Sharp) and AI network orchestration happen on the main Next.js event loop. While Sharp is async, the orchestration is still main-thread bound, unlike the isolated OCR worker.
2.  **Type Dishonesty**: `Item` interface in `lib/db/items.ts` defines `tags` as a `string`, but API routes transform it to an `object`. This creates a mismatch for any consumer not using the API wrapper.
3.  **Redundant DB Updates**: `QueueManager` performs multiple redundant `UPDATE` calls for the same status (e.g., `processing_resize`) across different handlers.
4.  **No AI Token Tracking**: Missing implementation of System Doctrine 1.3 (Token tracking).

## 🔍 Security & Privacy Audit

- **MIME Validation**: ✅ Strong (Magic byte verification).
- **Path Traversal**: ✅ Prevented (Strict `path.join` and relative check).
- **PII / EXIF**: ✅ Correctly stripped via Sharp WebP conversion.
- **AI Secrets**: ✅ Controlled via server-side environment variables.

## 🛠️ Recommended Remediations

1.  **Fix Enrichment Path**: Use proper path normalization in `enrich/route.ts` that respects absolute paths stored in the DB.
2.  **Harden Job Selection**: Update `ItemService.lockNext` to include `deletedAt IS NULL`.
3.  **Implement Runtime Watchdog**: Add a background task to `QueueManager` that periodically checks for jobs locked longer than 5-10 minutes and resets them.
4.  **Isolate AI Orchestration**: Move AI calls to a worker or ensure they use hard timeouts (60s) to prevent hanging the queue loop.

## Verification Log

- **Static Analysis**: `npm run lint` and `tsc` results pending.
- **Manual Trace**: Completed for all core services.
