param(
  [switch]$BuildBeforeZip
)

$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto não encontrado em: $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

if (!(Test-Path -LiteralPath "package.json")) {
  Write-Host "package.json não encontrado. Confira se você está na raiz do projeto." -ForegroundColor Red
  exit 1
}

if ($BuildBeforeZip) {
  Write-Host "Rodando build antes de gerar o ZIP..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Build falhou. ZIP não será gerado." -ForegroundColor Red
    exit 1
  }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path ([Environment]::GetFolderPath("Desktop")) "orcaly-projeto-atualizado-$stamp.zip"

$excludedFolders = @(
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".turbo",
  ".swc",
  "coverage",
  "dist",
  "out"
)

$excludedExactFiles = @(
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".DS_Store",
  "Thumbs.db"
)

$excludedExtensions = @(
  ".zip",
  ".log"
)

$files = Get-ChildItem -LiteralPath $project -Recurse -File | Where-Object {
  $full = $_.FullName
  $relative = $full.Substring($project.Length).TrimStart("\", "/")
  $parts = $relative -split "[\\/]"
  $fileName = $_.Name

  foreach ($folder in $excludedFolders) {
    if ($parts -contains $folder) {
      return $false
    }
  }

  if ($excludedExactFiles -contains $fileName) {
    return $false
  }

  if ($fileName -like ".env.*") {
    return $false
  }

  if ($fileName -like "*.backup-*") {
    return $false
  }

  if ($fileName -like "*backup*") {
    return $false
  }

  if ($excludedExtensions -contains $_.Extension.ToLower()) {
    return $false
  }

  return $true
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)

try {
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($project.Length).TrimStart("\", "/")
    $entryName = $relative -replace "\\", "/"
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
}
finally {
  $zip.Dispose()
}

$sizeMb = [Math]::Round((Get-Item -LiteralPath $output).Length / 1MB, 2)

Write-Host ""
Write-Host "ZIP gerado com sucesso:" -ForegroundColor Green
Write-Host $output -ForegroundColor Yellow
Write-Host "Arquivos incluídos: $($files.Count)" -ForegroundColor Cyan
Write-Host "Tamanho: $sizeMb MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pode enviar esse ZIP aqui no chat para eu analisar o estado real do projeto." -ForegroundColor Green
