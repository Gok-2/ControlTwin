'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  runSimulation, analyzeStability, DEFAULT_PARAMS,
  type SimParams, type SimResult,
} from '@/lib/robotSim'
import {
  runAdaptiveSimulation, DEFAULT_ADAPTIVE,
  type AdaptiveParams, type AdaptiveResult,
} from '@/lib/adaptiveSim'
import {
  runNNSimulation, DEFAULT_NN,
  type NNParams, type NNResult,
} from '@/lib/nnSim'

// ── Types ─────────────────────────────────────────────────────────────────────

type ControlMethod = 'ctc' | 'adaptive' | 'nn'

interface Trace {
  x: number[]; y: number[]; name: string; color: string; dash?: string
}

// ── Plotly chart ──────────────────────────────────────────────────────────────

function PlotlyChart({ traces, title, yLabel, divId, height = 200 }: {
  traces: Trace[]; title: string; yLabel: string; divId: string; height?: number
}) {
  const divRef = useRef<HTMLDivElement>(null)

  const ref = useCallback((node: HTMLDivElement | null) => {
    (divRef as any).current = node
    if (!node || !traces.length) return
    import('plotly.js-dist-min').then((Plotly: any) => {
      const data = traces.map(tr => ({
        x: tr.x, y: tr.y, name: tr.name, type: 'scatter', mode: 'lines',
        line: { color: tr.color, width: 1.5, dash: tr.dash ?? 'solid' },
      }))
      const ax = {
        color: '#334155', gridcolor: '#1e293b', zerolinecolor: '#334155',
        tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#475569' },
      }
      Plotly.react(node, data, {
        paper_bgcolor: '#0a0a0f', plot_bgcolor: '#0d1117',
        margin: { t: 28, r: 16, b: 40, l: 52 },
        title: { text: title, font: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' }, x: 0.01 },
        xaxis: { ...ax, title: { text: 't (s)', font: { size: 10, color: '#475569' } } },
        yaxis: { ...ax, title: { text: yLabel, font: { size: 10, color: '#475569' } } },
        legend: {
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#64748b' },
          bgcolor: 'rgba(0,0,0,0)', bordercolor: '#1e293b', borderwidth: 1,
          x: 1, xanchor: 'right', y: 1,
        },
        height,
      }, { displayModeBar: false, responsive: true })
    })
  }, [traces, title, yLabel, height])

  return <div ref={ref} id={divId} className="w-full" style={{ minHeight: height }} />
}

// ── Network architecture diagram ──────────────────────────────────────────────

function NNDiagram({ hiddenSize }: { hiddenSize: number }) {
  const inputs = ['q₁', 'q₂', 'q̇₁', 'q̇₂', 'qd₁', 'qd₂', 'q̇d₁', 'q̇d₂']
  const shown  = Math.min(hiddenSize, 6)
  const W = 280, H = 130

  return (
    <svg width={W} height={H} className="w-full" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Layer labels */}
      <text x={18} y={12} fontSize={7} fill="#475569">INPUT (8)</text>
      <text x={W/2-14} y={12} fontSize={7} fill="#475569">HIDDEN ({hiddenSize})</text>
      <text x={W-50} y={12} fontSize={7} fill="#475569">OUTPUT (2)</text>

      {/* Input nodes */}
      {inputs.map((label, i) => {
        const cy = 22 + i * (H - 22) / 7
        return (
          <g key={i}>
            <circle cx={28} cy={cy} r={7} fill="#1e293b" stroke="#334155" strokeWidth={1} />
            <text x={4} y={cy + 3} fontSize={6} fill="#64748b">{label}</text>
          </g>
        )
      })}

      {/* Hidden nodes */}
      {Array.from({ length: shown }, (_, i) => {
        const cy = 22 + i * (H - 22) / (shown - 1 || 1)
        return (
          <g key={i}>
            <circle cx={W/2} cy={cy} r={7} fill="#0c4a6e" stroke="#0e7490" strokeWidth={1} />
            <text x={W/2-3} y={cy+3} fontSize={6} fill="#22d3ee">σ</text>
          </g>
        )
      })}
      {shown < hiddenSize && (
        <text x={W/2-4} y={H-6} fontSize={8} fill="#334155">⋮</text>
      )}

      {/* Output nodes */}
      {['τ₁', 'τ₂'].map((label, i) => {
        const cy = H * 0.35 + i * H * 0.3
        return (
          <g key={i}>
            <circle cx={W-28} cy={cy} r={7} fill="#431407" stroke="#f97316" strokeWidth={1} />
            <text x={W-18} y={cy+3} fontSize={7} fill="#f97316">{label}</text>
          </g>
        )
      })}

      {/* Connections — input → hidden (sample) */}
      {inputs.slice(0, 4).map((_, i) => {
        const cy1 = 22 + i * (H - 22) / 7
        return Array.from({ length: Math.min(shown, 4) }, (_, j) => {
          const cy2 = 22 + j * (H - 22) / (shown - 1 || 1)
          return (
            <line key={`${i}-${j}`}
              x1={35} y1={cy1} x2={W/2-7} y2={cy2}
              stroke="#1e3a5f" strokeWidth={0.5} opacity={0.6}
            />
          )
        })
      })}

      {/* Connections — hidden → output */}
      {Array.from({ length: Math.min(shown, 4) }, (_, j) => {
        const cy1 = 22 + j * (H - 22) / (shown - 1 || 1)
        return [0, 1].map(k => {
          const cy2 = H * 0.35 + k * H * 0.3
          return (
            <line key={`h${j}-o${k}`}
              x1={W/2+7} y1={cy1} x2={W-35} y2={cy2}
              stroke="#431407" strokeWidth={0.5} opacity={0.6}
            />
          )
        })
      })}

      {/* tanh label */}
      <text x={W/2-10} y={H-2} fontSize={6} fill="#0e7490">tanh</text>
    </svg>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <div className="text-[8px] font-mono tracking-[0.25em] text-slate-700 uppercase mt-4 mb-1.5">
      {label}
    </div>
  )
}

function ParamField({ label, symbol, unit, value, onChange, min, max, step = 0.001 }: {
  label: string; symbol: string; unit: string; value: number
  onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 text-right text-[10px] font-mono text-slate-500 shrink-0">{symbol}</div>
      <input
        type="number" step={step} min={min} max={max} value={value}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }}
        className="w-24 bg-[#0a0a0f] border border-slate-800 rounded px-2 py-1 text-[10px] font-mono
                   text-slate-200 tabular-nums focus:outline-none focus:border-cyan-500/50 text-right"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono text-slate-600 leading-none">{label}</div>
        <div className="text-[8px] font-mono text-slate-800 leading-none mt-0.5">{unit}</div>
      </div>
    </div>
  )
}

function ChartPanel({ title, subtitle, tag, children }: {
  title: string; subtitle: string; tag?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-[#0d1117] overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-800/60 flex items-baseline gap-2">
        <span className="text-[10px] font-mono font-bold text-slate-300">{title}</span>
        <span className="text-[9px] font-mono text-slate-600">{subtitle}</span>
        {tag && (
          <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {tag}
          </span>
        )}
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

function StatCard({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string
}) {
  return (
    <div className="rounded border border-slate-800 bg-black/30 px-3 py-2.5">
      <div className="text-[8px] font-mono text-slate-600 mb-1">{label}</div>
      <div className="text-base font-mono font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[8px] font-mono text-slate-700">{unit}</div>
    </div>
  )
}

function AnalysisRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[9px] font-mono text-slate-600">{label}</span>
      <span className="text-[10px] font-mono text-slate-300 tabular-nums">
        {value}{unit && <span className="text-slate-600 ml-1 text-[8px]">{unit}</span>}
      </span>
    </div>
  )
}

function ConvergenceBar({ label, current, target, color }: {
  label: string; current: number; target: number; color: string
}) {
  const err = Math.abs(current - target)
  const rel = err / (Math.abs(target) + 0.001)
  const pct = Math.max(0, Math.min(100, (1 - Math.min(rel, 1)) * 100))
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[8px] font-mono mb-0.5">
        <span className="text-slate-600">{label}</span>
        <span style={{ color }}>{current.toFixed(3)} <span className="text-slate-700">/ {target}</span></span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function InfoBadge({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}>
      {text}
    </span>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()

  const [method,     setMethod]     = useState<ControlMethod>('ctc')
  const [ctcParams,  setCtcParams]  = useState<SimParams>(DEFAULT_PARAMS)
  const [adaptParams,setAdaptParams]= useState<AdaptiveParams>(DEFAULT_ADAPTIVE)
  const [nnParams,   setNNParams]   = useState<NNParams>(DEFAULT_NN)

  const [ctcResult,   setCtcResult]   = useState<SimResult | null>(null)
  const [adaptResult, setAdaptResult] = useState<AdaptiveResult | null>(null)
  const [nnResult,    setNNResult]    = useState<NNResult | null>(null)

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const setCtc  = (k: keyof SimParams) => (v: number) => setCtcParams(p => ({ ...p, [k]: v }))
  const setAd   = (k: keyof AdaptiveParams) => (v: number) => setAdaptParams(p => ({ ...p, [k]: v }))
  const setNN   = (k: keyof NNParams) => (v: number) => setNNParams(p => ({ ...p, [k]: v }))

  const run = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const t0 = performance.now()
      if (method === 'ctc') {
        setCtcResult(runSimulation(ctcParams))
      } else if (method === 'adaptive') {
        setAdaptResult(runAdaptiveSimulation(adaptParams))
      } else {
        setNNResult(runNNSimulation(nnParams))
      }
      setElapsed(performance.now() - t0)
      setRunning(false)
    }, 20)
  }, [method, ctcParams, adaptParams, nnParams])

  const stab = analyzeStability(ctcParams.Kr, ctcParams.alpha)

  // ── Build chart traces ──────────────────────────────────────────────────────

  const ctcTraces = ctcResult ? {
    angles: [
      { x: ctcResult.t, y: ctcResult.q1,  name: 'q₁ actual',  color: '#22d3ee', dash: 'solid' },
      { x: ctcResult.t, y: ctcResult.qd1, name: 'q₁ desired', color: '#22d3ee', dash: 'dot'   },
      { x: ctcResult.t, y: ctcResult.q2,  name: 'q₂ actual',  color: '#f97316', dash: 'solid' },
      { x: ctcResult.t, y: ctcResult.qd2, name: 'q₂ desired', color: '#f97316', dash: 'dot'   },
    ] as Trace[],
    errors: [
      { x: ctcResult.t, y: ctcResult.e1, name: 'e₁', color: '#22d3ee' },
      { x: ctcResult.t, y: ctcResult.e2, name: 'e₂', color: '#f97316' },
    ] as Trace[],
    torques: [
      { x: ctcResult.t, y: ctcResult.tau1, name: 'τ₁ (N·m)', color: '#22d3ee' },
      { x: ctcResult.t, y: ctcResult.tau2, name: 'τ₂ (N·m)', color: '#f97316' },
    ] as Trace[],
  } : null

  const adaptTraces = adaptResult ? {
    angles: [
      { x: adaptResult.t, y: adaptResult.q1,  name: 'q₁ actual',  color: '#22d3ee', dash: 'solid' },
      { x: adaptResult.t, y: adaptResult.qd1, name: 'q₁ desired', color: '#22d3ee', dash: 'dot'   },
      { x: adaptResult.t, y: adaptResult.q2,  name: 'q₂ actual',  color: '#f97316', dash: 'solid' },
      { x: adaptResult.t, y: adaptResult.qd2, name: 'q₂ desired', color: '#f97316', dash: 'dot'   },
    ] as Trace[],
    errors: [
      { x: adaptResult.t, y: adaptResult.e1, name: 'e₁', color: '#22d3ee' },
      { x: adaptResult.t, y: adaptResult.e2, name: 'e₂', color: '#f97316' },
    ] as Trace[],
    params1: [
      { x: adaptResult.t, y: adaptResult.p1h, name: 'p̂₁ (est)', color: '#22d3ee' },
      { x: adaptResult.t, y: Array(adaptResult.t.length).fill(DEFAULT_ADAPTIVE.p1), name: 'p₁ (true)', color: '#22d3ee', dash: 'dot' },
      { x: adaptResult.t, y: adaptResult.p2h, name: 'p̂₂ (est)', color: '#a78bfa' },
      { x: adaptResult.t, y: Array(adaptResult.t.length).fill(DEFAULT_ADAPTIVE.p2), name: 'p₂ (true)', color: '#a78bfa', dash: 'dot' },
    ] as Trace[],
    params2: [
      { x: adaptResult.t, y: adaptResult.p3h, name: 'p̂₃ (est)', color: '#34d399' },
      { x: adaptResult.t, y: Array(adaptResult.t.length).fill(DEFAULT_ADAPTIVE.p3), name: 'p₃ (true)', color: '#34d399', dash: 'dot' },
      { x: adaptResult.t, y: adaptResult.p4h, name: 'p̂₄ (est)', color: '#f97316' },
      { x: adaptResult.t, y: Array(adaptResult.t.length).fill(DEFAULT_ADAPTIVE.p4), name: 'p₄ (true)', color: '#f97316', dash: 'dot' },
      { x: adaptResult.t, y: adaptResult.p5h, name: 'p̂₅ (est)', color: '#fb7185' },
      { x: adaptResult.t, y: Array(adaptResult.t.length).fill(DEFAULT_ADAPTIVE.p5), name: 'p₅ (true)', color: '#fb7185', dash: 'dot' },
    ] as Trace[],
    sliding: [
      { x: adaptResult.t, y: adaptResult.s1, name: 's₁ = ė₁+λe₁', color: '#22d3ee' },
      { x: adaptResult.t, y: adaptResult.s2, name: 's₂ = ė₂+λe₂', color: '#f97316' },
    ] as Trace[],
  } : null

  const nnTraces = nnResult ? {
    angles: [
      { x: nnResult.t, y: nnResult.q1,  name: 'q₁ actual',  color: '#22d3ee', dash: 'solid' },
      { x: nnResult.t, y: nnResult.qd1, name: 'q₁ desired', color: '#22d3ee', dash: 'dot'   },
      { x: nnResult.t, y: nnResult.q2,  name: 'q₂ actual',  color: '#f97316', dash: 'solid' },
      { x: nnResult.t, y: nnResult.qd2, name: 'q₂ desired', color: '#f97316', dash: 'dot'   },
    ] as Trace[],
    errors: [
      { x: nnResult.t, y: nnResult.e1, name: 'e₁', color: '#22d3ee' },
      { x: nnResult.t, y: nnResult.e2, name: 'e₂', color: '#f97316' },
    ] as Trace[],
    wNorm: [
      { x: nnResult.t, y: nnResult.wNorm, name: '‖W₁‖_F (learning)', color: '#34d399' },
    ] as Trace[],
    nnVsTrue: [
      { x: nnResult.t, y: nnResult.tauNN1, name: 'τ̂_NN₁ (feedforward)', color: '#a78bfa', dash: 'solid' },
      { x: nnResult.t, y: nnResult.tau1,   name: 'τ_total₁',            color: '#22d3ee', dash: 'dot'   },
      { x: nnResult.t, y: nnResult.tauNN2, name: 'τ̂_NN₂ (feedforward)', color: '#f97316', dash: 'solid' },
      { x: nnResult.t, y: nnResult.tau2,   name: 'τ_total₂',            color: '#fb7185', dash: 'dot'   },
    ] as Trace[],
  } : null

  const hasResult = (method === 'ctc' && !!ctcResult) ||
                    (method === 'adaptive' && !!adaptResult) ||
                    (method === 'nn' && !!nnResult)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0f]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 h-10
                      bg-black/60 backdrop-blur border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')}
            className="text-[10px] font-mono text-slate-600 hover:text-orange-400 transition-colors">
            ← HOME
          </button>
          <span className="text-slate-800">|</span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-orange-400">
            INTELLIGENT CONTROL
          </span>

          {/* Method badges */}
          <div className="flex gap-1.5">
            {([
              ['ctc',      'Computed Torque',  '#f97316'],
              ['adaptive', 'Adaptive (MRAC)',   '#22d3ee'],
              ['nn',       'NN Adaptive',       '#a78bfa'],
            ] as [ControlMethod, string, string][]).map(([m, label, color]) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`text-[8px] font-mono px-2 py-0.5 rounded border transition-all ${
                  method === m
                    ? `border-[${color}]/60 text-[${color}] bg-[${color}]/10`
                    : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                }`}
                style={method === m ? { borderColor: color+'60', color, backgroundColor: color+'15' } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {elapsed !== null && (
          <span className="text-[9px] font-mono text-slate-600">
            computed in <span className="text-emerald-500">{elapsed.toFixed(0)} ms</span>
          </span>
        )}
      </div>

      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 h-full pt-10 bg-[#0d1117] border-r border-slate-800/80
                      overflow-y-auto flex flex-col">
        <div className="px-4 pt-4 flex-1">

          {/* ── CTC panel ──────────────────────────────────────────────────── */}
          {method === 'ctc' && (
            <>
              <div className="mb-3 rounded border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                <div className="text-[8px] font-mono text-orange-400/70 mb-1">COMPUTED TORQUE CONTROL</div>
                <div className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  τ = M(q)·v + Vm(q,q̇)·q̇ + Fd·q̇
                </div>
                <div className="text-[9px] font-mono text-slate-600 leading-relaxed">
                  v = q̈d + Kr(q̇d−q̇) + α(qd−q)
                </div>
                <div className="text-[8px] font-mono text-emerald-500/70 mt-1">Requires exact model knowledge</div>
              </div>

              <SectionHead label="System Parameters" />
              <div className="space-y-1.5">
                <ParamField label="Joint 1 composite inertia" symbol="p₁" unit="kg·m²" value={ctcParams.p1} onChange={setCtc('p1')} min={0.001} />
                <ParamField label="Joint 2 inertia"           symbol="p₂" unit="kg·m²" value={ctcParams.p2} onChange={setCtc('p2')} min={0.001} />
                <ParamField label="Coupling inertia"          symbol="p₃" unit="kg·m²" value={ctcParams.p3} onChange={setCtc('p3')} min={0} />
                <ParamField label="Viscous friction q̇₁"      symbol="p₄" unit="N·m·s" value={ctcParams.p4} onChange={setCtc('p4')} min={0} />
                <ParamField label="Viscous friction q̇₂"      symbol="p₅" unit="N·m·s" value={ctcParams.p5} onChange={setCtc('p5')} min={0} />
              </div>

              <SectionHead label="Control Gains" />
              <div className="space-y-1.5">
                <ParamField label="Derivative gain"   symbol="Kr" unit="—" value={ctcParams.Kr}    onChange={setCtc('Kr')}    min={0} step={0.5} />
                <ParamField label="Proportional gain" symbol="α"  unit="—" value={ctcParams.alpha} onChange={setCtc('alpha')} min={0} step={0.5} />
              </div>

              <div className="mt-3 rounded border border-slate-800/60 bg-black/30 px-3 py-2.5 space-y-1">
                <div className="text-[8px] font-mono tracking-[0.2em] text-slate-700 uppercase mb-1.5">
                  Closed-Loop  (ë + Kr·ė + α·e = 0)
                </div>
                <AnalysisRow label="ωₙ = √α"       value={stab.wn.toFixed(3)}  unit="rad/s" />
                <AnalysisRow label="ζ = Kr/(2ωₙ)"  value={stab.zeta.toFixed(3)} unit="" />
                <AnalysisRow label="Regime"         value={stab.regime}          unit="" />
                <div className="text-[9px] font-mono text-slate-600 pt-1 break-all">{stab.lambda}</div>
                <div className={`text-[9px] font-mono font-bold mt-1 ${stab.stable ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stab.stable ? '✓ STABLE' : '✗ UNSTABLE'}
                </div>
              </div>

              <SectionHead label="Simulation" />
              <div className="space-y-1.5">
                <ParamField label="Duration"    symbol="T"  unit="s"   value={ctcParams.tEnd} onChange={setCtc('tEnd')} min={0.1} max={60} step={1} />
                <ParamField label="Timestep"    symbol="dt" unit="s"   value={ctcParams.dt}   onChange={setCtc('dt')}   min={0.001} max={0.1} step={0.001} />
              </div>
            </>
          )}

          {/* ── Adaptive panel ─────────────────────────────────────────────── */}
          {method === 'adaptive' && (
            <>
              <div className="mb-3 rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                <div className="text-[8px] font-mono text-cyan-400/70 mb-1">MODEL REFERENCE ADAPTIVE CONTROL</div>
                <div className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  τ = Y(q,q̇,q̇ᵣ,q̈ᵣ)·θ̂ − Kₛ·s
                </div>
                <div className="text-[9px] font-mono text-slate-600 leading-relaxed">
                  θ̂˙ = Γ·Yᵀ·s  (s = ė + λe)
                </div>
                <div className="text-[8px] font-mono text-cyan-500/70 mt-1">Works with unknown parameters</div>
              </div>

              <SectionHead label="True Robot (unknown to controller)" />
              <div className="space-y-1 mb-2">
                {([['p1','p₁',adaptParams.p1],['p2','p₂',adaptParams.p2],
                   ['p3','p₃',adaptParams.p3],['p4','p₄',adaptParams.p4],
                   ['p5','p₅',adaptParams.p5]] as [keyof AdaptiveParams, string, number][]).map(([k, sym, v]) => (
                  <ParamField key={k} label="" symbol={sym} unit="" value={v as number} onChange={setAd(k)} min={0.001} />
                ))}
              </div>

              <SectionHead label="Initial Estimates (wrong on purpose)" />
              <div className="space-y-1 mb-2">
                {([['p1_init','p̂₁₀',adaptParams.p1_init],['p2_init','p̂₂₀',adaptParams.p2_init],
                   ['p3_init','p̂₃₀',adaptParams.p3_init],['p4_init','p̂₄₀',adaptParams.p4_init],
                   ['p5_init','p̂₅₀',adaptParams.p5_init]] as [keyof AdaptiveParams, string, number][]).map(([k, sym, v]) => (
                  <ParamField key={k} label="" symbol={sym} unit="" value={v as number} onChange={setAd(k)} />
                ))}
              </div>

              <SectionHead label="Controller Gains" />
              <div className="space-y-1.5">
                <ParamField label="Sliding surface" symbol="λ"  unit="—" value={adaptParams.lambda} onChange={setAd('lambda')} min={0} step={0.5} />
                <ParamField label="Robust term"     symbol="Kₛ" unit="—" value={adaptParams.Ks}     onChange={setAd('Ks')}     min={0} step={0.5} />
                <ParamField label="Adaptation gain" symbol="Γ"  unit="—" value={adaptParams.gamma}  onChange={setAd('gamma')}  min={0} step={0.1} />
              </div>

              <SectionHead label="Simulation" />
              <div className="space-y-1.5">
                <ParamField label="Duration" symbol="T"  unit="s" value={adaptParams.tEnd} onChange={setAd('tEnd')} min={1} max={60} step={1} />
                <ParamField label="Timestep" symbol="dt" unit="s" value={adaptParams.dt}   onChange={setAd('dt')}   min={0.001} max={0.05} step={0.001} />
              </div>
            </>
          )}

          {/* ── NN panel ───────────────────────────────────────────────────── */}
          {method === 'nn' && (
            <>
              <div className="mb-3 rounded border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                <div className="text-[8px] font-mono text-violet-400/70 mb-1">NEURAL NETWORK ADAPTIVE CONTROL</div>
                <div className="text-[9px] font-mono text-slate-500 leading-relaxed">
                  τ = τ̂_NN(x;W) + Kv·s
                </div>
                <div className="text-[9px] font-mono text-slate-600 leading-relaxed">
                  ΔW = η·∂τ_NN/∂W·s
                </div>
                <div className="text-[8px] font-mono text-violet-500/70 mt-1">Online learning — no prior model</div>
              </div>

              <SectionHead label="Network Architecture" />
              <div className="mt-1 mb-3">
                <NNDiagram hiddenSize={nnParams.hiddenSize} />
                <div className="text-[8px] font-mono text-slate-700 mt-1 text-center">
                  8 → {nnParams.hiddenSize} → 2  (tanh hidden, linear output)
                </div>
              </div>

              <SectionHead label="True Robot Parameters" />
              <div className="space-y-1 mb-2">
                {([['p1','p₁',nnParams.p1],['p2','p₂',nnParams.p2],
                   ['p3','p₃',nnParams.p3],['p4','p₄',nnParams.p4],
                   ['p5','p₅',nnParams.p5]] as [keyof NNParams, string, number][]).map(([k, sym, v]) => (
                  <ParamField key={k} label="" symbol={sym} unit="" value={v as number} onChange={setNN(k)} min={0.001} />
                ))}
              </div>

              <SectionHead label="Learning Parameters" />
              <div className="space-y-1.5">
                <ParamField label="Sliding surface" symbol="λ"  unit="—"  value={nnParams.lambda}     onChange={setNN('lambda')}     min={0} step={0.5} />
                <ParamField label="Feedback gain"   symbol="Kv" unit="—"  value={nnParams.Kv}         onChange={setNN('Kv')}         min={0} step={0.5} />
                <ParamField label="Learning rate"   symbol="η"  unit="—"  value={nnParams.eta}        onChange={setNN('eta')}        min={0} step={0.001} />
                <ParamField label="Hidden neurons"  symbol="H"  unit="—"  value={nnParams.hiddenSize} onChange={v => setNNParams(p => ({ ...p, hiddenSize: Math.round(v) }))} min={4} max={20} step={1} />
              </div>

              <SectionHead label="Simulation" />
              <div className="space-y-1.5">
                <ParamField label="Duration" symbol="T"  unit="s" value={nnParams.tEnd} onChange={setNN('tEnd')} min={1} max={60} step={1} />
                <ParamField label="Timestep" symbol="dt" unit="s" value={nnParams.dt}   onChange={setNN('dt')}   min={0.001} max={0.05} step={0.001} />
              </div>
            </>
          )}
        </div>

        {/* Run button */}
        <div className="px-4 pb-5 pt-3 shrink-0">
          <button
            onClick={run} disabled={running}
            className={`w-full py-2.5 rounded font-mono font-bold text-[11px] tracking-widest transition-all border ${
              running
                ? 'bg-orange-500/20 text-orange-500/50 cursor-not-allowed border-orange-500/20'
                : 'bg-orange-500/15 text-orange-400 border-orange-500/40 hover:bg-orange-500/25 hover:border-orange-400/60 active:scale-[0.98]'
            }`}
          >
            {running ? 'COMPUTING…' : 'RUN SIMULATION ▶'}
          </button>
        </div>
      </div>

      {/* ── Right chart area ────────────────────────────────────────────────── */}
      <div className="flex-1 pt-10 overflow-y-auto bg-[#0a0a0f]">
        {!hasResult ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-[10px] font-mono text-slate-700 tracking-widest">NO SIMULATION RESULT YET</div>
            <div className="flex gap-3">
              <InfoBadge text="Set parameters" color="#f97316" />
              <InfoBadge text="Choose method" color="#22d3ee" />
              <InfoBadge text="Run simulation" color="#a78bfa" />
            </div>
            <div className="text-[9px] font-mono text-slate-800 mt-2">
              Select a control method above and click RUN SIMULATION
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">

            {/* ── CTC charts ─────────────────────────────────────────────── */}
            {method === 'ctc' && ctcResult && ctcTraces && (
              <>
                <ChartPanel title="Joint Angles" subtitle="q (rad)" tag="CTC">
                  <PlotlyChart divId="ctc-angles" traces={ctcTraces.angles}
                    title="Joint Angles — Actual vs Desired" yLabel="q (rad)" />
                </ChartPanel>
                <ChartPanel title="Tracking Error" subtitle="e = qd − q">
                  <PlotlyChart divId="ctc-errors" traces={ctcTraces.errors}
                    title="Tracking Error  |  eᵢ = qdi − qᵢ" yLabel="e (rad)" />
                </ChartPanel>
                <ChartPanel title="Control Torques" subtitle="τ (N·m)">
                  <PlotlyChart divId="ctc-torques" traces={ctcTraces.torques}
                    title="Computed Torque  |  τ = M(q)·v + Vm·q̇ + Fd·q̇" yLabel="τ (N·m)" />
                </ChartPanel>
                <div className="grid grid-cols-4 gap-3 pb-2">
                  <StatCard label="|e₁| max" value={Math.max(...ctcResult.e1.map(Math.abs)).toFixed(4)} unit="rad" color="#22d3ee" />
                  <StatCard label="|e₂| max" value={Math.max(...ctcResult.e2.map(Math.abs)).toFixed(4)} unit="rad" color="#f97316" />
                  <StatCard label="|τ₁| max" value={Math.max(...ctcResult.tau1.map(Math.abs)).toFixed(2)} unit="N·m" color="#22d3ee" />
                  <StatCard label="|τ₂| max" value={Math.max(...ctcResult.tau2.map(Math.abs)).toFixed(2)} unit="N·m" color="#f97316" />
                </div>
              </>
            )}

            {/* ── Adaptive charts ────────────────────────────────────────── */}
            {method === 'adaptive' && adaptResult && adaptTraces && (
              <>
                <ChartPanel title="Joint Angles" subtitle="q (rad)" tag="MRAC">
                  <PlotlyChart divId="ad-angles" traces={adaptTraces.angles}
                    title="Joint Angles — Adaptive Controller" yLabel="q (rad)" />
                </ChartPanel>
                <ChartPanel title="Tracking Error + Sliding Variable" subtitle="s = ė + λe">
                  <PlotlyChart divId="ad-sliding" traces={adaptTraces.sliding}
                    title="Sliding Variable  |  s → 0 implies e → 0" yLabel="s (rad/s)" />
                </ChartPanel>

                <ChartPanel title="Parameter Convergence — p̂₁, p̂₂" subtitle="estimated vs true (dashed)"
                  tag="LYAPUNOV">
                  <PlotlyChart divId="ad-params1" traces={adaptTraces.params1}
                    title="p̂₁, p̂₂ Convergence  |  θ̂˙ = Γ·Yᵀ·s" yLabel="value" height={180} />
                </ChartPanel>
                <ChartPanel title="Parameter Convergence — p̂₃, p̂₄, p̂₅" subtitle="estimated vs true (dashed)">
                  <PlotlyChart divId="ad-params2" traces={adaptTraces.params2}
                    title="p̂₃, p̂₄, p̂₅ Convergence" yLabel="value" height={180} />
                </ChartPanel>
                <ChartPanel title="Tracking Error" subtitle="e (rad)">
                  <PlotlyChart divId="ad-errors" traces={adaptTraces.errors}
                    title="Tracking Error" yLabel="e (rad)" height={180} />
                </ChartPanel>

                {/* Convergence bars (final values) */}
                <div className="rounded-lg border border-slate-800/80 bg-[#0d1117] p-4">
                  <div className="text-[8px] font-mono tracking-[0.2em] text-slate-700 uppercase mb-3">
                    Final Parameter Estimates
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    {[
                      ['p₁', adaptResult.p1h.at(-1)??0, DEFAULT_ADAPTIVE.p1, '#22d3ee'],
                      ['p₂', adaptResult.p2h.at(-1)??0, DEFAULT_ADAPTIVE.p2, '#a78bfa'],
                      ['p₃', adaptResult.p3h.at(-1)??0, DEFAULT_ADAPTIVE.p3, '#34d399'],
                      ['p₄', adaptResult.p4h.at(-1)??0, DEFAULT_ADAPTIVE.p4, '#f97316'],
                      ['p₅', adaptResult.p5h.at(-1)??0, DEFAULT_ADAPTIVE.p5, '#fb7185'],
                    ].map(([label, cur, tgt, col]) => (
                      <ConvergenceBar key={label as string} label={label as string}
                        current={cur as number} target={tgt as number} color={col as string} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pb-2">
                  <StatCard label="|e₁| final" value={Math.abs(adaptResult.e1.at(-1)??0).toFixed(4)} unit="rad" color="#22d3ee" />
                  <StatCard label="|e₂| final" value={Math.abs(adaptResult.e2.at(-1)??0).toFixed(4)} unit="rad" color="#f97316" />
                  <StatCard label="|s|_max"    value={Math.max(...adaptResult.s1.map(Math.abs), ...adaptResult.s2.map(Math.abs)).toFixed(3)} unit="rad/s" color="#34d399" />
                </div>
              </>
            )}

            {/* ── NN charts ──────────────────────────────────────────────── */}
            {method === 'nn' && nnResult && nnTraces && (
              <>
                <ChartPanel title="Joint Angles" subtitle="q (rad)" tag="NN ADAPTIVE">
                  <PlotlyChart divId="nn-angles" traces={nnTraces.angles}
                    title="Joint Angles — NN Adaptive Controller" yLabel="q (rad)" />
                </ChartPanel>
                <ChartPanel title="Tracking Error" subtitle="e (rad)">
                  <PlotlyChart divId="nn-errors" traces={nnTraces.errors}
                    title="Tracking Error  |  improves as NN learns" yLabel="e (rad)" />
                </ChartPanel>
                <ChartPanel title="NN Feedforward vs Total Torque" subtitle="τ (N·m)"
                  tag="LEARNING">
                  <PlotlyChart divId="nn-tau" traces={nnTraces.nnVsTrue}
                    title="NN Output (feedforward) vs Total Torque  |  NN learns inverse dynamics" yLabel="τ (N·m)" />
                </ChartPanel>
                <ChartPanel title="Weight Norm ‖W₁‖_F" subtitle="Frobenius norm over time"
                  tag="ADAPTATION">
                  <PlotlyChart divId="nn-wnorm" traces={nnTraces.wNorm}
                    title="Hidden Layer Weight Evolution  |  norm grows as NN adapts" yLabel="‖W₁‖_F" height={180} />
                </ChartPanel>

                <div className="grid grid-cols-4 gap-3 pb-2">
                  <StatCard label="|e₁| initial 1s" value={Math.max(...nnResult.e1.slice(0, 100).map(Math.abs)).toFixed(4)} unit="rad" color="#f97316" />
                  <StatCard label="|e₁| final 1s"   value={Math.max(...nnResult.e1.slice(-100).map(Math.abs)).toFixed(4)}  unit="rad" color="#22d3ee" />
                  <StatCard label="|e₂| initial 1s" value={Math.max(...nnResult.e2.slice(0, 100).map(Math.abs)).toFixed(4)} unit="rad" color="#f97316" />
                  <StatCard label="|e₂| final 1s"   value={Math.max(...nnResult.e2.slice(-100).map(Math.abs)).toFixed(4)}  unit="rad" color="#22d3ee" />
                </div>
              </>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
