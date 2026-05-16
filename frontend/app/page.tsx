'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-8 overflow-hidden">

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, #0d2040 1px, transparent 1px), linear-gradient(to bottom, #0d2040 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
        }}
      />

      {/* Radial glow center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(0,100,200,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 text-center mb-20">
        <p className="text-[10px] font-mono tracking-[0.45em] text-cyan-500/50 mb-4">
          CONTROL SYSTEMS LABORATORY
        </p>
        <h1 className="text-5xl font-mono font-bold text-slate-100 tracking-tight">
          Control<span className="text-cyan-400">Twin</span>
        </h1>
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="text-base font-mono font-bold text-white tracking-widest">Sedef Korkmaz</span>
          <span className="text-slate-500 text-sm font-mono">&amp;</span>
          <span className="text-base font-mono font-bold text-white tracking-widest">Göktuğ Usta</span>
        </div>
        <p className="mt-3 text-sm font-mono text-slate-600">
          Select a simulation module to continue
        </p>
      </div>

      {/* Module cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">

        {/* ── Robotic ─────────────────────────────────────────────────────── */}
        <button
          onClick={() => router.push('/robotic')}
          className="group relative flex flex-col items-start p-8 rounded-2xl border border-slate-800
                     bg-slate-900/40 backdrop-blur hover:border-cyan-500/60 hover:bg-slate-900/70
                     transition-all duration-300 text-left cursor-pointer"
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 120% 80% at 0% 0%, rgba(0,204,255,0.07) 0%, transparent 65%)',
            }}
          />

          {/* Icon */}
          <div className="w-11 h-11 mb-6 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M11 4.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-5M18 2.25l3.75 3.75L12 15.75H8.25V12L18 2.25z" />
            </svg>
          </div>

          <p className="text-[9px] font-mono tracking-widest text-cyan-500/50 mb-2">MODULE 01</p>
          <h2 className="text-xl font-mono font-bold text-slate-100 mb-3 group-hover:text-cyan-300 transition-colors">
            Robotic
          </h2>
          <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
            Multi-DOF robot manipulators with 3D workspace visualization,
            manipulability surfaces, and forward kinematics demo.
          </p>

          <div className="mt-8 flex items-center gap-2 text-[9px] font-mono text-cyan-600/50 group-hover:text-cyan-400/80 transition-colors">
            <span>ENTER MODULE</span>
            <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>

        {/* ── Intelligent Control ─────────────────────────────────────────── */}
        <button
          onClick={() => router.push('/intelligent-control')}
          className="group relative flex flex-col items-start p-8 rounded-2xl border border-slate-800
                     bg-slate-900/40 backdrop-blur hover:border-orange-500/60 hover:bg-slate-900/70
                     transition-all duration-300 text-left cursor-pointer"
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 120% 80% at 0% 0%, rgba(249,115,22,0.07) 0%, transparent 65%)',
            }}
          />

          {/* Icon */}
          <div className="w-11 h-11 mb-6 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 13.5h4.5l3-9 3 18 3-12 2.25 3H21" />
            </svg>
          </div>

          <p className="text-[9px] font-mono tracking-widest text-orange-500/50 mb-2">MODULE 02</p>
          <h2 className="text-xl font-mono font-bold text-slate-100 mb-3 group-hover:text-orange-300 transition-colors">
            Intelligent Control
          </h2>
          <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
            Real-time 2-DOF computed torque control with live error tracking,
            interactive gain tuning, and WebSocket telemetry.
          </p>

          <div className="mt-8 flex items-center gap-2 text-[9px] font-mono text-orange-600/50 group-hover:text-orange-400/80 transition-colors">
            <span>ENTER MODULE</span>
            <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-20 text-[9px] font-mono text-slate-800 tracking-widest">
        2-DOF · COMPUTED TORQUE · THREE.JS · PLOTLY · NEXT.JS
      </p>
    </div>
  )
}
