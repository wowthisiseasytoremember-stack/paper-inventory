# Google Cloud Vision Integration Design

**Date:** 2026-02-24
**Status:** APPROVED
**Goal:** Integrate Google Cloud Vision for accurate OCR + test pipeline end-to-end

---

## Overview

Replace the current basic OCR worker with Google Cloud Vision API to:
- Extract text from comic book images with high accuracy
- Categorize items via Conductor prompt (what type is it?)
- Extract reseller-ready metadata via Expert prompts (title, value indicators, condition, keywords)
- Get the full pipeline working end-to-end so the app is usable today

---

## Architecture

### Components
1. **GCV Test Script** — Validates credentials + API works on 4 comic images
2. **GCV Client** — Singleton connection to Google Cloud Vision API
3. **OCR Handler** — Replaces worker-based OCR, calls GCV directly
4. **Scheduler** — Routes items through processing stages
5. **AI Router** — Conductor categorizes → Expert enriches
6. **Database** — Stores enriched results

### Data Flow
```
Upload comic image
  ↓ Stored in DB (queued)
  ↓ Scheduler picks up
  ↓ Resize image (thumbnail + web)
  ↓ OCR via Google Cloud Vision
  ↓ Conductor AI categorizes (→ comic_books)
  ↓ Expert AI extracts (title, keywords, condition, value signals)
  ↓ Store in DB (complete)
  ↓ UI displays enriched item
```

### Implementation Phases

#### Phase 1: Verify GCV Credentials (30 min)
**Goal:** Confirm Google Cloud Vision API works with your credentials

- Create `scripts/test-vision.ts`
- Load 4 test images (your comics)
- Call Vision.textDetection() on each
- Log: extracted text, confidence, any errors
- **Success Criteria:** All 4 images return text + confidence scores

#### Phase 2: Fix Database + Scheduler (2 hours)
**Goal:** Core pipeline infrastructure stable

Parallel work:
- Resolve 4 merge conflicts (items.ts, enrich/route.ts, ai/index.ts, page.tsx)
- Fix broken FTS5 triggers in live DB
- Fix silent error catches
- Add idempotency guard to enrich endpoint
- Activate scheduler loop (Task 2.1)
- Implement image resizing with Sharp (Task 2.3)

**Success Criteria:** Dev server boots, no TypeScript errors, scheduler can process queue

#### Phase 3: Integrate Google Cloud Vision (1 hour)
**Goal:** Replace worker-based OCR with GCV

- Create `src/lib/ocr/cloud-vision.ts` with Vision client
- Implement OCR handler that calls GCV
- Update scheduler to use GCV instead of worker
- Add retry logic for API failures
- Add timeout handling (30s)

**Success Criteria:** Upload image → scheduler runs → GCV extracts text

#### Phase 4: Wire AI Enrichment (1-2 hours)
**Goal:** Conductor + Expert prompts extract reseller data

- Implement Conductor prompt (categorize item type)
- Implement Expert dispatcher (pick expert based on category)
- Call Expert with OCR text + image
- Parse + validate JSON response
- Store analysis_history with results
- Add retry logic (3 attempts with backoff)

**Success Criteria:** Upload comic → AI extracts title, keywords, condition notes, value signals

#### Phase 5: End-to-End Test (30 min)
**Goal:** Full pipeline works: upload → OCR → categorize → enrich → store

- Start dev server
- Start scheduler worker
- Upload one of your 4 comics
- Watch it flow through all stages
- Confirm DB has populated fields
- Query results: title, identifiedNames, analysis_history, confidence

**Success Criteria:** Can upload comic and see enriched data in DB

---

## Error Handling

### GCV API Failures
- **Auth error (invalid credentials):** Log clearly, move item to `error` status
- **Quota exceeded:** Set status to `ocr_pending_retry`, will retry next cycle
- **Timeout (>30s):** Terminate call, move to `error`
- **Network error:** Retry up to 3 times with exponential backoff

### AI Enrichment Failures
- **Claude API error:** Retry up to 3 times with backoff
- **JSON parsing fails:** Log raw response, move to `error`, don't crash
- **Schema validation fails:** Indicates Claude returned malformed data, move to `error`

### Database Failures
- **Merge conflicts not resolved:** TypeScript compilation fails, fix before proceeding
- **FTS5 triggers broken:** Migrations repair them on startup
- **Locking issues:** Scheduler enforces max 2 concurrent jobs

---

## Risk Mitigation

### High Risk: GCV Credentials
- **Risk:** Invalid service key, quota exceeded, project misconfigured
- **Mitigation:** Test script validates in 30 minutes before investing in integration
- **Validation:** All 4 comics return text + confidence

### High Risk: Database Locks
- **Risk:** SQLite locks during concurrent processing, pipeline hangs
- **Mitigation:** Keep concurrent jobs ≤2, fix merge conflicts first
- **Validation:** Can process 10 items without "database is locked" errors

### Medium Risk: AI Response Parsing
- **Risk:** Claude returns malformed JSON, schema validation fails
- **Mitigation:** Strict Ajv validation, log raw response, move to error gracefully
- **Validation:** Process 5 items, confirm all have valid analysis_history entries

### Medium Risk: Slow Processing
- **Risk:** GCV API calls are slow (>30s), pipeline feels stuck
- **Mitigation:** Add logging to track duration per stage, show progress
- **Validation:** Upload → complete in <2 minutes per item

---

## Testing Strategy

### Unit Tests (Before Integration)
- GCV test script (Phase 1) — validates credentials + API
- Mock AI responses (can test without Anthropic quota)

### Integration Tests (During Phase 4-5)
- Upload real comic → full pipeline → verify all fields populated
- Test error paths: invalid file, API quota, network failure
- Idempotency: enrich twice → confirm single analysis entry

### Performance Tests (Phase 5)
- Process 5 items sequentially → confirm no hangs
- Check DB for lock errors in logs
- Monitor API costs (GCV text detection pricing)

---

## Success Criteria (MVP)

- [ ] GCV credentials verified (test script passes)
- [ ] Dev server boots without errors
- [ ] Can upload comic image
- [ ] Scheduler processes queue
- [ ] Image resizes to thumbnail + web version
- [ ] OCR extracts text from image
- [ ] Conductor categorizes as `comic_books`
- [ ] Expert extracts title, keywords, condition, value indicators
- [ ] Results stored in DB (analysis_history populated)
- [ ] No silent errors or hanging processes

---

## Timeline

| Phase | Time | Blocker |
|-------|------|---------|
| 1. GCV Test | 30 min | Credentials valid? |
| 2. DB + Scheduler | 2 hours | Code compiles? |
| 3. GCV Integration | 1 hour | Can call API? |
| 4. AI Enrichment | 1-2 hours | Claude works? |
| 5. End-to-End Test | 30 min | Full flow works? |

**Total: ~5-6 hours to working, usable pipeline**

---

## Next Steps

1. Invoke `superpowers:writing-plans` to create detailed task breakdown
2. Execute Phase 1 (GCV test) while team finishes Milestone 1 fixes
3. Merge Milestone 1 fixes
4. Execute Phases 2-5 in order
5. Celebrate! 🎉

---

**Approved by:** User (2026-02-24)
**Status:** Ready for Implementation Planning
