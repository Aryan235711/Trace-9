# UI style audit (padding, borders, typography)

Date: 2025-12-14

Scope: **visual consistency** only (spacing, borders, radii, typography). No UX flow changes.

## Snapshot: current styling system
- Theme tokens exist in `client/src/index.css` (`--color-*`, `--font-sans`, `--font-mono`).
- Two reusable base utilities already exist:
  - `.mono-card` (card surface)
  - `.mono-input` (input surface)

## Findings

### 1) Card surfaces: same component type, different recipes
Observed patterns across pages:
- `bg-card border border-border/50 p-6 rounded-3xl shadow-sm`
- `bg-card/40 rounded-3xl border border-border/50 p-6 shadow-sm backdrop-blur-sm`
- `bg-card/30 rounded-3xl border border-border/50 p-6`
- Bottom nav uses `border border-white/10` + a hard-coded shadow

Impact:
- Inconsistent depth/contrast across screens; some cards look “heavier” or “frosted” while others read as flat.

Recommendation:
- Standardize to **two** card variants:
  - **Card / default**: `bg-card border border-border/50 rounded-3xl p-6 shadow-sm`
  - **Card / glass** (only when needed): `bg-card/40 border border-border/50 rounded-3xl p-6 backdrop-blur-sm shadow-sm`
- Update `.mono-card` to match the chosen default, then use it everywhere.

### 2) Border usage: token vs hard-coded colors
Observed:
- Mostly uses `border-border/50` (good).
- Some areas use `border-white/10` and raw grays (`text-gray-*`, `bg-gray-*`) (not theme-driven).

Impact:
- Breaks theme consistency and makes future theme tweaks harder.

Recommendation:
- Prefer `border-border/*` and `text-muted-foreground` / `bg-secondary/*` over raw grays.
- If a special border is needed (e.g., nav), create a named utility class (e.g., `.glass-nav`) instead of hard-coding.

### 3) Spacing scale: p-5 vs p-6 vs p-8
Observed:
- Most screens use `p-6` page padding.
- Some “cards” use `p-5`, skeletons `p-6`, and the disclaimer uses `p-8`.

Impact:
- Layout rhythm varies between screens; perceived “density” changes unexpectedly.

Recommendation:
- Standardize:
  - **Page gutters**: `p-6` (already common)
  - **Card padding**: `p-6` (primary), `p-4` (compact)
  - Avoid `p-5` unless there’s a strong reason.

### 4) Radius scale: rounded-2xl vs rounded-3xl vs rounded-xl
Observed:
- Cards are frequently `rounded-3xl`.
- Many interactive elements are `rounded-2xl`.
- Some are `rounded-xl`.

Impact:
- Not “wrong”, but the system is implicit rather than intentional.

Recommendation:
- Document a simple rule:
  - **Cards**: `rounded-3xl`
  - **Buttons / controls**: `rounded-2xl`
  - **Inputs / small chips**: `rounded-xl`

### 5) Typography: mixed casing, weights, and non-token colors
Observed:
- Good: consistent “label” style appears often: `text-xs font-bold uppercase tracking-wider text-muted-foreground`.
- Inconsistencies:
  - Some headings use raw white/gray colors.
  - Some labels use `text-[10px]` without a shared component.
  - Some pages mix `text-sm font-medium` and `text-xs font-medium` for similar subcopy.

Recommendation:
- Define 3 text roles and reuse them:
  - **Section label**: `text-xs font-bold uppercase tracking-wider text-muted-foreground`
  - **Body**: `text-sm text-muted-foreground leading-snug`
  - **Micro/meta**: `text-[10px] font-mono text-muted-foreground`
- Replace raw `text-gray-*` with tokenized equivalents.

### 6) Shadows: inconsistent and sometimes hard-coded
Observed:
- `shadow-sm` is common.
- Some components use hard-coded shadows (e.g. bottom nav, onboarding disclaimer).

Recommendation:
- Prefer `shadow-sm` / `shadow-lg` consistently.
- If a special shadow is needed, centralize into a utility class in `index.css`.

## Concrete quick wins (low-risk)
1) Replace raw `text-gray-*` / `bg-gray-*` in app pages with token equivalents.
2) Convert repeated card wrappers to `.mono-card` (and update `.mono-card` to match the primary recipe you want).
3) Introduce small reusable helpers (optional):
   - `CardShell` component or just shared class constants in pages.

## Notes on current code hotspots
- `client/src/pages/Dashboard.tsx`: uses multiple card recipes (`bg-card/40`, `bg-card`, `bg-card/30`).
- `client/src/pages/DailyLog.tsx` and `client/src/pages/History.tsx`: mostly consistent `bg-card border border-border/50 p-6 rounded-3xl`.
- `client/src/pages/Onboarding.tsx`: disclaimer screen uses raw grays + a special “marketing” look (may be intentional, but it’s visually a different system).
- `client/src/components/layout/AppLayout.tsx`: bottom nav uses `border-white/10` + hard-coded shadow.

## Proposed “design rules” (write once, follow everywhere)
- **Page padding**: `p-6` (mobile-first).
- **Card default**: `.mono-card` = `bg-card border border-border/50 rounded-3xl p-6 shadow-sm`.
- **Card glass (rare)**: `bg-card/40 border border-border/50 rounded-3xl p-6 backdrop-blur-sm shadow-sm`.
- **Inputs**: `.mono-input` (already exists) + consistent height (`py-4` or `h-12`).
- **Section headings**: `text-xs font-bold uppercase tracking-wider text-muted-foreground`.

