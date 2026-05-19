'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RobotCanvas2D, { type RobotModel, LINK_LENGTHS, ik2R, ik3R } from './RobotCanvas2D'
import RobotCanvas3D, { type CustomJoint } from './RobotCanvas3D'
import WorkspaceSurface from './WorkspaceSurface'
import type { RobotType } from './WorkspaceSurface'

/* ── Types ───────────────────────────────────────────────────────────────── */

type KinMode = 'demo' | 'fk' | 'ik'

interface StandardRobot {
  kind: 'standard'
  id: RobotModel
  label: string
  sub: string
  dof: number
  wsType: RobotType
  defaultLinks: number[]
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
  { kind: 'standard', id: '2r',    label: '2R Planar',  sub: 'Revolute–Revolute',         dof: 2, wsType: '2dof',  defaultLinks: [1.5, 1.1] },
  { kind: 'standard', id: '3r',    label: '3R Planar',  sub: 'R–R–R',                     dof: 3, wsType: '3dof',  defaultLinks: [1.2, 0.85, 0.55] },
  { kind: 'standard', id: 'scara', label: 'SCARA',      sub: 'Selective Compliance',      dof: 2, wsType: 'scara', defaultLinks: [0.65, 0.48] },
]

/* ── Component ───────────────────────────────────────────────────────────── */

export default function RoboticDashboard() {
  const router = useRouter()

  // ── Robot list state
  const [customRobots, setCustomRobots] = useState<CustomRobot[]>([])
  const [selectedId, setSelectedId] = useState<string>('2r')

  // ── Kinematics state (standard robots)
  const [kinMode, setKinMode] = useState<KinMode>('demo')
  const [fkDeg, setFkDeg] = useState([45, 60, 30, 0, 0])
  const [ikTarget, setIkTarget] = useState({ x: 1.8, y: 1.0, phi: 0.0 })
  const [ikValid, setIkValid] = useState(true)
  const [ikAngles, setIkAngles] = useState<number[]>([])
  const [eePos, setEePos] = useState({ x: 0, y: 0 })

  // ── Custom robot FK state
  const [fk3DDeg, setFk3DDeg] = useState<number[]>([])
  const [ee3DPos, setEe3DPos] = useState({ x: 0, y: 0, z: 0 })

  // ── Link length customization (per standard robot)
  const [customLinks, setCustomLinks] = useState<Record<string, number[]>>({
    '2r':    [...LINK_LENGTHS['2r']],
    '3r':    [...LINK_LENGTHS['3r']],
    'scara': [...LINK_LENGTHS['scara']],
  })

  // ── Robot Ekle form
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [newRobotName, setNewRobotName] = useState('Özel Robot')
  const [newJoints, setNewJoints] = useState<CustomJoint[]>([
    { type: 'R', length: 1.0 },
    { type: 'R', length: 0.8 },
  ])

  // ── Workspace modal
  const [showWorkspace, setShowWorkspace] = useState(false)

  // ── Derive current robot
  const allRobots: AnyRobot[] = [...STANDARD_ROBOTS, ...customRobots]
  const currentRobot = allRobots.find(r => r.id === selectedId) ?? STANDARD_ROBOTS[0]
  const isCustom = currentRobot.kind === 'custom'
  const isStandard = currentRobot.kind === 'standard'

  // ── IK validation (standard robots)
  useEffect(() => {
    if (!isStandard) return
    const r = currentRobot as StandardRobot
    const links = customLinks[r.id] ?? r.defaultLinks
    let sol: number[] | null = null
    if (links.length === 2) sol = ik2R(links[0], links[1], ikTarget.x, ikTarget.y)
    else sol = ik3R(links[0], links[1], links[2], ikTarget.x, ikTarget.y, ikTarget.phi)
    setIkValid(sol !== null)
    setIkAngles(sol ?? [])
  }, [ikTarget, selectedId, customLinks, isStandard, currentRobot])

  // ── Reset FK state when robot changes
  useEffect(() => {
    setKinMode('demo')
    setFkDeg([45, 60, 30, 0, 0])
    if (isCustom) {
      const r = currentRobot as CustomRobot
      setFk3DDeg(r.joints.map(() => 0))
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEEUpdate2D = useCallback((pos: { x: number; y: number }, _angles: number[]) => {
    setEePos(pos)
  }, [])

  const handleEEUpdate3D = useCallback((pos: { x: number; y: number; z: number }) => {
    setEe3DPos(pos)
  }, [])

  // ── Add robot
  const addRobot = () => {
    if (newJoints.length === 0) return
    const id = `custom_${Date.now()}`
    const robot: CustomRobot = {
      kind: 'custom',
      id,
      label: newRobotName || 'Özel Robot',
      joints: newJoints.map(j => ({ ...j })),
      dof: newJoints.length,
    }
    setCustomRobots(prev => [...prev, robot])
    setSelectedId(id)
    setFk3DDeg(newJoints.map(() => 0))
    setShowAddPanel(false)
    setNewRobotName('Özel Robot')
    setNewJoints([{ type: 'R', length: 1.0 }, { type: 'R', length: 0.8 }])
  }

  const addJoint = () => {
    if (newJoints.length >= 5) return
    setNewJoints(prev => [...prev, { type: 'R', length: 0.5 }])
  }

  const removeJoint = (i: number) => {
    if (newJoints.length <= 1) return
    setNewJoints(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── FK angles for 2D (in radians)
  const fkRad = fkDeg.map(d => d * Math.PI / 180)

  /* ── render ─────────────────────────────────────────────────────────────── */

  const standardRobot = isStandard ? (currentRobot as StandardRobot) : null
  const customRobot   = isCustom   ? (currentRobot as CustomRobot)   : null

  // ── FK values for 3D: R joints → radians, P joints → meters (must be after customRobot)
  const fk3DValues = customRobot
    ? customRobot.joints.map((j, i) =>
        j.type === 'R' ? (fk3DDeg[i] ?? 0) * Math.PI / 180 : (fk3DDeg[i] ?? 0)
      )
    : []

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-11 shrink-0 bg-black/60 backdrop-blur border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-xs font-mono text-slate-500 hover:text-cyan-400 transition-colors"
          >
            ← ANA SAYFA
          </button>
          <span className="text-slate-800">|</span>
          <span className="text-sm font-mono font-bold tracking-widest text-slate-300">
            ROBOTİK SİSTEMLER
          </span>
        </div>

        {isStandard && (
          <button
            onClick={() => setShowWorkspace(true)}
            className="text-xs font-mono text-slate-500 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 px-3 py-1 rounded transition-all"
          >
            WORKSPACE YÜZEYİ ↗
          </button>
        )}
      </div>

      {/* ── Content row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 bg-[#0d1117] border-r border-slate-800/80 flex flex-col select-none overflow-y-auto">

          {/* ── Manipülatörler ── */}
          <SideSection label="MANİPÜLATÖRLER">
            <div className="space-y-0.5">
              {allRobots.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-2 py-2.5 rounded text-xs font-mono flex items-start gap-2 transition-colors
                    ${selectedId === r.id
                      ? 'bg-cyan-500/15 text-cyan-300 border-l-2 border-cyan-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-2 border-transparent'
                    }`}
                >
                  <span className="text-[10px] mt-0.5 opacity-60">{r.kind === 'custom' ? '◆' : '⬡'}</span>
                  <div>
                    <div className="font-semibold text-[13px]">{r.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {r.dof}-DOF · {r.kind === 'custom' ? '3D Görünüm' : (r as StandardRobot).sub}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SideSection>

          <Divider />

          {/* ── Robot Ekle ── */}
          <SideSection
            label="ROBOT EKLE"
            collapsible
            open={showAddPanel}
            onToggle={() => setShowAddPanel(v => !v)}
          >
            {showAddPanel && (
              <div className="space-y-3">
                {/* Robot name */}
                <div>
                  <div className="text-[10px] font-mono text-slate-500 mb-1">Robot Adı</div>
                  <input
                    value={newRobotName}
                    onChange={e => setNewRobotName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/60"
                    placeholder="Özel Robot"
                  />
                </div>

                {/* Joints list */}
                <div>
                  <div className="text-[10px] font-mono text-slate-500 mb-1.5">Eklemler ({newJoints.length}/5)</div>
                  <div className="space-y-2">
                    {newJoints.map((joint, i) => (
                      <div key={i} className="bg-slate-900/60 border border-slate-800 rounded p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-slate-300 font-semibold">Eklem {i + 1}</span>
                          {newJoints.length > 1 && (
                            <button
                              onClick={() => removeJoint(i)}
                              className="text-[10px] font-mono text-slate-600 hover:text-red-400 transition-colors"
                            >✕</button>
                          )}
                        </div>

                        {/* Type */}
                        <div className="flex gap-1">
                          {(['R', 'P'] as const).map(t => (
                            <button
                              key={t}
                              onClick={() => setNewJoints(prev => prev.map((j, idx) => idx === i ? { ...j, type: t } : j))}
                              className={`flex-1 text-[10px] font-mono py-1 rounded border transition-all ${
                                joint.type === t
                                  ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                                  : 'border-slate-700 text-slate-500 hover:border-slate-600'
                              }`}
                            >
                              {t === 'R' ? 'Revolute' : 'Prismatic'}
                            </button>
                          ))}
                        </div>

                        {/* Length */}
                        <div>
                          <div className="flex justify-between text-[9px] font-mono text-slate-600 mb-0.5">
                            <span>Kol Uzunluğu (m)</span>
                            <span className="text-cyan-400">{joint.length.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min="0.1" max="2.0" step="0.05"
                            value={joint.length}
                            onChange={e => setNewJoints(prev => prev.map((j, idx) =>
                              idx === i ? { ...j, length: parseFloat(e.target.value) } : j
                            ))}
                            className="w-full accent-cyan-400 h-1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {newJoints.length < 5 && (
                    <button
                      onClick={addJoint}
                      className="w-full mt-2 text-[11px] font-mono py-1.5 border border-dashed border-slate-700 text-slate-500 hover:border-cyan-500/50 hover:text-cyan-400 rounded transition-all"
                    >
                      + Eklem Ekle
                    </button>
                  )}
                </div>

                <button
                  onClick={addRobot}
                  className="w-full text-xs font-mono py-2 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 hover:text-cyan-200 transition-all font-semibold"
                >
                  Robotu Ekle →
                </button>
              </div>
            )}
          </SideSection>

          <Divider />

          {/* ── Özelleştir (link lengths for standard robots) ── */}
          {isStandard && standardRobot && (
            <>
              <SideSection label="ROBOT ÖZELLEŞTİR">
                <div className="space-y-3">
                  <p className="text-[10px] font-mono text-slate-600 leading-relaxed">
                    Kol uzunluklarını değiştirin — robot canlı güncellenir.
                  </p>
                  {(customLinks[standardRobot.id] ?? standardRobot.defaultLinks).map((len, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                        <span>a<sub>{i + 1}</sub> — Kol {i + 1}</span>
                        <span className="text-cyan-400">{len.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range" min="0.1" max="3.0" step="0.05"
                        value={len}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          setCustomLinks(prev => {
                            const arr = [...(prev[standardRobot.id] ?? standardRobot.defaultLinks)]
                            arr[i] = v
                            return { ...prev, [standardRobot.id]: arr }
                          })
                        }}
                        className="w-full h-1 accent-cyan-400"
                      />
                      <input
                        type="number" min="0.1" max="3.0" step="0.05"
                        value={len.toFixed(2)}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0.1
                          setCustomLinks(prev => {
                            const arr = [...(prev[standardRobot.id] ?? standardRobot.defaultLinks)]
                            arr[i] = Math.max(0.1, Math.min(3.0, v))
                            return { ...prev, [standardRobot.id]: arr }
                          })
                        }}
                        className="w-full mt-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setCustomLinks(prev => ({ ...prev, [standardRobot.id]: [...standardRobot.defaultLinks] }))}
                    className="w-full text-[10px] font-mono py-1 border border-slate-800 text-slate-600 hover:text-slate-400 hover:border-slate-600 rounded transition-all"
                  >
                    Sıfırla
                  </button>
                </div>
              </SideSection>
              <Divider />
            </>
          )}

          {/* ── Kinematik ── */}
          <SideSection label="KİNEMATİK">
            <div className="flex-1 overflow-y-auto min-h-0 pb-2 space-y-3">

              {/* Mode tabs — only for standard/planar robots */}
              {isStandard && (
                <div className="flex gap-1">
                  {(['demo', 'fk', 'ik'] as KinMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setKinMode(m)}
                      className={`flex-1 text-[11px] font-mono py-1.5 rounded border transition-all
                        ${kinMode === m
                          ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                          : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom 3D robot: DEMO / FK */}
              {isCustom && customRobot && (
                <div className="space-y-3">
                  <div className="flex gap-1">
                    {(['demo', 'fk'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setKinMode(m)}
                        className={`flex-1 text-[11px] font-mono py-1.5 rounded border transition-all
                          ${kinMode === m
                            ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                            : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {kinMode === 'demo' && (
                    <p className="text-[10px] font-mono text-slate-600 leading-relaxed">
                      Sinüsoidal demo hareketi. FK seçerek eklem açılarını kontrol edin.
                    </p>
                  )}

                  {kinMode === 'fk' && (
                    <div className="space-y-3">
                      {customRobot.joints.map((joint, i) => (
                        <JointSlider3D
                          key={i}
                          index={i}
                          jointType={joint.type}
                          maxLen={joint.length}
                          value={fk3DDeg[i] ?? 0}
                          onChange={v => setFk3DDeg(prev => {
                            const a = [...prev]; a[i] = v; return a
                          })}
                        />
                      ))}
                    </div>
                  )}

                  <EEReadout3D pos={ee3DPos} />
                </div>
              )}

              {/* Standard 2D robot kinematic panels */}
              {isStandard && standardRobot && (
                <>
                  {kinMode === 'demo' && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono text-slate-600 leading-relaxed">
                        Özerk sinüsoidal yörünge. FK veya IK'ya geçerek interaktif kontrol yapın.
                      </p>
                      <EEReadout label="UÇ ETKİLEYİCİ" pos={eePos} />
                    </div>
                  )}

                  {kinMode === 'fk' && (
                    <div className="space-y-3">
                      {Array.from({ length: standardRobot.dof }, (_, i) => (
                        <JointSlider
                          key={i}
                          index={i}
                          value={fkDeg[i] ?? 0}
                          onChange={v => setFkDeg(prev => { const a = [...prev]; a[i] = v; return a })}
                        />
                      ))}
                      <EEReadout label="UÇ KONUM" pos={eePos} />
                    </div>
                  )}

                  {kinMode === 'ik' && (
                    <div className="space-y-2">
                      <NumInput label="Hedef X (m)" value={ikTarget.x} step={0.05}
                        onChange={v => setIkTarget(p => ({ ...p, x: v }))} />
                      <NumInput label="Hedef Y (m)" value={ikTarget.y} step={0.05}
                        onChange={v => setIkTarget(p => ({ ...p, y: v }))} />
                      {standardRobot.dof >= 3 && (
                        <NumInput label="UE φ (rad)" value={ikTarget.phi} step={0.05}
                          onChange={v => setIkTarget(p => ({ ...p, phi: v }))} />
                      )}

                      <div className={`text-[10px] font-mono px-2 py-1.5 rounded border ${
                        ikValid
                          ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5'
                          : 'border-red-500/30 text-red-400 bg-red-500/5'
                      }`}>
                        {ikValid ? '✓ Çözüm bulundu' : '✗ Çalışma uzayı dışında'}
                      </div>

                      {ikValid && (
                        <div className="pt-1 border-t border-slate-800 space-y-1">
                          <div className="text-[10px] font-mono text-slate-500 mb-1">EKLEM AÇILARI</div>
                          {ikAngles.map((a, i) => (
                            <div key={i} className="text-xs font-mono text-slate-400">
                              q{i + 1}: <span className="text-violet-400">{(a * 180 / Math.PI).toFixed(1)}°</span>
                              <span className="text-slate-700 ml-1">({a.toFixed(3)} rad)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </SideSection>

          {/* Link info footer */}
          {isStandard && standardRobot && (
            <div className="px-3 py-2 border-t border-slate-800/60 shrink-0 mt-auto">
              <div className="text-[10px] font-mono text-slate-600 leading-relaxed">
                {(customLinks[standardRobot.id] ?? standardRobot.defaultLinks)
                  .map((l, i) => `L${i + 1}=${l.toFixed(2)}`)
                  .join(' · ')} m
              </div>
            </div>
          )}
        </div>

        {/* ── Main canvas ───────────────────────────────────────────────────── */}
        <div className="relative flex-1 h-full">
          {isStandard && standardRobot && (
            <>
              <RobotCanvas2D
                key={selectedId}
                model={standardRobot.id}
                mode={kinMode === 'fk' ? 'fk' : kinMode === 'ik' ? 'ik' : 'demo'}
                angles={kinMode === 'fk' ? fkRad : undefined}
                target={kinMode === 'ik' ? ikTarget : undefined}
                customLinkLengths={customLinks[standardRobot.id]}
                onEEUpdate={handleEEUpdate2D}
              />
              <div className="absolute top-3 left-3 pointer-events-none">
                <div className="text-xs font-mono tracking-widest text-cyan-400">{standardRobot.label.toUpperCase()}</div>
                <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                  {kinMode === 'demo' ? 'DEMO YÖRÜNGE' : kinMode === 'fk' ? 'İLERİ KİNEMATİK' : 'TERS KİNEMATİK'}
                </div>
              </div>
            </>
          )}

          {isCustom && customRobot && (
            <>
              <RobotCanvas3D
                key={selectedId}
                joints={customRobot.joints}
                jointValues={kinMode === 'fk' ? fk3DValues : []}
                mode={kinMode === 'fk' ? 'fk' : 'demo'}
                onEEUpdate={handleEEUpdate3D}
              />
              <div className="absolute top-3 left-3 pointer-events-none">
                <div className="text-xs font-mono tracking-widest text-cyan-400">{customRobot.label.toUpperCase()}</div>
                <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                  3D İNTERAKTİF GÖRÜNÜM — fare ile döndürün
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Workspace modal ───────────────────────────────────────────────────── */}
      {showWorkspace && isStandard && standardRobot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowWorkspace(false) }}
        >
          <div className="w-[82vw] h-[82vh] bg-[#0d1117] border border-slate-700/80 rounded-xl flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
              <span className="text-xs font-mono text-slate-300 tracking-widest">
                WORKSPACE YÜZEYİ — {standardRobot.label.toUpperCase()}
              </span>
              <button
                onClick={() => setShowWorkspace(false)}
                className="text-xs font-mono text-slate-600 hover:text-slate-300 transition-colors px-2 py-0.5 border border-slate-800 hover:border-slate-600 rounded"
              >
                ✕ KAPAT
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <WorkspaceSurface robotType={standardRobot.wsType} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function SideSection({
  label, children, collapsible, open, onToggle,
}: {
  label: string
  children: React.ReactNode
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="px-3 pt-3 pb-2">
      <button
        className={`w-full flex items-center justify-between text-[10px] font-mono text-slate-500 tracking-[0.18em] mb-2 uppercase ${collapsible ? 'hover:text-slate-300 cursor-pointer' : 'cursor-default'}`}
        onClick={collapsible ? onToggle : undefined}
      >
        <span>{label}</span>
        {collapsible && (
          <span className="text-slate-700 text-[10px]">{open ? '▲' : '▼'}</span>
        )}
      </button>
      {children}
    </div>
  )
}

function Divider() {
  return <div className="mx-3 border-t border-slate-800/60" />
}

function JointSlider({ index, value, onChange }: { index: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
        <span>q{index + 1} (derece)</span>
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
        className="w-full mt-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      />
    </div>
  )
}

function JointSlider3D({
  index, jointType, maxLen, value, onChange,
}: {
  index: number
  jointType: 'R' | 'P'
  maxLen: number
  value: number
  onChange: (v: number) => void
}) {
  const isR = jointType === 'R'
  const min = isR ? -180 : 0
  const max = isR ? 180 : maxLen
  const step = isR ? 1 : 0.01
  const label = isR ? `${value.toFixed(1)}°` : `${value.toFixed(2)} m`

  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-0.5">
        <span>q{index + 1} {isR ? '(Revolute, °)' : '(Prismatic, m)'}</span>
        <span className="text-cyan-400">{label}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400 h-1"
      />
      <input
        type="number" min={min} max={max} step={step} value={isR ? value.toFixed(1) : value.toFixed(2)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full mt-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      />
    </div>
  )
}

function NumInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-slate-500 mb-0.5">{label}</div>
      <input
        type="number" step={step} value={value.toFixed(3)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      />
    </div>
  )
}

function EEReadout({ label, pos }: { label: string; pos: { x: number; y: number } }) {
  return (
    <div className="pt-2 border-t border-slate-800">
      <div className="text-[10px] font-mono text-slate-500 mb-1">{label}</div>
      <div className="text-xs font-mono text-slate-400">x: <span className="text-cyan-400">{pos.x.toFixed(3)}</span> m</div>
      <div className="text-xs font-mono text-slate-400">y: <span className="text-cyan-400">{pos.y.toFixed(3)}</span> m</div>
    </div>
  )
}

function EEReadout3D({ pos }: { pos: { x: number; y: number; z: number } }) {
  return (
    <div className="pt-2 border-t border-slate-800">
      <div className="text-[10px] font-mono text-slate-500 mb-1">UÇ ETKİLEYİCİ (3D)</div>
      <div className="text-xs font-mono text-slate-400">x: <span className="text-cyan-400">{pos.x.toFixed(3)}</span> m</div>
      <div className="text-xs font-mono text-slate-400">y: <span className="text-cyan-400">{pos.y.toFixed(3)}</span> m</div>
      <div className="text-xs font-mono text-slate-400">z: <span className="text-cyan-400">{pos.z.toFixed(3)}</span> m</div>
    </div>
  )
}
