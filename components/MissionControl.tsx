"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Scene from "@/components/Scene";
import { DebrisStatus, useMissionStore } from "@/lib/store";

const statusTone: Record<DebrisStatus, string> = {
  Uncaptured: "text-crimson border-crimson/40 bg-crimson/10",
  Intercepting: "text-amber border-amber/40 bg-amber/10",
  Secured: "text-cyan border-cyan/40 bg-cyan/10"
};

function formatMoney(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

function Metric({ label, value, tone = "cyan" }: { label: string; value: string; tone?: "cyan" | "amber" }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={tone === "amber" ? "metric-value text-amber" : "metric-value text-cyan"}>{value}</span>
    </div>
  );
}

export default function MissionControl() {
  const {
    debris,
    drones,
    selectedDebrisId,
    recoveredMass,
    recoveredValue,
    missionStartedAt,
    selectDebris,
    deploySelected
  } = useMissionStore();
  const [elapsed, setElapsed] = useState(0);
  const [manifestCollapsed, setManifestCollapsed] = useState(false);
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);
  const selected = debris.find((item) => item.id === selectedDebrisId) ?? debris[0];
  const availableDrone = drones.find((drone) => drone.status === "Standby");
  const securedCount = debris.filter((item) => item.status === "Secured").length;
  const riskMitigated = Math.round((securedCount / debris.length) * 100);
  const zoomScene = (direction: "in" | "out") => {
    window.dispatchEvent(new CustomEvent("scale:zoom", { detail: direction }));
  };

  useEffect(() => {
    const interval = window.setInterval(() => setElapsed(Date.now() - missionStartedAt), 1000);
    return () => window.clearInterval(interval);
  }, [missionStartedAt]);

  const timecode = useMemo(() => {
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `T+${hours}:${minutes}:${seconds}`;
  }, [elapsed]);

  return (
    <main className="mission-shell">
      {/* THESIS: This is an orbital command deck, not a generic analytics dashboard.
          OWN-WORLD: Void-black instrumentation, cyan swarm signals, amber mission actions, crimson threats.
          STORY: Viewers see the swarm, select a target, deploy a drone, and watch recovery become impact.
          FIRST VIEWPORT: Earth and live trajectories own the center; manifest and telemetry rails frame it.
          FORM: Operate-mode command console with a persistent impact ticker and direct deploy action. */}
      <div className="scene-layer">
        <Scene />
        <div className="scene-vignette" />
      </div>

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">PROJECT <span>S.C.A.L.E.</span></div>
            <div className="brand-subtitle">SWARM CAPTURE // AUTONOMOUS LEO EXTRACTION</div>
          </div>
        </div>
        <div className="mission-clock">{timecode}</div>
        <div className="risk-readout">
          <span className="metric-label">COLLISION RISK MITIGATED</span>
          <strong>{riskMitigated}%</strong>
          <span className="risk-bar"><span style={{ width: `${Math.max(4, riskMitigated)}%` }} /></span>
        </div>
      </header>

      <section className={`hud-grid ${manifestCollapsed ? "left-collapsed" : ""} ${telemetryCollapsed ? "right-collapsed" : ""}`}>
        <aside className={`panel manifest-panel ${manifestCollapsed ? "is-collapsed" : ""}`}>
          <div className="panel-heading">
            <div className="panel-heading-copy">
              <span className="panel-kicker">01 / TARGET MANIFEST</span>
              <h1>Orbital debris</h1>
            </div>
            <div className="panel-heading-actions">
              <span className="count-badge">{debris.length.toString().padStart(2, "0")}</span>
              <button
                className="rail-toggle"
                aria-label={manifestCollapsed ? "Expand target manifest" : "Collapse target manifest"}
                onClick={() => setManifestCollapsed((collapsed) => !collapsed)}
              >
                {manifestCollapsed ? "›" : "‹"}
              </button>
            </div>
          </div>
          <div className="manifest-list panel-body">
            {debris.map((item) => (
              <button
                key={item.id}
                className={`manifest-row ${item.id === selectedDebrisId ? "is-selected" : ""}`}
                onClick={() => selectDebris(item.id)}
              >
                <span className="row-index">{item.id}</span>
                <span className="row-copy">
                  <strong>{item.material}</strong>
                  <small>{item.mass} kg // {formatMoney(item.value)}</small>
                </span>
                <span className={`status-chip ${statusTone[item.status]}`}>{item.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="center-console">
          <div className="scene-label">
            <span className="live-dot" /> LIVE ORBITAL FEED
          </div>
          <div className="orbit-readout">
            <span>LEO ALTITUDE</span>
            <strong>408.2 KM</strong>
          </div>
          <div className="scene-controls" aria-label="Orbital camera controls">
            <button onClick={() => zoomScene("in")} aria-label="Zoom in">+</button>
            <button onClick={() => zoomScene("out")} aria-label="Zoom out">−</button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              className="target-focus"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <span className="panel-kicker">SELECTED TARGET</span>
              <div className="focus-title">
                <h2>{selected.id}</h2>
                <span className={`status-chip ${statusTone[selected.status]}`}>{selected.status}</span>
              </div>
              <div className="focus-meta">
                <span><b>{selected.mass} kg</b> mass</span>
                <span><b>{formatMoney(selected.value)}</b> repurpose value</span>
              </div>
              <button
                className="deploy-button"
                disabled={!availableDrone || selected.status !== "Uncaptured"}
                onClick={deploySelected}
              >
                {selected.status === "Intercepting" ? "INTERCEPT IN PROGRESS" : selected.status === "Secured" ? "TARGET SECURED" : availableDrone ? `DEPLOY ${availableDrone.id}` : "NO DRONE AVAILABLE"}
                <span>↗</span>
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className={`panel telemetry-panel ${telemetryCollapsed ? "is-collapsed" : ""}`}>
          <div className="panel-heading">
            <div className="panel-heading-copy">
              <span className="panel-kicker">02 / SWARM TELEMETRY</span>
              <h1>Active units</h1>
            </div>
            <div className="panel-heading-actions">
              <span className="online-count"><span className="live-dot" /> {drones.length} ONLINE</span>
              <button
                className="rail-toggle"
                aria-label={telemetryCollapsed ? "Expand swarm telemetry" : "Collapse swarm telemetry"}
                onClick={() => setTelemetryCollapsed((collapsed) => !collapsed)}
              >
                {telemetryCollapsed ? "‹" : "›"}
              </button>
            </div>
          </div>
          <div className="drone-list panel-body">
            {drones.map((drone) => (
              <div className="drone-row" key={drone.id}>
                <div className="drone-heading">
                  <span className="drone-id"><span className="drone-signal" /> {drone.id}</span>
                  <span className={drone.status === "Standby" ? "text-cyan" : "text-amber"}>{drone.status}</span>
                </div>
                <div className="drone-data">
                  <span>FUEL <b>{drone.fuel}%</b></span>
                  <span>PAYLOAD <b>{drone.payload} kg</b></span>
                </div>
                <div className="fuel-track"><span style={{ width: `${drone.fuel}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="telemetry-footer panel-body">
            <span>SWARM READINESS</span>
            <strong>{Math.round(drones.reduce((sum, drone) => sum + drone.fuel, 0) / drones.length)}%</strong>
          </div>
        </aside>
      </section>

      <footer className="impact-ticker">
        <div className="ticker-label"><span className="live-dot" /> IMPACT TICKER</div>
        <Metric label="TOTAL MASS RECOVERED" value={`${recoveredMass.toLocaleString()} KG`} />
        <Metric label="EST. REPURPOSING VALUE" value={formatMoney(recoveredValue)} tone="amber" />
        <div className="ticker-event">SYSTEM READY <span>///</span> AWAITING NEXT CAPTURE WINDOW</div>
      </footer>
    </main>
  );
}
