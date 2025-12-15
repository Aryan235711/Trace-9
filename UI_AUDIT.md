# UI audit (Interventions + Daily Log + Charts)

Date: 2025-12-14

## Findings and fixes

### 1) Interventions page: create action wasn’t awaitable
**Where**: `client/src/pages/History.tsx`, `client/src/hooks/useInterventions.ts`

**Symptoms**
- Creating an intervention could appear to “do nothing” / errors wouldn’t be caught reliably.

**Root cause**
- `useInterventions()` exposed `createIntervention` as `mutation.mutate` (void). The page was using `await createIntervention(...)`, which doesn’t actually await network completion.

**Fix**
- Added async mutation helpers: `createInterventionAsync`, `updateInterventionAsync`, `checkInInterventionAsync`.
- Updated `History.tsx` to use `createInterventionAsync(...)`.

### 2) Interventions page: “Log Outcome” buttons didn’t log an outcome
**Where**: `client/src/pages/History.tsx`

**Symptoms**
- “WORKED / UNCLEAR / FAILED” buttons navigated to `/dashboard` instead of saving the result.

**Fix**
- Wired buttons to `POST /api/interventions/:id/checkin` via `checkInInterventionAsync`.
- Added a simple gate: disable outcome buttons until `endDate` has passed (server requires this).

### 3) Daily Log: RHR/HRV inputs could get stuck (NaN)
**Where**: `client/src/pages/DailyLog.tsx`

**Symptoms**
- Clearing/editing number inputs could set state to `NaN`, causing the controlled input to behave incorrectly.

**Fix**
- On change, treat empty string as `0`, otherwise parse with `parseInt(..., 10)`.

### 4) Daily Log: save wasn’t awaitable
**Where**: `client/src/pages/DailyLog.tsx`, `client/src/hooks/useLogs.ts`

**Symptoms**
- Page could navigate away before the log was actually saved; errors wouldn’t be catchable in-page.

**Root cause**
- `useLogs()` exposed `createLog` as `mutation.mutate` (void). The page used `await createLog(...)`.

**Fix**
- Added async mutation helpers: `createLogAsync`, `updateLogAsync`, `deleteLogAsync`.
- Updated `DailyLog.tsx` to use `createLogAsync(...)` and disable submit while saving.

### 5) Charts: X-axis tick labels hard to read
**Where**: `client/src/pages/Dashboard.tsx`

**Fix**
- Rotated/slanted X-axis tick labels (`angle={-35}`, `textAnchor="end"`) and increased bottom chart margin to prevent clipping.

## How to verify
- Interventions:
  - Create a new intervention on `/history` and confirm toast + new active intervention card.
  - Once the intervention `endDate` is in the past, click WORKED / UNCLEAR / FAILED and confirm it completes and disappears from “Current Experiment” (active cleared) and appears in Past Logs.
- Daily Log:
  - Try clearing and retyping RHR/HRV; input should no longer lock up.
  - Submit; confirm toast appears and navigation happens after save.
- Dashboard:
  - Confirm X-axis date labels are angled and readable on mobile widths.

## Future improvements backlog
- Tracked in `UX_BACKLOG.md` (System Balance chart audit + proposed replacements, dashboard layout tweaks, and science/philosophy explainer ideas).
