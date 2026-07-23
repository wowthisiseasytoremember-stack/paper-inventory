
# Product Requirements Document (PRD): PaperTrail Research Terminal

**Status:** Strategic Planning  
**Vision:** A "Zero-Knowledge" to "Expert-Level" research engine that grounds AI appraisals in real-world market data and human intuition.

---

## 1. Feature List

### F1: The Enrichment Conductor (Automated)
- **Multi-Stage Routing:** Automatic categorization (Conductor) followed by domain-specific extraction (Expert).
- **Grounding Engine:** Integration with web search (e.g., Perplexity/Tavily) to fetch real-time eBay "Sold" comps and active listings *before* the Expert appraises the item.
- **OCR Intelligence:** High-fidelity text extraction via Google Cloud Vision to feed the search queries.

### F2: Iterative Valuation (Human-in-the-Loop)
- **Context Injection:** Ability for the user to add manual notes (e.g., "I found this in a 1950s trunk") and trigger a **Re-Valuation**.
- **Analysis History:** A persistent, append-only log of every AI analysis, search result, and user override for a single item.
- **Field Locking:** Users can "lock" specific fields (e.g., Title or Category) so they aren't overwritten during subsequent AI re-runs.

### F3: The Vault Archive (Persistence).
- **Deep Search:** FTS5 indexing of OCR text, AI-generated historical context, and web-search snippets.
- **State Persistence:** 8-stage state machine ensures no data is lost if a web-search or AI call hangs.

### F4: Bundle & Proximity Intelligence (Group Scan)
- **Library-Scale Analysis:** A "Scan Library/Selected" feature that sends a structured index of multiple items to a specialized "Bundle Expert" model.
- **Sequence Value Logic:** Detects if individual low-value items (e.g., $2 comics) form a high-value sequence (e.g., a $40 complete run of issues #1-5).
- **Relational Discovery:** Identifies hidden connections, such as railroad correspondence from the same agent across different months or 1st appearances of related characters.
- **Proxy-to-Value Alerts:** Flags specific items for manual inspection based on "rarity markers" (e.g., "Page 3 typo in this edition increases value by 500%").

### F5: Export & Portability
- **Research Export:** Clean JSON/CSV exports of all identified names, estimated values, and eBay keywords for listing in external tools.

---

## 2. Critical User Journeys (CUJ)

### CUJ 1: The "Cold Start" Discovery
- **Goal:** Identify an unknown item from scratch.
- **Path:** User uploads a photo → Conductor identifies it as `aerospace_technical` → System searches web for "North American Aviation D-number [X]" → Expert combines search data + OCR to provide a $200 valuation.

### CUJ 2: The "Expert Correction" Loop
- **Goal:** Refine a valuation based on new physical evidence.
- **Path:** User notices a hidden signature on a document → User adds note: "Signed by project lead" → User clicks "Re-Analyze" → Expert receives previous analysis + New Note + New Web Search → Valuation jumps from $50 to $500.

### CUJ 3: The Batch Liquidation Review
- **Goal:** Determine which items in a 100-item batch are "Trash vs. Treasure."
- **Path:** User uploads 200 items → Waits for processing → Sorts list by value/liquidity → Reviews flags.

### CUJ 4: The "Bundle" Synergizer
- **Goal:** Uncover hidden value in related item groups.
- **Path:** User selects 20 misc comics from a bin → Clicks "Analyze Group" → AI detects a complete character arc from 1992 → AI suggests: "Do not sell individually; bundle as 'Shadowhawk Character Run' for 3x profit."

---

## 3. User Stories

| ID | User Role | Requirement | Goal/Benefit |
|:---|:---|:---|:---|
| **US.1** | Reseller | As a reseller, I want the AI to search the web for real-world comps | So that my valuations are grounded in current market reality, not just training data. |
| **US.2** | Researcher | As a researcher, I want to see a history of every time an item was analyzed | So I can track how new information changed the estimated value over time. |
| **US.3** | Dealer | As a dealer, I want to add "Secret Knowledge" to an item and re-run the AI | So the AI can re-evaluate its significance based on my expert intuition. |
| **US.4** | Bulk Seller | As a bulk seller, I want to lock the Title I wrote manually | So that future enrichment runs don't overwrite my corrected data. |
| **US.5** | Strategist | As a strategist, I want to filter by "High Liquidity" items | So I can identify which inventory will turn back into cash the fastest. |
| **US.6** | Collector | As a collector, I want to scan my whole library for bundles | So I can find synergistic value that isn't obvious when looking at one item at a time. |

---

## 4. Technical Constraints & Success Metrics
- **Data Longevity:** `analysis_history` must store the raw JSON from web-search providers to prevent "knowledge drift."
- **Search Latency:** Web-grounded enrichment must complete in < 60s (including search + analysis).
- **Auditability:** Every field in the UI must indicate if its value came from "AI," "Web Search," or "User."
