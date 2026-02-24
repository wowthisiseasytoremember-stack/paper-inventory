# Expert Prompt Design: Deep Extraction

The Expert Prompt is the heart of the system. While the Conductor just needed to glance at the item, the Expert model (e.g., GPT-4o, Claude 3.5 Sonnet) is given time and tokens to deeply analyze the asset.

## Core Principles of an Expert Prompt

1.  **Assume the Identity of a Hyper-Specialist:** Tell the model *exactly* who it is and what its biases should be. "You are an Overstreet-certified comic book grader with 30 years of experience focusing on 1990s variant covers."
2.  **Provide the "Cheat Sheet":** Give the model domain-specific rules it might not naturally weigh heavily enough.
    *   *Example (Comics):* "Look at the barcode box. If it has a strike through it or says 'Direct Edition', mark it as Direct. If it has a standard UPC barcode with a price, mark it as Newsstand."
    *   *Example (Rockwell Docs):* "Internal North American Aviation documents from the 1960s often have a 'D-number' in the top right corner. This is the definitive internal part number."
3.  **Mandate Strict Structure:** The Expert *must* return data in a predictable format (usually JSON) so your application can parse it and store it in a database.
4.  **Enforce Evidence-Based Extraction:** Tell the model to only extract what it can actually see or infer with high confidence from the provided image/text, rather than hallucinating metadata.

## Structure of a Good Expert Prompt

```text
You are a highly specialized appraiser and archivist focusing on [DOMAIN, e.g., 1960s Aerospace Internal Publications, specifically North American Aviation (NAA) and Rockwell International].

Your task is to deeply analyze the provided image(s) of the item and extract precise metadata according to the required JSON schema.

### Domain-Specific Rules & Cheat Sheet
*   **Identification:** Look for the characteristic "D-Number" (e.g., D-XXXXX) usually stamped or typed in the top right corner. This is the primary identifier.
*   **Classification:** Differentiate between "Proposals" (often spiral bound, speculative), "Technical Manuals" (dense diagrams, maintenance procedures), and "Internal Memos" (typewritten, routed to specific personnel).
*   **Dating:** If a date is not explicitly printed, estimate the year based on the program mentioned (e.g., Apollo CSM development points to mid-to-late 1960s).
*   **Condition:** Note any staples rusting, punch-hole tearing, or "Confidential" stamps that have faded.

### Extraction Instructions
1.  Analyze the image thoroughly, paying attention to small printed text, stamps, signatures, and handwritten annotations.
2.  Fill out the required JSON schema completely.
3.  If a required field cannot be determined from the image, use "Unknown" or null as appropriate for the schema type, but NEVER hallucinate data.
4.  If the item appears to be a reproduction rather than an original, note this in the "authenticity_notes" field.

### Output Format
You must respond ONLY with a valid JSON object matching this schema. Do not include markdown formatting or conversational text outside the JSON object.

[INSERT JSON SCHEMA HERE]
```

## Creating Your Experts
When you identify a new category of items in your inventory:
1.  **Define the Schema:** What data points actually matter for organizing, selling, or researching this item? (e.g., `schema-comic-book.json`).
2.  **Write the Cheat Sheet:** What are the "tricks of the trade" for identifying this item that the AI needs to be reminded of?
3.  **Combine & Test:** Put the prompt and schema together, feed it 5-10 varied images of that specific item type, and see where it fails. Refine the cheat sheet based on those failures.