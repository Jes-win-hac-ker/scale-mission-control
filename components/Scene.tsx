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
  const intakePulseRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const addLog = useMissionStore((state) => state.addLog);
  const totalRecoveredMass = useMissionStore((state) => state.totalRecoveredMass);
  const totalRecoveredValue = useMissionStore((state) => state.totalRecoveredValue);
  const focusEntity = useMissionStore((state) => state.focusEntity);

  // Check if any drone is currently returning or approaching depot
  const activeIncoming = useMemo(() => {
    return drones.some((d) => d.status === "returning");
  }, [drones]);

  useFrame((_, delta) => {
    // Smooth continuous centrifugal spin of habitat ring
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.35;
    }
    // High-frequency telemetry sweep of radar dish
    if (radarRef.current) {
      radarRef.current.rotation.y += delta * 1.2;
    }
    // Pulsing intake glow
    if (intakePulseRef.current) {
      const pulse = 0.6 + Math.sin(Date.now() * 0.005) * 0.35;
      (intakePulseRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });

  const handleStationClick = (e: any) => {
    e.stopPropagation();
    focusEntity("depot", "DEPOT-01");
    const valString = (totalRecoveredValue / 1_000_000).toFixed(2);
    addLog(
      `DEPOT-01 STATUS // ORBITAL RECOVERY HUB // STORED MASS: ${totalRecoveredMass} kg // SALVAGE VALUE: $${valString}M // 4 BERTHS ONLINE`,
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
      {/* 1. Central Pressurized Command Hub */}
      <mesh>
        <cylinderGeometry args={[0.08, 0.09, 0.42, 16]} />
        <meshStandardMaterial
          color="#334155"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* Observation Ring & Visor Windows */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.088, 0.088, 0.05, 16]} />
        <meshBasicMaterial color="#00FFFF" toneMapped={false} />
      </mesh>

      {/* 2. Top Communications Tower & Sweeping Radar Spire */}
      <group position={[0, 0.21, 0]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.012, 0.018, 0.16, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Sweeping High-Gain Radar Dish */}
        <group ref={radarRef} position={[0, 0.17, 0]}>
          <mesh rotation={[0.4, 0, 0]}>
            <coneGeometry args={[0.055, 0.025, 16, 1, true]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.04, 6]} />
            <meshBasicMaterial color="#00FFCC" toneMapped={false} />
          </mesh>
        </group>
        {/* Beacon light */}
        <pointLight color="#00FFCC" intensity={1.8} distance={2.5} />
      </group>

      {/* 3. Counter-Rotating Toroidal Habitat Ring */}
      <group ref={ringRef}>
        {/* Outer Torus */}
        <mesh>
          <torusGeometry args={[0.36, 0.024, 16, 64]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        {/* Habitation Ring Edge Neon Strips */}
        <mesh scale={1.03}>
          <torusGeometry args={[0.36, 0.008, 8, 32]} />
          <meshBasicMaterial
            color="#00FFFF"
            transparent
            opacity={0.65}
            toneMapped={false}
          />
        </mesh>
        {/* 4 Structural Spoke Trusses */}
        <mesh rotation={[0, 0, 0]}>
          <boxGeometry args={[0.72, 0.014, 0.018]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.72, 0.014, 0.018]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* 4. Articulating Solar Array Wings */}
      <group position={[0, 0.02, 0]}>
        {/* Port Solar Wing */}
        <group position={[-0.58, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.36, 0.008, 0.14]} />
            <meshStandardMaterial
              color="#1e3a8a"
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[0.19, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.04, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
        {/* Starboard Solar Wing */}
        <group position={[0.58, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.36, 0.008, 0.14]} />
            <meshStandardMaterial
              color="#1e3a8a"
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[-0.19, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.04, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* 5. Four Cantilever Drone Mooring Berths (N, S, E, W) */}
      {[
        { id: "B1", pos: [0.46, -0.04, 0], rot: [0, 0, 0] },
        { id: "B2", pos: [-0.46, -0.04, 0], rot: [0, Math.PI, 0] },
        { id: "B3", pos: [0, -0.04, 0.46], rot: [0, -Math.PI / 2, 0] },
        { id: "B4", pos: [0, -0.04, -0.46], rot: [0, Math.PI / 2, 0] }
      ].map((berth) => (
        <group key={berth.id} position={berth.pos as [number, number, number]} rotation={berth.rot as [number, number, number]}>
          {/* Berth Cantilever Arm */}
          <mesh position={[-0.04, 0, 0]}>
            <boxGeometry args={[0.1, 0.016, 0.024]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Magnetic Mooring Cradle */}
          <mesh position={[0.02, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.018, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Docking Target Ring */}
          <mesh position={[0.02, 0.011, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.025, 0.038, 16]} />
            <meshBasicMaterial
              color={activeIncoming ? "#FFBF00" : "#00FF66"}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Approach Guide Micro-Lights */}
          <mesh position={[0.02, 0.015, 0.035]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color={activeIncoming ? "#FFBF00" : "#00FFCC"} />
          </mesh>
          <mesh position={[0.02, 0.015, -0.035]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshBasicMaterial color={activeIncoming ? "#FFBF00" : "#00FFCC"} />
          </mesh>
        </group>
      ))}

      {/* 6. Underside Salvage De-Orbit & Smelting Intake Chute */}
      <group position={[0, -0.22, 0]}>
        {/* Inverted Conical Smelting Funnel */}
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.12, 16, 1, true]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.85}
            roughness={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Electromagnetic Containment Ring */}
        <mesh position={[0, -0.07, 0]}>
          <torusGeometry args={[0.165, 0.014, 8, 32]} />
          <meshBasicMaterial color="#00FFFF" toneMapped={false} />
        </mesh>
        {/* Pulsing Processing Field Beam */}
        <mesh ref={intakePulseRef} position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.155, 24]} />
          <meshBasicMaterial
            color={activeIncoming ? "#00FF66" : "#00FFFF"}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Core Processing Light */}
        <pointLight
          color={activeIncoming ? "#00FF66" : "#00FFFF"}
          intensity={2.2}
          distance={1.8}
        />
      </group>

      {/* 7. Hover Shield Bubble */}
      {hovered && (
        <mesh>
          <sphereGeometry args={[0.62, 24, 24]} />
          <meshBasicMaterial
            color="#00FFFF"
            transparent
            opacity={0.12}
            wireframe
          />
        </mesh>
      )}

      {/* 8. Invisible Raycasting Click Hitbox */}
      <mesh>
        <sphereGeometry args={[0.58, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// 3D GLB Model Instance for Swarm Drones
function DroneGLBModel({
  status,
  color
}: {
  status: Drone["status"];
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
  const debrisList = useMissionStore((state) => state.debris);
  const focusEntity = useMissionStore((state) => state.focusEntity);

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

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Time-based movement with easing function
    if (drone.flight && (drone.status === "intercepting" || drone.status === "returning")) {
      const elapsed = (Date.now() - drone.flight.startTime) / 1000;
      const progress = Math.min(1, Math.max(0, elapsed / drone.flight.duration));
      const eased = easeInOutQuad(progress);

      const targetX = THREE.MathUtils.lerp(drone.flight.startPosition[0], drone.flight.targetPosition[0], eased);
      const targetY = THREE.MathUtils.lerp(drone.flight.startPosition[1], drone.flight.targetPosition[1], eased);
      const targetZ = THREE.MathUtils.lerp(drone.flight.startPosition[2], drone.flight.targetPosition[2], eased);

      groupRef.current.position.set(targetX, targetY, targetZ);

      // Dynamically orient drone toward flight target vector
      if (modelRef.current) {
        const flightTarget = new THREE.Vector3(...drone.flight.targetPosition);
        modelRef.current.lookAt(flightTarget);
      }
    } else {
      groupRef.current.position.set(drone.position[0], drone.position[1], drone.position[2]);
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.006;
      }
    }

    // Capture visual pulse
    if (modelRef.current && drone.status === "capturing") {
      const pulse = 1 + Math.sin(clock.elapsedTime * 14) * 0.25;
      modelRef.current.scale.setScalar(pulse);
    } else if (modelRef.current) {
      modelRef.current.scale.setScalar(1);
    }
  });

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
        <DroneGLBModel status={drone.status} color={baseColor} />

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

        {/* Dynamic Thruster / Engine Plume during Flight */}
        {(drone.status === "intercepting" || drone.status === "returning") && (
          <group position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <coneGeometry args={[0.035, 0.12, 8]} />
              <meshBasicMaterial
                color={drone.status === "intercepting" ? "#00BFFF" : "#00FF66"}
                transparent
                opacity={0.85}
                toneMapped={false}
              />
            </mesh>
            <pointLight
              color={drone.status === "intercepting" ? "#00BFFF" : "#00FF66"}
              intensity={2}
              distance={0.8}
            />
          </group>
        )}

        {/* Capturing Pulse Emitter Light */}
        {drone.status === "capturing" && (
          <pointLight color="#ffffff" intensity={3} distance={0.6} />
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

    // When captured and drone is returning, debris position follows drone
    if (
      debris.status === "captured" &&
      assignedDrone?.flight &&
      assignedDrone.status === "returning"
    ) {
      const elapsed = (Date.now() - assignedDrone.flight.startTime) / 1000;
      const progress = Math.min(1, Math.max(0, elapsed / assignedDrone.flight.duration));
      const eased = easeInOutQuad(progress);

      groupRef.current.position.set(
        THREE.MathUtils.lerp(
          assignedDrone.flight.startPosition[0],
          assignedDrone.flight.targetPosition[0],
          eased
        ),
        THREE.MathUtils.lerp(
          assignedDrone.flight.startPosition[1],
          assignedDrone.flight.targetPosition[1],
          eased
        ),
        THREE.MathUtils.lerp(
          assignedDrone.flight.startPosition[2],
          assignedDrone.flight.targetPosition[2],
          eased
        )
      );
    } else {
      groupRef.current.position.set(debris.position[0], debris.position[1], debris.position[2]);
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

// Active Trajectory Vectors
function ActiveTrajectory({
  points,
  color
}: {
  points: [[number, number, number], [number, number, number]];
  color: string;
}) {
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.4}
      dashed
      dashSize={0.08}
      gapSize={0.05}
      transparent
      opacity={0.85}
    />
  );
}

function OrbitalScene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { debris, drones, depot, selectedDebrisId, selectDebris, focusedEntity, focusEntity } = useMissionStore();
  const { camera } = useThree();

  const prevEntityKeyRef = useRef<string>("earth");
  const isTransitioningRef = useRef<boolean>(false);

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

  // Frame-by-frame camera focus & tracking loop
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Calculate desired 3D focus coordinate and optimal framing distance
    const targetVec = new THREE.Vector3(0, 0, 0);
    let targetDistance = 6.5;

    if (focusedEntity.type === "debris") {
      const item = debris.find((d) => d.id === focusedEntity.id);
      if (item) {
        targetVec.set(item.position[0], item.position[1], item.position[2]);
        targetDistance = 0.85;
      }
    } else if (focusedEntity.type === "drone") {
      const drone = drones.find((d) => d.id === focusedEntity.id);
      if (drone) {
        let pos = drone.position;
        if (drone.flight && (drone.status === "intercepting" || drone.status === "returning")) {
          const elapsed = (Date.now() - drone.flight.startTime) / 1000;
          const progress = Math.min(1, Math.max(0, elapsed / drone.flight.duration));
          const eased = easeInOutQuad(progress);
          pos = [
            THREE.MathUtils.lerp(drone.flight.startPosition[0], drone.flight.targetPosition[0], eased),
            THREE.MathUtils.lerp(drone.flight.startPosition[1], drone.flight.targetPosition[1], eased),
            THREE.MathUtils.lerp(drone.flight.startPosition[2], drone.flight.targetPosition[2], eased)
          ];
        }
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
    }

    // Smoothly shift orbit pivot target
    controls.target.lerp(targetVec, 0.08);

    // During active transition, smoothly adjust distance along camera view line
    if (isTransitioningRef.current) {
      const currentDist = camera.position.distanceTo(controls.target);
      const viewDir = camera.position.clone().sub(controls.target).normalize();
      if (viewDir.lengthSq() < 0.001) {
        viewDir.set(0, 0.2, 1).normalize();
      }

      const nextDist = THREE.MathUtils.lerp(currentDist, targetDistance, 0.08);
      camera.position.copy(controls.target).add(viewDir.multiplyScalar(nextDist));

      if (Math.abs(currentDist - targetDistance) < 0.02 && controls.target.distanceTo(targetVec) < 0.02) {
        isTransitioningRef.current = false;
      }
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

      {/* Dynamic Trajectories */}
      {drones.map((drone) => {
        if (!drone.flight) return null;
        if (drone.status === "intercepting") {
          return (
            <ActiveTrajectory
              key={`traj-${drone.id}-intercept`}
              points={[drone.flight.startPosition, drone.flight.targetPosition]}
              color="#2979FF"
            />
          );
        }
        if (drone.status === "returning") {
          return (
            <ActiveTrajectory
              key={`traj-${drone.id}-return`}
              points={[drone.flight.startPosition, drone.flight.targetPosition]}
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
