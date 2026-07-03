$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\panel-modules.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-known-routes-export-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# A página do painel importa knownExistingPanelRoutes.
# A central já tinha existingPanelRoutes, mas sem export público.
# Exportamos um alias sem mudar visual, sidebar, dashboard ou lógica crítica.
if ($content -notmatch "export\s+const\s+knownExistingPanelRoutes") {
  if ($content -match "const\s+existingPanelRoutes\s*=\s*new\s+Set") {
    $content = $content.TrimEnd() + @"

//
// Compatibilidade com páginas existentes do painel.
// Mantém o nome esperado por app/painel/page.tsx.
//

export const knownExistingPanelRoutes = existingPanelRoutes
"@
  } elseif ($content -match "export\s+const\s+existingPanelRoutes\s*=\s*new\s+Set") {
    $content = $content.TrimEnd() + @"

//
// Compatibilidade com páginas existentes do painel.
// Mantém o nome esperado por app/painel/page.tsx.
//

export const knownExistingPanelRoutes = existingPanelRoutes
"@
  } else {
    Write-Host "Não encontrei existingPanelRoutes em lib/panel-modules.ts. Vou criar lista segura." -ForegroundColor Yellow
    $content = $content.TrimEnd() + @"

//
// Rotas conhecidas do painel para compatibilidade com app/painel/page.tsx.
//

export const knownExistingPanelRoutes = new Set<string>([
  '/painel',
  '/painel/admin',
  '/painel/assistente',
  '/painel/auditoria',
  '/painel/catalogo',
  '/painel/central-operacional',
  '/painel/clientes',
  '/painel/configuracoes',
  '/painel/configuracoes/equipe',
  '/painel/crm',
  '/painel/cupom',
  '/painel/cupons',
  '/painel/financeiro',
  '/painel/modulos/[module]',
  '/painel/notificacoes',
  '/painel/notificacoes/inteligentes',
  '/painel/onboarding',
  '/painel/oportunidades',
  '/painel/orcamento-inteligente',
  '/painel/orcamento/[id]',
  '/painel/pedidos',
  '/painel/pedidos/[id]',
  '/painel/producao',
  '/painel/produtos',
  '/painel/produtos/[id]',
  '/painel/produtos/ia',
  '/painel/proposta/[id]',
  '/painel/propostas',
  '/painel/segmento',
  '/painel/segmentos',
  '/painel/setup',
  '/painel/site',
  '/painel/tarefas',
  '/painel/whatsapp',
  '/painel/equipe',
  '/painel/follow-up',
  '/painel/mensagens',
  '/painel/relatorios',
  '/painel/historico',
  '/painel/notas-fiscais',
])
"@
  }
}

# Garante também aliases do erro anterior, caso o pacote anterior não tenha sido aplicado.
if ($content -notmatch "export\s+type\s+PanelModuleGroup") {
  if ($content -match "export\s+type\s+ModuleGroup") {
    $content = $content.TrimEnd() + "`r`n`r`nexport type PanelModuleGroup = ModuleGroup`r`n"
  }
}

if ($content -notmatch "export\s+const\s+panelGroupLabels") {
  if ($content -match "export\s+const\s+moduleGroupLabels") {
    $content = $content.TrimEnd() + "`r`nexport const panelGroupLabels = moduleGroupLabels as Record<PanelModuleGroup, string>`r`n"
  }
}

if ($content -notmatch "export\s+function\s+getPanelModulesForBusinessType") {
  if ($content -match "export\s+function\s+getModulesForBusinessType") {
    $content = $content.TrimEnd() + @"

export function getPanelModulesForBusinessType(businessType: unknown) {
  return getModulesForBusinessType(businessType)
}
"@
  }
}

if ($content -eq $original) {
  Write-Host "Nenhuma alteração necessária. Os exports já existem." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Export knownExistingPanelRoutes adicionado em lib/panel-modules.ts" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
