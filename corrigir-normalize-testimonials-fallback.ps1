$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "components\public-site\PublicSiteRenderer.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-normalize-testimonials-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

$pattern = "function normalizeTestimonials\(\s*value: unknown\s*\): Array<\{ name: string; text: string \}> \{[\s\S]*?\n\}"
$replacement = @'
function normalizeTestimonials(
  value: unknown
): Array<{ name: string; text: string }> {
  return asArray<{ name?: string; nome?: string; text?: string; texto?: string }>(value)
    .map((item) => ({
      name: item.name || item.nome || 'Cliente',
      text: item.text || item.texto || 'Atendimento excelente e organizado.',
    }))
    .filter((item) => item.name.trim().length > 0 || item.text.trim().length > 0)
}
'@

if ($content -notmatch $pattern) {
  Write-Host "Função normalizeTestimonials não encontrada no formato esperado. Tentando correção por linhas..." -ForegroundColor Yellow

  $content = $content.Replace("name: item.name,", "name: item.name || item.nome || 'Cliente',")
  $content = $content.Replace("text: item.text,", "text: item.text || item.texto || 'Atendimento excelente e organizado.',")
  $content = $content.Replace(".filter((item) => item.name || item.text)", ".filter((item) => item.name.trim().length > 0 || item.text.trim().length > 0)")
} else {
  $content = [regex]::Replace($content, $pattern, $replacement)
}

# Garante que o render final continue usando só os campos normalizados.
$content = $content.Replace("item.text || item.texto || 'Atendimento excelente e organizado.'", "item.text")
$content = $content.Replace('item.text || item.texto || "Atendimento excelente e organizado."', "item.text")
$content = $content.Replace("item.name || item.nome || 'Cliente'", "item.name")
$content = $content.Replace('item.name || item.nome || "Cliente"', "item.name")

# Mas dentro da função normalizeTestimonials, restaura fallback se a limpeza acima pegou onde não devia.
$content = [regex]::Replace(
  $content,
  "function normalizeTestimonials\(\s*value: unknown\s*\): Array<\{ name: string; text: string \}> \{[\s\S]*?\n\}",
  $replacement
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Corrigido: normalizeTestimonials agora sempre retorna name/text como string." -ForegroundColor Green

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
