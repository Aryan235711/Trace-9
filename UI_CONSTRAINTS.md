# UI Development Constraints

**Agent 2 UI Guidelines** | Last Updated: 2024-12-19

## Core UI Philosophy

**MINIMALISTIC APPROACH ONLY** - AI agents lack visual feedback and can create UI chaos.

## Strict UI Rules for Agent 1

### **❌ FORBIDDEN ACTIONS**
- **NO new UI components** - Do not create new React components
- **NO layout modifications** - Do not change existing component structure
- **NO new pages** - Do not add new routes or page components
- **NO styling changes** - Do not modify CSS, Tailwind classes, or component styling
- **NO new UI libraries** - Do not add new UI dependencies

### **✅ ALLOWED ACTIONS**
- **Extend existing components** - Add minimal logic to current components
- **Use existing hooks** - Leverage current useInterventions, useLogs, etc.
- **Add API calls** - Backend integration within existing components
- **Conditional rendering** - Show/hide existing elements based on state
- **Update existing text/content** - Modify labels, messages within current structure

## Implementation Strategy

### **For Check-in Flow (TASK-A1-003):**
**APPROACH:** Extend existing dashboard banner component only
- Use current intervention banner in Dashboard.tsx
- Add check-in buttons within existing banner structure
- No new components, no layout changes
- Simple conditional rendering based on intervention.endDate

### **For Future UI Tasks:**
**PRIORITY ORDER:**
1. **Backend-only solutions** (preferred)
2. **Extend existing components** (minimal changes)
3. **Skip UI entirely** if not essential

## Verification Criteria

**Agent 2 will REJECT any submission that:**
- Creates new UI components
- Modifies existing component structure
- Changes layout or styling
- Adds unnecessary UI complexity

**Agent 2 will APPROVE submissions that:**
- Work within existing UI framework
- Add minimal, essential functionality only
- Maintain current design consistency
- Prioritize backend logic over UI changes

## Current UI State Analysis

**Existing Components (DO NOT MODIFY STRUCTURE):**
- Dashboard.tsx - Main dashboard with banner system
- DailyLog.tsx - Data entry form
- History.tsx - Historical data view
- Landing.tsx - Authentication landing
- Onboarding.tsx - Initial setup

**Safe Extension Points:**
- Dashboard banner system (intervention status)
- Existing hooks (useInterventions, useActiveIntervention)
- API integration within current components

## Agent 1 Guidance

**Before any UI work:**
1. Identify existing component to extend
2. Confirm no new components needed
3. Verify minimal change approach
4. Focus on backend logic first

**When in doubt:**
- Choose backend-only solution
- Skip UI if not absolutely essential
- Ask for clarification before proceeding

---

**Remember:** Users can see the UI, AI agents cannot. Minimalistic approach prevents UI chaos.