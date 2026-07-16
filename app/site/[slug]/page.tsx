import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PublicSiteClient from '@/components/public-site/PublicSiteClient'
import { getCompanyPublicUrl, normalizeCompanySlug } from '@/lib/company-url'

export const dynamic = 'force-dynamic'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')
const fallbackOgImage = `${appUrl}/og-orcaly.png`

type PageProps = {
  params: Promise<{ slug: string }>
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

  return createClient(url, key, { auth: { persistSession: false } })
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function safeAbsoluteImage(value: unknown) {
  const raw = textValue(value)

  if (!raw) return fallbackOgImage
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return fallbackOgImage
  if (/token=|signature=|expires=|X-Amz-Signature/i.test(raw)) return fallbackOgImage

  if (raw.startsWith('/')) return `${appUrl}${raw}`

  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return fallbackOgImage
    return url.toString()
  } catch {
    return fallbackOgImage
  }
}

function companyDescription(company: Record<string, unknown> | null) {
  if (!company) {
    return 'Site, catálogo, marketplace e pedidos online com Orçaly.'
  }

  return (
    textValue(company.site_subheadline) ||
    textValue(company.site_description) ||
    textValue(company.descricao) ||
    textValue(company.description) ||
    textValue(company.site_about_text) ||
    'Conheça produtos, serviços e faça seu pedido online.'
  )
}

function companyImage(company: Record<string, unknown> | null) {
  if (!company) return fallbackOgImage

  return safeAbsoluteImage(
    company.marketplace_banner_url ||
      company.site_banner_url ||
      company.banner_url ||
      company.logo_url ||
      company.site_logo_url,
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const cleanSlug = normalizeCompanySlug(slug)
  const publicUrl = getCompanyPublicUrl(cleanSlug)

  try {
    const supabaseAdmin = createSupabaseAdmin()
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .or(`slug.eq.${cleanSlug},subdomain_slug.eq.${cleanSlug}`)
      .maybeSingle()

    const companyRecord = (company || null) as Record<string, unknown> | null
    const title = textValue(companyRecord?.nome, 'Orçaly')
    const description = companyDescription(companyRecord)
    const image = companyImage(companyRecord)

    return {
      title,
      description,
      alternates: {
        canonical: publicUrl,
      },
      openGraph: {
        title,
        description,
        url: publicUrl,
        siteName: title,
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        locale: 'pt_BR',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    }
  } catch {
    return {
      title: 'Orçaly',
      description: 'Site, catálogo, marketplace e pedidos online com Orçaly.',
      alternates: {
        canonical: publicUrl,
      },
      openGraph: {
        title: 'Orçaly',
        description: 'Site, catálogo, marketplace e pedidos online com Orçaly.',
        url: publicUrl,
        siteName: 'Orçaly',
        images: [
          {
            url: fallbackOgImage,
            width: 1200,
            height: 630,
            alt: 'Orçaly',
          },
        ],
        locale: 'pt_BR',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Orçaly',
        description: 'Site, catálogo, marketplace e pedidos online com Orçaly.',
        images: [fallbackOgImage],
      },
    }
  }
}

export default async function PublicCompanySitePage({ params }: PageProps) {
  const { slug } = await params
  return <PublicSiteClient slug={slug} />
}
