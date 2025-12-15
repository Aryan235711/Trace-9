# UX + Product backlog (notes)

Date: 2025-12-14

This file captures UX/product improvements we agreed to defer for staged implementation.

## 1) Next explainability targets (prioritized)

1. **Daily Log: “why these inputs” micro-copy**
   - Add a short, consistent “How to read”/“Why we ask” explanation for: Sleep/HRV/RHR, Lifestyle toggles, Symptom score.
   - Keep it minimal (2–3 bullets per section) and avoid medical claims.
2. **Interventions: lock/paused rationale (make it explicit)**
   - When an experiment is active: explain why insights pause and what unlocks them.
   - When check-in is locked: explain the date-based unlock and what to do today.
3. **Tooltip/legend convention across charts**
   - Standardize what’s always shown (tooltip) vs optional (legend) and keep mobile uncluttered.
4. **Recovery Index transparency**
   - Add a 1–2 sentence definition + which inputs are used (Sleep/HRV/RHR vs baselines) wherever it appears.

---

## 2) Recovery Index vs Symptoms chart

### What it is today
- **Where**: `client/src/pages/Dashboard.tsx` (Composed chart labeled **Recovery Index vs Symptoms**)
- **How it's computed**: `client/src/components/charts/helpers.ts` → `computeRecoveryIndex(log, targets)`
- **Definition (current)**:
  - A 0–100 score built from **Sleep (higher better), HRV (higher better), RHR (lower better)** vs the user’s baselines.
  - Weighted and robust to missing values (computes from whichever wearable fields exist that day).

### Is it scientific / beneficial?
- As implemented, it’s a **simple heuristic** intended for trend-reading and correlation with symptoms.
- We should avoid implying clinical validity; the UI should frame it as “relative recovery signals” rather than diagnosis.

### Follow-ups
- Keep the chart minimal on mobile (tooltip + flip explanation; avoid always-on legends).
- Ensure baselines used are consistent with onboarding targets and server assumptions.

---

## 3) Shipped UX improvements (for reference)

- Dashboard: “Today’s Metrics” placed above charts.
- Dashboard: tap-to-flip chart explanations.
- Dashboard: “System Balance” replaced by “Recovery Index vs Symptoms”.
- Heatmap: added flip-to-explain + icon parity.

---

## 4) Science / philosophy explainer (research-backed)

### Request
- A dedicated page or Dashboard section explaining:
  - the 7‑day baseline concept,
  - why hypothesis → intervention is used,
  - how to interpret charts,
  - research-backed facts.

### Notes / constraints
- Needs careful sourcing: we should not claim clinical validity without citations.
- Should include a clear disclaimer (already present in onboarding) and avoid medical claims.

### Implementation options
1. **Dedicated page** (new route)
   - A simple, scrollable page with sections and citations.
2. **Dashboard section**
   - Collapsible "Why this works" panel under the banner.

---

## 5) "Flip to view" interpretation

Status: shipped on Dashboard + Heatmap; remaining is to extend the pattern to Daily Log and Interventions.

### Request
- "Flip to view the scientific significance, how to read or what the chart is telling about the user."

### Implementation options (minimal)
- Add an **inline accordion** per chart (no new page):
  - Title: "How to read this"
  - 2–4 bullets: what’s plotted, what to look for, what a good/bad pattern means.

---

## 6) Additional UX improvements (from audit + discussion)

- **Actionability**: always show a single next action (e.g., "Complete Daily Log" / "Check in" / "Gathering baseline").
- **Empty/locked states**: explain *why* and what to do next.
- **Trust**: explain "why the app thinks this" (tie insight text back to last N days + flags).

