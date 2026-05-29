'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import { RobotArmBg } from '@/components/RobotArmBg'

export default function Home() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={`relative min-h-screen flex flex-col items-center justify-center px-8 overflow-hidden transition-colors duration-300 ${
      isDark ? 'bg-[#080810]' : 'bg-slate-50'
    }`}>

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(to right, #0d2040 1px, transparent 1px), linear-gradient(to bottom, #0d2040 1px, transparent 1px)'
            : 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(0,100,200,0.07) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(8,145,178,0.05) 0%, transparent 70%)',
        }}
      />

      {/* Robot arm background — bottom-right */}
      <div className={`absolute bottom-0 right-0 w-[420px] pointer-events-none
                        ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
        <RobotArmBg opacity={isDark ? 0.07 : 0.055} className="w-full h-full" />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className={`absolute top-5 right-5 z-20 w-9 h-9 rounded border flex items-center justify-center transition-all duration-200
          ${isDark
            ? 'border-slate-700 bg-slate-900/60 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300'
            : 'border-slate-300 bg-white/80 hover:border-cyan-500/50 text-slate-500 hover:text-cyan-600 shadow-sm'
          }`}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
          </svg>
        )}
      </button>

      {/* System tag line */}
      <div className={`absolute top-5 left-6 z-20 flex items-center gap-3 font-mono`}>
        <span className={`text-[9px] tracking-[0.3em] uppercase ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          CTRL-SYS LAB
        </span>
        <span className={`text-[9px] ${isDark ? 'text-slate-800' : 'text-slate-300'}`}>·</span>
        <span className={`text-[9px] tracking-[0.2em] ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>
          v2025
        </span>
      </div>

      {/* Hero */}
      <div className="relative z-10 text-center mb-16">
        <p className={`text-[10px] font-mono tracking-[0.4em] mb-5 ${isDark ? 'text-cyan-500/70' : 'text-cyan-600/80'}`}>
          CONTROL SYSTEMS LABORATORY
        </p>
        <h1 className={`text-5xl font-mono font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          Control<span className={isDark ? 'text-cyan-400' : 'text-cyan-600'}>Twin</span>
        </h1>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Sedef Korkmaz
          </span>
          <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>&amp;</span>
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Göktuğ Usta
          </span>
        </div>
        <p className={`mt-3 text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
          Select a simulation module to continue
        </p>
      </div>

      {/* Module cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-xl">

        {/* Robotic */}
        <button
          onClick={() => router.push('/robotic')}
          className={`group relative flex flex-col items-start p-7 rounded-xl border transition-all duration-200 text-left cursor-pointer
            ${isDark
              ? 'border-slate-700/70 bg-[#0d1117]/80 backdrop-blur hover:border-cyan-500/50 hover:bg-[#0d1117]'
              : 'border-slate-200 bg-white/90 backdrop-blur hover:border-cyan-400/70 hover:bg-white shadow-sm'
            }`}
        >
          <div className={`w-10 h-10 mb-5 rounded border flex items-center justify-center
            ${isDark ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200'}`}>
            <svg className={`w-5 h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-5M18 2.25l3.75 3.75L12 15.75H8.25V12L18 2.25z" />
            </svg>
          </div>
          <p className={`text-[9px] font-mono tracking-[0.25em] mb-2 ${isDark ? 'text-cyan-500/60' : 'text-cyan-500/80'}`}>
            MODULE 01
          </p>
          <h2 className={`text-lg font-semibold mb-2 transition-colors
            ${isDark ? 'text-slate-100 group-hover:text-cyan-300' : 'text-slate-800 group-hover:text-cyan-600'}`}>
            Robotic
          </h2>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Multi-DOF manipulators — workspace, FK/IK, joint builder.
          </p>
          <div className={`mt-6 flex items-center gap-2 text-[10px] font-mono transition-colors
            ${isDark ? 'text-slate-600 group-hover:text-cyan-400' : 'text-slate-400 group-hover:text-cyan-600'}`}>
            <span>ENTER MODULE</span>
            <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>

        {/* Intelligent Control */}
        <button
          onClick={() => router.push('/intelligent-control')}
          className={`group relative flex flex-col items-start p-7 rounded-xl border transition-all duration-200 text-left cursor-pointer
            ${isDark
              ? 'border-slate-700/70 bg-[#0d1117]/80 backdrop-blur hover:border-orange-500/50 hover:bg-[#0d1117]'
              : 'border-slate-200 bg-white/90 backdrop-blur hover:border-orange-400/70 hover:bg-white shadow-sm'
            }`}
        >
          <div className={`w-10 h-10 mb-5 rounded border flex items-center justify-center
            ${isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
            <svg className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5h4.5l3-9 3 18 3-12 2.25 3H21" />
            </svg>
          </div>
          <p className={`text-[9px] font-mono tracking-[0.25em] mb-2 ${isDark ? 'text-orange-500/60' : 'text-orange-500/80'}`}>
            MODULE 02
          </p>
          <h2 className={`text-lg font-semibold mb-2 transition-colors
            ${isDark ? 'text-slate-100 group-hover:text-orange-300' : 'text-slate-800 group-hover:text-orange-500'}`}>
            Intelligent Control
          </h2>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            CTC · MRAC · NN adaptive — live convergence plots.
          </p>
          <div className={`mt-6 flex items-center gap-2 text-[10px] font-mono transition-colors
            ${isDark ? 'text-slate-600 group-hover:text-orange-400' : 'text-slate-400 group-hover:text-orange-500'}`}>
            <span>ENTER MODULE</span>
            <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
          </div>
        </button>
      </div>

      {/* Footer tag */}
      <p className={`relative z-10 mt-16 text-[9px] font-mono tracking-[0.2em] ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>
        CTC · MRAC · NN ADAPTIVE · THREE.JS · PLOTLY · NEXT.JS
      </p>
    </div>
  )
}
