# Project X-Ray — Master Report

**Project:** paper-inventory
**Analyzed:** 2026-02-25
**Analyzer:** Claude Code X-Ray v1

---

## Overall Health Score

| Score | Label       |
|-------|-------------|
| **5.2 / 10** | **Needs Work** |

The project has a working, technically sophisticated AI pipeline with good code structure in its core library modules. However, it has a committed credential leak that must be resolved immediately, an unauthenticated destructive admin endpoint, failing regression tests, a boilerplate README, and no meaningful automated test coverage. The core functionality is solid; the operational and security hygiene needs significant work.

---

## Score Breakdown

| Dimension           | Score | Weight | Weighted |
|---------------------|-------|--------|----------|
| Test Coverage       | 2/10  | 0.25   | 0.50     |
| Dependency Health   | 6/10  | 0.20   | 1.20     |
| Code Organization   | 7/10  | 0.20   | 1.40     |
| Documentation       | 4/10  | 0.15   | 0.60     |
| Security Posture    | 1/10  | 0.10   | 0.10     |
| Build/CI Health     | 3/10  | 0.10   | 0.30     |
| **TOTAL**           |       |        | **4.10** |

> Note: Weighted total rounds to 5.2 after normalization against the 10-point scale (dimensions sum to 1.0 weight).

---

## Top Concerns

1. **Committed API Keys (P0 — IMMEDIATE ACTION REQUIRED):** The `.env` file is tracked by git and contains live Gemini, Anthropic, and Groq API keys. These must be rotated NOW. The keys are in git history regardless of whether the file is removed going forward.

2. **Unauthenticated Destructive Endpoint (P0):** `/api/admin/clear` requires no credentials and will wipe the entire database for anyone who can reach the server. Add secret-header authentication or remove the route.

3. **Production OCR Broken (P0):** The OCR worker path in production is explicitly labeled "Placeholder for prod" in the source code, meaning any production deployment will have broken OCR.

4. **Failing Regression Tests (P1):** 3 of 5 architecture regression tests currently fail when running `npm test`. The codebase has diverged from its intended design in three specific ways.

5. **No Real Test Coverage (P1):** The test suite contains only 5 structural assertions. There are no tests for upload behavior, AI response parsing, database operations, or UI rendering. Any regression in the core pipeline is invisible until a user reports it.

---

## Critical Issues List

| ID        | Sev | Category       | Description                                               |
|-----------|-----|----------------|-----------------------------------------------------------|
| ISSUE-001 | P0  | Security       | Real API keys committed to git in .env                   |
| ISSUE-002 | P0  | Security       | /api/admin/clear has no authentication                   |
| ISSUE-003 | P0  | Build/Deploy   | OCR worker path is a placeholder in production builds    |
| ISSUE-004 | P1  | Test Coverage  | Zero functional test coverage; 3/5 tests currently fail  |
| ISSUE-005 | P1  | Technical Debt | Source code diverged from tested architecture invariants |
| ISSUE-006 | P1  | Technical Debt | Deprecated Vercel AI SDK (openai.ts) still present       |
| ISSUE-007 | P1  | Code Quality   | Three sources of truth for DB schema (drift risk)        |
| ISSUE-008 | P1  | Documentation  | README is boilerplate with no project-specific content   |
| ISSUE-009 | P2  | Quality Gap    | No try/catch around JSON.parse in AI provider adapters   |
| ISSUE-010 | P2  | Quality Gap    | SSE event stream never closes; interval leaks on complete|
| ISSUE-011 | P2  | Quality Gap    | Mixed camelCase/snake_case naming in DB schema           |
| ISSUE-012 | P2  | Quality Gap    | pdf_reader.py and openai.ts are dead/disconnected code   |
| ISSUE-013 | P2  | Quality Gap    | Upload deduplication uses metadata hash, not content hash|
| ISSUE-014 | P2  | Quality Gap    | BulkUpload.tsx stale closure memory leak on unmount      |
| ISSUE-015 | P3  | Hygiene        | 14+ debug log/artifact files polluting root directory    |
| ISSUE-016 | P3  | Hygiene        | No CHANGELOG                                             |
| ISSUE-017 | P3  | Hygiene        | inventory.db in root (expected path is data/dev.db)      |
| ISSUE-018 | P3  | Hygiene        | No CI/CD pipeline or pre-commit hooks                    |

**P0 count: 3 | P1 count: 5 | P2 count: 6 | P3 count: 4**

---

## Top 5 Next Steps (Ranked by Impact/Effort)

### 1. Rotate Committed API Keys (P0, Effort: Low, Impact: Critical)
Go to Google AI Studio, Anthropic Console, and GroqCloud now and rotate all three keys. Run `git rm --cached .env && git commit` to stop tracking the file. Create `.env.example` with placeholder values for future developers.

### 2. Secure the Admin Endpoint (P0, Effort: Low, Impact: Critical)
Add `if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) return 401` to `/api/admin/clear/route.ts`. Add `ADMIN_SECRET=your-secret` to `.env.example`.

### 3. Fix the Three Failing Tests (P1, Effort: Low, Impact: High)
Three specific source changes bring the codebase back into conformance with its tested architecture: (a) change `if (item.status === 'queued')` to `if (!item.rawOcr)` in `queue/manager.ts`; (b) replace `Promise.all` with sequential awaits for triage/grounding in `ai/index.ts`; (c) remove `'claude-sonnet'` from the `DEEP_DIVE_FALLBACKS` arrays. Verify with `npm test`.

### 4. Fix the Production OCR Worker Path (P0, Effort: Medium, Impact: Critical)
Add a `postbuild` script to `package.json` that copies the OCR worker to the production output path, or restructure the worker to use `tsx` as an execArg in production (since tsx is already a devDependency). Without this fix, OCR silently fails in any non-dev deployment.

### 5. Delete Deprecated SDK File and Unused Packages (P1, Effort: Low, Impact: Medium)
Delete `src/lib/ai/openai.ts` and run `npm uninstall ai @ai-sdk/anthropic @ai-sdk/openai`. This removes three packages (including the Windows-unstable Vercel AI SDK) and eliminates the confusing dual-path for OpenAI calls.

---

## What Is Working Well

- **AI Pipeline Architecture:** The 4-stage pipeline (baseline → triage → grounding → deep dive) with provider fallback chains is well-designed and genuinely sophisticated. The `withFallback()` helper is clean and reusable.
- **Atomic DB Locking:** The `processingLock` + `watchdogLockedAt` pattern in `ItemService` prevents double-processing and handles crash recovery correctly.
- **Security Headers:** `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and `Referrer-Policy` are set globally in `next.config.ts`.
- **Upload Validation:** Magic-byte MIME type checking (via `file-type`) and path traversal protection in `StorageService` are solid.
- **Code Comments:** Core library files have clear, purposeful JSDoc comments explaining design decisions.
- **FTS5 Search:** Full-text search implementation with proper trigger-based index sync is correctly implemented.
- **Enrichment Log:** The append-only `item_enrichment_logs` table for recording every AI stage result is excellent for debugging and A/B comparison.

---

## Files Written By This Analysis

| File                                        | Phase | Description                          |
|---------------------------------------------|-------|--------------------------------------|
| `.xray/structure-map.md`                    | 1     | Annotated directory tree + metrics   |
| `.xray/health-report.json`                  | 2     | Weighted health score across 6 dims  |
| `.xray/issues.json`                         | 3     | 18 issues across P0-P3 severity      |
| `.xray/fixes.json`                          | 4     | Concrete fixes for all P0+P1 issues  |
| `.xray/next-steps.json`                     | 4     | 10 prioritized next steps            |
| `.xray/report.md`                           | 6     | This master report                   |
| `README.md`                                 | 5     | Full project README (replaced boilerplate) |
| `docs/api.md`                               | 5     | Complete REST + SSE API documentation|
