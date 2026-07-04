const fs = require('fs')
const path = require('path')

const project = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(project, relativePath), 'utf8')
}

function write(relativePath, content) {
  const file = path.join(project, relativePath)
  if (fs.existsSync(file)) {
    const backup = `${file}.backup-financeiro-operacao-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
    fs.copyFileSync(file, backup)
    console.log(`Backup criado: ${backup}`)
  }
  fs.writeFileSync(file, content, 'utf8')
  console.log(`Atualizado: ${relativePath}`)
}

function patchPanelModules() {
  const relativePath = 'lib/panel-modules.ts'
  const fullPath = path.join(project, relativePath)
  if (!fs.existsSync(fullPath)) {
    console.log('lib/panel-modules.ts não encontrado. Pulo patch de menu.')
    return
  }

  let content = read(relativePath)
  const original = content

  const routes = [
    '/painel/financeiro/entradas',
    '/painel/financeiro/saidas',
    '/painel/financeiro/contas-a-receber',
    '/painel/financeiro/contas-a-pagar',
    '/painel/artes',
    '/painel/aprovacao-arte',
    '/painel/entregas',
    '/painel/horarios',
    '/painel/taxas-entrega',
    '/painel/ordens-servico',
    '/painel/analises',
    '/painel/equipamentos',
    '/painel/pecas',
    '/painel/garantias',
    '/painel/aparelhos',
    '/painel/defeitos',
    '/painel/manutencao',
    '/painel/agenda',
    '/painel/profissionais',
    '/painel/pacotes',
    '/painel/comissoes',
    '/painel/eventos',
    '/painel/contratos',
    '/painel/checklist-evento',
  ]

  for (const route of routes) {
    if (content.includes(`'${route}'`)) continue

    if (content.includes("  '/assinatura',")) {
      content = content.replace("  '/assinatura',", `  '${route}',\n  '/assinatura',`)
    } else {
      content = content.replace(/\]\s+as const/, `  '${route}',\n] as const`)
    }
  }

  content = content.replace(
    /function routeExists\(href: string\) \{[\s\S]*?\n\}/m,
    `function routeExists(href: string) {
  if (href.startsWith('http')) return true
  if (href.startsWith('/painel/modulos/')) return true

  const cleanHref = href.split('?')[0].split('#')[0]
  return knownExistingPanelRoutes.includes(cleanHref as (typeof knownExistingPanelRoutes)[number])
}`
  )

  function updateModuleHref(id, href, fallbackHref) {
    const regex = new RegExp(`\\{\\n\\s*id: '${id}',[\\s\\S]*?\\n\\s*\\},`, 'm')
    const match = content.match(regex)
    if (!match) return

    let block = match[0]
    block = block.replace(/href: '[^']+'/m, `href: '${href}'`)

    if (fallbackHref) {
      if (/fallbackHref: '[^']+'/m.test(block)) {
        block = block.replace(/fallbackHref: '[^']+'/m, `fallbackHref: '${fallbackHref}'`)
      } else {
        block = block.replace(/(href: '[^']+',)/m, `$1\n    fallbackHref: '${fallbackHref}',`)
      }
    }

    content = content.replace(match[0], block)
  }

  updateModuleHref('entradas_saidas', '/painel/financeiro?tab=lancamentos', '/painel/financeiro')
  updateModuleHref('contas_receber', '/painel/financeiro?tab=receber', '/painel/financeiro')
  updateModuleHref('contas_pagar', '/painel/financeiro?tab=pagar', '/painel/financeiro')
  updateModuleHref('artes_recebidas', '/painel/artes', '/painel/artes')
  updateModuleHref('aprovacao_arte', '/painel/aprovacao-arte', '/painel/aprovacao-arte')
  updateModuleHref('entregas', '/painel/entregas', '/painel/entregas')
  updateModuleHref('horarios', '/painel/horarios', '/painel/horarios')
  updateModuleHref('taxas_entrega', '/painel/taxas-entrega', '/painel/taxas-entrega')
  updateModuleHref('ordens_servico', '/painel/ordens-servico', '/painel/ordens-servico')
  updateModuleHref('analises', '/painel/analises', '/painel/analises')
  updateModuleHref('equipamentos', '/painel/equipamentos', '/painel/equipamentos')
  updateModuleHref('garantias', '/painel/garantias', '/painel/garantias')
  updateModuleHref('agenda', '/painel/agenda', '/painel/agenda')
  updateModuleHref('profissionais', '/painel/profissionais', '/painel/profissionais')
  updateModuleHref('contratos', '/painel/contratos', '/painel/contratos')

  if (content !== original) write(relativePath, content)
  else console.log('Menu/rotas já estavam atualizados.')
}

function patchFinanceiroQueryTabs() {
  const relativePath = 'app/painel/financeiro/page.tsx'
  const fullPath = path.join(project, relativePath)
  if (!fs.existsSync(fullPath)) {
    console.log('Financeiro não encontrado. Pulo patch de query tab.')
    return
  }

  let content = read(relativePath)
  const original = content

  if (!content.includes('financeiroQueryTabApplied')) {
    const marker = `  useEffect(() => {
    setBarcodeSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window)
    carregar()
  }, [mes])`

    const injected = `${marker}

  useEffect(() => {
    const financeiroQueryTabApplied = true
    if (!financeiroQueryTabApplied) return

    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')

    if (tabParam === 'entradas') {
      setTab('lancamentos')
      setFiltroTipo('entrada')
      setFiltroStatus('todos')
    }

    if (tabParam === 'saidas') {
      setTab('lancamentos')
      setFiltroTipo('saida')
      setFiltroStatus('todos')
    }

    if (tabParam === 'receber' || tabParam === 'pagar') {
      setTab('lancamentos')
      setFiltroTipo('todos')
      setFiltroStatus('pendente')
    }

    if (tabParam === 'resumo') {
      setTab('visao')
    }
  }, [])`

    if (content.includes(marker)) {
      content = content.replace(marker, injected)
    } else {
      console.log('Não encontrei ponto exato para inserir leitura de ?tab=. Mantive financeiro intacto.')
    }
  }

  if (content !== original) write(relativePath, content)
  else console.log('Financeiro já parecia compatível com query tabs ou foi mantido intacto.')
}

patchPanelModules()
patchFinanceiroQueryTabs()
console.log('Patch financeiro/operação fase 1 concluído.')
