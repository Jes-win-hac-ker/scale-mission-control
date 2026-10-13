"use client";

import { Line, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Debris, Drone, useMissionStore } from "@/lib/store";

function GlowSphere({
  color,
  position,
  size = 0.075,
  selected = false,
  targetPosition,
  startedAt,
  wireframe = false
}: {
  color: string;
  position: [number, number, number];
  size?: number;
  selected?: boolean;
  targetPosition?: [number, number, number];
  startedAt?: number;
  wireframe?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.5) * 0.1;
    ref.current.scale.setScalar(selected ? pulse * 1.6 : pulse);
    if (targetPosition && startedAt) {
      const progress = Math.min(1, (Date.now() - startedAt) / 5000);
      ref.current.position.lerpVectors(new THREE.Vector3(...position), new THREE.Vector3(...targetPosition), progress);
    }
  });

  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[size, 1]} />
      <meshBasicMaterial
        color={color}
        toneMapped={false}
        wireframe={wireframe}
        transparent={wireframe}
        opacity={wireframe ? 0.95 : 1}
      />
      {selected && (
        <mesh scale={1.8}>
          <ringGeometry args={[size * 1.8, size * 2.2, 32]} />
          <meshBasicMaterial color="#FF0033" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </mesh>
  );
}

function Earth() {
  const earthRef = useRef<THREE.Group>(null);
  const earthTexture = useMemo(() => new THREE.TextureLoader().load("/earth-map.svg"), []);
  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.08;
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

function Trajectory({ drone, target }: { drone: Drone; target: Debris }) {
  const points = useMemo(() => [drone.position, target.position], [drone.position, target.position]);
  return (
    <Line
      points={points}
      color="#00FFFF"
      lineWidth={1.2}
      dashed
      dashSize={0.08}
      gapSize={0.05}
      transparent
      opacity={0.9}
    />
  );
}

function OrbitalScene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { debris, drones, selectedDebrisId } = useMissionStore();

  useEffect(() => {
    const handleZoom = (event: Event) => {
      const direction = (event as CustomEvent<"in" | "out">).detail;
      const controls = controlsRef.current;
      if (!controls) return;

      const distance = controls.object.position.distanceTo(controls.target);
      const nextDistance = THREE.MathUtils.clamp(
        distance + (direction === "in" ? -0.65 : 0.65),
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
      <color attach="background" args={["#d8ccb8"]} />
      <fog attach="fog" args={["#d8ccb8", 8, 18]} />
      <ambientLight intensity={0.2} />
      <Stars radius={40} depth={20} count={900} factor={1.5} saturation={0} fade speed={0.3} />
      <Earth />
      {debris.map((item) => (
        <GlowSphere
          key={item.id}
          color={item.id === selectedDebrisId ? "#FF0033" : item.status === "Secured" ? "#536566" : "#FF0033"}
          position={item.position}
          size={item.status === "Secured" ? 0.038 : 0.052}
          selected={item.id === selectedDebrisId}
          wireframe
        />
      ))}
      {drones.map((drone) => (
        <GlowSphere
          key={drone.id}
          color="#00FFFF"
          position={drone.position}
          size={0.095}
          targetPosition={debris.find((item) => item.id === drone.targetId)?.position}
          startedAt={drone.interceptStartedAt}
        />
      ))}
      {drones.map((drone) => {
        const target = debris.find((item) => item.id === drone.targetId);
        return drone.status === "Intercepting" && target ? (
          <Trajectory key={`${drone.id}-${target.id}`} drone={drone} target={target} />
        ) : null;
      })}
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
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
        <OrbitalScene />
      </Canvas>
    </div>
  );
}
