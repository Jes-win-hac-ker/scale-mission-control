"use client";

import { Billboard, Html, Line, OrbitControls, Stars, useGLTF, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  Debris,
  Drone,
  RecoveryDepot,
  useMissionStore
} from "@/lib/store";
import {
  DroneBerthId,
  getBerthOutwardNormal,
  getBerthWorldPosition,
  getDebrisOrbitalPosition,
  getDebrisOrbitTrackSamples,
  getDifferentialVectorState,
  getDroneWorldPosition,
  getOrbitalArcPoint,
  getOrbitalArcSamples,
  getOrbitalArcTangent,
  getSmeltingIntakePosition,
  getSmeltingStandOffPosition,
  getStationRingAngle,
  STATION_RING_ROTATION_SPEED
} from "@/lib/orbital";


// Smooth quadratic easing for fluid time-based movement
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Multi-Bay Orbital Recovery Hub "DEPOT-01"
function OrbitalRecoveryStation({
  depot,
  drones
}: {
  depot: RecoveryDepot;
  drones: Drone[];
}) {
  const stationGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Group>(null);
  const radarRef = useRef<THREE.Group>(null);
  const solarBoomRef = useRef<THREE.Group>(null);
  const intakePulseRef = useRef<THREE.Mesh>(null);
  const smeltingFlashRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);

  const addLog = useMissionStore((state) => state.addLog);
  const totalRecoveredMass = useMissionStore((state) => state.totalRecoveredMass);
  const totalRecoveredValue = useMissionStore((state) => state.totalRecoveredValue);
  const lastSmeltedAt = useMissionStore((state) => state.lastSmeltedAt);
  const focusEntity = useMissionStore((state) => state.focusEntity);

  // Check if any drone is docking or recovering payload
  const isSmeltingActive = useMemo(() => {
    return lastSmeltedAt ? Date.now() - lastSmeltedAt < 3200 : false;
  }, [lastSmeltedAt]);

  const drone05 = drones.find((d) => d.id === "DRONE-05");
  const isStagingDocked = drone05 && (drone05.status === "idle" || drone05.subStatus === "docked");
  const isStagingIncoming = drone05 && (drone05.status === "returning" || drone05.subStatus === "docking");

  useFrame(({ clock }, delta) => {
    // 1. Mathematically synchronized centrifugal spin of habitat ring and berths
    if (ringRef.current) {
      ringRef.current.rotation.y = getStationRingAngle(clock.elapsedTime);
    }

    // 2. High-frequency telemetry sweep of communications radar dish
    if (radarRef.current) {
      radarRef.current.rotation.y += delta * 1.6;
    }

    // 3. Continuous Sun-tracking articulation of solar array wings
    if (solarBoomRef.current) {
      solarBoomRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.08 + 0.22;
    }

    // 4. Underside Smelting Reactor and Electromagnetic Field Dynamics
    if (intakePulseRef.current) {
      const activeSmelt = lastSmeltedAt ? Date.now() - lastSmeltedAt < 3200 : false;
      if (activeSmelt) {
        const pulse = 0.8 + Math.sin(clock.elapsedTime * 24) * 0.2;
        (intakePulseRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
        (intakePulseRef.current.material as THREE.MeshBasicMaterial).color.set("#FFAA00");
        intakePulseRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 16) * 0.18);
      } else {
        const pulse = 0.5 + Math.sin(clock.elapsedTime * 5) * 0.25;
        (intakePulseRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
        (intakePulseRef.current.material as THREE.MeshBasicMaterial).color.set("#00FFFF");
        intakePulseRef.current.scale.setScalar(1);
      }
    }

    // 5. Smelting thermal flare intensity decay
    if (smeltingFlashRef.current) {
      const activeSmelt = lastSmeltedAt ? Date.now() - lastSmeltedAt < 3200 : false;
      if (activeSmelt) {
        smeltingFlashRef.current.intensity = 5.0 + Math.sin(clock.elapsedTime * 30) * 1.5;
        smeltingFlashRef.current.color.set("#FF7700");
      } else {
        smeltingFlashRef.current.intensity = 1.8;
        smeltingFlashRef.current.color.set("#00FFFF");
      }
    }
  });

  const handleStationClick = (e: any) => {
    e.stopPropagation();
    focusEntity("depot", "DEPOT-01");
    const valString = (totalRecoveredValue / 1_000_000).toFixed(2);
    addLog(
      `DEPOT-01 TELEMETRY // ORBITAL RECOVERY HUB // STORED MASS: ${totalRecoveredMass} kg // VALUE: $${valString}M // 4 MOORING BERTHS & STAGING GANTRY ONLINE`,
      "info"
    );
  };

  return (
    <group
      ref={stationGroupRef}
      position={depot.position}
      onClick={handleStationClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* 1. Central Pressurized Command Hub & Avionics Core */}
      <mesh>
        <cylinderGeometry args={[0.082, 0.092, 0.44, 16]} />
        <meshStandardMaterial
          color="#334155"
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>

      {/* Observation Cupola & Visor Windows Ring */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.091, 0.091, 0.048, 16]} />
        <meshBasicMaterial color="#00FFFF" toneMapped={false} />
      </mesh>

      {/* Primary Structural Ring Reinforcement Clamps */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.02, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.095, 0.095, 0.02, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* 2. Top Communications Tower & Sweeping Phased Array Spire */}
      <group position={[0, 0.22, 0]}>
        {/* Lattice Communications Mast */}
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.012, 0.018, 0.16, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Sweeping High-Gain Radar Dish */}
        <group ref={radarRef} position={[0, 0.17, 0]}>
          <mesh rotation={[0.42, 0, 0]}>
            <coneGeometry args={[0.055, 0.025, 16, 1, true]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
            <meshBasicMaterial color="#00FFCC" toneMapped={false} />
          </mesh>
        </group>
        {/* Anti-collision aviation beacon strobe */}
        <pointLight color="#00FFCC" intensity={1.8} distance={2.5} />
      </group>

      {/* Microwave Carrier Downlink to Earth (Telecommunications Beam) */}
      <mesh position={[0, -0.9, -0.85]} rotation={[0.76, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 2.3, 6]} />
        <meshBasicMaterial
          color="#00FFFF"
          transparent
          opacity={0.16}
          toneMapped={false}
        />
      </mesh>

      {/* 3. Upper Reserve Staging Gantry (Mooring Bay for DRONE-05 at y = +0.55) */}
      <group position={[0, 0.55, 0]}>
        {/* Gantry Structural Support Column connecting from top tower */}
        <mesh position={[0, -0.10, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.20, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Hexagonal Staging Docking Deck */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.085, 0.022, 6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
        </mesh>
        {/* Magnetic Mooring Target Ring */}
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.032, 0.052, 16]} />
          <meshBasicMaterial
            color={isStagingDocked ? "#00FF66" : isStagingIncoming ? "#FFBF00" : "#00FFFF"}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Platform Approach Guide Lights */}
        {[-0.045, 0.045].map((x, i) => (
          <mesh key={i} position={[x, 0.015, 0]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial
              color={isStagingDocked ? "#00FF66" : isStagingIncoming ? "#FFBF00" : "#00FFCC"}
            />
          </mesh>
        ))}
        {/* Reserve Umbilical Power / Fuel Recharging Port */}
        <mesh position={[0, 0.015, -0.04]}>
          <boxGeometry args={[0.016, 0.014, 0.012]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} />
        </mesh>
      </group>

      {/* 4. Elevated Articulating Sun-Tracking Solar Array Wings (y = +0.18) */}
      <group ref={solarBoomRef} position={[0, 0.18, 0]}>
        {/* Continuous Structural Boom through Central Hub */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.009, 0.009, 0.92, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.92} roughness={0.18} />
        </mesh>
        {/* Port Solar Wing Panel */}
        <group position={[-0.44, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.34, 0.008, 0.13]} />
            <meshStandardMaterial
              color="#1e3a8a"
              metalness={0.92}
              roughness={0.14}
            />
          </mesh>
          {/* Photovoltaic Cell Busbar Grid */}
          <mesh position={[0, 0.005, 0]}>
            <boxGeometry args={[0.33, 0.002, 0.004]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 0.005, 0.04]}>
            <boxGeometry args={[0.33, 0.002, 0.003]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 0.005, -0.04]}>
            <boxGeometry args={[0.33, 0.002, 0.003]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
        </group>
        {/* Starboard Solar Wing Panel */}
        <group position={[0.44, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.34, 0.008, 0.13]} />
            <meshStandardMaterial
              color="#1e3a8a"
              metalness={0.92}
              roughness={0.14}
            />
          </mesh>
          {/* Photovoltaic Cell Busbar Grid */}
          <mesh position={[0, 0.005, 0]}>
            <boxGeometry args={[0.33, 0.002, 0.004]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 0.005, 0.04]}>
            <boxGeometry args={[0.33, 0.002, 0.003]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
          <mesh position={[0, 0.005, -0.04]}>
            <boxGeometry args={[0.33, 0.002, 0.003]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
        </group>
      </group>

      {/* 5. Synchronous Counter-Rotating Toroidal Habitat Ring & Mooring Berths */}
      <group ref={ringRef} position={[0, 0, 0]}>
        {/* Equatorial Torus (horizontal ring around Y axis) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.36, 0.024, 16, 64]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.82}
            roughness={0.28}
          />
        </mesh>
        {/* Torus Edge Neon Trim Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={1.03}>
          <torusGeometry args={[0.36, 0.008, 8, 32]} />
          <meshBasicMaterial
            color="#00FFFF"
            transparent
            opacity={0.65}
            toneMapped={false}
          />
        </mesh>

        {/* 4 Continuous Structural Spoke Trusses (spanning across the hub to the ring) */}
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.76, 0.014, 0.02]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.76, 0.014, 0.02]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} />
        </mesh>

        {/* 4 Outer-Rim Drone Mooring Berths mounted at spoke ends (radius = 0.38) */}
        {[
          { id: "B1", pos: [0.38, 0, 0], rot: [0, 0, -Math.PI / 2], normal: [1, 0, 0] },
          { id: "B2", pos: [-0.38, 0, 0], rot: [0, 0, Math.PI / 2], normal: [-1, 0, 0] },
          { id: "B3", pos: [0, 0, 0.38], rot: [Math.PI / 2, 0, 0], normal: [0, 0, 1] },
          { id: "B4", pos: [0, 0, -0.38], rot: [-Math.PI / 2, 0, 0], normal: [0, 0, -1] }
        ].map((berth) => {
          const assignedDrone = drones.find((d) => d.berthId === berth.id);
          const isDocked = assignedDrone && (assignedDrone.status === "idle" || assignedDrone.subStatus === "docked");
          const isIncoming = assignedDrone && (assignedDrone.status === "returning" || assignedDrone.subStatus === "docking");
          const berthColor = isDocked ? "#00FF66" : isIncoming ? "#FFBF00" : "#00FFFF";

          return (
            <group
              key={berth.id}
              position={berth.pos as [number, number, number]}
              rotation={berth.rot as [number, number, number]}
            >
              {/* Magnetic Mooring Cradle Base */}
              <mesh>
                <cylinderGeometry args={[0.048, 0.054, 0.024, 12]} />
                <meshStandardMaterial color="#1e293b" metalness={0.92} roughness={0.18} />
              </mesh>

              {/* Docking Target Ring */}
              <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.026, 0.040, 16]} />
                <meshBasicMaterial
                  color={berthColor}
                  transparent
                  opacity={isIncoming ? 0.95 : 0.8}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/* Approach Guide Micro-Lights */}
              <mesh position={[0.034, 0.016, 0]}>
                <sphereGeometry args={[0.005, 8, 8]} />
                <meshBasicMaterial color={berthColor} />
              </mesh>
              <mesh position={[-0.034, 0.016, 0]}>
                <sphereGeometry args={[0.005, 8, 8]} />
                <meshBasicMaterial color={berthColor} />
              </mesh>

              {/* Approach Alignment Guide Cone (Projected outward when drone is returning) */}
              {isIncoming && (
                <group position={[0, 0.12, 0]}>
                  <mesh>
                    <coneGeometry args={[0.045, 0.20, 12, 1, true]} />
                    <meshBasicMaterial
                      color="#FFBF00"
                      transparent
                      opacity={0.35}
                      side={THREE.DoubleSide}
                      toneMapped={false}
                    />
                  </mesh>
                </group>
              )}

              {/* Anti-collision Strobe Beacon at Outer Spoke Tip */}
              <mesh position={[0, 0.028, 0]}>
                <sphereGeometry args={[0.004, 6, 6]} />
                <meshBasicMaterial color="#FF0044" />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* 6. Underside Salvage De-Orbit & Smelting Intake Chute with Electromagnetic Vortex (y = -0.21) */}
      <group position={[0, -0.21, 0]}>
        {/* Heavy Smelting Funnel Cowling with 4 Cooling Fins */}
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.14, 16, 1, true]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.88}
            roughness={0.22}
            side={THREE.DoubleSide}
          />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => (
          <mesh key={idx} position={[0, -0.06, 0]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.34, 0.12, 0.008]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.25} />
          </mesh>
        ))}

        {/* 3-Tier Multi-Frequency Electromagnetic Containment Rings */}
        <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.010, 8, 32]} />
          <meshBasicMaterial color="#00FFFF" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.10, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.165, 0.014, 8, 32]} />
          <meshBasicMaterial
            color={isSmeltingActive ? "#FFAA00" : "#00FFFF"}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.185, 0.012, 8, 32]} />
          <meshBasicMaterial
            color={isSmeltingActive ? "#FF5500" : "#00FFCC"}
            toneMapped={false}
          />
        </mesh>

        {/* Pulsing Processing Field Beam */}
        <mesh ref={intakePulseRef} position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.155, 24]} />
          <meshBasicMaterial
            color={isSmeltingActive ? "#FFAA00" : "#00FFFF"}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* High-Intensity Core Smelting Plasma Flash */}
        <pointLight
          ref={smeltingFlashRef}
          color={isSmeltingActive ? "#FF7700" : "#00FFFF"}
          intensity={isSmeltingActive ? 5.5 : 2.2}
          distance={2.4}
        />
      </group>

      {/* 7. Hover Shield Bubble */}
      {hovered && (
        <mesh>
          <sphereGeometry args={[0.64, 24, 24]} />
          <meshBasicMaterial
            color="#00FFFF"
            transparent
            opacity={0.14}
            wireframe
          />
        </mesh>
      )}

      {/* 8. Invisible Raycasting Click Hitbox */}
      <mesh>
        <sphereGeometry args={[0.60, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// 3D GLB Model Instance for Swarm Drones with Articulated Mechanisms
function DroneGLBModel({
  status,
  subStatus,
  color
}: {
  status: Drone["status"];
  subStatus?: Drone["subStatus"];
  color: string;
}) {
  const { scene } = useGLTF("/scale-extraction-drone.glb");

  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else {
            mesh.material = mesh.material.clone();
          }
        }
      }
    });
    return clone;
  }, [scene]);

  // Articulate forward capture mechanism when clamping, detumbling, or towing
  useEffect(() => {
    const captureNode = cloned.getObjectByName("CaptureMechanism");
    if (captureNode) {
      if (status === "capturing" && subStatus === "clamping") {
        captureNode.position.set(0, 0, 0.038);
        captureNode.scale.set(1.08, 1.08, 1.15);
      } else if (status === "returning" || subStatus === "towing") {
        captureNode.position.set(0, 0, 0.024);
        captureNode.scale.set(1.04, 1.04, 1.08);
      } else {
        captureNode.position.set(0, 0, 0);
        captureNode.scale.set(1, 1, 1);
      }
    }
  }, [cloned, status, subStatus]);

  return <primitive object={cloned} scale={0.065} />;
}

// Swarm Drone Visualization & Animation
function DroneMesh({
  drone,
  onSelectTarget
}: {
  drone: Drone;
  onSelectTarget?: (debrisId: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const thrusterRef = useRef<THREE.Group>(null);
  const debrisList = useMissionStore((state) => state.debris);
  const depot = useMissionStore((state) => state.depot);
  const focusEntity = useMissionStore((state) => state.focusEntity);

  const [flightPhase, setFlightPhase] = useState<"accel" | "coast" | "brake">("accel");

  // Status-based color mapping per prompt requirements:
  // - Idle drones: cyan
  // - Intercepting drones: blue
  // - Capturing drones: pulsing white
  // - Returning drones: green
  // - Recovered: green
  const baseColor = useMemo(() => {
    switch (drone.status) {
      case "idle":
        return "#00FFFF"; // cyan
      case "assigned":
      case "intercepting":
        return "#2979FF"; // blue
      case "capturing":
        return "#FFFFFF"; // pulsing white
      case "returning":
      case "recovered":
        return "#00FF66"; // green
      case "error":
        return "#FF0033"; // red
      default:
        return "#00FFFF";
    }
  }, [drone.status]);

  // Carried debris when actively clamping in claws or returning payload to Docking Station
  const carriedDebris = useMemo(() => {
    if (!drone.targetId) return null;
    if (
      (drone.status === "capturing" && drone.subStatus === "clamping") ||
      (drone.status === "returning" && drone.subStatus === "towing")
    ) {
      return debrisList.find((d) => d.id === drone.targetId) || null;
    }
    return null;
  }, [drone.targetId, drone.status, drone.subStatus, debrisList]);

  const isDocked = drone.status === "idle" || drone.status === "recovered" || drone.subStatus === "docked";

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // 1. In Flight along Curved Orbital Transfer Arc
    if (drone.flight && (drone.status === "intercepting" || drone.status === "returning")) {
      const elapsed = (Date.now() - drone.flight.startTime) / 1000;
      const progress = Math.min(1, Math.max(0, elapsed / drone.flight.duration));
      const eased = easeInOutQuad(progress);

      const pos = getOrbitalArcPoint(drone.flight.startPosition, drone.flight.targetPosition, eased);
      groupRef.current.position.set(pos[0], pos[1], pos[2]);

      // Dynamic Flight Regimes:
      // - progress < 0.38: Acceleration burn (prograde)
      // - 0.38 <= progress <= 0.68: Coasting
      // - progress > 0.68: Retrograde braking burn (180° flip to decelerate)
      let phase: "accel" | "coast" | "brake" = "accel";
      if (progress > 0.68) {
        phase = "brake";
      } else if (progress >= 0.38) {
        phase = "coast";
      }
      if (flightPhase !== phase) {
        setFlightPhase(phase);
      }

      if (modelRef.current) {
        const tangent = getOrbitalArcTangent(drone.flight.startPosition, drone.flight.targetPosition, eased);
        if (phase === "brake") {
          // Retrograde flip: orient thruster along flight vector to brake
          const retroTarget = new THREE.Vector3(
            pos[0] - tangent[0],
            pos[1] - tangent[1],
            pos[2] - tangent[2]
          );
          modelRef.current.lookAt(retroTarget);
        } else {
          // Prograde acceleration or coasting
          const proTarget = new THREE.Vector3(
            pos[0] + tangent[0],
            pos[1] + tangent[1],
            pos[2] + tangent[2]
          );
          modelRef.current.lookAt(proTarget);
        }
      }

      // Animate thruster flame scale based on burn regime
      if (thrusterRef.current) {
        if (phase === "accel") {
          thrusterRef.current.scale.set(1, 1 + Math.sin(clock.elapsedTime * 22) * 0.15, 1.4);
        } else if (phase === "coast") {
          thrusterRef.current.scale.set(0.35, 0.35, 0.3);
        } else {
          thrusterRef.current.scale.set(0.9, 0.9 + Math.sin(clock.elapsedTime * 18) * 0.12, 1.25);
        }
      }
    } else if (drone.status === "capturing") {
      // 2. Co-Orbital Target Rendezvous & Active Extraction: Detumble & Clamping
      const targetDebris = drone.targetId ? debrisList.find((d) => d.id === drone.targetId) : null;
      if (targetDebris) {
        const dPos = getDebrisOrbitalPosition(targetDebris, clock.elapsedTime);
        const dVec = new THREE.Vector3(...dPos);
        const outward = dVec.clone().normalize();

        if (drone.subStatus === "detumbling") {
          // Drone stands off along outward vector (0.09m), facing target with tractor beam
          const standOff = dVec.clone().addScaledVector(outward, 0.09);
          groupRef.current.position.set(standOff.x, standOff.y, standOff.z);
          if (modelRef.current) {
            modelRef.current.lookAt(dVec);
            // Spin-matching attitude micro-adjustments
            modelRef.current.rotation.z += Math.sin(clock.elapsedTime * 9) * 0.06;
          }
        } else {
          // Clamping: Latched in rigid contact with target
          groupRef.current.position.set(dPos[0], dPos[1], dPos[2]);
          if (modelRef.current) {
            modelRef.current.rotation.x = THREE.MathUtils.lerp(modelRef.current.rotation.x, 0, 0.1);
            modelRef.current.rotation.z = THREE.MathUtils.lerp(modelRef.current.rotation.z, 0, 0.1);
          }
        }
      } else {
        groupRef.current.position.set(drone.position[0], drone.position[1], drone.position[2]);
      }
    } else if (drone.subStatus === "ingesting") {
      // 3. Underside Refinery Ingestion Stand-off: holding below station intake
      const standOff = getSmeltingStandOffPosition(depot.position);
      groupRef.current.position.set(standOff[0], standOff[1], standOff[2]);
      if (modelRef.current) {
        // Face upwards toward the smelting reactor funnel
        const intake = getSmeltingIntakePosition(depot.position);
        modelRef.current.lookAt(new THREE.Vector3(...intake));
      }
    } else if (drone.subStatus === "docking") {
      // 4. Ascent from Refinery Stand-off to Assigned Berth
      const ringAngle = getStationRingAngle(clock.elapsedTime);
      const berthPos = getBerthWorldPosition(drone.berthId, depot.position, ringAngle);
      groupRef.current.position.lerp(new THREE.Vector3(...berthPos), 0.08);

      if (modelRef.current) {
        const normal = getBerthOutwardNormal(drone.berthId, ringAngle);
        const lookTarget = new THREE.Vector3(
          berthPos[0] + normal[0],
          berthPos[1] + normal[1],
          berthPos[2] + normal[2]
        );
        modelRef.current.lookAt(lookTarget);
      }
    } else {
      // 5. Docked at Station Berths: Synchronize with station ring rotation
      const ringAngle = getStationRingAngle(clock.elapsedTime);
      const berthPos = getBerthWorldPosition(drone.berthId, depot.position, ringAngle);
      groupRef.current.position.set(berthPos[0], berthPos[1], berthPos[2]);

      if (modelRef.current) {
        const normal = getBerthOutwardNormal(drone.berthId, ringAngle);
        const lookTarget = new THREE.Vector3(
          berthPos[0] + normal[0],
          berthPos[1] + normal[1],
          berthPos[2] + normal[2]
        );
        modelRef.current.lookAt(lookTarget);
      }
    }

    // Capture visual pulse
    if (modelRef.current && drone.status === "capturing") {
      const pulse = 1 + Math.sin(clock.elapsedTime * 14) * 0.08;
      modelRef.current.scale.setScalar(pulse);
    } else if (modelRef.current) {
      modelRef.current.scale.setScalar(1);
    }
  });

  const isFiringThruster =
    (drone.status === "intercepting" || drone.status === "returning") &&
    (flightPhase === "accel" || flightPhase === "brake" || flightPhase === "coast");

  const thrusterColor =
    flightPhase === "brake"
      ? "#FF9900"
      : drone.status === "intercepting"
      ? "#00BFFF"
      : "#00FF66";

  return (
    <group
      ref={groupRef}
      position={drone.position}
      onClick={(e) => {
        e.stopPropagation();
        focusEntity("drone", drone.id);
        if (drone.targetId && onSelectTarget) {
          onSelectTarget(drone.targetId);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {/* 3D Extraction Drone GLB Model */}
      <group ref={modelRef}>
        <DroneGLBModel
          status={drone.status}
          subStatus={drone.subStatus}
          color={baseColor}
        />

        {/* Carried Debris clamped firmly in Forward Extraction Claws during Capture/Transit */}
        {carriedDebris && (
          <group position={[0, 0, 0.068]} scale={0.7}>
            <DebrisShape
              material={carriedDebris.material}
              color="#00FF66"
              wireframe={false}
              opacity={1}
              scale={0.032}
            />
          </group>
        )}

        {/* Dynamic Main Ion Thruster Plume during Flight */}
        {isFiringThruster && (
          <group ref={thrusterRef} position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
            {/* Outer Plasma Sheath */}
            <mesh>
              <coneGeometry args={[0.035, 0.13, 12]} />
              <meshBasicMaterial
                color={thrusterColor}
                transparent
                opacity={flightPhase === "coast" ? 0.35 : 0.85}
                toneMapped={false}
              />
            </mesh>
            {/* Inner Core Ion Beam */}
            <mesh position={[0, -0.02, 0]}>
              <coneGeometry args={[0.016, 0.08, 8]} />
              <meshBasicMaterial
                color="#FFFFFF"
                transparent
                opacity={0.9}
                toneMapped={false}
              />
            </mesh>
            <pointLight
              color={thrusterColor}
              intensity={flightPhase === "coast" ? 0.8 : 2.5}
              distance={1.0}
            />
          </group>
        )}

        {/* Quad RCS Cold-Gas Attitude Thruster Puffs (Corners of drone) */}
        {(drone.subStatus === "undocking" ||
          drone.subStatus === "detumbling" ||
          drone.subStatus === "docking" ||
          flightPhase === "coast") && (
          <group>
            {[
              [0.045, 0, 0.045],
              [-0.045, 0, 0.045],
              [0.045, 0, -0.045],
              [-0.045, 0, -0.045]
            ].map((p, idx) => (
              <mesh key={idx} position={p as [number, number, number]}>
                <sphereGeometry args={[0.007, 6, 6]} />
                <meshBasicMaterial
                  color="#E0F7FA"
                  transparent
                  opacity={0.75}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* Electromagnetic Tractor Beam & Laser Guidewire during Capture */}
        {drone.status === "capturing" && (
          <group>
            {/* Central Coherent Laser Tether */}
            <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.004, 0.028, 0.11, 12, 1, true]} />
              <meshBasicMaterial
                color={drone.subStatus === "clamping" ? "#00FF66" : "#00FFFF"}
                transparent
                opacity={drone.subStatus === "clamping" ? 0.85 : 0.65}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Containment Ring Pulse */}
            <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.02, 0.035, 16]} />
              <meshBasicMaterial
                color={drone.subStatus === "clamping" ? "#FFFFFF" : "#00FFFF"}
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
            <pointLight
              color={drone.subStatus === "clamping" ? "#00FF66" : "#00FFFF"}
              intensity={3.2}
              distance={0.8}
            />
          </group>
        )}

        {/* Docked Umbilical Power Feed & Magnetic Mooring Lock Ring */}
        {isDocked && (
          <group position={[0, 0, -0.075]}>
            {/* Port Umbilical Conduit */}
            <mesh position={[-0.022, -0.012, -0.018]} rotation={[0.25, 0, 0.2]}>
              <cylinderGeometry args={[0.002, 0.002, 0.04, 6]} />
              <meshBasicMaterial color="#00FFFF" toneMapped={false} />
            </mesh>
            {/* Starboard Umbilical Conduit */}
            <mesh position={[0.022, -0.012, -0.018]} rotation={[0.25, 0, -0.2]}>
              <cylinderGeometry args={[0.002, 0.002, 0.04, 6]} />
              <meshBasicMaterial color="#00FFFF" toneMapped={false} />
            </mesh>
            {/* Cradle Magnetic Lock Ring */}
            <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.026, 0.038, 16]} />
              <meshBasicMaterial
                color="#00FF66"
                transparent
                opacity={0.8}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Orbiting Status Beacon Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.005, 8, 24]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// 3D GLB Model Instance for Spent Rocket Stage Debris
function RocketStageModel({
  color,
  wireframe = false,
  opacity = 1,
  scale = 1
}: {
  color: string;
  wireframe?: boolean;
  opacity?: number;
  scale?: number;
}) {
  const { scene } = useGLTF("/scale-extraction-drone-debry.glb");

  const cloned = useMemo(() => {
    const aux = scene.children[0];
    const rocketNode = aux?.children[5];
    if (!rocketNode) return new THREE.Group();

    const clone = rocketNode.clone(true);
    // Center rocket along Z (offset ~ -0.8775)
    clone.position.set(0, 0, -0.8775);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = new THREE.MeshStandardMaterial({
          color: wireframe ? color : "#94a3b8",
          metalness: 0.85,
          roughness: 0.28,
          wireframe: !!wireframe,
          transparent: opacity < 1,
          opacity: opacity
        });
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [scene, color, wireframe, opacity]);

  return <primitive object={cloned} scale={scale} />;
}

// 3D GLB Model Instance for Chondrite Meteorite / Asteroid Debris
function MeteoriteModel({
  color,
  wireframe = false,
  opacity = 1,
  scale = 1
}: {
  color: string;
  wireframe?: boolean;
  opacity?: number;
  scale?: number;
}) {
  const { scene } = useGLTF("/scale-extraction-drone-debry.glb");

  const cloned = useMemo(() => {
    const aux = scene.children[0];
    const meteorNode = aux?.children[6];
    if (!meteorNode) return new THREE.Group();

    const clone = meteorNode.clone(true);
    // Reset local position offset (z was 1.265 in GLB) to pivot exactly at (0, 0, 0)
    clone.position.set(0, 0, 0);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => {
              const cl = (m as THREE.Material).clone();
              if (wireframe && "wireframe" in cl) {
                (cl as THREE.MeshStandardMaterial).wireframe = true;
                (cl as THREE.MeshStandardMaterial).color = new THREE.Color(color);
              }
              cl.transparent = opacity < 1;
              cl.opacity = opacity;
              return cl;
            });
          } else {
            const cl = (mesh.material as THREE.Material).clone();
            if (wireframe && "wireframe" in cl) {
              (cl as THREE.MeshStandardMaterial).wireframe = true;
              (cl as THREE.MeshStandardMaterial).color = new THREE.Color(color);
            }
            cl.transparent = opacity < 1;
            cl.opacity = opacity;
            mesh.material = cl;
          }
        }
      }
    });

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [scene, color, wireframe, opacity]);

  return <primitive object={cloned} scale={scale} />;
}

// Debris Geometries: Realistic 3D Rocket Parts, Meteorites, and Solar Arrays
function DebrisShape({
  material,
  color,
  wireframe = false,
  opacity = 1,
  scale = 1
}: {
  material?: string;
  color: string;
  wireframe?: boolean;
  opacity?: number;
  scale?: number;
}) {
  const mat = (material || "").toLowerCase();

  // 1. Defunct Satellite / Solar Array
  if (mat.includes("solar") || mat.includes("battery")) {
    return (
      <group scale={scale}>
        {/* Central Satellite Body */}
        <mesh>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshStandardMaterial
            color={wireframe ? color : "#334155"}
            metalness={0.75}
            roughness={0.25}
            wireframe={wireframe}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {/* Left Solar Panel */}
        <mesh position={[-1.15, 0, 0]}>
          <boxGeometry args={[1.3, 0.55, 0.05]} />
          <meshStandardMaterial
            color={wireframe ? color : "#1e3a8a"}
            metalness={0.85}
            roughness={0.2}
            wireframe={wireframe}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {/* Right Solar Panel */}
        <mesh position={[1.15, 0, 0]}>
          <boxGeometry args={[1.3, 0.55, 0.05]} />
          <meshStandardMaterial
            color={wireframe ? color : "#1e3a8a"}
            metalness={0.85}
            roughness={0.2}
            wireframe={wireframe}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {/* High-gain Antenna Rod */}
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
          <meshStandardMaterial
            color={wireframe ? color : "#cbd5e1"}
            metalness={0.9}
            roughness={0.1}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      </group>
    );
  }

  // 2. Spent Rocket Stage / Booster / Reaction Wheel / Fairing -> 3D Rocket GLB Model
  if (
    mat.includes("wheel") ||
    mat.includes("fairing") ||
    mat.includes("reaction") ||
    mat.includes("rocket") ||
    mat.includes("booster") ||
    mat.includes("engine")
  ) {
    return (
      <group scale={scale * 2.2}>
        <RocketStageModel color={color} wireframe={wireframe} opacity={opacity} />
      </group>
    );
  }

  // 3. Meteorite / Asteroid / Cosmic Shard / Shielding / Strut -> 3D Meteorite GLB Model
  return (
    <group scale={scale * 2.2}>
      <MeteoriteModel color={color} wireframe={wireframe} opacity={opacity} />
    </group>
  );
}

// Aerospace Tactical Lock-On Reticle & High-Orbit Sonar Beacon
function TacticalTargetReticle({
  debris,
  isTargeted,
  isSelected,
  assignedDrone
}: {
  debris: Debris;
  isTargeted: boolean;
  isSelected: boolean;
  assignedDrone?: Drone;
}) {
  const outerGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const pulseRef1 = useRef<THREE.Mesh>(null);
  const pulseRef2 = useRef<THREE.Mesh>(null);

  const posRef = useRef<HTMLSpanElement>(null);
  const devRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<HTMLSpanElement>(null);

  const depot = useMissionStore((state) => state.depot);

  const primaryColor = isTargeted ? "#FFBF00" : "#00FFFF";
  const secondaryColor = isTargeted ? "#FFAA00" : "#38BDF8";

  // 4 Corner L-Brackets surrounding the targeted debris
  const cornerSegments = useMemo(() => {
    const s = 0.11;
    const leg = 0.04;
    return [
      // Top-Right
      [[s - leg, s, 0], [s, s, 0], [s, s - leg, 0]],
      // Top-Left
      [[-s + leg, s, 0], [-s, s, 0], [-s, s - leg, 0]],
      // Bottom-Left
      [[-s + leg, -s, 0], [-s, -s, 0], [-s, -s + leg, 0]],
      // Bottom-Right
      [[s - leg, -s, 0], [s, -s, 0], [s, -s + leg, 0]],
    ] as [number, number, number][][];
  }, []);

  // 4 Cardinal precision tick marks (N, S, E, W)
  const cardinalTicks = useMemo(() => {
    const r1 = 0.058;
    const r2 = 0.078;
    return [
      [[0, r1, 0], [0, r2, 0]],
      [[0, -r1, 0], [0, -r2, 0]],
      [[r1, 0, 0], [r2, 0, 0]],
      [[-r1, 0, 0], [-r2, 0, 0]],
    ] as [number, number, number][][];
  }, []);

  useFrame(({ clock }) => {
    // Continuous dual-rate counter-rotation
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.z = clock.elapsedTime * 0.7;
    }
    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.z = -clock.elapsedTime * 1.1;
    }

    // Radiating Sonar/Radar Beacon Rings expanding into deep space
    if (pulseRef1.current) {
      const p1 = (clock.elapsedTime * 0.75) % 1.0;
      const s1 = THREE.MathUtils.lerp(0.6, 3.4, p1);
      pulseRef1.current.scale.setScalar(s1);
      (pulseRef1.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p1) * 0.85);
    }
    if (pulseRef2.current) {
      const p2 = (clock.elapsedTime * 0.75 + 0.5) % 1.0;
      const s2 = THREE.MathUtils.lerp(0.6, 3.4, p2);
      pulseRef2.current.scale.setScalar(s2);
      (pulseRef2.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p2) * 0.85);
    }

    // Live 3D Spatial Coordinates & Differential Deviation ("Where It Isn't")
    const livePos = getDebrisOrbitalPosition(debris, clock.elapsedTime);
    let observerPos = depot.position;
    if (assignedDrone) {
      observerPos = getDroneWorldPosition(assignedDrone, depot.position, clock.elapsedTime, [debris]);
    }
    const diff = getDifferentialVectorState(livePos, observerPos);

    if (posRef.current) {
      posRef.current.textContent = `X:${livePos[0] > 0 ? "+" : ""}${livePos[0].toFixed(2)} Y:${livePos[1] > 0 ? "+" : ""}${livePos[1].toFixed(2)} Z:${livePos[2] > 0 ? "+" : ""}${livePos[2].toFixed(2)}`;
    }
    if (devRef.current) {
      const dxKm = Math.round(diff.deviationKm[0]);
      const dyKm = Math.round(diff.deviationKm[1]);
      const dzKm = Math.round(diff.deviationKm[2]);
      devRef.current.textContent = `Δ[${dxKm > 0 ? "+" : ""}${dxKm}, ${dyKm > 0 ? "+" : ""}${dyKm}, ${dzKm > 0 ? "+" : ""}${dzKm}]km`;
    }
    if (rangeRef.current) {
      rangeRef.current.textContent = `ρ:${Math.round(diff.rangeKm).toLocaleString()}km`;
    }
  });

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      {/* 1. Rotating Outer Bracket & Reticle Ring */}
      <group ref={outerGroupRef}>
        {cornerSegments.map((pts, i) => (
          <Line
            key={`corner-${i}`}
            points={pts}
            color={primaryColor}
            lineWidth={2.2}
            transparent
            opacity={0.95}
          />
        ))}
        <mesh>
          <ringGeometry args={[0.092, 0.098, 36]} />
          <meshBasicMaterial
            color={secondaryColor}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* 2. Counter-Rotating Inner Precision Ring & Crosshairs */}
      <group ref={innerGroupRef}>
        <mesh>
          <ringGeometry args={[0.052, 0.058, 28]} />
          <meshBasicMaterial
            color={primaryColor}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {cardinalTicks.map((pts, i) => (
          <Line
            key={`tick-${i}`}
            points={pts}
            color={primaryColor}
            lineWidth={2.0}
            transparent
            opacity={0.9}
          />
        ))}
      </group>

      {/* 3. Expanding Sonar Pulse Rings (Visible from High Orbit) */}
      <mesh ref={pulseRef1}>
        <ringGeometry args={[0.07, 0.078, 36]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pulseRef2}>
        <ringGeometry args={[0.07, 0.078, 36]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 4. 3D Floating HUD Callout Badge */}
      <Html
        position={[0, 0.16, 0]}
        center
        distanceFactor={7}
        style={{ pointerEvents: "none" }}
      >
        <div className="tactical-lock-hud">
          <div className={`tactical-lock-badge ${isTargeted ? "is-targeted" : "is-selected"}`}>
            <span className="tactical-lock-dot" />
            <span>
              {isTargeted
                ? `LOCK // ${assignedDrone?.id ?? "DRONE"} EN ROUTE`
                : "TARGET ACQUIRED"}
            </span>
          </div>
          <div className="tactical-lock-subtag">
            <span>{debris.id}</span>
            <span>•</span>
            <span>{debris.material.toUpperCase()}</span>
            <span>•</span>
            <span>{debris.mass}kg</span>
            {isTargeted && (
              <>
                <span>•</span>
                <span style={{ color: "#ffbf00" }}>THREAT {debris.threatIndex.toFixed(1)}</span>
              </>
            )}
          </div>
          <div className="tactical-lock-vector-pill">
            <span className="vector-label">POS</span>
            <span ref={posRef} className="vector-val text-cyan">
              X:0.00 Y:0.00 Z:0.00
            </span>
            <span className="vector-sep">·</span>
            <span className="vector-label">DEV</span>
            <span ref={devRef} className="vector-val text-amber">
              Δ[0, 0, 0]km
            </span>
            <span className="vector-sep">·</span>
            <span ref={rangeRef} className="vector-range text-emerald-400">
              -- km
            </span>
          </div>
        </div>
      </Html>
    </Billboard>
  );
}

// Debris Visualization & Animation
function DebrisMesh({
  debris,
  selected,
  assignedDrone,
  onClick
}: {
  debris: Debris;
  selected: boolean;
  assignedDrone?: Drone;
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null);

  const depot = useMissionStore((state) => state.depot);

  // Status-based color mapping per prompt requirements:
  // - Targeted debris: amber
  // - Captured debris: green
  // - Available debris: red
  const color = useMemo(() => {
    if (debris.subStatus === "ingesting") {
      return "#FFAA00";
    }
    switch (debris.status) {
      case "available":
        return "#FF0033"; // red
      case "targeted":
        return "#FFBF00"; // amber
      case "captured":
      case "recovered":
        return "#00FF66"; // green
      default:
        return "#FF0033";
    }
  }, [debris.status, debris.subStatus]);

  // Unique tumbling rate & axes for each debris object
  const spinVector = useMemo(() => {
    // Generate deterministic pseudo-random spin from debris id
    const hash = debris.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return [
      0.005 + ((hash % 11) / 10) * 0.015,
      0.008 + ((hash % 13) / 10) * 0.015,
      0.004 + ((hash % 7) / 10) * 0.012
    ];
  }, [debris.id]);

  // Proportional scale: realistic relative to Earth (radius 1.35), scaled by mass
  const baseScale = useMemo(() => {
    // Sized between 0.025 and 0.048 based on mass (80kg - 450kg)
    const massFactor = Math.min(1, Math.max(0, (debris.mass - 80) / 360));
    const normalScale = 0.026 + massFactor * 0.018;
    return debris.status === "recovered" ? normalScale * 0.7 : normalScale;
  }, [debris.mass, debris.status]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    if (debris.subStatus === "ingesting") {
      // 1. Smelting Vortex Ingestion: Debris floats upwards from stand-off into intake core
      const intakePos = getSmeltingIntakePosition(depot.position);
      const standOff = getSmeltingStandOffPosition(depot.position);

      const curY = groupRef.current.position.y;
      groupRef.current.position.x = standOff[0];
      groupRef.current.position.z = standOff[2];
      groupRef.current.position.y = THREE.MathUtils.lerp(curY, intakePos[1] + 0.12, 0.08);

      if (visualRef.current) {
        visualRef.current.rotation.y += 0.22;
        visualRef.current.rotation.x += 0.12;
        visualRef.current.scale.multiplyScalar(0.975);
      }
    } else if (
      debris.status === "captured" &&
      assignedDrone?.flight &&
      assignedDrone.status === "returning"
    ) {
      // 2. Inbound flight following carrier drone
      const elapsed = (Date.now() - assignedDrone.flight.startTime) / 1000;
      const progress = Math.min(1, Math.max(0, elapsed / assignedDrone.flight.duration));
      const eased = easeInOutQuad(progress);

      const pos = getOrbitalArcPoint(
        assignedDrone.flight.startPosition,
        assignedDrone.flight.targetPosition,
        eased
      );
      groupRef.current.position.set(pos[0], pos[1], pos[2]);
    } else if (debris.status === "recovered" || debris.subStatus === "smelted") {
      groupRef.current.position.set(debris.position[0], debris.position[1], debris.position[2]);
    } else {
      // 3. Continuous Keplerian orbital motion around Earth
      const pos = getDebrisOrbitalPosition(debris, clock.elapsedTime);
      groupRef.current.position.set(pos[0], pos[1], pos[2]);

      // Natural multi-axis tumbling rotation, dampened when detumbling
      if (visualRef.current) {
        const damp = debris.subStatus === "detumbling" ? 0.2 : 1.0;
        visualRef.current.rotation.x += spinVector[0] * damp;
        visualRef.current.rotation.y += spinVector[1] * damp;
        visualRef.current.rotation.z += spinVector[2] * damp;

        if (selected) {
          const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.18;
          visualRef.current.scale.setScalar(pulse);
        } else {
          visualRef.current.scale.setScalar(1);
        }
      }
    }
  });

  // Hide independent orbit mesh only when clamped/towed in drone claws or fully smelted:
  if (
    debris.status === "recovered" ||
    debris.subStatus === "smelted" ||
    (debris.status === "captured" &&
      debris.subStatus !== "ingesting" &&
      assignedDrone &&
      (assignedDrone.status === "returning" || assignedDrone.subStatus === "clamping"))
  ) {
    return null;
  }

  return (
    <group
      ref={groupRef}
      position={debris.position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {/* Visual Procedural / GLB Mesh Group */}
      <group ref={visualRef}>
        <DebrisShape
          material={debris.material}
          color={color}
          wireframe={debris.status === "targeted" && debris.subStatus !== "detumbling"}
          opacity={debris.subStatus === "ingesting" ? 0.85 : 0.98}
          scale={baseScale}
        />
      </group>

      {/* Tractor Field Containment Cage during Active Detumble */}
      {debris.subStatus === "detumbling" && (
        <mesh>
          <sphereGeometry args={[baseScale * 2.2, 12, 12]} />
          <meshBasicMaterial
            color="#00FFFF"
            wireframe
            transparent
            opacity={0.65}
          />
        </mesh>
      )}

      {/* Electromagnetic Ingestion Field during ISRU Smelting */}
      {debris.subStatus === "ingesting" && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[baseScale * 1.2, baseScale * 2.0, 16]} />
          <meshBasicMaterial
            color="#FFAA00"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Interactive Raycastable Click Hitbox */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Tactical Aerospace Lock-On Reticle (Targeted by Drone or Selected by User) */}
      {(debris.status === "targeted" || selected) && (
        <TacticalTargetReticle
          debris={debris}
          isTargeted={debris.status === "targeted"}
          isSelected={selected}
          assignedDrone={assignedDrone}
        />
      )}
    </group>
  );
}

// Earth Visualization - Photorealistic Blue Marble with Atmosphere & City Lights
function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const [dayMap, nightMap, cloudsMap, specularMap] = useTexture([
    "/textures/earth/earth_day.jpg",
    "/textures/earth/earth_lights.png",
    "/textures/earth/earth_clouds.png",
    "/textures/earth/earth_specular.jpg"
  ]);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.025;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.038;
  });

  const surfaceShader = useMemo(() => ({
    uniforms: {
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uSpecularMap: { value: specularMap },
      uSunDirection: { value: new THREE.Vector3(8, 10, 6).normalize() }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform sampler2D uSpecularMap;
      uniform vec3 uSunDirection;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 sunDir = normalize(uSunDirection);
        float sunDot = dot(normal, sunDir);

        vec4 dayColor = texture2D(uDayMap, vUv);
        vec4 nightColor = texture2D(uNightMap, vUv);
        float specMask = texture2D(uSpecularMap, vUv).r;

        // Smooth day-to-night terminator transition
        float dayFactor = smoothstep(-0.15, 0.2, sunDot);

        // Specular ocean sun reflection
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 reflectDir = reflect(-sunDir, normal);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 28.0);
        vec3 specularGlint = vec3(1.0, 0.98, 0.95) * spec * specMask * 1.5 * max(0.0, sunDot);

        // Atmospheric twilight amber glow along terminator
        float twilight = smoothstep(-0.25, 0.0, sunDot) * smoothstep(0.25, 0.0, sunDot);
        vec3 twilightTint = vec3(0.92, 0.38, 0.12) * twilight * 0.4;

        // Golden city night lights
        vec3 nightLights = nightColor.rgb * vec3(1.35, 1.1, 0.75) * (1.0 - dayFactor) * 1.8;

        // Final composite surface
        vec3 surfaceColor = mix(nightLights, dayColor.rgb + specularGlint, dayFactor) + twilightTint;

        gl_FragColor = vec4(surfaceColor, 1.0);
      }
    `
  }), [dayMap, nightMap, specularMap]);

  const cloudsShader = useMemo(() => ({
    uniforms: {
      uCloudsMap: { value: cloudsMap },
      uSunDirection: { value: new THREE.Vector3(8, 10, 6).normalize() }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudsMap;
      uniform vec3 uSunDirection;

      varying vec2 vUv;
      varying vec3 vNormal;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 sunDir = normalize(uSunDirection);
        float sunDot = dot(normal, sunDir);

        vec4 cloudTex = texture2D(uCloudsMap, vUv);
        float dayFactor = smoothstep(-0.15, 0.25, sunDot);

        // Day vs night cloud illumination
        vec3 cloudColor = mix(vec3(0.03, 0.05, 0.08), vec3(0.98, 0.99, 1.0), dayFactor);
        float alpha = cloudTex.r * 0.65;

        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  }), [cloudsMap]);

  const atmosphereShader = useMemo(() => ({
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(8, 10, 6).normalize() }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vPosition);
        vec3 sunDir = normalize(uSunDirection);

        // Fresnel: limb grazing edge intensity
        float rim = 1.0 - max(dot(viewDir, normal), 0.0);
        float fresnel = pow(rim, 3.2);

        float sunDot = dot(normal, sunDir);
        float sunFactor = smoothstep(-0.25, 0.45, sunDot);

        // Electric cyan Rayleigh scattering on sunlit limb, deep navy on dark limb
        vec3 atmoDay = vec3(0.12, 0.72, 1.0);
        vec3 atmoNight = vec3(0.02, 0.06, 0.18);
        vec3 atmoColor = mix(atmoNight, atmoDay, sunFactor);

        float alpha = fresnel * (sunFactor * 0.9 + 0.1) * 1.4;

        gl_FragColor = vec4(atmoColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  }), []);

  return (
    <group>
      {/* Planetary Crust with Day/Night Shader & City Lights */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1.35, 64, 64]} />
        <shaderMaterial attach="material" {...surfaceShader} />
      </mesh>

      {/* Atmospheric Cloud Canopy with Independent Drift */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[1.365, 64, 64]} />
        <shaderMaterial attach="material" {...cloudsShader} />
      </mesh>

      {/* Rayleigh Atmospheric Scattering Outer Halo */}
      <mesh>
        <sphereGeometry args={[1.44, 48, 48]} />
        <shaderMaterial attach="material" {...atmosphereShader} />
      </mesh>

      {/* Precision Equatorial Reference Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.52, 0.003, 8, 96]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.18} />
      </mesh>

      {/* ISS / S.C.A.L.E. 51.6° Orbital Inclination Corridor */}
      <mesh rotation={[0.9, 0, 0]}>
        <torusGeometry args={[1.68, 0.002, 8, 96]} />
        <meshBasicMaterial color="#ffbf00" transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

// Dynamic Curved Trajectory Arc
function ActiveTrajectory({
  start,
  target,
  color
}: {
  start: [number, number, number];
  target: [number, number, number];
  color: string;
}) {
  const points = useMemo(() => {
    return getOrbitalArcSamples(start, target, 40);
  }, [start, target]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.6}
      dashed
      dashSize={0.08}
      gapSize={0.04}
      transparent
      opacity={0.88}
    />
  );
}

// Dynamic Intercept Guidance Laser Vector with Animated Photon Pulses
function InterceptGuidanceBeam({
  drone,
  debris
}: {
  drone: Drone;
  debris: Debris;
}) {
  const pulseRef1 = useRef<THREE.Mesh>(null);
  const pulseRef2 = useRef<THREE.Mesh>(null);
  const impactRef = useRef<THREE.Mesh>(null);
  const depot = useMissionStore((state) => state.depot);

  const lineObject = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({
      color: "#FFBF00",
      transparent: true,
      opacity: 0.88,
      linewidth: 2,
      depthWrite: false
    });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    return line;
  }, []);

  useEffect(() => {
    return () => {
      lineObject.geometry.dispose();
      (lineObject.material as THREE.Material).dispose();
    };
  }, [lineObject]);

  useFrame(({ clock }) => {
    // 1. Calculate live Drone position & Debris position
    const dronePos = getDroneWorldPosition(drone, depot.position, clock.elapsedTime, [debris]);
    const debrisPos = getDebrisOrbitalPosition(debris, clock.elapsedTime);

    // 3. Update dynamic laser line vertices
    const posAttr = lineObject.geometry.attributes.position as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.setXYZ(0, dronePos[0], dronePos[1], dronePos[2]);
      posAttr.setXYZ(1, debrisPos[0], debrisPos[1], debrisPos[2]);
      posAttr.needsUpdate = true;
    }

    // 4. Update animated traveling photon energy pulses along guidance vector
    const t1 = (clock.elapsedTime * 2.0) % 1.0;
    const t2 = (clock.elapsedTime * 2.0 + 0.5) % 1.0;

    if (pulseRef1.current) {
      pulseRef1.current.position.set(
        THREE.MathUtils.lerp(dronePos[0], debrisPos[0], t1),
        THREE.MathUtils.lerp(dronePos[1], debrisPos[1], t1),
        THREE.MathUtils.lerp(dronePos[2], debrisPos[2], t1)
      );
      const s = 0.8 + Math.sin(t1 * Math.PI) * 0.4;
      pulseRef1.current.scale.setScalar(s);
    }

    if (pulseRef2.current) {
      pulseRef2.current.position.set(
        THREE.MathUtils.lerp(dronePos[0], debrisPos[0], t2),
        THREE.MathUtils.lerp(dronePos[1], debrisPos[1], t2),
        THREE.MathUtils.lerp(dronePos[2], debrisPos[2], t2)
      );
      const s = 0.8 + Math.sin(t2 * Math.PI) * 0.4;
      pulseRef2.current.scale.setScalar(s);
    }

    // 5. Target impact ping on debris
    if (impactRef.current) {
      impactRef.current.position.set(debrisPos[0], debrisPos[1], debrisPos[2]);
      const p = (clock.elapsedTime * 3.0) % 1.0;
      impactRef.current.scale.setScalar(0.8 + p * 1.6);
      (impactRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - p) * 0.85);
    }
  });

  return (
    <group>
      {/* Primary Dynamic Intercept Laser Beam */}
      <primitive object={lineObject} />

      {/* High-speed Photon Energy Pulse 1 */}
      <mesh ref={pulseRef1}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.95} depthWrite={false} />
      </mesh>

      {/* High-speed Photon Energy Pulse 2 */}
      <mesh ref={pulseRef2}>
        <sphereGeometry args={[0.016, 12, 12]} />
        <meshBasicMaterial color="#FFAA00" transparent opacity={0.9} depthWrite={false} />
      </mesh>

      {/* Target Impact Focal Ping */}
      <mesh ref={impactRef}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#FFBF00" wireframe transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Keplerian Orbit Track Ring for Satellites & Space Debris, highlighted for targeted/selected debris
function DebrisOrbitRing({
  debris,
  selected,
  isTargeted
}: {
  debris: Debris;
  selected: boolean;
  isTargeted: boolean;
}) {
  const points = useMemo(() => {
    return getDebrisOrbitTrackSamples(debris, 64);
  }, [debris]);

  if (debris.status === "recovered") return null;

  const color = isTargeted ? "#FFBF00" : selected ? "#00FFFF" : "#38bdf8";
  const lineWidth = isTargeted ? 2.6 : selected ? 1.8 : 0.6;
  const opacity = isTargeted ? 0.9 : selected ? 0.75 : 0.16;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      dashed={!isTargeted}
      dashSize={selected ? 0.08 : 0.04}
      gapSize={selected ? 0.04 : 0.08}
      transparent
      opacity={opacity}
    />
  );
}

function OrbitalScene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { debris, drones, depot, selectedDebrisId, selectDebris, focusedEntity, focusEntity } = useMissionStore();
  const { camera } = useThree();

  const prevEntityKeyRef = useRef<string>("earth");
  const isTransitioningRef = useRef<boolean>(false);
  const lastTrackedPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const handleZoom = (event: Event) => {
      const direction = (event as CustomEvent<"in" | "out">).detail;
      const controls = controlsRef.current;
      if (!controls) return;

      const distanceVal = controls.object.position.distanceTo(controls.target);
      const nextDistance = THREE.MathUtils.clamp(
        distanceVal + (direction === "in" ? -0.4 : 0.4),
        0.35,
        16
      );
      const directionVector = controls.object.position.clone().sub(controls.target).normalize();
      controls.object.position.copy(controls.target).add(directionVector.multiplyScalar(nextDistance));
      controls.update();
    };

    window.addEventListener("scale:zoom", handleZoom);
    return () => window.removeEventListener("scale:zoom", handleZoom);
  }, []);

  // Real-time flight position calculator for drones along curved transfer arcs and docked berths
  const getDroneRealtimePos = (drone: Drone): [number, number, number] => {
    return getDroneWorldPosition(drone, depot.position, Date.now() / 1000, debris);
  };

  // Frame-by-frame camera focus & dynamic follow tracking loop
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Calculate desired 3D focus coordinate and optimal framing distance
    const targetVec = new THREE.Vector3(0, 0, 0);
    let targetDistance = 6.5;

    if (focusedEntity.type === "debris") {
      const item = debris.find((d) => d.id === focusedEntity.id);
      if (item) {
        if (item.status === "recovered") {
          targetVec.set(depot.position[0], depot.position[1], depot.position[2]);
          targetDistance = 1.35;
        } else {
          // If captured and returning with a carrier drone, follow the drone's active transit
          const carrierDrone = drones.find(
            (d) => d.targetId === item.id && (d.status === "returning" || d.status === "capturing")
          );
          if (carrierDrone) {
            const pos = getDroneRealtimePos(carrierDrone);
            targetVec.set(pos[0], pos[1], pos[2]);
            targetDistance = 0.65;
          } else {
            // Real-time Keplerian orbital position
            const pos = getDebrisOrbitalPosition(item, Date.now() / 1000);
            targetVec.set(pos[0], pos[1], pos[2]);
            targetDistance = 0.85;
          }
        }
      }
    } else if (focusedEntity.type === "drone") {
      const drone = drones.find((d) => d.id === focusedEntity.id);
      if (drone) {
        const pos = getDroneRealtimePos(drone);
        targetVec.set(pos[0], pos[1], pos[2]);
        targetDistance = 0.55;
      }
    } else if (focusedEntity.type === "depot") {
      targetVec.set(depot.position[0], depot.position[1], depot.position[2]);
      targetDistance = 1.35;
    }

    // Detect target shift
    const currentKey = `${focusedEntity.type}-${focusedEntity.id || "root"}`;
    if (prevEntityKeyRef.current !== currentKey) {
      prevEntityKeyRef.current = currentKey;
      isTransitioningRef.current = true;
      lastTrackedPosRef.current.copy(targetVec);
    }

    if (isTransitioningRef.current) {
      // Smoothly transition orbit pivot target to the entity
      controls.target.lerp(targetVec, 0.08);

      // Smoothly adjust framing distance along camera view line
      const currentDist = camera.position.distanceTo(controls.target);
      const viewDir = camera.position.clone().sub(controls.target).normalize();
      if (viewDir.lengthSq() < 0.001) {
        viewDir.set(0, 0.2, 1).normalize();
      }

      const nextDist = THREE.MathUtils.lerp(currentDist, targetDistance, 0.08);
      camera.position.copy(controls.target).add(viewDir.multiplyScalar(nextDist));

      // Transition completes when camera framing and target alignment are close
      if (
        Math.abs(currentDist - targetDistance) < 0.03 &&
        controls.target.distanceTo(targetVec) < 0.03
      ) {
        isTransitioningRef.current = false;
        lastTrackedPosRef.current.copy(targetVec);
      }
    } else {
      // Continuous Follow Mode: translate both orbit target and camera by target's movement delta
      const delta = targetVec.clone().sub(lastTrackedPosRef.current);
      controls.target.add(delta);
      camera.position.add(delta);

      // Dampen any residual drift between controls.target and actual entity position
      const drift = targetVec.clone().sub(controls.target);
      if (drift.lengthSq() > 0.000001) {
        const correction = drift.multiplyScalar(0.1);
        controls.target.add(correction);
        camera.position.add(correction);
      }

      lastTrackedPosRef.current.copy(targetVec);
    }

    controls.update();
  });

  return (
    <>
      <color attach="background" args={["#010204"]} />
      <fog attach="fog" args={["#010204", 10, 25]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 10, 6]} intensity={2.2} />
      <directionalLight position={[-8, -5, -6]} intensity={0.7} />
      <pointLight position={[0, 0, 0]} intensity={1.2} distance={8} color="#00ffff" />
      <Stars radius={50} depth={25} count={2500} factor={2.2} saturation={0.2} fade speed={0.4} />

      {/* Earth Centerpiece */}
      <Earth />

      {/* Recovery Depot Multi-Bay Orbital Hub */}
      <OrbitalRecoveryStation depot={depot} drones={drones} />

      {/* Keplerian Orbit Track Rings for Satellites & Space Debris */}
      {debris.map((item) => (
        <DebrisOrbitRing
          key={`orbit-${item.id}`}
          debris={item}
          selected={item.id === selectedDebrisId}
          isTargeted={item.status === "targeted"}
        />
      ))}

      {/* Debris Swarm */}
      {debris.map((item) => (
        <DebrisMesh
          key={item.id}
          debris={item}
          selected={item.id === selectedDebrisId}
          assignedDrone={drones.find((d) => d.targetId === item.id || (item.assignedDroneId && d.id === item.assignedDroneId))}
          onClick={() => selectDebris(item.id)}
        />
      ))}

      {/* Drones */}
      {drones.map((drone) => (
        <DroneMesh
          key={drone.id}
          drone={drone}
          onSelectTarget={selectDebris}
        />
      ))}

      {/* Dynamic Intercept Guidance Laser Vectors & Energy Pulses */}
      {drones.map((drone) => {
        if (!drone.targetId) return null;
        if (drone.status !== "intercepting" && drone.status !== "capturing") return null;
        const targetDebris = debris.find((item) => item.id === drone.targetId);
        if (!targetDebris || targetDebris.status === "recovered") return null;

        return (
          <InterceptGuidanceBeam
            key={`guidance-${drone.id}-${targetDebris.id}`}
            drone={drone}
            debris={targetDebris}
          />
        );
      })}

      {/* Dynamic Curved Trajectories */}
      {drones.map((drone) => {
        if (!drone.flight) return null;
        if (drone.status === "intercepting") {
          return (
            <ActiveTrajectory
              key={`traj-${drone.id}-intercept`}
              start={drone.flight.startPosition}
              target={drone.flight.targetPosition}
              color="#00BFFF"
            />
          );
        }
        if (drone.status === "returning") {
          return (
            <ActiveTrajectory
              key={`traj-${drone.id}-return`}
              start={drone.flight.startPosition}
              target={drone.flight.targetPosition}
              color="#00FF66"
            />
          );
        }
        return null;
      })}

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={0.25}
        maxDistance={16}
        enableDamping={true}
        dampingFactor={0.05}
      />
    </>
  );
}

export default function Scene() {
  const focusEntity = useMissionStore((state) => state.focusEntity);

  return (
    <div className="scene-canvas">
      <Canvas
        camera={{ position: [0, 1.2, 6.5], fov: 40 }}
        dpr={[1, 1.7]}
        onPointerMissed={() => focusEntity("earth")}
      >
        <Suspense fallback={null}>
          <OrbitalScene />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/scale-extraction-drone.glb");
useGLTF.preload("/scale-extraction-drone-debry.glb");
useTexture.preload("/textures/earth/earth_day.jpg");
useTexture.preload("/textures/earth/earth_lights.png");
useTexture.preload("/textures/earth/earth_clouds.png");
useTexture.preload("/textures/earth/earth_specular.jpg");
