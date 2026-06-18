$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== ORCALY - CORRIGIR BOTAO ABRIR SITE PARA LOJA V2 ===" -ForegroundColor Cyan
Write-Host ""

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em: $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$pastas = @(
  "app\painel",
  "app\admin"
)

$arquivos = @()

foreach ($pasta in $pastas) {
  if (Test-Path -LiteralPath $pasta) {
    $arquivos += Get-ChildItem -LiteralPath $pasta -Recurse -File -Include *.tsx,*.ts -ErrorAction SilentlyContinue
  }
}

$alterados = 0

foreach ($arquivo in $arquivos) {
  $conteudo = [System.IO.File]::ReadAllText($arquivo.FullName)
  $novo = $conteudo

  # Troca simples e segura: apenas rotas antigas /orcamento/ para a loja nova /loja/
  $novo = $novo.Replace("/orcamento/", "/loja/")

  # Caso exista link absoluto antigo com domínio, também troca mantendo o restante.
  $novo = $novo.Replace("orcaly.com.br/orcamento/", "orcaly.com.br/loja/")

  if ($novo -ne $conteudo) {
    $backup = $arquivo.FullName + ".backup-loja-v2-" + (Get-Date -Format "yyyyMMddHHmmss")
    Copy-Item -LiteralPath $arquivo.FullName -Destination $backup -Force
    [System.IO.File]::WriteAllText($arquivo.FullName, $novo, $utf8NoBom)

    Write-Host "Corrigido: $($arquivo.FullName)" -ForegroundColor Green
    $alterados += 1
  }
}

# Cria uma rota auxiliar /site/[slug] redirecionando para /loja/[slug].
# Isso ajuda se algum botão antigo ainda chamar /site/alguma-empresa.
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

Write-Host ""
Write-Host "Arquivos alterados: $alterados" -ForegroundColor Cyan
Write-Host "Rota auxiliar criada: app\site\[slug]\page.tsx -> /loja/[slug]" -ForegroundColor Green

Write-Host ""
Write-Host "Referencias antigas restantes dentro de app\painel e app\admin:" -ForegroundColor Cyan

$remaining = Select-String -Path "app\painel\*.tsx","app\painel\**\*.tsx","app\admin\*.tsx","app\admin\**\*.tsx" -Pattern "/orcamento/" -ErrorAction SilentlyContinue

if ($remaining) {
  $remaining | ForEach-Object {
    Write-Host ($_.Path + ":" + $_.LineNumber + " -> " + $_.Line.Trim()) -ForegroundColor Yellow
  }
} else {
  Write-Host "Nenhuma referencia antiga encontrada." -ForegroundColor Green
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode:" -ForegroundColor Yellow
Write-Host "npm run build"
