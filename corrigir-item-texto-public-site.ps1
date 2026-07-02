$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "components\public-site\PublicSiteRenderer.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-remover-item-texto-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

# Correção direta e forçada. Sem delicadeza, porque o TypeScript já gastou nossa paciência do mês.
$content = $content.Replace("item.text || item.texto || 'Atendimento excelente e organizado.'", "item.text")
$content = $content.Replace('item.text || item.texto || "Atendimento excelente e organizado."', "item.text")
$content = $content.Replace("item.name || item.nome || 'Cliente'", "item.name")
$content = $content.Replace('item.name || item.nome || "Cliente"', "item.name")

# Limpeza extra para qualquer resto semelhante.
$content = $content.Replace(" || item.texto || 'Atendimento excelente e organizado.'", "")
$content = $content.Replace(' || item.texto || "Atendimento excelente e organizado."', "")
$content = $content.Replace(" || item.nome || 'Cliente'", "")
$content = $content.Replace(' || item.nome || "Cliente"', "")

# Se ainda existir item.texto/item.nome, substitui de forma segura por item.text/item.name.
$content = $content.Replace("item.texto", "item.text")
$content = $content.Replace("item.nome", "item.name")

if ($content -match "item\.texto") {
  Write-Host "Ainda sobrou item.texto. Linhas:" -ForegroundColor Red
  $content -split "`n" | Select-String -Pattern "item\.texto" -Context 2,2
  exit 1
}

if ($content -match "item\.nome") {
  Write-Host "Ainda sobrou item.nome. Linhas:" -ForegroundColor Red
  $content -split "`n" | Select-String -Pattern "item\.nome" -Context 2,2
  exit 1
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Removido todo acesso a item.texto/item.nome em PublicSiteRenderer.tsx" -ForegroundColor Green

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
