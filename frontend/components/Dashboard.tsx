'use client'

import { useWebSocket } from '@/hooks/useWebSocket'
import SimulationCanvas from './SimulationCanvas'
import ErrorChart from './ErrorChart'
import ControlPanel from './ControlPanel'

export default function Dashboard() {
  const { robotState, history, connected, gains, sendGains } = useWebSocket()

  const e1 = robotState?.e1 ?? 0
  const e2 = robotState?.e2 ?? 0
  const eMag = Math.sqrt(e1 * e1 + e2 * e2)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0f]">

      {/* ── Top status bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 h-10
                      bg-black/60 backdrop-blur border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400">
            ROBOT CONTROL SYSTEM
          </span>
          <span className="text-[10px] font-mono text-slate-600">2-DOF · Computed Torque</span>
        </div>

        <div className="flex items-center gap-5">
          {robotState && (
            <>
              <Stat label="t" value={`${robotState.t.toFixed(2)} s`} />
              <Stat label="|e|" value={eMag.toFixed(4)} color={eMag > 0.1 ? '#f97316' : '#22d3ee'} />
            </>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
              connected ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-500'
            }`} />
            <span className="text-[10px] font-mono text-slate-500">
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Left panel: 3D simulation (60%) ─────────────────────────────────── */}
      <div className="relative w-[60%] h-full border-r border-slate-800/50 pt-10">
        <SimulationCanvas
          q1={robotState?.q1 ?? 0}
          q2={robotState?.q2 ?? 0}
          qd1={robotState?.qd1 ?? 0}
          qd2={robotState?.qd2 ?? 0}
        />

        {/* Overlay readouts */}
        <div className="absolute bottom-5 left-5 space-y-1 font-mono text-xs pointer-events-none">
          <ReadOut label="q₁" value={(robotState?.q1 ?? 0).toFixed(4)} unit="rad" />
          <ReadOut label="q₂" value={(robotState?.q2 ?? 0).toFixed(4)} unit="rad" />
          <ReadOut label="q_d" value={(robotState?.qd1 ?? 0).toFixed(4)} unit="rad" color="text-emerald-400" />
        </div>

        <div className="absolute top-12 left-4 text-[10px] font-mono text-slate-700 tracking-widest">
          3D SIMULATION
        </div>
      </div>

      {/* ── Right panel: chart + controls (40%) ─────────────────────────────── */}
      <div className="flex flex-col w-[40%] h-full pt-10 bg-[#0d1117]">

        {/* Error chart */}
        <div className="flex-1 min-h-0 px-4 pt-4 pb-2">
          <ErrorChart history={history} />
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-slate-800" />

        {/* Control sliders */}
        <div className="px-5 py-5">
          <ControlPanel gains={gains} onGainsChange={sendGains} />
        </div>

        {/* Numeric gain readouts */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <GainCard label="α Gain" value={gains.alpha} color="#22d3ee" />
          <GainCard label="Kᵣ Gain" value={gains.Kr}    color="#f97316" />
        </div>
      </div>
    </div>
  )
}

/* ── Small reusable sub-components ─────────────────────────────────────────── */

function Stat({ label, value, color = '#94a3b8' }: { label: string; value: string; color?: string }) {
  return (
    <span className="text-[10px] font-mono">
      <span className="text-slate-600">{label} </span>
      <span style={{ color }}>{value}</span>
    </span>
  )
}

function ReadOut({
  label, value, unit, color = 'text-cyan-400',
}: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="text-slate-600">
      {label} = <span className={color}>{value}</span>
      <span className="text-slate-700 ml-1">{unit}</span>
    </div>
  )
}

function GainCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-black/30 px-3 py-2">
      <div className="text-[10px] font-mono text-slate-600 mb-1">{label}</div>
      <div className="text-lg font-mono font-bold tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </div>
    </div>
  )
}
