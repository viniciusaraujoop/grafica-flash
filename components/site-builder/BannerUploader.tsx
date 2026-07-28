/* eslint-disable @next/next/no-img-element */
'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { supabase } from '@/lib/supabase'

type BannerUploaderProps = {
  companyId?: string | null
  value?: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
}

const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const maxSize = 8 * 1024 * 1024

function cleanFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

export default function BannerUploader({
  companyId,
  value,
  onChange,
  disabled,
}: BannerUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  async function uploadFile(file: File) {
    setError('')

    if (!companyId) {
      setError('Empresa ainda não foi carregada.')
      return
    }

    if (!allowedTypes.includes(file.type)) {
      setError('Envie um banner em PNG, JPG ou WEBP.')
      return
    }

    if (file.size > maxSize) {
      setError('O banner precisa ter até 8 MB.')
      return
    }

    setUploading(true)

    try {
      const fileName = cleanFileName(file.name)
      const path = `${companyId}/banners/${Date.now()}-${fileName}`

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
      setError(err instanceof Error ? err.message : 'Erro ao enviar banner.')
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
    <div className="rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-5">
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
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
        className={`overflow-hidden rounded-[1.5rem] border-2 border-dashed transition ${
          dragging ? 'border-[#05245c] bg-white' : 'border-blue-100 bg-white/80'
        }`}
      >
        {value ? (
          <img
            src={value}
            alt="Banner principal da vitrine"
            className="h-56 w-full object-cover sm:h-64"
          />
        ) : (
          <div className="grid h-56 place-items-center bg-gradient-to-br from-blue-50 to-slate-100 px-6 text-center sm:h-64">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-3xl shadow-lg">
                🖼️
              </div>
              <p className="mt-4 text-lg font-black text-[#071b3a]">Banner principal da vitrine</p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                Recomendado: 1600 × 600 px.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-blue-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-[#071b3a]">Imagem de capa</p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Fica no topo, atrás da logo e das informações da empresa.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {uploading ? 'Enviando...' : value ? 'Trocar banner' : 'Selecionar banner'}
            </button>

            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={disabled || uploading}
                className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c] disabled:opacity-60"
              >
                Remover
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
    </div>
  )
}
