# PLAN — Adopt ZIP3 unified prompt system into paper-inventory

**Status:** validated against real data, ready to stage behind a feature flag.
**Date:** 2026-08-17
**Author:** GCU No Trouble At All (orchestration); validation run on comic_vault DB + ZIP3/ZIP2 packs.

---

## 1. Decision

- **Adopt ZIP3 (`paper-inventory-prompts`) as the base unified prompt system.**
- **Overlay ZIP2 (`paper-inventory-unified`) `00_SYSTEM.md` evidence-class discipline** on top (5 evidence classes + banned-word list).
- **Retire the current parallel appraisal paths** in paper-inventory (conductor.ts inline prompt, expert.ts inline, valuator.ts archivist, perplexity-researcher, gemini-grounding) — replaced by the single staged pipeline below. Code left as-is until v2 verified; cutover behind a flag.

**Why ZIP3 over ZIP2:** ZIP3's 4-stage decomposition (conductor → decipher → research → brief → copy-agent contract) matches the handoff shape; ZIP2's 3-stage is functionally equivalent but its `00_SYSTEM.md` is stricter on evidence. Take ZIP3's structure, graft ZIP2's evidence rules.

---

## 2. Pipeline (target shape)

```
INGEST → OCR
  → conductor   (triage router: 1 category + basic_id, no appraisal)
  → decipher    (paleographer: transcription + extraction, evidence-tagged)
  → research    (per-category expert addendum + adapter → comps / value_band / connection_work)
  → brief       (CopyHandoffBrief: proven_facts / inferences / unknowns / do_not_claim)
  → COPY_AGENT  (separate listing/ads writer; forbidden to claim what the brief didn't source)
```

Valuation lives in **research + brief**, not the router. The router never appraises.

---

## 3. Validation performed (this session, real data)

### 3.1 Valuation / key / rare / important survive the redesign

| Book | Evidence | Verdict from v2 brief |
|---|---|---|
| **X-Factor #81** (DB row 621, Marvel Aug 1992) | Vision + OCR confirm **Newsstand Edition** (UPC `0 71486 02145 2`, Comics Code approved). Clean median $1.99 (DB) / $3.00 (reasoned, n=7). | `do_not_claim`: NOT a key issue / NOT rare / NOT important. Honest result — the book doesn't earn those claims, so they're *forbidden*, not *dropped*. |
| **Youngblood #1** (DB row 247, Image May 1992) | Debut issue. GCD verifies first appearances of Shaft, Badrock, Chapel, Die Hard, Vogue. Clean median ~$1.80 (filtered; a $72.99 outlier excluded). | Brief **allowed** to state the verified first appearances — same gating, opposite verdict. Proves the "allowed-to-say-key-when-verified" path works. |

Both packs ban `rare / very rare / one of a kind / museum quality / investment / authentic / original / signed by / historically important` unless an evidence class supports it (ZIP2 `00_SYSTEM.md` + ZIP3 `COPY_AGENT_CONTRACT`).

### 3.2 Railroad ephemera research path (the "what about non-comic" question)

- ZIP3 already ships **`research/experts/railroadiana.md`** built for exactly this. Rules:
  - comps found → `comps[]` populated.
  - comps thin → **mandatory grounding line**: *"Based on railroadiana historical averages for [doc type] / [era] / [road], not a matched sold listing."* — explicitly not a vibes dollar.
  - Connection work **mandatory** on named people (officer lists, local histories → confirmed / possible / rejected).
- comic_vault **already implements this pattern**: 26 railroadiana items, 23 with `estimated_value` ranges (e.g. 1916 D&RGW stock cert = $150–$250) from the backfill grounding pass. Same approach transfers.
- Non-comic categories → web-grounded estimate adapter. Comics → structured eBay comps. **Neither invents a number.**

---

## 4. Contamination audit (why the comic adapter reads `reasoned/`, not the DB column)

Compared DB `ebay_comp_clean_median` column vs `comps/reasoned/<series>|<issue>.json` across **566 matched comic rows**:

- **74 / 566 (13%) disagree.**
- **20 are material** (≥2× or ≥$2 difference).
- Examples: WildC.A.T.S #15 DB **$15.00** vs reasoned **$1.79**; X-Man #21 DB **$2.74** vs reasoned **$30.00**; The H.A.R.D. Corps #1 DB **$10.99** vs reasoned **$2.99**.

**Root cause:** the DB column is the **deprecated** "series-batch" / "price-all-v2" deterministic pipeline (contaminated medians — a single graded/signed/lot listing became the "median"). `reasoned/*.json` is the newer lot-filtered reasoning-LLM pass (the one comic_vault AGENTS.md says to trust).

**Conclusion:** the comic research adapter reads `comps/reasoned/*.json` (filtered truth) and **ignores the `ebay_comp_clean_median` column** for valuation. (Optional follow-up: backfill the column from `reasoned/` so it stops being a trap — separate task, not in scope here.)

---

## 5. Integration map (research adapter per category)

| Category | Research adapter | Feeds ZIP3 field |
|---|---|---|
| `comic_books` | `reason_comps.py` → `comps/reasoned/<series>|<issue>.json` | `comps[]` + `value_band` |
| `railroadiana` | web-grounded estimate (existing backfill / Gemini grounding) | `value_band` + grounding line + `connection_work` |
| other ephemera | same grounding pattern, per expert addendum | `value_band` + `data_quality` |

ZIP3 supports this natively via `data_quality` + per-category expert addenda. No redesign needed — just two research adapters.

---

## 6. Adoption steps (staged, behind feature flag — no overwrite of live path)

1. Create `~/Projects/paper-inventory/docs/prompts/unified-v2/` and drop in ZIP3 prompts: `conductor/ decipher/ research/ brief/ _shared/ experts/ schemas/ COPY_AGENT_CONTRACT.md`.
2. Overlay ZIP2 `00_SYSTEM.md` evidence-class rules into `research/` + `brief/` (observed / ocr_candidate / source_supported / inferred / unknown; banned-word list).
3. Add **comic research adapter**: reads `comps/reasoned/*.json`, maps to ZIP3 `comps[]` schema. Ignore DB column.
4. Add **railroadiana research adapter**: web-grounded estimate → `value_band` + grounding line + `connection_work`.
5. Port paper-inventory's existing 8 `expert/*.md` files into ZIP3 `experts/` (they are the live category knowledge — don't lose them).
6. Wire behind a **feature flag** (per ZIP2 README) so the live conductor/expert/valuator paths keep running until v2 is verified.
7. **Verify:** run v2 on (a) X-Factor #81 → expect `do_not_claim` key/rare; (b) Youngblood #1 → expect verified first-appearance allowance; (c) one railroad item → expect grounded range + `connection_work`.

---

## 7. Open decisions

- **[CONFIRMED — recommended]** Comic adapter reads `reasoned/*.json`, ignores DB column. Audit supports.
- **[OPTIONAL]** Backfill the DB `ebay_comp_clean_median` column from `reasoned/` so the deprecated column stops misleading. Separate task.
- **[PENDING]** Whether to also port ZIP2's stricter `00_SYSTEM.md` *sales-copy* rules verbatim or keep ZIP3's `COPY_AGENT_CONTRACT` wording. Recommend: ZIP2's banned list is the superset; use it.

---

## 8. Test evidence pointers

- X-Factor #81: `/home/ichabod/comic-vault/photos/2026-06/X-Factor-81_2a019169.jpg`; DB row 621; `comps/reasoned/xfactor%7C81.json`.
- Youngblood #1: DB row 247; `comps/reasoned/youngblood|1.json` (note: actual file match is `teamyoungblood|21.json` etc. — Youngblood #1 itself has no reasoned file; DB median $3.85 is contaminated by a $72.99 outlier, row 251 same book = $1.79).
- Railroad: DB rows 734–741 (D&RGW freight bills, stock certs, checks, telegrams).
- ZIP3 source: `~/Downloads/workspace-01a010a7-43c9-7757-a14e-89c1f8ba996f/paper-inventory-prompts/`
- ZIP2 source: `~/Downloads/workspace-01a010a4-bd14-7557-8893-96072ab39b20/paper-inventory-unified/`

*End of plan.*

---

# v2 — Post-MMR consensus changelog (2026-08-17)

**Runs:** goal-first script (5/6 panel, YELLOW) + exploration subagent (free-form). Cross-source convergence below is the highest-confidence signal.

## Cross-source convergences (script + exploration agree — ACT)

1. **Read `comps/reasoned/*.json` ONLY; never the DB `ebay_comp_clean_median` column.** Script flagged this as critical (2 models); exploration confirmed. The 74/566 contamination is real and the column is a live trap. → **Decision: comic adapter reads `reasoned/` exclusively.**
2. **Youngblood #1 is a PHANTOM validation anchor.** Script (high) + exploration (dedicated section): the book has *no* `reasoned/*.json` file, its DB median is contaminated by a $72.99 outlier, and the plan admitted this in a footnote. The "allowed-to-say-key" path is **currently untested with real data we hold** (famous keys UXM#266/NM#98/AF#15 aren't in the DB). → **Decision: drop Youngblood #1 from validation; either find a real key-with-reasoned-file or mark the allowed-path as UNVERIFIED.** Do not claim it passed.
3. **"Feature flag" is fiction without infra.** Script (high) + exploration: repo has no flag mechanism; `index.ts` routes one path. → **Decision: either a real `USE_UNIFIED_V2` env check in index.ts + new `src/lib/ai/v2/` module, OR fork to a standalone reviewer — see #6.**

## Exploration-only findings (high value, no script disagreement)

4. **This is a 4-stage ARCHITECTURE BUILD, not a prompt copy.** ZIP3 ships a runtime composer (`compose.ts`/`load.ts`) with validated JSON handoffs. The repo code calls one LLM for routing + one for appraisal — no decipher/research/brief stages, no CopyHandoffBrief. "Drop in prompts + feature flag" hides the build. → **Decision: add an explicit work item — new pipeline module calling `compose(stage)→execute→validate` per stage.**
5. **Storage model is undecided and load-bearing.** ZIP3 brief fields (`proven_facts`, `inferences`, `connections`, `do_not_claim`) aren't columns in `items`. → **Decision: sidecar JSON per item (`items/{id}.brief.json`) + same for `decipher.json`/`research.json`; items table stays flat; UI reads sidecar when present. Right call for solo use.**
6. **For a PAUSED repo, full migration may be wrong-sized.** Cheaper: standalone reviewer CLI (`compose→execute→write brief.md`) that pastes into `research_notes` — no worker, no schema, no cutover. → **Decision: PREFERRED PATH. Build the reviewer CLI first; decide repo-migration only if the CLI proves out. Removes the feature-flag problem entirely.**
7. **Two "adapters" are asymmetric.** Comic = deterministic JSON reader; railroad = LLM call (more LLM/item, opposite of goal). → **Decision: railroad research reuses the EXISTING `perplexity-researcher.ts` (sold-only + citations), not a new Gemini-grounded path. Plan mentioned Perplexity zero times — wrong.**
8. **Missing-`reasoned` behavior unspecified.** Most comics may lack a file (DB has more books than `reasoned/` covers). → **Decision: Phase 0 prerequisite — run `reason_comps.py` over all missing keys before any cutover. Adapter errors (does not silently fall back to the column).**
9. **`reasoned/` filename inconsistencies** (`xfactor%7C81.json` vs `youngblood|1.json` vs dupes) need a key-normalizer in the adapter. → **Add to comic adapter spec.**
10. **Knowledge loss on retirement.** The 8 `expert/*.md` are dealer-voice Buy/Pass; ZIP3 experts are research addenda — different jobs. OCR-vision guidance (newsstand barcode box) belongs in **DECIPHER**, not RESEARCH. Railroad named-officer premium must map explicitly to brief `connections[]` with confirmed/possible/rejected. → **Decision: explicit mapping step; don't collapse silently.**
11. **Rejected-connections trap.** Who inserts `rejected` rows? Must be the RESEARCH stage; brief propagates to `do_not_claim`. Plan's X-Factor `do_not_claim` examples implicitly rely on this. → **Make explicit in pipeline spec.**
12. **`load.ts` path resolution.** Pack currently sits in ephemeral Taildrop dir. → **Decision: vendor under `docs/prompts/unified-v2/prompts/` so the relative loader works; verify before commit.**
13. **Conductor already doesn't appraise** — plan's "retire valuation in conductor" framing misreads live code (appraisal is in expert path). Real bug: live conductor prompt references phantom `web_entities` the code never provides. Adopting ZIP3 incidentally fixes it. → **Note in cutover; delete the web_entities plumbing.**
14. **Reconcile with existing repo docs.** `~/Projects/paper-inventory` already has `MULTI_STAGE_AUDIT.md` and `AUDIT.md` describing a planned multi-stage pipeline. → **Decision: this v2 plan supersedes/references those; don't present as greenfield.**

## Downweighted (goal-first over-engineering bias — plan stated solo-operator constraint; models still pushed infra)

- "Replace custom prompts with LangChain/PromptLayer" — enterprise framing, wrong for one user. **Rejected.**
- "Delete all old appraisal code immediately" — reasonable to delete zombie `expert.ts`/`valuator.ts`/`gemini-triage.ts` as independent cleanup, but not coupled to v2.
- "Consolidate evidence rules into a JSON Schema referenced by both stages" — nice-to-have, not blocking; keep markdown overlay for now.
- "Add CI regression tests" — solo operator, no CI. Replace with a local 10-items-per-category smoke script.

## Revised open decisions (replaces §7)

- [CONFIRMED] Comic adapter reads `reasoned/*.json` only; key-normalizer; error on miss (no column fallback).
- [NEW-PHASE-0] Run `reason_comps.py` over all DB keys lacking a `reasoned/` file before any cutover.
- [DECIDED] Storage = sidecar JSON (`items/{id}.brief.json` etc.); items table unchanged.
- [DECIDED] Railroad research = reuse `perplexity-researcher.ts` (sold-only + citations).
- [PREFERRED] Build standalone reviewer CLI first; defer repo migration until CLI proves the shape.
- [UNVERIFIED] The "allowed-to-say-key" path has NO real validated example in our data yet — flag it, don't claim success.
- [ACTION] Vendor ZIP3 pack into repo; verify `load.ts` resolution; reconcile with `MULTI_STAGE_AUDIT.md`.

*Feedback applied from: MMR goal-first (5/6 panel) + exploration subagent, 2026-08-17. Exploration report: `EXPLORATION_FEEDBACK.md` (22.8 KB). Script report: `~/.hermes/reviews/2026-08-17_Adopt_ZIP3_Unified_Prompt_System_goal-first-mmr.md`.*
