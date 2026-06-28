const fs = require('fs')
const path = require('path')

const project = process.cwd()
const file = path.join(project, 'app', 'painel', 'site', 'page.tsx')

if (!fs.existsSync(file)) {
  console.error('Arquivo não encontrado: app/painel/site/page.tsx')
  process.exit(1)
}

let content = fs.readFileSync(file, 'utf8')
const original = content

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `${file}.backup-restaurar-slug-site-${stamp}`
fs.copyFileSync(file, backup)
console.log(`Backup criado: ${path.relative(project, backup)}`)

function replaceOnce(search, replacement, label) {
  if (content.includes(replacement)) {
    console.log(`${label}: já aplicado.`)
    return
  }
  if (!content.includes(search)) {
    console.log(`${label}: ponto não encontrado.`)
    return
  }
  content = content.replace(search, replacement)
  console.log(`${label}: aplicado.`)
}

const initialSlugSearch = "estado: '',"
const initialSlugReplacement = "estado: '',\n    slug: '',"
replaceOnce(initialSlugSearch, initialSlugReplacement, 'Campo slug no estado inicial')

const uploadFunctionEnd = `    setUploadingImage('')
  }`
const slugFunction = `    setUploadingImage('')
  }

  function normalizeSiteSlug(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\\\u0300-\\\\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 45)
  }

  async function updateSiteSlug() {
    setErro('')
    setMessage('')

    const slug = normalizeSiteSlug(form.slug || '')

    if (slug.length < 3) {
      setErro('O link precisa ter pelo menos 3 caracteres.')
      return
    }

    const response = await fetch('/api/site/slug', {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${token}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setErro(payload.error || 'Erro ao atualizar link do site.')
      return
    }

    update('slug', payload.slug)
    setCompany((current: any) => ({ ...(current || {}), slug: payload.slug }))
    setMessage('Link do site atualizado com sucesso.')
  }`

if (!content.includes('async function updateSiteSlug()')) {
  if (content.includes(uploadFunctionEnd)) {
    content = content.replace(uploadFunctionEnd, slugFunction)
    console.log('Função updateSiteSlug inserida após uploadSiteImage.')
  } else {
    const updateFunction = `  function update(field: string, value: any) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }`
    const replacement = `${updateFunction}

  function normalizeSiteSlug(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\\\u0300-\\\\u036f]/g, '')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 45)
  }

  async function updateSiteSlug() {
    setErro('')
    setMessage('')

    const slug = normalizeSiteSlug(form.slug || '')

    if (slug.length < 3) {
      setErro('O link precisa ter pelo menos 3 caracteres.')
      return
    }

    const response = await fetch('/api/site/slug', {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${token}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setErro(payload.error || 'Erro ao atualizar link do site.')
      return
    }

    update('slug', payload.slug)
    setCompany((current: any) => ({ ...(current || {}), slug: payload.slug }))
    setMessage('Link do site atualizado com sucesso.')
  }`
    replaceOnce(updateFunction, replacement, 'Função updateSiteSlug após update')
  }
} else {
  console.log('Função updateSiteSlug já existe.')
}

const commercialMarker = `                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="WhatsApp" description="Número usado nos botões." value={form.whatsapp} onChange={(v) => update('whatsapp', v)} />`

const slugBlock = `                <div className="rounded-[1.5rem] border border-blue-100 bg-[#f5f8ff] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-black text-[#071b3a]">Link público do site</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        Escolha o endereço da empresa. Exemplo: empresa1.orcaly.com.br. Use letras, números e hífen.
                      </p>

                      <div className="mt-3 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex-row sm:items-center">
                        <span className="border-b border-slate-100 px-4 py-4 text-sm font-black text-slate-400 sm:border-b-0 sm:border-r">
                          https://
                        </span>
                        <input
                          value={form.slug || ''}
                          onChange={(event) => update('slug', normalizeSiteSlug(event.target.value))}
                          placeholder="empresa1"
                          className="min-w-0 flex-1 px-4 py-4 font-black text-[#071b3a] outline-none"
                        />
                        <span className="border-t border-slate-100 px-4 py-4 text-sm font-black text-slate-400 sm:border-l sm:border-t-0">
                          .orcaly.com.br
                        </span>
                      </div>

                      <p className="mt-2 text-xs font-bold text-slate-500">
                        Link atual: {form.slug ? \`\${form.slug}.orcaly.com.br\` : 'não definido'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {form.slug ? (
                        <a
                          href={\`https://\${form.slug}.orcaly.com.br\`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-[#05245c]"
                        >
                          Abrir link
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={updateSiteSlug}
                        className="rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white"
                      >
                        Salvar link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="WhatsApp" description="Número usado nos botões." value={form.whatsapp} onChange={(v) => update('whatsapp', v)} />`

if (!content.includes('Link público do site')) {
  if (content.includes(commercialMarker)) {
    content = content.replace(commercialMarker, slugBlock)
    console.log('Bloco de slug inserido na aba Comercial.')
  } else {
    const fallbackMarker = `{tab === 'comercial' && (`
    if (content.includes(fallbackMarker)) {
      content = content.replace(fallbackMarker, `${fallbackMarker}
              <>`)
      console.log('Marcador comercial encontrado, mas estrutura inesperada. Bloco não inserido para evitar quebrar.')
    } else {
      console.log('Aba Comercial não encontrada. Bloco visual não inserido.')
    }
  }
} else {
  console.log('Bloco de slug já existe.')
}

if (content === original) {
  console.log('Nenhuma alteração necessária.')
} else {
  fs.writeFileSync(file, content, 'utf8')
  console.log('Configurações do site atualizadas com edição de slug.')
}
