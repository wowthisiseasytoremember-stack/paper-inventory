# Comps Search Feature — Current State → Desired State

## Current State Analysis (Feb 24, 2026)

### ✅ What Already Exists
- **Database**: SQLite with item schema (title, valuation, tags, category, historicalContext, collectorSignificance)
- **AI Pipeline**: Full end-to-end (Gemini baseline → Triage → Grounding → GPT-4o/Claude deep dive)
- **API Structure**: `/api/items/*` endpoints with full CRUD
- **UI Framework**: Next.js + React 19 + TailwindCSS + Framer Motion
- **Collections**: Items organized into collections
- **Image Processing**: Sharp for resizing, Tesseract for OCR
- **Async Queue**: Background processing with p-queue
- **Data Models**: Zod schemas for validation

### ❌ What's Missing for Comps Search
- **Search Integration**: No code to call eBay/Mercari/Poshmark/Etsy APIs
- **Similarity Matching**: No algorithm to find "similar items"
- **Comp Aggregation**: No valuation engine that combines comp prices
- **Caching**: No persistent cache for comp searches
- **Search UI**: No interface for searching external listings
- **Results Display**: No grid to show comps with prices
- **Valuation Card**: No component showing estimated price ± range
- **Price Trends**: No visualization of price history

---

## Gap Analysis: What Needs to Be Built

### Architecture Needed
```
Current Pipeline (Photo → Item):
Upload → OCR → Resize → AI Analysis → Store Item

New Comps Search (Item → Market Comps):
User searches item metadata → Call external APIs
→ Find similar listings → Aggregate prices → Show valuation
```

### Tech Stack (Reusing What You Have)
- **Backend**: Next.js API routes (already there)
- **Database**: SQLite (already there) + new `comps_cache` table
- **Frontend**: React + TailwindCSS (already there)
- **Async**: p-queue (already there)
- **Validation**: Zod (already there)
- **Charts**: Add: recharts (for price history)
- **API Calls**: Add: raw fetch + retry logic (not Vercel AI SDK — you use raw fetch)

---

## Milestone Breakdown (Current → Complete)

### PHASE 1: Foundation (2-3 hours)
Build the search backend infrastructure

**1.1: Create comp_cache table in SQLite (20 min)**
- Schema: `comp_cache(id, query_hash, platform, results_json, expires_at, created_at)`
- Index on query_hash for fast lookup
- Add 7-day TTL logic

**1.2: Define Comps data model (20 min)**
- Create Zod schema for comp listing
- Fields: `{platform, title, price, condition, soldDate, seller, url, confidence}`
- Create CompsSearchResult schema with valuation

**1.3: Build API key manager for comp platforms (30 min)**
- Store in .env: EBAY_API_KEY, MERCARI_API_KEY, POSHMARK_API_KEY, ETSY_API_KEY
- Create `lib/comps/config.ts` with credentials
- Health check: Can authenticate to each platform?

**1.4: Stub out comp search router (30 min)**
- Create `lib/comps/index.ts` with `searchComps(query, filters)` function
- Routes to platform-specific searchers
- Handles caching layer

**Validation:** API keys authenticated, cache table created, router callable

---

### PHASE 2: Platform Integration (6-8 hours)
Build search clients for each platform

**2.1: Build eBay search client (90 min)**
- Function: `searchEBay(query: string, filters: {category?, condition?, maxPrice?})`
- Returns: Array of `CompListing[]` with standardized fields
- Handles rate limits (eBay: 5000 calls/hour)
- Parse response → standardize format
- Test: Search "vintage postcard" → get 10+ results with prices

**2.2: Build Mercari search client (60 min)**
- Function: `searchMercari(query, filters)`
- Similar to eBay but different response format
- Handle Mercari-specific fields (shipping included?, seller rating)
- Test: Search same query → get comparable format

**2.3: Build Poshmark search client (60 min)**
- Function: `searchPoshmark(query, filters)`
- Poshmark focuses on condition/brand
- Extract: price, brand, size, condition
- Test: Returns results in standardized format

**2.4: Add caching layer to router (60 min)**
- Before calling APIs: check `comp_cache` for query_hash
- If found & not expired: return cached results
- If not found: call all APIs, store results, return
- Implement cache invalidation (7-day TTL, manual refresh)
- Test: Second search instant, APIs not called

**2.5: Add rate limiting (45 min)**
- Per-platform queuing using p-queue
- eBay: 5000/hour limit
- Mercari: Respectful rate limiting
- Log violations, queue overages
- Test: Respect all limits, queue overages gracefully

**Validation:** Can search all 3 platforms, get standardized comp data, caching works, respects rate limits

---

### PHASE 3: Similarity & Matching (4-5 hours)
Build the matching algorithm

**3.1: Create query parser (60 min)**
- Input: User search "vintage postcard 1920s good condition"
- Extract: `{category, decade, condition, size?, author?, theme?}`
- Map natural language → schema fields
- Test: Parse 10 different user queries correctly

**3.2: Build similarity scorer (90 min)**
- Input: User item + comp item → similarity score 0-1
- Weight factors:
  - Category match: 40%
  - Condition match: 30%
  - Age/era match: 20%
  - Rarity/specificity match: 10%
- Return: score + explanation
- Test: Similar items score 0.8+, dissimilar score <0.3

**3.3: Build comp filter & ranking (60 min)**
- Filter: Only keep comps with similarity > 0.6
- Rank by: recency (prefer recent), seller rating, platform
- Return: top 20 ranked comps
- Test: Best matches appear first

**3.4: Integrate with existing valuation data (45 min)**
- Check if item already has valuation from AI pipeline
- Use that as baseline/context for comp search
- Compare AI estimate vs comp-based estimate
- Test: Shows both estimates

**Validation:** Parser extracts fields correctly, similarity scores make sense, filtering works, ranking logical

---

### PHASE 4: Valuation Engine (3-4 hours)
Build pricing analysis

**4.1: Price aggregator (45 min)**
- Input: Array of comps with prices `[{price, soldDate, condition, seller}, ...]`
- Calculate: median, mean, min, max, std dev, quartiles
- Output: `{median, mean, range: [min, max], stdDev, sampleSize, currency}`
- Handle edge cases: <3 comps, outliers
- Test: 5 comps [10, 12, 15, 8, 20] → median 12, range 8-20

**4.2: Confidence scorer (60 min)**
- Factors:
  - Sample size: 3+ comps = higher confidence
  - Price variance: Low std dev = higher confidence
  - Recency: Recent sales = higher confidence
  - Platform diversity: Comps from multiple platforms = higher confidence
- Output: score 0-100
- 5+ recent comps from multiple platforms, low variance = 85-100 (high)
- 2 old comps, high variance = 20-40 (low)
- Test: High confidence for common items, low for rare items

**4.3: Valuation summary package (45 min)**
- Combine price aggregation + confidence
- Return: `{estimated_price, confidence_score, price_range, sample_size, last_updated, explanation}`
- Handle: "Not enough data" case gracefully
- Test: Returns complete valuation object with all fields

**4.4: Store valuations in item record (30 min)**
- Add `comp_based_valuation` JSON field to items table
- Update on search
- Compare with AI-generated valuation
- Test: Valuation persists in DB

**Validation:** Price estimates reasonable, confidence scores realistic, graceful "no data" handling

---

### PHASE 5: API Endpoint (2-3 hours)
Create the search endpoint

**5.1: Create POST /api/search/comps endpoint (60 min)**
- Input: `{query: string, filters?: {...}, useCache?: boolean}`
- Output: `{comps: CompListing[], valuation: Valuation, confidence: number}`
- Calls full pipeline: parse → search all platforms → filter → match → aggregate
- Error handling: invalid query, API down, rate limited
- Test: POST query → 200 response with complete results

**5.2: Create GET /api/search/comps/history endpoint (45 min)**
- Return recent searches + their results
- Useful for "I searched this before"
- Pagination support
- Test: Retrieves search history

**5.3: Add request validation (30 min)**
- Query must be 2+ characters
- Validate filters format
- Reject malicious input
- Return helpful error messages
- Test: Invalid queries rejected

**5.4: Add response caching (30 min)**
- Cache entire response for same query
- Return from cache within TTL
- Test: Cached requests instant

**Validation:** API functional, handles errors gracefully, performance acceptable

---

### PHASE 6: UI — Search & Results (4-5 hours)
Build the user interface

**6.1: Create search bar component (45 min)**
- Input field with placeholder "Search for vintage ephemera..."
- Submit button
- Clear button
- Loading state spinner
- Test: Can type and submit

**6.2: Build results grid component (90 min)**
- Display 20+ comps in responsive grid
- Each comp card shows:
  - Thumbnail image
  - Title
  - Price (bold, prominent)
  - Condition
  - Sold date
  - Platform badge (eBay, Mercari, etc)
  - Seller rating
  - Link to external listing
- Lazy load images
- Responsive: 1 col on mobile, 2-3 on tablet, 4 on desktop
- Test: Results render correctly, images load

**6.3: Create valuation card component (60 min)**
- Prominent box showing:
  - **Estimated Price** (largest, centered)
  - Price range: Low ± High
  - Confidence score (visual bar, 0-100)
  - "Based on X comps from Y platforms"
  - "Last updated: X hours ago"
  - Comparison with AI estimate (if exists)
- Color code confidence: red (low), yellow (med), green (high)
- Test: All info visible, readable, visually clear

**6.4: Build price history chart (75 min)**
- Line chart showing comp prices over last 30/60/90 days
- X axis: date, Y axis: price
- Highlight median line
- Show trend direction (up/down)
- Interactive: hover shows exact values
- Use recharts library
- Test: Chart renders, shows trend correctly

**6.5: Add search to item detail page (30 min)**
- "Find Comps" button on individual item page
- Auto-fills search with item details
- Shows results inline or modal
- Test: Clicking button triggers search, shows results

**Validation:** All UI components render, search works, results display nicely

---

### PHASE 7: Integration & Polish (3-4 hours)
Connect everything + error handling

**7.1: Error message UI (45 min)**
- "No comps found" → suggest broader search
- "Rate limited" → "Retrying in X seconds"
- "Invalid query" → show examples
- "API unreachable" → show cached data if available
- All messages helpful + actionable

**7.2: Fallback data (30 min)**
- If live API down: use cached data
- Show warning: "Using cached results from X days ago"
- Don't show data older than 30 days
- Test: Works without live APIs

**7.3: Loading states (30 min)**
- Spinner while fetching
- Skeleton cards while loading comps
- "Calculating valuation..." text
- Test: Good visual feedback during delays

**7.4: Performance optimization (60 min)**
- Lazy load comp images (load on scroll)
- Debounce search input (300ms wait before searching)
- Memoize expensive calculations
- Cache chart data
- Test: <2 sec for cached searches, <5 sec for fresh

**7.5: Integration with collections (30 min)**
- Bulk search comps for entire collection
- Add "Search Comps" button to collection view
- Show aggregate valuation for collection
- Test: Works on collections

**Validation:** No crashes, helpful error messages, performance good

---

## Quick Summary: What Gets Built

| Component | Time | Type |
|-----------|------|------|
| **Phase 1: Foundation** | 2h | Backend setup |
| **Phase 2: Platform APIs** | 7h | Integration |
| **Phase 3: Matching** | 4h | Algorithm |
| **Phase 4: Valuation** | 3h | Pricing |
| **Phase 5: API Endpoint** | 3h | Backend |
| **Phase 6: UI** | 4h | Frontend |
| **Phase 7: Polish** | 3h | Integration |
| **Total** | ~26 hours | Full feature |

---

## Dependencies

**Minimal new dependencies:**
- `recharts` (for price history charts) — 1 npm install

**Reuse existing:**
- Next.js, React, TailwindCSS
- SQLite (better-sqlite3)
- Zod for validation
- p-queue for rate limiting
- Framer Motion for animations
- Existing API structure

---

## Implementation Order (Start Here)

### Week 1 (Days 1-3)
- [ ] Phase 1: Create tables + models (2-3 hours)
- [ ] Phase 2.1-2.3: Build eBay + Mercari clients (3-4 hours)
- [ ] Phase 3.1: Query parser (1 hour)
- **Validation**: Can search eBay, get results, parse queries

### Week 1 (Days 4-5)
- [ ] Phase 2.4-2.5: Caching + rate limiting (2 hours)
- [ ] Phase 3.2-3.4: Similarity matching (2-3 hours)
- **Validation**: Similarity scores make sense, results ranked logically

### Week 2 (Days 6-7)
- [ ] Phase 4: Valuation engine (3 hours)
- [ ] Phase 5: API endpoint (3 hours)
- **Validation**: POST /api/search/comps works, returns complete data

### Week 2 (Days 8-9)
- [ ] Phase 6: UI components (4-5 hours)
- **Validation**: Search bar works, results display, valuation card shows

### Week 2 (Day 10)
- [ ] Phase 7: Error handling + polish (3 hours)
- [ ] Testing + refinement
- **Launch**: Feature ready to use

---

## Risk Areas (Watch For These)

### HIGH RISKS
1. **API auth failures** → Have credentials ready, test early
2. **Rate limits** → Test with queue/backoff before full integration
3. **Similarity algorithm wrong** → Validate with real items first
4. **Cache poison** → Monitor cache hits/misses

### MEDIUM RISKS
5. **Rare items have no comps** → Graceful "not enough data" handling
6. **Slow searches** → Implement caching + lazy loading
7. **UI not responsive** → Test on mobile early

---

## Success Metrics

✅ **Feature ships when:**
- Can search external platforms (eBay, Mercari, Poshmark)
- Find similar items with relevance scores
- Aggregate prices into valuation
- Display results with confidence score
- Handle errors gracefully
- Performance acceptable (<5 sec fresh, <2 sec cached)

---

## Next Immediate Step

**→ START HERE: Phase 1.1 (20 min)**
Create `comp_cache` table schema in SQLite:

```sql
CREATE TABLE comp_cache (
  id TEXT PRIMARY KEY,
  query_hash TEXT UNIQUE,
  platform TEXT,
  results_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);
CREATE INDEX idx_comp_cache_hash ON comp_cache(query_hash);
```

Then → Phase 1.2 (define data models in Zod)

This roadmap removes all the "already done" stuff and focuses 100% on what's new.
