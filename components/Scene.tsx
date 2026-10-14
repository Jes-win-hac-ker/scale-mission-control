"use client";

import { Line, OrbitControls, Stars, useGLTF } from "@react-three/drei";
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
  getOrbitalArcPoint,
  getOrbitalArcSamples,
  getOrbitalArcTangent,
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

  // Carried debris when actively capturing or returning payload to Docking Station
  const carriedDebris = useMemo(() => {
    if (!drone.targetId || (drone.status !== "capturing" && drone.status !== "returning")) {
      return null;
    }
    return debrisList.find((d) => d.id === drone.targetId) || null;
  }, [drone.targetId, drone.status, debrisList]);

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
      // 2. Target Rendezvous & Capturing: Spin-matching & Clamping
      groupRef.current.position.set(drone.position[0], drone.position[1], drone.position[2]);
      if (modelRef.current) {
        if (drone.subStatus === "detumbling") {
          // Spin-matching detumble synchronization with tumbling space debris
          modelRef.current.rotation.x = Math.sin(clock.elapsedTime * 2.8) * 0.35;
          modelRef.current.rotation.y += 0.038;
          modelRef.current.rotation.z = Math.cos(clock.elapsedTime * 2.2) * 0.28;
        } else {
          // Clamping: Stabilize rigid body orientation
          modelRef.current.rotation.x = THREE.MathUtils.lerp(modelRef.current.rotation.x, 0, 0.08);
          modelRef.current.rotation.z = THREE.MathUtils.lerp(modelRef.current.rotation.z, 0, 0.08);
          modelRef.current.rotation.y += 0.008;
        }
      }
    } else {
      // 3. Docked at Station Berths: Synchronize with station ring rotation
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

  // Status-based color mapping per prompt requirements:
  // - Targeted debris: amber
  // - Captured debris: green
  // - Available debris: red
  const color = useMemo(() => {
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
  }, [debris.status]);

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

    // When captured and drone is returning, debris position follows drone along curved orbital arc
    if (
      debris.status === "captured" &&
      assignedDrone?.flight &&
      assignedDrone.status === "returning"
    ) {
      const elapsed = (Date.now() - assignedDrone.flight.startTime) / 1000;
      const progress = Math.min(1, Math.max(0, elapsed / assignedDrone.flight.duration));
      const eased = easeInOutQuad(progress);

      const pos = getOrbitalArcPoint(
        assignedDrone.flight.startPosition,
        assignedDrone.flight.targetPosition,
        eased
      );
      groupRef.current.position.set(pos[0], pos[1], pos[2]);
    } else if (debris.status === "recovered") {
      groupRef.current.position.set(debris.position[0], debris.position[1], debris.position[2]);
    } else {
      // Continuous Keplerian orbital motion around Earth
      const pos = getDebrisOrbitalPosition(debris, Date.now() / 1000);
      groupRef.current.position.set(pos[0], pos[1], pos[2]);
    }

    // Natural multi-axis tumbling rotation
    if (visualRef.current) {
      visualRef.current.rotation.x += spinVector[0];
      visualRef.current.rotation.y += spinVector[1];
      visualRef.current.rotation.z += spinVector[2];

      if (selected) {
        const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.18;
        visualRef.current.scale.setScalar(pulse);
      } else {
        visualRef.current.scale.setScalar(1);
      }
    }
  });

  // When recovered or actively carried in drone claws during capture/return, hide independent orbit mesh
  if (
    debris.status === "recovered" ||
    (debris.status === "captured" &&
      assignedDrone &&
      (assignedDrone.status === "returning" || assignedDrone.status === "capturing"))
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
          wireframe={debris.status === "targeted"}
          opacity={0.98}
          scale={baseScale}
        />
      </group>

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

      {/* Target Reticle for Selected Debris */}
      {selected && (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.095, 32]} />
            <meshBasicMaterial
              color="#FFBF00"
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.08, 0.095, 32]} />
            <meshBasicMaterial
              color="#FFBF00"
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Earth Visualization
function Earth() {
  const earthRef = useRef<THREE.Group>(null);
  const earthTexture = useMemo(() => new THREE.TextureLoader().load("/earth-map.svg"), []);
  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.06;
  });

  return (
    <group ref={earthRef}>
      <mesh>
        <icosahedronGeometry args={[1.35, 2]} />
        <meshBasicMaterial color="#76e6e9" wireframe transparent opacity={0.22} />
      </mesh>
      <mesh scale={0.96}>
        <sphereGeometry args={[1.35, 32, 32]} />
        <meshBasicMaterial map={earthTexture} color="#d3ffff" transparent opacity={0.98} />
      </mesh>
      <mesh scale={0.985}>
        <sphereGeometry args={[1.35, 32, 32]} />
        <meshBasicMaterial color="#d7ffff" transparent opacity={0.1} wireframe />
      </mesh>
      <mesh rotation={[Math.PI / 2.15, 0.4, 0]}>
        <torusGeometry args={[1.62, 0.008, 8, 96]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[0.5, 0.4, Math.PI / 2]}>
        <torusGeometry args={[1.9, 0.006, 8, 96]} />
        <meshBasicMaterial color="#ffbf00" transparent opacity={0.22} />
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

// Faint Orbit Trace Ring for Satellites & Space Debris
function DebrisOrbitRing({
  debris,
  selected
}: {
  debris: Debris;
  selected: boolean;
}) {
  const points = useMemo(() => {
    return getDebrisOrbitTrackSamples(debris, 64);
  }, [debris]);

  if (debris.status === "recovered") return null;

  return (
    <Line
      points={points}
      color={selected ? "#FFBF00" : "#38bdf8"}
      lineWidth={selected ? 1.4 : 0.6}
      dashed
      dashSize={selected ? 0.08 : 0.04}
      gapSize={selected ? 0.04 : 0.08}
      transparent
      opacity={selected ? 0.65 : 0.16}
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
    if (drone.flight && (drone.status === "intercepting" || drone.status === "returning")) {
      const elapsed = (Date.now() - drone.flight.startTime) / 1000;
      const progress = Math.min(1, Math.max(0, elapsed / drone.flight.duration));
      const eased = easeInOutQuad(progress);
      return getOrbitalArcPoint(drone.flight.startPosition, drone.flight.targetPosition, eased);
    }
    if (drone.status === "idle" || drone.status === "recovered" || drone.subStatus === "docked") {
      const ringAngle = getStationRingAngle(Date.now() / 1000);
      return getBerthWorldPosition(drone.berthId, depot.position, ringAngle);
    }
    return drone.position;
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
        />
      ))}

      {/* Debris Swarm */}
      {debris.map((item) => (
        <DebrisMesh
          key={item.id}
          debris={item}
          selected={item.id === selectedDebrisId}
          assignedDrone={drones.find((d) => d.targetId === item.id)}
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
