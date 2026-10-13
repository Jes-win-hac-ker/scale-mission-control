"use client";

import dynamic from "next/dynamic";

const MissionControl = dynamic(() => import("@/components/MissionControl"), {
  ssr: false,
  loading: () => (
    <main className="mission-shell flex items-center justify-center min-h-screen bg-[#d8ccb8]">
      <div className="text-center font-mono text-[#050505] p-6">
        <div className="text-3xl font-bold tracking-widest mb-3">PROJECT S.C.A.L.E.</div>
        <div className="text-xs text-black/60 tracking-wider">
          INITIALIZING ORBITAL TELEMETRY & 3D CANVASES...
        </div>
      </div>
    </main>
  )
});

export default function Home() {
  return <MissionControl />;
}
