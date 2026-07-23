# Project X-Ray: PaperTrail Research Terminal (paper-inventory)

## 1. What This System Really Is
The 'PaperTrail Research Terminal' is a high-speed research engine designed to transform 'zero-knowledge' inventory (e.g., ephemera, vintage collectibles) into expert-appraised assets. It's a **Next.js**-based local application with a heavy-duty backend pipeline utilizing **SQLite (FTS5)** and a multi-stage AI orchestration layer (Google Vision -> Perplexity -> Claude).

## 2. Complexity Hotspots
- **Orchestration Layer**: `scheduler.ts` manages the complex multi-stage async transitions and error recovery for each item's lifecycle.
- **AI Conductor**: The pipeline (Conductor -> Researcher -> Valuator) involves highly specialized prompt engineering and schema-strict parsing to ensure high-fidelity data.
- **Search Performance**: Virtual FTS5 tables in SQLite provide high-speed local search, but require complex triggers to keep them in sync with the main items table.

## 3. Fragile Zones
- **Single-Threaded Throughput**: `MAX_CONCURRENT_JOBS = 1` is a severe bottleneck. Any stall in an AI call (e.g., a slow Perplexity search) halts all other background work.
- **API Sensitivity**: Heavy reliance on external APIs (Google Vision, Perplexity, Claude) means the entire system is at the mercy of network stability and API quotas.
- **SQLite Concurrency**: While "hardened," SQLite can face database locking issues if the web server and background worker both attempt heavy writes without WAL mode optimization.

## 4. Scalability Assessment
- **Local Storage**: Original images and processed assets are stored locally, which will rapidly consume disk space as the inventory grows.
- **Single User Focus**: Perfectly optimized for a single-user "terminal" experience, but the architecture would require significant changes (e.g., migration to PostgreSQL) for a multi-user cloud platform.

## 5. Refactor Priorities
1. **HIGHEST: Parallelize Processing**
   - **What**: Increase `MAX_CONCURRENT_JOBS` and implement more robust locking.
   - **Why**: Unblock the pipeline and allow for high-volume inventory intake.
2. **HIGH: Domain Plugin System**
   - **What**: Refactor the hardcoded expert stages into a plugin registry.
   - **Why**: Allow the terminal to easily expand into new domains (e.g., stamps, coins, comics) without bloating the core logic.
3. **MEDIUM: AI Versioning & Locking**
   - **What**: Implement a cleaner way to version fields so that human-intuition "locks" are never overwritten by subsequent AI re-evaluations.

## 6. Maturity Score: 7.5/10
- **Architecture Clarity**: 8 (Well-defined stages, rigid state machine).
- **Complexity Management**: 7 (Orchestration is complex but manageable).
- **Scalability Readiness**: 6.5 (Local bottlenecks exist).
