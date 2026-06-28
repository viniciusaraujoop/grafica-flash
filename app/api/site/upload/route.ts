import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, getRequester, getSupabaseAdmin } from '@/lib/company-access'

const BUCKET = 'site-assets'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 10 * 1024 * 1024

function safeName(value: string) {
  return String(value || 'imagem')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90)
}

function extensionFromMime(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  if (type === 'image/gif') return 'gif'
  return 'jpg'
}

async function ensureBucket(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  })

  if (
    error
    && !String(error.message || '').toLowerCase().includes('already')
    && !String(error.message || '').toLowerCase().includes('exists')
  ) {
    console.warn('[Orçaly Site Upload] Bucket não criado pela API, tentando usar existente:', error.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(request, supabaseAdmin)

    if (!requester) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const access = await getCompanyAccess(supabaseAdmin, requester.id, requester.email)

    if (!access.company?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    if (!access.canManage) {
      return NextResponse.json({ error: 'Seu perfil não pode enviar imagens do site.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const purpose = safeName(String(formData.get('purpose') || 'site'))

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato inválido. Use PNG, JPG, WEBP ou GIF.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Imagem muito grande. Envie arquivo de até 10MB.' }, { status: 400 })
    }

    await ensureBucket(supabaseAdmin)

    const ext = extensionFromMime(file.type)
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const filename = safeName(file.name || `${purpose}.${ext}`)
    const path = `${access.company.id}/${purpose}-${random}-${filename}.${ext}`

    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path)

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      path,
      bucket: BUCKET,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar imagem.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
