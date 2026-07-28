param(
  [switch]$SkipRemoteCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ProjectId = "prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O"
$OrgId = "team_c5p2Uiz9b1SqKxOhmnmxUWZH"
$ProjectName = "orcaly"
$VercelDir = Join-Path $Root ".vercel"
$ProjectFile = Join-Path $VercelDir "project.json"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - VINCULO LOCAL COM A VERCEL" -ForegroundColor Cyan
Write-Host "Projeto existente, sem criar duplicata" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $VercelDir | Out-Null

$ProjectJson = [ordered]@{
  projectId = $ProjectId
  orgId = $OrgId
  projectName = $ProjectName
} | ConvertTo-Json

[IO.File]::WriteAllText(
  $ProjectFile,
  $ProjectJson + "`n",
  $Utf8
)

Write-Host "[OK] .vercel/project.json criado" -ForegroundColor Green
Write-Host "[OK] Project ID: $ProjectId" -ForegroundColor Green
Write-Host "[OK] Team ID: $OrgId" -ForegroundColor Green
Write-Host "[OK] Projeto: $ProjectName" -ForegroundColor Green

$GitIgnore = Join-Path $Root ".gitignore"

if (Test-Path -LiteralPath $GitIgnore) {
  $IgnoreContent = [IO.File]::ReadAllText($GitIgnore).Replace("`r`n", "`n")

  if (
    -not (
      $IgnoreContent -split "`n" |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -eq ".vercel" -or $_ -eq ".vercel/" }
    )
  ) {
    [IO.File]::WriteAllText(
      $GitIgnore,
      $IgnoreContent.TrimEnd() + "`n.vercel`n",
      $Utf8
    )

    Write-Host "[OK] .vercel adicionado ao .gitignore" -ForegroundColor Green
  } else {
    Write-Host "[JA CONFIGURADO] .vercel no .gitignore" -ForegroundColor DarkGreen
  }
}

Write-Host ""
Write-Host "==> Conferindo arquivo criado" -ForegroundColor Cyan
Get-Content -LiteralPath $ProjectFile

if (-not $SkipRemoteCheck) {
  Write-Host ""
  Write-Host "==> Conferindo acesso ao projeto remoto" -ForegroundColor Cyan

  & npx.cmd vercel project inspect $ProjectName `
    --scope vinicius-araujos-projects

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "O vinculo local foi criado, mas a CLI nao conseguiu consultar a Vercel." -ForegroundColor Yellow
    Write-Host "Execute: npx.cmd vercel login" -ForegroundColor Yellow
    Write-Host "Depois rode este script novamente." -ForegroundColor Yellow
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "PROJETO VERCEL VINCULADO LOCALMENTE" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Agora execute:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\migrar-env-isolado-mercado-pago-vercel-orcaly.ps1"
