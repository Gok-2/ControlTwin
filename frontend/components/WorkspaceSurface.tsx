'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export type RobotType = '2dof' | '3dof' | 'scara'

const LINKS: Record<RobotType, number[]> = {
  '2dof':  [1.5, 1.1],
  '3dof':  [1.2, 0.85, 0.55],
  'scara': [0.65, 0.48],
}

interface Obstacle { x: number; y: number; r: number; label: string }
interface JointLimit { min: number; max: number }
type ViewMode = 'manipulability' | 'constrained'

const OBSTACLE_PRESETS: Record<string, Obstacle[]> = {
  'None':    [],
  'Wall':    [{ x: 0.6, y: 0.5, r: 0.28, label: 'Wall A' }, { x: 0.6, y: -0.5, r: 0.28, label: 'Wall B' }],
  'Pillar':  [{ x: 0.9, y: 0.0, r: 0.30, label: 'Pillar' }],
  'Cluster': [
    { x: 0.7, y: 0.6,  r: 0.20, label: 'Obs 1' },
    { x: -0.4, y: 0.9, r: 0.20, label: 'Obs 2' },
    { x: 1.0, y: -0.5, r: 0.15, label: 'Obs 3' },
  ],
}

// ── FK helpers ─────────────────────────────────────────────────────────────────

function fk2R(L1: number, L2: number, q1: number, q2: number) {
  return {
    x: L1 * Math.cos(q1) + L2 * Math.cos(q1 + q2),
    y: L1 * Math.sin(q1) + L2 * Math.sin(q1 + q2),
  }
}

function fkNR(links: number[], angles: number[]) {
  let x = 0, y = 0, cum = 0
  for (let i = 0; i < links.length; i++) {
    cum += angles[i] ?? 0
    x += links[i] * Math.cos(cum)
    y += links[i] * Math.sin(cum)
  }
  return { x, y }
}

// ── Joint-space manipulability surface ────────────────────────────────────────

function computeManipulability(type: RobotType) {
  const N = 55
  if (type === '2dof') {
    const [L1, L2] = LINKS['2dof']
    const x = Array.from({ length: N }, (_, j) => -Math.PI + 2 * Math.PI * j / (N - 1))
    const y = Array.from({ length: N }, (_, i) => -Math.PI + 2 * Math.PI * i / (N - 1))
    const z = y.map(q2 => x.map(q1 => L1 * L2 * Math.abs(Math.sin(q2)) * (0.85 + 0.15 * Math.sin(q1 + q2))))
    return { x, y, z, cs: 'Viridis', title: 'Manipulability — 2R Planar  |  w = |L₁L₂ sin q₂|', xl: 'q₁ (rad)', yl: 'q₂ (rad)', zl: 'w' }
  }
  if (type === '3dof') {
    const [L1, L2, L3] = LINKS['3dof']; const Q3 = Math.PI / 5
    const x = Array.from({ length: N }, (_, j) => -Math.PI + 2 * Math.PI * j / (N - 1))
    const y = Array.from({ length: N }, (_, i) => -Math.PI + 2 * Math.PI * i / (N - 1))
    const z = y.map(q2 => x.map(q1 => {
      const w12 = L1 * L2 * Math.abs(Math.sin(q2))
      const w23 = L2 * L3 * Math.abs(Math.sin(Q3))
      const w13 = L1 * L3 * Math.abs(Math.sin(q2 + Q3))
      return Math.sqrt(w12**2 + w23**2 + w13**2) * (0.8 + 0.2 * Math.cos(q1))
    }))
    return { x, y, z, cs: 'Plasma', title: 'Velocity Ellipsoid — 3R  |  q₃=π/5 fixed', xl: 'q₁ (rad)', yl: 'q₂ (rad)', zl: 'w' }
  }
  // scara
  const [L1, L2] = LINKS['scara']
  const lim = (L1 + L2) * 1.05
  const rMin = Math.abs(L1 - L2), rMax = L1 + L2
  const x = Array.from({ length: N }, (_, j) => -lim + 2 * lim * j / (N - 1))
  const y = Array.from({ length: N }, (_, i) => -lim + 2 * lim * i / (N - 1))
  const z = y.map(py => x.map(px => {
    const r = Math.hypot(px, py)
    if (r < rMin || r > rMax) return 0
    const t = (r - rMin) / (rMax - rMin)
    return 0.5 * (1 - Math.cos(2 * Math.PI * t))
  }))
  return { x, y, z, cs: 'Cividis', title: 'Reachable Workspace — SCARA', xl: 'X (m)', yl: 'Y (m)', zl: 'Reachability' }
}

// ── Task-space constrained workspace ─────────────────────────────────────────

function computeConstrainedWorkspace(
  type: RobotType,
  limits: JointLimit[],
  obstacles: Obstacle[],
) {
  const links = LINKS[type]
  const totalReach = links.reduce((a, b) => a + b, 0)
  const range = totalReach * 1.1
  const N = 65
  const Nj = type === '3dof' ? 45 : 130

  const xs = Array.from({ length: N }, (_, i) => -range + 2 * range * i / (N - 1))
  const ys = Array.from({ length: N }, (_, i) => -range + 2 * range * i / (N - 1))
  const z: number[][] = ys.map(() => xs.map(() => 0))

  const toIdx = (v: number) => Math.round((v + range) / (2 * range) * (N - 1))

  const stamp = (x: number, y: number, w: number) => {
    if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.r)) return
    const xi = toIdx(x), yi = toIdx(y)
    if (xi >= 0 && xi < N && yi >= 0 && yi < N)
      z[yi][xi] = Math.max(z[yi][xi], w)
  }

  if (type === '2dof') {
    const [L1, L2] = links
    const l0 = limits[0] ?? { min: -Math.PI, max: Math.PI }
    const l1 = limits[1] ?? { min: -Math.PI, max: Math.PI }
    for (let i = 0; i <= Nj; i++) {
      const q1 = l0.min + (l0.max - l0.min) * i / Nj
      for (let j = 0; j <= Nj; j++) {
        const q2 = l1.min + (l1.max - l1.min) * j / Nj
        const { x, y } = fk2R(L1, L2, q1, q2)
        stamp(x, y, Math.abs(L1 * L2 * Math.sin(q2)))
      }
    }
  } else if (type === '3dof') {
    const [L1, L2] = links
    for (let i = 0; i <= Nj; i++) {
      const q1 = (limits[0]?.min ?? -Math.PI) + ((limits[0]?.max ?? Math.PI) - (limits[0]?.min ?? -Math.PI)) * i / Nj
      for (let j = 0; j <= Nj; j++) {
        const q2 = (limits[1]?.min ?? -Math.PI) + ((limits[1]?.max ?? Math.PI) - (limits[1]?.min ?? -Math.PI)) * j / Nj
        for (let k = 0; k <= Nj; k++) {
          const q3 = (limits[2]?.min ?? -Math.PI) + ((limits[2]?.max ?? Math.PI) - (limits[2]?.min ?? -Math.PI)) * k / Nj
          const { x, y } = fkNR(links, [q1, q2, q3])
          stamp(x, y, Math.abs(L1 * L2 * Math.sin(q2)))
        }
      }
    }
  } else {
    const [L1, L2] = links
    const l0 = limits[0] ?? { min: -Math.PI, max: Math.PI }
    const l1 = limits[1] ?? { min: -Math.PI, max: Math.PI }
    for (let i = 0; i <= Nj; i++) {
      const q1 = l0.min + (l0.max - l0.min) * i / Nj
      for (let j = 0; j <= Nj; j++) {
        const q2 = l1.min + (l1.max - l1.min) * j / Nj
        const { x, y } = fk2R(L1, L2, q1, q2)
        stamp(x, y, Math.abs(L1 * L2 * Math.sin(q2)))
      }
    }
  }

  // Mark obstacles as depressions
  for (const obs of obstacles) {
    for (let yi = 0; yi < N; yi++) {
      for (let xi = 0; xi < N; xi++) {
        if (Math.hypot(xs[xi] - obs.x, ys[yi] - obs.y) < obs.r)
          z[yi][xi] = -0.15
      }
    }
  }

  // Compute reachable fraction
  let reachable = 0
  for (const row of z) for (const v of row) if (v > 0) reachable++
  const frac = ((reachable / (N * N)) * 100).toFixed(1)

  return { x: xs, y: ys, z, frac }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { robotType: RobotType }

export default function WorkspaceSurface({ robotType }: Props) {
  const divRef    = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const ready     = useRef(false)

  const [viewMode, setViewMode] = useState<ViewMode>('manipulability')
  const [obsKey,   setObsKey]   = useState('None')
  const [isComputing, setIsComputing] = useState(false)
  const [reachFrac, setReachFrac] = useState<string | null>(null)

  const nDof = LINKS[robotType].length
  const [limits, setLimits] = useState<JointLimit[]>(
    Array.from({ length: 3 }, () => ({ min: -180, max: 180 }))
  )

  const setLimit = (i: number, key: 'min' | 'max', deg: number) =>
    setLimits(prev => { const a = [...prev]; a[i] = { ...a[i], [key]: deg }; return a })

  const obstacles = OBSTACLE_PRESETS[obsKey] ?? []

  const axStyle = {
    color: '#475569', gridcolor: '#1e293b', zerolinecolor: '#334155',
    tickfont: { color: '#475569', size: 8 },
    titlefont: { color: '#64748b', size: 9 },
  }

  const renderManipulability = useCallback((Plotly: any) => {
    if (!divRef.current) return
    const { x, y, z, cs, title, xl, yl, zl } = computeManipulability(robotType)
    Plotly.react(
      divRef.current,
      [{
        type: 'surface', x, y, z,
        colorscale: cs, showscale: true,
        colorbar: {
          thickness: 12, len: 0.7, x: 1.01,
          tickfont: { color: '#475569', size: 8, family: 'JetBrains Mono, monospace' },
          title: { text: zl, font: { color: '#64748b', size: 9 } },
        },
        contours: { z: { show: true, usecolormap: true, highlightcolor: '#22d3ee', project: { z: true } } },
        opacity: 0.92,
      }],
      {
        paper_bgcolor: 'transparent',
        scene: {
          bgcolor: 'rgba(10,10,20,0)',
          xaxis: { ...axStyle, title: xl },
          yaxis: { ...axStyle, title: yl },
          zaxis: { ...axStyle, title: zl },
          camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
        },
        margin: { l: 0, r: 40, t: 40, b: 0 },
        font: { family: 'JetBrains Mono, monospace', color: '#64748b', size: 9 },
        title: {
          text: title,
          font: { color: '#94a3b8', size: 11, family: 'JetBrains Mono, monospace' },
          x: 0.5, xanchor: 'center',
        },
      },
      { responsive: true, displayModeBar: false },
    )
  }, [robotType])

  const renderConstrained = useCallback((Plotly: any) => {
    if (!divRef.current) return
    setIsComputing(true)
    setTimeout(() => {
      const limRad = limits.map(l => ({
        min: l.min * Math.PI / 180,
        max: l.max * Math.PI / 180,
      }))
      const { x, y, z, frac } = computeConstrainedWorkspace(robotType, limRad, obstacles)
      setReachFrac(frac)

      const zFlat = z.flat()
      const zMax = Math.max(...zFlat.filter(v => v > 0), 0.01)

      const customCS: [number, string][] = [
        [0,    'rgb(127,29,29)'],   // obstacle
        [0.08, 'rgb(10,10,20)'],    // unreachable
        [0.12, 'rgb(6,78,107)'],    // barely reachable
        [0.35, 'rgb(30,64,175)'],   // low
        [0.60, 'rgb(6,182,212)'],   // medium
        [0.80, 'rgb(103,232,249)'], // high
        [1.0,  'rgb(240,249,255)'], // max
      ]

      Plotly.react(
        divRef.current,
        [{
          type: 'surface', x, y, z,
          colorscale: customCS,
          cmin: -0.15, cmax: zMax,
          showscale: true,
          colorbar: {
            thickness: 12, len: 0.65, x: 1.01,
            tickfont: { color: '#475569', size: 8, family: 'JetBrains Mono, monospace' },
            title: { text: 'w', font: { color: '#64748b', size: 9 } },
            tickvals: [-0.15, 0, zMax * 0.5, zMax],
            ticktext: ['Obstacle', '0 (unreachable)', `${(zMax*0.5).toFixed(2)}`, zMax.toFixed(2)],
          },
          contours: { z: { show: true, usecolormap: true, highlightcolor: '#22d3ee', project: { z: true } } },
          opacity: 0.93,
        }],
        {
          paper_bgcolor: 'transparent',
          scene: {
            bgcolor: 'rgba(10,10,20,0)',
            xaxis: { ...axStyle, title: 'X (m)' },
            yaxis: { ...axStyle, title: 'Y (m)' },
            zaxis: { ...axStyle, title: 'Manipulability' },
            camera: { eye: { x: 1.5, y: 1.5, z: 1.3 } },
          },
          margin: { l: 0, r: 40, t: 44, b: 0 },
          font: { family: 'JetBrains Mono, monospace', color: '#64748b', size: 9 },
          title: {
            text: `Constrained Workspace — ${robotType === '2dof' ? '2R' : robotType === '3dof' ? '3R' : 'SCARA'}  |  Reachable: ${frac}%`,
            font: { color: '#94a3b8', size: 10, family: 'JetBrains Mono, monospace' },
            x: 0.5, xanchor: 'center',
          },
        },
        { responsive: true, displayModeBar: false },
      )
      setIsComputing(false)
    }, 20)
  }, [robotType, limits, obstacles])

  useEffect(() => {
    let cancelled = false
    import('plotly.js-dist-min').then(mod => {
      if (cancelled) return
      plotlyRef.current = (mod as any).default ?? mod
      ready.current = true
      if (viewMode === 'manipulability') renderManipulability(plotlyRef.current)
      else renderConstrained(plotlyRef.current)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready.current || !plotlyRef.current) return
    if (viewMode === 'manipulability') renderManipulability(plotlyRef.current)
    else renderConstrained(plotlyRef.current)
  }, [viewMode, robotType, renderManipulability, renderConstrained])

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Mode tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0">
        {(['manipulability', 'constrained'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => setViewMode(m)}
            className={`px-3 py-1 text-[9px] font-mono rounded border transition-all ${
              viewMode === m
                ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
            }`}
          >
            {m === 'manipulability' ? 'MANIPULABILITY (JOINT SPACE)' : 'CONSTRAINED WORKSPACE (TASK SPACE)'}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-3">

        {/* ── Controls sidebar ───────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {viewMode === 'manipulability' ? (
            /* ── Manipulability explanation ─────────────────────────────────── */
            <div className="space-y-3">
              <InfoBox title="What is Manipulability?">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  Yoshikawa (1985) defines manipulability as:
                </p>
                <Formula>w = √det(J·Jᵀ)</Formula>
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed mt-1">
                  For a 2R planar robot this simplifies to:
                </p>
                <Formula>w = |L₁·L₂·sin q₂|</Formula>
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed mt-1">
                  High w → robot can move easily in any direction.
                  w = 0 → singular configuration (stuck).
                </p>
              </InfoBox>

              <InfoBox title="Singularities">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  w = 0 occurs when q₂ = 0° or ±180°.
                  These are the <span className="text-red-400">arm-straight</span> and
                  <span className="text-red-400"> arm-folded</span> configurations.
                  The joint-space plot shows these as dark trenches.
                </p>
              </InfoBox>

              <InfoBox title="Velocity Ellipsoid">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  The surface height = isotropic radius of the velocity ellipsoid
                  at each joint configuration.
                  A tall spike = high dexterity.
                </p>
              </InfoBox>
            </div>
          ) : (
            /* ── Constrained controls ───────────────────────────────────────── */
            <div className="space-y-3">

              <InfoBox title="Joint Limits  (θ_min / θ_max)">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed mb-2">
                  Physical joint stops reduce the reachable workspace.
                  Drag the sliders to see the surface shrink.
                </p>
                {Array.from({ length: nDof }, (_, i) => (
                  <div key={i} className="mb-3">
                    <div className="text-[9px] font-mono text-cyan-500/70 mb-1">
                      q{i+1} &nbsp;
                      <span className="text-slate-400">[{limits[i].min}° , {limits[i].max}°]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-mono text-slate-700 w-6 text-right">{limits[i].min}°</span>
                      <input type="range" min="-180" max="0" step="5"
                        value={limits[i].min}
                        onChange={e => setLimit(i, 'min', +e.target.value)}
                        className="flex-1 accent-cyan-500 h-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] font-mono text-slate-700 w-6 text-right">{limits[i].max}°</span>
                      <input type="range" min="0" max="180" step="5"
                        value={limits[i].max}
                        onChange={e => setLimit(i, 'max', +e.target.value)}
                        className="flex-1 accent-cyan-500 h-1"
                      />
                    </div>
                  </div>
                ))}
              </InfoBox>

              <InfoBox title="Obstacles (Task Space)">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed mb-2">
                  Circular obstacles in task space remove configurations
                  where the EE would collide.
                  Shown as <span className="text-red-400">red depressions</span>.
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.keys(OBSTACLE_PRESETS).map(k => (
                    <button
                      key={k}
                      onClick={() => setObsKey(k)}
                      className={`text-[9px] font-mono py-1 px-2 rounded border transition-all ${
                        obsKey === k
                          ? 'border-orange-500/50 text-orange-400 bg-orange-500/10'
                          : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                {obstacles.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {obstacles.map((o, i) => (
                      <div key={i} className="text-[8px] font-mono text-slate-700">
                        {o.label}: ({o.x}, {o.y}) r={o.r}m
                      </div>
                    ))}
                  </div>
                )}
              </InfoBox>

              <InfoBox title="Configuration Space">
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  The constrained workspace is the <em>image</em> of the
                  admissible joint space under FK:
                </p>
                <Formula>W = FK(Q_admissible \ Q_collision)</Formula>
                <p className="text-[9px] font-mono text-slate-500 leading-relaxed mt-1">
                  Height = manipulability at each reachable point.
                  <br/>
                  <span className="text-red-400">Red</span> = obstacle region.
                  <span className="text-slate-600"> Black</span> = unreachable.
                </p>
              </InfoBox>

              {reachFrac && (
                <div className="rounded border border-slate-800 bg-black/20 px-3 py-2">
                  <div className="text-[8px] font-mono text-slate-600 mb-1">REACHABLE AREA</div>
                  <div className="text-xl font-mono font-bold text-cyan-400">{reachFrac}%</div>
                  <div className="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500/60 rounded-full transition-all duration-500"
                      style={{ width: `${reachFrac}%` }}
                    />
                  </div>
                  <div className="text-[8px] font-mono text-slate-700 mt-1">of total grid cells</div>
                </div>
              )}

              <button
                onClick={() => ready.current && renderConstrained(plotlyRef.current)}
                disabled={isComputing}
                className={`w-full py-2 rounded font-mono font-bold text-[10px] tracking-widest transition-all border ${
                  isComputing
                    ? 'border-cyan-500/20 text-cyan-500/30 cursor-not-allowed'
                    : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
                }`}
              >
                {isComputing ? 'COMPUTING…' : '↻ UPDATE SURFACE'}
              </button>
            </div>
          )}
        </div>

        {/* ── Plotly surface ────────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0 min-h-0">
          {isComputing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0f]/70 backdrop-blur-sm rounded">
              <div className="text-[10px] font-mono text-cyan-500 tracking-widest animate-pulse">
                SAMPLING JOINT SPACE…
              </div>
            </div>
          )}
          <div ref={divRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}

// ── Tiny UI helpers ───────────────────────────────────────────────────────────

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-800/60 bg-black/20 px-3 py-2.5">
      <div className="text-[8px] font-mono tracking-[0.2em] text-slate-600 uppercase mb-2">{title}</div>
      {children}
    </div>
  )
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-1 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/40 text-[10px] font-mono text-cyan-300/80 text-center">
      {children}
    </div>
  )
}
