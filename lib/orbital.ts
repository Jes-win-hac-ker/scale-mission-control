import * as THREE from "three";
import type { Debris } from "./store";

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
