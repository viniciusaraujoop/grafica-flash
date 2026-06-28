const fs = require('fs')
const path = require('path')

const project = process.cwd()
const pagePath = path.join(project, 'app', 'painel', 'site', 'page.tsx')

if (!fs.existsSync(pagePath)) {
  console.error('Arquivo não encontrado: app/painel/site/page.tsx')
  process.exit(1)
}

let content = fs.readFileSync(pagePath, 'utf8')
const original = content

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const backup = `${pagePath}.backup-upload-imagens-site-${stamp}`
fs.copyFileSync(pagePath, backup)
console.log(`Backup criado: ${path.relative(project, backup)}`)

const imageComponent = `
function ImageUploadField({
  label,
  description,
  value,
  uploading,
  onSelectFile,
  onClear,
}: {
  label: string
  description: string
  value?: string
  uploading?: boolean
  onSelectFile: (file: File | null) => void
  onClear: () => void
}) {
  const inputId = \`site-image-\${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}\`

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
      {help(label, description)}

      {value ? (
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
          <img src={value} alt={label} className="h-44 w-full object-contain p-3" />
        </div>
      ) : (
        <div className="mb-4 grid h-44 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <div>
            <p className="font-black text-[#071b3a]">Nenhuma imagem enviada</p>
            <p className="mt-1 text-xs font-bold text-slate-500">PNG, JPG, WEBP ou GIF até 10MB.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <label htmlFor={inputId} className="cursor-pointer rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/10">
          {uploading ? 'Enviando...' : value ? 'Trocar imagem' : 'Escolher da galeria'}
        </label>

        {value ? (
          <button type="button" onClick={onClear} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-red-600">
            Remover
          </button>
        ) : null}
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={uploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] || null
          onSelectFile(file)
          event.currentTarget.value = ''
        }}
        className="hidden"
      />
    </div>
  )
}

`

if (!content.includes('function ImageUploadField(')) {
  const marker = 'function PremiumPreview'
  if (!content.includes(marker)) {
    console.error('Não encontrei o ponto para inserir ImageUploadField.')
    process.exit(1)
  }
  content = content.replace(marker, `${imageComponent}${marker}`)
}

if (!content.includes("const [uploadingImage, setUploadingImage]")) {
  const marker = "const [selectedTemplate, setSelectedTemplate] = useState('grafica')"
  if (!content.includes(marker)) {
    console.error('Não encontrei o ponto para inserir estado de upload.')
    process.exit(1)
  }
  content = content.replace(marker, `${marker}\n  const [uploadingImage, setUploadingImage] = useState('')`)
}

if (!content.includes('async function uploadSiteImage(')) {
  const updateFunction = `  function update(field: string, value: any) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }`

  const uploadFunction = `${updateFunction}

  async function uploadSiteImage(field: 'logo_url' | 'site_banner_url', purpose: 'logo' | 'banner', file: File | null) {
    if (!file) return

    setErro('')
    setMessage('')
    setUploadingImage(purpose)

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('purpose', purpose)

      const response = await fetch('/api/site/upload', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${token}\`,
        },
        body,
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao enviar imagem.')
      }

      update(field, payload.url)
      setMessage(purpose === 'logo' ? 'Logo enviada com sucesso.' : 'Banner enviado com sucesso.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao enviar imagem.')
    }

    setUploadingImage('')
  }`

  if (!content.includes(updateFunction)) {
    console.error('Não encontrei a função update para inserir uploadSiteImage.')
    process.exit(1)
  }

  content = content.replace(updateFunction, uploadFunction)
}

const logoRegex = /<Input\s+label="Logo URL"[\s\S]*?value=\{form\.logo_url\}[\s\S]*?onChange=\{\(v\) => update\('logo_url', v\)\}\s*\/>/
const bannerRegex = /<Input\s+label="URL do banner"[\s\S]*?value=\{form\.site_banner_url\}[\s\S]*?onChange=\{\(v\) => update\('site_banner_url', v\)\}\s*\/>/

const logoReplacement = `<ImageUploadField
                    label="Logo da empresa"
                    description="Clique para enviar a logo direto da galeria/arquivo do computador. Ela aparece no topo, capa e rodapé."
                    value={form.logo_url}
                    uploading={uploadingImage === 'logo'}
                    onSelectFile={(file) => uploadSiteImage('logo_url', 'logo', file)}
                    onClear={() => update('logo_url', '')}
                  />`

const bannerReplacement = `<ImageUploadField
                    label="Banner da capa"
                    description="Clique para enviar uma imagem de destaque. Se deixar vazio, o Orçaly usa a arte automática do segmento."
                    value={form.site_banner_url}
                    uploading={uploadingImage === 'banner'}
                    onSelectFile={(file) => uploadSiteImage('site_banner_url', 'banner', file)}
                    onClear={() => update('site_banner_url', '')}
                  />`

if (!content.includes('label="Logo da empresa"')) {
  if (!logoRegex.test(content)) {
    console.error('Não encontrei o campo antigo de Logo URL para substituir.')
    process.exit(1)
  }
  content = content.replace(logoRegex, logoReplacement)
}

if (!content.includes('label="Banner da capa"')) {
  if (!bannerRegex.test(content)) {
    console.error('Não encontrei o campo antigo de URL do banner para substituir.')
    process.exit(1)
  }
  content = content.replace(bannerRegex, bannerReplacement)
}

if (content === original) {
  console.log('Nenhuma alteração necessária. O arquivo já parece estar atualizado.')
} else {
  fs.writeFileSync(pagePath, content, 'utf8')
  console.log('Editor do site atualizado com upload de logo e banner.')
}
