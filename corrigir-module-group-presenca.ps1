$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\panel-modules.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-presenca-group-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# O type ModuleGroup usa "presenca_digital", mas sobrou "presenca" em uma lista.
# Corrige o valor inválido sem mexer no visual do painel.
$content = $content.Replace("'presenca'", "'presenca_digital'")
$content = $content.Replace('"presenca"', '"presenca_digital"')

# Se existir chave antiga em labels, normaliza também.
$content = $content.Replace("presenca: 'Presença digital'", "presenca_digital: 'Presença digital'")
$content = $content.Replace('presenca: "Presença digital"', 'presenca_digital: "Presença digital"')

# Se por algum motivo o tipo ModuleGroup foi criado sem presenca_digital, garante o valor correto.
if ($content -match "export\s+type\s+ModuleGroup") {
  if ($content -notmatch "'presenca_digital'") {
    $content = $content.Replace("'financeiro'", "'financeiro'`r`n  | 'presenca_digital'")
  }
}

# Validação simples para não deixar o erro vivo, porque aparentemente ele gosta.
if ($content -match "['""]presenca['""]") {
  Write-Host "Ainda existe o valor inválido 'presenca' em lib/panel-modules.ts:" -ForegroundColor Red
  $content -split "`n" | Select-String -Pattern "['""]presenca['""]" -Context 2,2
  exit 1
}

if ($content -eq $original) {
  Write-Host "Nenhuma alteração necessária. Talvez o arquivo já esteja corrigido." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Corrigido: grupo 'presenca' trocado para 'presenca_digital'." -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
