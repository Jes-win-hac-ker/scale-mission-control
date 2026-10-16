import type { Debris, Drone } from "./store";
import {
  getBerthWorldPosition,
  getDebrisOrbitalPosition,
  getGlobalSimTime
} from "./orbital";

function distance(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface MaterialAssay {
  titanium: number;       // % Structural aerospace titanium / alloys
  preciousMetals: number; // % Platinum group, gold, rare metals
  semiconductor: number;  // % Silicon, Gallium Arsenide, micro-avionics
  propellant: number;     // % Residual Hydrazine, oxidizer, fuel
  silicates: number;      // % Refractory silicates, slag
}

export type SwarmStrategy = "balanced" | "max_yield" | "kessler_defense" | "min_delta_v";

// Derives realistic material spectroscopy assay from material type and seed hash (always sums to 100%)
export function getMaterialAssay(material: string, id: string): MaterialAssay {
  const mat = (material || "").toLowerCase();
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variance = (hash % 7) - 3; // -3% to +3% variance

  let titanium = 66;
  let preciousMetals = 12;
  let semiconductor = 10;
  let propellant = 4;

  if (mat.includes("rocket") || mat.includes("booster") || mat.includes("fairing")) {
    titanium = Math.max(40, Math.min(72, 58 + variance));
    preciousMetals = Math.max(3, 6 + Math.floor(variance / 2));
    semiconductor = Math.max(3, 8 - variance);
    propellant = Math.max(8, Math.min(28, 20 + variance));
  } else if (mat.includes("solar") || mat.includes("battery")) {
    titanium = Math.max(15, 22 + variance);
    preciousMetals = Math.max(5, 14 + variance);
    semiconductor = Math.max(35, Math.min(62, 52 - variance));
    propellant = 4;
  } else if (mat.includes("chondrite") || mat.includes("meteorite") || mat.includes("shard")) {
    titanium = Math.max(12, 18 + variance);
    preciousMetals = Math.max(10, Math.min(35, 24 + variance * 2));
    semiconductor = 5;
    propellant = 5;
  } else {
    titanium = Math.max(50, 68 + variance);
    preciousMetals = Math.max(5, 12 + variance);
    semiconductor = Math.max(4, 10 - variance);
    propellant = 3;
  }

  const silicates = Math.max(2, 100 - (titanium + preciousMetals + semiconductor + propellant));
  // Adjust titanium by any clamping residual so sum is strictly 100
  const residual = 100 - (titanium + preciousMetals + semiconductor + propellant + silicates);

  return {
    titanium: titanium + residual,
    preciousMetals,
    semiconductor,
    propellant,
    silicates
  };
}

// Tsiolkovsky Rocket Equation & Mass-Dependent Delta-V Calculation
// Isp = 280s, g0 = 9.80665 m/s^2, dry mass = 120 kg
const DRONE_DRY_MASS = 120; // kg
const ISP = 280;            // seconds
const G0 = 9.80665;         // m/s^2
const EXHAUST_VELOCITY = ISP * G0; // ~2745 m/s

export function calculateDeltaV(dist: number, payloadMass = 0): number {
  // Transfer orbital velocity scale: 1 world unit ~ 1.25 km/s transfer delta-v
  const baseDeltaV = dist * 1250; 
  // Inertia penalty when towing mass
  const inertiaFactor = 1 + (payloadMass / DRONE_DRY_MASS) * 0.45;
  return Math.round(baseDeltaV * inertiaFactor);
}

export function calculateFuelBurn(distOutbound: number, distInbound: number, payloadMass: number): number {
  // Outbound burn (empty drone)
  const dvOut = calculateDeltaV(distOutbound, 0);
  const fuelOut = DRONE_DRY_MASS * (Math.exp(dvOut / (EXHAUST_VELOCITY * 3.5)) - 1);

  // Inbound burn (towing heavy payload)
  const dvIn = calculateDeltaV(distInbound, payloadMass);
  const totalMassIn = DRONE_DRY_MASS + payloadMass;
  const fuelIn = totalMassIn * (Math.exp(dvIn / (EXHAUST_VELOCITY * 3.5)) - 1);

  // Normalized to game fuel units (1 unit ~ 10 kg propellant)
  const totalFuel = (fuelOut + fuelIn) / 10;
  return Math.max(1.5, Math.round(totalFuel * 10) / 10);
}

// Kessler Syndrome Collision Threat Index (10 to 99)
export function calculateKesslerThreat(debris: Debris): number {
  const pos = debris.position;
  const r = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
  // Higher mass & lower altitude orbits have higher traffic cross-section
  const altitudeDensity = Math.max(0.5, 3.5 - r); 
  const massFactor = debris.mass / 100;
  const rawScore = massFactor * altitudeDensity * 18;
  return Math.max(12, Math.min(99, Math.round(rawScore)));
}

// Hungarian / Kuhn-Munkres Algorithm for Optimal Bipartite Fleet Assignment
// Given N drones and M debris items, computes the global minimum-cost pairing
export function solveHungarianMatching(
  drones: Drone[],
  debrisList: Debris[],
  depotPos: [number, number, number],
  strategy: SwarmStrategy,
  simTimeSec?: number
): { droneId: string; targetId: string; cost: number }[] {
  // Fuel constraint removed: all idle drones are fully operational and unconstrained
  const idleDrones = drones.filter((d) => d.status === "idle");
  const availableDebris = debrisList.filter((d) => d.status === "available");

  if (idleDrones.length === 0 || availableDebris.length === 0) {
    return [];
  }

  const timeSec = simTimeSec ?? getGlobalSimTime();
  const numDrones = idleDrones.length;
  const numTargets = availableDebris.length;
  const dim = Math.max(numDrones, numTargets);

  // Cost matrix initialization
  const costMatrix: number[][] = Array.from({ length: dim }, () => Array(dim).fill(1e9));

  for (let i = 0; i < numDrones; i++) {
    const drone = idleDrones[i];
    const liveDronePos = getBerthWorldPosition(drone.berthId, timeSec);
    for (let j = 0; j < numTargets; j++) {
      const target = availableDebris[j];
      const liveTargetPos = getDebrisOrbitalPosition(target, timeSec);
      const distOut = distance(liveDronePos, liveTargetPos);
      const distIn = distance(liveTargetPos, depotPos);
      const fuelCost = calculateFuelBurn(distOut, distIn, target.mass);

      const threat = calculateKesslerThreat(target);
      const valueNorm = target.value / 1_000_000; // in Millions

      let score = 0;
      switch (strategy) {
        case "min_delta_v":
          // Pure propellant conservation
          score = fuelCost * 10;
          break;
        case "max_yield":
          // Maximum economic value per unit fuel
          score = (fuelCost / Math.max(0.1, valueNorm)) * 10;
          break;
        case "kessler_defense":
          // Maximum collision threat mitigation
          score = (fuelCost / Math.max(1, threat)) * 50;
          break;
        case "balanced":
        default:
          score = (fuelCost / (Math.sqrt(Math.max(0.1, valueNorm)) * Math.sqrt(threat))) * 25;
          break;
      }

      costMatrix[i][j] = Math.max(0.1, score);
    }
  }

  // Classic Munkres / Hungarian Step Implementation
  const u = new Array(dim + 1).fill(0);
  const v = new Array(dim + 1).fill(0);
  const p = new Array(dim + 1).fill(0);
  const way = new Array(dim + 1).fill(0);

  for (let i = 1; i <= dim; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(dim + 1).fill(Infinity);
    const used = new Array(dim + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= dim; j++) {
        if (!used[j]) {
          const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= dim; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result: { droneId: string; targetId: string; cost: number }[] = [];
  for (let j = 1; j <= dim; j++) {
    const droneIdx = p[j] - 1;
    const targetIdx = j - 1;

    if (droneIdx < numDrones && targetIdx < numTargets) {
      const c = costMatrix[droneIdx][targetIdx];
      if (c < 1e7) {
        result.push({
          droneId: idleDrones[droneIdx].id,
          targetId: availableDebris[targetIdx].id,
          cost: c
        });
      }
    }
  }

  return result;
}
