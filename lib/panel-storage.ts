// ORCALY_PANEL_STORAGE_V1
'use client'

import { supabase } from '@/lib/supabase'

export type PanelUploadPurpose =
  | 'logo'
  | 'banner'
  | 'product-image'
  | 'product-video'
  | 'finance-document'

type PurposeConfig = {
  bucket: string
  folder: string
  maxSize: number
  public: boolean
  mimeTypes?: string[]
  mimePrefix?: string
  extensions?: string[]
  label: string
}

export type PanelUploadResult = {
  ok: true
  purpose: PanelUploadPurpose
  bucket: string
  path: string
  url: string | null
  reference: string | null
  file: {
    name: string
    type: string
    size: number
  }
}

const STORAGE_REFERENCE_PREFIX = 'supabase-storage://'

const purposeConfig: Record<PanelUploadPurpose, PurposeConfig> = {
  logo: {
    bucket: 'logos',
    folder: 'logos',
    maxSize: 5 * 1024 * 1024,
    public: true,
    mimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'],
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
    label: 'logo',
  },
  banner: {
    bucket: 'site-assets',
    folder: 'banners',
    maxSize: 10 * 1024 * 1024,
    public: true,
    mimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    label: 'banner',
  },
  'product-image': {
    bucket: 'produtos',
    folder: 'produtos',
    maxSize: 25 * 1024 * 1024,
    public: true,
    mimePrefix: 'image/',
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'],
    label: 'imagem do produto',
  },
  'product-video': {
    bucket: 'produtos',
    folder: 'videos',
    maxSize: 25 * 1024 * 1024,
    public: true,
    mimePrefix: 'video/',
    extensions: ['mp4', 'webm', 'mov', 'm4v'],
    label: 'video do produto',
  },
  'finance-document': {
    bucket: 'financeiro',
    folder: 'notas',
    maxSize: 25 * 1024 * 1024,
    public: false,
    mimeTypes: ['application/pdf', 'application/xml', 'text/xml'],
    extensions: ['pdf', 'xml'],
    label: 'documento financeiro',
  },
}

function cleanFileName(value: string) {
  const cleaned = String(value || 'arquivo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(-110)

  return cleaned || 'arquivo'
}

function extensionOf(name: string) {
  const parts = String(name || '').toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() || '' : ''
}

function isAllowedFile(file: File, config: PurposeConfig) {
  const type = String(file.type || '').toLowerCase()
  const extension = extensionOf(file.name)

  if (config.mimeTypes?.includes(type)) return true
  if (config.mimePrefix && type.startsWith(config.mimePrefix)) return true
  return Boolean(config.extensions?.includes(extension))
}

function friendlyStorageError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('row-level security') || normalized.includes('not authorized')) {
    return 'Seu perfil nao tem permissao para enviar este arquivo para a empresa atual.'
  }

  if (normalized.includes('payload too large') || normalized.includes('maximum allowed size')) {
    return 'O arquivo ultrapassa o limite permitido para este tipo de envio.'
  }

  return message || 'Erro ao enviar arquivo.'
}

export function makeStorageReference(bucket: string, path: string) {
  return `${STORAGE_REFERENCE_PREFIX}${bucket}/${path}`
}

export function parseStorageReference(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw.startsWith(STORAGE_REFERENCE_PREFIX)) return null

  const remainder = raw.slice(STORAGE_REFERENCE_PREFIX.length)
  const separator = remainder.indexOf('/')

  if (separator <= 0 || separator >= remainder.length - 1) return null

  return {
    bucket: remainder.slice(0, separator),
    path: remainder.slice(separator + 1),
  }
}

export async function uploadPanelFile({
  companyId,
  file,
  purpose,
}: {
  companyId: string
  file: File
  purpose: PanelUploadPurpose
}): Promise<PanelUploadResult> {
  const config = purposeConfig[purpose]

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
    throw new Error('Empresa invalida para envio de arquivo.')
  }

  if (!isAllowedFile(file, config)) {
    throw new Error(`Formato invalido para ${config.label}.`)
  }

  if (file.size > config.maxSize) {
    const maxMb = Math.floor(config.maxSize / (1024 * 1024))
    throw new Error(`O arquivo de ${config.label} precisa ter ate ${maxMb} MB.`)
  }

  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  const path = `${companyId}/${config.folder}/${Date.now()}-${random}-${cleanFileName(file.name)}`

  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (error) {
    throw new Error(friendlyStorageError(error.message))
  }

  const url = config.public
    ? supabase.storage.from(config.bucket).getPublicUrl(path).data.publicUrl
    : null

  return {
    ok: true,
    purpose,
    bucket: config.bucket,
    path,
    url,
    reference: config.public ? null : makeStorageReference(config.bucket, path),
    file: {
      name: file.name,
      type: file.type,
      size: file.size,
    },
  }
}

export async function resolvePanelStorageUrl(value?: string | null, expiresIn = 300) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const reference = parseStorageReference(raw)
  if (!reference) return raw

  const { data, error } = await supabase.storage
    .from(reference.bucket)
    .createSignedUrl(reference.path, expiresIn)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Nao foi possivel abrir o arquivo privado.')
  }

  return data.signedUrl
}
