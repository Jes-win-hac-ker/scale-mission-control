"use client";

import { create } from "zustand";

export type DebrisStatus = "Uncaptured" | "Intercepting" | "Secured";
export type DroneStatus = "Standby" | "Intercepting" | "Returning";

export type Debris = {
  id: string;
  mass: number;
  value: number;
  material: string;
  status: DebrisStatus;
  position: [number, number, number];
  assignedDroneId?: string;
};

export type Drone = {
  id: string;
  fuel: number;
  payload: number;
  status: DroneStatus;
  position: [number, number, number];
  targetId?: string;
  interceptStartedAt?: number;
};

const debrisMaterials = ["Titanium", "Aluminium", "Nickel", "Copper", "Carbon composite"];
const debris: Debris[] = Array.from({ length: 15 }, (_, index) => {
  const angle = (index / 15) * Math.PI * 2;
  const radius = 2.55 + (index % 4) * 0.18;
  return {
    id: `D-${String(index + 1).padStart(2, "0")}`,
    mass: 42 + index * 17,
    value: 7800 + index * 1450,
    material: debrisMaterials[index % debrisMaterials.length],
    status: "Uncaptured",
    position: [Math.cos(angle) * radius, Math.sin(angle * 1.7) * 1.35, Math.sin(angle) * radius] as [
      number,
      number,
      number
    ]
  };
});

const drones: Drone[] = Array.from({ length: 5 }, (_, index) => ({
  id: `S-${String(index + 1).padStart(2, "0")}`,
  fuel: 82 - index * 7,
  payload: 0,
  status: "Standby",
  position: [
    Math.cos((index / 5) * Math.PI * 2) * 3.1,
    0.4 + Math.sin(index) * 0.7,
    Math.sin((index / 5) * Math.PI * 2) * 3.1
  ] as [number, number, number]
}));

type MissionState = {
  debris: Debris[];
  drones: Drone[];
  selectedDebrisId: string;
  missionStartedAt: number;
  recoveredMass: number;
  recoveredValue: number;
  selectDebris: (id: string) => void;
  deploySelected: () => void;
};

export const useMissionStore = create<MissionState>((set, get) => ({
  debris,
  drones,
  selectedDebrisId: debris[0].id,
  missionStartedAt: Date.now(),
  recoveredMass: 0,
  recoveredValue: 0,
  selectDebris: (id) => set({ selectedDebrisId: id }),
  deploySelected: () => {
    const state = get();
    const target = state.debris.find((item) => item.id === state.selectedDebrisId);
    const drone = state.drones.find((item) => item.status === "Standby");
    if (!target || !drone || target.status !== "Uncaptured") return;

    set({
      debris: state.debris.map((item) =>
        item.id === target.id
          ? { ...item, status: "Intercepting", assignedDroneId: drone.id }
          : item
      ),
      drones: state.drones.map((item) =>
        item.id === drone.id
          ? { ...item, status: "Intercepting", targetId: target.id, interceptStartedAt: Date.now() }
          : item
      )
    });

    window.setTimeout(() => {
      set((current) => ({
        debris: current.debris.map((item) =>
          item.id === target.id ? { ...item, status: "Secured" } : item
        ),
        drones: current.drones.map((item) =>
          item.id === drone.id
            ? {
                ...item,
                status: "Standby",
                fuel: Math.max(0, item.fuel - 8),
                payload: target.mass,
                targetId: target.id,
                interceptStartedAt: undefined
              }
            : item
        ),
        recoveredMass: current.recoveredMass + target.mass,
        recoveredValue: current.recoveredValue + target.value
      }));
    }, 5000);
  }
}));
