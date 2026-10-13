"use client";

import { create } from "zustand";

export type DebrisStatus = "available" | "targeted" | "captured" | "recovered";

export type DroneStatus =
  | "idle"
  | "assigned"
  | "intercepting"
  | "capturing"
  | "returning"
  | "recovered"
  | "error";

export type DroneFlight = {
  startPosition: [number, number, number];
  targetPosition: [number, number, number];
  startTime: number;
  duration: number; // in seconds
  fuelCost: number;
};

export type Debris = {
  id: string;
  position: [number, number, number];
  mass: number;
  value: number;
  material?: string;
  status: DebrisStatus;
  assignedDroneId?: string | null;
};

export type Drone = {
  id: string;
  position: [number, number, number];
  status: DroneStatus;
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
  position: [0.0, 1.9, 1.8]
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

const initialDebris: Debris[] = [
  {
    id: "DEB-001",
    position: [2.5, 0.4, 1.2],
    mass: 380,
    value: 4800000,
    material: "Spent Rocket Booster Stage",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-002",
    position: [-2.3, 0.9, 1.4],
    mass: 240,
    value: 3800000,
    material: "Defunct Solar Array",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-003",
    position: [1.2, -1.8, 1.9],
    mass: 145,
    value: 2900000,
    material: "Chondrite Meteorite Fragment",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-004",
    position: [-1.6, -1.9, -1.5],
    mass: 310,
    value: 4500000,
    material: "Reaction Wheel Core",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-005",
    position: [0.8, 2.3, -1.4],
    mass: 160,
    value: 2750000,
    material: "Aluminium Fairing & Thrust Ring",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-006",
    position: [2.7, -0.6, -1.1],
    mass: 95,
    value: 1850000,
    material: "Ferrous Meteorite Shard",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-007",
    position: [-2.6, 0.2, -1.3],
    mass: 420,
    value: 5200000,
    material: "Nickel-Cadmium Battery Unit",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-008",
    position: [1.9, 1.7, 1.0],
    mass: 145,
    value: 2100000,
    material: "Defunct Solar Array",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-009",
    position: [-0.9, 2.4, 1.1],
    mass: 280,
    value: 3600000,
    material: "Carbon-Composite Strut",
    status: "available",
    assignedDroneId: null
  },
  {
    id: "DEB-010",
    position: [0.2, -2.6, 1.2],
    mass: 190,
    value: 2900000,
    material: "Reaction Wheel Core",
    status: "available",
    assignedDroneId: null
  }
];

const initialDrones: Drone[] = [
  {
    id: "DRONE-01",
    position: [2.9, 0.5, 0.5],
    status: "idle",
    fuel: 95,
    payload: 0,
    targetId: null,
    speed: 1.2
  },
  {
    id: "DRONE-02",
    position: [-2.5, 1.1, 1.2],
    status: "idle",
    fuel: 88,
    payload: 0,
    targetId: null,
    speed: 1.2
  },
  {
    id: "DRONE-03",
    position: [1.5, -1.6, 1.8],
    status: "idle",
    fuel: 82,
    payload: 0,
    targetId: null,
    speed: 1.2
  },
  {
    id: "DRONE-04",
    position: [-1.4, -2.0, -1.6],
    status: "idle",
    fuel: 75,
    payload: 0,
    targetId: null,
    speed: 1.2
  },
  {
    id: "DRONE-05",
    position: [0.6, 2.6, -1.5],
    status: "idle",
    fuel: 35,
    payload: 0,
    targetId: null,
    speed: 1.2
  }
];

type MissionState = {
  debris: Debris[];
  drones: Drone[];
  depot: RecoveryDepot;
  selectedDebrisId: string;
  missionStartedAt: number;
  totalRecoveredMass: number;
  totalRecoveredValue: number;
  logs: CommandLog[];
  warning: string | null;

  selectDebris: (id: string) => void;
  clearWarning: () => void;
  addLog: (message: string, tone?: CommandLog["tone"]) => void;
  goFetch: (debrisId?: string) => boolean;
  autoDispatch: () => void;
  resetSimulation: () => void;
};

export const useMissionStore = create<MissionState>((set, get) => ({
  debris: initialDebris,
  drones: initialDrones,
  depot: RECOVERY_DEPOT,
  selectedDebrisId: initialDebris[0].id,
  missionStartedAt: Date.now(),
  totalRecoveredMass: 0,
  totalRecoveredValue: 0,
  logs: [
    {
      id: "init-1",
      timestamp: "00:00:00",
      message: `SYSTEM INITIALIZED // ${initialDrones.length} DRONES READY`,
      tone: "info"
    },
    {
      id: "init-2",
      timestamp: "00:00:00",
      message: `DEPOT-01 ANCHORED AT ORBITAL STAGING [0.0, 1.9, 1.8]`,
      tone: "info"
    }
  ],
  warning: null,

  selectDebris: (id: string) => set({ selectedDebrisId: id }),

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

  goFetch: (debrisId?: string): boolean => {
    const state = get();
    const targetId = debrisId ?? state.selectedDebrisId;
    const target = state.debris.find((item) => item.id === targetId);

    // 1. Check if the debris is available
    if (!target) {
      return false;
    }

    if (target.status !== "available") {
      return false;
    }

    const depot = state.depot;

    // 2. Find the best available drone using selection algorithm:
    // score = distance(drone.position, debris.position) + distance(debris.position, depot.position)
    // Only select if: drone.status === "idle" && drone.fuel > estimatedFuelCost
    // estimatedFuelCost = distance(drone.position, debris.position) + distance(debris.position, depot.position)
    const idleDrones = state.drones.filter((d) => d.status === "idle");
    let bestDrone: Drone | null = null;
    let lowestScore = Infinity;
    let chosenFuelCost = 0;

    for (const drone of idleDrones) {
      const distDroneDebris = distance(drone.position, target.position);
      const distDebrisDepot = distance(target.position, depot.position);
      const estimatedFuelCost = distDroneDebris + distDebrisDepot;

      if (drone.fuel > estimatedFuelCost) {
        const score = estimatedFuelCost;
        if (score < lowestScore) {
          lowestScore = score;
          bestDrone = drone;
          chosenFuelCost = estimatedFuelCost;
        }
      }
    }

    // If no drone is available, show warning in UI
    if (!bestDrone) {
      const warningText = "No available drone for GO-FETCH command.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
      return false;
    }

    // Clear any previous warning
    set({ warning: null });

    const droneId = bestDrone.id;
    const currentDronePos = bestDrone.position;
    const debrisPos = target.position;
    const depotPos = depot.position;
    const droneSpeed = bestDrone.speed;

    // Distances and time-based durations
    const interceptDist = distance(currentDronePos, debrisPos);
    const interceptDurationSec = Math.max(1, interceptDist / droneSpeed);
    const interceptDurationMs = interceptDurationSec * 1000;

    const returnDist = distance(debrisPos, depotPos);
    const returnDurationSec = Math.max(1, returnDist / droneSpeed);
    const returnDurationMs = returnDurationSec * 1000;

    // Protocol Step 3 & 4:
    // Assign drone to debris, set drone status to "intercepting", set debris to "targeted"
    get().addLog(`GO-FETCH issued for ${target.id}`, "action");
    get().addLog(`${droneId} assigned`, "action");
    get().addLog(`${droneId} intercepting`, "action");

    set((current) => ({
      debris: current.debris.map((item) =>
        item.id === target.id
          ? { ...item, status: "targeted", assignedDroneId: droneId }
          : item
      ),
      drones: current.drones.map((d) =>
        d.id === droneId
          ? {
              ...d,
              status: "intercepting",
              targetId: target.id,
              flight: {
                startPosition: currentDronePos,
                targetPosition: debrisPos,
                startTime: Date.now(),
                duration: interceptDurationSec,
                fuelCost: chosenFuelCost
              }
            }
          : d
      )
    }));

    // Step 5 & 6:
    // Animate to debris. When drone reaches debris:
    // - set drone status to "capturing"
    // - wait 1.5 seconds
    // - set debris status to "captured"
    setTimeout(() => {
      // Reached debris -> capturing
      set((current) => ({
        drones: current.drones.map((d) =>
          d.id === droneId
            ? {
                ...d,
                status: "capturing",
                position: debrisPos,
                flight: undefined
              }
            : d
        )
      }));

      // Wait 1.5 seconds
      setTimeout(() => {
        // Step 6 continued: set debris status to "captured"
        get().addLog(`${droneId} captured ${target.id}`, "success");

        // Step 7: set drone status to "returning"
        get().addLog(`${droneId} returning to ${depot.id}`, "action");

        set((current) => ({
          debris: current.debris.map((item) =>
            item.id === target.id ? { ...item, status: "captured" } : item
          ),
          drones: current.drones.map((d) =>
            d.id === droneId
              ? {
                  ...d,
                  status: "returning",
                  payload: target.mass,
                  flight: {
                    startPosition: debrisPos,
                    targetPosition: depotPos,
                    startTime: Date.now(),
                    duration: returnDurationSec,
                    fuelCost: chosenFuelCost
                  }
                }
              : d
          )
        }));

        // Step 8 & 9:
        // Animate from debris to depot. When drone reaches depot:
        setTimeout(() => {
          // Drone reaches depot -> recovered
          const formattedVal = formatLogValue(target.value);
          get().addLog(
            `${target.id} recovered, +${target.mass} kg, +${formattedVal}`,
            "success"
          );

          set((current) => {
            const thisDrone = current.drones.find((d) => d.id === droneId);
            const remainingFuel = thisDrone
              ? Math.max(0, Math.round((thisDrone.fuel - chosenFuelCost) * 10) / 10)
              : 0;

            return {
              totalRecoveredMass: current.totalRecoveredMass + target.mass,
              totalRecoveredValue: current.totalRecoveredValue + target.value,
              debris: current.debris.map((item) =>
                item.id === target.id
                  ? { ...item, status: "recovered", position: depotPos }
                  : item
              ),
              drones: current.drones.map((d) =>
                d.id === droneId
                  ? {
                      ...d,
                      status: "recovered",
                      position: depotPos,
                      fuel: remainingFuel,
                      payload: 0,
                      targetId: null,
                      flight: undefined
                    }
                  : d
              )
            };
          });

          // After 1 second, set drone status back to "idle"
          setTimeout(() => {
            set((current) => ({
              drones: current.drones.map((d) =>
                d.id === droneId ? { ...d, status: "idle" } : d
              )
            }));
          }, 1000);
        }, returnDurationMs);
      }, 1500);
    }, interceptDurationMs);

    return true;
  },

  autoDispatch: () => {
    const state = get();
    const availableDebris = state.debris
      .filter((item) => item.status === "available")
      .sort((a, b) => b.value - a.value);

    if (availableDebris.length === 0) {
      set({ warning: "No available debris targets for AUTO DISPATCH." });
      return;
    }

    const idleDrones = state.drones.filter((d) => d.status === "idle");
    if (idleDrones.length === 0) {
      const warningText = "No available drone for GO-FETCH command.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
      return;
    }

    let dispatchedCount = 0;
    for (const target of availableDebris) {
      // If no more idle drones remain, all possible drones have been deployed
      const currentIdle = get().drones.filter((d) => d.status === "idle");
      if (currentIdle.length === 0) {
        break;
      }

      const success = get().goFetch(target.id);
      if (success) {
        dispatchedCount++;
      }
    }

    if (dispatchedCount === 0) {
      const warningText = "No available drone for GO-FETCH command.";
      set({ warning: warningText });
      get().addLog(`WARNING: ${warningText}`, "warning");
    }
  },

  resetSimulation: () => {
    set({
      debris: initialDebris,
      drones: initialDrones,
      selectedDebrisId: initialDebris[0].id,
      totalRecoveredMass: 0,
      totalRecoveredValue: 0,
      warning: null,
      logs: [
        {
          id: `reset-${Date.now()}`,
          timestamp: getTimeString(),
          message: "SIMULATION RESET // ALL ASSETS RE-INITIALIZED",
          tone: "info"
        }
      ]
    });
  }
}));
