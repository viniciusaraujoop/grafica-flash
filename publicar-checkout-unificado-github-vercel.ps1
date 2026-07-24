param(
    [string]$Branch = "feature/asaas-sandbox",
    [string]$CommitMessage = "Forca checkout unificado em todos os fluxos",
    [switch]$SkipBuild,
    [switch]$OpenVercel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao executar: $Command $($Arguments -join ' ')"
    }
}

$Root = (Get-Location).Path

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto."
}

if (-not (Test-Path -LiteralPath (Join-Path $Root ".git"))) {
    throw "A pasta atual nao e um repositorio Git."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - PUBLICAR NO GITHUB E VERCEL" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$currentBranch = (& git branch --show-current).Trim()

if (-not $currentBranch) {
    throw "Nao foi possivel identificar a branch atual."
}

Write-Host "Branch atual: $currentBranch"
Write-Host "Branch esperada: $Branch"

if ($currentBranch -ne $Branch) {
    throw "Voce esta na branch '$currentBranch'. Troque para '$Branch' antes de publicar."
}

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "==> Executando build antes da publicacao" -ForegroundColor Cyan
    & npm.cmd run build
    $buildCode = $LASTEXITCODE
    Write-Host "BUILD_EXIT_CODE=$buildCode"

    if ($buildCode -ne 0) {
        throw "O build falhou. Nada foi enviado ao GitHub."
    }
}

Write-Host ""
Write-Host "==> Verificando alteracoes" -ForegroundColor Cyan
& git status --short

$changes = (& git status --porcelain)

if (-not $changes) {
    Write-Host ""
    Write-Host "Nenhuma alteracao nova para enviar." -ForegroundColor Yellow
    Write-Host "O ultimo commit da branch sera enviado novamente, caso ainda nao esteja no remoto."
} else {
    Write-Host ""
    Write-Host "==> Adicionando alteracoes" -ForegroundColor Cyan
    Run "git" @("add", "--all")

    $staged = (& git diff --cached --name-only)

    if ($staged) {
        Write-Host ""
        Write-Host "==> Criando commit" -ForegroundColor Cyan
        Run "git" @("commit", "-m", $CommitMessage)
    } else {
        Write-Host "Nenhum arquivo ficou preparado para commit." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==> Enviando para o GitHub" -ForegroundColor Cyan
Run "git" @("push", "-u", "origin", $Branch)

$commitSha = (& git rev-parse HEAD).Trim()
$shortSha = (& git rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "PUBLICACAO ENVIADA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Branch: $Branch"
Write-Host "Commit: $shortSha"
Write-Host "SHA completo: $commitSha"
Write-Host ""
Write-Host "O GitHub recebeu as alteracoes."
Write-Host "A integracao Git da Vercel deve criar o Preview automaticamente."
Write-Host ""
Write-Host "Preview da branch:"
Write-Host "https://orcaly-git-feature-asaas-sandbox-vinicius-araujos-projects.vercel.app"
Write-Host ""
Write-Host "Painel de deploys:"
Write-Host "https://vercel.com/vinicius-araujos-projects/orcaly/deployments"
Write-Host ""
Write-Host "Aguarde o deploy ficar READY antes de testar." -ForegroundColor Green

if ($OpenVercel) {
    Start-Process "https://vercel.com/vinicius-araujos-projects/orcaly/deployments"
}
