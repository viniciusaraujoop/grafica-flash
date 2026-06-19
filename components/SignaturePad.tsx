'use client'

import { useRef, useState } from 'react'

type SignaturePadProps = {
  value?: string
  onChange: (value: string) => void
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [drawing, setDrawing] = useState(false)

  function getContext() {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1

    if (canvas.width !== Math.floor(rect.width * ratio) || canvas.height !== Math.floor(rect.height * ratio)) {
      const current = canvas.toDataURL()
      canvas.width = Math.floor(rect.width * ratio)
      canvas.height = Math.floor(rect.height * ratio)

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.5
        ctx.strokeStyle = '#071b3a'

        if (value || current) {
          const img = new Image()
          img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
          img.src = value || current
        }
      }
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#071b3a'

    return ctx
  }

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getContext()
    if (!ctx) return

    const p = point(event)
    setDrawing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return

    const ctx = getContext()
    if (!ctx) return

    const p = point(event)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    onChange(canvasRef.current?.toDataURL('image/png') || '')
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    setDrawing(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
    onChange(canvasRef.current?.toDataURL('image/png') || '')
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="h-44 w-full rounded-xl bg-slate-50"
        style={{ touchAction: 'none' }}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-500">Assine com o dedo, mouse ou caneta.</p>
        <button type="button" onClick={clear} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
          Limpar
        </button>
      </div>
    </div>
  )
}
