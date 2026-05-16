import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Robot Control System',
  description: '2-DOF Computed Torque Control — Real-Time Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0f] text-slate-200 antialiased">{children}</body>
    </html>
  )
}
