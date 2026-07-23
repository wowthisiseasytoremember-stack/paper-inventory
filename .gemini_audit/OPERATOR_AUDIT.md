# Operator Audit: PaperTrail Research Terminal (paper-inventory)

## 1. System Health: 7.5/10
A highly specialized and robust tool for collectors/resellers. The "Hardened SQLite" approach ensures high data integrity for local usage.

## 2. Entropy Trend: Improving
The system is following a clear "Law of the Land" (as defined in SYSTEM_DOCTRINE.md), which keeps architectural debt low.

## 3. Biggest Risk: Quota Expiration & Silent Failure
The system's heavy reliance on three separate high-tier APIs (Google Cloud Vision, Perplexity, Claude) creates a multi-point failure risk. If any one of these hits a quota limit, the "Enrichment Conductor" will stall without a clear user-facing recovery path.

## 4. Highest Leverage: API Quota Dashboard
Implementing a simple dashboard to track API usage and quota status would significantly improve the reliability and observability of the research pipeline.

## 5. Action Board

### CRITICAL
- [ ] **Locking Mechanism Audit**: Ensure the `items.ts` locking logic is truly atomic to prevent two workers from ever grabbing the same item.
- [ ] **Error Visibility**: Implement more granular error states in the UI to distinguish between "Network Error," "API Quota Met," and "Processing Error."

### HIGH ROI
- [ ] **API Quota Dashboard**: Show real-time usage for Perplexity, Claude, and Google Vision.
- [ ] **Image Pruning**: Add automated logic to prune or compress `originalImagePath` files after processing to save disk space.

### STRUCTURAL
- [ ] **WAL Mode Optimization**: Verify and enforce SQLite WAL (Write-Ahead Logging) mode to prevent concurrency-related locks.
- [ ] **Analysis Log Cleanup**: Implement a policy for cleaning up or archiving old `analysis_history` entries to prevent database bloat.

### STRATEGIC
- [ ] **Batch Processing Mode**: Allow users to upload 100+ items and walk away, with a clear "Batch Complete" notification system.
- [ ] **Expert Model Registry**: Move the "Expert" logic into a modular configuration to support rapid expansion into new collectible categories.
