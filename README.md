# Project S.C.A.L.E. Mission Control

Mission Control dashboard for **Project S.C.A.L.E.** (Swarm Capture & Autonomous LEO Extraction): an interactive Next.js demo that visualizes autonomous drone missions recovering orbital debris.

## Features

- 3D orbital scene rendered with React Three Fiber and Drei
- Real-time swarm and debris state simulation using Zustand
- GO-FETCH dispatch flow for assigning drones to debris targets
- AUTO DISPATCH mode for value-prioritized multi-target recovery
- Mission telemetry panels, command log, warnings, and recovery impact metrics

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Zustand
- Framer Motion
- Three.js / React Three Fiber / Drei

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm run dev` – start the development server
- `npm run build` – create a production build
- `npm run start` – run the production server
- `npm run lint` – run lint checks

## Notes

- The mission data is intentionally synthetic/mock data for demo reliability.
- Core simulation logic is implemented in `/lib/store.ts`.
