'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RobotState, ControlGains } from '@/types/robot'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'
const MAX_HISTORY = 360  // 6 seconds at 60 fps

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const [robotState, setRobotState] = useState<RobotState | null>(null)
  const [history, setHistory] = useState<RobotState[]>([])
  const [connected, setConnected] = useState(false)
  const [gains, setGains] = useState<ControlGains>({ Kr: 10, alpha: 5 })

  useEffect(() => {
    let socket: WebSocket
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      socket = new WebSocket(WS_URL)
      wsRef.current = socket

      socket.onopen = () => setConnected(true)

      socket.onmessage = (ev) => {
        const data: RobotState = JSON.parse(ev.data)
        setRobotState(data)
        setHistory(prev => {
          const next = prev.length >= MAX_HISTORY
            ? [...prev.slice(prev.length - MAX_HISTORY + 1), data]
            : [...prev, data]
          return next
        })
      }

      socket.onclose = () => {
        setConnected(false)
        retryTimer = setTimeout(connect, 1500)
      }

      socket.onerror = () => socket.close()
    }

    connect()

    return () => {
      clearTimeout(retryTimer)
      socket?.close()
    }
  }, [])

  const sendGains = useCallback((patch: Partial<ControlGains>) => {
    setGains(prev => {
      const next = { ...prev, ...patch }
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(next))
      }
      return next
    })
  }, [])

  return { robotState, history, connected, gains, sendGains }
}
