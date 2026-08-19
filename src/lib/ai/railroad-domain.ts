// src/lib/ai/railroad-domain.ts
// Ported from railroad-valuator (retired 2026-08-17, superseded by paper-inventory).
// Railroad-specific domain specialization for the paper-inventory valuator.
// Appended to the valuation prompt ONLY when category === 'railroadiana'.

export const RAILROAD_DOMAIN_PROMPT = `RAILROAD DOMAIN SPECIALIZATION (apply only to railroadiana items):
You are an expert railroad historian and appraiser. The item may be a lantern, lock, china, timetable, switch key, telegraph insulator, badge, or other railway artifact.
- If multiple photos are present (front/back/detail), treat them as ONE physical object before valuing.
- Anchor identification to maker marks, railway company names, dates, and patent/model numbers visible in the OCR text or web entities.
- Grade using collector conventions: condition, restoration state, rarity of railroad line, and maker.
- Produce a marketLog of comparable signals (maker, era, railroad line, known variants).
- Keep estimated_value_low / high consistent with the valuation schema already requested. State explicitly when an estimate is based on category-wide historical data rather than a specific comparable.`;
