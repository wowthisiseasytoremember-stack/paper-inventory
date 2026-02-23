# Fix & Polish AI Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get the photo → AI identification → valuation pipeline working end-to-end, then add hot-swappable model/prompt controls to the debug FAB.

**Architecture:** 3-stage pipeline — (1) Gemini 2.0 Flash for fast baseline ID + categorization, (2) Gemini 2.5 Flash + Google Search for real eBay/market grounding, (3) OpenAI GPT-4o (or swappable) for specialized deep dive with category-specific prompts. Debug FAB allows hot-swapping models and prompts at every stage.

**Tech Stack:** Next.js 16, TypeScript, `@google/generative-ai`, OpenAI REST API (manual fetch), better-sqlite3, Zod, Framer Motion

---

## Difficulty Legend

| Tag | Meaning |
|-----|---------|
| 🟢 **SIMPLE** | Any IDE/model can handle — config changes, straightforward edits, copy-paste |
| 🟡 **MODERATE** | Needs context awareness — wiring between files, API integration |
| 🔴 **COMPLEX** | Needs a strong model — prompt engineering, architectural decisions, multi-file coordination |

---

### Task 1: Fix `.env` with working API keys
🟢 **SIMPLE**

**Files:**
- Modify: `.env`

**Step 1: Update .env with all working keys**

```env
GEMINI_API_KEY=AIzaSyBIsSOJFJbM0fANbqHWWn6a_ce6iWRUQo0
OPENAI_API_KEY=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
ANTHROPIC_API_KEY=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
```

**Step 2: Commit**

```bash
git add .env
git commit -m "fix: add OpenAI and Anthropic API keys to .env"
```

---

### Task 2: Fix `gemini-client.ts` — broken model + bloated prompt
🟡 **MODERATE**

**Files:**
- Modify: `src/lib/ai/gemini-client.ts`

**What's wrong:**
- Line 59: uses `gemini-1.5-flash` which 404s on v1beta API
- Lines 98-127: inline bloated prompt that duplicates the deep dive's job
- Should use the lean `BASELINE_SYSTEM_PROMPT` from `prompts.ts`

**Step 1: Fix model name and swap to lean prompt**

Change `getModel()` (line 53-60) to use `gemini-2.0-flash`.

Change `analyzeItem()` to import and use `BASELINE_SYSTEM_PROMPT` from `prompts.ts` instead of the inline prompt. The prompt should be injected as `system_instruction` on the model config, and the user message should just send OCR text + image.

**Step 2: Verify the schema still matches**

The `BASELINE_SYSTEM_PROMPT` returns 5 fields: `title`, `guessedId`, `cleanedTranscription`, `confidence`, `tags`. The Ajv schema in this file expects more (historicalContext, valuation, etc.) — those need to be removed from `required` or the validation will reject every response. Switch to Zod `ItemMetadataSchema` from `schema.ts` which already has `.default()` on optional fields.

**Step 3: Test with a curl to upload endpoint**

```bash
curl -F "file=@test-image.jpg" http://localhost:3000/api/upload
```

Watch logs for `[AI] Using Gemini Flash for baseline analysis` followed by success.

**Step 4: Commit**

```bash
git add src/lib/ai/gemini-client.ts
git commit -m "fix: update gemini-client to 2.0-flash model and lean baseline prompt"
```

---

### Task 3: Rewire `ai/index.ts` to be a proper provider router
🔴 **COMPLEX**

**Files:**
- Modify: `src/lib/ai/index.ts`

**What's wrong:** Currently hardcoded to only call `gemini-client.ts`. Needs to support dynamic model selection (for the debug FAB) and be the single entry point.

**Step 1: Rewrite `index.ts` as a provider router**

The new `analyzeImage()` should accept an optional `options` parameter:

```typescript
interface AnalysisOptions {
  baselineModel?: string;    // e.g. "gemini-2.0-flash", "gpt-4o-mini", "gpt-4o"
  deepDiveModel?: string;    // e.g. "gpt-4o", "claude-sonnet", "gemini-2.5-flash"
  enableGrounding?: boolean; // default true
  customPrompt?: string;     // override deep dive system prompt
}
```

Route to the correct provider based on model prefix:
- `gemini-*` → `gemini-client.ts`
- `gpt-*` → `openai-manual.ts`
- `claude-*` → new Anthropic handler (Task 5)

Default: `gemini-2.0-flash` for baseline, `gpt-4o` for deep dive.

**Step 2: Commit**

```bash
git add src/lib/ai/index.ts
git commit -m "feat: rewrite AI index as provider router with dynamic model selection"
```

---

### Task 4: Sharpen grounding prompt for eBay sold listings
🔴 **COMPLEX** (prompt engineering)

**Files:**
- Modify: `src/lib/ai/gemini-grounding.ts`

**What to change:**

Update `buildPrompt()` to specifically ask Gemini + Google Search to:
1. Search for eBay **sold** listings (not active — sold prices are real comps)
2. Search for recent auction results on LiveAuctioneers, Heritage Auctions
3. Look for collector forum discussions of the specific item
4. Return pricing comps as structured data

The grounding response gets injected into the deep dive as `GROUNDING_RESEARCH`, so the structure matters — the deep dive model needs to see: item description, sold price, date, platform.

**Step 1: Rewrite `buildPrompt()` with marketplace-focused instructions**

Key changes to the prompt:
- Explicitly mention "eBay sold listings" and "completed auction results"
- Ask for structured comps: `{"comps": [{"description":"...", "soldPrice":"$X", "date":"...", "platform":"eBay/Heritage/etc"}]}`
- Add category-aware search hints (if D&RG, search railroadiana dealers; if comics, search CGC census + sold graded copies)

**Step 2: Test with a known item**

Manually trigger enrichment on an existing item and check `ai-prompt-debug.txt` for the grounding output.

**Step 3: Commit**

```bash
git add src/lib/ai/gemini-grounding.ts
git commit -m "feat: sharpen grounding prompt for eBay sold listings and marketplace comps"
```

---

### Task 5: Add Anthropic provider support
🟡 **MODERATE**

**Files:**
- Create: `src/lib/ai/anthropic-manual.ts`

**Why:** User wants to A/B test. Anthropic key is active. Same manual fetch pattern as `openai-manual.ts` but targeting Anthropic's Messages API.

**Step 1: Create `anthropic-manual.ts`**

Use raw `fetch` to `https://api.anthropic.com/v1/messages` (same pattern as openai-manual.ts — avoids Vercel SDK native module crashes on Windows).

Support both baseline and deep dive via a single `callAnthropic(systemPrompt, userContent, model)` function.

Model: `claude-sonnet-4-20250514` (latest Sonnet).

Image support: Anthropic uses `{"type":"image","source":{"type":"base64","media_type":"...","data":"..."}}` format.

**Step 2: Wire it into the provider router (Task 3)**

`claude-*` prefix routes to this file.

**Step 3: Test with a single item**

```bash
curl -X POST http://localhost:3000/api/items/<id>/enrich \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-sonnet"}'
```

**Step 4: Commit**

```bash
git add src/lib/ai/anthropic-manual.ts
git commit -m "feat: add Anthropic Claude provider via manual fetch"
```

---

### Task 6: Update `queue/manager.ts` to use the new router
🟡 **MODERATE**

**Files:**
- Modify: `src/lib/queue/manager.ts`

**What to change:**

`handleAI()` currently imports from both `../ai` and `../ai/openai-manual` separately. It should only import from `../ai` (the router) and let the router handle everything.

The router's `analyzeImage()` should handle the full chain: baseline → triage → grounding → deep dive. The queue manager just calls one function and gets back the merged result.

**Step 1: Simplify `handleAI()`**

Replace the current ~60 lines of manual orchestration with a single call:

```typescript
const result = await analyzeImage(item.resizedImagePath, item.rawOcr || '');
```

The router returns the final merged metadata (baseline + deep dive).

**Step 2: Test full pipeline**

Upload a new image and watch it go through queued → OCR → resize → AI → complete.

**Step 3: Commit**

```bash
git add src/lib/queue/manager.ts
git commit -m "refactor: simplify queue manager to use unified AI router"
```

---

### Task 7: Update `enrich/route.ts` to accept model overrides
🟡 **MODERATE**

**Files:**
- Modify: `src/app/api/items/[id]/enrich/route.ts`
- Modify: `src/app/api/debug/log/route.ts`

**What to change:**

The enrich endpoint currently only accepts `{ prompt }`. It needs to also accept:
```json
{
  "prompt": "optional custom prompt",
  "baselineModel": "gemini-2.0-flash",
  "deepDiveModel": "gpt-4o",
  "enableGrounding": true
}
```

Pass these through to the AI router.

The debug/log GET endpoint should return available models and current defaults (for the FAB to populate dropdowns).

**Step 1: Update POST handler to extract and forward options**

**Step 2: Update GET `/api/debug/log` to return model config**

```json
{
  "prompt": "...",
  "models": {
    "baseline": ["gemini-2.0-flash", "gpt-4o-mini", "gpt-4o"],
    "deepDive": ["gpt-4o", "claude-sonnet", "gemini-2.5-flash"],
    "grounding": ["gemini-2.5-flash"]
  },
  "defaults": {
    "baselineModel": "gemini-2.0-flash",
    "deepDiveModel": "gpt-4o",
    "enableGrounding": true
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/items/[id]/enrich/route.ts src/app/api/debug/log/route.ts
git commit -m "feat: enrich endpoint accepts model overrides for A/B testing"
```

---

### Task 8: Expand DebugFAB with model/provider controls
🔴 **COMPLEX** (UI + state + wiring)

**Files:**
- Modify: `src/components/DebugFAB.tsx`

**What to add:**

Above the existing prompt textarea, add:
1. **Baseline Model** dropdown: `gemini-2.0-flash` (default), `gpt-4o-mini`, `gpt-4o`
2. **Deep Dive Model** dropdown: `gpt-4o` (default), `claude-sonnet`, `gemini-2.5-flash`
3. **Grounding** toggle: on (default) / off
4. All selections get sent as JSON body when "RUN CUSTOM PROMPT" is clicked

Load defaults from `GET /api/debug/log` on mount (already partially wired).

Persist user's last selection to `localStorage` so it survives page navigation.

**Design:**
- Keep the existing dark/glass aesthetic
- Compact dropdowns with the same `text-[10px] font-black uppercase tracking-widest` style
- Group the 3 controls in a row above the textarea

**Step 1: Add state for model selections**

**Step 2: Add dropdown UI components**

**Step 3: Wire selections into the fetch body of `handleRetryWithPrompt()`**

**Step 4: Persist to localStorage**

**Step 5: Commit**

```bash
git add src/components/DebugFAB.tsx
git commit -m "feat: add model/provider hot-swap controls to debug FAB"
```

---

### Task 9: End-to-end smoke test
🟢 **SIMPLE**

**Step 1: Start the dev server**

```bash
cd C:/Users/wowth/Desktop/Projects/paper-inventory && npm run dev
```

**Step 2: Upload a test image**

```bash
curl -F "file=@20260117_173942.jpg" http://localhost:3000/api/upload
```

**Step 3: Watch logs for the full pipeline**

Expected log sequence:
```
[Queue] 🚀 Processing Item <id> (Status: queued)
[Queue] ✅ OCR Complete for <id>
[Queue] ✅ Resize & Hash Complete for <id>
[AI] Using Gemini 2.0 Flash for baseline analysis
[GeminiTriage] Category: <comics_1990s|drg_railroadiana|other>
[GeminiGrounding] Found X comps from Google Search
[AI-DeepDive] Running with gpt-4o...
[Queue] 🏁 AI Analysis Complete for <id>
```

**Step 4: Open FAB, switch deep dive to `claude-sonnet`, re-run enrichment**

Verify it uses Anthropic instead and produces results.

**Step 5: Commit any final fixes**

---

### Task 10: Polish pass
🔴 **COMPLEX**

**Files:** Multiple — whatever surfaces during testing

**What to polish:**
1. Error messages — make sure every failure surfaces a clear toast, not just a console error
2. Category-specific prompts — refine based on actual results from Task 9
3. Grounding quality — check if eBay comps are actually coming through; adjust search hints
4. Normalizer — verify the Zod schema handles all three providers' output formats
5. Deep dive prompt tuning — make the specialized prompts (comics, D&RG, general) produce genuinely useful appraisals, not generic fluff
6. Remove dead code — `src/lib/ai/openai.ts` (broken Vercel SDK version) can be deleted
7. Clean up unused dependencies — `@ai-sdk/anthropic`, `@ai-sdk/openai`, `ai` packages are not used

---

## Execution Order & Dependencies

```
Task 1 (.env)
   ↓
Task 2 (gemini-client fix) ─── Task 5 (anthropic provider) ─── can run in parallel
   ↓                              ↓
Task 3 (router rewrite) ←── needs both 2 and 5
   ↓
Task 4 (grounding prompt) ─── Task 6 (queue manager) ─── Task 7 (enrich route) ─── can run in parallel
   ↓
Task 8 (debug FAB UI)
   ↓
Task 9 (smoke test)
   ↓
Task 10 (polish)
```

## Summary by Difficulty

| Difficulty | Tasks | Can be handled by |
|-----------|-------|-------------------|
| 🟢 SIMPLE | 1, 9 | Any model/IDE — config and manual testing |
| 🟡 MODERATE | 2, 5, 6, 7 | Mid-tier model — requires reading existing code and making targeted edits |
| 🔴 COMPLEX | 3, 4, 8, 10 | Strong model — prompt engineering, architectural wiring, multi-file coordination |
