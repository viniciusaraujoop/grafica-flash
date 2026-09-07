import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { requireSameOrigin } from '@/lib/orcaly-security'
import { enforceRateLimit } from '@/lib/security/rate-limit'

const BUCKET = 'artes'
const MAX_SIZE = 10 * 1024 * 1024

const ALLOWED = {
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': {
    extension: 'png',
    signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
} as const

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte)
}

function validMagic(bytes: Uint8Array, type: keyof typeof ALLOWED) {
  if (!ALLOWED[type].signatures.some((signature) => startsWith(bytes, signature))) {
    return false
  }

  if (type === 'image/webp') {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    )
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const originError = requireSameOrigin(request)
    if (originError) return originError

    const blocked = await enforceRateLimit(request, {
      scope: 'public-art-upload',
      limit: 5,
      windowSeconds: 600,
    })
    if (blocked) return blocked

    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > MAX_SIZE + 128 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande.' },
        { status: 413 },
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    const slug = String(form.get('slug') || '').trim().slice(0, 80)

    if (!(file instanceof File) || !slug) {
      return NextResponse.json(
        { error: 'Arquivo ou empresa nao informado.' },
        { status: 400 },
      )
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Envie um arquivo de ate 10 MB.' },
        { status: 400 },
      )
    }

    if (!(file.type in ALLOWED)) {
      return NextResponse.json(
        { error: 'Use JPG, PNG, WEBP ou PDF.' },
        { status: 400 },
      )
    }

    const type = file.type as keyof typeof ALLOWED
    const bytes = new Uint8Array(await file.arrayBuffer())

    if (!validMagic(bytes, type)) {
      return NextResponse.json(
        { error: 'O conteudo do arquivo nao corresponde ao formato informado.' },
        { status: 400 },
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id,ativo')
      .or(`slug.eq.${slug},subdomain_slug.eq.${slug}`)
      .eq('ativo', true)
      .maybeSingle()

    if (companyError) throw companyError
    if (!company?.id) {
      return NextResponse.json(
        { error: 'Empresa nao encontrada.' },
        { status: 404 },
      )
    }

    const extension = ALLOWED[type].extension
    const now = new Date()
    const path = [
      String(company.id),
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension}`,
    ].join('/')

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), {
        contentType: type,
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(path)

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      path,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao enviar arquivo.',
      },
      { status: 500 },
    )
  }
}
