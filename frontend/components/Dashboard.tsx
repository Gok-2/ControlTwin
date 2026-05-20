'use client'

// Intelligent Control — 2-DOF Computed Torque Controller
// Parameters editable → RK4 simulation runs in browser → Plotly graphs

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { runSimulation, analyzeStability, DEFAULT_PARAMS, type SimParams, type SimResult } from '@/lib/robotSim'
import { useTheme } from '@/context/ThemeContext'

// ── Plotly chart ──────────────────────────────────────────────────────────────

interface Trace {
  x: number[]; y: number[]; name: string; color: string; dash?: string
}

interface ChartProps {
  traces: Trace[]
  title: string
  yLabel: string
  divId: string
  isDark: boolean
}

function PlotlyChart({ traces, title, yLabel, divId, isDark }: ChartProps) {
  const divRef = useRef<HTMLDivElement>(null)

  const renderChart = useCallback(() => {
    if (!divRef.current || !traces.length) return
    import('plotly.js-dist-min').then((Plotly: any) => {
      const data = traces.map(tr => ({
        x: tr.x, y: tr.y, name: tr.name, type: 'scatter', mode: 'lines',
        line: { color: tr.color, width: 1.5, dash: tr.dash ?? 'solid' },
      }))
      const layout = isDark ? {
        paper_bgcolor: '#0a0a0f',
        plot_bgcolor:  '#0d1117',
        margin: { t: 28, r: 16, b: 40, l: 52 },
        title: { text: title, font: { family: 'JetBrains Mono, monospace', size: 11, color: '#64748b' }, x: 0.01 },
        xaxis: {
          title: { text: 't (s)', font: { size: 10, color: '#475569' } },
          color: '#334155', gridcolor: '#1e293b', zerolinecolor: '#334155',
          tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#475569' },
        },
        yaxis: {
          title: { text: yLabel, font: { size: 10, color: '#475569' } },
          color: '#334155', gridcolor: '#1e293b', zerolinecolor: '#334155',
          tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#475569' },
        },
        legend: {
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#64748b' },
          bgcolor: 'rgba(0,0,0,0)', bordercolor: '#1e293b', borderwidth: 1,
          x: 1, xanchor: 'right', y: 1,
        },
        height: 220,
      } : {
        paper_bgcolor: '#f8fafc',
        plot_bgcolor:  '#ffffff',
        margin: { t: 28, r: 16, b: 40, l: 52 },
        title: { text: title, font: { family: 'JetBrains Mono, monospace', size: 11, color: '#64748b' }, x: 0.01 },
        xaxis: {
          title: { text: 't (s)', font: { size: 10, color: '#64748b' } },
          color: '#94a3b8', gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1',
          tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#64748b' },
        },
        yaxis: {
          title: { text: yLabel, font: { size: 10, color: '#64748b' } },
          color: '#94a3b8', gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1',
          tickfont: { family: 'JetBrains Mono, monospace', size: 9, color: '#64748b' },
        },
        legend: {
          font: { family: 'JetBrains Mono, monospace', size: 9, color: '#64748b' },
          bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#e2e8f0', borderwidth: 1,
          x: 1, xanchor: 'right', y: 1,
        },
        height: 220,
      }
      const config = { displayModeBar: false, responsive: true }
      Plotly.react(divRef.current, data, layout, config)
    })
  }, [traces, title, yLabel, isDark])

  const ref = useCallback((node: HTMLDivElement | null) => {
    (divRef as any).current = node
    if (node) renderChart()
  }, [renderChart])

  return <div ref={ref} id={divId} className="w-full" style={{ minHeight: 220 }} />
}

// ── Parameter field ───────────────────────────────────────────────────────────

function ParamField({
  label, symbol, unit, value, onChange, min, max, step = 0.001,
}: {
  label: string; symbol: string; unit: string; value: number
  onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 text-right text-[10px] font-mono text-slate-500 dark:text-slate-500 shrink-0">{symbol}</div>
      <input
        type="number" step={step} min={min} max={max}
        value={value}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }}
        className="w-24 bg-slate-100 dark:bg-[#0a0a0f] border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-[10px] font-mono
                   text-slate-800 dark:text-slate-200 tabular-nums focus:outline-none focus:border-cyan-500/50 text-right"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono text-slate-500 dark:text-slate-600 leading-none">{label}</div>
        <div className="text-[8px] font-mono text-slate-400 dark:text-slate-800 leading-none mt-0.5">{unit}</div>
      </div>
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <div className="text-[8px] font-mono tracking-[0.25em] text-slate-400 dark:text-slate-700 uppercase mt-4 mb-1.5">
      {label}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<SimResult | null>(null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const set = (key: keyof SimParams) => (v: number) =>
    setParams(prev => ({ ...prev, [key]: v }))

  const setQ0 = (i: 0|1) => (v: number) =>
    setParams(prev => { const q0 = [...prev.q0] as [number,number]; q0[i] = v; return { ...prev, q0 } })

  const setDQ0 = (i: 0|1) => (v: number) =>
    setParams(prev => { const dq0 = [...prev.dq0] as [number,number]; dq0[i] = v; return { ...prev, dq0 } })

  const run = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const t0 = performance.now()
      const res = runSimulation(params)
      setElapsed(performance.now() - t0)
      setResult(res)
      setRunning(false)
    }, 20)  // yield to UI before heavy computation
  }, [params])

  const stab = analyzeStability(params.Kr, params.alpha)

  // Build traces from result
  const makeTraces = (res: SimResult) => ({
    angles: [
      { x: res.t, y: res.q1,  name: 'q₁ actual',  color: '#22d3ee', dash: 'solid'  },
      { x: res.t, y: res.qd1, name: 'q₁ desired', color: '#22d3ee', dash: 'dot'    },
      { x: res.t, y: res.q2,  name: 'q₂ actual',  color: '#f97316', dash: 'solid'  },
      { x: res.t, y: res.qd2, name: 'q₂ desired', color: '#f97316', dash: 'dot'    },
    ] as Trace[],
    errors: [
      { x: res.t, y: res.e1, name: 'e₁ = q_d1 − q₁', color: '#22d3ee' },
      { x: res.t, y: res.e2, name: 'e₂ = q_d2 − q₂', color: '#f97316' },
    ] as Trace[],
    torques: [
      { x: res.t, y: res.tau1, name: 'τ₁ (N·m)', color: '#22d3ee' },
      { x: res.t, y: res.tau2, name: 'τ₂ (N·m)', color: '#f97316' },
    ] as Trace[],
  })

  const traces = result ? makeTraces(result) : null

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 h-10
                      bg-white/80 dark:bg-black/60 backdrop-blur border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-[10px] font-mono text-slate-500 dark:text-slate-600 hover:text-orange-400 transition-colors"
          >
            ← HOME
          </button>
          <span className="text-slate-300 dark:text-slate-800">|</span>
          <span className="text-[11px] font-mono font-bold tracking-widest text-orange-400">
            INTELLIGENT CONTROL
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-600">2-DOF · Computed Torque · RK4</span>
        </div>

        {elapsed !== null && (
          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-600">
            computed in <span className="text-emerald-500">{elapsed.toFixed(0)} ms</span>
          </span>
        )}
      </div>

      {/* ── Left parameter panel ─────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 h-full pt-10 bg-white dark:bg-[#0d1117] border-r border-slate-200 dark:border-slate-800/80
                      overflow-y-auto flex flex-col">
        <div className="px-4 pt-4 flex-1">

          {/* System parameters */}
          <SectionHead label="System Parameters" />
          <div className="space-y-1.5">
            <ParamField label="Joint 1 composite inertia" symbol="p₁" unit="kg·m²"
              value={params.p1} onChange={set('p1')} min={0.001} />
            <ParamField label="Joint 2 inertia"           symbol="p₂" unit="kg·m²"
              value={params.p2} onChange={set('p2')} min={0.001} />
            <ParamField label="Coupling inertia"          symbol="p₃" unit="kg·m²"
              value={params.p3} onChange={set('p3')} min={0} />
            <ParamField label="Viscous friction joint 1"  symbol="p₄" unit="N·m·s/rad"
              value={params.p4} onChange={set('p4')} min={0} />
            <ParamField label="Viscous friction joint 2"  symbol="p₅" unit="N·m·s/rad"
              value={params.p5} onChange={set('p5')} min={0} />
          </div>

          {/* Control gains */}
          <SectionHead label="Control Gains" />
          <div className="space-y-1.5">
            <ParamField label="Derivative gain"    symbol="Kᵣ" unit="—"
              value={params.Kr}    onChange={set('Kr')}    min={0} step={0.5} />
            <ParamField label="Proportional gain"  symbol="α"  unit="—"
              value={params.alpha} onChange={set('alpha')} min={0} step={0.5} />
          </div>

          {/* Stability analysis (live) */}
          <div className="mt-3 rounded border border-slate-200 dark:border-slate-800/60 bg-slate-100/50 dark:bg-black/30 px-3 py-2.5 space-y-1">
            <div className="text-[8px] font-mono tracking-[0.2em] text-slate-400 dark:text-slate-700 uppercase mb-1.5">
              Closed-Loop Analysis  (ë + Kᵣė + αe = 0)
            </div>
            <AnalysisRow label="ωₙ = √α"         value={stab.wn.toFixed(3)}    unit="rad/s" />
            <AnalysisRow label="ζ = Kᵣ/(2ωₙ)"   value={stab.zeta.toFixed(3)}   unit="" />
            <AnalysisRow label="Regime"            value={stab.regime}           unit="" />
            <div className="text-[9px] font-mono text-slate-500 dark:text-slate-600 pt-1 leading-tight break-all">
              {stab.lambda}
            </div>
            <div className={`text-[9px] font-mono font-bold mt-1
              ${stab.stable ? 'text-emerald-500' : 'text-red-500'}`}>
              {stab.stable ? '✓ STABLE' : '✗ UNSTABLE'}
            </div>
          </div>

          {/* Simulation settings */}
          <SectionHead label="Simulation" />
          <div className="space-y-1.5">
            <ParamField label="Duration"          symbol="T"    unit="s"       value={params.tEnd} onChange={set('tEnd')} min={0.1} max={60} step={1} />
            <ParamField label="Timestep (RK4)"    symbol="dt"   unit="s"       value={params.dt}   onChange={set('dt')}   min={0.001} max={0.1} step={0.001} />
            <ParamField label="Initial angle q₁"  symbol="q₁₀" unit="rad"     value={params.q0[0]} onChange={setQ0(0)} step={0.1} />
            <ParamField label="Initial angle q₂"  symbol="q₂₀" unit="rad"     value={params.q0[1]} onChange={setQ0(1)} step={0.1} />
            <ParamField label="Initial vel. q̇₁"  symbol="q̇₁₀" unit="rad/s"  value={params.dq0[0]} onChange={setDQ0(0)} step={0.1} />
            <ParamField label="Initial vel. q̇₂"  symbol="q̇₂₀" unit="rad/s"  value={params.dq0[1]} onChange={setDQ0(1)} step={0.1} />
          </div>

          {/* Step count info */}
          <div className="mt-2 text-[8px] font-mono text-slate-400 dark:text-slate-700">
            {Math.floor(params.tEnd / params.dt).toLocaleString()} integration steps
          </div>
        </div>

        {/* Run button */}
        <div className="px-4 pb-5 pt-3 shrink-0">
          <button
            onClick={run}
            disabled={running}
            className={`w-full py-2.5 rounded font-mono font-bold text-[11px] tracking-widest transition-all
              ${running
                ? 'bg-orange-500/20 text-orange-500/50 cursor-not-allowed border border-orange-500/20'
                : 'bg-orange-500/15 text-orange-400 border border-orange-500/40 hover:bg-orange-500/25 hover:border-orange-400/60 active:scale-[0.98]'
              }`}
          >
            {running ? 'HESAPLANIYOR...' : 'SİMÜLASYON ÇALIŞTIR'}
          </button>
        </div>
      </div>

      {/* ── Right chart area ─────────────────────────────────────────────────── */}
      <div className="flex-1 pt-10 overflow-y-auto bg-slate-50 dark:bg-[#0a0a0f]">
        {!result ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-700 tracking-widest">
              SİMÜLASYON HENÜZ ÇALIŞTIRILMADI
            </div>
            <div className="text-[9px] font-mono text-slate-400 dark:text-slate-800">
              Parametreleri ayarlayın ve &ldquo;SİMÜLASYON ÇALIŞTIR&rdquo; butonuna basın
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">

            {/* Chart 1: Joint Angles */}
            <ChartPanel title="Eklem Açıları" subtitle="q (rad)">
              <PlotlyChart
                divId="chart-angles"
                traces={traces!.angles}
                title="Eklem Açıları — Gerçek vs İstenen"
                yLabel="q (rad)"
                isDark={isDark}
              />
            </ChartPanel>

            {/* Chart 2: Tracking Errors */}
            <ChartPanel title="Takip Hatası" subtitle="e = q_d − q (rad)">
              <PlotlyChart
                divId="chart-errors"
                traces={traces!.errors}
                title="Takip Hatası  |  eᵢ = q_dᵢ − qᵢ"
                yLabel="e (rad)"
                isDark={isDark}
              />
            </ChartPanel>

            {/* Chart 3: Control Torques */}
            <ChartPanel title="Kontrol Momenti" subtitle="τ (N·m)">
              <PlotlyChart
                divId="chart-torques"
                traces={traces!.torques}
                title="Kontrol Momentleri  |  τ = M(q)·v + Vm(q,q̇)·q̇ + Fd·q̇"
                yLabel="τ (N·m)"
                isDark={isDark}
              />
            </ChartPanel>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 pt-1 pb-2">
              <StatCard label="|e₁| max"    value={Math.max(...result.e1.map(Math.abs)).toFixed(4)} unit="rad" color="#22d3ee" />
              <StatCard label="|e₂| max"    value={Math.max(...result.e2.map(Math.abs)).toFixed(4)} unit="rad" color="#f97316" />
              <StatCard label="|τ₁| max"    value={Math.max(...result.tau1.map(Math.abs)).toFixed(2)} unit="N·m" color="#22d3ee" />
              <StatCard label="|τ₂| max"    value={Math.max(...result.tau2.map(Math.abs)).toFixed(2)} unit="N·m" color="#f97316" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function ChartPanel({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0d1117] overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/60 flex items-baseline gap-2">
        <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">{title}</span>
        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-600">{subtitle}</span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

function AnalysisRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[9px] font-mono text-slate-500 dark:text-slate-600">{label}</span>
      <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 tabular-nums">
        {value}{unit && <span className="text-slate-400 dark:text-slate-600 ml-1 text-[8px]">{unit}</span>}
      </span>
    </div>
  )
}

function StatCard({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string
}) {
  return (
    <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-black/30 px-3 py-2.5">
      <div className="text-[8px] font-mono text-slate-500 dark:text-slate-600 mb-1">{label}</div>
      <div className="text-base font-mono font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[8px] font-mono text-slate-400 dark:text-slate-700">{unit}</div>
    </div>
  )
}
