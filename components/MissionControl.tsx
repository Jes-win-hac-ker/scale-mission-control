"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import Scene from "@/components/Scene";
import {
  DebrisStatus,
  Drone,
  DroneStatus,
  distance,
  formatLogValue,
  useMissionStore
} from "@/lib/store";
import { calculateFuelBurn } from "@/lib/algorithms";
import {
  getBerthWorldPosition,
  getDebrisOrbitalPosition,
  getDebrisSpatialCoordinates,
  getDifferentialVectorState,
  getDroneWorldPosition,
  getStationOrbitalPosition
} from "@/lib/orbital";

const debrisStatusTone: Record<DebrisStatus, string> = {
  available: "text-crimson border-crimson/50 bg-crimson/10",
  targeted: "text-amber border-amber/50 bg-amber/10",
  captured: "text-emerald-400 border-emerald-400/50 bg-emerald-400/10",
  recovered: "text-cyan border-cyan/40 bg-cyan/10"
};

const droneStatusTone: Record<DroneStatus, string> = {
  idle: "text-cyan border-cyan/50 bg-cyan/10",
  assigned: "text-blue-400 border-blue-400/50 bg-blue-400/10",
  intercepting: "text-blue-400 border-blue-400/50 bg-blue-400/10",
  capturing: "text-white border-white/60 bg-white/20 animate-pulse",
  returning: "text-emerald-400 border-emerald-400/50 bg-emerald-400/10",
  recovered: "text-emerald-400 border-emerald-400/50 bg-emerald-400/10",
  error: "text-crimson border-crimson/50 bg-crimson/10"
};

function getSubStatusLabel(drone: Drone): string {
  if (drone.subStatus) {
    switch (drone.subStatus) {
      case "docked":
        return "DOCKED";
      case "undocking":
        return "UNDOCK";
      case "accelerating":
        return "ACCEL";
      case "coasting":
        return "COAST";
      case "braking":
        return "BRAKE";
      case "detumbling":
        return "SYNCING";
      case "clamping":
        return "CLAMP";
      case "towing":
        return "TOWING";
      case "docking":
        return "DOCKING";
    }
  }
  return drone.status.toUpperCase();
}


function formatMoney(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

function Metric({
  label,
  value,
  tone = "cyan"
}: {
  label: string;
  value: string;
  tone?: "cyan" | "amber" | "green";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber"
      : tone === "green"
      ? "text-emerald-400"
      : "text-cyan";

  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function MissionControl() {
  const {
    debris,
    drones,
    depot,
    selectedDebrisId,
    focusedEntity,
    focusEntity,
    totalRecoveredMass,
    totalRecoveredValue,
    stockpile,
    swarmStrategy,
    setSwarmStrategy,
    missionStartedAt,
    logs,
    warning,
    selectDebris,
    clearWarning,
    goFetch,
    autoDispatch,
    resetSimulation
  } = useMissionStore();

  const [mounted, setMounted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isFocusCardMinimized, setIsFocusCardMinimized] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = debris.find((item) => item.id === selectedDebrisId) ?? debris[0];

  const availableDebrisCount = debris.filter((item) => item.status === "available").length;
  const idleDroneCount = drones.filter((drone) => drone.status === "idle").length;
  const securedCount = debris.filter((item) => item.status === "recovered").length;
  const riskMitigated = Math.round((securedCount / debris.length) * 100);

  // Auto-scroll command log to latest entry
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Mission timer clock
  useEffect(() => {
    const interval = window.setInterval(
      () => setElapsed(Date.now() - missionStartedAt),
      1000
    );
    return () => window.clearInterval(interval);
  }, [missionStartedAt]);

  const timecode = useMemo(() => {
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `T+${hours}:${minutes}:${seconds}`;
  }, [elapsed]);

  const zoomScene = (direction: "in" | "out") => {
    window.dispatchEvent(new CustomEvent("scale:zoom", { detail: direction }));
  };

  // Keyboard Quick-Launch Hotkeys: Space to FETCH selected, A to AUTO DISPATCH
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        if (selected && selected.status === "available" && idleDroneCount > 0) {
          e.preventDefault();
          goFetch(selected.id);
        }
      } else if (e.key === "a" || e.key === "A") {
        if (availableDebrisCount > 0 && idleDroneCount > 0) {
          e.preventDefault();
          autoDispatch();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, idleDroneCount, availableDebrisCount, goFetch, autoDispatch]);

  const [liveSec, setLiveSec] = useState(() => (Date.now() - missionStartedAt) / 1000);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveSec((Date.now() - missionStartedAt) / 1000);
    }, 150);
    return () => window.clearInterval(timer);
  }, [missionStartedAt]);

  const liveDepotPos = useMemo(() => {
    return getStationOrbitalPosition(liveSec, depot);
  }, [liveSec, depot]);

  // Tsiolkovsky mass-dependent fuel calculation based on real-time orbital positions
  const estimatedRecoveryFuel = useMemo(() => {
    if (!selected) return 0;
    const currentDebrisPos = getDebrisOrbitalPosition(selected, liveSec);
    const distToDepot = distance(currentDebrisPos, liveDepotPos);
    const idleDrones = drones.filter((d) => d.status === "idle");
    if (idleDrones.length === 0) {
      return calculateFuelBurn(1.5, distToDepot, selected.mass);
    }
    const minDroneDist = Math.min(
      ...idleDrones.map((d) => distance(getBerthWorldPosition(d.berthId, liveSec), currentDebrisPos))
    );
    return calculateFuelBurn(minDroneDist, distToDepot, selected.mass);
  }, [selected, liveDepotPos, drones, liveSec]);

  const assignedDrone = useMemo(() => {
    return drones.find(
      (d) => d.targetId === selected?.id || (selected?.assignedDroneId && d.id === selected?.assignedDroneId)
    );
  }, [drones, selected]);

  const targetCoords = useMemo(() => {
    if (!selected) return null;
    return getDebrisSpatialCoordinates(selected, liveSec);
  }, [selected, liveSec]);

  const diffState = useMemo(() => {
    if (!selected || !targetCoords) return null;
    let observerPos = liveDepotPos;
    if (assignedDrone) {
      observerPos = getDroneWorldPosition(assignedDrone, liveSec, liveSec, debris);
    }
    return getDifferentialVectorState(targetCoords.scenePos, observerPos);
  }, [selected, targetCoords, assignedDrone, liveDepotPos, liveSec, debris]);

  if (!mounted) {
    return null;
  }

  return (
    <main className="mission-shell">
      {/* 3D Visual Layer */}
      <div className="scene-layer">
        <Scene />
        <div className="scene-vignette" />
      </div>

      {/* Top Navigation & Status Bar */}
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">
              PROJECT <span>S.C.A.L.E.</span>
            </div>
            <div className="brand-subtitle">
              GO-FETCH PROTOCOL // AUTONOMOUS SWARM CAPTURE & EXTRACTION
            </div>
          </div>
        </div>

        <div className="mission-clock" suppressHydrationWarning>{timecode}</div>

        <div className="risk-readout">
          <span className="metric-label">COLLISION RISK MITIGATED</span>
          <strong>{riskMitigated}%</strong>
          <span className="risk-bar">
            <span style={{ width: `${Math.max(4, riskMitigated)}%` }} />
          </span>
        </div>
      </header>

      {/* Main 3-Column HUD */}
      <section className="hud-grid">
        {/* LEFT RAIL: Debris Manifest & Depot Status */}
        <aside className="panel manifest-panel">
          <div className="panel-heading">
            <div className="panel-heading-copy">
              <span className="panel-kicker">ORBITAL TARGETS</span>
              <h1>DEBRIS MANIFEST</h1>
            </div>
            <span className="count-badge">
              {availableDebrisCount}/{debris.length}
            </span>
          </div>

          <div className="manifest-list">
            {debris.map((item) => {
              const isSelected = item.id === selected?.id;
              const assignedTo = drones.find((d) => d.targetId === item.id);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={`manifest-row ${isSelected ? "is-selected" : ""}`}
                  onClick={() => selectDebris(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      selectDebris(item.id);
                    }
                  }}
                >
                  <span className="row-index">{item.id}</span>
                  <div className="row-copy">
                    <strong>{item.material ?? "Orbital Debris"}</strong>
                    <small>
                      {item.mass} kg · {formatLogValue(item.value)}
                    </small>
                  </div>
                  {item.status === "available" ? (
                    <button
                      type="button"
                      className="row-quick-fetch-btn"
                      title={`Dispatch drone to capture ${item.id}`}
                      disabled={idleDroneCount === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDebris(item.id);
                        goFetch(item.id);
                      }}
                    >
                      ▶ FETCH
                    </button>
                  ) : (
                    <span
                      className={`status-chip ${debrisStatusTone[item.status]}`}
                      title={assignedTo ? `Assigned to ${assignedTo.id}` : item.status}
                    >
                      {assignedTo ? assignedTo.id : item.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recovery Depot Status */}
          <div
            className={`depot-footer cursor-pointer transition-all ${
              focusedEntity.type === "depot" ? "border-cyan bg-cyan/10" : ""
            }`}
            onClick={() => focusEntity("depot", "DEPOT-01")}
            title="Click to focus camera on DEPOT-01"
          >
            <div className="depot-header">
              <span className="depot-dot" />
              <strong>{depot.id} (RECOVERY DEPOT)</strong>
              <span className="depot-status">ONLINE</span>
            </div>
            <div className="depot-data">
              <span>POS: [{liveDepotPos[0] > 0 ? "+" : ""}{liveDepotPos[0].toFixed(2)}, {liveDepotPos[1] > 0 ? "+" : ""}{liveDepotPos[1].toFixed(2)}, {liveDepotPos[2] > 0 ? "+" : ""}{liveDepotPos[2].toFixed(2)}]</span>
              <span>
                SECURED: <b>{securedCount} OBJECTS</b>
              </span>
            </div>
          </div>

          {/* DEPOT-01 ISRU Smelter & Material Stockpile */}
          <div className="stockpile-card">
            <div className="stockpile-header">
              <span className="text-[9px] tracking-wider text-cyan font-mono font-semibold">DEPOT-01 ISRU REFINERY</span>
              <span className="text-[8px] text-emerald-400 font-mono font-bold tracking-widest">SMELTER ACTIVE</span>
            </div>
            <div className="stockpile-grid">
              <div className="stockpile-item">
                <span className="tag-dot" style={{ background: "#38bdf8" }} />
                <span className="text-slate-400">Ti ALLOY:</span>
                <strong className="text-sky-300 font-mono">{stockpile.titanium} kg</strong>
              </div>
              <div className="stockpile-item">
                <span className="tag-dot" style={{ background: "#fbbf24" }} />
                <span className="text-slate-400">PRECIOUS:</span>
                <strong className="text-amber-300 font-mono">{stockpile.preciousMetals} kg</strong>
              </div>
              <div className="stockpile-item">
                <span className="tag-dot" style={{ background: "#c084fc" }} />
                <span className="text-slate-400">SILICON:</span>
                <strong className="text-purple-300 font-mono">{stockpile.semiconductors} kg</strong>
              </div>
              <div className="stockpile-item">
                <span className="tag-dot" style={{ background: "#22c55e" }} />
                <span className="text-slate-400">RECYCLED:</span>
                <strong className="text-emerald-400 font-mono">{stockpile.propellant} kg</strong>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER CONSOLE: Viewport Controls, Target Card & GO-FETCH Dispatch */}
        <div className="center-console">
          <div className="console-top-row">
            <div className="scene-label">
              <span className="live-dot" /> LIVE ORBITAL FEED //{" "}
              {focusedEntity.type === "earth" ? (
                "LEO 408.2 KM // ORBIT OVERVIEW"
              ) : (
                <span className="text-cyan font-bold">
                  FOCUS: {focusedEntity.type.toUpperCase()}{" "}
                  {focusedEntity.id ? `[${focusedEntity.id}]` : ""}
                </span>
              )}
            </div>
            <div className="scene-controls" aria-label="Orbital camera controls">
              <button
                onClick={() => focusEntity("earth")}
                title="Reset Camera to Orbit Overview"
                className="reset-btn"
                aria-label="Reset Camera to Earth Orbit"
              >
                ⊙
              </button>
              <button
                onClick={resetSimulation}
                title="Reset Simulation"
                className="reset-btn"
                aria-label="Reset simulation"
              >
                ↺
              </button>
              <button onClick={() => zoomScene("in")} aria-label="Zoom in">
                +
              </button>
              <button onClick={() => zoomScene("out")} aria-label="Zoom out">
                −
              </button>
            </div>
          </div>

          {/* Dynamic Warning Banner */}
          <AnimatePresence>
            {warning && (
              <motion.div
                className="warning-banner"
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95 }}
              >
                <div className="warning-content">
                  <span className="warning-icon">⚠</span>
                  <span className="warning-text">{warning}</span>
                </div>
                <button
                  onClick={clearWarning}
                  className="warning-close"
                  aria-label="Dismiss warning"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Target Focus & GO-FETCH Actions OR Station Hub Telemetry */}
          <AnimatePresence mode="wait">
            {focusedEntity.type === "depot" ? (
              <motion.div
                key={isFocusCardMinimized ? "depot-island" : "depot-focus"}
                className={isFocusCardMinimized ? "target-island-capsule" : "target-focus"}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {isFocusCardMinimized ? (
                  <div className="island-inner">
                    <span className="island-pulse is-emerald" />
                    <div className="island-info">
                      <div className="island-title">
                        <strong>PROJECT S.C.A.L.E. DEPOT-01</strong>
                        <span className="island-pill-badge is-emerald">ISRU ACTIVE</span>
                      </div>
                      <div className="island-meta">
                        <span>{totalRecoveredMass} kg STORED</span>
                        <span className="island-meta-sep">·</span>
                        <span>{formatMoney(totalRecoveredValue)} YIELD</span>
                      </div>
                    </div>

                    <div className="island-actions">
                      <button
                        type="button"
                        className="island-btn cyan"
                        disabled={availableDebrisCount === 0 || idleDroneCount === 0}
                        onClick={autoDispatch}
                        title={`Deploy fleet using ${swarmStrategy.toUpperCase()} matching (Hotkey: A)`}
                      >
                        ⚡ AUTO ({idleDroneCount})
                      </button>
                      <button
                        type="button"
                        className="island-icon-btn"
                        onClick={() => setIsFocusCardMinimized(false)}
                        title="Expand station diagnostics"
                        aria-label="Expand station diagnostics"
                      >
                        ↗
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="focus-header">
                      <span className="panel-kicker text-cyan font-bold tracking-widest">
                        ORBITAL RECOVERY HUB // DEPOT-01
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="status-chip text-emerald-400 border-emerald-400/50 bg-emerald-400/10">
                          ISRU REFINERY ONLINE · 5 MOORING BERTHS
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsFocusCardMinimized(true)}
                          className="focus-toggle-btn"
                          title="Minimize card to unblock view"
                          aria-label="Minimize card"
                        >
                          −
                        </button>
                      </div>
                    </div>
                    <div className="focus-title">
                      <h2>PROJECT S.C.A.L.E. RECOVERY DEPOT</h2>
                      <span className="target-mat">CENTRAL DOCKING STATION & INDUCTION SMELTING COMPLEX</span>
                    </div>

                    <div className="focus-meta-grid">
                      <div className="meta-cell">
                        <span className="cell-label">ORBITAL REGIME</span>
                        <strong>420.0 km LEO (51.6°)</strong>
                      </div>
                      <div className="meta-cell">
                        <span className="cell-label">TOTAL STORED MASS</span>
                        <strong className="text-emerald-400">{totalRecoveredMass} kg</strong>
                      </div>
                      <div className="meta-cell">
                        <span className="cell-label">EXTRACTED VALUE</span>
                        <strong className="text-amber">{formatMoney(totalRecoveredValue)}</strong>
                      </div>
                      <div className="meta-cell">
                        <span className="cell-label">CENTRIFUGAL SPIN</span>
                        <strong className="text-cyan">0.22 rad/s (SYNCED)</strong>
                      </div>
                      <div className="meta-cell">
                        <span className="cell-label">BERTH OCCUPANCY</span>
                        <strong>
                          {drones.filter((d) => d.status === "idle" || d.subStatus === "docked").length} / 5 MOORED
                        </strong>
                      </div>
                      <div className="meta-cell">
                        <span className="cell-label">INDUCTION REFINERY</span>
                        <strong className="text-emerald-400">ISRU REACTOR READY</strong>
                      </div>
                    </div>

                    {/* 5-Bay Mooring & Gantry Allocation Ledger */}
                    <div className="assay-card">
                      <div className="assay-title">
                        <span>MOORING BERTH & GANTRY ALLOCATION</span>
                        <span className="text-cyan font-mono">DOCKING CRADLES</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mt-2 font-mono text-xs">
                        {(["B1", "B2", "B3", "B4", "STAGING"] as const).map((bId) => {
                          const d = drones.find((drone) => drone.berthId === bId);
                          const isDocked = d && (d.status === "idle" || d.subStatus === "docked");
                          return (
                            <div
                              key={bId}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isDocked
                                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                                  : "bg-slate-900/60 border-cyan/30 text-cyan hover:border-cyan"
                              }`}
                              onClick={() => {
                                if (d) focusEntity("drone", d.id);
                              }}
                              title={d ? `Focus camera on ${d.id}` : "Empty cradle"}
                            >
                              <div className="text-[10px] text-slate-400">{bId}</div>
                              <div className="font-bold">{d ? d.id : "EMPTY"}</div>
                              <div className="text-[9px] text-slate-400">
                                {d ? (d.subStatus ? d.subStatus.toUpperCase() : d.status.toUpperCase()) : "STANDBY"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-button-group">
                      <button
                        className="deploy-button go-fetch-btn"
                        onClick={() => focusEntity("earth")}
                      >
                        <span>OVERVIEW PERSPECTIVE</span>
                        <span className="arrow-icon">⊙</span>
                      </button>

                      <button
                        className="auto-dispatch-btn"
                        disabled={availableDebrisCount === 0 || idleDroneCount === 0}
                        onClick={autoDispatch}
                        title={`Deploy fleet using ${swarmStrategy.toUpperCase()} matching`}
                      >
                        <span>AUTO DISPATCH FLEET</span>
                        <small>({idleDroneCount} READY · {swarmStrategy.toUpperCase()})</small>
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : selected ? (
              <motion.div
                key={isFocusCardMinimized ? `selected-island-${selected.id}` : selected.id}
                className={isFocusCardMinimized ? "target-island-capsule" : "target-focus"}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {isFocusCardMinimized ? (
                  <div className="island-inner">
                    <span className={`island-pulse ${selected.status === "available" ? "is-amber" : "is-cyan"}`} />
                    <div className="island-info">
                      <div className="island-title">
                        <strong>{selected.id}</strong>
                        <span className="island-pill-badge">{selected.material}</span>
                        {selected.threatIndex !== undefined && (
                          <span
                            className={`island-threat-pill ${
                              selected.threatIndex > 50 ? "high" : "low"
                            }`}
                          >
                            THREAT {selected.threatIndex}/100
                          </span>
                        )}
                      </div>
                      <div className="island-meta">
                        <span>{selected.mass} kg</span>
                        <span className="island-meta-sep">·</span>
                        <span>{formatMoney(selected.value)}</span>
                        {diffState && (
                          <>
                            <span className="island-meta-sep">·</span>
                            <span className="text-cyan font-mono text-[9px]">
                              DEV: {Math.round(diffState.rangeKm).toLocaleString()} km
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="island-actions">
                      {selected.status === "available" ? (
                        <button
                          type="button"
                          className="island-btn amber"
                          disabled={idleDroneCount === 0}
                          onClick={() => goFetch(selected.id)}
                          title={`Launch closest drone to intercept ${selected.id} (Hotkey: SPACE)`}
                        >
                          GO FETCH ▶
                        </button>
                      ) : (
                        <span className={`island-status-pill ${debrisStatusTone[selected.status]}`}>
                          {selected.status.toUpperCase()}
                        </span>
                      )}
                      <button
                        type="button"
                        className="island-btn cyan"
                        disabled={availableDebrisCount === 0 || idleDroneCount === 0}
                        onClick={autoDispatch}
                        title={`Deploy fleet using ${swarmStrategy.toUpperCase()} matching (Hotkey: A)`}
                      >
                        ⚡ AUTO ({idleDroneCount})
                      </button>
                      <button
                        type="button"
                        className="island-icon-btn"
                        onClick={() => setIsFocusCardMinimized(false)}
                        title="Expand telemetry details"
                        aria-label="Expand telemetry details"
                      >
                        ↗
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="focus-header">
                      <span className="panel-kicker">SELECTED TARGET</span>
                      <div className="flex items-center gap-2">
                        <span className={`status-chip ${debrisStatusTone[selected.status]}`}>
                          {selected.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsFocusCardMinimized(true)}
                          className="focus-toggle-btn"
                          title="Minimize card to unblock view"
                          aria-label="Minimize card"
                        >
                          −
                        </button>
                      </div>
                    </div>
                    <div className="focus-title">
                  <h2>{selected.id}</h2>
                  <span className="target-mat">{selected.material}</span>
                </div>

                <div className="focus-meta-grid">
                  <div className="meta-cell">
                    <span className="cell-label">MASS</span>
                    <strong>{selected.mass} kg</strong>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">REPURPOSE VALUE</span>
                    <strong className="text-amber">{formatMoney(selected.value)}</strong>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">Δv BUDGET (TRANSFER)</span>
                    <strong className="text-cyan">{(selected.deltaVBudget ?? 1850).toLocaleString()} m/s</strong>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">KESSLER THREAT INDEX</span>
                    <strong className={(selected.threatIndex ?? 30) > 50 ? "text-amber" : "text-emerald-400"}>
                      {selected.threatIndex ?? 35} / 100
                    </strong>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">EST. PROP. BURN</span>
                    <strong>{estimatedRecoveryFuel} kg</strong>
                  </div>
                  <div className="meta-cell">
                    <span className="cell-label">ASSIGNED UNIT</span>
                    <strong className="text-cyan">
                      {assignedDrone ? assignedDrone.id : "--"}
                    </strong>
                  </div>
                </div>

                {/* Differential Astrodynamics & Relative Vector Telemetry ("Knowing Where It Isn't") */}
                {targetCoords && diffState && (
                  <div className="differential-guidance-card">
                    <div className="diff-header">
                      <div className="flex items-center gap-2">
                        <span className="diff-pulse-dot" />
                        <span className="text-[10px] font-mono tracking-wider text-cyan font-bold">
                          DIFFERENTIAL GUIDANCE // PN RELATIVE VECTOR ESTIMATOR
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-amber tracking-wider font-semibold">
                        {selected.status === "available"
                          ? "PASSIVE INERTIAL TRACKING"
                          : selected.status === "targeted"
                          ? "CORRECTION BURN IN PROGRESS"
                          : "ZERO-DEVIATION LOCK"}
                      </span>
                    </div>

                    <div className="diff-vector-grid">
                      <div className="diff-cell">
                        <span className="cell-label">WHERE IT ISN'T (TARGET POS)</span>
                        <strong className="text-cyan font-mono text-[11px]">
                          X:{targetCoords.kmPos[0] > 0 ? "+" : ""}{Math.round(targetCoords.kmPos[0]).toLocaleString()} km · 
                          Y:{targetCoords.kmPos[1] > 0 ? "+" : ""}{Math.round(targetCoords.kmPos[1]).toLocaleString()} km · 
                          Z:{targetCoords.kmPos[2] > 0 ? "+" : ""}{Math.round(targetCoords.kmPos[2]).toLocaleString()} km
                        </strong>
                        <span className="diff-subtext">
                          ALT: {Math.round(targetCoords.altitudeKm).toLocaleString()} km LEO · R: {Math.round(targetCoords.orbitalRadiusKm).toLocaleString()} km
                        </span>
                      </div>

                      <div className="diff-cell">
                        <span className="cell-label">WHERE IT IS (OBSERVER POS: {assignedDrone ? assignedDrone.id : "DEPOT-01"})</span>
                        <strong className="text-emerald-400 font-mono text-[11px]">
                          X:{diffState.observerKm[0] > 0 ? "+" : ""}{Math.round(diffState.observerKm[0]).toLocaleString()} km · 
                          Y:{diffState.observerKm[1] > 0 ? "+" : ""}{Math.round(diffState.observerKm[1]).toLocaleString()} km · 
                          Z:{diffState.observerKm[2] > 0 ? "+" : ""}{Math.round(diffState.observerKm[2]).toLocaleString()} km
                        </strong>
                        <span className="diff-subtext">
                          REFERENCE: {assignedDrone ? `${assignedDrone.id} INERTIAL` : "ORBITAL HUB DEPOT-01"}
                        </span>
                      </div>

                      <div className="diff-cell full-width">
                        <div className="flex items-center justify-between">
                          <span className="cell-label">DEVIATION VECTOR (ΔR = TARGET - OBSERVER)</span>
                          <span className="text-amber font-mono text-[11px] font-bold">
                            CLOSING RANGE: {Math.round(diffState.rangeKm).toLocaleString()} km
                          </span>
                        </div>
                        <div className="diff-deviation-row">
                          <span className="diff-vector-badge">
                            ΔX: {diffState.deviationKm[0] > 0 ? "+" : ""}{Math.round(diffState.deviationKm[0]).toLocaleString()} km
                          </span>
                          <span className="diff-vector-badge">
                            ΔY: {diffState.deviationKm[1] > 0 ? "+" : ""}{Math.round(diffState.deviationKm[1]).toLocaleString()} km
                          </span>
                          <span className="diff-vector-badge">
                            ΔZ: {diffState.deviationKm[2] > 0 ? "+" : ""}{Math.round(diffState.deviationKm[2]).toLocaleString()} km
                          </span>
                          <span className="diff-vector-badge text-cyan">
                            UNIT: [{diffState.normalizedDirection[0].toFixed(2)}, {diffState.normalizedDirection[1].toFixed(2)}, {diffState.normalizedDirection[2].toFixed(2)}]
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Real-time Extraction & Retrieval Pipeline Ribbon */}
                {selected.status !== "available" && (
                  <div className="extraction-pipeline-card">
                    <div className="extraction-header">
                      <span className="text-[10px] font-mono tracking-wider text-cyan font-bold">
                        EXTRACTION & RETRIEVAL PIPELINE
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        {assignedDrone
                          ? `UNIT: ${assignedDrone.id} [${assignedDrone.berthId}] · ${
                              assignedDrone.subStatus
                                ? assignedDrone.subStatus.toUpperCase()
                                : assignedDrone.status.toUpperCase()
                            }`
                          : "SWARM EN ROUTE"}
                      </span>
                    </div>
                    <div className="pipeline-steps">
                      {[
                        {
                          key: "rendezvous",
                          label: "1. RENDEZVOUS",
                          active:
                            selected.status === "targeted" &&
                            (!assignedDrone || assignedDrone.status === "intercepting")
                        },
                        {
                          key: "detumble",
                          label: "2. DETUMBLE & CLAMP",
                          active: assignedDrone?.status === "capturing"
                        },
                        {
                          key: "tow",
                          label: "3. INBOUND TOW",
                          active: assignedDrone?.status === "returning"
                        },
                        {
                          key: "smelt",
                          label: "4. ISRU SMELT & MOOR",
                          active:
                            selected.status === "recovered" ||
                            assignedDrone?.subStatus === "ingesting" ||
                            assignedDrone?.subStatus === "docking"
                        }
                      ].map((step) => {
                        const isPast =
                          (step.key === "rendezvous" &&
                            (assignedDrone?.status === "capturing" ||
                              assignedDrone?.status === "returning" ||
                              selected.status === "recovered")) ||
                          (step.key === "detumble" &&
                            (assignedDrone?.status === "returning" ||
                              selected.status === "recovered")) ||
                          (step.key === "tow" && selected.status === "recovered");
                        return (
                          <div
                            key={step.key}
                            className={`pipeline-step ${
                              step.active
                                ? "is-active text-amber border-amber/60 bg-amber/10"
                                : isPast
                                ? "is-complete text-emerald-400 border-emerald-500/40 bg-emerald-950/20"
                                : "text-slate-500 border-slate-700/40 bg-slate-900/30"
                            }`}
                          >
                            <span className="step-icon">{isPast ? "✓" : step.active ? "▶" : "·"}</span>
                            <span>{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Material Spectroscopy Assay Bar */}
                {selected.assay && (
                  <div className="assay-card">
                    <div className="assay-title">
                      <span>MATERIAL SPECTROSCOPY ASSAY</span>
                      <span className="text-cyan font-mono">REFINERY TARGETS</span>
                    </div>
                    <div className="assay-bar">
                      <div style={{ width: `${selected.assay.titanium}%`, background: "#38bdf8" }} className="assay-segment" title={`Titanium / Structural: ${selected.assay.titanium}%`} />
                      <div style={{ width: `${selected.assay.preciousMetals}%`, background: "#fbbf24" }} className="assay-segment" title={`Precious / Platinum: ${selected.assay.preciousMetals}%`} />
                      <div style={{ width: `${selected.assay.semiconductor}%`, background: "#c084fc" }} className="assay-segment" title={`Silicon / Avionics: ${selected.assay.semiconductor}%`} />
                      <div style={{ width: `${selected.assay.propellant}%`, background: "#22c55e" }} className="assay-segment" title={`Hydrazine Fuel: ${selected.assay.propellant}%`} />
                      <div style={{ width: `${selected.assay.silicates}%`, background: "#94a3b8" }} className="assay-segment" title={`Silicates / Slag: ${selected.assay.silicates}%`} />
                    </div>
                    <div className="assay-tags">
                      <span className="assay-tag"><span className="tag-dot" style={{ background: "#38bdf8" }} /> Ti: {selected.assay.titanium}%</span>
                      <span className="assay-tag"><span className="tag-dot" style={{ background: "#fbbf24" }} /> Pt: {selected.assay.preciousMetals}%</span>
                      <span className="assay-tag"><span className="tag-dot" style={{ background: "#c084fc" }} /> Si: {selected.assay.semiconductor}%</span>
                      <span className="assay-tag"><span className="tag-dot" style={{ background: "#22c55e" }} /> Fuel: {selected.assay.propellant}%</span>
                    </div>
                  </div>
                )}

                {/* Swarm Optimization Strategy Selector */}
                <div className="strategy-selector">
                  <span className="strategy-label">SWARM BRAIN // HUNGARIAN OPTIMIZER:</span>
                  <div className="strategy-buttons">
                    {[
                      { id: "balanced", label: "PARETO" },
                      { id: "max_yield", label: "VALUE" },
                      { id: "kessler_defense", label: "DEFENSE" },
                      { id: "min_delta_v", label: "MIN Δv" }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`strategy-btn ${swarmStrategy === mode.id ? "is-active" : ""}`}
                        onClick={() => setSwarmStrategy(mode.id as any)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="action-button-group">
                  <button
                    className="deploy-button go-fetch-btn"
                    disabled={selected.status !== "available"}
                    onClick={() => goFetch(selected.id)}
                  >
                    <span>
                      {selected.status === "available"
                        ? "GO FETCH"
                        : selected.status === "targeted"
                        ? "INTERCEPT IN PROGRESS"
                        : selected.status === "captured"
                        ? "RETURNING TO DEPOT"
                        : "TARGET RECOVERED"}
                    </span>
                    <span className="arrow-icon">▶</span>
                  </button>

                  <button
                    className="auto-dispatch-btn"
                    disabled={availableDebrisCount === 0 || idleDroneCount === 0}
                    onClick={autoDispatch}
                    title={`Deploy fleet using ${swarmStrategy.toUpperCase()} matching`}
                  >
                    <span>AUTO DISPATCH</span>
                    <small>({idleDroneCount} IDLE · {swarmStrategy.toUpperCase()})</small>
                  </button>
                </div>
              </>
            )}
          </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* RIGHT RAIL: Swarm Telemetry & Command Log Panel */}
        <aside className="panel telemetry-panel">
          {/* Swarm Drones Telemetry */}
          <div className="panel-heading">
            <div className="panel-heading-copy">
              <span className="panel-kicker">TELEMETRY</span>
              <h1>SWARM DRONES</h1>
            </div>
            <span className="online-count">
              {idleDroneCount}/{drones.length} IDLE
            </span>
          </div>

          <div className="drone-list">
            {drones.map((drone) => (
              <div
                key={drone.id}
                className={`drone-row cursor-pointer transition-all ${
                  focusedEntity.type === "drone" && focusedEntity.id === drone.id
                    ? "border-cyan bg-cyan/10"
                    : ""
                }`}
                onClick={() => focusEntity("drone", drone.id)}
                title={`Click to focus camera on ${drone.id}`}
              >
                <div className="drone-heading">
                  <div className="flex items-center">
                    <span
                      className={`drone-signal ${
                        drone.status === "capturing" ? "animate-pulse" : ""
                      }`}
                    />
                    <strong className="drone-id">{drone.id}</strong>
                    <span className="berth-badge font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-800/90 text-cyan border border-cyan/40 ml-2">
                      {drone.berthId === "STAGING" ? "STAGING" : `BERTH ${drone.berthId}`}
                    </span>
                  </div>
                  <span className={`status-chip ${droneStatusTone[drone.status]}`}>
                    {getSubStatusLabel(drone)}
                  </span>
                </div>

                <div className="drone-data">
                  <span>
                    BASE: <b>{drone.status === "idle" || drone.subStatus === "docked" ? `DEPOT-01 (${drone.berthId})` : "IN ORBIT"}</b>
                  </span>
                  <span>
                    TARGET: <b>{drone.targetId ?? "NONE"}</b>
                  </span>
                  <span>
                    PAYLOAD: <b>{drone.payload > 0 ? `${drone.payload} kg` : "0 kg"}</b>
                  </span>
                </div>

                {/* Fuel Gauge */}
                <div className="fuel-gauge">
                  <div className="fuel-labels">
                    <span>FUEL RESERVE</span>
                    <b
                      className={
                        drone.fuel < 20
                          ? "text-crimson"
                          : drone.fuel < 40
                          ? "text-amber"
                          : "text-cyan"
                      }
                    >
                      {drone.fuel}%
                    </b>
                  </div>
                  <div className="fuel-track">
                    <span
                      style={{
                        width: `${drone.fuel}%`,
                        backgroundColor:
                          drone.fuel < 20
                            ? "#FF0033"
                            : drone.fuel < 40
                            ? "#FFBF00"
                            : "#00FFFF"
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* COMMAND LOG PANEL */}
          <div className="command-log-section">
            <div className="log-header">
              <div className="flex items-center gap-2">
                <span className="log-pulse" />
                <span className="log-title">COMMAND LOG</span>
              </div>
              <span className="log-count">{logs.length} EVENTS</span>
            </div>

            <div ref={logContainerRef} className="log-terminal">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`log-entry ${
                    log.tone === "warning"
                      ? "log-tone-warning"
                      : log.tone === "success"
                      ? "log-tone-success"
                      : log.tone === "action"
                      ? "log-tone-action"
                      : "log-tone-info"
                  }`}
                >
                  <span className="log-time">[{log.timestamp}]</span>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* Persistent Impact Ticker */}
      <footer className="impact-ticker">
        <div className="ticker-label">
          <span className="live-dot" /> IMPACT TICKER
        </div>
        <Metric
          label="TOTAL MASS RECOVERED"
          value={`${totalRecoveredMass.toLocaleString()} KG`}
        />
        <Metric
          label="EST. REPURPOSING VALUE"
          value={formatMoney(totalRecoveredValue)}
          tone="amber"
        />
        <div className="ticker-event">
          DEPOT-01 ACTIVE <span>///</span> READY FOR NEXT DISPATCH
        </div>
      </footer>
    </main>
  );
}
