param(
    [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command,

        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Coloque este PS1 diretamente na raiz do projeto grafica-flash."
}

$branch = (& git branch --show-current).Trim()

if ($LASTEXITCODE -ne 0 -or -not $branch) {
    throw "Não foi possível identificar a branch atual."
}

Step "Confirmando rota ativa"

$activeRoute = "app/api/checkout/plano/route.ts"
$legacyRoute = "app/api/checkout/plano/route.mercado-pago.ts"

if (-not (Test-Path -LiteralPath $activeRoute -PathType Leaf)) {
    throw "Rota ativa não encontrada: $activeRoute"
}

$activeContent = Get-Content -LiteralPath $activeRoute -Raw

if (-not $activeContent.Contains("LEGACY_PAYMENT_ROUTE_DISABLED")) {
    throw "A rota ativa não está neutralizada. Não é seguro remover o arquivo legado."
}

Write-Host "  [OK] /api/checkout/plano continua bloqueada com HTTP 410" -ForegroundColor Green

Step "Removendo implementação Mercado Pago legada"

if (Test-Path -LiteralPath $legacyRoute -PathType Leaf) {
    Remove-Item -LiteralPath $legacyRoute -Force
    Write-Host "  [OK] $legacyRoute removido" -ForegroundColor Green
}
else {
    Write-Host "  [OK] O arquivo legado já não existe" -ForegroundColor Green
}

Step "Validando isolamento das credenciais"
Invoke-Checked npm run verify:payment-credentials

Step "Validando contratos dos pagamentos"
Invoke-Checked npm run verify:payments

Step "Executando ESLint"
Invoke-Checked npx eslint `
    app/api/mercado-pago/webhook-leads/route.ts `
    app/api/checkout/plano/route.ts `
    scripts/auditar-isolamento-pagamentos.cjs

Step "Executando build completo"
Invoke-Checked npm run build

Step "Verificando diff"
Invoke-Checked git diff --check

git diff --stat
git status --short

$commitFiles = @(
    ".env.example",
    "package.json",
    "app/api/mercado-pago/webhook-leads/route.ts",
    "app/api/checkout/plano/route.mercado-pago.ts",
    "scripts/auditar-isolamento-pagamentos.cjs"
)

Step "Criando commit da separação de credenciais"

Invoke-Checked git add -- @commitFiles
Invoke-Checked git diff --cached --check

& git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Invoke-Checked git commit -m "Isola credenciais Mercado Pago por fluxo"
    $hash = (& git rev-parse --short HEAD).Trim()
    Write-Host "Commit criado: $hash" -ForegroundColor Green
}

if ($Push) {
    Step "Enviando branch ao GitHub"
    Invoke-Checked git push -u origin $branch
}

Write-Host ""
Write-Host "Isolamento dos três fluxos concluído." -ForegroundColor Green
Write-Host ""
Write-Host "Próxima etapa: deploy com as credenciais novas e teste de cadastro, assinatura e marketplace." -ForegroundColor Cyan
Write-Host "Ainda não remova as variáveis genéricas antigas da Vercel até o deploy passar." -ForegroundColor Yellow
