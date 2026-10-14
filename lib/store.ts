"use client";

import { create } from "zustand";
import {
  DroneBerthId,
  calculateDepotRendezvousTrajectory,
  calculateRendezvousTrajectory,
  getBerthWorldPosition,
  getDebrisOrbitalPosition,
  getDepotOrbitalPosition,
  getGlobalSimTime,
  getSmeltingIntakePosition,
  getSmeltingStandOffPosition,
  getStationHoldingPosition,
  getStationOrbitalPosition,
  getStationRingAngle
} from "./orbital";
import {
  MaterialAssay,
  SwarmStrategy,
  calculateDeltaV,
  calculateFuelBurn,
  calculateKesslerThreat,
  getMaterialAssay,
  solveHungarianMatching
} from "./algorithms";

export type DebrisStatus = "available" | "targeted" | "captured" | "recovered";

export type DroneStatus =
  | "idle"
  | "assigned"
  | "intercepting"
  | "capturing"
  | "returning"
  | "recovered"
  | "error";

export type DroneSubStatus =
  | "docked"
  | "undocking"
  | "accelerating"
  | "coasting"
  | "braking"
  | "detumbling"
  | "clamping"
  | "towing"
  | "holding"
  | "ingesting"
  | "docking";

export type DroneFlight = {
  startPosition: [number, number, number];
  targetPosition: [number, number, number];
  startTime: number;
  startSimTime?: number;
  duration: number; // in seconds
  fuelCost: number;
  type?: "intercept" | "return" | "docking";
};

export interface DepotStockpile {
  titanium: number;       // kg
  preciousMetals: number; // kg
  semiconductors: number; // kg
  propellant: number;     // kg
  silicates: number;      // kg
}

export type Debris = {
  id: string;
  position: [number, number, number];
  mass: number;
  value: number;
  material: string;
  status: DebrisStatus;
  subStatus?: "free" | "detumbling" | "clamped" | "towed" | "ingesting" | "smelted";
  assignedDroneId?: string | null;
  assay: MaterialAssay;
  threatIndex: number;
  deltaVBudget: number;
};

export type Drone = {
  id: string;
  berthId: DroneBerthId;
  position: [number, number, number];
  status: DroneStatus;
  subStatus?: DroneSubStatus;
  fuel: number; // 0-100
  payload: number;
  targetId: string | null;
  speed: number;
  flight?: DroneFlight;
};

export type RecoveryDepot = {
  id: string;
  position: [number, number, number];
};

export type CommandLog = {
  id: string;
  timestamp: string;
  message: string;
  tone?: "info" | "action" | "success" | "warning";
};

export const RECOVERY_DEPOT: RecoveryDepot = {
  id: "DEPOT-01",
  position: [0.0, 2.7, 2.7]
};

export type FocusedEntity = {
  type: "debris" | "drone" | "depot" | "earth";
  id?: string;
};

// Euclidean 3D distance
export function distance(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function formatLogValue(val: number): string {
  if (val >= 1_000_000) {
    const num = (val / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `$${num}M`;
  }
  if (val >= 1_000) {
    const num = (val / 1_000).toFixed(0);
    return `$${num}K`;
  }
  return `$${val}`;
}

export function getTimeString(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

const debrisMaterials = [
  "Spent Rocket Booster Stage",
  "Chondrite Meteorite Fragment",
  "Aluminium Fairing & Thrust Ring",
  "Ferrous Meteorite Shard",
  "Defunct Solar Array",
  "Reaction Wheel Core",
  "Nickel-Cadmium Battery Unit",
  "Titanium Shielding Shard"
];

const rawDebris = [
  {
    id: "DEB-001",
    position: [2.5, 0.4, 1.2] as [number, number, number],
    mass: 380,
    value: 4800000,
    material: "Spent Rocket Booster Stage",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-002",
    position: [-2.3, 0.9, 1.4] as [number, number, number],
    mass: 240,
    value: 3800000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-003",
    position: [1.2, -1.8, 1.9] as [number, number, number],
    mass: 145,
    value: 2900000,
    material: "Chondrite Meteorite Fragment",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-004",
    position: [-1.6, -1.9, -1.5] as [number, number, number],
    mass: 310,
    value: 4500000,
    material: "Reaction Wheel Core",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-005",
    position: [0.8, 2.3, -1.4] as [number, number, number],
    mass: 160,
    value: 2750000,
    material: "Aluminium Fairing & Thrust Ring",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-006",
    position: [2.7, -0.6, -1.1] as [number, number, number],
    mass: 95,
    value: 1850000,
    material: "Ferrous Meteorite Shard",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-007",
    position: [-2.6, 0.2, -1.3] as [number, number, number],
    mass: 420,
    value: 5200000,
    material: "Nickel-Cadmium Battery Unit",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-008",
    position: [1.9, 1.7, 1.0] as [number, number, number],
    mass: 145,
    value: 2100000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-009",
    position: [-0.9, 2.4, 1.1] as [number, number, number],
    mass: 280,
    value: 3600000,
    material: "Titanium Shielding Shard",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-010",
    position: [0.2, -2.6, 1.2] as [number, number, number],
    mass: 190,
    value: 2900000,
    material: "Reaction Wheel Core",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-011",
    position: [-1.4, 1.6, 2.1] as [number, number, number],
    mass: 220,
    value: 3400000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-012",
    position: [2.1, -1.5, 0.9] as [number, number, number],
    mass: 440,
    value: 5600000,
    material: "Spent Rocket Booster Stage",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-013",
    position: [-1.1, -1.7, 2.0] as [number, number, number],
    mass: 85,
    value: 1650000,
    material: "Ferrous Meteorite Shard",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-014",
    position: [1.7, 2.2, -1.2] as [number, number, number],
    mass: 310,
    value: 4200000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-015",
    position: [-2.4, -0.8, -1.6] as [number, number, number],
    mass: 175,
    value: 2600000,
    material: "Aluminium Fairing & Thrust Ring",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-016",
    position: [0.6, -2.2, -1.8] as [number, number, number],
    mass: 130,
    value: 2400000,
    material: "Chondrite Meteorite Fragment",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-017",
    position: [-2.0, 1.8, -1.0] as [number, number, number],
    mass: 260,
    value: 3900000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-018",
    position: [2.8, 0.8, -0.6] as [number, number, number],
    mass: 490,
    value: 6100000,
    material: "Spent Rocket Booster Stage",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-019",
    position: [-0.5, 2.7, 0.8] as [number, number, number],
    mass: 210,
    value: 3150000,
    material: "Titanium Shielding Shard",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-020",
    position: [1.5, -2.3, 1.1] as [number, number, number],
    mass: 295,
    value: 4100000,
    material: "Reaction Wheel Core",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-021",
    position: [-1.8, -1.3, -2.1] as [number, number, number],
    mass: 185,
    value: 2850000,
    material: "Aluminium Fairing & Thrust Ring",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-022",
    position: [2.3, 1.2, 1.7] as [number, number, number],
    mass: 360,
    value: 4700000,
    material: "Nickel-Cadmium Battery Unit",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-023",
    position: [-2.7, -0.4, 1.0] as [number, number, number],
    mass: 155,
    value: 2300000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-024",
    position: [0.9, -1.6, -2.4] as [number, number, number],
    mass: 510,
    value: 6400000,
    material: "Spent Rocket Booster Stage",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-025",
    position: [2.4, -1.8, -0.8] as [number, number, number],
    mass: 110,
    value: 1950000,
    material: "Ferrous Meteorite Shard",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-026",
    position: [-1.2, 2.5, -1.3] as [number, number, number],
    mass: 230,
    value: 3500000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-027",
    position: [1.3, 1.9, 2.2] as [number, number, number],
    mass: 275,
    value: 3750000,
    material: "Reaction Wheel Core",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-028",
    position: [-2.5, 1.3, 1.3] as [number, number, number],
    mass: 195,
    value: 3100000,
    material: "Titanium Shielding Shard",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-029",
    position: [1.8, -2.4, -0.7] as [number, number, number],
    mass: 340,
    value: 4600000,
    material: "Defunct Solar Array",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-030",
    position: [-0.7, -1.9, 2.3] as [number, number, number],
    mass: 165,
    value: 2550000,
    material: "Aluminium Fairing & Thrust Ring",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-031",
    position: [2.6, 1.1, -1.4] as [number, number, number],
    mass: 120,
    value: 2150000,
    material: "Chondrite Meteorite Fragment",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  },
  {
    id: "DEB-032",
    position: [-2.1, -2.1, 0.9] as [number, number, number],
    mass: 430,
    value: 5400000,
    material: "Spent Rocket Booster Stage",
    status: "available" as DebrisStatus,
    assignedDroneId: null
  }
];

const initialDebris: Debris[] = rawDebris.map((d) => {
  const dist = distance(d.position, RECOVERY_DEPOT.position);
  return {
    ...d,
    assay: getMaterialAssay(d.material, d.id),
    threatIndex: calculateKesslerThreat(d as any),
    deltaVBudget: calculateDeltaV(dist, d.mass)
  };
});

const initialDrones: Drone[] = [
  {
    id: "DRONE-01",
    berthId: "B1",
    position: [0.38, 2.7, 2.7],
    status: "idle",
    subStatus: "docked",
    fuel: 100,
    payload: 0,
    targetId: null,
    speed: 0.5
  },
  {
    id: "DRONE-02",
    berthId: "B2",
    position: [-0.38, 2.7, 2.7],
    status: "idle",
    subStatus: "docked",
    fuel: 100,
    payload: 0,
    targetId: null,
    speed: 0.5
  },
  {
    id: "DRONE-03",
    berthId: "B3",
    position: [0.0, 2.7, 3.08],
    status: "idle",
    subStatus: "docked",
    fuel: 100,
    payload: 0,
    targetId: null,
    speed: 0.5
  },
  {
    id: "DRONE-04",
    berthId: "B4",
    position: [0.0, 2.7, 2.32],
    status: "idle",
    subStatus: "docked",
    fuel: 100,
    payload: 0,
    targetId: null,
    speed: 0.5
  },
  {
    id: "DRONE-05",
    berthId: "STAGING",
    position: [0.0, 3.25, 2.7],
    status: "idle",
    subStatus: "docked",
    fuel: 100,
    payload: 0,
    targetId: null,
    speed: 0.5
  }
];

type MissionState = {
  debris: Debris[];
  drones: Drone[];
  depot: RecoveryDepot;
  selectedDebrisId: string;
  focusedEntity: FocusedEntity;
  missionStartedAt: number;
  lastSmeltedAt?: number;
  totalRecoveredMass: number;
  totalRecoveredValue: number;
  stockpile: DepotStockpile;
  swarmStrategy: SwarmStrategy;
  logs: CommandLog[];
  warning: string | null;
  dockingQueue: string[]; // Sequential holding queue for DEPOT-01 smelting standoff to prevent drone collision
  isRefineryOccupied: boolean; // True when a drone is actively ingesting/releasing payload at the underside stand-off

  selectDebris: (id: string) => void;
  focusEntity: (type: FocusedEntity["type"], id?: string) => void;
  clearWarning: () => void;
  addLog: (message: string, tone?: CommandLog["tone"]) => void;
  setSwarmStrategy: (strategy: SwarmStrategy) => void;
  goFetch: (debrisId?: string, preferredDroneId?: string) => boolean;
  processIngestionAndDocking: (droneId: string, debrisId: string) => void;
  autoDispatch: () => void;
  resetSimulation: () => void;
};

export const useMissionStore = create<MissionState>((set, get) => ({
  debris: initialDebris,
  drones: initialDrones,
  depot: RECOVERY_DEPOT,
  selectedDebrisId: initialDebris[0].id,
  focusedEntity: { type: "earth" },
  missionStartedAt: Date.now(),
  totalRecoveredMass: 0,
  totalRecoveredValue: 0,
  stockpile: {
    titanium: 0,
    preciousMetals: 0,
    semiconductors: 0,
    propellant: 0,
    silicates: 0
  },
  swarmStrategy: "balanced",
  dockingQueue: [],
  isRefineryOccupied: false,
  logs: [
    {
      id: "init-1",
      timestamp: "00:00:00",
      message: `SYSTEM INITIALIZED // ${initialDrones.length} DRONES READY // HUNGARIAN OPTIMIZER ONLINE`,
      tone: "info"
    },
    {
      id: "init-2",
      timestamp: "00:00:00",
      message: `DEPOT-01 ISRU SMELTER ANCHORED AT [0.0, 2.7, 2.7] // HIGH ORBITAL GATEWAY (R = 3.82)`,
      tone: "info"
    }
  ],
  warning: null,

  setSwarmStrategy: (swarmStrategy: SwarmStrategy) => {
    set({ swarmStrategy });
    get().addLog(`SWARM OPTIMIZATION STRATEGY // ${swarmStrategy.toUpperCase()}`, "action");
  },

  selectDebris: (id: string) =>
    set({ selectedDebrisId: id, focusedEntity: { type: "debris", id } }),

  focusEntity: (type: FocusedEntity["type"], id?: string) => {
    if (type === "debris" && id) {
      set({ selectedDebrisId: id, focusedEntity: { type: "debris", id } });
    } else {
      set({ focusedEntity: { type, id } });
    }
  },

  clearWarning: () => set({ warning: null }),

  addLog: (message: string, tone: CommandLog["tone"] = "info") => {
    const entry: CommandLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: getTimeString(),
      message,
      tone
    };
    set((state) => ({
      logs: [...state.logs.slice(-49), entry] // Keep last 50 entries
    }));
  },

  goFetch: (debrisId?: string, preferredDroneId?: string): boolean => {
    const state = get();
    const targetId = debrisId ?? state.selectedDebrisId;
    const target = state.debris.find((item) => item.id === targetId);

    // 1. Check if the debris is available
    if (!target || target.status !== "available") {
      return false;
    }

    const depot = state.depot;
    const idleDrones = state.drones.filter((d) => d.status === "idle");
    let bestDrone: Drone | null = null;
    let chosenFuelCost = 0;

    // Real-time orbital position of target satellite and docking station at moment of dispatch
    const simTime = getGlobalSimTime() || ((Date.now() - get().missionStartedAt) / 1000);
    const currentDebrisPos = getDebrisOrbitalPosition(target, simTime);
    const currentDepotPos = getStationOrbitalPosition(simTime, depot);
    const distDebrisDepot = distance(currentDebrisPos, currentDepotPos);

    if (preferredDroneId) {
      bestDrone = idleDrones.find((d) => d.id === preferredDroneId) || null;
      if (bestDrone) {
        const droneLaunchPos = getBerthWorldPosition(bestDrone.berthId, simTime);
        const distDroneDebris = distance(droneLaunchPos, currentDebrisPos);
        chosenFuelCost = calculateFuelBurn(distDroneDebris, distDebrisDepot, target.mass);
      }
    } else {
      let lowestScore = Infinity;
      for (const drone of idleDrones) {
        const droneLaunchPos = getBerthWorldPosition(drone.berthId, simTime);
        const distDroneDebris = distance(droneLaunchPos, currentDebrisPos);
        const fuelCost = calculateFuelBurn(distDroneDebris, distDebrisDepot, target.mass);

        // Fuel constraint removed: all idle drones are operational and unconstrained
        const threat = target.threatIndex || calculateKesslerThreat(target);
        const valNorm = target.value / 1_000_000;
        let score = fuelCost;

        switch (state.swarmStrategy) {
          case "min_delta_v":
            score = fuelCost * 10;
            break;
          case "max_yield":
            score = (fuelCost / Math.max(0.1, valNorm)) * 10;
            break;
          case "kessler_defense":
            score = (fuelCost / Math.max(1, threat)) * 50;
            break;
          case "balanced":
          default:
            score = (fuelCost / (Math.sqrt(Math.max(0.1, valNorm)) * Math.sqrt(threat))) * 25;
            break;
        }

        if (score < lowestScore) {
          lowestScore = score;
          bestDrone = drone;
          chosenFuelCost = fuelCost;
        }
      }
    }

    // If no drone is available, show warning in UI
    if (!bestDrone) {
      const warningText = "All extraction drones are currently deployed or active.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
      return false;
    }

    // Clear any previous warning
    set({ warning: null });

    const droneId = bestDrone.id;
    const currentDronePos = (bestDrone.status === "idle" || bestDrone.subStatus === "docked" || !bestDrone.flight)
      ? getBerthWorldPosition(bestDrone.berthId, simTime)
      : bestDrone.position;
    const droneSpeed = bestDrone.speed || 0.5;

    // Predictive Keplerian Rendezvous Solver:
    // Calculates future coordinates where drone intercept arc and orbiting debris will meet
    const rendezvous = calculateRendezvousTrajectory(
      currentDronePos,
      target,
      simTime,
      droneSpeed
    );
    const interceptDurationSec = rendezvous.durationSec;
    const interceptDurationMs = interceptDurationSec * 1000;
    const rendezvousPos = rendezvous.rendezvousPosition;

    // Predictive return trajectory estimate for total mission delta-v budget
    const estDepotRendezvous = calculateDepotRendezvousTrajectory(
      rendezvousPos,
      depot,
      simTime + interceptDurationSec + 3.3,
      droneSpeed
    );
    const returnDist = estDepotRendezvous.distance;
    const dvTotal = calculateDeltaV(rendezvous.distance, 0) + calculateDeltaV(returnDist, target.mass);

    // Protocol Step 1: Assign drone to debris, set drone status to "intercepting", set debris to "targeted"
    get().addLog(`GO-FETCH ISSUED // TARGET: ${target.id} // THREAT: ${target.threatIndex}/100`, "action");
    get().addLog(
      `${droneId} [${bestDrone.berthId}] UNMOORING FROM ORBITING DEPOT // RENDEZVOUS SOLVED // ETA: ${interceptDurationSec.toFixed(1)}s // Δv: ${dvTotal.toLocaleString()} m/s // PROPULSION: UNCONSTRAINED`,
      "action"
    );

    set((current) => ({
      debris: current.debris.map((item) =>
        item.id === target.id
          ? { ...item, status: "targeted", subStatus: "free", assignedDroneId: droneId }
          : item
      ),
      drones: current.drones.map((d) =>
        d.id === droneId
          ? {
              ...d,
              status: "intercepting",
              subStatus: "accelerating",
              targetId: target.id,
              flight: {
                startPosition: currentDronePos,
                targetPosition: rendezvousPos,
                startTime: Date.now(),
                startSimTime: simTime,
                duration: interceptDurationSec,
                fuelCost: chosenFuelCost,
                type: "intercept"
              }
            }
          : d
      )
    }));

    // Step 2: Animate along curved orbital arc to predictive rendezvous position
    setTimeout(() => {
      // Step 2A: Rendezvous achieved -> Co-orbital spin-matching & active detumble
      get().addLog(`${droneId} RENDEZVOUS // ACTIVE SPIN-MATCHING & DETUMBLE TRACTOR ENGAGED`, "action");

      set((current) => ({
        debris: current.debris.map((item) =>
          item.id === target.id ? { ...item, subStatus: "detumbling" } : item
        ),
        drones: current.drones.map((d) =>
          d.id === droneId
            ? {
                ...d,
                status: "capturing",
                subStatus: "detumbling",
                position: rendezvousPos,
                flight: undefined
              }
            : d
        )
      }));

      // Step 2B: Mechanical clamping & grapple lock after 1800ms
      setTimeout(() => {
        get().addLog(`${droneId} HARPOON TETHER LOCKED // HYDRAULIC CLAWS CLAMPED ON ${target.id}`, "success");

        set((current) => ({
          debris: current.debris.map((item) =>
            item.id === target.id ? { ...item, status: "captured", subStatus: "clamped" } : item
          ),
          drones: current.drones.map((d) =>
            d.id === droneId ? { ...d, subStatus: "clamping" } : d
          )
        }));

        // Step 3: Initiate Inbound Tow Return towards Orbiting Station after 1500ms (3.3s total capture)
        setTimeout(() => {
          get().addLog(`${droneId} TOWING ${target.id} // INBOUND DESCENT TO ORBITING DEPOT-01 ISRU REFINERY`, "action");

          const returnStartSimTime = getGlobalSimTime() || ((Date.now() - get().missionStartedAt) / 1000);
          const realTimeCapturePos = getDebrisOrbitalPosition(target, returnStartSimTime);

          // Predictive Keplerian Rendezvous Solver with the moving orbiting station
          const depotReturnRendezvous = calculateDepotRendezvousTrajectory(
            realTimeCapturePos,
            depot,
            returnStartSimTime,
            droneSpeed
          );
          const liveReturnDurationSec = depotReturnRendezvous.durationSec;
          const liveReturnDurationMs = liveReturnDurationSec * 1000;
          const returnTargetPos = depotReturnRendezvous.rendezvousPosition;

          set((current) => ({
            debris: current.debris.map((item) =>
              item.id === target.id ? { ...item, subStatus: "towed" } : item
            ),
            drones: current.drones.map((d) =>
              d.id === droneId
                ? {
                    ...d,
                    status: "returning",
                    subStatus: "towing",
                    payload: target.mass,
                    flight: {
                      startPosition: realTimeCapturePos,
                      targetPosition: returnTargetPos,
                      startTime: Date.now(),
                      startSimTime: returnStartSimTime,
                      duration: liveReturnDurationSec,
                      fuelCost: chosenFuelCost,
                      type: "return"
                    }
                  }
                : d
            )
          }));

          // Step 4: Reaches Station Perimeter -> Check Traffic Control Queue to Prevent Collision
          setTimeout(() => {
            const currentStore = get();
            if (currentStore.isRefineryOccupied) {
              // Traffic Control Queue: Stand-off is currently occupied by another drone!
              const currentQueue = currentStore.dockingQueue;
              const queueIndex = currentQueue.length;
              const queueSlotNum = queueIndex + 1;
              get().addLog(
                `TRAFFIC CONTROL // ${droneId} INBOUND // REFINERY ACTIVE // ENTERING HOLDING PATTERN [SLOT #${queueSlotNum}]`,
                "warning"
              );

              const arriveSimTime = getGlobalSimTime() || ((Date.now() - get().missionStartedAt) / 1000);
              const holdingPos = getStationHoldingPosition(queueIndex, arriveSimTime);

              set((current) => ({
                dockingQueue: [...current.dockingQueue, droneId],
                drones: current.drones.map((d) =>
                  d.id === droneId
                    ? {
                        ...d,
                        status: "returning",
                        subStatus: "holding",
                        position: holdingPos,
                        flight: undefined
                      }
                    : d
                )
              }));
            } else {
              // Corridor free -> Grant immediate landing & ingestion clearance
              set({ isRefineryOccupied: true });
              get().processIngestionAndDocking(droneId, target.id);
            }
          }, liveReturnDurationMs);
        }, 1500);
      }, 1800);
    }, interceptDurationMs);

    return true;
  },

  processIngestionAndDocking: (droneId: string, debrisId: string) => {
    const drone = get().drones.find((d) => d.id === droneId);
    const target = get().debris.find((item) => item.id === debrisId);
    if (!drone || !target) {
      set({ isRefineryOccupied: false });
      return;
    }

    get().addLog(
      `TRAFFIC CONTROL // ${droneId} CLEARED FOR APPROACH // SMELTING STAND-OFF LOCKED // INGESTING ${target.id} [${target.mass} kg]`,
      "action"
    );

    const arriveSimTime = getGlobalSimTime() || ((Date.now() - get().missionStartedAt) / 1000);
    const liveSmeltingStandOff = getSmeltingStandOffPosition(arriveSimTime);

    set((current) => ({
      dockingQueue: current.dockingQueue.filter((id) => id !== droneId),
      debris: current.debris.map((item) =>
        item.id === target.id
          ? { ...item, status: "captured", subStatus: "ingesting", position: liveSmeltingStandOff }
          : item
      ),
      drones: current.drones.map((d) =>
        d.id === droneId
          ? {
              ...d,
              status: "recovered",
              subStatus: "ingesting",
              position: liveSmeltingStandOff,
              payload: 0,
              flight: undefined
            }
          : d
      )
    }));

    // Step 4B: Ingestion & Smelting Plasma Flash after 1800ms
    setTimeout(() => {
      const formattedVal = formatLogValue(target.value);
      const titaniumKg = Math.round(target.mass * (target.assay.titanium / 100));
      const preciousKg = Math.round(target.mass * (target.assay.preciousMetals / 100));
      const semiKg = Math.round(target.mass * (target.assay.semiconductor / 100));
      const propellantKg = Math.round(target.mass * (target.assay.propellant / 100));
      const silicatesKg = Math.round(target.mass * (target.assay.silicates / 100));

      get().addLog(
        `${target.id} REFINED & SMELTED // +${target.mass} kg // +${formattedVal} // Ti: +${titaniumKg}kg, Pt: +${preciousKg}kg, Si: +${semiKg}kg, FUEL: +${propellantKg}kg`,
        "success"
      );
      get().addLog(
        `${droneId} CLEARED FROM REFINERY // ASCENDING TO BERTH ${drone.berthId}`,
        "action"
      );

      const smeltSimTime = getGlobalSimTime() || ((Date.now() - get().missionStartedAt) / 1000);
      const liveIntakePos = getSmeltingIntakePosition(smeltSimTime);
      const liveStandOffPos = getSmeltingStandOffPosition(smeltSimTime);

      set((current) => ({
        totalRecoveredMass: current.totalRecoveredMass + target.mass,
        totalRecoveredValue: current.totalRecoveredValue + target.value,
        lastSmeltedAt: Date.now(),
        stockpile: {
          titanium: current.stockpile.titanium + titaniumKg,
          preciousMetals: current.stockpile.preciousMetals + preciousKg,
          semiconductors: current.stockpile.semiconductors + semiKg,
          propellant: current.stockpile.propellant + propellantKg,
          silicates: current.stockpile.silicates + silicatesKg
        },
        debris: current.debris.map((item) =>
          item.id === target.id
            ? {
                ...item,
                status: "recovered",
                subStatus: "smelted",
                position: liveIntakePos
              }
            : item
        ),
        drones: current.drones.map((d) =>
          d.id === droneId
            ? {
                ...d,
                status: "recovered",
                subStatus: "docking",
                position: liveStandOffPos,
                fuel: 100,
                targetId: null
              }
            : d
        )
      }));

      // Corridor is now clear! Release corridor and check if another drone is waiting in dockingQueue
      const updatedStore = get();
      if (updatedStore.dockingQueue.length > 0) {
        const nextDroneId = updatedStore.dockingQueue[0];
        const nextDrone = updatedStore.drones.find((d) => d.id === nextDroneId);
        if (nextDrone && nextDrone.targetId) {
          get().addLog(
            `TRAFFIC CONTROL // ${nextDroneId} CLEARED FROM HOLDING QUEUE // COMMENCING APPROACH`,
            "action"
          );
          // Keep corridor occupied for the incoming drone
          get().processIngestionAndDocking(nextDroneId, nextDrone.targetId);
        } else {
          set({ isRefineryOccupied: false });
        }
      } else {
        set({ isRefineryOccupied: false });
      }

      // Step 5: Smooth Berth Approach & Magnetic Mooring after 2400ms
      setTimeout(() => {
        get().addLog(
          `${droneId} MOORED AT BERTH ${drone.berthId} // UMBILICAL POWER & ISRU RECHARGE ACTIVE`,
          "success"
        );
        set((current) => ({
          drones: current.drones.map((d) =>
            d.id === droneId ? { ...d, status: "idle", subStatus: "docked" } : d
          )
        }));
      }, 2400);
    }, 1800);
  },

  autoDispatch: () => {
    const state = get();
    const availableDebris = state.debris.filter((d) => d.status === "available");

    if (availableDebris.length === 0) {
      set({ warning: "No available debris targets for AUTO DISPATCH." });
      return;
    }

    const idleDrones = state.drones.filter((d) => d.status === "idle");
    if (idleDrones.length === 0) {
      const warningText = "All extraction drones currently deployed or active.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
      return;
    }

    // Execute Kuhn-Munkres (Hungarian) Bipartite Matching Algorithm with live orbital station position
    const simTime = getGlobalSimTime() || ((Date.now() - state.missionStartedAt) / 1000);
    const currentDepotPos = getStationOrbitalPosition(simTime, state.depot);
    const optimalMatches = solveHungarianMatching(
      state.drones,
      state.debris,
      currentDepotPos,
      state.swarmStrategy
    );

    if (optimalMatches.length === 0) {
      const warningText = "All extraction drones currently deployed or active.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
      return;
    }

    get().addLog(
      `SWARM AI // HUNGARIAN MATCHING RESOLVED [${optimalMatches.length} PAIRS] // STRATEGY: ${state.swarmStrategy.toUpperCase()}`,
      "action"
    );

    let dispatchedCount = 0;
    for (const match of optimalMatches) {
      const success = get().goFetch(match.targetId, match.droneId);
      if (success) {
        dispatchedCount++;
      }
    }

    if (dispatchedCount === 0) {
      const warningText = "Propellant reserves insufficient for assigned trajectories.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
    }
  },

  resetSimulation: () => {
    set({
      debris: initialDebris,
      drones: initialDrones,
      selectedDebrisId: initialDebris[0].id,
      focusedEntity: { type: "earth" },
      totalRecoveredMass: 0,
      totalRecoveredValue: 0,
      stockpile: {
        titanium: 0,
        preciousMetals: 0,
        semiconductors: 0,
        propellant: 0,
        silicates: 0
      },
      swarmStrategy: "balanced",
      warning: null,
      dockingQueue: [],
      isRefineryOccupied: false,
      logs: [
        {
          id: `reset-${Date.now()}`,
          timestamp: getTimeString(),
          message: "SIMULATION RESET // ALL ASSETS RE-INITIALIZED // STOCKPILES CLEARED",
          tone: "info"
        }
      ]
    });
  }
}));
