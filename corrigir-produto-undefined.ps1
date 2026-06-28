$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\painel\produtos\page.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-produto-undefined-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# Remove o Link Produto Pro que o patch anterior inseriu fora do escopo do map,
# causando: Cannot find name 'produto'.
$pattern = '<Link\s+href=\{`/painel/produtos/\$\{produto\.id\}`\}\s+className="[^"]*"\s*>\s*Produto Pro\s*</Link>\s*'
$content = [System.Text.RegularExpressions.Regex]::Replace(
  $content,
  $pattern,
  '',
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

# Se a importacao do Link ficou sobrando apenas por causa desse patch, deixa quieto.
# Import sobrando nao quebra build no Next/TS normalmente; remover automaticamente poderia mexer demais.

if ($content -eq $original) {
  Write-Host "Nao encontrei o Link quebrado automaticamente. Tentando limpeza por trecho simples..." -ForegroundColor Yellow

  $simple = '<Link href={`/painel/produtos/${produto.id}`} className="mt-3 inline-flex rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c]">Produto Pro</Link>'
  $content = $content.Replace($simple, '')
}

if ($content -eq $original) {
  Write-Host "Nenhuma alteracao feita. Talvez o trecho esteja diferente. Envie mais linhas ao redor do erro se continuar." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Link quebrado com produto.id removido de app\painel\produtos\page.tsx" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
