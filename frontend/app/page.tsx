'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'

export default function Home() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`relative min-h-screen flex flex-col items-center justify-center px-8 overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#0a0a0f]' : 'bg-slate-50'
    }`}>

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(to right, #0d2040 1px, transparent 1px), linear-gradient(to bottom, #0d2040 1px, transparent 1px)'
            : 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(0,100,200,0.08) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(8,145,178,0.06) 0%, transparent 70%)',
        }}
      />

      <button
        onClick={toggle}
        className={`absolute top-6 right-6 z-20 w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-200
          ${isDark
            ? 'border-slate-700 bg-slate-900/60 hover:border-cyan-500/60 text-slate-400 hover:text-cyan-300'
            : 'border-slate-300 bg-white/80 hover:border-cyan-500/60 text-slate-500 hover:text-cyan-600 shadow-sm'
          }`}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
          </svg>
        )}
      </button>

      <div className="relative z-10 text-center mb-20">
        <p className={`text-xs font-mono tracking-[0.45em] mb-4 ${isDark ? 'text-cyan-500/60' : 'text-cyan-600/70'}`}>
          CONTROL SYSTEMS LABORATORY
        </p>
        <h1 className={`text-6xl font-mono font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          Control<span className={isDark ? 'text-cyan-400' : 'text-cyan-600'}>Twin</span>
        </h1>
        <div className="mt-5 flex items-center justify-center gap-3">
          <span className={`text-base font-mono font-bold tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>Sedef Korkmaz</span>
          <span className={`text-sm font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>&amp;</span>
          <span className={`text-base font-mono font-bold tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>Göktuğ Usta</span>
        </div>
        <p className={`mt-3 text-sm font-mono ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
          Select a simulation module to continue
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">

        <button
          onClick={() => router.push('/robotic')}
          className={`group relative flex flex-col items-start p-8 rounded-2xl border transition-all duration-300 text-left cursor-pointer
            ${isDark
              ? 'border-slate-800 bg-slate-900/40 backdrop-blur hover:border-cyan-500/60 hover:bg-slate-900/70'
              : 'border-slate-200 bg-white/80 backdrop-blur hover:border-cyan-400/80 hover:bg-white shadow-sm hover:shadow-cyan-100'
            }`}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ background: isDark ? 'radial-gradient(ellipse 120% 80% at 0% 0%, rgba(0,204,255,0.07) 0%, transparent 65%)' : 'radial-gradient(ellipse 120% 80% at 0% 0%, rgba(8,145,178,0.05) 0%, transparent 65%)' }} />
          <div className={`w-12 h-12 mb-6 rounded-xl border flex items-center justify-center ${isDark ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'}`}>
            <svg className={`w-6 h-6 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-5M18 2.25l3.75 3.75L12 15.75H8.25V12L18 2.25z" />
            </svg>
          </div>
          <p className={`text-xs font-mono tracking-widest mb-2 ${isDark ? 'text-cyan-500/50' : 'text-cyan-500/70'}`}>MODULE 01</p>
          <h2 className={`text-xl font-mono font-bold mb-3 transition-colors ${isDark ? 'text-slate-100 group-hover:text-cyan-300' : 'text-slate-800 group-hover:text-cyan-600'}`}>Robotic</h2>
          <p className={`text-sm font-mono leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Multi-DOF manipulators. 3D workspace, constrained reachability,
            manipulability surfaces, FK/IK, and customizable joint builder.
          </p>
          <div className={`mt-8 flex items-center gap-2 text-xs font-mono transition-colors ${isDark ? 'text-cyan-600/50 group-hover:text-cyan-400/80' : 'text-cyan-500/60 group-hover:text-cyan-500'}`}>
            <span>ENTER MODULE</span>
            <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>

        <button
          onClick={() => router.push('/intelligent-control')}
          className={`group relative flex flex-col items-start p-8 rounded-2xl border transition-all duration-300 text-left cursor-pointer
            ${isDark
              ? 'border-slate-800 bg-slate-900/40 backdrop-blur hover:border-orange-500/60 hover:bg-slate-900/70'
              : 'border-slate-200 bg-white/80 backdrop-blur hover:border-orange-400/80 hover:bg-white shadow-sm hover:shadow-orange-100'
            }`}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{ background: isDark ? 'radial-gradient(ellipse 120% 80% at 0% 0%, rgba(249,115,22,0.07) 0%, transparent 65%)' : 'radial-gradient(ellipse 120% 80% at 0% 0%, rgba(249,115,22,0.05) 0%, transparent 65%)' }} />
          <div className={`w-12 h-12 mb-6 rounded-xl border flex items-center justify-center ${isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
            <svg className={`w-6 h-6 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5h4.5l3-9 3 18 3-12 2.25 3H21" />
            </svg>
          </div>
          <p className={`text-xs font-mono tracking-widest mb-2 ${isDark ? 'text-orange-500/50' : 'text-orange-500/70'}`}>MODULE 02</p>
          <h2 className={`text-xl font-mono font-bold mb-3 transition-colors ${isDark ? 'text-slate-100 group-hover:text-orange-300' : 'text-slate-800 group-hover:text-orange-500'}`}>Intelligent Control</h2>
          <p className={`text-sm font-mono leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Computed Torque, MRAC Adaptive, and Neural Network adaptive control —
            compare all three with live convergence and parameter learning plots.
          </p>
          <div className={`mt-8 flex items-center gap-2 text-xs font-mono transition-colors ${isDark ? 'text-orange-600/50 group-hover:text-orange-400/80' : 'text-orange-500/60 group-hover:text-orange-500'}`}>
            <span>ENTER MODULE</span>
            <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>
      </div>

      <p className={`relative z-10 mt-20 text-xs font-mono tracking-widest ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>
        CTC · MRAC · NN ADAPTIVE · THREE.JS · PLOTLY · NEXT.JS
      </p>
    </div>
  )
}
