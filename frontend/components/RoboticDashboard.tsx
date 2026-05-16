'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RobotViewer, { RobotType } from './RobotViewer'
import WorkspaceSurface from './WorkspaceSurface'

const ROBOTS: { id: RobotType; name: string; desc: string; dof: string; color: string; border: string }[] = [
  {
    id: '2dof',
    name: '2-DOF Planar',
    desc: 'L₁=1.5 m · L₂=1.1 m',
    dof: '2',
    color: 'text-cyan-400',
    border: 'border-cyan-500/50 bg-cyan-500/10',
  },
  {
    id: '3dof',
    name: '3-DOF Spatial',
    desc: 'L₁=1.2 · L₂=0.85 · L₃=0.55 m',
    dof: '3',
    color: 'text-violet-400',
    border: 'border-violet-500/50 bg-violet-500/10',
  },
  {
    id: 'scara',
    name: 'SCARA',
    desc: 'L₁=0.65 m · L₂=0.48 m · Z-axis',
    dof: '4',
    color: 'text-emerald-400',
    border: 'border-emerald-500/50 bg-emerald-500/10',
  },
  {
    id: 'delta',
    name: 'Delta Parallel',
    desc: 'Rb=0.30 m · La=0.42 m · Lf=0.72 m',
    dof: '3',
    color: 'text-amber-400',
    border: 'border-amber-500/50 bg-amber-500/10',
  },
]

export default function RoboticDashboard() {
  const router = useRouter()
  const [robotType, setRobotType] = useState<RobotType>('2dof')
  const current = ROBOTS.find(r => r.id === robotType)!

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-10 shrink-0
                      bg-black/60 backdrop-blur border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-[10px] font-mono text-slate-600 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            ← HOME
          </button>
          <span className="text-slate-800">|</span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-slate-300">
            ROBOTIC SYSTEMS
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-700 tracking-widest">
          3D KINEMATICS · WORKSPACE ANALYSIS
        </div>
      </div>

      {/* ── Robot selector ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-2.5 shrink-0 border-b border-slate-800/50">
        {ROBOTS.map(r => (
          <button
            key={r.id}
            onClick={() => setRobotType(r.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-mono transition-all duration-200
              ${robotType === r.id
                ? `${r.border} ${r.color} border-opacity-100`
                : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400 bg-transparent'
              }`}
          >
            <span className="text-[8px] font-bold opacity-60">{r.dof}‑DOF</span>
            {r.name}
          </button>
        ))}

        {/* Active robot info */}
        <div className="ml-auto text-[9px] font-mono text-slate-700">
          {current.desc}
        </div>
      </div>

      {/* ── Main panels ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: 3D robot viewer (60%) */}
        <div className="relative w-[60%] h-full border-r border-slate-800/50">
          <RobotViewer key={robotType} robotType={robotType} />

          {/* Legend overlay */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 pointer-events-none">
            <LegendItem color={current.color.replace('text-', '#').replace('-400', '')} label="Active arm" hex />
            <LegendItem color="#00ccff" label="EE trail" />
          </div>

          {/* Robot name overlay */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <div className={`text-[9px] font-mono tracking-widest ${current.color}`}>
              {current.name.toUpperCase()}
            </div>
            <div className="text-[8px] font-mono text-slate-700 mt-0.5">
              FORWARD KINEMATICS — DEMO TRAJECTORY
            </div>
          </div>
        </div>

        {/* Right: 3D surface (40%) */}
        <div className="flex flex-col w-[40%] h-full bg-[#0d1117] px-4 pt-4 pb-3">
          <WorkspaceSurface robotType={robotType} />

          {/* Surface info */}
          <div className="shrink-0 pt-2 border-t border-slate-800 mt-2">
            <SurfaceInfo robotType={robotType} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function LegendItem({ color, label, hex }: { color: string; label: string; hex?: boolean }) {
  const bg = hex ? color : color
  return (
    <div className="flex items-center gap-2 text-[9px] font-mono text-slate-600">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: bg }} />
      {label}
    </div>
  )
}

function SurfaceInfo({ robotType }: { robotType: RobotType }) {
  const info: Record<RobotType, { metric: string; formula: string; note: string }> = {
    '2dof': {
      metric: 'Manipulability',
      formula: 'w = L₁L₂|sin q₂|',
      note: 'Zero at singular config (q₂=0,π)',
    },
    '3dof': {
      metric: 'Velocity Ellipsoid Vol.',
      formula: 'w = √(w₁₂² + w₂₃² + w₁₃²)',
      note: 'Projected at q₃ = π/5 fixed',
    },
    'scara': {
      metric: 'Workspace Density',
      formula: 'f(r) = ½(1−cos 2π·t), t=(r−r_min)/(r_max−r_min)',
      note: 'Annular reach: |L₁−L₂| ≤ r ≤ L₁+L₂',
    },
    'delta': {
      metric: 'Force Isotropy Index',
      formula: 'f = (0.7 + 0.3·cos²3θ)·(1 − r²/R²)',
      note: '3-fold symmetric workspace',
    },
  }
  const { metric, formula, note } = info[robotType]

  return (
    <div className="space-y-1">
      <div className="text-[9px] font-mono text-slate-500">{metric}</div>
      <div className="text-[9px] font-mono text-slate-700 font-bold">{formula}</div>
      <div className="text-[8px] font-mono text-slate-800">{note}</div>
    </div>
  )
}
