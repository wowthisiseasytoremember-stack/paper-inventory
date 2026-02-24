# Comps Search Feature — Updated Roadmap (Incorporating VAULT Patterns)

## Cross-Project Analysis

You have TWO projects with complementary strengths:

### VAULT (box-audit-system/apps/vault)
**Strengths:**
- ✅ **PricingCard component** - Beautiful, production-ready UI for displaying valuations
- ✅ **MarketDataCard component** - Shows market data + recent sales elegantly
- ✅ **MarketData type system** - Tier-based approach (realtime, ai_estimate, deeplink_only)
- ✅ **Server-side market research** - `/api/market-data` endpoint using Gemini
- ✅ **Profit calculator** - Inline cost-to-profit calculation in the card itself
- ✅ **Confidence visualization** - Color-coded confidence bars (red < 50, yellow 50-80, green 80+)
- ✅ **Value factors** - Pills with tooltips explaining what drives price

**Tech Stack:** Vite + React 19 + Express.js + PostgreSQL/Drizzle

### paper-inventory
**Strengths:**
- ✅ **AI pipeline** - Complete: baseline → triage → grounding → deep dive
- ✅ **Multi-model support** - Gemini + GPT-4o + Claude with fallbacks
- ✅ **Collections** - Already organize items
- ✅ **Bulk upload** - Process 1000+ items efficiently
- ✅ **Image processing** - OCR + resizing already working
- ✅ **Simpler database** - SQLite (no ORM complexity)
- ✅ **Existing valuation logic** - Items already have AI-generated valuations

**Tech Stack:** Next.js + React 19 + SQLite

---

## The Winning Strategy

### What to Copy from VAULT
1. **PricingCard component** - Port directly to paper-inventory
2. **MarketDataCard component** - Port directly to paper-inventory
3. **MarketData type** - Use as your data contract
4. **Server-side approach** - Don't call APIs from client, do it on backend
5. **Confidence scoring** - Adopt the visual bar + color approach

### What to Build on paper-inventory's Foundation
1. External API clients (eBay, Mercari, Poshmark, Etsy)
2. Similarity matching algorithm
3. Comp aggregation + valuation engine
4. Integration with existing item schema
5. Search UI + results grid

### Why This Works
- VAULT has the beautiful UI but doesn't have a deep comp search engine
- paper-inventory has the AI infrastructure but no valuation UI
- Together: You get both

---

## Updated Roadmap (Simplified with VAULT Insights)

### PHASE 1: Foundation + Component Port (4-5 hours)

**1.1: Port PricingCard from VAULT (60 min)**
- Copy: `apps/vault/client/src/components/pricing-card.tsx`
- Paste into: `src/components/PricingCard.tsx`
- Update imports (lucide-react, zod validation functions)
- Test: Component renders, profit calculator works
- Dependencies: Already have Tailwind, lucide-react

**1.2: Port MarketDataCard from VAULT (45 min)**
- Copy: `apps/vault/client/src/components/market-data-card.tsx`
- Paste into: `src/components/MarketDataCard.tsx`
- Update imports
- Test: Component renders with sample data

**1.3: Create comp_cache table in SQLite (20 min)**
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

**1.4: Define Zod schemas for comps (30 min)**
- Create `src/lib/ai/comps-schema.ts`
- CompListing schema (title, price, condition, date, seller, url, platform, confidence)
- CompsSearchResult schema (comps[], valuation, confidence, explanation)
- CompsMarketData schema (matching VAULT's MarketData type)

**1.5: Create comps config file (20 min)**
- Create `src/lib/comps/config.ts`
- Store API credentials in .env
- Health check functions for each platform

**Validation:** Components render, cache table exists, schemas validate sample data, APIs authenticate

---

### PHASE 2: Platform Integration (5-6 hours)

**2.1: Build eBay client (90 min)**
- Function: `searchEBay(query, filters): Promise<CompListing[]>`
- Uses eBay Trading API or HTML scraping (depends on API access)
- Returns standardized format
- Handles rate limits
- Test: Search "vintage postcard" → get results with prices

**2.2: Build Mercari client (60 min)**
- Function: `searchMercari(query, filters): Promise<CompListing[]>`
- Handle Mercari's response structure
- Extract: title, price, condition, seller, date
- Test: Returns standardized format

**2.3: Build Poshmark client (60 min)**
- Function: `searchPoshmark(query, filters): Promise<CompListing[]>`
- Focus on condition, brand, size
- Test: Returns standardized format

**2.4: Implement cache layer (60 min)**
- Check cache BEFORE calling APIs
- Store results in SQLite with 7-day TTL
- Implement cache invalidation
- Test: Second search is instant

**2.5: Add rate limiting (45 min)**
- Use existing p-queue from paper-inventory
- Queue requests per platform
- Respect limits, log violations
- Test: Respects all limits

**Validation:** Can search all 3 platforms, get standardized data, caching works, respects rate limits

---

### PHASE 3: Similarity & Matching (3-4 hours)

**3.1: Query parser (60 min)**
- Input: "vintage postcard 1920s good condition"
- Extract: {category, decade, condition, size?, author?, theme?}
- Test: Parse 10 different user queries

**3.2: Similarity scorer (75 min)**
- Compare user item vs each comp
- Score: 0-1 based on category, condition, age, rarity
- Test: Similar items score 0.8+, dissimilar <0.3

**3.3: Comp filtering & ranking (45 min)**
- Filter: similarity > 0.6
- Rank by: recency, seller rating
- Return: top 20 sorted
- Test: Best matches first

**Validation:** Parser works, scorer produces logical scores, filtering/ranking correct

---

### PHASE 4: Valuation Engine (2-3 hours)

**4.1: Price aggregator (45 min)**
- Input: Array of comps with prices
- Calculate: median, mean, min, max, stddev
- Handle: <3 comps gracefully
- Test: Math is correct

**4.2: Confidence scorer (60 min)**
- Factors: sample size, variance, recency, diversity
- Output: 0-100 confidence score
- Test: Common items high confidence, rare items lower

**4.3: Valuation summary (30 min)**
- Combine aggregation + confidence
- Return: structured valuation data matching VAULT's MarketData type
- Test: Complete object with all fields

**Validation:** Pricing makes sense, confidence realistic

---

### PHASE 5: API Endpoint (2 hours)

**5.1: Create POST /api/items/[id]/search-comps endpoint (60 min)**
- Input: `{query, filters?}`
- Output: `{comps, valuation, confidence, estimatedValue, recentSales}`
- Call full pipeline: parse → search → filter → aggregate
- Error handling: no query, API down, rate limited
- Test: Returns complete data

**5.2: Cache entire response (30 min)**
- Store search results in comp_cache
- Return from cache for same query within TTL
- Test: Cached searches instant

**5.3: Request validation (30 min)**
- Query 2+ chars
- Validate filters format
- Helpful error messages

**Validation:** Endpoint works, handles errors, performance acceptable

---

### PHASE 6: UI — Results Grid (3-4 hours)

**6.1: Create search bar component (30 min)**
- Input field
- Submit button
- Clear
- Loading spinner

**6.2: Build comps grid (90 min)**
- Display 20 results
- Each shows: thumbnail, title, price, condition, sold date, platform badge, seller rating, external link
- Responsive grid
- Lazy load images
- Test: Results render correctly

**6.3: Integrate PricingCard (45 min)**
- Use ported PricingCard component
- Pass valuation data
- Profit calculator works
- Test: Component displays correctly

**6.4: Integrate MarketDataCard (30 min)**
- Use ported MarketDataCard
- Show estimated value + recent sales
- Test: Data displays correctly

**Validation:** All UI renders, search works end-to-end, looks good

---

### PHASE 7: Integration & Polish (2-3 hours)

**7.1: Error handling (30 min)**
- "No comps found" → suggest broader search
- "Rate limited" → retry message
- "API down" → show cached data
- All graceful

**7.2: Fallback data (30 min)**
- Use cache if APIs down
- Show warning if data >7 days old
- Don't show data >30 days old

**7.3: Loading states (30 min)**
- Spinner, skeleton cards
- "Calculating valuation..."
- Good UX feedback

**7.4: Performance (30 min)**
- Lazy load images
- Debounce search input (300ms)
- Memoize expensive calculations
- Test: <2 sec cached, <5 sec fresh

**Validation:** No crashes, helpful messages, good performance

---

## Component Reuse Details

### What You're Copy-Pasting from VAULT

**PricingCard.tsx:**
- Already imports: lucide-react, Badge, Input, Tooltip (you have all these)
- Already uses: Tailwind classes (same as paper-inventory)
- No dependencies on VAULT-specific infrastructure
- Just paste and it works (5 min port)

**MarketDataCard.tsx:**
- Same story - pure React component
- No VAULT dependencies
- Just paste and wire up the MarketData type

**Types to copy:**
```typescript
// From VAULT's client/src/types/index.ts
export type MarketDataTier = 'realtime' | 'ai_estimate' | 'deeplink_only';

export interface MarketData {
  tier: MarketDataTier;
  estimatedValue?: { min: number; max: number };
  recentSales?: Array<{ title: string; price: number; date: string }>;
  ebayDeeplink: string;
  source?: string;
  rationale?: string;
  valueFactors?: { label: string; color: string; description: string }[];
}
```

---

## Tech Stack (Reusing Both Projects)

**From paper-inventory (already have):**
- Next.js, React 19, TailwindCSS
- SQLite (better-sqlite3)
- Zod validation
- p-queue for concurrency
- Sharp, Tesseract (for image processing)
- Lucide-react icons
- Existing AI routing (gemini-client, openai-manual, anthropic-manual)

**From VAULT (copy components):**
- PricingCard component
- MarketDataCard component
- MarketData type
- Confidence scoring visualization approach

**New dependencies:**
- None required (recharts optional, if you want fancy charts)

---

## Updated Time Estimate

| Phase | Hours | Notes |
|-------|-------|-------|
| **1. Foundation** | 4-5 | Including component port (saves huge time) |
| **2. Platform APIs** | 5-6 | Only 3 platforms (vs. 4 in generic roadmap) |
| **3. Matching** | 3-4 | Algorithm focused |
| **4. Valuation** | 2-3 | Straightforward math |
| **5. API Endpoint** | 2 | Reuses existing patterns |
| **6. UI** | 3-4 | Porting components saves time |
| **7. Polish** | 2-3 | Final touches |
| **TOTAL** | **21-25 hours** | Down from 26 hours (component reuse) |

---

## The Real Time-Saver

You don't have to design/build:
- ✅ PricingCard component (VAULT did this, just port it)
- ✅ MarketDataCard component (VAULT did this, just port it)
- ✅ Confidence visualization (VAULT solved it)
- ✅ Profit calculator (VAULT built it, already in PricingCard)
- ✅ Type system for market data (VAULT defined it)

**Estimated time saved: 6-8 hours**

That's why the roadmap is now 21-25 hours instead of 40+.

---

## Implementation Sequence

### Day 1 (Phase 1: 4-5 hours)
- [ ] 1.1: Port PricingCard (60 min)
- [ ] 1.2: Port MarketDataCard (45 min)
- [ ] 1.3: Create cache table (20 min)
- [ ] 1.4: Define schemas (30 min)
- [ ] 1.5: Config file (20 min)
- **Validation**: Components render, schemas work, cache exists

### Day 2 (Phase 2: 5-6 hours)
- [ ] 2.1: eBay client (90 min)
- [ ] 2.2: Mercari client (60 min)
- [ ] 2.3: Poshmark client (60 min)
- [ ] 2.4: Cache layer (60 min)
- [ ] 2.5: Rate limiting (45 min)
- **Validation**: Can search all platforms, caching works

### Day 3 (Phase 3: 3-4 hours)
- [ ] 3.1: Query parser (60 min)
- [ ] 3.2: Similarity scorer (75 min)
- [ ] 3.3: Filtering & ranking (45 min)
- **Validation**: Algorithm produces logical results

### Day 4 (Phase 4-5: 4 hours)
- [ ] 4.1: Price aggregator (45 min)
- [ ] 4.2: Confidence scorer (60 min)
- [ ] 4.3: Valuation summary (30 min)
- [ ] 5.1: API endpoint (60 min)
- [ ] 5.2-5.3: Validation & caching (30 min)
- **Validation**: API returns complete data

### Day 5 (Phase 6: 3-4 hours)
- [ ] 6.1: Search bar (30 min)
- [ ] 6.2: Results grid (90 min)
- [ ] 6.3: PricingCard integration (45 min)
- [ ] 6.4: MarketDataCard integration (30 min)
- **Validation**: UI renders, end-to-end works

### Day 6 (Phase 7: 2-3 hours)
- [ ] 7.1-7.4: Error handling + polish (2-3 hours)
- [ ] Testing + refinement
- **Launch ready**

---

## Key Insights from VAULT Project

1. **Server-side market research works** - Don't call eBay from client, do it on backend
2. **Confidence visualization matters** - Users understand color-coded bars intuitively
3. **Inline profit calculator is powerful** - Users immediately see ROI for acquisition
4. **Tier system is clean** - 'realtime' vs 'ai_estimate' vs 'deeplink_only' is elegant
5. **Component composition is key** - PricingCard + MarketDataCard can be used together or separately

---

## Next Immediate Step

**→ START HERE: Phase 1.1 (60 min)**

1. Go to: `C:\Users\wowth\Documents\projects\box-audit-system\apps\vault\client\src\components\pricing-card.tsx`
2. Copy the entire file
3. Paste into: `C:\Users\wowth\Documents\projects\paper-inventory\src\components\PricingCard.tsx`
4. Fix imports (check what's available in paper-inventory)
5. Test: Does it render with sample data?

Then → 1.2 (MarketDataCard)

You're about to save 6-8 hours by reusing VAULT's components. That's the power of having two projects.
