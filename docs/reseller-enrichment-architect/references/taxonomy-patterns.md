# Taxonomy & Hierarchy Design Patterns

Designing the categories for a Router/Expert system is the most critical step. If the categories are too broad, the Experts become confused. If they are too narrow, the Router will fail to choose the right one, and you'll write too many prompts.

## Pattern 1: The "Metadata Needs" Split (Recommended)
Do not group items by what they *are*; group them by *what data you need to extract from them*.

*   **Bad Taxonomy:** "Paper Items", "Cardboard Items"
*   **Good Taxonomy:** 
    *   `serial_publications` (Requires: Issue Number, Volume, Date, Publisher. Covers: Magazines, Comics, Technical Journals)
    *   `geographic_media` (Requires: Region, Scale, Year, Cartographer. Covers: Maps, Transit Schematics)
    *   `postage_numismatics` (Requires: Denomination, Country, Cancellation mark. Covers: Stamps, Coins)
    *   `corporate_ephemera` (Requires: Company Name, Document Type, Internal ID. Covers: Rockwell Docs, Railroad Timetables, Receipts)

## Pattern 2: The "Visual Layout" Split
If the Router is primarily looking at images, group categories by how they visually present data.

*   `structured_forms`: Receipts, timetables, technical spec sheets. (Expert prompt focuses on table extraction).
*   `cover_art`: Comic books, vinyl records, vintage paperbacks. (Expert prompt focuses on OCRing stylized text and describing art).
*   `dense_text`: Internal publications, old letters, manuals. (Expert prompt focuses on summarization and key-entity extraction).

## Pattern 3: The "Value Driver" Split
For collectibles and inventory, group items by what determines their price.

*   `condition_critical`: Comics, Stamps, Records. (Expert must extract extreme detail about corner wear, fading, scratches).
*   `historical_significance`: Letters, internal docs, maps. (Expert must extract names, dates, and historical context).
*   `functional_spec`: Electronics, tools. (Expert must extract Model Numbers, Serial Numbers, Voltage).

## The "Unknown" Category
Always include an `unclassified` or `general_ephemera` category. The Router must have a safe "I don't know" button so it doesn't hallucinate a category, allowing the item to fall back to a generic extraction prompt.