$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\orcamento\[slug]\page.tsx"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado pelo caminho literal: app\orcamento\[slug]\page.tsx" -ForegroundColor Red
  Write-Host "Procurando page.tsx dentro de app\orcamento..." -ForegroundColor Yellow

  $candidatos = Get-ChildItem -LiteralPath (Join-Path $project "app\orcamento") -Recurse -Filter "page.tsx" -ErrorAction SilentlyContinue

  if (!$candidatos -or $candidatos.Count -eq 0) {
    Write-Host "Nao encontrei nenhum page.tsx dentro de app\orcamento." -ForegroundColor Red
    exit 1
  }

  $file = $candidatos[0].FullName
  Write-Host "Usando arquivo encontrado: $file" -ForegroundColor Cyan
}

Set-Location $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($file)

# Corrige implicit any em perguntas.map sem duplicar tipo se ja estiver corrigido.
$content = $content -replace "perguntas\.map\(\(pergunta\)\s*=>", "perguntas.map((pergunta: string) =>"
$content = $content -replace "perguntas\.map\(\(pergunta:\s*string:\s*string\)\s*=>", "perguntas.map((pergunta: string) =>"

# Corrige possíveis próximos implicit any no mesmo arquivo.
$content = $content -replace "produtos\.map\(\(produto\)\s*=>", "produtos.map((produto: Produto) =>"
$content = $content -replace "produtos\.map\(\(produto:\s*Produto:\s*Produto\)\s*=>", "produtos.map((produto: Produto) =>"

$content = $content -replace "secoes\.find\(\(s\)\s*=>", "secoes.find((s: Secao) =>"
$content = $content -replace "secoes\.find\(\(s:\s*Secao:\s*Secao\)\s*=>", "secoes.find((s: Secao) =>"

[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Tipagem do site profissional corrigida em:" -ForegroundColor Green
Write-Host $file -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
