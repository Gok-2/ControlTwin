'use client'

import { useEffect, useRef, useCallback } from 'react'

export type RobotModel = '2r' | '3r' | 'scara'

export const LINK_LENGTHS: Record<RobotModel, number[]> = {
  '2r':    [1.5, 1.1],
  '3r':    [1.2, 0.85, 0.55],
  'scara': [0.65, 0.48],
}

/* ── Kinematics ──────────────────────────────────────────────────────────── */

function fkPlanar(links: number[], angles: number[]) {
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }]
  let cum = 0
  for (let i = 0; i < links.length; i++) {
    cum += angles[i] ?? 0
    const p = pts[pts.length - 1]
    pts.push({ x: p.x + links[i] * Math.cos(cum), y: p.y + links[i] * Math.sin(cum) })
  }
  return pts
}

export function ik2R(L1: number, L2: number, x: number, y: number): [number, number] | null {
  const c2 = (x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2)
  if (Math.abs(c2) > 1) return null
  const s2 = Math.sqrt(1 - c2 * c2)
  const q2 = Math.atan2(s2, c2)
  const q1 = Math.atan2(y, x) - Math.atan2(L2 * s2, L1 + L2 * c2)
  return [q1, q2]
}

export function ik3R(L1: number, L2: number, L3: number, x: number, y: number, phi: number): [number, number, number] | null {
  const xw = x - L3 * Math.cos(phi)
  const yw = y - L3 * Math.sin(phi)
  const res = ik2R(L1, L2, xw, yw)
  if (!res) return null
  const [q1, q2] = res
  return [q1, q2, phi - q1 - q2]
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface Props {
  model: RobotModel
  mode: 'demo' | 'fk' | 'ik'
  angles?: number[]
  target?: { x: number; y: number; phi?: number }
  customLinkLengths?: number[]
  onEEUpdate?: (pos: { x: number; y: number }, angles: number[]) => void
}

export default function RobotCanvas2D({ model, mode, angles, target, customLinkLengths, onEEUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const tRef      = useRef(0)
  const trailRef  = useRef<{ x: number; y: number }[]>([])
  const modelRef  = useRef(model)

  useEffect(() => {
    if (modelRef.current !== model) {
      trailRef.current = []
      modelRef.current = model
      tRef.current = 0
    }
  }, [model])

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number, joints: number[], links: number[]) => {
      const totalReach = links.reduce((a, b) => a + b, 0)
      const scale = (Math.min(W, H) * 0.36) / totalReach
      const ox = W * 0.44
      const oy = H * 0.60

      const toC = (wx: number, wy: number) => ({ cx: ox + wx * scale, cy: oy - wy * scale })

      // Background
      ctx.fillStyle = '#0a0a14'
      ctx.fillRect(0, 0, W, H)

      // Minor grid (0.25 m)
      const minor = 0.25 * scale
      ctx.strokeStyle = '#111827'; ctx.lineWidth = 0.5
      for (let gx = ((ox % minor) + minor) % minor; gx < W; gx += minor) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
      }
      for (let gy = ((oy % minor) + minor) % minor; gy < H; gy += minor) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
      }
      // Major grid (1 m)
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1
      const major = scale
      for (let gx = ((ox % major) + major) % major; gx < W; gx += major) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke()
      }
      for (let gy = ((oy % major) + major) % major; gy < H; gy += major) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke()
      }

      // Axes
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke()

      // Arrow heads
      ctx.fillStyle = '#475569'
      ctx.beginPath(); ctx.moveTo(W - 8, oy); ctx.lineTo(W - 18, oy - 5); ctx.lineTo(W - 18, oy + 5); ctx.fill()
      ctx.beginPath(); ctx.moveTo(ox, 8);     ctx.lineTo(ox - 5, 18);      ctx.lineTo(ox + 5, 18);     ctx.fill()

      // Axis labels
      ctx.fillStyle = '#64748b'
      ctx.font = '11px "JetBrains Mono",monospace'
      ctx.fillText('X (m)', W - 52, oy - 10)
      ctx.fillText('Y (m)', ox + 8, 22)

      // Metre tick labels
      ctx.font = '9px "JetBrains Mono",monospace'
      ctx.fillStyle = '#334155'
      for (let m = -Math.ceil(totalReach * 1.3); m <= Math.ceil(totalReach * 1.3); m++) {
        if (m === 0) continue
        const cp = toC(m, 0)
        if (cp.cx > 15 && cp.cx < W - 15) ctx.fillText(`${m}`, cp.cx - 4, oy + 14)
        const cp2 = toC(0, m)
        if (m > 0 && cp2.cy > 15 && cp2.cy < H - 15) ctx.fillText(`${m}`, ox + 5, cp2.cy + 4)
      }

      // Workspace boundary
      const rMax = totalReach
      const rMin = Math.max(0, Math.abs(links[0] - links.slice(1).reduce((a, b) => a + b, 0)))
      ctx.strokeStyle = 'rgba(34,211,238,0.12)'; ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath(); ctx.arc(ox, oy, rMax * scale, 0, Math.PI * 2); ctx.stroke()
      if (rMin > 0.05) { ctx.beginPath(); ctx.arc(ox, oy, rMin * scale, 0, Math.PI * 2); ctx.stroke() }
      ctx.setLineDash([])

      // FK
      const pts = fkPlanar(links, joints)
      const ee  = pts[pts.length - 1]

      // Trail
      const trail = trailRef.current
      if (!trail.length || Math.hypot(ee.x - trail[trail.length - 1].x, ee.y - trail[trail.length - 1].y) > 0.007) {
        trail.push({ x: ee.x, y: ee.y })
        if (trail.length > 350) trail.shift()
      }
      if (trail.length > 1) {
        ctx.beginPath()
        const t0 = toC(trail[0].x, trail[0].y)
        ctx.moveTo(t0.cx, t0.cy)
        for (let i = 1; i < trail.length; i++) {
          const tp = toC(trail[i].x, trail[i].y); ctx.lineTo(tp.cx, tp.cy)
        }
        ctx.strokeStyle = 'rgba(0,204,255,0.38)'; ctx.lineWidth = 1.5; ctx.stroke()
      }

      // Links
      const linkColors = ['#2563eb', '#3b82f6', '#60a5fa']
      for (let i = 0; i < pts.length - 1; i++) {
        const a = toC(pts[i].x, pts[i].y), b = toC(pts[i + 1].x, pts[i + 1].y)
        ctx.strokeStyle = linkColors[i] ?? '#60a5fa'
        ctx.lineWidth = 7; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx, b.cy); ctx.stroke()
      }

      // Joints
      const jointColors = ['#1e40af', '#1d4ed8', '#2563eb']
      for (let i = 0; i < pts.length - 1; i++) {
        const jp = toC(pts[i].x, pts[i].y)
        const r  = i === 0 ? 9 : 6
        ctx.fillStyle = jointColors[i] ?? '#2563eb'
        ctx.beginPath(); ctx.arc(jp.cx, jp.cy, r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(jp.cx, jp.cy, r, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#94a3b8'; ctx.font = '10px "JetBrains Mono",monospace'
        ctx.fillText(`q${i + 1}`, jp.cx + r + 3, jp.cy - r + 2)
      }

      // Base
      const base = toC(0, 0)
      ctx.fillStyle = '#334155'
      ctx.fillRect(base.cx - 14, base.cy, 28, 10)
      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1
      for (let hx = 0; hx < 28; hx += 6) {
        ctx.beginPath(); ctx.moveTo(base.cx - 14 + hx, base.cy); ctx.lineTo(base.cx - 18 + hx, base.cy + 10); ctx.stroke()
      }

      // EE glow
      const eeC = toC(ee.x, ee.y)
      const g = ctx.createRadialGradient(eeC.cx, eeC.cy, 0, eeC.cx, eeC.cy, 18)
      g.addColorStop(0, 'rgba(0,204,255,0.35)'); g.addColorStop(1, 'transparent')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(eeC.cx, eeC.cy, 18, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#00ccff'
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(eeC.cx, eeC.cy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 10px "JetBrains Mono",monospace'
      ctx.fillText(`(${ee.x.toFixed(2)}, ${ee.y.toFixed(2)}) m`, eeC.cx + 10, eeC.cy - 8)

      return { ee, joints }
    },
    [model],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const links = customLinkLengths && customLinkLengths.length > 0
      ? customLinkLengths
      : LINK_LENGTHS[model]
    let lastX = NaN, lastY = NaN

    const loop = () => {
      const dpr = window.devicePixelRatio || 1
      const W   = canvas.offsetWidth
      const H   = canvas.offsetHeight
      if (!W || !H) { rafRef.current = requestAnimationFrame(loop); return }
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr
      }
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      let joints: number[]

      if (mode === 'fk' && angles && angles.length >= links.length) {
        joints = angles.slice(0, links.length)
      } else if (mode === 'ik' && target) {
        let sol: number[] | null = null
        if (links.length === 2) sol = ik2R(links[0], links[1], target.x, target.y)
        else if (links.length >= 3) sol = ik3R(links[0], links[1], links[2], target.x, target.y, target.phi ?? 0)
        joints = sol ?? Array(links.length).fill(0)
      } else {
        // Demo trajectory
        const t = tRef.current; tRef.current += 0.012
        joints = links.length === 2
          ? [0.4 + 0.8 * Math.sin(t * 0.7), 0.6 + 0.6 * Math.cos(t * 1.1)]
          : [0.3 + 0.6 * Math.sin(t * 0.65), 0.5 + 0.45 * Math.cos(t * 1.0), 0.35 * Math.sin(t * 1.35)]
      }

      const { ee } = drawFrame(ctx, W, H, joints, links)

      if (onEEUpdate && (Math.abs(ee.x - lastX) > 0.004 || Math.abs(ee.y - lastY) > 0.004)) {
        lastX = ee.x; lastY = ee.y
        onEEUpdate(ee, joints)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [model, mode, angles, target, customLinkLengths, drawFrame, onEEUpdate])

  return <canvas ref={canvasRef} className="w-full h-full block" />
}
