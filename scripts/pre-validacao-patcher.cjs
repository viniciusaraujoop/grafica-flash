const fs = require('fs')
const path = require('path')

const project = process.cwd()

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function write(file, content) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.backup-pre-validacao-${stamp}`)
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function patchText(file) {
  if (!fs.existsSync(file)) return
  const original = read(file)
  let content = original

  const replacements = [
    ['Ã€s', 'Às'],
    ['VariÃƒÂ¡veis do Supabase nÃƒÂ£o configuradas no servidor.', 'Variáveis do Supabase não configuradas no servidor.'],
    ['VariÃ¡veis do Supabase nÃ£o configuradas no servidor.', 'Variáveis do Supabase não configuradas no servidor.'],
    ['nÃ£o', 'não'],
    ['NÃ£o', 'Não'],
    ['pÃºblica', 'pública'],
    ['orÃ§amento', 'orçamento'],
    ['OrÃ§aly', 'Orçaly'],
  ]

  for (const [from, to] of replacements) {
    content = content.split(from).join(to)
  }

  if (content !== original) {
    write(file, content)
    console.log(`Acentos corrigidos em: ${path.relative(project, file)}`)
  }
}

function patchPanelLinks(file) {
  if (!fs.existsSync(file)) return
  const original = read(file)
  let content = original

  content = content.replace(/\/painel\/setup/g, '/painel/onboarding')
  content = content.replace(/Checklist inicial/g, 'Onboarding guiado')
  content = content.replace(/Configure empresa, site, produtos, cupom e WhatsApp\./g, 'Siga os 7 passos para publicar e testar a empresa.')
  content = content.replace(/Ver checklist/g, 'Abrir onboarding')
  content = content.replace(/Abrir checklist/g, 'Abrir onboarding')

  if (content !== original) {
    write(file, content)
    console.log(`Links do painel apontando para onboarding em: ${path.relative(project, file)}`)
  }
}

patchText(path.join(project, 'app', 'page.tsx'))
patchText(path.join(project, 'lib', 'company-access.ts'))

patchPanelLinks(path.join(project, 'app', 'painel', 'page.tsx'))
patchPanelLinks(path.join(project, 'app', 'painel', 'layout.tsx'))

console.log('Patch de pré-validação finalizado.')
