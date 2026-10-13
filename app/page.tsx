"use client";

import dynamic from "next/dynamic";

const MissionControl = dynamic(() => import("@/components/MissionControl"), {
  ssr: false,
  loading: () => (
    <main className="mission-shell flex items-center justify-center min-h-screen bg-[#010204]">
      <div className="text-center font-mono text-[#edfafa] p-6">
        <div className="text-3xl font-bold tracking-widest mb-3 text-cyan">PROJECT S.C.A.L.E.</div>
        <div className="text-xs text-cyan/60 tracking-wider">
          INITIALIZING ORBITAL TELEMETRY & 3D CANVASES...
        </div>
      </div>
    </main>
  )
});

export default function Home() {
  return <MissionControl />;
}
