# Project S.C.A.L.E. (Swarm Capture & Autonomous LEO Extraction)

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/R3F-8.17-blue?style=flat-square)](https://docs.pmnd.rs/react-three-fiber)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

**Project S.C.A.L.E.** is an orbital mission-control console and real-time 3D simulation demonstrating autonomous swarm drone interception, capture, and extraction of space debris in Low Earth Orbit (LEO).

---

## 🛰️ Overview

As LEO becomes congested with defunct satellite components and rocket stages, Project S.C.A.L.E. models an autonomous satellite swarm operating under the **GO-FETCH protocol**:
1. Operators identify high-priority orbital debris targets.
2. An autonomous allocation algorithm scores and dispatches the optimal drone based on proximity and fuel reserves.
3. The drone intercepts the debris, executes a secure capture maneuver, and returns the payload to an orbital **Recovery Depot (`DEPOT-01`)** for repurposing.

---

## ⚡ Key Features

- **GO-FETCH Autonomous Protocol**:
  - Full autonomous mission lifecycle: `idle` → `assigned` → `intercepting` → `capturing` (1.5s lock sequence) → `returning` → `recovered` → `idle`.
  - Time-based linear interpolation with smooth cubic easing for physical motion.
  - Coupled payload towing: captured debris synchronizes with drone trajectory en route to depot.

- **Dynamic Swarm Selection Algorithm**:
  - Automatically identifies the most efficient idle drone using path cost optimization:
    $$\text{Score} = \text{distance}(\text{drone}, \text{debris}) + \text{distance}(\text{debris}, \text{depot})$$
  - Enforces fuel conservation constraints (`fuel > estimatedFuelCost`).
  - Edge-case resilient: displays non-blocking operator warnings if drones are depleted or unassigned.

- **AUTO DISPATCH**:
  - One-click batch deployment assigning all available drones to the highest-value debris targets in descending order.

- **Interactive 3D Orbital Canvas**:
  - Photorealistic low-poly textured Earth with rotating orbital rings and coordinate grid.
  - Status-coded visual telemetry:
    - **Drones**: Cyan (`idle`), Blue (`intercepting`), Pulsing White (`capturing`), Green (`returning`/`recovered`).
    - **Debris**: Red (`available`), Amber (`targeted`), Green (`captured`/`recovered`).
    - **DEPOT-01**: Multi-tiered glowing ring station with counter-rotating energy rings.
    - **Trajectories**: Real-time dashed vector paths for active intercepts and returns.

- **Mission Command Console & Telemetry Deck**:
  - **Live Command Log**: Chronological terminal feed logging all swarm events with exact timestamps.
  - **Target Focus Card**: Instant inspection of mass, repurpose value, fuel requirements, and assigned units.
  - **Debris Manifest**: Interactive target selector with live orbital risk mitigation metrics.
  - **Swarm Telemetry Rail**: Real-time status chips, battery/fuel progress gauges, and payload status.
  - **Impact Ticker**: Live tally of total kilograms extracted and estimated repurposing value.

---

## 🏗️ Architecture & Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **3D Graphics**: [React Three Fiber](https://github.com/pmndrs/react-three-fiber) & [@react-three/drei](https://github.com/pmndrs/drei) on [Three.js](https://threejs.org/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Transitions & HUD Animation**: [Framer Motion](https://www.framer.com/motion/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with sci-fi orbital command deck design system

### Directory Structure

```text
S.C.A.L.E/
├── app/
│   ├── globals.css          # Command-deck styling & responsive layout
│   ├── layout.tsx           # Root viewport & font setup
│   └── page.tsx             # Entry page mounting MissionControl
├── components/
│   ├── MissionControl.tsx   # HUD grid, manifest, logs, and telemetry
│   └── Scene.tsx            # Three.js Canvas, Earth, drones, debris & depot
├── lib/
│   └── store.ts             # Zustand store, GO-FETCH protocol & state engine
├── public/                  # Static assets (Earth SVG textures)
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher

### Installation

```bash
git clone https://github.com/Jes-win-hac-ker/scale-mission-control.git
cd scale-mission-control
npm install
```

### Running Locally

To launch the mission control dashboard in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

---

## 🎮 How to Operate

1. **Select a Target**: Click on any red debris marker directly in the 3D orbit or select from the left **Debris Manifest**.
2. **Execute GO-FETCH**: Click the amber **“GO FETCH”** button on the target card.
3. **Observe Interception**:
   - The best idle drone is assigned and changes color to blue (`intercepting`).
   - A blue trajectory vector tracks towards the target.
   - Upon rendezvous, the drone enters a white pulsing lock sequence (`capturing`).
   - The debris turns green and is towed along a green vector to **`DEPOT-01`**.
4. **Depot Arrival**:
   - The debris is recovered into the depot.
   - Total recovered mass and dollar value increment in the bottom **Impact Ticker**.
   - The drone refuels/resets and returns to `idle`.
5. **Auto Dispatch**: Click **“AUTO DISPATCH”** to deploy the entire available swarm to highest-value targets simultaneously.

---

## 📄 License

MIT License. Developed for Project S.C.A.L.E.
