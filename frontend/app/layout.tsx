import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'

export const metadata: Metadata = {
  title: 'ControlTwin',
  description: 'Control Systems Laboratory — Robotics & Intelligent Control',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased" style={{ backgroundColor: 'inherit', color: 'inherit' }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
