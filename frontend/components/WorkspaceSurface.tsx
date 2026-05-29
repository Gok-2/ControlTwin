'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { type WorkspaceJoint, computeWorkspace3D } from '../lib/workspace'

interface Props {
  joints: WorkspaceJoint[]
  label?: string
}

type ViewMode = '2d' | '3d'

// ── Planar 2D FK ──────────────────────────────────────────────────────────────

function fk2D(links: number[], angles: number[]): [number, number][] {
  const pts: [number, number][] = [[0, 0]]
  let cum = 0, x = 0, y = 0
  for (let i = 0; i < links.length; i++) {
    cum += angles[i] ?? 0
    x   += links[i] * Math.cos(cum)
    y   += links[i] * Math.sin(cum)
    pts.push([x, y])
  }
  return pts
}

// ── Workspace statistics ──────────────────────────────────────────────────────

interface WorkspaceStats {
  rMax:    number
  rMin:    number
  area2D:  number        // annular projected area [m²]
  vol3D:   number | null // only for robots with P joint [m³]
  pStroke: number
}

function computeStats(rLinks: number[], joints: WorkspaceJoint[]): WorkspaceStats | null {
  const N = rLinks.length
  if (N === 0) return null
  const rMax    = rLinks.reduce((a, b) => a + b, 0)
  const rMin    = N <= 1 ? 0
                : N === 2 ? Math.abs(rLinks[0] - rLinks[1])
                : Math.max(0, rLinks[0] - rLinks.slice(1).reduce((a, b) => a + b, 0))
  const area2D  = Math.PI * (rMax * rMax - rMin * rMin)
  const pStroke = joints.filter(j => j.type === 'P').reduce((a, j) => a + j.length, 0)
  const vol3D   = pStroke > 0 ? area2D * pStroke : null
  return { rMax, rMin, area2D, vol3D, pStroke }
}

// ── Workspace density grid ────────────────────────────────────────────────────

interface DensityGrid {
  data:  Uint16Array
  size:  number
  maxR:  number
  range: number
}

function computeWorkspaceDensity(rLinks: number[], size = 100): DensityGrid {
  const N = rLinks.length
  const data = new Uint16Array(size * size)
  if (N === 0) return { data, size, maxR: 1, range: 1.04 }

  const maxR  = rLinks.reduce((a, b) => a + b, 0)
  const range = maxR * 1.04

  const toCell = (v: number) =>
    Math.min(size - 1, Math.max(0, Math.floor((v + range) / (2 * range) * size)))

  const mark = (ex: number, ey: number) => {
    const xi = toCell(ex), yi = toCell(ey)
    if (data[yi * size + xi] < 65535) data[yi * size + xi]++
  }

  if (N === 1) {
    for (let k = 0; k < 360; k++) {
      const q = 2 * Math.PI * k / 360
      mark(rLinks[0] * Math.cos(q), rLinks[0] * Math.sin(q))
    }
  } else if (N === 2) {
    const M = 80
    for (let i = 0; i < M; i++)
      for (let j = 0; j < M; j++) {
        const pts = fk2D(rLinks, [
          -Math.PI + 2 * Math.PI * i / (M - 1),
          -Math.PI + 2 * Math.PI * j / (M - 1),
        ])
        const [ex, ey] = pts[pts.length - 1]
        mark(ex, ey)
      }
  } else if (N === 3) {
    const M = 22
    for (let i = 0; i < M; i++)
      for (let j = 0; j < M; j++)
        for (let k = 0; k < M; k++) {
          const pts = fk2D(rLinks, [
            -Math.PI + 2 * Math.PI * i / (M - 1),
            -Math.PI + 2 * Math.PI * j / (M - 1),
            -Math.PI + 2 * Math.PI * k / (M - 1),
          ])
          const [ex, ey] = pts[pts.length - 1]
          mark(ex, ey)
        }
  } else {
    let s = rLinks.reduce((a, b, i) => a + Math.round(b * (i + 1) * 997), 0) | 0
    const rand = () => { s = (s * 1664525 + 1013904223) & 0x7FFFFFFF; return s / 0x7FFFFFFF }
    for (let k = 0; k < 10000; k++) {
      const angles = rLinks.map(() => (rand() - 0.5) * 2 * Math.PI)
      const pts = fk2D(rLinks, angles)
      const [ex, ey] = pts[pts.length - 1]
      mark(ex, ey)
    }
  }

  return { data, size, maxR, range }
}

// ── Render density bitmap ─────────────────────────────────────────────────────

function renderDensityMap(
  ctx:     CanvasRenderingContext2D,
  density: DensityGrid,
  cx:      number,
  cy:      number,
  sc:      number,
) {
  const { data, size, range } = density
  let maxCount = 0
  for (let i = 0; i < data.length; i++) if (data[i] > maxCount) maxCount = data[i]
  if (maxCount === 0) return

  const oc   = document.createElement('canvas')
  oc.width   = size
  oc.height  = size
  const octx = oc.getContext('2d')!
  const img  = octx.createImageData(size, size)
  const px   = img.data

  for (let yi = 0; yi < size; yi++) {
    for (let xi = 0; xi < size; xi++) {
      const c = data[yi * size + xi]
      if (c === 0) continue
      const alpha = Math.round(Math.pow(c / maxCount, 0.40) * 175)
      const ii    = ((size - 1 - yi) * size + xi) * 4
      px[ii]     = 160
      px[ii + 1] = 205
      px[ii + 2] = 235
      px[ii + 3] = alpha
    }
  }
  octx.putImageData(img, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(oc, cx - range * sc, cy - range * sc, 2 * range * sc, 2 * range * sc)
  ctx.imageSmoothingEnabled = true
}

// ── Canvas 2D full draw ───────────────────────────────────────────────────────

const DISPLAY_POSE = [Math.PI / 4, -Math.PI / 3, Math.PI / 5, -Math.PI / 4]

function drawWS(
  ctx:     CanvasRenderingContext2D,
  W:       number,
  H:       number,
  rLinks:  number[],
  density: DensityGrid,
  stats:   WorkspaceStats | null,
) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#080810'
  ctx.fillRect(0, 0, W, H)

  const n = rLinks.length
  if (n === 0) return

  const { maxR, range } = density
  const sc = Math.min(W, H) * 0.42 / maxR
  const cx = W / 2
  const cy = H * 0.53

  const tx = (x: number) => cx + x * sc
  const ty = (y: number) => cy - y * sc

  // Subtle crosshair
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.055)'
  ctx.lineWidth   = 0.5
  ctx.setLineDash([6, 14])
  ctx.beginPath(); ctx.moveTo(0, cy);  ctx.lineTo(W, cy);  ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Density fill
  renderDensityMap(ctx, density, cx, cy, sc)

  // Outer boundary circle
  ctx.beginPath()
  ctx.arc(cx, cy, maxR * sc, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.52)'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  // Inner dead-zone boundary
  const minR = n === 1 ? maxR
             : n === 2 ? Math.abs(rLinks[0] - rLinks[1])
             : Math.max(0, rLinks[0] - rLinks.slice(1).reduce((a, b) => a + b, 0))
  if (minR > maxR * 0.04) {
    ctx.beginPath()
    ctx.arc(cx, cy, minR * sc, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth   = 1
    ctx.stroke()
  }

  // Origin dot
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.70)'
  ctx.fill()

  // Robot arm at display pose
  const pts = fk2D(rLinks, DISPLAY_POSE)

  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    ctx.beginPath()
    ctx.moveTo(tx(pts[i][0]), ty(pts[i][1]))
    ctx.lineTo(tx(pts[i + 1][0]), ty(pts[i + 1][1]))
    ctx.strokeStyle = 'rgba(255,255,255,0.90)'
    ctx.lineWidth   = 2.8
    ctx.stroke()
  }

  // Joints + θ annotations
  let cumA = 0
  for (let i = 0; i <= n; i++) {
    const px   = tx(pts[i][0])
    const py   = ty(pts[i][1])
    const isEE = i === n
    const jR   = isEE ? 5 : i === 0 ? 8 : 6

    ctx.beginPath()
    ctx.arc(px, py, jR, 0, Math.PI * 2)
    ctx.fillStyle = isEE ? '#22d3ee' : '#ffffff'
    ctx.fill()

    if (!isEE) {
      const q    = DISPLAY_POSE[i] ?? 0
      const arcR = 15 + i * 5

      if (i < 4) {
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + arcR * 1.6 * Math.cos(cumA), py - arcR * 1.6 * Math.sin(cumA))
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth   = 0.8
        ctx.setLineDash([3, 5])
        ctx.stroke()
        ctx.restore()

        ctx.beginPath()
        ctx.arc(px, py, arcR, -cumA, -(cumA + q), q > 0)
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
        ctx.lineWidth   = 1.2
        ctx.stroke()

        const midA = cumA + q * 0.5
        const lx   = px + (arcR + 14) * Math.cos(midA)
        const ly   = py - (arcR + 14) * Math.sin(midA)
        ctx.font         = 'italic 12px Georgia, serif'
        ctx.fillStyle    = 'rgba(255,255,255,0.82)'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`θ${i + 1}`, lx, ly)
      }

      cumA += q
    }
  }

  // ── Labels (bottom) ───────────────────────────────────────────────────────
  ctx.font         = '9px JetBrains Mono, monospace'
  ctx.textBaseline = 'alphabetic'
  const rows = Math.min(n, 4)
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = 'rgba(200,215,230,0.45)'
    ctx.textAlign = 'left'
    ctx.fillText(`θ${i + 1} ∈ [−180°, 180°]`, 10, H - 12 - (rows - 1 - i) * 16)
  }

  // Right side: R_max, R_min, Area
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(130,150,180,0.55)'
  ctx.fillText(`R_max = ${maxR.toFixed(3)} m`, W - 10, H - 12)
  if (minR > maxR * 0.04) {
    ctx.fillText(`R_min = ${minR.toFixed(3)} m`, W - 10, H - 28)
  }
  if (stats) {
    const areaRow = minR > maxR * 0.04 ? H - 44 : H - 28
    ctx.fillStyle = 'rgba(167,139,250,0.70)'
    ctx.fillText(`A = π(R²max−R²min) = ${stats.area2D.toFixed(3)} m²`, W - 10, areaRow)
    if (stats.vol3D !== null) {
      ctx.fillStyle = 'rgba(52,211,153,0.70)'
      ctx.fillText(`V = A × d = ${stats.vol3D.toFixed(3)} m³`, W - 10, areaRow - 16)
    }
  }
  ctx.textAlign = 'left'
}

// ── Stats chip ────────────────────────────────────────────────────────────────

function StatsChip({
  label, value, accent,
}: { label: string; value: string; accent: 'cyan' | 'slate' | 'violet' | 'emerald' }) {
  const border = {
    cyan:    'border-cyan-500/35',
    slate:   'border-slate-500/35',
    violet:  'border-violet-500/35',
    emerald: 'border-emerald-500/35',
  }[accent]
  const valColor = {
    cyan:    'text-cyan-300',
    slate:   'text-slate-200',
    violet:  'text-violet-300',
    emerald: 'text-emerald-300',
  }[accent]
  return (
    <div className={`flex flex-col px-3 py-1.5 rounded border ${border} bg-black/25`}>
      <span className="text-[9px] font-mono text-slate-400 leading-tight whitespace-nowrap">{label}</span>
      <span className={`text-[13px] font-mono font-bold leading-tight whitespace-nowrap ${valColor}`}>{value}</span>
    </div>
  )
}

// ── 3D boundary ring helper ────────────────────────────────────────────────────

function makeRingXZ(r: number, n = 120) {
  const ts = Array.from({ length: n + 1 }, (_, i) => 2 * Math.PI * i / n)
  return {
    x: ts.map(t =>  r * Math.cos(t)),
    y: ts.map(() => 0),
    z: ts.map(t => -r * Math.sin(t)),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkspaceSurface({ joints, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const plot3dRef = useRef<HTMLDivElement>(null)
  const plotlyLib = useRef<any>(null)

  const [viewMode,    setViewMode]    = useState<ViewMode>('2d')
  const [isComputing, setIsComputing] = useState(false)

  const jointsKey = joints.map(j =>
    `${j.type}:${j.length.toFixed(3)}:${j.rotationAxis ?? ''}:${(j.prismaticDir ?? []).join(',')}`
  ).join('|')

  const rLinks = useMemo(
    () => joints.filter(j => j.type === 'R').map(j => j.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jointsKey],
  )

  const workspaceStats = useMemo(
    () => computeStats(rLinks, joints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jointsKey],
  )

  const density = useMemo(
    () => computeWorkspaceDensity(rLinks, 100),
    [rLinks],
  )

  // ── 2D canvas ─────────────────────────────────────────────────────────────

  const redraw2D = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.clientWidth, H = canvas.clientHeight
    if (W <= 0 || H <= 0) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawWS(ctx, W, H, rLinks, density, workspaceStats)
  }, [density, workspaceStats]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode !== '2d') return
    redraw2D()
    const ro = new ResizeObserver(redraw2D)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [viewMode, redraw2D])

  // ── 3D Plotly ─────────────────────────────────────────────────────────────

  const axStyle = {
    color: '#475569', gridcolor: '#1e293b', zerolinecolor: '#334155',
    tickfont:  { color: '#475569', size: 8 },
    titlefont: { color: '#64748b', size: 9 },
  }

  const render3D = useCallback(() => {
    const lib = plotlyLib.current
    const div = plot3dRef.current
    if (!lib || !div) return
    setIsComputing(true)
    setTimeout(() => {
      const { xs, ys, zs } = computeWorkspace3D(joints)

      // Compute reach range from samples
      const rArr    = xs.map((x, i) => Math.hypot(x, ys[i], zs[i]))
      const rMaxSample = rArr.reduce((a, b) => Math.max(a, b), 0.01)
      const rMinSample = rArr.filter(r => r > 0.01).reduce((a, b) => Math.min(a, b), rMaxSample)

      // Analytic bounds from link lengths
      const rMaxAnalytic = rLinks.reduce((a, b) => a + b, 0)
      const rMinAnalytic = rLinks.length <= 1 ? 0
        : rLinks.length === 2 ? Math.abs(rLinks[0] - rLinks[1])
        : Math.max(0, rLinks[0] - rLinks.slice(1).reduce((a, b) => a + b, 0))
      const rMax = Math.max(rMaxSample, rMaxAnalytic)
      const rMin = rMinAnalytic

      const outerRing = makeRingXZ(rMax)
      const innerRing = rMin > rMax * 0.04 ? makeRingXZ(rMin) : null

      // Stats annotation text
      const area2D   = workspaceStats?.area2D ?? Math.PI * (rMax * rMax - rMin * rMin)
      const vol3D    = workspaceStats?.vol3D
      const statsText =
        `R_max: <b>${rMax.toFixed(3)} m</b>  |  R_min: <b>${rMin.toFixed(3)} m</b><br>` +
        `A₂D = π(R²max−R²min) = <b>${area2D.toFixed(3)} m²</b>` +
        (vol3D != null ? `<br>V₃D = A₂D × d_stroke = <b>${vol3D.toFixed(3)} m³</b>` : '')

      const traces: any[] = [
        // Scatter cloud
        {
          type: 'scatter3d', x: xs, y: ys, z: zs, mode: 'markers',
          marker: {
            size: 2.2, color: rArr, colorscale: 'Viridis', opacity: 0.65,
            showscale: true, cmin: rMin, cmax: rMax,
            colorbar: {
              thickness: 10, len: 0.55, x: 1.01,
              tickfont: { color: '#475569', size: 7, family: 'JetBrains Mono,monospace' },
              title: { text: '‖r‖ m', font: { color: '#64748b', size: 8 } },
            },
          },
          hovertemplate: 'x: %{x:.3f}<br>y: %{y:.3f}<br>z: %{z:.3f}<extra></extra>',
          name: 'EE cloud',
        },
        // Outer boundary ring
        {
          type: 'scatter3d', mode: 'lines',
          x: outerRing.x, y: outerRing.y, z: outerRing.z,
          line: { color: 'rgba(34,211,238,0.50)', width: 2.5 },
          hovertemplate: `R_max = ${rMax.toFixed(3)} m<extra>Outer bound</extra>`,
          name: `R_max = ${rMax.toFixed(3)} m`,
          showlegend: true,
        },
      ]

      if (innerRing) {
        traces.push({
          type: 'scatter3d', mode: 'lines',
          x: innerRing.x, y: innerRing.y, z: innerRing.z,
          line: { color: 'rgba(148,163,184,0.40)', width: 1.5 },
          hovertemplate: `R_min = ${rMin.toFixed(3)} m<extra>Inner bound</extra>`,
          name: `R_min = ${rMin.toFixed(3)} m`,
          showlegend: true,
        })
      }

      // For SCARA-style: add vertical stroke lines at min/max radius
      if (workspaceStats?.pStroke && workspaceStats.pStroke > 0) {
        const stroke = workspaceStats.pStroke
        // Four vertical lines at ±Rmax on X and Z axes
        const vxPts = [rMax, rMax, rMin, rMin]
        const vzPts = [0,    0,    0,    0]
        vxPts.forEach((vx, i) => {
          const vz = [rMax, 0, rMin, 0][i]
          traces.push({
            type: 'scatter3d', mode: 'lines',
            x: [vx, vx], y: [0, -stroke], z: [vz, vz],
            line: { color: 'rgba(52,211,153,0.35)', width: 1.5 },
            hoverinfo: 'skip', showlegend: false,
          })
        })
      }

      lib.react(
        div,
        traces,
        {
          paper_bgcolor: 'transparent',
          scene: {
            bgcolor: 'rgba(8,8,16,0)',
            xaxis: { ...axStyle, title: 'X (m)' },
            yaxis: { ...axStyle, title: 'Y (m)' },
            zaxis: { ...axStyle, title: 'Z (m)' },
            camera: { eye: { x: 1.6, y: 1.4, z: 0.6 } },
            aspectmode: 'data',
          },
          margin: { l: 0, r: 36, t: 38, b: 0 },
          font: { family: 'JetBrains Mono,monospace', color: '#64748b', size: 9 },
          title: {
            text: `3D Taskspace — ${label ?? 'EE Cloud'}`,
            font: { color: '#94a3b8', size: 10, family: 'JetBrains Mono,monospace' },
            x: 0.5, xanchor: 'center',
          },
          legend: {
            x: 0, y: 1, xanchor: 'left', yanchor: 'top',
            font: { color: '#64748b', size: 8, family: 'JetBrains Mono,monospace' },
            bgcolor: 'rgba(8,8,16,0.55)',
            bordercolor: 'rgba(51,65,85,0.5)',
            borderwidth: 1,
          },
          annotations: [{
            x: 0.5, y: 0,
            xref: 'paper', yref: 'paper',
            xanchor: 'center', yanchor: 'bottom',
            text: statsText,
            showarrow: false,
            font: { size: 8.5, color: '#94a3b8', family: 'JetBrains Mono,monospace' },
            bgcolor: 'rgba(8,8,16,0.65)',
            bordercolor: 'rgba(51,65,85,0.45)',
            borderwidth: 1,
            borderpad: 5,
            align: 'center',
          }],
        },
        { responsive: true, displayModeBar: false },
      )
      setIsComputing(false)
    }, 30)
  }, [jointsKey, label]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode !== '3d') return
    if (!plotlyLib.current) {
      import('plotly.js-dist-min').then(mod => {
        plotlyLib.current = (mod as any).default ?? mod
        render3D()
      })
      return
    }
    render3D()
  }, [viewMode, render3D])

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-2">

      {/* Mode tabs */}
      <div className="flex items-center gap-1.5 shrink-0">
        {(['2d', '3d'] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`px-2.5 py-1 text-[8px] font-mono rounded border transition-all ${
              viewMode === m
                ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
            }`}>
            {m === '2d' ? '2D WORKSPACE' : '3D TASKSPACE'}
          </button>
        ))}
        {viewMode === '3d' && (
          <button onClick={render3D} disabled={isComputing}
            className={`ml-auto px-2.5 py-1 text-[8px] font-mono rounded border transition-all ${
              isComputing
                ? 'border-cyan-500/20 text-cyan-500/30 cursor-not-allowed'
                : 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
            }`}>
            {isComputing ? '…' : '↻ RECOMPUTE'}
          </button>
        )}
      </div>

      {/* Live stats bar */}
      {workspaceStats && (
        <div className="flex items-center gap-2 flex-wrap shrink-0 font-mono">
          <StatsChip
            label="R_max"
            value={`${workspaceStats.rMax.toFixed(3)} m`}
            accent="cyan"
          />
          {workspaceStats.rMin > workspaceStats.rMax * 0.03 && (
            <StatsChip
              label="R_min"
              value={`${workspaceStats.rMin.toFixed(3)} m`}
              accent="slate"
            />
          )}
          <StatsChip
            label="A₂D = π(R²max−R²min)"
            value={`${workspaceStats.area2D.toFixed(3)} m²`}
            accent="violet"
          />
          {workspaceStats.vol3D !== null && (
            <StatsChip
              label="V₃D = A₂D × d_stroke"
              value={`${workspaceStats.vol3D.toFixed(3)} m³`}
              accent="emerald"
            />
          )}
        </div>
      )}

      {/* Viz area */}
      <div className="relative flex-1 min-h-0 rounded overflow-hidden">
        {viewMode === '2d' ? (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ display: 'block' }}
          />
        ) : (
          <>
            {isComputing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080810]/75 backdrop-blur-sm rounded">
                <span className="text-[10px] font-mono text-cyan-500 tracking-widest animate-pulse">
                  SAMPLING JOINT SPACE…
                </span>
              </div>
            )}
            <div ref={plot3dRef} className="absolute inset-0 w-full h-full" />
          </>
        )}
      </div>

    </div>
  )
}
