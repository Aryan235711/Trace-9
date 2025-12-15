# Trace-9 Backend Implementation Specification

**Agent 2 Technical Specification** | Based on SoT.md | Last Updated: 2024-12-19

## Core Architecture Requirements

### **Orchestration Pipeline (CRITICAL)**

**File:** `server/orchestration.ts`

```typescript
// Required function signature
export async function processDaily Log(userId: string, rawInput: DailyLogInput): Promise<ProcessedDailyLog>

// Pipeline Stages:
// Stage 1: Normalization
// Stage 2: Flagging  
// Stage 3: Mode Selection
// Stage 4: Intervention Engine (conditional)
```

**Stage 1: Normalization**
- Convert sleep h:m → decimal hours
- Map toggles to ordinal scores (Sun: Yes=5, Exercise: Hard=5)
- Validate all 8 metrics

**Stage 2: Flagging**
- Calculate flags using baselines/targets
- Save to processedState map
- All 7 core metrics + symptom score

**Stage 3: Mode Selection**
- Query last 3/7 days processedState
- Apply Mode 1/2/3 conditions
- Return selected mode

**Stage 4: Intervention Engine**
- Check activeInterventionId lock
- If locked: SKIP
- If Mode 1: Generate hypothesis
- Apply P1-P5 priority rules

### **Pattern Detection Module**

**File:** `server/patterns.ts`

```typescript
export function detectMode(logs: ProcessedDailyLog[]): 'MODE_1' | 'MODE_2' | 'MODE_3' | null

// Mode 1 (NCA): 3-day check
// - Symptom Score ≥ 4 AND
// - ≥ 2 non-symptom RED/YELLOW flags in all 3 days

// Mode 2 (PCA): 7-day check  
// - ≥ 80% non-symptom flags are GREEN AND
// - Symptom Score Avg ≤ 2

// Mode 3 (SCC): 7-day check
// - NOT Mode 1 or 2 AND
// - 70%+ metrics same state for 5 consecutive days
```

### **Hypothesis Generation Engine**

**File:** `server/hypothesis.ts`

```typescript
export function generateHypothesis(mode: string, clusterData: ClusterData): string

// Component Pools (C1/C2/C3)
// Mode-specific sentence construction
// Priority rules P1-P5 for metric selection
// Quantitative tie-breaker logic
```

## Database Schema Compliance

### **Current vs Required Schema**

**✅ MATCHES SoT.md:**
- User authentication structure
- Basic daily log fields
- Intervention tracking

**❌ MISSING FROM CURRENT:**
- `activeInterventionId` lock field
- `processedState` map structure
- `isBaselineComplete` boolean
- Proper baseline calculation fields

### **Required Schema Updates**

**userTargets table:**
```sql
-- Add missing fields
activeInterventionId VARCHAR NULL  -- CRITICAL LOCK
isBaselineComplete BOOLEAN DEFAULT FALSE
```

**dailyLogs table:**
```sql  
-- Ensure processedState structure
-- All flag fields: sleepFlag, rhrFlag, hrvFlag, proteinFlag, gutFlag, sunFlag, exerciseFlag, symptomFlag
```

## API Endpoints Specification

### **POST /api/daily-log**
- Input: Raw daily log data
- Process: Run orchestration pipeline
- Output: Processed log with flags
- Side effects: May generate hypothesis

### **GET /api/hypothesis/current**
- Check activeInterventionId
- Return current hypothesis or null
- Include intervention progress

### **POST /api/intervention/complete**
- Input: Yes/No/Partial feedback
- Clear activeInterventionId lock
- Save to intervention history

### **GET /api/patterns/detect**
- Analyze last 3/7 days
- Return detected mode
- Include cluster analysis

## Critical Implementation Notes

### **Lock System (CRITICAL)**
```typescript
// Before hypothesis generation
if (userTargets.activeInterventionId) {
  return; // SKIP - intervention in progress
}

// After hypothesis acceptance
userTargets.activeInterventionId = newHypothesisId;
```

### **Baseline Calculation**
```typescript
// After day 7
if (dailyLogs.length >= 7 && !userTargets.isBaselineComplete) {
  const baselines = calculateBaselines(last7Days);
  userTargets.wearableBaselines = baselines;
  userTargets.isBaselineComplete = true;
}
```

### **Flag Calculation Logic**
```typescript
// For wearable metrics (Sleep, RHR, HRV)
const deviation = Math.abs(currentValue - baseline) / baseline;
if (deviation > 0.15) return 'RED';
if (deviation > 0.08) return 'YELLOW';  
return 'GREEN';

// For manual targets (Protein, Gut, Sun, Exercise)
const achievement = currentValue / target;
if (achievement < 0.7) return 'RED';
if (achievement < 0.9) return 'YELLOW';
return 'GREEN';
```

## Error Handling Requirements

### **Input Validation**
- All 8 metrics must be present
- Range validation per metric type
- Type safety enforcement

### **Database Constraints**
- Foreign key integrity
- Null checks on critical fields
- Transaction rollback on errors

### **Lock Conflict Resolution**
- Handle concurrent intervention attempts
- Graceful lock timeout handling
- State consistency checks

## Testing Requirements

### **Unit Tests Required**
- [ ] Orchestration pipeline stages
- [ ] Pattern detection algorithms  
- [ ] Hypothesis generation logic
- [ ] Flag calculation accuracy
- [ ] Lock system integrity

### **Integration Tests Required**
- [ ] End-to-end daily log processing
- [ ] Intervention lifecycle
- [ ] Database transaction handling
- [ ] API endpoint responses

---

**Agent 1 Implementation Checklist:**
- [ ] All functions match specified signatures
- [ ] SoT.md compliance verified
- [ ] Error handling implemented
- [ ] Type safety maintained
- [ ] Database schema updated
- [ ] API endpoints functional
- [ ] Lock system working
- [ ] Pattern detection accurate