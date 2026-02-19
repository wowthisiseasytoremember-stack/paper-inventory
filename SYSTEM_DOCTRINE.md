# SYSTEM DOCTRINE: Master Engineering & Design Manifest

This document is the **single source of truth** for engineering standards, design philosophy, and operational excellence. It applies to all AI agents, IDEs, and engineers working on this system.

**Priority Order:**

1.  **System Integrity** (Security, Data Safety, Reliability)
2.  **User Outcome** (CUJ Completion, Clarity, Speed)
3.  **Aesthetics & Polish** (Visual Language, Delight, "Feel")

---

# SECTION 1: CORE SYSTEMS & RELIABILITY DOCTRINE

_Mandatory engineering constraints. These rules are non-negotiable._

## 1.1 Data Integrity & Storage

- **Database is Truth:** The database is the only source of truth. Client state is ephemeral.
- **Deletion Semantics:** Hard deletes are forbidden for business entities. Use `deleted_at` (soft delete) or moved to archive tables.
- **Disk Exhaustion:** Monitor disk space. Reject uploads < 5% free space. Ensure partial writes cannot corrupt the DB.
- **Ownership:** Explicitly define field ownership (User vs. System vs. AI). User edits always win.
- **Time:** Use monotonic clocks for durations. Use UTC server time for timestamps. Never trust client clocks.

## 1.2 Architecture & State

- **Async by Default:** Long-running tasks (>500ms) must run in background workers, detached from HTTP requests.
- **Backpressure:** Reject jobs immediately if queues are full. Do not fail silently or crash.
- **Crash Recovery:** Startup must clean up stale locks and reset "processing" states from prior crashes.
- **Idempotency:** All mutating endpoints (`POST`, `PATCH`, `PUT`) must support and enforce `Idempotency-Key`.
- **Drift Prevention:** CI must build from scratch. Lock all dependencies (Node, Python, System).

## 1.3 AI Integration Safety

- **Schema Enforcement:** AI outputs must be validated against a rigid JSON Schema before use. Fail safe if validation fails.
- **Prompt Governance:** Prompts are code. Version control them. Do not use inline strings for complex prompts.
- **Deterministic Config:** Explicitly set `temperature`, `top_p`, and `max_tokens`. Do not rely on defaults.
- **Audit Trail:** Store the _raw_ AI response and the _parsed_ result for debugging and tuning.
- **Cost & Limits:** Track token usage per request. Enforce hard caps per user/session.

## 1.4 Security & Privacy

- **Zero-Trust Secrets:** Secrets never reach the client. Secrets are never logged. CI scans for secrets on commit.
- **Input Hygiene:** Validate all inputs server-side. Reject unknown fields. Sanitize rich text.
- **Access Control:** Admin endpoints must be isolated or behind strict authentication.
- **Network:** Bind to `localhost` by default. Rate limit sensitive endpoints (login, upload, AI generation).

## 1.5 Observability

- **Structured Logging:** Logs must be JSON. Include `request_id`, `user_id`, and `duration_ms`.
- **Health Checks:** Endpoint must report connectivity to DB, Cache, and AI provider status.
- **Metrics:** Track Queue Depth, Job Failure Rate, and AI Latency (p95/p99).

---

# SECTION 2: UX PHILOSOPHY & INTERACTION DOCTRINE

_How the system behaves and communicates with the user._

## 2.1 Outcome-First Design

- **Goal > Implementation:** If a user requests X but Y is better/safer, suggest Y and explain why.
- **Critical User Journey (CUJ):** Every feature must define its Primary Outcome and Failure/Recovery paths.
- **Defaults:** Defaults must be safe and correct for 90% of users. Configuration is for the 10%.

## 2.2 Cognitive Load Management

- **Progressive Disclosure:** Hide advanced controls until requested.
- **Hierarchy:** Use spacing and typography to guide the eye. Avoid "dashboard clutter."
- **Decision Override:** If a user makes a suboptimal technical choice, the system must respectfully recommend the better path.

## 2.3 Feedback & Transparency

- **No Silent Failures:** Users must know: What is happening? What failed? How do I fix it?
- **Optimistic UI:** Use optimistic updates for trivial actions (like toggles/stars). Revert on failure.
- **Time Estimation:** For long tasks, show progress or "Estimated time: 2m".

## 2.4 Error Handling Standards

- **Actionable Errors:** Never say "Something went wrong." Say "The file was too large (Max 5MB)."
- **Recovery Paths:** Offer "Retry", "Edit & Retry", or "Contact Support".
- **No Raw Traces:** Never show stack traces to the user. Log them; show a friendly message.

## 2.5 Accessibility (Non-Negotiable)

- **Standards:** Target WCAG 2.1 AA compliance.
- **Input:** Full keyboard navigability (Tab, Enter, Esc, Arrows).
- **Visuals:** No reliance on color alone for state (use icons + text). Visible focus states are mandatory.

---

# SECTION 3: DESIGN LANGUAGE & VISUAL IDENTITY

_The specific aesthetic choices that define the system's "premium" feel._

## 3.1 Typography

- **Primary:** Inter, Manrope, or Satoshi. (Clean, legible, modern sans-serif).
- **Headings:** Tighter letter-spacing (approx -2%).
- **Body:** Relaxed line-height (1.5 - 1.6).
- **Weights:** Limit to 3 weights (e.g., Regular, Medium, Semibold).

## 3.2 Iconography

- **Set:** Choose **one**: Lucide, Tabler, or Phosphor. Do not mix sets.
- **Style:** Consistent stroke width (usually 1.5px or 2px).

## 3.3 Motion

- **Purpose:** Animate state changes (enter/exit), not decor.
- **Timing:** Fast and snappy (150ms - 300ms).
- **Easing:** Use standard ease-out curves. Avoid linear or bouncy animations unless intentional.

## 3.4 Color & Depth

- **Neutrals:** Avoid pure black (`#000`) and pure white (`#fff`). Use off-black and slightly tinted whites.
- **Shadows:** Soft, diffused, layered shadows. Avoid harsh, dark drop-shadows.
- **Borders:** Subtle 1px borders are preferred over heavy shadows for separation.

---

# SECTION 4: POLISH & DELIGHT ENGINEERING

_The "Rainy Sunday" improvements that create joy and perceived quality._

## 4.1 Data Presentation

- **Tables:** Sticky headers, sortable columns, and "comfortable/compact" density toggles.
- **Empty States:** Never "No items." Always: Illustration + Explanation + "Create New" button.
- **Search:** Highlight matches. Show count ("3 results"). Allow keyboard (`/`) focus.

## 4.2 Micro-Interactions

- **Copy to Clipboard:** Add near all IDs, keys, and code blocks. Show "Copied!" tooltip.
- **Drag & Drop:** Highlight the drop zone visually. Show file previews immediately.
- **Keybounds:** `Cmd+S` to save. `Esc` to close modals. `Cmd+K` for command palette.

## 4.3 Text & Tone

- **Microcopy:** Replace robot-speak ("Submit") with human verbs ("Save Profile", "Send Email").
- **Timestamps:** Use relative time ("2 mins ago") for recent events, absolute date for old ones.
- **Tooltips:** Explain _why_ a setting matters, not just what it is.

## 4.4 Continuous Refinement Protocol

- **Spacing:** Is the grid consistent? If it looks cramped, add whitespace.
- **Consistency:** Are buttons using the same radius? Are icons the same size?
- **Calmness:** Reduce "visual volume." Remove unnecessary borders, badges, and bright colors.
- **Dark Mode:** Ensure contrast is sufficient. Check that shadows are visible (or replaced by borders).
