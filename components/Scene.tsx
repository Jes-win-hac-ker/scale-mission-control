"use client";

import { Line, OrbitControls, Stars, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
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

// Glowing Ring & Station for Recovery Depot "DEPOT-01"
function RecoveryDepotRing({ depot }: { depot: RecoveryDepot }) {
  const outerRingRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += delta * 0.45;
      outerRingRef.current.rotation.x += delta * 0.2;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * 0.6;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={depot.position}>
      {/* Outer Rotating Glowing Ring */}
      <group ref={outerRingRef}>
        <mesh>
          <torusGeometry args={[0.34, 0.032, 16, 64]} />
          <meshBasicMaterial color="#00FFFF" toneMapped={false} />
        </mesh>
        {/* Glow halo */}
        <mesh scale={1.12}>
          <torusGeometry args={[0.34, 0.015, 8, 32]} />
          <meshBasicMaterial
            color="#00FF66"
            transparent
            opacity={0.55}
            toneMapped={false}
          />
        </mesh>
        {/* Docking crossbars */}
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.68, 0.015, 0.015]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.8} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.68, 0.015, 0.015]} />
          <meshBasicMaterial color="#00FFFF" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Counter-rotating Inner Energy Ring */}
      <mesh ref={innerRingRef}>
        <torusGeometry args={[0.22, 0.016, 8, 32]} />
        <meshBasicMaterial color="#00E676" transparent opacity={0.7} toneMapped={false} />
      </mesh>

      {/* Central Station Core */}
      <mesh ref={coreRef}>
        <octahedronGeometry args={[0.11, 0]} />
        <meshBasicMaterial color="#E0FFFF" toneMapped={false} />
      </mesh>

      {/* Depot Beacon Light */}
      <pointLight color="#00FFFF" intensity={2} distance={3} />
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
function DroneMesh({ drone }: { drone: Drone }) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);

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
    <group ref={groupRef} position={drone.position}>
      {/* 3D Extraction Drone GLB Model */}
      <group ref={modelRef}>
        <DroneGLBModel status={drone.status} color={baseColor} />

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

// Procedural Debris Geometries: Randomized Rocks, Rocket Parts, Solar Arrays, and Shards
function DebrisShape({
  material,
  color,
  wireframe,
  opacity,
  scale
}: {
  material?: string;
  color: string;
  wireframe: boolean;
  opacity: number;
  scale: number;
}) {
  const mat = (material || "").toLowerCase();

  // 1. Defunct Satellite / Solar Array
  if (mat.includes("solar") || mat.includes("battery")) {
    return (
      <group scale={scale}>
        {/* Central Satellite Body */}
        <mesh>
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
        </mesh>
        {/* Left Solar Panel */}
        <mesh position={[-1.15, 0, 0]}>
          <boxGeometry args={[1.3, 0.55, 0.05]} />
          <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
        </mesh>
        {/* Right Solar Panel */}
        <mesh position={[1.15, 0, 0]}>
          <boxGeometry args={[1.3, 0.55, 0.05]} />
          <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
        </mesh>
        {/* High-gain Antenna Rod */}
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  // 2. Spent Rocket Stage / Reaction Wheel / Engine
  if (mat.includes("wheel") || mat.includes("fairing") || mat.includes("reaction")) {
    return (
      <group scale={scale}>
        {/* Cylindrical Booster Body */}
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.45, 1.4, 10]} />
          <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
        </mesh>
        {/* Rocket Nozzle / Engine Bell */}
        <mesh position={[0, -0.85, 0]} rotation={[Math.PI / 4, 0, 0]}>
          <coneGeometry args={[0.48, 0.5, 10]} />
          <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
        </mesh>
        {/* Interstage Ring */}
        <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 4, 0, 0]}>
          <torusGeometry args={[0.42, 0.05, 8, 16]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  // 3. Structural Strut / Shard
  if (mat.includes("strut") || mat.includes("shielding")) {
    return (
      <group scale={scale}>
        {/* Angular Shard Plate */}
        <mesh rotation={[0.4, 0.5, 0.2]}>
          <octahedronGeometry args={[0.85, 0]} />
          <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
        </mesh>
        {/* Broken Truss Rod */}
        <mesh rotation={[0.6, -0.3, 0.8]}>
          <cylinderGeometry args={[0.05, 0.05, 1.6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  // 4. Randomized Space Rock / Asteroid Fragment
  return (
    <group scale={scale}>
      <mesh>
        <dodecahedronGeometry args={[0.8, 1]} />
        <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh scale={0.55} position={[0.35, 0.3, -0.25]}>
        <tetrahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color={color} wireframe={wireframe} transparent opacity={opacity} toneMapped={false} />
      </mesh>
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
      {/* Visual Procedural Mesh Group */}
      <group ref={visualRef}>
        <DebrisShape
          material={debris.material}
          color={color}
          wireframe={debris.status === "available" || debris.status === "targeted"}
          opacity={debris.status === "recovered" ? 0.45 : 0.95}
          scale={baseScale}
        />
      </group>

      {/* Invisible Interactive Click Hitbox (makes small realistic debris easy to click) */}
      <mesh>
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshBasicMaterial visible={false} />
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
  const { debris, drones, depot, selectedDebrisId, selectDebris } = useMissionStore();

  useEffect(() => {
    const handleZoom = (event: Event) => {
      const direction = (event as CustomEvent<"in" | "out">).detail;
      const controls = controlsRef.current;
      if (!controls) return;

      const distanceVal = controls.object.position.distanceTo(controls.target);
      const nextDistance = THREE.MathUtils.clamp(
        distanceVal + (direction === "in" ? -0.65 : 0.65),
        4.5,
        9
      );
      const directionVector = controls.object.position.clone().sub(controls.target).normalize();
      controls.object.position.copy(controls.target).add(directionVector.multiplyScalar(nextDistance));
      controls.update();
    };

    window.addEventListener("scale:zoom", handleZoom);
    return () => window.removeEventListener("scale:zoom", handleZoom);
  }, []);

  return (
    <>
      <color attach="background" args={["#010204"]} />
      <fog attach="fog" args={["#010204", 10, 25]} />
      <ambientLight intensity={0.35} />
      <Stars radius={50} depth={25} count={2500} factor={2.2} saturation={0.2} fade speed={0.4} />

      {/* Earth Centerpiece */}
      <Earth />

      {/* Recovery Depot Glowing Ring & Station */}
      <RecoveryDepotRing depot={depot} />

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
        <DroneMesh key={drone.id} drone={drone} />
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
        enablePan={false}
        enableZoom={false}
        enableRotate
        minDistance={4.5}
        maxDistance={9}
        autoRotate
        autoRotateSpeed={0.2}
      />
    </>
  );
}

export default function Scene() {
  const canvasHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    if (!canvasHost) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("scale:zoom", {
          detail: event.deltaY < 0 ? "in" : "out"
        })
      );
    };

    canvasHost.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvasHost.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div ref={canvasHostRef} className="scene-canvas">
      <Canvas camera={{ position: [0, 1.2, 6.5], fov: 40 }} dpr={[1, 1.7]}>
        <Suspense fallback={null}>
          <OrbitalScene />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/scale-extraction-drone.glb");
