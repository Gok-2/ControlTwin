'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { type WorkspaceJoint, computeWorkspace3D } from '../lib/workspace'

export type RobotType = '2dof' | '3dof' | 'scara' | 'delta'

interface Props {
  joints: WorkspaceJoint[]
  label?: string
}

type ViewMode = '2d' | '3d' | 'manipulability' | 'constrained'

interface Obstacle { x: number; y: number; r: number; label: string }
interface JointLimit { min: number; max: number }

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

// ── FK helpers ────────────────────────────────────────────────────────────────

function fkPlanar(links: number[], angles: number[]) {
  let cum = 0, x = 0, y = 0
  for (let i = 0; i < links.length; i++) {
    cum += angles[i] ?? 0
    x += links[i] * Math.cos(cum)
    y += links[i] * Math.sin(cum)
  }
  return { x, y }
}

// ── 2D geometric workspace ────────────────────────────────────────────────────

interface WorkspaceResult {
  xs: number[]; ys: number[]
  maxX: number; minX: number; maxY: number; minY: number
  maxR: number; minR: number
}

function computeWorkspace(linkLengths: number[], jointTypes: ('R' | 'P')[]): WorkspaceResult {
  const rLinks = linkLengths.filter((_, i) => (jointTypes[i] ?? 'R') === 'R')
  const n = rLinks.length
  const xs: number[] = [], ys: number[] = []

  if (n === 0) return { xs: [0], ys: [0], maxX: 0, minX: 0, maxY: 0, minY: 0, maxR: 0, minR: 0 }

  if (n === 1) {
    for (let k = 0; k < 180; k++) {
      const q = -Math.PI + 2 * Math.PI * k / 180
      xs.push(rLinks[0] * Math.cos(q)); ys.push(rLinks[0] * Math.sin(q))
    }
  } else if (n === 2) {
    const N = 80
    for (let i = 0; i < N; i++) {
      const q1 = -Math.PI + 2 * Math.PI * i / N
      for (let j = 0; j < N; j++) {
        const q2 = -Math.PI + 2 * Math.PI * j / N
        const p = fkPlanar(rLinks, [q1, q2])
        xs.push(p.x); ys.push(p.y)
      }
    }
  } else if (n === 3) {
    const N = 30
    for (let i = 0; i < N; i++) {
      const q1 = -Math.PI + 2 * Math.PI * i / N
      for (let j = 0; j < N; j++) {
        const q2 = -Math.PI + 2 * Math.PI * j / N
        for (let k = 0; k < N; k++) {
          const q3 = -Math.PI + 2 * Math.PI * k / N
          const p = fkPlanar(rLinks, [q1, q2, q3])
          xs.push(p.x); ys.push(p.y)
        }
      }
    }
  } else {
    for (let k = 0; k < 12000; k++) {
      const angles = rLinks.map(() => (Math.random() - 0.5) * 2 * Math.PI)
      const p = fkPlanar(rLinks, angles)
      xs.push(p.x); ys.push(p.y)
    }
  }

  let maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity, maxR = 0, minR = Infinity
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > maxX) maxX = xs[i]; if (xs[i] < minX) minX = xs[i]
    if (ys[i] > maxY) maxY = ys[i]; if (ys[i] < minY) minY = ys[i]
    const r = Math.hypot(xs[i], ys[i])
    if (r > maxR) maxR = r; if (r < minR) minR = r
  }
  return { xs, ys, maxX, minX, maxY, minY, maxR, minR }
}

// ── 3D manipulability surface (joint space) ───────────────────────────────────

function computeManipulability(rLinks: number[]) {
  const N = 55
  const [L1, L2] = rLinks
  const L3 = rLinks[2] ?? 0
  const x = Array.from({ length: N }, (_, j) => -Math.PI + 2 * Math.PI * j / (N - 1))
  const y = Array.from({ length: N }, (_, i) => -Math.PI + 2 * Math.PI * i / (N - 1))

  if (rLinks.length >= 3) {
    const Q3 = Math.PI / 5
    const z = y.map(q2 => x.map(q1 => {
      const w12 = L1 * L2 * Math.abs(Math.sin(q2))
      const w23 = L2 * L3 * Math.abs(Math.sin(Q3))
      const w13 = L1 * L3 * Math.abs(Math.sin(q2 + Q3))
      return Math.sqrt(w12**2 + w23**2 + w13**2) * (0.8 + 0.2 * Math.cos(q1))
    }))
    return { x, y, z, cs: 'Plasma', xl: 'q₁ (rad)', yl: 'q₂ (rad)', zl: 'w', title: 'Velocity Ellipsoid — 3R  |  q₃=π/5 fixed' }
  }

  const z = y.map(q2 => x.map(q1 => L1 * L2 * Math.abs(Math.sin(q2)) * (0.85 + 0.15 * Math.sin(q1 + q2))))
  return { x, y, z, cs: 'Viridis', xl: 'q₁ (rad)', yl: 'q₂ (rad)', zl: 'w', title: 'Manipulability — 2R  |  w = |L₁L₂ sin q₂|' }
}

// ── 3D constrained workspace (task space) ─────────────────────────────────────

function computeConstrainedWorkspace(
  rLinks: number[],
  limits: JointLimit[],
  obstacles: Obstacle[],
) {
  const totalReach = rLinks.reduce((a, b) => a + b, 0)
  const range = totalReach * 1.1
  const N = 65
  const Nj = rLinks.length >= 3 ? 45 : 130

  const xs = Array.from({ length: N }, (_, i) => -range + 2 * range * i / (N - 1))
  const ys = Array.from({ length: N }, (_, i) => -range + 2 * range * i / (N - 1))
  const z: number[][] = ys.map(() => xs.map(() => 0))
  const toIdx = (v: number) => Math.round((v + range) / (2 * range) * (N - 1))

  const stamp = (x: number, y: number, w: number) => {
    if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.r)) return
    const xi = toIdx(x), yi = toIdx(y)
    if (xi >= 0 && xi < N && yi >= 0 && yi < N) z[yi][xi] = Math.max(z[yi][xi], w)
  }

  const [L1, L2] = rLinks
  if (rLinks.length >= 3) {
    const L3 = rLinks[2]
    for (let i = 0; i <= Nj; i++) {
      const q1 = (limits[0]?.min ?? -Math.PI) + ((limits[0]?.max ?? Math.PI) - (limits[0]?.min ?? -Math.PI)) * i / Nj
      for (let j = 0; j <= Nj; j++) {
        const q2 = (limits[1]?.min ?? -Math.PI) + ((limits[1]?.max ?? Math.PI) - (limits[1]?.min ?? -Math.PI)) * j / Nj
        for (let k = 0; k <= Nj; k++) {
          const q3 = (limits[2]?.min ?? -Math.PI) + ((limits[2]?.max ?? Math.PI) - (limits[2]?.min ?? -Math.PI)) * k / Nj
          const { x, y } = fkPlanar(rLinks, [q1, q2, q3])
          stamp(x, y, Math.abs(L1 * L2 * Math.sin(q2)))
        }
      }
    }
  } else {
    const l0 = limits[0] ?? { min: -Math.PI, max: Math.PI }
    const l1 = limits[1] ?? { min: -Math.PI, max: Math.PI }
    for (let i = 0; i <= Nj; i++) {
      const q1 = l0.min + (l0.max - l0.min) * i / Nj
      for (let j = 0; j <= Nj; j++) {
        const q2 = l1.min + (l1.max - l1.min) * j / Nj
        const { x, y } = fkPlanar([L1, L2], [q1, q2])
        stamp(x, y, Math.abs(L1 * L2 * Math.sin(q2)))
      }
    }
  }

  for (const obs of obstacles) {
    for (let yi = 0; yi < N; yi++)
      for (let xi = 0; xi < N; xi++)
        if (Math.hypot(xs[xi] - obs.x, ys[yi] - obs.y) < obs.r)
          z[yi][xi] = -0.15
  }

  let reachable = 0
  for (const row of z) for (const v of row) if (v > 0) reachable++
  const frac = ((reachable / (N * N)) * 100).toFixed(1)
  return { x: xs, y: ys, z, frac }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkspaceSurface({ joints, label }: Props) {
  const divRef    = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const ready     = useRef(false)
  const wsRef     = useRef<WorkspaceResult | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [obsKey,   setObsKey]   = useState('None')
  const [isComputing, setIsComputing] = useState(false)
  const [reachFrac, setReachFrac] = useState<string | null>(null)

  // Derive planar-compatible arrays from joints (for 2D/manipulability/constrained modes)
  const linkLengths    = joints.map(j => j.length)
  const effectiveTypes = joints.map(j => j.type)
  const rLinks         = linkLengths.filter((_, i) => effectiveTypes[i] === 'R')
  const nDof           = Math.min(rLinks.length, 3)

  // Stable string key for memoisation — avoids prop-reference churn
  const jointsKey = joints.map(j =>
    `${j.type}:${j.length.toFixed(3)}:${j.rotationAxis ?? ''}:${(j.prismaticDir ?? []).join(',')}`
  ).join('|')

  const [limits, setLimits] = useState<JointLimit[]>(Array.from({ length: 3 }, () => ({ min: -180, max: 180 })))
  const setLimit = (i: number, key: 'min' | 'max', deg: number) =>
    setLimits(prev => { const a = [...prev]; a[i] = { ...a[i], [key]: deg }; return a })
  const obstacles = OBSTACLE_PRESETS[obsKey] ?? []

  const workspace = useMemo(
    () => computeWorkspace(linkLengths, effectiveTypes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jointsKey],
  )
  wsRef.current = workspace

  const axStyle = {
    color: '#475569', gridcolor: '#1e293b', zerolinecolor: '#334155',
    tickfont: { color: '#475569', size: 8 },
    titlefont: { color: '#64748b', size: 9 },
  }

  const render2D = useCallback((ws: WorkspaceResult) => {
    if (!plotlyRef.current || !divRef.current) return
    const { xs, ys, maxX, minX, maxY, minY, maxR, minR } = ws
    const rMax = maxR > 0.01 ? maxR : 1
    const rMin = minR < rMax - 0.05 ? minR : 0
    const circN = 240
    const circle = (r: number) => ({
      x: Array.from({ length: circN + 1 }, (_, k) => r * Math.cos(k * 2 * Math.PI / circN)),
      y: Array.from({ length: circN + 1 }, (_, k) => r * Math.sin(k * 2 * Math.PI / circN)),
    })
    const traces: object[] = [
      { type: 'scattergl', x: xs, y: ys, mode: 'markers',
        marker: { size: 2, color: 'rgba(34,211,238,0.22)' },
        name: 'Reachable positions', hovertemplate: 'x: %{x:.2f}m<br>y: %{y:.2f}m<extra></extra>' },
      { ...circle(rMax), type: 'scatter', mode: 'lines',
        line: { color: 'rgba(239,68,68,0.75)', width: 1.5, dash: 'dash' },
        name: `Max reach ${rMax.toFixed(2)} m`, hoverinfo: 'skip' },
      ...(rMin > 0.05 ? [{ ...circle(rMin), type: 'scatter', mode: 'lines',
        line: { color: 'rgba(249,115,22,0.75)', width: 1.5, dash: 'dot' },
        name: `Min reach ${rMin.toFixed(2)} m`, hoverinfo: 'skip' }] : []),
      { type: 'scatter', x: [maxX, minX, 0, 0], y: [0, 0, maxY, minY],
        mode: 'markers+text', marker: { size: 8, color: '#f59e0b', symbol: 'diamond', line: { color: '#fff', width: 1 } },
        text: [`Xmax ${maxX.toFixed(2)}m`, `Xmin ${minX.toFixed(2)}m`, `Ymax ${maxY.toFixed(2)}m`, `Ymin ${minY.toFixed(2)}m`],
        textposition: ['top right', 'top left', 'top right', 'bottom right'],
        textfont: { color: '#f59e0b', size: 8, family: 'JetBrains Mono,monospace' },
        name: 'Boundary extremes', hovertemplate: '%{text}<extra></extra>' },
    ]
    const pad = rMax * 0.18; const axRange = [-(rMax + pad), rMax + pad]
    plotlyRef.current.react(divRef.current, traces, {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      xaxis: { ...axStyle, title: 'X (m)', range: axRange, scaleanchor: 'y', scaleratio: 1 },
      yaxis: { ...axStyle, title: 'Y (m)', range: axRange },
      legend: { font: { color: '#64748b', size: 8, family: 'JetBrains Mono,monospace' }, bgcolor: 'rgba(13,17,23,0.75)', bordercolor: '#1e293b', borderwidth: 1, x: 0.01, y: 0.99, xanchor: 'left', yanchor: 'top' },
      margin: { l: 52, r: 16, t: 40, b: 50 },
      font: { family: 'JetBrains Mono,monospace', color: '#64748b', size: 9 },
      title: { text: `Geometric Workspace — ${label ?? 'Reachable EE Positions'}`, font: { color: '#94a3b8', size: 11, family: 'JetBrains Mono,monospace' }, x: 0.5, xanchor: 'center' },
    }, { responsive: true, displayModeBar: false })
  }, [label, workspace]) // eslint-disable-line react-hooks/exhaustive-deps

  const render3DTaskspace = useCallback(() => {
    if (!plotlyRef.current || !divRef.current) return
    setIsComputing(true)
    setTimeout(() => {
      const { xs, ys, zs } = computeWorkspace3D(joints)
      const r = xs.map((x, i) => Math.hypot(x, ys[i], zs[i]))
      const rMax = Math.max(...r, 0.01)
      plotlyRef.current.react(
        divRef.current,
        [{
          type: 'scatter3d', x: xs, y: ys, z: zs, mode: 'markers',
          marker: {
            size: 1.5, color: r, colorscale: 'Viridis', opacity: 0.55,
            showscale: true, cmin: 0, cmax: rMax,
            colorbar: {
              thickness: 12, len: 0.7, x: 1.01,
              tickfont: { color: '#475569', size: 8, family: 'JetBrains Mono, monospace' },
              title: { text: '|r| m', font: { color: '#64748b', size: 9 } },
            },
          },
          hovertemplate: 'x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>',
          name: 'Reachable EE',
        }],
        {
          paper_bgcolor: 'transparent',
          scene: {
            bgcolor: 'rgba(10,10,20,0)',
            xaxis: { ...axStyle, title: 'X (m)' },
            yaxis: { ...axStyle, title: 'Y (m)' },
            zaxis: { ...axStyle, title: 'Z (m)' },
            camera: { eye: { x: 1.5, y: 1.2, z: 1.0 } },
            aspectmode: 'data',
          },
          margin: { l: 0, r: 40, t: 44, b: 0 },
          font: { family: 'JetBrains Mono, monospace', color: '#64748b', size: 9 },
          title: {
            text: `3D Taskspace — ${label ?? 'EE Reachable Cloud'}`,
            font: { color: '#94a3b8', size: 10, family: 'JetBrains Mono, monospace' },
            x: 0.5, xanchor: 'center',
          },
        },
        { responsive: true, displayModeBar: false },
      )
      setIsComputing(false)
    }, 20)
  }, [jointsKey, label]) // eslint-disable-line react-hooks/exhaustive-deps

  const render3DManip = useCallback(() => {
    if (!plotlyRef.current || !divRef.current || rLinks.length < 2) return
    const { x, y, z, cs, xl, yl, zl, title } = computeManipulability(rLinks)
    plotlyRef.current.react(divRef.current,
      [{ type: 'surface', x, y, z, colorscale: cs, showscale: true,
         colorbar: { thickness: 12, len: 0.7, x: 1.01, tickfont: { color: '#475569', size: 8, family: 'JetBrains Mono, monospace' }, title: { text: zl, font: { color: '#64748b', size: 9 } } },
         contours: { z: { show: true, usecolormap: true, highlightcolor: '#22d3ee', project: { z: true } } }, opacity: 0.92 }],
      { paper_bgcolor: 'transparent',
        scene: { bgcolor: 'rgba(10,10,20,0)', xaxis: { ...axStyle, title: xl }, yaxis: { ...axStyle, title: yl }, zaxis: { ...axStyle, title: zl }, camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } } },
        margin: { l: 0, r: 40, t: 44, b: 0 },
        font: { family: 'JetBrains Mono, monospace', color: '#64748b', size: 9 },
        title: { text: title, font: { color: '#94a3b8', size: 10, family: 'JetBrains Mono, monospace' }, x: 0.5, xanchor: 'center' } },
      { responsive: true, displayModeBar: false })
  }, [rLinks.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const render3DConstrained = useCallback(() => {
    if (!plotlyRef.current || !divRef.current || rLinks.length < 2) return
    setIsComputing(true)
    setTimeout(() => {
      const limRad = limits.map(l => ({ min: l.min * Math.PI / 180, max: l.max * Math.PI / 180 }))
      const { x, y, z, frac } = computeConstrainedWorkspace(rLinks, limRad, obstacles)
      setReachFrac(frac)
      const zFlat = z.flat(); const zMax = Math.max(...zFlat.filter(v => v > 0), 0.01)
      const customCS: [number, string][] = [
        [0, 'rgb(127,29,29)'], [0.08, 'rgb(10,10,20)'], [0.12, 'rgb(6,78,107)'],
        [0.35, 'rgb(30,64,175)'], [0.60, 'rgb(6,182,212)'], [0.80, 'rgb(103,232,249)'], [1.0, 'rgb(240,249,255)'],
      ]
      plotlyRef.current.react(divRef.current,
        [{ type: 'surface', x, y, z, colorscale: customCS, cmin: -0.15, cmax: zMax, showscale: true,
           colorbar: { thickness: 12, len: 0.65, x: 1.01, tickfont: { color: '#475569', size: 8, family: 'JetBrains Mono, monospace' }, title: { text: 'w', font: { color: '#64748b', size: 9 } }, tickvals: [-0.15, 0, zMax*0.5, zMax], ticktext: ['Obstacle', '0', `${(zMax*0.5).toFixed(2)}`, zMax.toFixed(2)] },
           contours: { z: { show: true, usecolormap: true, highlightcolor: '#22d3ee', project: { z: true } } }, opacity: 0.93 }],
        { paper_bgcolor: 'transparent',
          scene: { bgcolor: 'rgba(10,10,20,0)', xaxis: { ...axStyle, title: 'X (m)' }, yaxis: { ...axStyle, title: 'Y (m)' }, zaxis: { ...axStyle, title: 'Manipulability' }, camera: { eye: { x: 1.5, y: 1.5, z: 1.3 } } },
          margin: { l: 0, r: 40, t: 44, b: 0 },
          font: { family: 'JetBrains Mono, monospace', color: '#64748b', size: 9 },
          title: { text: `Constrained Workspace — Reachable: ${frac}%`, font: { color: '#94a3b8', size: 10, family: 'JetBrains Mono, monospace' }, x: 0.5, xanchor: 'center' } },
        { responsive: true, displayModeBar: false })
      setIsComputing(false)
    }, 20)
  }, [rLinks.join(','), limits, obstacles]) // eslint-disable-line react-hooks/exhaustive-deps

  const triggerRender = useCallback(() => {
    if (!ready.current || !plotlyRef.current) return
    if (viewMode === '2d' && wsRef.current) render2D(wsRef.current)
    else if (viewMode === '3d')              render3DTaskspace()
    else if (viewMode === 'manipulability') render3DManip()
    else                                    render3DConstrained()
  }, [viewMode, render2D, render3DTaskspace, render3DManip, render3DConstrained])

  useEffect(() => {
    let cancelled = false
    import('plotly.js-dist-min').then(mod => {
      if (cancelled) return
      plotlyRef.current = (mod as any).default ?? mod
      ready.current = true
      triggerRender()
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    triggerRender()
  }, [triggerRender])

  return (
    <div className="flex flex-col h-full gap-2">

      {/* Mode tabs */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        {([
          ['2d',             '2D GEOMETRIC'],
          ['3d',             '3D TASKSPACE'],
          ['manipulability', '3D MANIPULABILITY'],
          ['constrained',    '3D CONSTRAINED'],
        ] as [ViewMode, string][]).map(([m, lbl]) => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`px-2.5 py-1 text-[8px] font-mono rounded border transition-all ${
              viewMode === m
                ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
            }`}
          >{lbl}</button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-3">

        {/* ── Constrained controls (only for constrained view) ────────────── */}
        {viewMode === 'constrained' && (
          <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto text-[9px] font-mono">

            <div className="rounded border border-slate-800/60 bg-black/20 px-3 py-2">
              <div className="text-[8px] tracking-[0.2em] text-slate-600 uppercase mb-2">Joint Limits (deg)</div>
              {Array.from({ length: nDof }, (_, i) => (
                <div key={i} className="mb-2">
                  <div className="text-cyan-500/70 mb-0.5">q{i+1} [{limits[i].min}°, {limits[i].max}°]</div>
                  <input type="range" min="-180" max="0" step="5" value={limits[i].min}
                    onChange={e => setLimit(i, 'min', +e.target.value)}
                    className="w-full accent-cyan-500 h-1 block mb-0.5" />
                  <input type="range" min="0" max="180" step="5" value={limits[i].max}
                    onChange={e => setLimit(i, 'max', +e.target.value)}
                    className="w-full accent-cyan-500 h-1 block" />
                </div>
              ))}
            </div>

            <div className="rounded border border-slate-800/60 bg-black/20 px-3 py-2">
              <div className="text-[8px] tracking-[0.2em] text-slate-600 uppercase mb-2">Obstacles</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.keys(OBSTACLE_PRESETS).map(k => (
                  <button key={k} onClick={() => setObsKey(k)}
                    className={`text-[8px] py-0.5 px-1.5 rounded border transition-all ${
                      obsKey === k ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                    }`}>{k}</button>
                ))}
              </div>
            </div>

            {reachFrac && (
              <div className="rounded border border-slate-800 bg-black/20 px-3 py-2">
                <div className="text-[8px] text-slate-600 mb-1">REACHABLE AREA</div>
                <div className="text-lg font-bold text-cyan-400">{reachFrac}%</div>
                <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${reachFrac}%` }} />
                </div>
              </div>
            )}

            <button onClick={() => ready.current && render3DConstrained()} disabled={isComputing}
              className={`w-full py-1.5 rounded font-bold text-[8px] tracking-widest border transition-all ${
                isComputing ? 'border-cyan-500/20 text-cyan-500/30 cursor-not-allowed' : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
              }`}>
              {isComputing ? 'COMPUTING…' : '↻ UPDATE'}
            </button>

            {/* Formulas */}
            <div className="rounded border border-slate-800/60 bg-black/20 px-3 py-2 space-y-1.5">
              <div className="text-[8px] tracking-[0.2em] text-slate-600 uppercase">How It Works</div>
              <div className="text-[8px] text-slate-600 leading-relaxed">
                Sample (q₁,q₂) ∈ Q_limit<br/>
                Apply FK → (x, y)<br/>
                Exclude obstacle zones<br/>
                Color = manipulability w
              </div>
              <div className="mt-1 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/40 text-[9px] text-cyan-300/80 text-center">
                w = |L₁L₂ sin q₂|
              </div>
              <div className="text-[8px] text-slate-700 mt-1">
                Red = obstacle &nbsp;|&nbsp; Black = unreachable
              </div>
            </div>
          </div>
        )}

        {/* ── 3D Taskspace info panel ──────────────────────────────────────── */}
        {viewMode === '3d' && (
          <div className="w-44 shrink-0 flex flex-col gap-2 text-[9px] font-mono">
            <div className="rounded border border-slate-800/60 bg-black/20 px-3 py-2 space-y-1.5">
              <div className="text-[8px] tracking-[0.2em] text-slate-600 uppercase">How It Works</div>
              <div className="text-[8px] text-slate-600 leading-relaxed">
                Sample all joint configs<br/>
                Apply 3D FK (pure math)<br/>
                Plot EE positions<br/>
                Color = reach distance
              </div>
              <div className="mt-1 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/40 text-[9px] text-cyan-300/80 text-center">
                p_ee = T₀ⁿ · [0,0,0,1]ᵀ
              </div>
              <div className="text-[8px] text-slate-600 mt-1">
                {joints.length <= 3
                  ? `Grid: ${joints.length === 1 ? 180 : joints.length === 2 ? '40²=1.6k' : '25³=15.6k'} pts`
                  : `Monte Carlo: ${joints.length <= 4 ? '20k' : '30k'} pts`
                }
              </div>
            </div>
            <button onClick={() => ready.current && render3DTaskspace()} disabled={isComputing}
              className={`w-full py-1.5 rounded font-bold text-[8px] tracking-widest border transition-all ${
                isComputing ? 'border-cyan-500/20 text-cyan-500/30 cursor-not-allowed' : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
              }`}>
              {isComputing ? 'COMPUTING…' : '↻ RECOMPUTE'}
            </button>
          </div>
        )}

        {/* ── Plotly surface ───────────────────────────────────────────────── */}
        <div className="relative flex-1 min-w-0 min-h-0">
          {isComputing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0f]/70 backdrop-blur-sm rounded">
              <div className="text-[10px] font-mono text-cyan-500 tracking-widest animate-pulse">SAMPLING JOINT SPACE…</div>
            </div>
          )}
          <div ref={divRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}
