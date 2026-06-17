$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\orcamento\[slug]\page.tsx"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

if (!(Test-Path $file)) {
  Write-Host "Arquivo nao encontrado: app\orcamento\[slug]\page.tsx" -ForegroundColor Red
  exit 1
}

Set-Location $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content = [System.IO.File]::ReadAllText($file)

# Corrige implicit any em perguntas.map
$content = $content.Replace("perguntas.map((pergunta) =>", "perguntas.map((pergunta: string) =>")

# Corrige possíveis próximos implicit any parecidos, caso o TypeScript resolva continuar bancando o fiscal.
$content = $content.Replace("produtos.map((produto) =>", "produtos.map((produto: Produto) =>")
$content = $content.Replace("secoes.find((s) =>", "secoes.find((s: Secao) =>")
$content = $content.Replace("secoesRes.data || []) as Secao[]", "secoesRes.data || []) as Secao[]")
$content = $content.Replace("produtosRes.data || []) as Produto[]", "produtosRes.data || []) as Produto[]")

[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Tipagem do site profissional corrigida." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
