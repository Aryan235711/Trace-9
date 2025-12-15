# Trace-9 Health Self-Diagnostic Tool

**Agent 2 Documentation System** | Project Status: 🔴 DEVELOPMENT

## Project Overview

Trace-9 is a health self-diagnostic tool that correlates wearable data (Sleep, HRV, RHR) with lifestyle inputs (Protein, Gut, Sun, Exercise) to identify health triggers through pattern detection and automated hypothesis generation.

### Core Features
- **8 Metric Tracking:** Sleep, HRV, RHR, Protein, Gut Health, Sun Exposure, Exercise, Symptoms
- **3-Day Trend Rule:** Visual clustering for pattern detection
- **Auto-Hypothesis Generation:** Personalized health insights
- **7-Day Intervention Testing:** Hypothesis validation system

## Current Status

### ✅ **Implemented**
- React/TypeScript frontend with modern UI
- Express.js backend with PostgreSQL
- User authentication (Replit Auth)
- Basic dashboard with data visualization
- Database schema and CRUD operations

### ✅ **Recently Implemented**
- **Orchestration Pipeline** (4-stage data processing)
- **Pattern Detection Engine** (Mode 1/2/3 algorithms)
- **Hypothesis Generation System** (Auto-hypothesis creation)
- **Intervention Lock Management** (State management)
- **Baseline Calculation Logic** (7-day averages)
- **PWA Infrastructure** (Play Store ready)
- **Lighthouse Testing** (Windows-safe wrapper)
- **Android Deployment Guide** (TWA/Capacitor options)
- **UI Bug Fixes** (Interventions, Daily Log, Dashboard)
- **Validation Complete** (Jest tests passing, TypeScript clean)

## Documentation System

**Agent 2 maintains comprehensive tracking:**

| Document | Purpose | Status |
|----------|---------|--------|
| [AGENT_SYNC_BOARD.md](./AGENT_SYNC_BOARD.md) | **Agent coordination & task sync** | ✅ **Active** |
| [DEVELOPMENT_TRACKER.md](./DEVELOPMENT_TRACKER.md) | Sprint progress & Agent 1 verification | ✅ Active |
| [ISSUES_LOG.md](./ISSUES_LOG.md) | Bug tracking & technical debt | ✅ Active |
| [BACKEND_SPEC.md](./BACKEND_SPEC.md) | Implementation specifications | ✅ Active |
| [VERIFICATION_CHECKLIST.md](./VERIFICATION_CHECKLIST.md) | Code review criteria | ✅ Active |
| [ARCHITECTURE_STATUS.md](./ARCHITECTURE_STATUS.md) | Current vs target architecture | ✅ Active |
| [UX_BACKLOG.md](./UX_BACKLOG.md) | User experience improvements | ✅ Active |
| [SoT.md](./SoT.md) | Source of Truth specification | ✅ Complete |

## Development Workflow

### **Agent Roles**
- **Agent 1:** Implementation & coding
- **Agent 2:** Documentation, verification, and tracking

### **Agent 1 Submission Process**
1. Reference issue from ISSUES_LOG.md
2. Implement according to BACKEND_SPEC.md
3. Submit with verification checklist
4. Agent 2 reviews against SoT.md compliance

### **Current Priority Queue**
1. **ISSUE-001:** Orchestration Pipeline (P0)
2. **ISSUE-002:** Pattern Detection Logic (P0)
3. **ISSUE-003:** Hypothesis Generation Engine (P0)
4. **ISSUE-005:** Intervention Lock System (P1)

## Tech Stack

### **Frontend**
- React 19 + TypeScript
- Tailwind CSS + Radix UI
- TanStack Query (state management)
- Recharts (data visualization)
- Wouter (routing)

### **Backend**
- Express.js + TypeScript
- PostgreSQL + Drizzle ORM
- Replit Authentication
- WebSocket support

### **Development**
- Vite (build tool)
- ESBuild (bundling)
- TypeScript (type safety)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Database Setup

```bash
# Push schema to database
npm run db:push

# Check TypeScript
npm run check
```

## Project Structure

```
Trace-Prototype/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route components
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── index.ts           # Server entry
│   ├── routes.ts          # API routes
│   ├── orchestration.ts   # ✅ IMPLEMENTED - Core pipeline
│   └── db.ts              # Database connection
├── shared/                 # Shared types
│   └── schema.ts          # Database schema
└── docs/                  # Agent 2 documentation
```

## Key Specifications

### **Data Processing Pipeline**
```
Raw Input → Normalization → Flagging → Mode Selection → Hypothesis Generation
```

### **Pattern Detection Modes**
- **Mode 1 (NCA):** 3-day symptom ≥4 + 2 RED/YELLOW flags
- **Mode 2 (PCA):** 7-day 80% GREEN + symptom avg ≤2
- **Mode 3 (SCC):** 70% same state for 5 consecutive days

### **Hypothesis Components**
- **C1:** Focus/Observation
- **C2:** Action/Reinforcement  
- **C3:** Context/Goal

## Contributing

### **For Agent 1 (Implementation)**
1. Check ISSUES_LOG.md for assignments
2. Follow BACKEND_SPEC.md specifications
3. Ensure SoT.md compliance
4. Submit with VERIFICATION_CHECKLIST.md

### **For Agent 2 (Documentation)**
1. Maintain all tracking documents
2. Verify Agent 1 submissions
3. Update architecture status
4. Track technical debt

## License

MIT License - See LICENSE file for details

---

**Project Health:** 🟢 PRODUCTION READY - All systems stable
**Next Milestone:** Production deployment & Play Store submission
**Agent 2 Status:** 🟢 ACTIVE - Monitoring development