'use client'

import { useEffect, useRef } from 'react'

export type RobotType = '2dof' | '3dof' | 'scara' | 'delta'

interface Props {
  robotType: RobotType
}

/* ── Surface computation ──────────────────────────────────────────────────── */

function computeSurface(type: RobotType) {
  const N = 55

  if (type === '2dof') {
    const L1 = 1.5, L2 = 1.1
    const x = Array.from({ length: N }, (_, j) => +((-Math.PI + 2 * Math.PI * j / (N - 1)).toFixed(3)))
    const y = Array.from({ length: N }, (_, i) => +((-Math.PI + 2 * Math.PI * i / (N - 1)).toFixed(3)))
    const z = y.map(q2 =>
      x.map(q1 => L1 * L2 * Math.abs(Math.sin(q2)) * (0.85 + 0.15 * Math.sin(q1 + q2)))
    )
    return { x, y, z, colorscale: 'Viridis', title: 'Manipulability Surface — 2-DOF Planar', xl: 'q₁ (rad)', yl: 'q₂ (rad)', zl: 'w' }
  }

  if (type === '3dof') {
    const L1 = 1.2, L2 = 0.9, L3 = 0.6, Q3 = Math.PI / 5
    const x = Array.from({ length: N }, (_, j) => +((-Math.PI + 2 * Math.PI * j / (N - 1)).toFixed(3)))
    const y = Array.from({ length: N }, (_, i) => +((-Math.PI + 2 * Math.PI * i / (N - 1)).toFixed(3)))
    const z = y.map(q2 =>
      x.map(q1 => {
        const w12 = L1 * L2 * Math.abs(Math.sin(q2))
        const w23 = L2 * L3 * Math.abs(Math.sin(Q3))
        const w13 = L1 * L3 * Math.abs(Math.sin(q2 + Q3))
        return Math.sqrt(w12 * w12 + w23 * w23 + w13 * w13) * (0.8 + 0.2 * Math.cos(q1))
      })
    )
    return { x, y, z, colorscale: 'Plasma', title: 'Velocity Ellipsoid — 3-DOF Spatial (q₃=π/5)', xl: 'q₁ (rad)', yl: 'q₂ (rad)', zl: 'w' }
  }

  if (type === 'scara') {
    const L1 = 0.55, L2 = 0.42, lim = (L1 + L2) * 1.05
    const rMin = Math.abs(L1 - L2), rMax = L1 + L2
    const x = Array.from({ length: N }, (_, j) => +(-lim + 2 * lim * j / (N - 1)).toFixed(4))
    const y = Array.from({ length: N }, (_, i) => +(-lim + 2 * lim * i / (N - 1)).toFixed(4))
    const z = y.map(py =>
      x.map(px => {
        const r = Math.sqrt(px * px + py * py)
        if (r < rMin || r > rMax) return 0
        const t = (r - rMin) / (rMax - rMin)
        return 0.5 * (1 - Math.cos(2 * Math.PI * t))
      })
    )
    return { x, y, z, colorscale: 'Cividis', title: 'Reachable Workspace — SCARA', xl: 'X (m)', yl: 'Y (m)', zl: 'Reachability' }
  }

  // delta
  const R = 0.38
  const x = Array.from({ length: N }, (_, j) => +(-R + 2 * R * j / (N - 1)).toFixed(4))
  const y = Array.from({ length: N }, (_, i) => +(-R + 2 * R * i / (N - 1)).toFixed(4))
  const z = y.map(py =>
    x.map(px => {
      const r = Math.sqrt(px * px + py * py)
      if (r >= R) return 0
      const theta = Math.atan2(py, px)
      const sym = 0.7 + 0.3 * Math.cos(3 * theta) ** 2
      const radial = 1 - (r / R) ** 2
      return sym * radial * Math.max(0, 1 - 1.5 * (r / R) ** 4)
    })
  )
  return { x, y, z, colorscale: 'Hot', title: 'Force Isotropy Index — Delta Parallel', xl: 'X (m)', yl: 'Y (m)', zl: 'f_iso' }
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function WorkspaceSurface({ robotType }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const robotTypeRef = useRef(robotType)
  robotTypeRef.current = robotType
  const ready = useRef(false)

  function renderPlot(type: RobotType) {
    if (!plotlyRef.current || !divRef.current) return
    const { x, y, z, colorscale, title, xl, yl, zl } = computeSurface(type)

    const axStyle = {
      color: '#475569',
      gridcolor: '#1e293b',
      zerolinecolor: '#334155',
      tickfont: { color: '#475569', size: 8 },
      titlefont: { color: '#64748b', size: 9 },
    }

    plotlyRef.current.react(
      divRef.current,
      [{
        type: 'surface',
        x, y, z,
        colorscale,
        showscale: false,
        contours: {
          z: { show: true, usecolormap: true, highlightcolor: '#22d3ee', project: { z: true } },
        },
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
        margin: { l: 0, r: 0, t: 40, b: 0 },
        font: { family: 'JetBrains Mono, Fira Code, monospace', color: '#64748b', size: 9 },
        title: {
          text: title,
          font: { color: '#94a3b8', size: 11, family: 'JetBrains Mono, Fira Code, monospace' },
          x: 0.5,
          xanchor: 'center',
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
      renderPlot(robotTypeRef.current)
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready.current) renderPlot(robotType)
  }, [robotType]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <div className="text-[9px] font-mono tracking-widest text-slate-700 mb-1 px-1">
        3D WORKSPACE SURFACE
      </div>
      <div ref={divRef} className="flex-1 min-h-0 w-full" />
    </div>
  )
}
