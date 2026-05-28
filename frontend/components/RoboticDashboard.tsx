'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RobotCanvas2D, { type RobotModel, LINK_LENGTHS, ik2R, ik3R } from './RobotCanvas2D'
import RobotCanvas3D, { type CustomJoint } from './RobotCanvas3D'
import WorkspaceSurface from './WorkspaceSurface'
import { useTheme } from '@/context/ThemeContext'

/* ── Types ───────────────────────────────────────────────────────────────── */

type KinMode = 'demo' | 'fk' | 'ik'

interface StandardRobot {
  kind: 'standard'
  id: RobotModel
  label: string
  sub: string
  dof: number
  defaultLinks: number[]
  jointTypes?: ('R' | 'P')[]
  prismaticDirs?: ([number,number,number] | undefined)[]
  rotationAxes?: (('X' | 'Y' | 'Z') | undefined)[]  // per-joint rotation axis for R joints
}

interface CustomRobot {
  kind: 'custom'
  id: string
  label: string
  joints: CustomJoint[]
  dof: number
}

type AnyRobot = StandardRobot | CustomRobot

/* ── Catalogue ───────────────────────────────────────────────────────────── */

const STANDARD_ROBOTS: StandardRobot[] = [
  {
    kind: 'standard', id: '2r', label: '2R Planar', sub: 'Revolute–Revolute',
    dof: 2, defaultLinks: [1.5, 1.1],
    rotationAxes: ['Y', 'Y'],          // both joints sweep in horizontal XZ plane
  },
  {
    kind: 'standard', id: '3r', label: '3R Planar', sub: 'R–R–R',
    dof: 3, defaultLinks: [1.2, 0.85, 0.55],
    rotationAxes: ['Y', 'Y', 'Y'],     // all joints sweep in horizontal XZ plane
  },
  {
    kind: 'standard', id: 'scara', label: 'SCARA', sub: 'R–R–P · 3 DOF',
    dof: 3, defaultLinks: [0.65, 0.48, 0.30],
    jointTypes:    ['R', 'R', 'P'],
    prismaticDirs: [undefined, undefined, [0, -1, 0]],  // vertical stroke: downward (-Y in Three.js)
    rotationAxes:  ['Y', 'Y', undefined],               // both revolute joints sweep in horizontal plane
  },
]

/* ── Component ───────────────────────────────────────────────────────────── */

export default function RoboticDashboard() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [customRobots, setCustomRobots]   = useState<CustomRobot[]>([])
  const [selectedId, setSelectedId]       = useState<string>('2r')
  const [kinMode, setKinMode]             = useState<KinMode>('demo')
  const [viewMode3D, setViewMode3D]       = useState(false)

  // FK state — fkDeg stores degrees for R joints; fkMeters stores metres for P joints
  const [fkDeg, setFkDeg]     = useState([45, 60, 30, 0, 0])
  const [fkMeters, setFkMeters] = useState([0, 0, 0, 0, 0])

  const [ikTarget, setIkTarget]           = useState({ x: 1.8, y: 1.0, phi: 0.0 })
  const [ikValid, setIkValid]             = useState(true)
  const [ikAngles, setIkAngles]           = useState<number[]>([])
  const [eePos, setEePos]                 = useState({ x: 0, y: 0 })
  const [fk3DDeg, setFk3DDeg]             = useState<number[]>([])
  const [ee3DPos, setEe3DPos]             = useState({ x: 0, y: 0, z: 0 })
  const [customLinks, setCustomLinks]     = useState<Record<string, number[]>>({
    '2r':    [...LINK_LENGTHS['2r']],
    '3r':    [...LINK_LENGTHS['3r']],
    'scara': [0.65, 0.48, 0.30],   // R1, R2, P (Z stroke)
  })
  const [showAddPanel, setShowAddPanel]   = useState(false)
  const [newRobotName, setNewRobotName]   = useState('Custom Robot')
  const [newJoints, setNewJoints]         = useState<CustomJoint[]>([
    { type: 'R', length: 1.0 },
    { type: 'R', length: 0.8 },
  ])
  const [showWorkspace, setShowWorkspace] = useState(false)

  const allRobots: AnyRobot[]  = [...STANDARD_ROBOTS, ...customRobots]
  const currentRobot           = allRobots.find(r => r.id === selectedId) ?? STANDARD_ROBOTS[0]
  const isCustom               = currentRobot.kind === 'custom'
  const isStandard             = currentRobot.kind === 'standard'
  const standardRobot          = isStandard ? (currentRobot as StandardRobot) : null
  const customRobot            = isCustom   ? (currentRobot as CustomRobot)   : null

  // Helper: joint type at index i for the selected standard robot
  const getJt = (i: number): 'R' | 'P' => standardRobot?.jointTypes?.[i] ?? 'R'

  // Exit IK when switching to 3D (IK is 2D-only)
  useEffect(() => {
    if (viewMode3D && kinMode === 'ik') setKinMode('demo')
  }, [viewMode3D]) // eslint-disable-line react-hooks/exhaustive-deps

  // IK — solve only with the revolute links (ignore prismatic)
  useEffect(() => {
    if (!isStandard || !standardRobot) return
    const allLinks = customLinks[standardRobot.id] ?? standardRobot.defaultLinks
    const rLinks   = allLinks.filter((_, i) => getJt(i) === 'R')
    let sol: number[] | null = null
    if (rLinks.length === 2) sol = ik2R(rLinks[0], rLinks[1], ikTarget.x, ikTarget.y)
    else if (rLinks.length >= 3) sol = ik3R(rLinks[0], rLinks[1], rLinks[2], ikTarget.x, ikTarget.y, ikTarget.phi)
    setIkValid(sol !== null)
    setIkAngles(sol ?? [])
  }, [ikTarget, selectedId, customLinks, isStandard, currentRobot]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setKinMode('demo')
    setFkDeg([45, 60, 0, 0, 0])
    setFkMeters([0, 0, 0, 0, 0])
    if (isCustom) setFk3DDeg((currentRobot as CustomRobot).joints.map(() => 0))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEEUpdate2D = useCallback((pos: { x: number; y: number }) => setEePos(pos), [])
  const handleEEUpdate3D = useCallback((pos: { x: number; y: number; z: number }) => setEe3DPos(pos), [])

  const addRobot = () => {
    if (newJoints.length === 0) return
    const id = `custom_${Date.now()}`
    const robot: CustomRobot = {
      kind: 'custom', id,
      label: newRobotName || 'Custom Robot',
      joints: newJoints.map(j => ({ ...j })),
      dof: newJoints.length,
    }
    setCustomRobots(prev => [...prev, robot])
    setSelectedId(id)
    setFk3DDeg(newJoints.map(() => 0))
    setShowAddPanel(false)
    setNewRobotName('Custom Robot')
    setNewJoints([{ type: 'R', length: 1.0 }, { type: 'R', length: 0.8 }])
  }

  // FK values for standard robots: R joints → radians, P joints → metres
  const fkValues = Array.from({ length: 5 }, (_, i) =>
    getJt(i) === 'R' ? (fkDeg[i] ?? 0) * Math.PI / 180 : (fkMeters[i] ?? 0)
  )

  // For 2D canvas: only the revolute joints matter (planar kinematics)
  const allLinksStd = standardRobot
    ? (customLinks[standardRobot.id] ?? standardRobot.defaultLinks)
    : []
  const rLinksFor2D = allLinksStd.filter((_, i) => getJt(i) === 'R')
  const fkAnglesFor2D = fkValues.filter((_, i) => getJt(i) === 'R')

  // Standard robot expressed as CustomJoint[] for the 3D canvas (includes P joints)
  const standardAs3DJoints: CustomJoint[] = allLinksStd.map((l, i) => ({
    type: standardRobot?.jointTypes?.[i] ?? 'R',
    length: l,
    prismaticDir: standardRobot?.prismaticDirs?.[i],
    rotationAxis: standardRobot?.rotationAxes?.[i] as 'X' | 'Y' | 'Z' | undefined,
  }))

  // FK/IK values for the 3D canvas
  const standard3DValues = (() => {
    if (kinMode === 'fk') {
      return fkValues.slice(0, standardRobot?.dof ?? 0)
    }
    if (kinMode === 'ik') {
      // IK returns R-joint angles; fill P joints from fkMeters
      let rIdx = 0
      return Array.from({ length: standardRobot?.dof ?? 0 }, (_, i) =>
        getJt(i) === 'R' ? (ikAngles[rIdx++] ?? 0) : (fkMeters[i] ?? 0)
      )
    }
    return []
  })()

  // Custom robot
  const fk3DValues = customRobot
    ? customRobot.joints.map((j, i) =>
        j.type === 'R' ? (fk3DDeg[i] ?? 0) * Math.PI / 180 : (fk3DDeg[i] ?? 0)
      )
    : []

  // ── Singularity & joint-limit warnings (FK mode, standard robots) ─────────
  const rAnglesForWarning = isStandard && standardRobot
    ? fkValues.slice(0, standardRobot.dof).filter((_, i) => getJt(i) === 'R')
    : []

  const singularityWarning: string | null = (() => {
    if (kinMode !== 'fk' || rAnglesForWarning.length < 2) return null
    const q2 = rAnglesForWarning[1]
    if (Math.abs(Math.sin(q2)) < 0.15) {
      return Math.cos(q2) > 0
        ? 'Arm fully extended — det(J) ≈ 0'
        : 'Arm fully folded — det(J) ≈ 0'
    }
    return null
  })()

  const jointLimitWarnings: string[] = (() => {
    if (kinMode !== 'fk' || !isStandard || !standardRobot) return []
    return Array.from({ length: standardRobot.dof }, (_, i) => {
      if (getJt(i) !== 'R') return null
      const deg = fkDeg[i] ?? 0
      return Math.abs(deg) > 170 ? `q${i + 1} = ${deg.toFixed(0)}° near ±180°` : null
    }).filter(Boolean) as string[]
  })()

  /* ── render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-11 shrink-0
                      bg-white/90 dark:bg-black/60 backdrop-blur
                      border-b border-slate-200 dark:border-slate-800/80 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-xs font-mono text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            ← HOME
          </button>
          <span className="text-slate-300 dark:text-slate-800">|</span>
          <span className="text-sm font-mono font-bold tracking-widest text-slate-700 dark:text-slate-300">
            ROBOTIC SYSTEMS
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 2D / 3D toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-mono transition-colors select-none ${!viewMode3D ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>
              2D
            </span>
            <button
              onClick={() => setViewMode3D(v => !v)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 focus:outline-none
                ${viewMode3D ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`}
              title={viewMode3D ? '3D view active — click for 2D' : '2D view active — click for 3D'}
            >
              <span className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm
                                transition-transform duration-200 ${viewMode3D ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </button>
            <span className={`text-[11px] font-mono transition-colors select-none ${viewMode3D ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 'text-slate-400 dark:text-slate-600'}`}>
              3D
            </span>
          </div>

          <button
            onClick={() => setShowWorkspace(true)}
            className="text-xs font-mono text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-300
                       border border-slate-200 dark:border-slate-800
                       hover:border-cyan-400/60 dark:hover:border-cyan-500/40
                       px-3 py-1 rounded transition-all"
          >
            WORKSPACE ↗
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <div className="w-80 shrink-0 bg-white dark:bg-[#0d1117]
                        border-r border-slate-200 dark:border-slate-800/80
                        flex flex-col select-none overflow-y-auto">

          {/* Manipulators */}
          <SideSection label="MANIPULATORS">
            <div className="space-y-0.5">
              {allRobots.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-2 py-2.5 rounded text-xs font-mono flex items-start gap-2 transition-colors
                    ${selectedId === r.id
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-l-2 border-cyan-500 dark:border-cyan-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 border-l-2 border-transparent'
                    }`}
                >
                  <span className="text-[10px] mt-0.5 opacity-60">{r.kind === 'custom' ? '◆' : '⬡'}</span>
                  <div>
                    <div className="font-semibold text-[13px]">{r.label}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {r.dof}-DOF · {r.kind === 'custom' ? 'Custom Robot' : (r as StandardRobot).sub}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SideSection>

          <Divider />

          {/* Robot Ekle */}
          <SideSection label="ADD ROBOT" collapsible open={showAddPanel} onToggle={() => setShowAddPanel(v => !v)}>
            {showAddPanel && (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 mb-1">Robot Name</div>
                  <input
                    value={newRobotName}
                    onChange={e => setNewRobotName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700
                               rounded px-2 py-1.5 text-xs font-mono text-slate-800 dark:text-slate-200
                               focus:outline-none focus:border-cyan-500/60"
                    placeholder="Custom Robot"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-500 mb-1.5">Joints ({newJoints.length}/5)</div>
                  <div className="space-y-2">
                    {newJoints.map((joint, i) => (
                      <div key={i} className="bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-semibold">Joint {i + 1}</span>
                          {newJoints.length > 1 && (
                            <button onClick={() => setNewJoints(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-[10px] font-mono text-slate-400 dark:text-slate-600 hover:text-red-500 transition-colors">✕</button>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {(['R', 'P'] as const).map(t => (
                            <button key={t}
                              onClick={() => setNewJoints(prev => prev.map((j, idx) => idx === i ? { ...j, type: t } : j))}
                              className={`flex-1 text-[10px] font-mono py-1 rounded border transition-all ${
                                joint.type === t
                                  ? 'border-cyan-500/50 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-slate-400 dark:hover:border-slate-600'
                              }`}
                            >{t === 'R' ? 'Revolute' : 'Prismatic'}</button>
                          ))}
                        </div>
                        <div>
                          <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-0.5">
                            <span>Link Length (m)</span>
                            <span className="text-cyan-600 dark:text-cyan-400">{joint.length.toFixed(2)}</span>
                          </div>
                          <input type="range" min="0.1" max="2.0" step="0.05" value={joint.length}
                            onChange={e => setNewJoints(prev => prev.map((j, idx) =>
                              idx === i ? { ...j, length: parseFloat(e.target.value) } : j
                            ))}
                            className="w-full accent-cyan-500 h-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {newJoints.length < 5 && (
                    <button onClick={() => setNewJoints(prev => [...prev, { type: 'R', length: 0.5 }])}
                      className="w-full mt-2 text-[11px] font-mono py-1.5 border border-dashed border-slate-300 dark:border-slate-700 text-slate-500
                                 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-all">
                      + Add Joint
                    </button>
                  )}
                </div>
                <button onClick={addRobot}
                  className="w-full text-xs font-mono py-2 rounded bg-cyan-500/15 border border-cyan-400/40 dark:border-cyan-500/30
                             text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-600 dark:hover:text-cyan-200 transition-all font-semibold">
                  Add Robot →
                </button>
              </div>
            )}
          </SideSection>

          <Divider />

          {/* Customize Robot — always visible for standard robots */}
          {isStandard && standardRobot && (
            <>
              <SideSection label="CUSTOMIZE ROBOT">
                <div className="space-y-3">
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-600 leading-relaxed">
                    Adjust parameters — robot updates live.
                  </p>
                  {allLinksStd.map((len, i) => {
                    const isP = getJt(i) === 'P'
                    const paramMin  = isP ? 0.05 : 0.1
                    const paramMax  = isP ? 0.8  : 3.0
                    const paramStep = 0.05
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                          <span>
                            {isP
                              ? <><span className="text-slate-400 dark:text-slate-600">d</span><sub>{i + 1}</sub> — Z Stroke</>
                              : <><span className="text-slate-400 dark:text-slate-600">a</span><sub>{i + 1}</sub> — Link {i + 1}</>
                            }
                          </span>
                          <span className="text-cyan-600 dark:text-cyan-400">{len.toFixed(2)} m</span>
                        </div>
                        <input type="range" min={paramMin} max={paramMax} step={paramStep} value={len}
                          onChange={e => {
                            const v = parseFloat(e.target.value)
                            setCustomLinks(prev => {
                              const arr = [...(prev[standardRobot.id] ?? standardRobot.defaultLinks)]
                              arr[i] = v
                              return { ...prev, [standardRobot.id]: arr }
                            })
                          }}
                          className="w-full h-1 accent-cyan-500" />
                        <input type="number" min={paramMin} max={paramMax} step={paramStep}
                          value={len.toFixed(2)}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || paramMin
                            setCustomLinks(prev => {
                              const arr = [...(prev[standardRobot.id] ?? standardRobot.defaultLinks)]
                              arr[i] = Math.max(paramMin, Math.min(paramMax, v))
                              return { ...prev, [standardRobot.id]: arr }
                            })
                          }}
                          className="w-full mt-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1
                                     text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500/50" />
                      </div>
                    )
                  })}
                  <button
                    onClick={() => setCustomLinks(prev => ({ ...prev, [standardRobot.id]: [...standardRobot.defaultLinks] }))}
                    className="w-full text-[10px] font-mono py-1 border border-slate-200 dark:border-slate-800 text-slate-500
                               hover:text-slate-700 dark:hover:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 rounded transition-all">
                    Reset
                  </button>
                </div>
              </SideSection>
              <Divider />
            </>
          )}

          {/* Kinematik */}
          <SideSection label="KINEMATICS">
            <div className="space-y-3">

              {/* Mode selector — standard */}
              {isStandard && (
                <div className="flex gap-1">
                  {(['demo', 'fk', ...(!viewMode3D ? ['ik'] : [])] as KinMode[]).map(m => (
                    <button key={m} onClick={() => setKinMode(m)}
                      className={`flex-1 text-[11px] font-mono py-1.5 rounded border transition-all
                        ${kinMode === m
                          ? 'border-cyan-500/50 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {/* Mode selector — custom */}
              {isCustom && (
                <div className="flex gap-1">
                  {(['demo', 'fk'] as const).map(m => (
                    <button key={m} onClick={() => setKinMode(m)}
                      className={`flex-1 text-[11px] font-mono py-1.5 rounded border transition-all
                        ${kinMode === m
                          ? 'border-cyan-500/50 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {/* Standard robot kinematic controls */}
              {isStandard && standardRobot && (
                <>
                  {kinMode === 'demo' && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-600 leading-relaxed">
                        {viewMode3D ? '3D demo trajectory — rotate with mouse.' : 'Sinusoidal demo trajectory. Switch to FK or IK for interactive control.'}
                      </p>
                      {viewMode3D ? <EEReadout3D pos={ee3DPos} /> : <EEReadout label="END EFFECTOR" pos={eePos} />}
                      {/* Demo mode formula */}
                      <FormulaBox title="DH Forward Kinematics" lines={[
                        { eq: 'T₀ⁿ = A₁(q₁)·A₂(q₂)·…·Aₙ(qₙ)', note: 'chain of transforms' },
                        { eq: 'Aᵢ = Rz(θᵢ)·Tz(dᵢ)·Tx(aᵢ)·Rx(αᵢ)', note: 'DH matrix' },
                        { eq: 'p_ee = T₀ⁿ · [0,0,0,1]ᵀ', note: 'end-effector position' },
                      ]} />
                    </div>
                  )}
                  {kinMode === 'fk' && (
                    <div className="space-y-3">
                      {Array.from({ length: standardRobot.dof }, (_, i) => {
                        const isP   = getJt(i) === 'P'
                        const maxL  = allLinksStd[i] ?? 0.5
                        return isP ? (
                          <PrismaticSlider
                            key={i} index={i} maxLen={maxL}
                            value={fkMeters[i] ?? 0}
                            onChange={v => setFkMeters(prev => { const a = [...prev]; a[i] = v; return a })}
                          />
                        ) : (
                          <JointSlider
                            key={i} index={i} value={fkDeg[i] ?? 0}
                            onChange={v => setFkDeg(prev => { const a = [...prev]; a[i] = v; return a })}
                          />
                        )
                      })}
                      {viewMode3D ? <EEReadout3D pos={ee3DPos} /> : <EEReadout label="EE POSITION" pos={eePos} />}
                      {/* FK formula hints per robot type */}
                      {standardRobot.id === '2r' && (
                        <FormulaBox title="2R Forward Kinematics" lines={[
                          { eq: 'x = L₁c₁ + L₂c₁₂', note: `L₁=${(allLinksStd[0]??0).toFixed(2)} L₂=${(allLinksStd[1]??0).toFixed(2)}` },
                          { eq: 'y = L₁s₁ + L₂s₁₂', note: 'cᵢⱼ=cos(qᵢ+qⱼ)' },
                          { eq: 'φ = q₁ + q₂', note: 'end-effector orientation' },
                        ]} />
                      )}
                      {standardRobot.id === '3r' && (
                        <FormulaBox title="3R Forward Kinematics" lines={[
                          { eq: 'x = L₁c₁ + L₂c₁₂ + L₃c₁₂₃', note: `L₁…L₃=${allLinksStd.map(l=>l.toFixed(2)).join(',')}` },
                          { eq: 'y = L₁s₁ + L₂s₁₂ + L₃s₁₂₃', note: 'sᵢⱼₖ=sin(qᵢ+qⱼ+qₖ)' },
                          { eq: 'φ = q₁+q₂+q₃', note: 'EE orientation' },
                        ]} />
                      )}
                      {standardRobot.id === 'scara' && (
                        <FormulaBox title="SCARA Forward Kinematics" lines={[
                          { eq: 'x = L₁c₁ + L₂c₁₂', note: 'horizontal plane' },
                          { eq: 'y = L₁s₁ + L₂s₁₂', note: 'horizontal plane' },
                          { eq: 'z = −d₃', note: 'vertical stroke (prismatic)' },
                        ]} />
                      )}
                    </div>
                  )}
                  {kinMode === 'ik' && !viewMode3D && (
                    <div className="space-y-2">
                      <NumInput label="Target X (m)" value={ikTarget.x} step={0.05}
                        onChange={v => setIkTarget(p => ({ ...p, x: v }))} />
                      <NumInput label="Target Y (m)" value={ikTarget.y} step={0.05}
                        onChange={v => setIkTarget(p => ({ ...p, y: v }))} />
                      {rLinksFor2D.length >= 3 && (
                        <NumInput label="EE φ (rad)" value={ikTarget.phi} step={0.05}
                          onChange={v => setIkTarget(p => ({ ...p, phi: v }))} />
                      )}
                      <div className={`text-[10px] font-mono px-2 py-1.5 rounded border ${
                        ikValid
                          ? 'border-cyan-400/40 text-cyan-700 dark:text-cyan-400 bg-cyan-500/5'
                          : 'border-red-400/40 text-red-600 dark:text-red-400 bg-red-500/5'
                      }`}>
                        {ikValid ? '✓ Solution found' : '✗ Out of workspace'}
                      </div>
                      {/* Z slider for robots with prismatic joints */}
                      {standardRobot.jointTypes?.some(t => t === 'P') && (
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                          {allLinksStd.map((_, i) => getJt(i) === 'P' ? (
                            <PrismaticSlider
                              key={i} index={i} maxLen={allLinksStd[i] ?? 0.5}
                              value={fkMeters[i] ?? 0}
                              onChange={v => setFkMeters(prev => { const a = [...prev]; a[i] = v; return a })}
                            />
                          ) : null)}
                        </div>
                      )}
                      {ikValid && (
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                          <div className="text-[10px] font-mono text-slate-500 mb-1">JOINT ANGLES</div>
                          {ikAngles.map((a, i) => (
                            <div key={i} className="text-xs font-mono text-slate-600 dark:text-slate-400">
                              q{i + 1}: <span className="text-violet-600 dark:text-violet-400">{(a * 180 / Math.PI).toFixed(1)}°</span>
                              <span className="text-slate-400 dark:text-slate-700 ml-1">({a.toFixed(3)} rad)</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* IK formula hints */}
                      {rLinksFor2D.length === 2 && (
                        <FormulaBox title="2R Geometric IK" lines={[
                          { eq: 'c₂ = (x²+y²−L₁²−L₂²)/(2L₁L₂)', note: 'cosine rule' },
                          { eq: 'q₂ = atan2(±√(1−c₂²), c₂)', note: 'elbow up / down' },
                          { eq: 'q₁ = atan2(y,x) − atan2(L₂s₂, L₁+L₂c₂)', note: 'joint 1' },
                          { eq: 'workspace: |x|+|y| ≤ L₁+L₂', note: 'reachability' },
                        ]} />
                      )}
                      {rLinksFor2D.length >= 3 && (
                        <FormulaBox title="3R IK — Decoupled" lines={[
                          { eq: 'wrist = (x−L₃cosφ, y−L₃sinφ)', note: 'wrist centre' },
                          { eq: 'solve 2R IK for wrist', note: 'q₁,q₂ from 2R' },
                          { eq: 'q₃ = φ − q₁ − q₂', note: 'orientation constraint' },
                        ]} />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Custom robot controls */}
              {isCustom && customRobot && (
                <div className="space-y-3">
                  {kinMode === 'demo' && (
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-600 leading-relaxed">
                      {viewMode3D ? '3D demo — rotate with mouse.' : '2D demo trajectory. Select FK to control joint angles.'}
                    </p>
                  )}
                  {kinMode === 'fk' && customRobot.joints.map((joint, i) => (
                    <JointSlider3D key={i} index={i} jointType={joint.type} maxLen={joint.length}
                      value={fk3DDeg[i] ?? 0}
                      onChange={v => setFk3DDeg(prev => { const a = [...prev]; a[i] = v; return a })} />
                  ))}
                  {viewMode3D ? <EEReadout3D pos={ee3DPos} /> : <EEReadout label="END EFFECTOR" pos={eePos} />}
                </div>
              )}
            </div>
          </SideSection>

          {/* Link lengths summary */}
          {isStandard && standardRobot && (
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800/60 shrink-0 mt-auto">
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-700 leading-relaxed">
                {allLinksStd.map((l, i) => {
                  const label = getJt(i) === 'P' ? `d${i+1}` : `L${i+1}`
                  return `${label}=${l.toFixed(2)}`
                }).join(' · ')} m
              </div>
            </div>
          )}
        </div>

        {/* Main canvas */}
        <div className="relative flex-1 h-full">

          {/* Standard robot — 2D */}
          {isStandard && standardRobot && !viewMode3D && (
            <>
              <RobotCanvas2D
                key={`${selectedId}-2d`}
                model={standardRobot.id}
                mode={kinMode === 'fk' ? 'fk' : kinMode === 'ik' ? 'ik' : 'demo'}
                angles={kinMode === 'fk' ? fkAnglesFor2D : undefined}
                target={kinMode === 'ik' ? ikTarget : undefined}
                customLinkLengths={rLinksFor2D}
                isDark={isDark}
                onEEUpdate={handleEEUpdate2D}
              />
              <CanvasLabel title={standardRobot.label.toUpperCase()}
                subtitle={kinMode === 'demo' ? 'DEMO TRAJECTORY' : kinMode === 'fk' ? 'FORWARD KINEMATICS' : 'INVERSE KINEMATICS'} />
            </>
          )}

          {/* Standard robot — 3D */}
          {isStandard && standardRobot && viewMode3D && (
            <>
              <RobotCanvas3D
                key={`${selectedId}-3d`}
                joints={standardAs3DJoints}
                jointValues={kinMode === 'demo' ? [] : standard3DValues}
                mode={kinMode === 'demo' ? 'demo' : 'fk'}
                isDark={isDark}
                onEEUpdate={handleEEUpdate3D}
              />
              <CanvasLabel title={standardRobot.label.toUpperCase()}
                subtitle={kinMode === 'demo' ? '3D DEMO — rotate with mouse' : '3D FORWARD KINEMATICS — rotate with mouse'} />
            </>
          )}

          {/* Custom robot — 3D */}
          {isCustom && customRobot && viewMode3D && (
            <>
              <RobotCanvas3D
                key={`${selectedId}-3d`}
                joints={customRobot.joints}
                jointValues={kinMode === 'fk' ? fk3DValues : []}
                mode={kinMode === 'fk' ? 'fk' : 'demo'}
                isDark={isDark}
                onEEUpdate={handleEEUpdate3D}
              />
              <CanvasLabel title={customRobot.label.toUpperCase()}
                subtitle="3D INTERACTIVE — rotate with mouse" />
            </>
          )}

          {/* Custom robot — 2D (only revolute joints; P joints are 3D-only) */}
          {isCustom && customRobot && !viewMode3D && (
            <>
              <RobotCanvas2D
                key={`${selectedId}-2d`}
                model="2r"
                mode={kinMode === 'fk' ? 'fk' : 'demo'}
                angles={kinMode === 'fk'
                  ? fk3DValues.filter((_, i) => customRobot.joints[i]?.type === 'R')
                  : undefined}
                customLinkLengths={customRobot.joints.filter(j => j.type === 'R').map(j => j.length)}
                isDark={isDark}
                onEEUpdate={handleEEUpdate2D}
              />
              <CanvasLabel title={customRobot.label.toUpperCase()}
                subtitle="2D PLANAR VIEW" />
            </>
          )}

          {/* Singularity / joint-limit warnings */}
          {(singularityWarning || jointLimitWarnings.length > 0) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center gap-1.5">
              {singularityWarning && (
                <div className="px-3 py-1.5 rounded-lg text-[11px] font-mono backdrop-blur-sm
                                bg-amber-950/85 border border-amber-500/50 text-amber-300 whitespace-nowrap">
                  ⚠ SINGULARITY — {singularityWarning}
                </div>
              )}
              {jointLimitWarnings.map((w, i) => (
                <div key={i} className="px-3 py-1.5 rounded-lg text-[11px] font-mono backdrop-blur-sm
                                        bg-red-950/85 border border-red-500/50 text-red-300 whitespace-nowrap">
                  ⛔ JOINT LIMIT — {w}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workspace modal */}
      {showWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/75 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowWorkspace(false) }}>
          <div className="w-[82vw] h-[82vh] bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tracking-widest">
                WORKSPACE — {currentRobot.label.toUpperCase()}
              </span>
              <button onClick={() => setShowWorkspace(false)}
                className="text-xs font-mono text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors
                           px-2 py-0.5 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded">
                ✕ CLOSE
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <WorkspaceSurface
                joints={isStandard ? standardAs3DJoints : (customRobot?.joints ?? [])}
                label={currentRobot.label}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function FormulaLine({ eq, note }: { eq: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <code className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 whitespace-nowrap">{eq}</code>
      {note && <span className="text-[9px] font-mono text-slate-400 dark:text-slate-600 leading-snug">{note}</span>}
    </div>
  )
}

function FormulaBox({ title, lines }: { title: string; lines: { eq: string; note?: string }[] }) {
  return (
    <div className="rounded border border-cyan-400/20 dark:border-cyan-500/15 bg-cyan-50/50 dark:bg-cyan-950/20 px-3 py-2 space-y-1.5">
      <div className="text-[9px] font-mono tracking-[0.15em] text-cyan-600 dark:text-cyan-500 uppercase mb-1.5">{title}</div>
      {lines.map((l, i) => <FormulaLine key={i} eq={l.eq} note={l.note} />)}
    </div>
  )
}

function CanvasLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="absolute top-3 left-3 pointer-events-none">
      <div className="text-xs font-mono tracking-widest text-cyan-600 dark:text-cyan-400">{title}</div>
      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-600 mt-0.5">{subtitle}</div>
    </div>
  )
}

function SideSection({ label, children, collapsible, open, onToggle }: {
  label: string; children: React.ReactNode; collapsible?: boolean; open?: boolean; onToggle?: () => void
}) {
  return (
    <div className="px-3 pt-3 pb-2">
      <button
        className={`w-full flex items-center justify-between text-[10px] font-mono tracking-[0.18em] mb-2 uppercase
                    text-slate-400 dark:text-slate-500
                    ${collapsible ? 'hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer' : 'cursor-default'}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <span>{label}</span>
        {collapsible && <span className="text-slate-300 dark:text-slate-700 text-[10px]">{open ? '▲' : '▼'}</span>}
      </button>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="mx-3 border-t border-slate-100 dark:border-slate-800/60" />
}

function JointSlider({ index, value, onChange }: { index: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
        <span>q{index + 1} (deg)</span>
        <span className="text-cyan-600 dark:text-cyan-400">{value.toFixed(1)}°</span>
      </div>
      <input type="range" min="-180" max="180" step="0.5" value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1" />
      <input type="number" min="-180" max="180" step="0.5" value={value.toFixed(1)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1
                   text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500/50" />
    </div>
  )
}

function PrismaticSlider({ index, maxLen, value, onChange }: {
  index: number; maxLen: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
        <span>q{index + 1} — Z Stroke (m)</span>
        <span className="text-violet-600 dark:text-violet-400">{value.toFixed(3)} m</span>
      </div>
      <input type="range" min="0" max={maxLen} step="0.01" value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-violet-500 h-1" />
      <input type="number" min="0" max={maxLen} step="0.01" value={value.toFixed(3)}
        onChange={e => onChange(Math.max(0, Math.min(maxLen, parseFloat(e.target.value) || 0)))}
        className="w-full mt-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1
                   text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-violet-500/50" />
    </div>
  )
}

function JointSlider3D({ index, jointType, maxLen, value, onChange }: {
  index: number; jointType: 'R' | 'P'; maxLen: number; value: number; onChange: (v: number) => void
}) {
  const isR = jointType === 'R'
  const min = isR ? -180 : 0; const max = isR ? 180 : maxLen; const step = isR ? 1 : 0.01
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
        <span>q{index + 1} {isR ? '(R, °)' : '(P, m)'}</span>
        <span className="text-cyan-600 dark:text-cyan-400">{isR ? `${value.toFixed(1)}°` : `${value.toFixed(2)} m`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1" />
      <input type="number" min={min} max={max} step={step} value={isR ? value.toFixed(1) : value.toFixed(2)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1
                   text-[11px] font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500/50" />
    </div>
  )
}

function NumInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-slate-500 mb-0.5">{label}</div>
      <input type="number" step={step} value={value.toFixed(3)} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5
                   text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500/50" />
    </div>
  )
}

function EEReadout({ label, pos }: { label: string; pos: { x: number; y: number } }) {
  return (
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div className="text-[10px] font-mono text-slate-500 mb-1">{label}</div>
      <div className="text-xs font-mono text-slate-600 dark:text-slate-400">x: <span className="text-cyan-600 dark:text-cyan-400">{pos.x.toFixed(3)}</span> m</div>
      <div className="text-xs font-mono text-slate-600 dark:text-slate-400">y: <span className="text-cyan-600 dark:text-cyan-400">{pos.y.toFixed(3)}</span> m</div>
    </div>
  )
}

function EEReadout3D({ pos }: { pos: { x: number; y: number; z: number } }) {
  return (
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div className="text-[10px] font-mono text-slate-500 mb-1">END EFFECTOR (3D)</div>
      <div className="text-xs font-mono text-slate-600 dark:text-slate-400">x: <span className="text-cyan-600 dark:text-cyan-400">{pos.x.toFixed(3)}</span> m</div>
      <div className="text-xs font-mono text-slate-600 dark:text-slate-400">y: <span className="text-cyan-600 dark:text-cyan-400">{pos.y.toFixed(3)}</span> m</div>
      <div className="text-xs font-mono text-slate-600 dark:text-slate-400">z: <span className="text-cyan-600 dark:text-cyan-400">{pos.z.toFixed(3)}</span> m</div>
    </div>
  )
}
