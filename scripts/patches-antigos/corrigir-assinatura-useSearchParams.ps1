$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\assinatura\page.tsx"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-useSearchParams-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = Get-Content -LiteralPath $file -Raw

# Remove useSearchParams do import do Next.
$content = $content -replace "import \{ useRouter, useSearchParams \} from 'next/navigation'", "import { useRouter } from 'next/navigation'"
$content = $content -replace 'import \{ useRouter, useSearchParams \} from "next/navigation"', 'import { useRouter } from "next/navigation"'

# Remove a linha const searchParams = useSearchParams()
$content = $content -replace "\s*const searchParams = useSearchParams\(\)\r?\n", "`r`n"

# Troca leitura de searchParams por leitura segura no browser.
$content = $content -replace "const retorno = searchParams\.get\('assinatura'\)", "const retorno = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('assinatura') : null"
$content = $content -replace 'const retorno = searchParams\.get\("assinatura"\)', 'const retorno = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("assinatura") : null'

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "useSearchParams removido da pagina /assinatura." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
