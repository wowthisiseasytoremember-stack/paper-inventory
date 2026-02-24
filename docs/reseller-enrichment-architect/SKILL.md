---
name: reseller-enrichment-architect
description: Designs Router/Expert AI flows specifically for single-user eBay resellers. Helps build prompts and schemas that quickly categorize vintage items (ephemera, comics, electronics) and extract the exact data needed to research comps, price items, and write eBay listings.
---

# Reseller Enrichment Architect

This skill helps design a multi-step AI enrichment pipeline optimized for a single seller processing a massive, varied "death pile" (vintage ephemera, 1990s comics, railroad timetables, Rockwell aerospace docs, etc.). 

**The core philosophy: Speed over perfection. Valuation over archival accuracy.** This is not a museum database; it's an engine to get items researched, priced, and listed on eBay as fast as possible. Minor AI hallucinations or edge-case failures are acceptable.

## When to Use This Skill

- You need to build a fast "Conductor" prompt that just figures out *what* an item is so it can be routed to the right pricing expert.
- You need to design an "Expert" prompt that acts like a specialized appraiser (e.g., an expert in Denver Rio Grande railroad history or 1990s comic book variants).
- You need to create JSON schemas that force the AI to output eBay-ready data (e.g., SEO-optimized listing titles, bulleted condition flaws, and search keywords for checking sold comps).

## The Pipeline Architecture

### 1. The Conductor (Fast/Cheap Model - e.g., GPT-4o-mini)
*   **Goal:** Instant categorization. Look at the image, pick a bucket.
*   **Output:** Just an `enum` (e.g., `comic_book`, `railroad_ephemera`, `aerospace_doc`).
*   **Mindset:** "Don't think, just sort."

### 2. The Experts (Slow/Capable Model - e.g., GPT-4o)
*   **Goal:** Research and Valuation preparation.
*   **Input:** The image + The specific Expert Prompt for that category.
*   **Output:** JSON containing an eBay-optimized Title, 5 search keywords to check sold comps, a bulleted list of visible damage, and a rough value gut-check.
*   **Mindset:** "Act like an expert dealer telling me exactly what I need to know to sell this today."

## Workflows

### 1. Designing the "Sorting Bins" (Taxonomy)
Help the user group their hoard into 5-10 major categories based on *who* would buy them. (e.g., Train collectors buy maps and timetables, so group them into `railroadiana`). See `references/reseller-taxonomy.md`.

### 2. Drafting the Appraiser Prompts
Write the Expert prompts that tell the AI what makes an item valuable in that specific niche. (e.g., "For 1990s comics, tell me if it's a Newsstand edition. For Rockwell docs, look for the D-number to identify the exact space program"). See `references/appraiser-prompt-template.md`.

### 3. Building the Output Schema
Design the JSON structure that the Expert must return. This should directly map to the user's Next.js dashboard so they can easily copy-paste into eBay. See `references/ebay-schema-example.json`.