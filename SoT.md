🚀 Trace-9 Ultimate Product Specification (V5 - Definitive & Design-Ready)

This document serves as the single source of truth, consolidating all product requirements, quantitative logic, UX mitigations, and backend orchestration flows developed for the Trace-9 application, including the finalized aesthetic mandate.

---

## Dev Changelog (recent)

- **In-app notifications:** Added a bell-based notification center (local-only) plus standardized toast notifications via `client/src/hooks/useNotifications.ts`.
- **Intervention timing UX:** Switched intervention countdown/unlock messaging to calendar-day logic to avoid confusing “7 days remaining” edge cases.
- **Test/CI stability:** `npm test` now runs in-band and excludes the heavy performance load suite; added `test:fast` (parallel), `test:perf` (perf suite), and `test:ci` (in-band + `--detectOpenHandles`, excluding perf). CI runs `npm ci`, `npm test`, and `npm run build`.
- **Profile + greeting:** Added a minimal header greeting (“Hello, {first-name}”) and a user avatar menu with logout.
- **Cleaner logs:** Performance suite logs are gated by `PERF_LOGGER_STDOUT=1`; API response-body logging is opt-in via `LOG_API_RESPONSE_BODY=1`.
- **Monetization spec:** Added a detailed freemium/premium entitlements spec at [MONETIZATION_SPEC.md](MONETIZATION_SPEC.md) (₹199/3 months, limits, paywalls, renewal, and analytics events).

## Monetization Plan of Record (summary)

- Pricing: ₹199 / 3 months (quarterly), single premium tier.
- Free (habit builder): unlimited logging, last 14 days readable, 1 insight/week (headline depth), 1 intervention start/month, 1 active at a time, no exports; older history shown but locked.
- Premium: full history + insights archive, full explanations, unlimited interventions with comparisons, advanced charts, exports.
- Expiry: premium downgrades to free rules; data is never deleted; 7-day grace on payment failure.
- Full details and copy/CTA variants live in [MONETIZATION_SPEC.md](MONETIZATION_SPEC.md).

I. Product Vision, Goals, and Legal Mandate

A. Product Vision and Core Goals

Vision: To empower users with a highly accessible, trend-based self-diagnostic tool that correlates personal wearable data with manual inputs to identify lifestyle triggers for common symptoms (e.g., fatigue, pain, poor focus).

Core Goal: Achieve 70-85% diagnostic confidence for personal lifestyle patterns through the 3-Day Trend Rule and visual clustering.

Target User: Health-conscious individuals using wearable technology who seek to optimize personal performance and identify specific lifestyle-symptom triggers through self-experimentation.

B. Mandatory Disclaimer (Legal and Ethical Requirement)

The following disclaimer must be presented to the user on the very first screen of the application, and their digital acceptance is required before proceeding to the Goal Setting phase (See Section III.B).

"Trace-9 provides highly personalized data analysis and self-experimentation hypotheses based on your inputs. The insights and suggested interventions from this application are NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare provider with any questions you may have regarding a medical condition."

II. Core Metrics, Baselines, and Universal Flagging Logic

The application tracks 7 core health metrics and 2 manual behavioral metrics, plus 1 symptom score. The entire logic hinges on the Deviation Calculation, which determines the Universal Flagging State ($\text{GREEN, YELLOW, RED}$).

A. The 9 Core Metrics & Data Source

Metric

Type

Unit

Baseline Source

1. Sleep Duration

Wearable

hours:minutes

7-day personal average ($\text{Base}_{\text{Metric}}$)

2. Resting Heart Rate (RHR)

Wearable

BPM

7-day personal average ($\text{Base}_{\text{Metric}}$)

3. Heart Rate Variability (HRV)

Wearable

ms

7-day personal average ($\text{Base}_{\text{Metric}}$)

4. Protein Intake

Manual

grams (g)

User-set Target Goal ($\text{Target}_{\text{Metric}}$)

5. Gut Score

Manual

Slider 1-5

User-set Target Goal ($\text{Target}_{\text{Metric}}$)

6. Sun Exposure

Manual

Toggle

User-set Target Goal ($\text{Target}_{\text{Metric}}$)

7. Exercise Intensity

Manual

Toggle

User-set Target Goal ($\text{Target}_{\text{Metric}}$)

8. Symptom Score

Manual (Input)

Slider 1-5

N/A (Diagnostic Input Only)

9. Symptom Naming

Manual (Optional Text)

String

N/A (Personalization Input Only)

B. Deviation Calculation (The Universal Flagging System)

The app assigns one of three colors (the Processed Metric State) based on the metric's performance relative to the $\text{Base}_{\text{Metric}}$ (Wearables) or the User's Target ($\text{Target}_{\text{Metric}}$) (Manuals).

$$\text{Flag}_{\text{Metric}} = \begin{cases} \text{GREEN} & \text{if } \text{Metric} \ge \text{Base}/\text{Target} \times 0.9 \\ \text{YELLOW} & \text{if } \text{Base}/\text{Target} \times 0.8 \le \text{Metric} < \text{Base}/\text{Target} \times 0.9 \\ \text{RED} & \text{if } \text{Metric} < \text{Base}/\text{Target} \times 0.8 \end{cases}$$

C. Quantitative Definitions and Mapping for Manual Metrics

Metric

Input Field

Raw Value to Flag Logic

Numerical Mapping for Clustering

Protein (g)

Input $\text{g}$

Compared against $\text{Target}_{\text{Protein}}$ using the universal formula.

Raw gram value.

Gut Score

Slider $1-5$ (5=Perfect)

$\text{RED}: \le 2$; $\text{YELLOW}: 3$; $\text{GREEN}: \ge 4$.

Ordinal score (1-5).

Sun Exposure

Toggle: Yes/No/Partial

$\text{RED}: \text{No Exposure}$; $\text{YELLOW}: \text{Partial}$; $\text{GREEN}: \text{Yes (Full)}$.

Ordinal score (1=No, 3=Partial, 5=Yes).

Exercise

Toggle: Hard/Medium/Light/None

$\text{RED}: \text{None}$; $\text{YELLOW}: \text{Light/Medium}$; $\text{GREEN}: \text{Hard}$.

Ordinal score (1=None, 2=Light, 4=Medium, 5=Hard).

Symptom Score

Slider $1-5$ (5=Severe)

N/A (Used as a condition for clustering).

Ordinal score (1-5).

III. Product Features and User Flow (MVP)

A. Global Navigation Structure (Mandatory 3-Component Layout)

The primary navigation will consist of a simple, fixed bottom bar with three components:

Home / Dashboard (Left): Displays Feature 3 (The Analytics Page) and the active Cluster/Intervention Banner.

Centered (+) Button (Middle): Shortcut to Feature 2 (The Daily Log Input Screen). This is the primary user action.

History (Right): Displays Feature 4 (The Intervention Log) and all past daily entries.

B. Feature 1: Onboarding & Baseline Setup

Step

Component

Logic/Status

1. Mandatory Disclaimer

Full-screen overlay

User must accept the disclaimer (Section I.B) before any data logging.

2. Goal Setting

Input fields

User sets $\text{Target}_{\text{Metric}}$ for Manual Metrics.

3. 7-Day Baseline (Provisional Mode)

Background task

For 7 days, the app uses Generic Population Averages ($\text{RHR}=65, \text{HRV}=50, \text{Sleep}=7.5\text{h}$) for flagging.

4. Baseline Completion (Day 8)

State change

The app switches all Wearable Metric flags to the user's personalized 7-day $\text{Base}_{\text{Metric}}$.

C. Feature 2: The Daily Log (Input Screen)

This screen is accessed via the Centered (+) Button and facilitates data entry.

Component

Description

Wearable Inputs

Manual fields for Sleep Duration, RHR, and HRV.

Manual Metric Inputs

Fields for Protein, Gut Score, Sun Exposure, and Exercise.

Symptom Score

Slider 1 (Best) to 5 (Worst).

Symptom Naming Field (UX Enhancement)

Optional text input: "What was your main symptom today? (e.g., Brain Fog)". This is used to personalize the Hypothesis Engine (Section V.B).

D. Feature 3: The Analytics Page (Dashboard)

The user's central hub for insights.

Component

Display Logic

Alert Banner

Driven by the Orchestration Lock (Section VII.A) and Pivot 3 (Section V.A).

Banner State 1 (Provisional)

"Gathering Data. Insights are provisional based on population averages." (Days 1-7)

Banner State 2 (Intervention Locked)

"Intervention in Progress: Testing 

$$Hypothesis Name$$

. Check back on 

$$End Date$$

."** (If activeInterventionId is not null)

Banner State 3 (Action Required)

Displays the Trace-9 Auto-Hypothesis based on Mode 1, 2, or 3.

Traceback Heatmap

Color-Coded 14-Day Matrix showing the processedState (RED/YELLOW/GREEN) for all 9 metrics.

E. Feature 4: The Intervention Log (Feedback Loop)

Component

Description

Hypothesis Screen

User inputs their specific, measurable intervention goal (The Fix) for a 7-day test period. This action immediately sets the activeInterventionId lock.

7-Day Check-in

A simple prompt at the end of the test period recording the user's feedback on Symptom Score improvement ($\text{Yes/No/Partial}$). This action clears the activeInterventionId lock.

IV. UI/UX Design Mandate and Aesthetic

A. Core Aesthetic Theme

The application must adopt a Monochromatic, High-Contrast Black, White, and Gray theme. This design choice is mandatory to ensure visual clarity, maximize data focus, and provide a serious, analytical aesthetic.

Primary Backgrounds: Deep Black or Dark Charcoal Gray.

Primary Text/Data: Pure White or Bright Gray (for secondary elements).

Secondary Borders/Separators: Light Gray or Off-White.

B. Accent Color Usage (Flagging Only)

The only permissible deviations from the monochromatic scheme are the three universal flag colors. These colors must be highly saturated to provide maximum contrast against the dark background, ensuring immediate identification of data deviations.

RED: For $\text{RED}$ flagged metrics and urgent alerts (Mode 1).

YELLOW: For $\text{YELLOW}$ flagged metrics and cautionary status.

GREEN: For $\text{GREEN}$ flagged metrics and positive consistency (Mode 2).

V. Detailed Backend Processing Pipeline (The Orchestration)

The system executes a rigid four-stage pipeline upon every new Daily Log Input.

$$\text{Daily Log Input} \xrightarrow[\text{1. Normalization}]{\text{Raw Data}} \text{Stage 2: Flagging} \xrightarrow[\text{3. Pivot/Mode Selection}]{\text{Processed State}} \text{Stage 4: Intervention Engine}$$

A. Stage 1: Normalization & Standardization

Goal: Convert all raw inputs into a numerical value for calculation.

Time Conversion: $\text{Sleep Duration}$ (h:m) is converted to decimal hours (e.g., $6:15 \rightarrow 6.25\text{ hours}$).

Toggle Mapping: All toggle states are converted to their corresponding ordinal scores (e.g., Sun Exposure: $\text{Yes}=5$).

B. Stage 2: Flagging (The Universal State Generator)

The appropriate baseline ($\text{Base}_{\text{Metric}}$ or $\text{Target}_{\text{Metric}}$) is used to calculate the $\text{Flag}_{\text{Metric}}$ ($\text{GREEN}/\text{YELLOW}/\text{RED}$) for all 7 core metrics and saved to the Daily Log Entry.

C. Stage 3: Clustering and Feedback Mode Selection (Pivot 3)

The system queries the processedState of the last $3$ or $7$ days and selects one of three mutually exclusive feedback modes, prioritized from worst to best.

Mode

Name

Priority

Conditions

Resulting Tone

Mode 1

Negative Cluster Alert (NCA)

Highest

3-Day Check: Symptom Score $\ge 4$ AND $\ge 2$ non-symptom $\text{RED}/\text{YELLOW}$ flags are present in all 3 days.

Diagnostic, Urgent

Mode 3

Stagnation Check/Neutral Consistency (SCC)

Medium

7-Day Check: Did NOT trigger Mode 1 or Mode 2. Refined Condition: $70\%$ or more of all non-symptom metric flags maintained the exact same state over 5 consecutive days.

Inquisitive, Experimental

Mode 2

Positive Consistency Acknowledgment (PCA)

Lowest

7-Day Check: $\ge 80\%$ of all non-symptom metric flags are $\text{GREEN}$ AND $\text{Symptom Score Avg} \le 2$.

Supportive, Congratulatory

D. Stage 4: Intervention Engine & Auto-Hypothesis Generation

This stage is conditional on the Orchestration Lock (Section VII.A).

Lock Check: If $\text{activeInterventionId}$ is present, SKIP hypothesis generation.

If Mode 1 Active:

Identify Active Cluster Set: List all non-symptom metrics that triggered a $\text{RED}$ or $\text{YELLOW}$ flag on at least two of the last three days.

Apply Priority Rules (P1-P5): Determines the focus metric.

Apply Quantitative Tie-Breaker (Determinism Fix): If multiple pairs qualify under P1-P5, prioritize the pair that contains the metric quantitatively furthest below its $\text{Base}_{\text{Metric}}$ or $\text{Target}_{\text{Metric}}$.

Generate Hypothesis: The Static Combination Engine runs, utilizing the Mode-specific component pools (VI.B) to construct the final text.

VI. Static Combination Hypothesis Engine Details

The engine constructs a personalized, tonally appropriate sentence using three component pools ($\text{C1: Focus}, \text{C2: Action}, \text{C3: Context}$).

V.A. Component Pool Logic Summary

Mode

C1 (Focus/Observation)

C2 (Action/Reinforcement)

C3 (Context/Goal)

Mode 1 (NCA)

Based on P1-P5 Rule/Tie-Breaker.

Based on the least severe metric in the cluster (easiest fix).

Uses specific Symptom Name (if available).

Mode 2 (PCA)

Acknowledgment/Praise.

Based on the longest maintained $\text{GREEN}$ metric.

Suggests a small optimization/growth step.

Mode 3 (SCC)

Observes consistent logging/plateau.

Suggests breaking the most stable metric to test effect.

Encourages experimentation/curiosity.

V.B. Example Component Fragments

Mode

C1: Core Correlation / Acknowledgment

C2: Actionable Step / Reinforcement

C3: Context / Goal / Severity

Mode 1

"Your reduced sleep recovery is driving the cluster,"

"...so try to increase your Protein intake by $10\text{g}$ every day,"

"...to stabilize your $\text{[User Symptom Name]}$ response."

Mode 2

"Fantastic work on your seven-day streak,"

"...especially with your $\text{RHR}$ stability and $\text{Sleep Duration}$,"

"Try focusing on one new growth habit like adding $5\text{g}$ of protein."

Mode 3

"We've noticed you're in a consistent holding pattern,"

"...it's time to test a new hypothesis by reducing your $\text{Sleep}$ by $30$ minutes for three days,"

"The goal is to find a new optimum point, not just maintain the status quo."

VII. Data Structures and Persistence (Firestore)

All data must be stored using the global __app_id and __user_id variables to ensure isolation and security.

A. User Baseline/Targets Document (Single Document Per User)

This document holds the necessary data for all calculations and the critical orchestration state.

Field Name

Type

Description

userId

String

Current authenticated user ID.

wearableBaselines

Map

$\text{RHR}_{\text{Base}}: 58$, $\text{HRV}_{\text{Base}}: 50$, $\text{Sleep}_{\text{Base}}: 7.15$.

manualTargets

Map

$\text{Protein}_{\text{Target}}: 80$, $\text{Gut}_{\text{Target}}: 4$, $\text{Sun}_{\text{Target}}: \text{Yes}$, $\text{Exercise}_{\text{Target}}: \text{Hard}$.

isBaselineComplete

Boolean

True after Day 7.

activeInterventionId

String or Null

CRITICAL ORCHESTRATION LOCK. Non-null ID means a test is running.

B. Daily Log Entry Collection

This collection stores all logged data and its processed state for the Traceback Heatmap.

Field Name

Type

Description

date

Timestamp

Timestamp of log.

rawValues

Map

Raw user inputs (e.g., $\text{Sleep}: 6.45$, $\text{Protein}: 75$).

processedState

Map

$\text{Sleep}_{\text{Flag}}: \text{YELLOW}$, $\text{Protein}_{\text{Flag}}: \text{RED}$, etc.

symptomScore

Number

User's 1-5 symptom rating.

symptomName

String

User's optional symptom description (e.g., "Brain Fog").

C. Intervention Log Collection (History Page Data)

This collection tracks past hypotheses and their outcomes.

Field Name

Type

Description

hypothesisId

String

Unique ID, also used for the activeInterventionId lock.

hypothesisText

String

The full hypothesis sentence generated or input by user.

startDate

Timestamp

Date the 7-day test began.

endDate

Timestamp

Date the 7-day test ends.

checkinResult

String

User's $\text{Yes/No/Partial}$ feedback on symptom improvement.

VIII. Orchestration and State Management

A. Hypothesis Overlap Prevention (The Orchestration Lock)

This mechanism is critical for maintaining data integrity and UX consistency.

Locking: When the user accepts an Auto-Hypothesis or inputs their own (Feature 4), a unique $\text{hypothesisId}$ is generated and immediately saved to the User Baseline/Targets.activeInterventionId field.

Lock State: While activeInterventionId is not null, the following actions are BLOCKED:

The Intervention Engine (Stage 4) cannot run.

The Analytics Page Banner (Feature 3) displays the "Intervention In Progress" message instead of a new alert.

Unlocking: The lock is only cleared (set to null) when the user completes the 7-Day Check-in (Feature 4).

B. Data Flow Integrity

Real-Time UI: The Dashboard and History must use Firestore onSnapshot() listeners for real-time updates.

Authentication Check: All Firestore reads and writes must be guarded by an authentication check (using the __initial_auth_token flow) to prevent unauthorized operations and ensure the userId is valid before forming collection paths.