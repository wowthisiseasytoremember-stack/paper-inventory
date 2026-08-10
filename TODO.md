# paper-inventory — Execution Roadmap

**What:** Vintage paper ephemera cataloging & appraisal tool — bulk photo → OCR → heuristic classify → LLM identify → Perplexity research → valuation  
**Status:** App shipped and working. Integration gap only.  
**Key insight:** `feeds: [crosslist-ts-integration]` — valuated items should flow into Crosslist drafts automatically.

---

## 1. Implementation vs Integration Gap

| Dimension | Status |
|---|---|
| OCR pipeline (Tesseract + Google Vision) | ✅ Shipped |
| Heuristic category router (8 categories, zero LLM cost) | ✅ Shipped |
| LLM identification (Claude primary, Gemini fallback) | ✅ Shipped |
| Market research (Perplexity primary, Gemini fallback) | ✅ Shipped |
| Valuation (Claude/Gemini, confidence score) | ✅ Shipped |
| Local SQLite archive + FTS5 search | ✅ Shipped |
| CSV export | ✅ Shipped |
| **Crosslist integration** | 🔴 Missing |

---

## 2. Active Execution Tasks

- [ ] **Task 1: Wire Crosslist export** — map `paper-inventory` item schema (title, description, estimated value, eBay keywords) to Crosslist draft format via `crosslist-ts-integration` MCP CLI.
- [ ] **Task 2: Bulk ingest smoke test** — run `scripts/ingest-and-process.ts` against a real batch of paper photos and verify full pipeline end-to-end.
- [ ] **Task 3: Add box-number tagging** — align with Crosslist ingest convention (box tag per item) so drafts land in the right box grouping.
- [ ] **Task 4: Prune unused AI fallback paths** — `openai.ts` / `openai-sdk.ts` appear unused; confirm and remove to simplify the dependency surface.
