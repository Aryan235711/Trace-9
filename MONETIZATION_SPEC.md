# Monetization + Entitlements Spec (Trace-9)

Status: Draft (design-ready)
Owner: Product
Last updated: 2025-12-15

## 1) Goals (what this spec optimizes for)

- **Free feels useful**: users can build a daily habit without feeling “blocked”.
- **Premium feels obviously valuable**: unlocks clarity, proof, and acceleration (deeper insights, experiments, comparisons, exports).
- **No “data hostage”**: user data is always preserved; limits apply to access/analysis depth, not data deletion.
- **Simple pricing story**: one premium tier initially.

## 2) Pricing (initial)

- **Premium**: ₹199 / 3 months
  - Billing: recurring quarterly (auto-renew) OR non-renewing 3‑month pass (implementation choice).
  - Positioning: “Same as Netflix, but conscious investment in health.”

Notes:
- This spec defines entitlements independent of the payment provider (Razorpay/Play Store/App Store/Stripe). Payment integration is out of scope.

## 3) Product tiers and states

### 3.1 User tier

- `FREE`
- `PREMIUM`

### 3.2 Subscription state machine (server source of truth)

Even if the UI is simple, the backend should track these states to avoid edge-case bugs.

- `free`
- `premium_active` (paid + not expired)
- `premium_grace` (payment failed, short grace; still premium)
- `premium_expired` (no longer premium)

Recommended parameters:
- Grace period: 7 days
- Renewal window warnings: 7 days before expiry (in-app banner)

## 4) Definitions (important to avoid “feels tricked”)

### 4.1 “Daily log”
One day’s entry containing the 9 metrics (wearable + manual + symptom score/name) as per SoT.

### 4.2 “Insight”
An “insight” is a structured card generated from recent data and analysis.

Insight card fields (conceptual):
- `title` (plain language)
- `oneLiner` (what changed / what matters)
- `category` (sleep/recovery/nutrition/gut/symptoms/etc.)
- `confidence` (low/med/high or numeric)
- `evidenceSummary` (what data supports it)
- `recommendedNextStep` (what to try next)

**Free vs Premium rule:**
- Free users see `title` + `oneLiner` and a minimal “why it matters” sentence.
- Premium unlocks `confidence`, `evidenceSummary`, and `recommendedNextStep`.

This keeps free genuinely useful while premium is clearly deeper.

### 4.3 “Intervention”
An “intervention” is a user-defined 7-day experiment with a goal and a measurable outcome.

Intervention fields (conceptual):
- `name` (e.g., “Sun exposure daily”)
- `startDate`, `endDate`
- `goalMetric` (e.g., symptom score, sleep, HRV)
- `targetRule` (e.g., protein ≥ X)
- `status` (planned/active/completed)
- `result` (improved/no change/worse) + confidence


## 5) Entitlements matrix (launch)

Numbers below are chosen to maximize “habit formation” while reserving high-value analysis for premium.

### 5.1 Free tier (Habit Builder)

- Logging
  - Unlimited daily logging (all 9 metrics)
- Dashboard (Analytics)
  - Full access to the most recent **14 days** of basic trends
  - 1–2 simple charts only (e.g., symptom trend, sleep trend)
- Insights
  - **1 insight per week** (teaser insight card)
  - Insight explanation depth limited (see 4.2)
- Interventions
  - **1 intervention start per month**
  - **Max 1 active intervention at a time**
  - Limited results view (headline only; no comparisons/correlation)
- History
  - Full list of all past days is visible (a “locked history preview”)
  - Only last **14 days** are fully readable; older entries show summary/lock
- Export
  - Not available

### 5.2 Premium tier (₹199 / 3 months)

- Logging
  - Unlimited daily logging
- Dashboard (Analytics)
  - Full history range
  - Advanced charts (correlations, overlays, comparisons)
- Insights
  - Unlimited insights + insights archive
  - Full “why we think this” evidence and confidence
- Interventions
  - Unlimited intervention starts
  - Multiple active interventions allowed (recommend UI cap of 2 active to reduce confusion)
  - Full comparisons (before/after, baseline vs during, intervention vs control periods)
- History
  - Full access to all entries
- Export
  - CSV/PDF export enabled


## 6) Paywall rules by surface (UX + behavior)

The user should always understand:
- what is locked,
- why it’s locked,
- what they get if they upgrade,
- and that their data is safe.

### 6.1 Dashboard

Free:
- Show last 14 days fully.
- When user scrolls earlier:
  - Keep cards visible but blurred/locked.
  - Show a single inline upgrade card: “Unlock your full history + insights archive.”

Premium:
- No gating.

### 6.2 Insights feed

Free:
- Show the weekly insight card fully (title + one-liner).
- For additional insights, show locked cards with titles (optional) and blurred body.
- Tapping locked insight opens a compact paywall explanation.

Premium:
- Full access.

### 6.3 Interventions

Free:
- Allow creating an intervention at any time, but enforce:
  - if user already started 1 intervention in the current month → block “Start” and show paywall message.
  - if user already has 1 active intervention → block “Start” and show paywall message.
- Results:
  - show “Result: Improved / No change / Worse” only.
  - lock confidence, comparisons, and correlation views.

Premium:
- No gating.

### 6.4 Export

Free:
- Hide export CTA or show disabled with tooltip “Premium feature”.

Premium:
- Enable export.


## 7) Renewal / expiry behavior (critical for trust)

### 7.1 When premium expires

- Do NOT delete data.
- Tier becomes Free immediately.
- Access rules revert:
  - still allow unlimited logging
  - last 14 days readable
  - older history remains visible but locked
  - insights revert to 1/week
  - intervention limits apply

### 7.2 Grace period

If payment fails:
- Move to `premium_grace` for 7 days.
- Keep premium access during grace.
- Show a gentle banner: “Payment issue — update payment to keep premium.”

### 7.3 “Locked history preview” wording

Avoid phrasing that implies hostage-taking.
Recommended:
- “Your past data is محفوظ / saved. Upgrade to unlock full history and deeper insights.”


## 8) Upgrade messaging (copy that doesn’t overpromise)

### 8.1 Primary CTA paragraph (recommended)

“Stop spending ₹199 unconsciously on binge-watching. Invest the same ₹199 consciously in your health.

Log 9 metrics in under a minute a day. Trace uses scientifically weighted scoring and 3‑day pattern detection to highlight what’s changing in your recovery, sleep, and symptoms.

Then run 7‑day interventions like experiments—so you don’t guess, you prove what works for your body.

₹199 unlocks 3 months of full history, the full insights archive, unlimited interventions, comparisons, and exports. Your first breakthrough insight is just a few logs away.”

### 8.2 Short CTA (for buttons/banners)

- “Unlock 3 months for ₹199”
- “Unlock full insights + history”

### 8.3 Paywall microcopy by feature

- History lock: “Unlock your full history and insights archive.”
- Insight lock: “Unlock the evidence and recommended next step.”
- Intervention lock: “Unlock unlimited experiments and comparisons.”


## 9) Analytics events (what to track to validate the model)

Track these for conversion + retention analysis.

### 9.1 Core funnel

- `signup_completed`
- `onboarding_completed`
- `daily_log_created`
- `insight_viewed` (free vs premium; locked vs unlocked)
- `intervention_started`
- `intervention_completed`
- `paywall_viewed` (surface: history/insight/intervention/export)
- `upgrade_clicked` (surface)
- `purchase_started`
- `purchase_succeeded`
- `purchase_failed`
- `subscription_renewed`
- `subscription_expired`

### 9.2 Habit metrics

- Day-1 activation: created 1 log
- Day-7 retention: created logs on ≥4 distinct days
- “wow moment”: viewed first insight
- “proof moment”: completed first intervention


## 10) Implementation notes (engineering)

### 10.1 Where gating must happen

- **Server-enforced**: limits (intervention starts/month, insight frequency, export access)
- **Client-enforced**: UI affordances (disabled buttons, locked previews)

Reason: client-only gating is easy to bypass and will create inconsistent behavior.

### 10.2 Recommended entitlement checks (API)

Expose a single endpoint returning entitlements:
- `GET /api/billing/entitlements`
  - `{ tier, subscriptionState, limits: {...}, resetAt: ISODate }`

Or embed entitlements in `GET /api/auth/user`.

### 10.3 Time and timezone rules

- Monthly intervention cap resets based on **user local date**.
- Weekly insight cap resets based on **user local week** (Mon–Sun or rolling 7 days; pick one and document).

Recommendation:
- Rolling windows are easiest and fairest:
  - Insight: allow 1 insight per rolling 7 days.
  - Interventions: allow 1 start per rolling 30 days.


## 11) Edge cases + anti-frustration rules

- If a user upgrades, previously locked history should unlock immediately without “reprocessing” delays (or show a clear “unlocking…” state).
- If the user is offline:
  - allow logging
  - show “Premium status unavailable” but do not hard-block viewing last 14 days
- If user re-installs:
  - entitlements must restore from server (not local storage)


## 12) Future options (explicitly not in launch)

- Multi-tier subscriptions (Basic/Pro/Premium)
- In-app purchases (intervention packs, chart packs)
- B2B licensing
- Regional pricing by PPP
