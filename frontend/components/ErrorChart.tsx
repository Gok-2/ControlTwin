'use client'

import { useEffect, useRef } from 'react'
import type { RobotState } from '@/types/robot'

interface Props {
  history: RobotState[]
}

const LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  'transparent',
  margin: { l: 48, r: 16, t: 24, b: 40 },
  font: { color: '#64748b', family: 'JetBrains Mono, Fira Code, monospace', size: 10 },
  xaxis: {
    title: { text: 'Time (s)', font: { size: 10, color: '#475569' } },
    gridcolor:     '#1e293b',
    zerolinecolor: '#334155',
    tickfont:      { color: '#475569', size: 9 },
    tickcolor:     '#1e293b',
  },
  yaxis: {
    title: { text: 'Error (rad)', font: { size: 10, color: '#475569' } },
    gridcolor:     '#1e293b',
    zerolinecolor: '#334155',
    tickfont:      { color: '#475569', size: 9 },
    tickcolor:     '#1e293b',
  },
  legend: {
    bgcolor:      'transparent',
    bordercolor:  '#1e293b',
    borderwidth:  1,
    font:         { color: '#94a3b8', size: 10 },
    x: 1, xanchor: 'right', y: 1,
  },
  shapes: [{
    type: 'line' as const,
    x0: 0, x1: 1, xref: 'paper' as const,
    y0: 0, y1: 0,
    line: { color: '#1e293b', width: 1, dash: 'dot' as const },
  }],
}

const CONFIG = { responsive: true, displayModeBar: false, staticPlot: false }

export default function ErrorChart({ history }: Props) {
  const divRef    = useRef<HTMLDivElement>(null)
  const plotlyRef = useRef<any>(null)
  const ready     = useRef(false)

  // Load Plotly once (client-side only)
  useEffect(() => {
    let cancelled = false
    import('plotly.js-dist-min').then((mod) => {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plotlyRef.current = (mod as any).default ?? mod
      if (divRef.current) {
        plotlyRef.current.newPlot(divRef.current, [], LAYOUT, CONFIG)
        ready.current = true
      }
    })
    return () => { cancelled = true }
  }, [])

  // Update chart whenever history grows
  useEffect(() => {
    if (!ready.current || !plotlyRef.current || !divRef.current || history.length === 0) return

    const t   = history.map(s => s.t)
    const e1  = history.map(s => s.e1)
    const e2  = history.map(s => s.e2)

    const traces = [
      {
        x: t, y: e1,
        name: 'e₁ (joint 1)',
        type:  'scatter',
        mode:  'lines',
        line:  { color: '#22d3ee', width: 1.5 },
      },
      {
        x: t, y: e2,
        name: 'e₂ (joint 2)',
        type:  'scatter',
        mode:  'lines',
        line:  { color: '#f97316', width: 1.5 },
      },
    ]

    plotlyRef.current.react(divRef.current, traces, LAYOUT, CONFIG)
  }, [history])

  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] font-mono tracking-widest text-slate-600 mb-1 px-1">
        ERROR PLOT  <span className="text-slate-700">qd − q</span>
      </div>
      <div ref={divRef} className="flex-1 min-h-0 w-full" />
    </div>
  )
}
