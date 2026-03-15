# PROJECT STATE: Paper Inventory (Feb 2026)

## Current Overview
The project is a high-reliability paper ephemera inventory system ("PaperTrail Lite"). It features a robust 8-stage processing pipeline for OCR, image optimization, and multi-stage AI enrichment.

### Architecture
- **Framework:** Next.js 16 (App Router)
- **Database:** SQLite (Better-SQLite3) with FTS5 search.
- **AI Pipeline:** Parallel triage and grounding. Supports Gemini, OpenAI, Anthropic, Groq, and Perplexity.
- **Workers:** Isolated OCR worker threads for stability on large backlogs.

## Key Accomplishments
- **End-to-End Pipeline:** Functional from upload to valuation.
- **Grounding Integration:** Uses Google Search (via Gemini) for real-world eBay sold listings comparison.
- **Debug Tooling:** Advanced "Neural Console" (Debug FAB) for per-item model/prompt testing.
- **A/B Testing:** Results are versioned in `analysis_history` for easy comparison.

## Identified Issues
- **SDK Technical Debt:** Redundant `openai.ts` using Vercel SDK needs removal.
- **Root Clutter:** Numerous debug log files from previous sessions are present in the project root.
- **UX Gaps:** Bulk upload lacks real-time progress feedback, and error items lack a "one-click" retry in the UI.

## Roadmap & Next Steps
1. **Frontend Polish:** Build the Batch Upload Progress tracker and Valuation Summary dashboard.
2. **Maintenance:** Cleanup deprecated files and packages.
3. **Features:** Add CSV export and side-by-side A/B comparison view.
4. **Data:** Process the 1000-2000 item backlog with optimized model choices (Gemini 2.5 Flash for cost efficiency).
