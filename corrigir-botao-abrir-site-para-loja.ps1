$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ORCALY - CORRIGIR BOTAO ABRIR SITE PARA NOVA LOJA ===" -ForegroundColor Cyan
Write-Host ""

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em: $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Backup-File($path) {
  if (Test-Path -LiteralPath $path) {
    $backup = $path + ".backup-loja-" + (Get-Date -Format "yyyyMMddHHmmss")
    Copy-Item -LiteralPath $path -Destination $backup -Force
    Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow
  }
}

function Replace-InFile($relativePath) {
  $path = Join-Path $project $relativePath

  if (!(Test-Path -LiteralPath $path)) {
    return
  }

  $original = [System.IO.File]::ReadAllText($path)
  $content = $original

  # Trocas diretas mais comuns.
  $content = $content.Replace("/orcamento/${company.slug}", "/loja/${company.slug}")
  $content = $content.Replace("/orcamento/${empresa.slug}", "/loja/${empresa.slug}")
  $content = $content.Replace("/orcamento/${company?.slug}", "/loja/${company?.slug}")
  $content = $content.Replace("/orcamento/${empresa?.slug}", "/loja/${empresa?.slug}")
  $content = $content.Replace("/orcamento/${company.subdomain_slug || company.slug}", "/loja/${company.slug}")
  $content = $content.Replace("/orcamento/${empresa.subdomain_slug || empresa.slug}", "/loja/${empresa.slug}")

  # Trocas em template string.
  $content = $content.Replace("`/orcamento/${company.slug}`", "`/loja/${company.slug}`")
  $content = $content.Replace("`/orcamento/${empresa.slug}`", "`/loja/${empresa.slug}`")
  $content = $content.Replace("`/orcamento/${company?.slug}`", "`/loja/${company?.slug}`")
  $content = $content.Replace("`/orcamento/${empresa?.slug}`", "`/loja/${empresa?.slug}`")
  $content = $content.Replace("`/orcamento/${company.subdomain_slug || company.slug}`", "`/loja/${company.slug}`")
  $content = $content.Replace("`/orcamento/${empresa.subdomain_slug || empresa.slug}`", "`/loja/${empresa.slug}`")

  # Trocas com aspas simples ou duplas em rotas fixas.
  $content = $content -replace "'/orcamento/' \+ company\.slug", "'/loja/' + company.slug"
  $content = $content -replace "'/orcamento/' \+ empresa\.slug", "'/loja/' + empresa.slug"
  $content = $content -replace '"/orcamento/" \+ company\.slug', '"/loja/" + company.slug'
  $content = $content -replace '"/orcamento/" \+ empresa\.slug', '"/loja/" + empresa.slug'

  # Se existir variável publicUrl apontando para subdomínio antigo ou /orcamento,
  # força para a nova loja /loja/[slug] no painel principal.
  $content = $content -replace "const publicUrl = company\?\.subdomain_slug\s*\?\s*`https://\$\{company\.subdomain_slug\}\.\$\{process\.env\.NEXT_PUBLIC_ROOT_DOMAIN \|\| 'orcaly\.com\.br'\}`\s*:\s*`/orcamento/\$\{company\.slug\}`", "const publicUrl = company?.slug ? `/loja/${company.slug}` : '#'"
  $content = $content -replace "const publicUrl = empresa\?\.subdomain_slug\s*\?\s*`https://\$\{empresa\.subdomain_slug\}\.\$\{process\.env\.NEXT_PUBLIC_ROOT_DOMAIN \|\| 'orcaly\.com\.br'\}`\s*:\s*`/orcamento/\$\{empresa\.slug\}`", "const publicUrl = empresa?.slug ? `/loja/${empresa.slug}` : '#'"

  if ($content -ne $original) {
    Backup-File $path
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
    Write-Host "Corrigido: $relativePath" -ForegroundColor Green
  }
}

$targets = @(
  "app\painel\page.tsx",
  "app\painel\site\page.tsx",
  "app\painel\catalogo\page.tsx",
  "app\painel\configuracoes\page.tsx",
  "app\painel\layout.tsx",
  "app\admin\page.tsx"
)

foreach ($target in $targets) {
  Replace-InFile $target
}

# Cria uma rota auxiliar /site/[slug] redirecionando para /loja/[slug],
# para caso alguma parte antiga ainda tente usar "site".
$sitePageDir = Join-Path $project "app\site\[slug]"
New-Item -ItemType Directory -Force -Path $sitePageDir | Out-Null

$sitePagePath = Join-Path $sitePageDir "page.tsx"
$sitePage = @'
import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function SiteRedirectPage({ params }: PageProps) {
  const { slug } = await params
  redirect(`/loja/${slug}`)
}
'@

[System.IO.File]::WriteAllText($sitePagePath, $sitePage, $utf8NoBom)
Write-Host "Criado redirecionamento: app\site\[slug]\page.tsx -> /loja/[slug]" -ForegroundColor Green

# Mostra onde ainda existe /orcamento no painel, caso sobre algum texto manual.
Write-Host ""
Write-Host "Verificando referencias antigas dentro de app\painel..." -ForegroundColor Cyan
$remaining = Select-String -Path "app\painel\*.tsx","app\painel\**\*.tsx" -Pattern "/orcamento/" -ErrorAction SilentlyContinue

if ($remaining) {
  Write-Host "Ainda existem referencias a /orcamento/ nestes pontos:" -ForegroundColor Yellow
  $remaining | ForEach-Object {
    Write-Host ($_.Path + ":" + $_.LineNumber + " -> " + $_.Line.Trim()) -ForegroundColor Yellow
  }
  Write-Host "Se alguma delas for botao de abrir site, troque para /loja/[slug]." -ForegroundColor Yellow
} else {
  Write-Host "Nenhuma referencia antiga a /orcamento/ encontrada no painel." -ForegroundColor Green
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Botao Abrir site ajustado para a nova loja." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
