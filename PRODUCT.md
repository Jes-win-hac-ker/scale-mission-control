# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are hackathon judges and mission-operations viewers who need to understand and demonstrate autonomous debris capture through a live dashboard.

## Product Purpose

Project S.C.A.L.E. (Swarm Capture & Autonomous LEO Extraction) demonstrates a coordinated satellite swarm capturing low-Earth-orbit debris and redirecting it toward repurposing. Success means the live demo is stable, visually compelling, and instantly understandable.

## Positioning

S.C.A.L.E. makes the swarm's mission legible as an operating system: each target, drone assignment, trajectory, and recovered resource updates in one continuous command-deck view.

## Operating Context

The dashboard is presented during a short hackathon demo. Viewers scan the orbital scene, inspect target and drone telemetry, deploy a capture mission, and watch the recovery impact update in real time.

## Capabilities and Constraints

- Next.js App Router web application.
- React Three Fiber and Drei provide the orbital visualization.
- Zustand owns mock mission state and assignment logic.
- Framer Motion provides HUD transitions and feedback.
- The demo uses hardcoded mock data only; it must not depend on live APIs.
- The interface uses a dark void background, neon cyan swarm assets, amber/crimson debris and warnings, and monospaced telemetry.
- The core interaction is selecting a debris target, deploying an available drone, animating interception for five seconds, and securing the target.

## Brand Commitments

The product name is Project S.C.A.L.E. The voice is precise, operational, and cinematic without sacrificing scanability.

## Evidence on Hand

No external customer, operational, or performance evidence is available. All mission data is synthetic demo data and should remain clearly illustrative.

## Product Principles

- Make autonomous coordination visible.
- Turn every state change into a readable mission event.
- Keep the critical path one glance away.
- Prefer stable, deterministic demonstrations over live-data fragility.

## Accessibility & Inclusion

The dashboard must preserve keyboard focus, readable contrast, explicit status text, and controls that do not rely on color alone.
