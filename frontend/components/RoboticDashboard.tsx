'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RobotCanvas2D, { type RobotModel, LINK_LENGTHS, ik2R, ik3R } from './RobotCanvas2D'
import WorkspaceSurface from './WorkspaceSurface'
import DHTable from './DHTable'
import type { RobotType } from './WorkspaceSurface'

// ── Robot catalogue ───────────────────────────────────────────────────────────

const ROBOTS: {
  id: RobotModel
  label: string
  sub: string
  links: string
  dof: number
  wsType: RobotType
}[] = [
  { id: '2r',    label: '2R Planar',  sub: 'Revolute–Revolute',         links: 'L₁=1.50 · L₂=1.10 m',            dof: 2, wsType: '2dof'  },
  { id: '3r',    label: '3R Planar',  sub: 'Revolute–Revolute–Revolute', links: 'L₁=1.20 · L₂=0.85 · L₃=0.55 m', dof: 3, wsType: '3dof'  },
  { id: 'scara', label: 'SCARA',      sub: 'Selective Compliance',       links: 'L₁=0.65 · L₂=0.48 m',            dof: 2, wsType: 'scara' },
]

type KinMode = 'demo' | 'fk' | 'ik'

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoboticDashboard() {
  const router = useRouter()

  const [model,         setModel]         = useState<RobotModel>('2r')
  const [kinMode,       setKinMode]       = useState<KinMode>('demo')
  const [showWorkspace, setShowWorkspace] = useState(false)

  // FK: joint angles in degrees (relative, same convention as fkPlanar)
  const [fkDeg, setFkDeg] = useState([45, 60, 30])

  // IK: target + solution
  const [ikTarget, setIkTarget] = useState({ x: 1.8, y: 1.0, phi: 0.0 })
  const [ikValid,  setIkValid]  = useState(true)
  const [ikAngles, setIkAngles] = useState<number[]>([])

  // EE readout + demo mode angles (from canvas callback)
  const [eePos,       setEePos]       = useState({ x: 0, y: 0 })
  const [demoAngles,  setDemoAngles]  = useState<number[]>([0.4, 0.6])

  const robot = ROBOTS.find(r => r.id === model)!

  // Validate IK target when it changes
  useEffect(() => {
    const links = LINK_LENGTHS[model]
    let sol: number[] | null = null
    if (links.length === 2) sol = ik2R(links[0], links[1], ikTarget.x, ikTarget.y)
    else                    sol = ik3R(links[0], links[1], links[2], ikTarget.x, ikTarget.y, ikTarget.phi)
    setIkValid(sol !== null)
    setIkAngles(sol ?? [])
  }, [ikTarget, model])

  const handleEEUpdate = useCallback((pos: { x: number; y: number }, angles: number[]) => {
    setEePos(pos)
    if (kinMode === 'demo') setDemoAngles(angles)
    if (kinMode === 'ik')   setIkAngles(angles)
  }, [kinMode])

  const selectModel = (id: RobotModel) => {
    setModel(id)
    setKinMode('demo')
    setFkDeg([45, 60, 30])
    setIkTarget({ x: 1.8, y: 1.0, phi: 0.0 })
  }

  // Angles passed to DHTable — use the authoritative source for each mode
  const fkRad = fkDeg.map(d => d * Math.PI / 180)

  const dhAngles =
    kinMode === 'fk'   ? fkRad.slice(0, robot.dof) :
    kinMode === 'ik'   ? ikAngles :
    /* demo */           demoAngles.slice(0, robot.dof)

  /* ── render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-10 shrink-0 bg-black/60 backdrop-blur border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-[10px] font-mono text-slate-600 hover:text-cyan-400 transition-colors"
          >
            ← HOME
          </button>
          <span className="text-slate-800">|</span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-slate-300">
            ROBOTIC SYSTEMS
          </span>
        </div>

        <button
          onClick={() => setShowWorkspace(true)}
          className="text-[9px] font-mono text-slate-500 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 px-3 py-1 rounded transition-all"
        >
          WORKSPACE SURFACE ↗
        </button>
      </div>

      {/* Content row */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <div className="w-56 shrink-0 bg-[#0d1117] border-r border-slate-800/80 flex flex-col select-none">

          {/* Robot list */}
          <div className="px-3 pt-4 pb-1">
            <div className="text-[8px] font-mono text-slate-600 tracking-[0.2em] mb-2 uppercase">
              Manipulators
            </div>
            <div className="space-y-0.5">
              {ROBOTS.map(r => (
                <button
                  key={r.id}
                  onClick={() => selectModel(r.id)}
                  className={`w-full text-left px-2 py-2 rounded text-[11px] font-mono flex items-start gap-2 transition-colors
                    ${model === r.id
                      ? 'bg-cyan-500/15 text-cyan-300 border-l-2 border-cyan-400'
                      : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300 border-l-2 border-transparent'
                    }`}
                >
                  <span className="text-[10px] mt-0.5 opacity-60">⬡</span>
                  <div>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-[9px] text-slate-600 mt-0.5">{r.dof}-DOF · {r.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mx-3 border-t border-slate-800/60 my-2" />

          {/* Kinematics panel */}
          <div className="px-3 flex-1 overflow-y-auto min-h-0 pb-2">
            <div className="text-[8px] font-mono text-slate-600 tracking-[0.2em] mb-2 uppercase">
              Kinematics
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 mb-3">
              {(['demo', 'fk', 'ik'] as KinMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setKinMode(m)}
                  className={`flex-1 text-[9px] font-mono py-1 rounded border transition-all
                    ${kinMode === m
                      ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                      : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                    }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            {/* DEMO */}
            {kinMode === 'demo' && (
              <div className="space-y-2">
                <p className="text-[9px] font-mono text-slate-600 leading-relaxed">
                  Autonomous sinusoidal trajectory. DH table updates live.
                </p>
                <EEReadout label="EE" pos={eePos} />
              </div>
            )}

            {/* FK */}
            {kinMode === 'fk' && (
              <div className="space-y-3">
                {Array.from({ length: robot.dof }, (_, i) => (
                  <JointSlider
                    key={i}
                    index={i}
                    value={fkDeg[i]}
                    onChange={v => setFkDeg(prev => { const a = [...prev]; a[i] = v; return a })}
                  />
                ))}
                <EEReadout label="EE POSITION" pos={eePos} />
              </div>
            )}

            {/* IK */}
            {kinMode === 'ik' && (
              <div className="space-y-2">
                <NumInput label="Target X (m)" value={ikTarget.x} step={0.05}
                  onChange={v => setIkTarget(p => ({ ...p, x: v }))} />
                <NumInput label="Target Y (m)" value={ikTarget.y} step={0.05}
                  onChange={v => setIkTarget(p => ({ ...p, y: v }))} />
                {robot.dof >= 3 && (
                  <NumInput label="EE φ (rad)" value={ikTarget.phi} step={0.05}
                    onChange={v => setIkTarget(p => ({ ...p, phi: v }))} />
                )}

                <div className={`text-[9px] font-mono px-2 py-1 rounded border ${
                  ikValid
                    ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5'
                    : 'border-red-500/30 text-red-400 bg-red-500/5'
                }`}>
                  {ikValid ? '✓ Solution found' : '✗ Out of workspace'}
                </div>

                {ikValid && (
                  <div className="pt-1 border-t border-slate-800 space-y-0.5">
                    <div className="text-[8px] font-mono text-slate-600 mb-1">JOINT ANGLES</div>
                    {ikAngles.map((a, i) => (
                      <div key={i} className="text-[10px] font-mono text-slate-400">
                        q{i + 1}: <span className="text-violet-400">{(a * 180 / Math.PI).toFixed(1)}°</span>
                        <span className="text-slate-700 ml-1">({a.toFixed(3)} rad)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Link lengths */}
          <div className="px-3 py-2 border-t border-slate-800/60 shrink-0">
            <div className="text-[8px] font-mono text-slate-700 leading-relaxed">{robot.links}</div>
          </div>
        </div>

        {/* ── 2D Canvas ─────────────────────────────────────────────────── */}
        <div className="relative flex-1 h-full min-w-0">
          <RobotCanvas2D
            key={model}
            model={model}
            mode={kinMode === 'fk' ? 'fk' : kinMode === 'ik' ? 'ik' : 'demo'}
            angles={kinMode === 'fk' ? fkRad : undefined}
            target={kinMode === 'ik' ? ikTarget : undefined}
            onEEUpdate={handleEEUpdate}
          />

          <div className="absolute top-3 left-3 pointer-events-none">
            <div className="text-[9px] font-mono tracking-widest text-cyan-400">{robot.label.toUpperCase()}</div>
            <div className="text-[8px] font-mono text-slate-700 mt-0.5">
              {kinMode === 'demo' ? 'DEMO TRAJECTORY' : kinMode === 'fk' ? 'FORWARD KINEMATICS' : 'INVERSE KINEMATICS'}
            </div>
          </div>
        </div>

        {/* ── DH Panel ──────────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 h-full overflow-hidden">
          <DHTable
            model={model}
            angles={dhAngles}
            robotLabel={`${robot.label} · ${robot.dof}-DOF`}
          />
        </div>
      </div>

      {/* ── Workspace modal ────────────────────────────────────────────────── */}
      {showWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowWorkspace(false) }}
        >
          <div className="w-[82vw] h-[82vh] bg-[#0d1117] border border-slate-700/80 rounded-xl flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
              <span className="text-[10px] font-mono text-slate-300 tracking-widest">
                WORKSPACE SURFACE — {robot.label.toUpperCase()}
              </span>
              <button
                onClick={() => setShowWorkspace(false)}
                className="text-[10px] font-mono text-slate-600 hover:text-slate-300 transition-colors px-2 py-0.5 border border-slate-800 hover:border-slate-600 rounded"
              >
                ✕ CLOSE
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <WorkspaceSurface robotType={robot.wsType} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function JointSlider({ index, value, onChange }: {
  index: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-0.5">
        <span>q{index + 1} (deg)</span>
        <span className="text-cyan-400">{value.toFixed(1)}°</span>
      </div>
      <input
        type="range" min="-180" max="180" step="0.5" value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400 h-1"
      />
      <input
        type="number" min="-180" max="180" step="0.5" value={value.toFixed(1)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      />
    </div>
  )
}

function NumInput({ label, value, step, onChange }: {
  label: string; value: number; step: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-slate-500 mb-0.5">{label}</div>
      <input
        type="number" step={step} value={value.toFixed(3)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      />
    </div>
  )
}

function EEReadout({ label, pos }: { label: string; pos: { x: number; y: number } }) {
  return (
    <div className="pt-2 border-t border-slate-800">
      <div className="text-[8px] font-mono text-slate-600 mb-1">{label}</div>
      <div className="text-[10px] font-mono text-slate-400">x: <span className="text-cyan-400">{pos.x.toFixed(3)}</span> m</div>
      <div className="text-[10px] font-mono text-slate-400">y: <span className="text-cyan-400">{pos.y.toFixed(3)}</span> m</div>
    </div>
  )
}
