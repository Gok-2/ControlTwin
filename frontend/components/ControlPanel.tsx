'use client'

import type { ControlGains } from '@/types/robot'

interface Props {
  gains: ControlGains
  onGainsChange: (patch: Partial<ControlGains>) => void
}

export default function ControlPanel({ gains, onGainsChange }: Props) {
  return (
    <div className="space-y-7">
      <div className="text-[10px] font-mono tracking-widest text-slate-600">
        CONTROL GAINS
      </div>

      <GainSlider
        label="α  Alpha Gain"
        symbol="α"
        value={gains.alpha}
        min={1}
        max={50}
        step={0.1}
        accentColor="#22d3ee"
        onChange={v => onGainsChange({ alpha: v })}
      />

      <GainSlider
        label="Kᵣ  Rate Gain"
        symbol="Kᵣ"
        value={gains.Kr}
        min={1}
        max={50}
        step={0.1}
        accentColor="#f97316"
        onChange={v => onGainsChange({ Kr: v })}
      />
    </div>
  )
}

/* ── Slider ──────────────────────────────────────────────────────────────── */

interface SliderProps {
  label: string
  symbol: string
  value: number
  min: number
  max: number
  step: number
  accentColor: string
  onChange: (v: number) => void
}

function GainSlider({ label, symbol, value, min, max, step, accentColor, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2.5">
      {/* Header row */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-mono text-slate-400">{label}</span>
        <span
          className="text-base font-mono font-bold tabular-nums"
          style={{ color: accentColor }}
        >
          {symbol} = {value.toFixed(1)}
        </span>
      </div>

      {/* Track + invisible input */}
      <div className="relative h-8 flex items-center select-none">

        {/* Track background */}
        <div className="absolute w-full h-[3px] rounded-full bg-slate-800" />

        {/* Track fill with glow */}
        <div
          className="absolute h-[3px] rounded-full transition-none"
          style={{
            width:     `${pct}%`,
            background: `linear-gradient(90deg, ${accentColor}55, ${accentColor})`,
            boxShadow:  `0 0 8px ${accentColor}70`,
          }}
        />

        {/* Thumb dot */}
        <div
          className="absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none"
          style={{
            left:       `${pct}%`,
            background:  accentColor,
            boxShadow:  `0 0 12px ${accentColor}, 0 0 4px ${accentColor}`,
            border:     '2px solid rgba(255,255,255,0.15)',
          }}
        />

        {/* Transparent native input — covers full area for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
      </div>

      {/* Min / max labels */}
      <div className="flex justify-between text-[9px] font-mono text-slate-700">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
