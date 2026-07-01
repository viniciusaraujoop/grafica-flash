const fs = require('fs')
const path = require('path')

const project = process.cwd()

function exists(file) {
  return fs.existsSync(file)
}

function backup(file, label) {
  if (!exists(file)) return
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  fs.copyFileSync(file, `${file}.backup-${label}-${stamp}`)
}

function replaceFile(relativePath, content) {
  const file = path.join(project, relativePath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (exists(file)) backup(file, 'modular-segmentos')
  fs.writeFileSync(file, content, 'utf8')
  console.log(`Atualizado: ${relativePath}`)
}

function patchCompanySettings() {
  const file = path.join(project, 'app', 'api', 'company', 'settings', 'route.ts')
  if (!exists(file)) return

  backup(file, 'business-type')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("@/lib/business-types")) {
    content = content.replace(
      "import { createClient } from '@supabase/supabase-js'",
      "import { createClient } from '@supabase/supabase-js'\nimport { normalizeBusinessType } from '@/lib/business-types'"
    )
  }

  if (!content.includes("'business_type'")) {
    content = content.replace(
      "  'percentual_sinal',\n]",
      "  'percentual_sinal',\n  'business_type',\n]"
    )
  }

  if (!content.includes("business_type: company.business_type")) {
    content = content.replace(
      "    percentual_sinal: company.percentual_sinal,\n  }",
      "    percentual_sinal: company.percentual_sinal,\n    business_type: company.business_type || 'services',\n  }"
    )
  }

  if (!content.includes("normalizeBusinessType(update.business_type")) {
    content = content.replace(
      "    update.percentual_sinal = Math.max(0, Math.min(100, Number(update.percentual_sinal || 0)))",
      "    update.percentual_sinal = Math.max(0, Math.min(100, Number(update.percentual_sinal || 0)))\n    update.business_type = normalizeBusinessType(update.business_type || company.business_type || 'services')"
    )
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('API company/settings aceita business_type.')
}

function patchSiteSettings() {
  const file = path.join(project, 'app', 'api', 'site', 'settings', 'route.ts')
  if (!exists(file)) return

  backup(file, 'business-type')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("  'business_type',")) {
    content = content.replace(
      "  'site_delivery_options',\n]",
      "  'site_delivery_options',\n  'business_type',\n]"
    )
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('API site/settings aceita business_type.')
}

function patchConfigPage() {
  const file = path.join(project, 'app', 'painel', 'configuracoes', 'page.tsx')
  if (!exists(file)) return

  backup(file, 'business-type')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("@/lib/business-types")) {
    content = content.replace(
      "import Link from 'next/link'",
      "import Link from 'next/link'\nimport { businessTypes, getBusinessTypeConfig } from '@/lib/business-types'"
    )
  }

  if (!content.includes("business_type?: string | null")) {
    content = content.replace(
      "  percentual_sinal?: number | null\n}",
      "  percentual_sinal?: number | null\n  business_type?: string | null\n}"
    )
  }

  if (!content.includes("business_type: company?.business_type || 'services'")) {
    content = content.replace(
      "    percentual_sinal: company?.percentual_sinal ?? 0,\n  }",
      "    percentual_sinal: company?.percentual_sinal ?? 0,\n    business_type: company?.business_type || 'services',\n  }"
    )
  }

  if (!content.includes("Tipo de negócio muda textos")) {
    const marker = `                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Nome da empresa</span>
                  <input value={form.nome} onChange={(e) => update('nome', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white" />
                </label>`

    const segmentBlock = `${marker}

                <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-black text-[#05245c]">Tipo de negócio</span>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                        Esse tipo de negócio muda textos, sugestões e recursos exibidos no site e painel. Você pode alterar tudo depois.
                      </p>
                    </div>
                    <Link href="/painel/segmento" className="rounded-2xl bg-[#05245c] px-5 py-3 text-center text-sm font-black text-white">
                      Configurar segmento
                    </Link>
                  </div>
                  <select value={form.business_type || 'services'} onChange={(e) => update('business_type', e.target.value)} className="mt-4 w-full rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c]">
                    {businessTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[#05245c]">
                    Atual: {getBusinessTypeConfig(form.business_type).publicName}
                  </p>
                </div>`

    content = content.replace(marker, segmentBlock)
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('Configurações ganhou seletor/link de tipo de negócio.')
}

function patchPanelPage() {
  const file = path.join(project, 'app', 'painel', 'page.tsx')
  if (!exists(file)) return

  backup(file, 'segmento-link')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("href: '/painel/segmento'")) {
    content = content.replace(
      "const quickLinks: QuickLink[] = [",
      `const quickLinks: QuickLink[] = [
  {
    title: 'Segmento do negócio',
    description: 'Escolha Food, Gráfica, Beauty, Serviços e veja módulos recomendados.',
    href: '/painel/segmento',
    badge: 'Segmento',
    group: 'principal',
  },`
    )
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('Painel ganhou atalho para Segmento do negócio.')
}

function patchProductsList() {
  const file = path.join(project, 'app', 'painel', 'produtos', 'page.tsx')
  if (!exists(file)) return

  backup(file, 'business-type')
  let content = fs.readFileSync(file, 'utf8')

  if (!content.includes("business_type?: string | null")) {
    content = content.replace(
      "  video_url?: string | null\n  company_id: string | null",
      "  video_url?: string | null\n  business_type?: string | null\n  available?: boolean | null\n  addons?: any[] | null\n  variations?: any[] | null\n  extras?: Record<string, any> | null\n  company_id: string | null"
    )
  }

  if (!content.includes("business_type: empresaData")) {
    content = content.replace(
      "        percentual_sinal_produto: cobrarSinalPersonalizado\n          ? percentualSinalNumero\n          : null,\n      }",
      "        percentual_sinal_produto: cobrarSinalPersonalizado\n          ? percentualSinalNumero\n          : null,\n        business_type: (empresaData as any).business_type || 'services',\n        available: true,\n      }"
    )
  }

  fs.writeFileSync(file, content, 'utf8')
  console.log('Lista de produtos salva business_type/available em novos itens.')
}

patchCompanySettings()
patchSiteSettings()
patchConfigPage()
patchPanelPage()
patchProductsList()

console.log('Patch modular por segmento finalizado.')
