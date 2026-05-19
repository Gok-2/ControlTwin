'use client'

// DH Parameter Table — Denavit-Hartenberg convention for planar n-R robots
//
// Convention (standard DH):
//   Row i:  aᵢ = link length,  αᵢ = 0 (planar),  dᵢ = 0 (planar),  θᵢ = joint angle
//
// Transformation matrix:
//   Tᵢ = | cos θᵢ  −sin θᵢ  0  aᵢ cos θᵢ |
//        | sin θᵢ   cos θᵢ  0  aᵢ sin θᵢ |
//        |    0        0     1      0      |
//        |    0        0     0      1      |
//
// angles[0]   = absolute angle of link 1 from X-axis  (matches FK sliders / IK q₁)
// angles[i≥1] = relative angle of link i+1 w.r.t. link i  (matches FK sliders / IK q₂,q₃)

import type { RobotModel } from './RobotCanvas2D'
import { LINK_LENGTHS } from './RobotCanvas2D'

// ── Matrix helpers ────────────────────────────────────────────────────────────

type M4 = number[][]  // 4×4

function identity4(): M4 {
  return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
}

function mmul4(A: M4, B: M4): M4 {
  return Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) =>
      A[i].reduce((s, _, k) => s + A[i][k] * B[k][j], 0)
    )
  )
}

// Standard DH transformation matrix (α=0, d=0 for planar robot)
function dhT(a: number, theta: number): M4 {
  const ct = Math.cos(theta), st = Math.sin(theta)
  return [
    [ct, -st, 0, a * ct],
    [st,  ct, 0, a * st],
    [ 0,   0, 1, 0],
    [ 0,   0, 0, 1],
  ]
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  model: RobotModel
  angles: number[]  // radians — same convention as fkPlanar / ik2R / ik3R
  robotLabel: string
}

export default function DHTable({ model, angles, robotLabel }: Props) {
  const links = LINK_LENGTHS[model]
  const n     = links.length

  // Compute cumulative T₀ᵢ matrices
  let T = identity4()
  const T_cum: M4[] = []
  for (let i = 0; i < n; i++) {
    T = mmul4(T, dhT(links[i], angles[i] ?? 0))
    T_cum.push(T.map(r => [...r]))
  }

  const T_ee = T_cum[n - 1] ?? identity4()
  const px   = T_ee[0][3]
  const py   = T_ee[1][3]
  const phi  = Math.atan2(T_ee[1][0], T_ee[0][0])  // = sum of all θᵢ

  const fmtAngle = (r: number) => {
    const deg = r * 180 / Math.PI
    return { deg: deg.toFixed(1), rad: r.toFixed(4) }
  }

  const fmtCell = (v: number) => {
    const abs = Math.abs(v)
    if (abs < 1e-10) return '0.000'
    return v.toFixed(3)
  }

  // Cell colour: rotation submatrix (top-left 3×3) vs position column vs homogeneous row
  const cellClass = (row: number, col: number) => {
    if (row === 3) return 'text-slate-800'
    if (col === 3) return row < 2 ? 'text-cyan-400 font-bold tabular-nums' : 'text-slate-700 tabular-nums'
    return 'text-slate-500 tabular-nums'
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-l border-slate-800/80 overflow-y-auto select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-slate-800/60 shrink-0">
        <div className="text-[8px] font-mono tracking-[0.25em] text-slate-600 uppercase">
          DH Parameters
        </div>
        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{robotLabel}</div>
      </div>

      {/* ── DH Parameter Table ─────────────────────────────────────────────── */}
      <div className="px-3 pt-3 shrink-0">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr>
              <th className="text-left pb-1.5 text-slate-700 font-normal w-5">i</th>
              <th className="text-right pb-1.5 text-slate-600 font-normal pr-2">aᵢ&nbsp;(m)</th>
              <th className="text-right pb-1.5 text-slate-600 font-normal pr-2">αᵢ&nbsp;(°)</th>
              <th className="text-right pb-1.5 text-slate-600 font-normal pr-2">dᵢ&nbsp;(m)</th>
              <th className="text-right pb-1.5 text-cyan-700 font-normal pr-2">θᵢ&nbsp;(°)</th>
              <th className="text-right pb-1.5 text-cyan-700/60 font-normal">θᵢ&nbsp;(rad)</th>
            </tr>
          </thead>
          <tbody>
            {links.map((L, i) => {
              const a = fmtAngle(angles[i] ?? 0)
              return (
                <tr key={i} className="border-t border-slate-800/50">
                  <td className="py-1.5 text-slate-600">{i + 1}</td>
                  <td className="py-1.5 text-right pr-2 text-slate-400 tabular-nums">{L.toFixed(3)}</td>
                  <td className="py-1.5 text-right pr-2 text-slate-700 tabular-nums">0.000</td>
                  <td className="py-1.5 text-right pr-2 text-slate-700 tabular-nums">0.000</td>
                  <td className="py-1.5 text-right pr-2 text-cyan-400 font-bold tabular-nums">{a.deg}</td>
                  <td className="py-1.5 text-right text-cyan-300/60 tabular-nums">{a.rad}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mx-3 border-t border-slate-800/60 my-3" />

      {/* ── T₀ₙ Matrix ────────────────────────────────────────────────────── */}
      <div className="px-3 shrink-0">
        <div className="text-[8px] font-mono tracking-[0.2em] text-slate-600 uppercase mb-2">
          T₀{n} &mdash; Homogeneous Transform
        </div>

        <div className="rounded border border-slate-800/60 overflow-hidden">
          {T_ee.map((row, i) => (
            <div key={i} className={`grid grid-cols-4 divide-x divide-slate-800/60 text-[10px] font-mono
              ${i < 3 ? 'border-b border-slate-800/60' : ''}`}>
              {row.map((val, j) => (
                <div key={j} className={`px-1.5 py-1 text-right ${cellClass(i, j)}`}>
                  {fmtCell(val)}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex gap-4 text-[9px] font-mono">
          <span><span className="text-cyan-500/60">█</span> <span className="text-slate-600">position (px, py)</span></span>
          <span><span className="text-slate-500/60">█</span> <span className="text-slate-600">rotation</span></span>
        </div>
      </div>

      <div className="mx-3 border-t border-slate-800/60 my-3" />

      {/* ── End-Effector Result ────────────────────────────────────────────── */}
      <div className="px-3 pb-4 shrink-0">
        <div className="text-[8px] font-mono tracking-[0.2em] text-slate-600 uppercase mb-2">
          End-Effector (FK Result)
        </div>

        <div className="space-y-1.5">
          <ResultRow symbol="px" value={px.toFixed(4)} unit="m" color="text-cyan-400" />
          <ResultRow symbol="py" value={py.toFixed(4)} unit="m" color="text-cyan-400" />
          <ResultRow symbol="φ"  value={(phi * 180 / Math.PI).toFixed(2)} unit="°" color="text-violet-400" />
          <ResultRow symbol="r"  value={Math.hypot(px, py).toFixed(4)} unit="m" color="text-slate-400"
            note="distance from base" />
        </div>

        {/* Reach utilisation bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[8px] font-mono text-slate-700 mb-1">
            <span>Workspace utilisation</span>
            <span>{(Math.hypot(px, py) / links.reduce((a,b)=>a+b,0) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500/50 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(100, Math.hypot(px, py) / links.reduce((a,b)=>a+b,0) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultRow({
  symbol, value, unit, color, note,
}: {
  symbol: string; value: string; unit: string; color: string; note?: string
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] font-mono text-slate-600">
        {symbol}{note ? <span className="text-[8px] text-slate-700 ml-1">({note})</span> : ''}
      </span>
      <span className={`text-[11px] font-mono font-bold tabular-nums ${color}`}>
        {value}<span className="text-[9px] font-normal text-slate-600 ml-1">{unit}</span>
      </span>
    </div>
  )
}
