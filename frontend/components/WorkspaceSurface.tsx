'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { type WorkspaceJoint, computeWorkspace3D } from '../lib/workspace'

interface Props {
  joints: WorkspaceJoint[]
  label?: string
}

type ViewMode = '2d' | '3d'

// ── Planar FK (2D projection) ─────────────────────────────────────────────────

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

// ── Canvas 2D workspace ───────────────────────────────────────────────────────

const DISPLAY_POSE = [Math.PI / 4, -Math.PI / 3, Math.PI / 5, -Math.PI / 4]

function drawWS(ctx: CanvasRenderingContext2D, W: number, H: number, rLinks: number[]) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#080810'
  ctx.fillRect(0, 0, W, H)

  const n = rLinks.length
  if (n === 0) return

  const maxR = rLinks.reduce((a, b) => a + b, 0)
  // Analytic inner radius (dead zone):
  // 1R → circle (minR = maxR, no fill); 2R → |L1-L2|; 3R+ → ~0
  const minR = n === 1 ? maxR
             : n === 2 ? Math.abs(rLinks[0] - rLinks[1])
             : Math.max(0, rLinks[0] - rLinks.slice(1).reduce((a, b) => a + b, 0))

  const sc  = Math.min(W, H) * 0.42 / maxR
  const cx  = W / 2
  const cy  = H * 0.53

  const tx = (x: number) => cx + x * sc
  const ty = (y: number) => cy - y * sc   // Y-flip for standard math orientation

  // Subtle crosshair
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth   = 0.5
  ctx.setLineDash([6, 14])
  ctx.beginPath(); ctx.moveTo(0, cy);  ctx.lineTo(W, cy);  ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // ── Workspace annulus ────────────────────────────────────────────────────────
  const outerR = maxR * sc
  const innerR = minR * sc

  // For 1R: just a thin ring; for 2R+: filled annulus or disk
  if (n > 1) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
    if (innerR > outerR * 0.04) {
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true) // CCW → even-odd carves a hole
    }
    ctx.fillStyle = 'rgba(190,210,230,0.17)'
    ctx.fill('evenodd')
    ctx.restore()
  }

  // Outer boundary circle
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.52)'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  // Inner dead-zone boundary
  if (innerR > outerR * 0.04) {
    ctx.beginPath()
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth   = 1
    ctx.stroke()
  }

  // Origin marker
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.70)'
  ctx.fill()

  // ── Robot arm at display pose ────────────────────────────────────────────────
  const pts = fk2D(rLinks, DISPLAY_POSE)

  // Link segments
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

    // Joint circle
    ctx.beginPath()
    ctx.arc(px, py, jR, 0, Math.PI * 2)
    ctx.fillStyle = isEE ? '#22d3ee' : '#ffffff'
    ctx.fill()

    if (!isEE) {
      const q    = DISPLAY_POSE[i] ?? 0
      const arcR = 15 + i * 5

      if (i < 4) {
        // Dashed reference line pointing in the cumulative direction at this joint
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(px + arcR * 1.6 * Math.cos(cumA), py - arcR * 1.6 * Math.sin(cumA))
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth   = 0.8
        ctx.setLineDash([3, 5])
        ctx.stroke()
        ctx.restore()

        // θ arc: from reference direction cumA to cumA+q
        // Canvas angle = -math_angle; q>0 → CCW on screen → anticlockwise=true in canvas
        ctx.beginPath()
        ctx.arc(px, py, arcR, -cumA, -(cumA + q), q > 0)
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
        ctx.lineWidth   = 1.2
        ctx.stroke()

        // θᵢ label at arc midpoint
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

  // ── Legend / labels ──────────────────────────────────────────────────────────
  ctx.font         = '9px JetBrains Mono, monospace'
  ctx.textBaseline = 'alphabetic'
  const rows = Math.min(n, 4)
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = 'rgba(200,215,230,0.45)'
    ctx.textAlign = 'left'
    ctx.fillText(`θ${i + 1} ∈ [−180°, 180°]`, 10, H - 12 - (rows - 1 - i) * 16)
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(130,150,180,0.55)'
  ctx.fillText(`R_max = ${maxR.toFixed(2)} m`, W - 10, H - 12)
  if (innerR > outerR * 0.04) {
    ctx.fillText(`R_min = ${minR.toFixed(2)} m`, W - 10, H - 28)
  }
  ctx.textAlign = 'left'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkspaceSurface({ joints, label }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const plot3dRef  = useRef<HTMLDivElement>(null)
  const plotlyLib  = useRef<any>(null)

  const [viewMode,    setViewMode]    = useState<ViewMode>('2d')
  const [isComputing, setIsComputing] = useState(false)

  const jointsKey = joints.map(j =>
    `${j.type}:${j.length.toFixed(3)}:${j.rotationAxis ?? ''}:${(j.prismaticDir ?? []).join(',')}`
  ).join('|')

  // Only R-joint lengths matter for the 2D workspace shape
  const rLinks = useMemo(
    () => joints.filter(j => j.type === 'R').map(j => j.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jointsKey],
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
    drawWS(ctx, W, H, rLinks)
  }, [rLinks]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode !== '2d') return
    redraw2D()
    const ro = new ResizeObserver(redraw2D)
    if (canvasRef.current) ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [viewMode, redraw2D])

  // ── 3D Plotly scatter ─────────────────────────────────────────────────────

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
      const rArr = xs.map((x, i) => Math.hypot(x, ys[i], zs[i]))
      const rMax = rArr.reduce((a, b) => Math.max(a, b), 0.01)
      lib.react(
        div,
        [{
          type: 'scatter3d', x: xs, y: ys, z: zs, mode: 'markers',
          marker: {
            size: 2.2, color: rArr, colorscale: 'Viridis', opacity: 0.65,
            showscale: true, cmin: 0, cmax: rMax,
            colorbar: {
              thickness: 10, len: 0.60, x: 1.01,
              tickfont: { color: '#475569', size: 7, family: 'JetBrains Mono,monospace' },
              title: { text: '‖r‖ m', font: { color: '#64748b', size: 8 } },
            },
          },
          hovertemplate: 'x: %{x:.2f}<br>y: %{y:.2f}<br>z: %{z:.2f}<extra></extra>',
        }],
        {
          paper_bgcolor: 'transparent',
          scene: {
            bgcolor: 'rgba(8,8,16,0)',
            xaxis: { ...axStyle, title: 'X (m)' },
            yaxis: { ...axStyle, title: 'Y (m)' },
            zaxis: { ...axStyle, title: 'Z (m)' },
            camera: { eye: { x: 1.4, y: 1.2, z: 0.9 } },
            aspectmode: 'data',
          },
          margin: { l: 0, r: 36, t: 38, b: 0 },
          font: { family: 'JetBrains Mono,monospace', color: '#64748b', size: 9 },
          title: {
            text: `3D Taskspace — ${label ?? 'EE Cloud'}`,
            font: { color: '#94a3b8', size: 10, family: 'JetBrains Mono,monospace' },
            x: 0.5, xanchor: 'center',
          },
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
