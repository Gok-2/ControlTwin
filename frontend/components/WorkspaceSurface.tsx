'use client'

import { useEffect, useRef, useMemo } from 'react'

export type RobotType = '2dof' | '3dof' | 'scara' | 'delta'

interface Props {
  linkLengths: number[]
  jointTypes?: ('R' | 'P')[]
  label?: string
}

/* ── Planar FK ────────────────────────────────────────────────────────────── */

function fkPlanar(rLinks: number[], angles: number[]) {
  let cum = 0, x = 0, y = 0
  for (let i = 0; i < rLinks.length; i++) {
    cum += angles[i] ?? 0
    x += rLinks[i] * Math.cos(cum)
    y += rLinks[i] * Math.sin(cum)
  }
  return { x, y }
}

/* ── Workspace sampling ───────────────────────────────────────────────────── */

interface WorkspaceResult {
  xs: number[]
  ys: number[]
  maxX: number; minX: number
  maxY: number; minY: number
  maxR: number; minR: number
}

function computeWorkspace(linkLengths: number[], jointTypes: ('R' | 'P')[]): WorkspaceResult {
  const rLinks = linkLengths.filter((_, i) => (jointTypes[i] ?? 'R') === 'R')
  const n = rLinks.length

  const xs: number[] = []
  const ys: number[] = []

  if (n === 0) return { xs: [0], ys: [0], maxX: 0, minX: 0, maxY: 0, minY: 0, maxR: 0, minR: 0 }

  if (n === 1) {
    for (let k = 0; k < 180; k++) {
      const q = -Math.PI + 2 * Math.PI * k / 180
      xs.push(rLinks[0] * Math.cos(q))
      ys.push(rLinks[0] * Math.sin(q))
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
    // Monte Carlo for 4+ R joints
    for (let k = 0; k < 12000; k++) {
      const angles = rLinks.map(() => (Math.random() - 0.5) * 2 * Math.PI)
      const p = fkPlanar(rLinks, angles)
      xs.push(p.x); ys.push(p.y)
    }
  }

  let maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity
  let maxR = 0, minR = Infinity
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > maxX) maxX = xs[i]
    if (xs[i] < minX) minX = xs[i]
    if (ys[i] > maxY) maxY = ys[i]
    if (ys[i] < minY) minY = ys[i]
    const r = Math.hypot(xs[i], ys[i])
    if (r > maxR) maxR = r
    if (r < minR) minR = r
  }

  return { xs, ys, maxX, minX, maxY, minY, maxR, minR }
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function WorkspaceSurface({ linkLengths, jointTypes = [], label }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const ready = useRef(false)
  const wsRef = useRef<WorkspaceResult | null>(null)

  const effectiveTypes: ('R' | 'P')[] = linkLengths.map((_, i) => jointTypes[i] ?? 'R')

  const workspace = useMemo(
    () => computeWorkspace(linkLengths, effectiveTypes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linkLengths.join(','), effectiveTypes.join(',')],
  )
  wsRef.current = workspace

  function renderPlot(ws: WorkspaceResult) {
    if (!plotlyRef.current || !divRef.current) return
    const { xs, ys, maxX, minX, maxY, minY, maxR, minR } = ws

    const rMax = maxR > 0.01 ? maxR : 1
    const rMin = minR < rMax - 0.05 ? minR : 0
    const circN = 240
    const circle = (r: number) => ({
      x: Array.from({ length: circN + 1 }, (_, k) => r * Math.cos(k * 2 * Math.PI / circN)),
      y: Array.from({ length: circN + 1 }, (_, k) => r * Math.sin(k * 2 * Math.PI / circN)),
    })

    const axStyle = {
      color: '#475569',
      gridcolor: '#1e293b',
      zerolinecolor: '#334155',
      zerolinewidth: 1.5,
      zeroline: true,
      tickfont: { color: '#475569', size: 8 },
      titlefont: { color: '#64748b', size: 9 },
    }

    const traces: object[] = [
      {
        type: 'scattergl',
        x: xs,
        y: ys,
        mode: 'markers',
        marker: { size: 2, color: 'rgba(34,211,238,0.22)' },
        name: 'Reachable positions',
        hovertemplate: 'x: %{x:.2f}m<br>y: %{y:.2f}m<extra></extra>',
      },
      // Max reach boundary
      {
        ...circle(rMax),
        type: 'scatter',
        mode: 'lines',
        line: { color: 'rgba(239,68,68,0.75)', width: 1.5, dash: 'dash' },
        name: `Max reach ${rMax.toFixed(2)} m`,
        hoverinfo: 'skip',
      },
      // Min reach boundary (only if meaningful)
      ...(rMin > 0.05 ? [{
        ...circle(rMin),
        type: 'scatter',
        mode: 'lines',
        line: { color: 'rgba(249,115,22,0.75)', width: 1.5, dash: 'dot' },
        name: `Min reach ${rMin.toFixed(2)} m`,
        hoverinfo: 'skip',
      }] : []),
      // Extreme markers
      {
        type: 'scatter',
        x: [maxX, minX, 0, 0],
        y: [0, 0, maxY, minY],
        mode: 'markers+text',
        marker: { size: 8, color: '#f59e0b', symbol: 'diamond', line: { color: '#fff', width: 1 } },
        text: [
          `Xmax ${maxX.toFixed(2)} m`,
          `Xmin ${minX.toFixed(2)} m`,
          `Ymax ${maxY.toFixed(2)} m`,
          `Ymin ${minY.toFixed(2)} m`,
        ],
        textposition: ['top right', 'top left', 'top right', 'bottom right'],
        textfont: { color: '#f59e0b', size: 8, family: 'JetBrains Mono,monospace' },
        name: 'Boundary extremes',
        hovertemplate: '%{text}<extra></extra>',
      },
    ]

    const pad = rMax * 0.18
    const axRange = [-(rMax + pad), rMax + pad]

    plotlyRef.current.react(
      divRef.current,
      traces,
      {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: { ...axStyle, title: 'X (m)', range: axRange, scaleanchor: 'y', scaleratio: 1 },
        yaxis: { ...axStyle, title: 'Y (m)', range: axRange },
        legend: {
          font: { color: '#64748b', size: 8, family: 'JetBrains Mono,monospace' },
          bgcolor: 'rgba(13,17,23,0.75)',
          bordercolor: '#1e293b',
          borderwidth: 1,
          x: 0.01, y: 0.99,
          xanchor: 'left', yanchor: 'top',
        },
        margin: { l: 52, r: 16, t: 40, b: 50 },
        font: { family: 'JetBrains Mono,monospace', color: '#64748b', size: 9 },
        title: {
          text: `Geometric Workspace — ${label ?? 'Reachable EE Positions'}`,
          font: { color: '#94a3b8', size: 11, family: 'JetBrains Mono,monospace' },
          x: 0.5, xanchor: 'center',
        },
      },
      { responsive: true, displayModeBar: false },
    )
  }

  useEffect(() => {
    let cancelled = false
    import('plotly.js-dist-min').then((mod) => {
      if (cancelled) return
      plotlyRef.current = (mod as any).default ?? mod
      ready.current = true
      if (wsRef.current) renderPlot(wsRef.current)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready.current && wsRef.current) renderPlot(wsRef.current)
  }, [workspace]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <div className="text-[9px] font-mono tracking-widest text-slate-700 mb-1 px-1">
        GEOMETRIC WORKSPACE — REACHABLE END-EFFECTOR POSITIONS
      </div>
      <div ref={divRef} className="flex-1 min-h-0 w-full" />
    </div>
  )
}
