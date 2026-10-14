import * as THREE from "three";
import type { Debris, Drone } from "./store";

// Global unified simulation clock (synchronized directly to Three.js clock.elapsedTime)
let globalSimTime = 0;

export function setGlobalSimTime(timeSec: number): void {
  globalSimTime = timeSec;
}

export function getGlobalSimTime(): number {
  return globalSimTime;
}

export interface OrbitalBasis {
  radius: number;
  u: [number, number, number];
  v: [number, number, number];
  omega: number;
}

// Generates a deterministic orbital plane & angular rate for a debris item
export function getDebrisOrbitalBasis(debris: Debris): OrbitalBasis {
  const p0 = new THREE.Vector3(...debris.position);
  const radius = p0.length();
  const u = p0.clone().normalize();

  // Deterministic tilt & phase pseudo-randomized by debris ID characters
  const hash = debris.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const ref = new THREE.Vector3(
    Math.sin(hash * 0.73) * 0.35,
    0.94,
    Math.cos(hash * 0.73) * 0.35
  );

  let v = new THREE.Vector3().crossVectors(ref, u);
  if (v.lengthSq() < 0.01) {
    v = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), u);
  }
  v.normalize();

  // Kepler's Third Law approximation: angular velocity decreases with orbital radius r
  // Alternate prograde vs retrograde orbits
  const dir = hash % 2 === 0 ? 1 : -1;
  const omega = dir * (0.16 / Math.pow(Math.max(1.5, radius), 1.5));

  return {
    radius,
    u: [u.x, u.y, u.z],
    v: [v.x, v.y, v.z],
    omega
  };
}

// Computes current 3D position [x, y, z] of an orbiting satellite/debris at any given time (seconds)
export function getDebrisOrbitalPosition(
  debris: Debris,
  timeSec: number
): [number, number, number] {
  const { radius, u, v, omega } = getDebrisOrbitalBasis(debris);
  const theta = omega * timeSec;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  return [
    (u[0] * cosT + v[0] * sinT) * radius,
    (u[1] * cosT + v[1] * sinT) * radius,
    (u[2] * cosT + v[2] * sinT) * radius
  ];
}

// Generates circular/elliptical orbital trace ring samples for 3D trajectory visualization
export function getDebrisOrbitTrackSamples(
  debris: Debris,
  segments = 64
): [number, number, number][] {
  const { radius, u, v } = getDebrisOrbitalBasis(debris);
  const samples: [number, number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    samples.push([
      (u[0] * cosT + v[0] * sinT) * radius,
      (u[1] * cosT + v[1] * sinT) * radius,
      (u[2] * cosT + v[2] * sinT) * radius
    ]);
  }

  return samples;
}

// Calculates elevated 3D control point for orbital transfer arc around Earth's gravity well
export function getOrbitalArcControlPoint(
  start: [number, number, number],
  target: [number, number, number]
): THREE.Vector3 {
  const pA = new THREE.Vector3(...start);
  const pB = new THREE.Vector3(...target);
  const rA = pA.length();
  const rB = pB.length();

  const chordMid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
  const chordLen = chordMid.length();

  let radialDir: THREE.Vector3;
  if (chordLen < 0.08) {
    // Antipodal transfer: select perpendicular vector
    radialDir = new THREE.Vector3(-pA.y, pA.x, pA.z);
    if (radialDir.lengthSq() < 0.01) {
      radialDir = new THREE.Vector3(pA.z, pA.y, -pA.x);
    }
    radialDir.normalize();
  } else {
    radialDir = chordMid.clone().normalize();
  }

  // Apex altitude comfortably clears Earth (radius 1.35) and adheres to safe transfer corridor
  const maxR = Math.max(rA, rB);
  const apexRadius = Math.max(maxR * 1.15, 1.85);

  // Control point for quadratic Bezier: B(0.5) = 0.5 * chordMid + 0.5 * C = radialDir * apexRadius
  return radialDir.clone().multiplyScalar(2 * apexRadius).sub(chordMid);
}

// Interpolates 3D coordinates along curved orbital transfer arc at progress t (0 to 1)
export function getOrbitalArcPoint(
  start: [number, number, number],
  target: [number, number, number],
  t: number
): [number, number, number] {
  const clampedT = Math.min(1, Math.max(0, t));
  const pA = new THREE.Vector3(...start);
  const pB = new THREE.Vector3(...target);
  const pC = getOrbitalArcControlPoint(start, target);

  const invT = 1 - clampedT;
  const pos = new THREE.Vector3()
    .addScaledVector(pA, invT * invT)
    .addScaledVector(pC, 2 * invT * clampedT)
    .addScaledVector(pB, clampedT * clampedT);

  return [pos.x, pos.y, pos.z];
}

// Computes normalized velocity tangent vector along curved orbital transfer arc at progress t
export function getOrbitalArcTangent(
  start: [number, number, number],
  target: [number, number, number],
  t: number
): [number, number, number] {
  const clampedT = Math.min(1, Math.max(0, t));
  const pA = new THREE.Vector3(...start);
  const pB = new THREE.Vector3(...target);
  const pC = getOrbitalArcControlPoint(start, target);

  const invT = 1 - clampedT;
  const tangent = new THREE.Vector3()
    .addScaledVector(pC.clone().sub(pA), 2 * invT)
    .addScaledVector(pB.clone().sub(pC), 2 * clampedT);

  if (tangent.lengthSq() < 0.0001) {
    const direct = pB.clone().sub(pA).normalize();
    return [direct.x, direct.y, direct.z];
  }
  tangent.normalize();
  return [tangent.x, tangent.y, tangent.z];
}

// Generates multi-segment path along curved orbital transfer arc for trajectory line rendering
export function getOrbitalArcSamples(
  start: [number, number, number],
  target: [number, number, number],
  segments = 36
): [number, number, number][] {
  const samples: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    samples.push(getOrbitalArcPoint(start, target, t));
  }
  return samples;
}

// Unified angular rotation speed for DEPOT-01 centrifugal habitat ring (rad/s)
export const STATION_RING_ROTATION_SPEED = 0.22;

export function getStationRingAngle(timeSec: number): number {
  return timeSec * STATION_RING_ROTATION_SPEED;
}

export interface StationOrbitalBasis {
  radius: number;
  u: [number, number, number];
  v: [number, number, number];
  normal: [number, number, number];
  omega: number;
}

// Generates deterministic Keplerian orbital plane and angular rate for the Recovery Depot (DEPOT-01)
// Starting position: [0.0, 2.7, 2.7] (~3.818 radius, High Orbital Staging Gateway overlooking debris field)
export function getStationOrbitalBasis(depot?: { position?: [number, number, number] }): StationOrbitalBasis {
  const p0 = new THREE.Vector3(...(depot?.position || [0.0, 2.7, 2.7]));
  const radius = p0.length();
  const u = p0.clone().normalize();

  // Distinct inclined orbit normal (inclination ~48°, stable prograde recovery corridor)
  const ref = new THREE.Vector3(0.88, 0.35, -0.32).normalize();
  let v = new THREE.Vector3().crossVectors(ref, u);
  if (v.lengthSq() < 0.01) {
    v = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), u);
  }
  v.normalize();
  const normal = new THREE.Vector3().crossVectors(u, v).normalize();

  // Keplerian angular rate for high orbit ~0.038 rad/s (graceful full orbit every ~165s)
  const omega = 0.038;

  return {
    radius,
    u: [u.x, u.y, u.z],
    v: [v.x, v.y, v.z],
    normal: [normal.x, normal.y, normal.z],
    omega
  };
}

// Computes current 3D position [x, y, z] of DEPOT-01 docking station at any given time (seconds)
export function getStationOrbitalPosition(
  timeSec: number,
  depot?: { position?: [number, number, number] }
): [number, number, number] {
  const { radius, u, v, omega } = getStationOrbitalBasis(depot);
  const theta = omega * timeSec;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  return [
    (u[0] * cosT + v[0] * sinT) * radius,
    (u[1] * cosT + v[1] * sinT) * radius,
    (u[2] * cosT + v[2] * sinT) * radius
  ];
}

export function getDepotOrbitalPosition(
  depot: { position?: [number, number, number] } | undefined,
  timeSec: number
): [number, number, number] {
  return getStationOrbitalPosition(timeSec, depot);
}

// Full orbital attitude, quaternion, and transform matrix for DEPOT-01
// - Nadir (local -Y) faces Earth center (downlink & smelting vortex point toward Earth)
// - Zenith (local +Y) faces deep space (comm mast & staging gantry face zenith)
// - Prograde (local +Z) aligns with orbital flight velocity
// - Orbit Normal (local +X) aligns with solar panel boom
export function getStationTransform(
  timeSec: number,
  depot?: { position?: [number, number, number] }
): {
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  rotationMatrix: THREE.Matrix4;
  nadir: [number, number, number];
  zenith: [number, number, number];
  prograde: [number, number, number];
} {
  const { radius, u, v, omega } = getStationOrbitalBasis(depot);
  const theta = omega * timeSec;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const uVec = new THREE.Vector3(...u);
  const vVec = new THREE.Vector3(...v);

  const pos = new THREE.Vector3()
    .addScaledVector(uVec, cosT)
    .addScaledVector(vVec, sinT)
    .multiplyScalar(radius);

  // Local +Y = Zenith (radial outward from Earth)
  const yLocal = pos.clone().normalize();
  const nadir = yLocal.clone().negate();

  // Local +Z = Prograde velocity tangent: d/dt(pos)
  const zLocal = new THREE.Vector3()
    .addScaledVector(uVec, -sinT)
    .addScaledVector(vVec, cosT)
    .normalize();

  // Local +X = Orbit normal via right-hand rule (yLocal cross zLocal)
  const xLocal = new THREE.Vector3().crossVectors(yLocal, zLocal).normalize();

  const rotMatrix = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
  const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

  return {
    position: [pos.x, pos.y, pos.z],
    quaternion: quat,
    rotationMatrix: rotMatrix,
    nadir: [nadir.x, nadir.y, nadir.z],
    zenith: [yLocal.x, yLocal.y, yLocal.z],
    prograde: [zLocal.x, zLocal.y, zLocal.z]
  };
}

// Generates circular orbital trace ring samples for DEPOT-01 trajectory visualization
export function getStationOrbitTrackSamples(
  segments = 96,
  depot?: { position?: [number, number, number] }
): [number, number, number][] {
  const { radius, u, v } = getStationOrbitalBasis(depot);
  const samples: [number, number, number][] = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    samples.push([
      (u[0] * cosT + v[0] * sinT) * radius,
      (u[1] * cosT + v[1] * sinT) * radius,
      (u[2] * cosT + v[2] * sinT) * radius
    ]);
  }

  return samples;
}

// Mooring Berth IDs and Spatial Config for DEPOT-01 Ring & Staging
export type DroneBerthId = "B1" | "B2" | "B3" | "B4" | "STAGING";

export interface BerthConfig {
  id: DroneBerthId;
  label: string;
  localPos: [number, number, number];
  outwardAngle: number; // Base angle around Y axis
}

export const BERTH_CONFIGS: Record<DroneBerthId, BerthConfig> = {
  B1: { id: "B1", label: "Mooring Berth B1 (Port)", localPos: [0.38, 0, 0], outwardAngle: 0 },
  B2: { id: "B2", label: "Mooring Berth B2 (Starboard)", localPos: [-0.38, 0, 0], outwardAngle: Math.PI },
  B3: { id: "B3", label: "Mooring Berth B3 (Forward)", localPos: [0, 0, 0.38], outwardAngle: Math.PI / 2 },
  B4: { id: "B4", label: "Mooring Berth B4 (Aft)", localPos: [0, 0, -0.38], outwardAngle: -Math.PI / 2 },
  STAGING: { id: "STAGING", label: "Orbital Reserve Staging Gantry", localPos: [0, 0.55, 0], outwardAngle: 0 }
};

// Computes real-time 3D world coordinate of a station mooring berth taking into account ring rotation & station orbit
export function getBerthWorldPosition(
  berthId: DroneBerthId,
  depotPosOrTimeSec: [number, number, number] | number,
  ringRotationY?: number
): [number, number, number] {
  const cfg = BERTH_CONFIGS[berthId];

  if (typeof depotPosOrTimeSec === "number") {
    const timeSec = depotPosOrTimeSec;
    const { position, rotationMatrix } = getStationTransform(timeSec);
    const rotRing = getStationRingAngle(timeSec);

    let localVec: THREE.Vector3;
    if (berthId === "STAGING") {
      localVec = new THREE.Vector3(...cfg.localPos);
    } else {
      const cos = Math.cos(rotRing);
      const sin = Math.sin(rotRing);
      const lx = cfg.localPos[0];
      const lz = cfg.localPos[2];
      const rx = lx * cos + lz * sin;
      const rz = -lx * sin + lz * cos;
      localVec = new THREE.Vector3(rx, cfg.localPos[1], rz);
    }

    localVec.applyMatrix4(rotationMatrix);
    return [
      position[0] + localVec.x,
      position[1] + localVec.y,
      position[2] + localVec.z
    ];
  }

  // Fallback for static depot position input:
  const depotPos = depotPosOrTimeSec;
  if (berthId === "STAGING") {
    return [depotPos[0] + cfg.localPos[0], depotPos[1] + cfg.localPos[1], depotPos[2] + cfg.localPos[2]];
  }
  const rot = ringRotationY ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const lx = cfg.localPos[0];
  const lz = cfg.localPos[2];
  const rx = lx * cos + lz * sin;
  const rz = -lx * sin + lz * cos;
  return [depotPos[0] + rx, depotPos[1] + cfg.localPos[1], depotPos[2] + rz];
}

// Computes outward orientation vector from depot center to berth for docking alignment
export function getBerthOutwardNormal(
  berthId: DroneBerthId,
  ringRotationY: number,
  stationQuat?: THREE.Quaternion
): [number, number, number] {
  if (berthId === "STAGING") {
    const v = new THREE.Vector3(0, 0, 1);
    if (stationQuat) {
      v.applyQuaternion(stationQuat);
    }
    return [v.x, v.y, v.z];
  }
  const cos = Math.cos(ringRotationY);
  const sin = Math.sin(ringRotationY);
  const cfg = BERTH_CONFIGS[berthId];
  const lx = cfg.localPos[0];
  const lz = cfg.localPos[2];
  const rx = lx * cos + lz * sin;
  const rz = -lx * sin + lz * cos;
  const len = Math.sqrt(rx * rx + rz * rz) || 1;
  const localVec = new THREE.Vector3(rx / len, 0, rz / len);
  if (stationQuat) {
    localVec.applyQuaternion(stationQuat);
  }
  return [localVec.x, localVec.y, localVec.z];
}

// Underside ISRU Smelting Vortex core intake coordinate
export function getSmeltingIntakePosition(
  depotPosOrTimeSec: [number, number, number] | number
): [number, number, number] {
  if (typeof depotPosOrTimeSec === "number") {
    const { position, rotationMatrix } = getStationTransform(depotPosOrTimeSec);
    const localVec = new THREE.Vector3(0, -0.48, 0).applyMatrix4(rotationMatrix);
    return [position[0] + localVec.x, position[1] + localVec.y, position[2] + localVec.z];
  }
  return [depotPosOrTimeSec[0], depotPosOrTimeSec[1] - 0.48, depotPosOrTimeSec[2]];
}

// Underside stand-off hover coordinate where returning drones hold while releasing payload
export function getSmeltingStandOffPosition(
  depotPosOrTimeSec: [number, number, number] | number
): [number, number, number] {
  if (typeof depotPosOrTimeSec === "number") {
    const { position, rotationMatrix } = getStationTransform(depotPosOrTimeSec);
    const localVec = new THREE.Vector3(0, -0.70, 0).applyMatrix4(rotationMatrix);
    return [position[0] + localVec.x, position[1] + localVec.y, position[2] + localVec.z];
  }
  return [depotPosOrTimeSec[0], depotPosOrTimeSec[1] - 0.70, depotPosOrTimeSec[2]];
}

// Distinct spatial holding pattern coordinates for drones in DEPOT-01 approach queue
// Local coordinates relative to station center & orientation matrix to prevent collision
export const HOLDING_PATTERN_SLOTS: [number, number, number][] = [
  [-0.95, -0.75, -0.45], // Holding Slot 1 (Port Aft Standoff)
  [0.95, -0.75, -0.45],  // Holding Slot 2 (Starboard Aft Standoff)
  [0.0, -1.15, 0.75],   // Holding Slot 3 (Lower Forward Tier)
  [0.0, -1.15, -0.85],  // Holding Slot 4 (Lower Aft Tier)
  [-1.25, -0.90, 0.0],  // Holding Slot 5 (Port Flank Standoff)
  [1.25, -0.90, 0.0]    // Holding Slot 6 (Starboard Flank Standoff)
];

// Computes real-time 3D world coordinate of a designated traffic control holding slot
export function getStationHoldingPosition(
  slotIndex: number,
  timeSec: number,
  depot?: { position?: [number, number, number] }
): [number, number, number] {
  const { position, rotationMatrix } = getStationTransform(timeSec, depot);
  const safeIdx = Math.abs(slotIndex) % HOLDING_PATTERN_SLOTS.length;
  const slot = HOLDING_PATTERN_SLOTS[safeIdx];
  const localVec = new THREE.Vector3(...slot).applyMatrix4(rotationMatrix);
  return [position[0] + localVec.x, position[1] + localVec.y, position[2] + localVec.z];
}

function dist3(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Predictive Keplerian Rendezvous Solver:
// Solves for exact future coordinates where drone intercept arc and orbiting debris will meet
export function calculateRendezvousTrajectory(
  startPos: [number, number, number],
  debris: Debris,
  startTimeSec: number,
  droneSpeed = 0.5
): {
  durationSec: number;
  rendezvousPosition: [number, number, number];
  distance: number;
} {
  const d0 = dist3(startPos, getDebrisOrbitalPosition(debris, startTimeSec));
  const t0 = Math.min(13.0, Math.max(5.5, d0 / droneSpeed));

  // Iteration 1: Update target position based on t0
  const pos1 = getDebrisOrbitalPosition(debris, startTimeSec + t0);
  const d1 = dist3(startPos, pos1);
  const t1 = Math.min(13.0, Math.max(5.5, d1 / droneSpeed));

  // Iteration 2: Refine target position based on t1
  const pos2 = getDebrisOrbitalPosition(debris, startTimeSec + t1);
  const d2 = dist3(startPos, pos2);
  const t2 = Math.min(13.0, Math.max(5.5, d2 / droneSpeed));

  const finalPos = getDebrisOrbitalPosition(debris, startTimeSec + t2);
  const outward = new THREE.Vector3(...finalPos).normalize();
  const standoffPos: [number, number, number] = [
    finalPos[0] + outward.x * 0.09,
    finalPos[1] + outward.y * 0.09,
    finalPos[2] + outward.z * 0.09
  ];
  const finalDist = dist3(startPos, standoffPos);

  return {
    durationSec: t2,
    rendezvousPosition: standoffPos,
    distance: finalDist
  };
}

// Predictive Keplerian Rendezvous Solver for Inbound Drone Return:
// Solves for exact future coordinates where returning drone arc and orbiting station smelting standoff will meet
export function calculateDepotRendezvousTrajectory(
  startPos: [number, number, number],
  depot: { position?: [number, number, number] } | undefined,
  startTimeSec: number,
  droneSpeed = 0.5
): {
  durationSec: number;
  rendezvousPosition: [number, number, number];
  distance: number;
} {
  const d0 = dist3(startPos, getSmeltingStandOffPosition(startTimeSec));
  const t0 = Math.min(13.0, Math.max(5.5, d0 / droneSpeed));

  // Iteration 1: refine target standoff based on t0
  const pos1 = getSmeltingStandOffPosition(startTimeSec + t0);
  const d1 = dist3(startPos, pos1);
  const t1 = Math.min(13.0, Math.max(5.5, d1 / droneSpeed));

  // Iteration 2: refine target standoff based on t1
  const pos2 = getSmeltingStandOffPosition(startTimeSec + t1);
  const d2 = dist3(startPos, pos2);
  const t2 = Math.min(13.0, Math.max(5.5, d2 / droneSpeed));

  const finalPos = getSmeltingStandOffPosition(startTimeSec + t2);
  const finalDist = dist3(startPos, finalPos);

  return {
    durationSec: t2,
    rendezvousPosition: finalPos,
    distance: finalDist
  };
}

// Physical Earth radius in kilometers and 3D simulation scaling constant
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_SCENE = 1.35;
export const KM_PER_SCENE_UNIT = EARTH_RADIUS_KM / EARTH_RADIUS_SCENE; // ~4719.26 km/unit

export interface DebrisSpatialCoordinates {
  scenePos: [number, number, number];
  kmPos: [number, number, number];
  altitudeKm: number;
  orbitalRadiusKm: number;
}

export interface DifferentialVectorState {
  targetKm: [number, number, number];
  observerKm: [number, number, number];
  deviationKm: [number, number, number]; // Target (where it isn't) minus Observer (where it is)
  rangeKm: number;
  normalizedDirection: [number, number, number];
}

// Converts scene 3D coordinates into real-world orbital telemetry in kilometers
export function getDebrisSpatialCoordinates(
  debris: Debris,
  timeSec: number
): DebrisSpatialCoordinates {
  const scenePos = getDebrisOrbitalPosition(debris, timeSec);
  const kmPos: [number, number, number] = [
    scenePos[0] * KM_PER_SCENE_UNIT,
    scenePos[1] * KM_PER_SCENE_UNIT,
    scenePos[2] * KM_PER_SCENE_UNIT
  ];
  const rScene = Math.sqrt(
    scenePos[0] * scenePos[0] + scenePos[1] * scenePos[1] + scenePos[2] * scenePos[2]
  );
  const orbitalRadiusKm = rScene * KM_PER_SCENE_UNIT;
  const altitudeKm = Math.max(0, orbitalRadiusKm - EARTH_RADIUS_KM);

  return {
    scenePos,
    kmPos,
    altitudeKm,
    orbitalRadiusKm
  };
}

// Computes the Differential State Vector ("where it is" vs "where it isn't")
export function getDifferentialVectorState(
  targetScenePos: [number, number, number],
  observerScenePos: [number, number, number]
): DifferentialVectorState {
  const targetKm: [number, number, number] = [
    targetScenePos[0] * KM_PER_SCENE_UNIT,
    targetScenePos[1] * KM_PER_SCENE_UNIT,
    targetScenePos[2] * KM_PER_SCENE_UNIT
  ];
  const observerKm: [number, number, number] = [
    observerScenePos[0] * KM_PER_SCENE_UNIT,
    observerScenePos[1] * KM_PER_SCENE_UNIT,
    observerScenePos[2] * KM_PER_SCENE_UNIT
  ];

  const dx = targetKm[0] - observerKm[0];
  const dy = targetKm[1] - observerKm[1];
  const dz = targetKm[2] - observerKm[2];
  const rangeKm = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const norm = rangeKm > 0.001 ? rangeKm : 1;
  const normalizedDirection: [number, number, number] = [dx / norm, dy / norm, dz / norm];

  return {
    targetKm,
    observerKm,
    deviationKm: [dx, dy, dz],
    rangeKm,
    normalizedDirection
  };
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Computes exact blended 3D coordinates for drones in transit with continuous boundary alignment
export function calculateBlendedDroneFlightPosition(
  drone: Drone,
  timeSec: number,
  debrisList?: Debris[]
): [number, number, number] {
  if (!drone.flight) return drone.position;

  const elapsed = drone.flight.startSimTime !== undefined
    ? timeSec - drone.flight.startSimTime
    : (timeSec * 1000 - drone.flight.startTime) / 1000;
  const progress = Math.min(1, Math.max(0, elapsed / drone.flight.duration));
  const eased = easeInOutQuad(progress);

  const arcPos = getOrbitalArcPoint(drone.flight.startPosition, drone.flight.targetPosition, eased);

  if (drone.status === "intercepting") {
    // 1. Live moving berth at launch
    const liveBerth = getBerthWorldPosition(drone.berthId, timeSec);
    // 2. Live moving target debris standoff at arrival
    const target = drone.targetId ? debrisList?.find((d) => d.id === drone.targetId) : undefined;
    const liveDebris = target
      ? getDebrisOrbitalPosition(target, timeSec)
      : drone.flight.targetPosition;
    const outward = new THREE.Vector3(...liveDebris).normalize();
    const liveTarget: [number, number, number] = [
      liveDebris[0] + outward.x * 0.09,
      liveDebris[1] + outward.y * 0.09,
      liveDebris[2] + outward.z * 0.09
    ];

    const startBlend = (1 - progress) * (1 - progress);
    const endBlend = progress * progress;

    return [
      arcPos[0] + (liveBerth[0] - drone.flight.startPosition[0]) * startBlend + (liveTarget[0] - drone.flight.targetPosition[0]) * endBlend,
      arcPos[1] + (liveBerth[1] - drone.flight.startPosition[1]) * startBlend + (liveTarget[1] - drone.flight.targetPosition[1]) * endBlend,
      arcPos[2] + (liveBerth[2] - drone.flight.startPosition[2]) * startBlend + (liveTarget[2] - drone.flight.targetPosition[2]) * endBlend
    ];
  }

  if (drone.status === "returning") {
    // 1. Live moving capture point at start
    const target = drone.targetId ? debrisList?.find((d) => d.id === drone.targetId) : undefined;
    const liveCapture = target
      ? getDebrisOrbitalPosition(target, timeSec)
      : drone.flight.startPosition;
    // 2. Live moving smelting standoff at station
    const liveStandOff = getSmeltingStandOffPosition(timeSec);

    const startBlend = (1 - progress) * (1 - progress);
    const endBlend = progress * progress;

    return [
      arcPos[0] + (liveCapture[0] - drone.flight.startPosition[0]) * startBlend + (liveStandOff[0] - drone.flight.targetPosition[0]) * endBlend,
      arcPos[1] + (liveCapture[1] - drone.flight.startPosition[1]) * startBlend + (liveStandOff[1] - drone.flight.targetPosition[1]) * endBlend,
      arcPos[2] + (liveCapture[2] - drone.flight.startPosition[2]) * startBlend + (liveStandOff[2] - drone.flight.targetPosition[2]) * endBlend
    ];
  }

  return arcPos;
}

// Real-time flight position calculator for drones along curved transfer arcs and docked berths
export function getDroneWorldPosition(
  drone: Drone,
  depotPosOrTimeSec: [number, number, number] | number,
  timeSec: number,
  debrisList?: Debris[]
): [number, number, number] {
  if (drone.flight && (drone.status === "intercepting" || drone.status === "returning")) {
    return calculateBlendedDroneFlightPosition(drone, timeSec, debrisList);
  }
  if (drone.status === "capturing" && drone.targetId) {
    const target = debrisList?.find((d) => d.id === drone.targetId);
    if (target) {
      const dPos = getDebrisOrbitalPosition(target, timeSec);
      if (drone.subStatus === "detumbling") {
        const outward = new THREE.Vector3(...dPos).normalize();
        return [
          dPos[0] + outward.x * 0.09,
          dPos[1] + outward.y * 0.09,
          dPos[2] + outward.z * 0.09
        ];
      }
      return dPos;
    }
  }
  if (drone.subStatus === "holding") {
    return getStationHoldingPosition(0, timeSec);
  }
  if (drone.subStatus === "ingesting") {
    return getSmeltingStandOffPosition(timeSec);
  }
  if (drone.subStatus === "docking") {
    return getBerthWorldPosition(drone.berthId, timeSec);
  }
  if (drone.status === "idle" || drone.status === "recovered" || drone.subStatus === "docked") {
    return getBerthWorldPosition(drone.berthId, timeSec);
  }
  return drone.position;
}



