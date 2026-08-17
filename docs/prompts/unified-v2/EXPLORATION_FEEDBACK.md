# Open-ended exploration feedback on the ZIP3 adoption plan

Read PLAN.md, the existing `src/lib/ai/*` machinery, the two downloaded packs (ZIP3 and ZIP2), the comic_vault reasoning pipeline, and the AGENTS.md doc-accuracy flags. Below is what the plan isn't surfacing — blind spots, risks, simpler alternatives, and assumptions that probably break. I'm not writing a checklist or a punch list; this is the surfacing.

---

## The plan treats the migration as a prompt swap. It is not.

The plan imports ZIP3's prompts and overlays ZIP2's `00_SYSTEM.md` rules. But ZIP3 isn't a pack of strings — it's a four-stage architecture where each stage's output is a **structured input to the next**, and the `LOAD → DECIPHER → RESEARCH → BRIEF → COPY_AGENT` chain is the value proposition. Drop the markdown into `docs/prompts/unified-v2/` and you have a folder, not a pipeline. The repo's actual code in `src/lib/ai/` is *not* structured to call four stages in sequence with JSON-validated handoffs. The conductor.ts today calls one LLM and gets a 2-field JSON; the live pipeline in `openai-manual.ts`/`anthropic-manual.ts` does routing + appraisal in two parallel-ish calls. There is no decipher stage, no research schema, no brief schema, no CopyHandoffBrief object. `Start worker` would happily run the live path entirely independent of `unified-v2/`.

ZIP3's `src/compose.ts` is a *runtime* prompt composer (reads files, fills `{{tokens}}`, emits a `(system, schema)` pair). The plan's adoption steps just say "drop in ZIP3 prompts" — no mention of the TypeScript composer, no schema wiring, no token substitution. If you actually want this to run, you need a new pipeline module that calls `compose(conductor)` → execute → validate → `compose(decipher)` → execute → validate → ... That's the architectural work. The plan papers over it with "wire behind a feature flag," which is a deployment story, not a build story.

Separately: ZIP3's `load.ts` reads from a `defaultPromptRoot()` filesystem path. That path is currently `~/Downloads/workspace-.../paper-inventory-prompts/` — an ephemeral Taildrop location. The plan doesn't say "move the pack into the repo" or "symlink it" or "vendor under `docs/prompts/unified-v2/prompts/` so the relative loader works." If `load.ts` resolves relative to the package, the Taildrop path is fine; if it resolves relative to CWD, the worker will silently fall back to defaults or fail when those Taildrop dirs are cleaned up. Worth verifying before commit.

---

## The "two research adapters" framing is a loaded-gun abstraction.

The plan says: "comic research adapter reads `reasoned/*.json`, maps to ZIP3 `comps[]` schema. Railroadiana adapter uses web-grounded estimate." That sounds tidy. Two adapters. Pluggable. But you're not actually creating two adapters — you're papering over a fundamental asymmetry:

- **Comic**: structured `comps/reasoned/{key}.json` already exists. It's a hand-curated, batch-LLM-filtered, key-anchored, machine-readable file that *gets the dollar value right*. The adapter is "read JSON, map to ZIP3 schema." Fine.
- **Railroadiana**: no equivalent file exists. The "adapter" is "call Gemini with a prompt, get text back, hope." You're calling an LLM to emit a value band from category norms, which is exactly what ZIP2's `00_SYSTEM.md` says *not* to do without proper evidence — "If evidence is sparse, give a low-confidence category-based range only when useful and label it exactly as such."

So the two adapters aren't symmetric. The comic adapter is a deterministic reader; the railroadiana adapter is *more LLM per item*, which is the opposite of what the staging was supposed to accomplish. The plan glosses this by saying "non-comic categories use web-grounded estimates" — but the actual eBay-comps pipeline (`reason_comps.py`) was *built for comics specifically* (it scrapes GoCollect/census/GCD-friendly identifiers). You can't just point it at a 1916 D&RGW stock certificate. The "grounding line when comps are thin" rule in ZIP3's `experts/railroadiana.md` is doing all the heavy lifting for non-comic items, and it's a *written rule*, not a structural guarantee. It only works if the researcher stage actually respects `data_quality: none` and labels both comps and value as such. The plan doesn't spec *how* the prompt enforces that. It just trusts it.

What I'd actually consider: the two adapters aren't really peers. One is a comp reader with a thin mapper. The other is a "grounded estimate" call that uses the LLM as the actual research engine. If you want the same conceptual guarantees (no invented prices; sold-only with URLs; labeled category norms), the railroadiana path needs to be *as deterministic* as the comic one — meaning, at minimum, a Perplexity ground-search call that returns actual comps, and a fallback that prints "no sold listings found" instead of inventing a band. The plan mentions "Perplexity" zero times. The live `perplexity-researcher.ts` already has the right shape (8-category prompts, sold-listings-only rule, citations). Why isn't it the research back-end instead of adding a new Gemini-grounded path?

---

## The contamination audit is clean, but it undercounts the breakage surface.

You compared 566 DB rows against `reasoned/*.json` and found 74 disagree (13%). That's the contamination column. Fine. But there's a second, smaller contamination: the **`Youngblood #1` row itself has no reasoned file**. The plan notes this in passing ("actual file match is `teamyoungblood|21.json` etc. — Youngblood #1 itself has no reasoned file; DB median $3.85 is contaminated by a $72.99 outlier"). The plan treats this as a footnote; it isn't. It's a representative gap: the DB has *more* books than `reasoned/` covers. The adapter "reads `reasoned/*.json`, ignores the DB column" — but what does it do when the file doesn't exist? The plan doesn't say. If it falls back to the DB column for misses, you've just refactored the contamination path (most rows will hit the fallback, special-casing only the 566 that have reasoned files). If it returns "no comps found," you've now got a large fraction of comics with empty value_band, which is *correct* but operationally bad — the rail export shows blanks.

The honest answer is probably: keep the comic adapter strict (read reasoned only), and accept that un-reasoned books need a one-shot run of `reason_comps.py` over the missing keys before the feature flag flips. The plan doesn't list that as a prerequisite. It should.

Also: `reasoned/` has file-naming inconsistencies (`xfactor%7C81.json` vs `youngblood|1.json` vs `wildcats_trilogy_1.json` and `wildc_a_t_s_trilogy_1.json` for what appear to be the same book). The adapter needs a key-normalizer. The plan doesn't mention this.

---

## The plan retires "parallel appraisal paths" but loses half the prompt knowledge in the process.

Step 5: "Port paper-inventory's existing 8 `expert/*.md` files into ZIP3 `experts/`." Good. But:

- The existing 8 `experts/*.md` files are *dealer-voice Buy/Pass* prompts. ZIP3's `experts/*.md` are *research addenda* (search guidance, value signals, connection work rules). These are different documents with different jobs. Compressing a 1.8–2.2 KB Buy/Pass cheat sheet into a research addendum loses the search keywords, comp search phrases, and target buy price advice. The "Cheat Sheet" content in `COMIC_BOOK_EXPERT.md` ("Newsstand vs Direct barcode box → UPC price vs Direct character box") is *exactly the kind of OCR-vision guidance that belongs in DECIPHER, not RESEARCH*. The shopper's-eye view (where does this fit in the market?) is what ZIP3's brief stage is for. The plan's transition collapses two roles into one file and quietly throws away the buy/pass framing — which is fine, but it should be a *choice*, not a side effect.
- `valuator.ts` has a `RAILROAD_DOMAIN_PROMPT` constant (12 lines) that the plan's MIGRATION.md maps to "Dropped." But that prompt is the only place where the railroad-historian domain specialization lives. The current plan says "railroadiana adapter uses web-grounded estimate" — but *what* railroad-historian knowledge survives? The ZIP3 `research/experts/railroadiana.md` has the D&RGW value signals (employee vs public, 1880s-1910s premium band, Colorado/Utah mountain towns, named-officer premium) — which is the same content, repackaged. Fine. But step 5 doesn't say "specifically port the railroad expert's named-officer premium logic into the brief's `connections[]` schema with confirmed/possible/rejected status." ZIP3's `connections[]` is the *only* structured place that survives the named-signature logic, and the plan doesn't connect the dots.

The plan is telling you "retire X, Y, Z" but not telling you "preserve A, B, C from each." You decide it's a top-down priority; in practice the 8 cheat sheets have dense, earned domain knowledge that compresses badly.

---

## The "feature flag" is not a feature flag.

Step 6: "Wire behind a feature flag (per ZIP2 README) so the live conductor/expert/valuator paths keep running until v2 is verified." The repo has no feature-flag infrastructure. There's no flag file, no env var loader distinguishing v2 from v1, no toggleable code path. The `index.ts` AI dispatcher picks the active provider via `getAIConfig()` and routes everything through that one path. "Behind a feature flag" in this context means: write a new entry point (e.g., `index.ts → analyzeImage(...)` checks an env var `USE_UNIFIED_V2`, if true calls the new pipeline module, if false calls the old one). That's a 30-line refactor of `index.ts` and a new module. The plan says "wire" like it's a config flip. It isn't.

Also: "verify v2 is verified" — verified against what? The plan's section 3 walks through *two* ground-truth examples (X-Factor #81, Youngblood #1) and one railroad item. That's three items. To actually trust the new pipeline, you need to run it on (a) every item in the existing paper-inventory DB, (b) the contamination-flagged 74 rows, and (c) at least one item per category. Otherwise the cutover is aspirational. The plan says "verify by running v2 on X-Factor #81 → ... → Youngblood #1 → ... → one railroad item → ..." — three items qualify a 4-stage LLM pipeline for production. The plan was scoped against the ZIP3 pack's own MIGRATION.md example, which is a single receipt. Be aware that the example proves the *shape* of the pipeline works, not that any of your backlog items survive intact.

---

## "Conductor does not appraise" is correct, but the live conductor already does.

The plan says "Valuation lives in research + brief, not the router. The router never appraises." Then quotes the existing pipeline as the parallel path being retired. But the existing `conductor.ts` *also* does not appraise — it returns `{category, confidence_score, basic_id}`. Good. The "appraise" is in `appraiseItemAnthropic` / `Gemini` which is the *expert* path, not the conductor. So the plan's claim that the old pipeline has a "valuation-in-conductor" problem is a misread. What it actually has is **routing + appraisal + research + valuation all in two calls**, with appraisal and valuation in two different modules. The retargeting is: split routing (1 call) → decipher (1 call) → research (1 call) → brief (1 call), and *don't pull valuation forward into brief or earlier*. The plan gets this right in section 2 but the framing in section 1 ("retire valuation in conductor") reinforces a confusion that doesn't exist.

The real risk in the live path is something else: the live `conductor.ts` prompt tells the model to "PRIORITIZE EVIDENCE: Use the 'Web Entities' section (Google Knowledge Graph) as your primary anchor for truth." But the live code path *does not provide web entities* to the conductor — only OCR text + image. That's a phantom instruction. The plan doesn't flag this. ZIP3's conductor is more honest: it says "If OCR and image conflict, trust the image and say so in `rationale`." If you adopt ZIP3's conductor verbatim, you incidentally fix the phantom-web-entities bug. Worth noting because it means the v2 conductor should literally *not* include the old `web_entities` token at all, and the live code's `process.env` plumbing that pretends to fetch web entities should be deleted.

---

## Schema drift between ZIP3 and what the DB stores.

The Zod `ItemMetadata` schema in `src/lib/ai/schema.ts` has `identifiedNames: z.array(z.object({name, type, confidence}))`. The items table has `identifiedNames?: string` (JSON-encoded). The ZIP3 `decipher` schema output is structured JSON with names, places, dates, etc. The brief schema has `proven_facts[]`, `inferences[]`, `unknowns[]`, `connections[]` (with subject/why_it_matters/status/source). The live items table has `tags` (JSON), `historicalContext`, `collectorSignificance`, `valuation`, `ebay_keywords`, `estimated_value_low/high/point`, `value_confidence`, `is_high_value`, `research_notes`. There is no schema-or-storage mismatch in the plan. The plan basically says "throw the new pipeline output away" unless we figure out storage.

This is actually a third migration hidden inside the prompt migration:
- ZIP3's brief has `proven_facts[]`, `inferences[]`, `unknowns[]`, `connections[]`, `story_hooks[]`, `who_buys_this[]`, `do_not_claim[]`, `brief_confidence`, `market_signals`. None of these are columns in `items`. The plan's "wire behind a feature flag" doesn't say *where v2's output goes*.
- The most honest answer: v2 output is a *sidecar file* (e.g., `items/{id}.brief.json` next to the image), and the items table keeps its current flat structure. Briefs are read by the UI when present, ignored otherwise. But this is a design choice the plan skips.
- Alternatives: denormalize the brief into the items table (lots of new columns — overkill for solo use); stuff the whole brief into `research_notes` (lossy — collapses structured data into a wall of text); add a `briefs` table (single user, single SQLite, fine, but the plan doesn't say so). Probably the sidecar file is right for this user, but the plan doesn't decide.

The same applies to `decipher.json` and `research.json` — they're stage outputs that need to live somewhere for re-runs and debugging. The plan implicitly assumes you re-run them from the image every time, which is expensive (Perplexity or Gemini-grounded calls per item). If you're storing structured scratch, you can re-run only the downstream stages. ZIP3's `examples/1892-railroad-receipt.brief.md` is a markdown rendering of brief JSON, implying the JSON is the canonical artifact. Where it lives is your call.

---

## The plan ignores the running worker.

`scripts/start-worker.ts` calls `startProcessingLoop()`. The scheduler picks up queued items, processes them, and writes back to the DB. The worker loop runs whether the UI is open or not. If you flip the feature flag and the new pipeline takes 4 LLM calls per item instead of 2, every queued item suddenly costs 2x. For a solo operator this is fine, but the plan assumes you can swap the prompt and the worker will Just Work. The worker is bound to the existing `index.ts` API.

A real cutover probably looks like: clear the queue (or let it drain), flip the flag, restart the worker, reprocess. The plan sections 1–7 don't acknowledge the operational impact. The current DB has items in various states (`processing_ai`, `error`, `complete`, `queued`). Each state has different recovery semantics. You don't want to be in the middle of a bulk ingest when the new pipeline comes online.

---

## The rejected-connections trap is a real correctness risk.

ZIP3's `COPY_AGENT_CONTRACT.md` says: "`rejected` is a trap — never use." The `grounding.md` `_shared/grounding.md` says: "A name on the paper plus a famous person with the same surname is not a connection. You need role, date overlap, place overlap, or a cited source." The brief schema has `connections[]` with `status: confirmed | possible | rejected`. The plan's railroadiana example uses the D&RGW Historical Society + officer lists. The existing `RAILROAD_EXPERT.md` does *not* enumerate the "rejected" row — it only says "ONCE EXTRACTED, CROSS-REFERENCE THESE NAMES WITH YOUR HISTORICAL KNOWLEDGE." The plan doesn't say which stage inserts the `rejected` rows. The brief stage has to, because the connection work is the research stage's job. Or does the research stage? The research schema's `connections[]` has the same `confirmed | possible | rejected` enum. So presumably the research stage does it, and the brief stage trusts it. The plan doesn't say. If the research stage skips rejected rows (because they're "ruined connections"), the brief inherits the loss. The plan's section 3 X-Factor example throws `do_not_claim: "NOT a key issue / NOT rare / NOT important"` — these are rejection claims. They have to come from somewhere. The brief isn't invented-rejection-statement; the research stage has to surface "this looks like X famous issue but is not" as a rejected connection row, and the brief propagates it into `do_not_claim`. The plan's instrumentation for this is implicit. Worth making explicit.

---

## Simpler alternative: don't migrate the existing repo. Or migrate only the rail.

A. The plan is a meaningful refactor with feature-flag plumbing, schema storage decisions, and a worker cutover. Given the repo is paused and the new pipeline is currently unproven at your scale, a more honest alternative is: **don't migrate paper-inventory at all**. Use ZIP3 in a new, standalone reviewer — a tool that takes an image, runs the four stages, and writes a brief.md you paste into the existing paper-inventory item's `research_notes` field. The MVP is a CLI that runs `compose() → execute → write`. No worker changes, no DB schema, no flag, no cutover. Run on items as you need them. The cost of the full repo migration is much higher than the value if paper-inventory is paused.

B. The minimum-viable v2 import: only ZIP3's `research/experts/railroadiana.md` and the `comps/reasoned/*.json` reader. Skip the conductor and decipher and brief refactor. The current live pipeline's appraisal prompts work fine for non-comic categories; the rail-specific domain knowledge is the actual gap. Replacing the entire prompt architecture to capture one expert addendum is overkill.

C. A third option: don't migrate; sync the `experts/*.md` content from paper-inventory into ZIP3's addenda and use ZIP3 in a sibling project (a "reviewer" CLI), letting paper-inventory remain frozen. This is the option that preserves the value of the prompt work without forcing the repo to wake up.

The plan's framing ("stage behind a feature flag, no overwrite of live path") is what a well-resourced team would do for a 4-stage prompt refactor of a deferred project. The cost-benefit for a solo operator with a paused repo is rough. Worth weighing.

---

## Things the plan takes for granted that probably aren't true.

- **"ZIP3's 4-stage decomposition matches the handoff shape."** The handoff shape *for what*? The handoff shape for the live worker is `(image, ocr) → (category, title, valuation, valuation_low, valuation_high, ...)`. ZIP3's handoff shape is `(image, ocr) → (CopyHandoffBrief)`. These are different artifacts. The plan assumes you can map between them; that mapping is design work.
- **"ZIP2's `00_SYSTEM.md` is stricter on evidence."** It's stricter *and* more verbose. Conjoining `_shared/grounding.md` (ZIP3's version) with `00_SYSTEM.md` (ZIP2's version) without dedup is going to bloat the system prompt. For a router that just needs to pick a category, that's wasted tokens. For the researcher that does need grounding, fine. The plan's "overlay" is a sentence, not a token budget.
- **"Retire the current parallel appraisal paths."** Three of them. But the existing pipeline *isn't* doing parallel appraisals — it's using one path (`appraiseItemAnthropic` reads the category expert markdown) and the other two paths are zombies. The plan's "retire" is heavier than the code reality. Maybe just delete `expert.ts` and `valuator.ts` instead of constructing a v2 to replace them.
- **"ZIP3 supports [research adapter] natively via `data_quality` + per-category expert addenda."** ZIP3 supports output of `data_quality` and per-category addenda. Calling this "native adapter support" hides the fact that the *adapter* (the bridge between the local data and the prompt context) is your job to write. The plan calls this "two research adapters" — those are TS classes/files, not pack features.
- **"The plan is validated against real data."** It's validated against 3 items: 2 comics and 1 railroadiana mention. The plan calls this "real-data validation done." 3 items is an anecdote, not a validation. The contamination audit (566 rows, 74 disagreements) is real validation. The 3-item walkthrough is not. Conflating these is the doc-accuracy trap the AGENTS.md already warns about (the "phantom heuristic router" call-out). The plan itself is doing the same thing in a softer form: "validated" implies coverage, "spot-checked" implies 3 items.

---

## What I'd actually do, if it's useful.

1. Decide the storage model for stage outputs (sidecar JSON files per item, separate from the items table) before anything else. This is the load-bearing decision.
2. Verify the ZIP3 load.ts path resolution against the Taildrop workspace path before committing. If it's relative, vendor the pack under `docs/prompts/unified-v2/prompts/`.
3. Run the 4-stage pipeline on 10 items per category (comics, railroadiana, plus 3 others) before the cutover. Use the 3 examples in the plan as the *first* batch, not the only one.
4. For the comic adapter, define behavior on missing `reasoned/*.json` (skip, error, fall back to DB column, queue for `reason_comps.py`). My preference: error → re-run reason_comps pipeline → retry. But the plan needs to commit.
5. For the railroadiana adapter, consider routing through the existing `perplexity-researcher.ts` rather than new Gemini-grounded calls. The plan inherits the existing asset without writing a new one.
6. Don't build a feature flag. Either fork the pipeline (new `src/lib/ai/v2/`) or don't. A flag with no flag infrastructure is a fiction.
7. The "retire parallel appraisal paths" cleanup is independent of the prompt migration and can ship first — just delete `expert.ts`, `valuator.ts`, `researcher.ts`, `gemini-triage.ts`, and the dormant `openai*.ts`. The repo will be cleaner without those zombies regardless of which v2 wins.

---

*End of feedback. Reviewed against PLAN.md, the live `src/lib/ai/*` source, the ZIP3 and ZIP2 packs under `~/Downloads/workspace-*/`, and the comic_vault reasoning pipeline. Findings reflect the repo as it stands on 2026-08-17.*
