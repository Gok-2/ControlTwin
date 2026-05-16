import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ControlTwin',
  description: 'Control Systems Laboratory — Robotics & Intelligent Control',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0f] text-slate-200 antialiased">{children}</body>
    </html>
  )
}
