param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Root = "C:\Users\arauj\grafica-flash"
Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Comando não encontrado: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

$Git = Resolve-Cmd "git"

Step "Conferindo estado atual"
& $Git status --short

# As remoções/restaurações do Asaas já foram colocadas no índice pelo
# git restore --staged --worktree do script anterior.
# Só precisamos adicionar a alteração do checkout.
Step "Adicionando pausa da taxa"
Run $Git @(
    "add",
    "--",
    "lib/payments/checkout-service.ts"
)

Step "Validando alterações que serão commitadas"
Run $Git @(
    "diff",
    "--cached",
    "--check"
)

Write-Host ""
Write-Host "Arquivos no commit:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --name-status

Write-Host ""
Write-Host "Resumo:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --stat

& $Git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    throw "Não há alterações staged para commit."
}

Step "Commit"
Run $Git @(
    "commit",
    "-m",
    "Pausa taxa do marketplace e remove migracao Asaas"
)

if ($Push) {
    $branch = (& $Git branch --show-current).Trim()
    if (-not $branch) {
        throw "Não foi possível identificar a branch atual."
    }

    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_MARKETPLACE_FEE_PAUSED_OK=1" -ForegroundColor Green
Write-Host "Mercado Pago mantido no marketplace." -ForegroundColor Cyan
Write-Host "Taxa Orçaly temporariamente em 0%." -ForegroundColor Cyan
Write-Host "Mudanças recentes do Asaas removidas." -ForegroundColor Cyan
