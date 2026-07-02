'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { supabase } from '@/lib/supabase'

type LogoUploaderProps = {
  companyId?: string | null
  value?: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}

const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const maxSize = 5 * 1024 * 1024

function cleanFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

export default function LogoUploader({ companyId, value, onChange, disabled }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  async function uploadFile(file: File) {
    setError('')

    if (!companyId) {
      setError('Empresa não carregada ainda.')
      return
    }

    if (!allowedTypes.includes(file.type)) {
      setError('Envie uma logo em PNG, JPG, WEBP ou SVG.')
      return
    }

    if (file.size > maxSize) {
      setError('A logo precisa ter até 5 MB.')
      return
    }

    setUploading(true)

    try {
      const fileName = cleanFileName(file.name)
      const path = `${companyId}/logos/${Date.now()}-${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('produtos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('produtos').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar logo.')
    }

    setUploading(false)
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void uploadFile(file)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (file) void uploadFile(file)
  }

  return (
    <div className="rounded-[1.6rem] border border-blue-100 bg-[#f8fbff] p-5">
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleInput}
        className="hidden"
        disabled={disabled || uploading}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-[1.4rem] border-2 border-dashed p-5 text-center transition ${
          dragging ? 'border-[#05245c] bg-white' : 'border-blue-100 bg-white/70'
        }`}
      >
        {value ? (
          <div className="mx-auto mb-4 grid h-28 w-28 place-items-center rounded-[1.5rem] bg-white shadow-lg ring-1 ring-blue-100">
            <img src={value} alt="Logo da empresa" className="max-h-[78%] max-w-[78%] object-contain" />
          </div>
        ) : (
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[1.5rem] bg-blue-50 text-3xl">🏷️</div>
        )}

        <h3 className="text-lg font-black tracking-[-0.03em] text-[#071b3a]">Envie a logo da sua empresa</h3>
        <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-6 text-slate-500">
          PNG, JPG, WEBP ou SVG. Recomendado: fundo transparente.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {uploading ? 'Enviando...' : value ? 'Trocar logo' : 'Selecionar logo'}
          </button>

          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled || uploading}
              className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c] disabled:opacity-60"
            >
              Remover logo
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
    </div>
  )
}
