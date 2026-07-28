param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\corrigir-auth-assinatura-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$ServicePath = Join-Path $Root "lib\subscription-service.ts"
$ComponentPath = Join-Path $Root "components\subscription\MercadoPagoSubscriptionCheckout.tsx"

function Backup-File([string]$Source, [string]$Relative) {
  $Destination = Join-Path $Backup ($Relative -replace "/", "\")
  New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Replace-Exact(
  [string]$Content,
  [string]$Old,
  [string]$New,
  [string]$Label
) {
  if ($Content.Contains($New)) {
    Write-Host "[JA APLICADO] $Label" -ForegroundColor DarkGreen
    return $Content
  }

  if (-not $Content.Contains($Old)) {
    throw "Trecho nao encontrado: $Label"
  }

  Write-Host "[OK] $Label" -ForegroundColor Green
  return $Content.Replace($Old, $New)
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Execute na branch feature/asaas-sandbox."
}

foreach ($Path in @($ServicePath, $ComponentPath)) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Arquivo necessario nao encontrado: $Path"
  }
}

New-Item -ItemType Directory -Force -Path $Backup | Out-Null
Backup-File $ServicePath "lib/subscription-service.ts"
Backup-File $ComponentPath "components/subscription/MercadoPagoSubscriptionCheckout.tsx"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - CORRECAO DE AUTORIZACAO DA ASSINATURA" -ForegroundColor Cyan
Write-Host "Sessao renovada + cabecalho de seguranca alternativo" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$Service = [IO.File]::ReadAllText($ServicePath).Replace("`r`n", "`n")

$OldRequester = @'
async function getRequester(request: NextRequest, admin: ReturnType<typeof getSupabaseAdmin>) {
  const token = String(request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
'@

$NewRequester = @'
async function getRequester(request: NextRequest, admin: ReturnType<typeof getSupabaseAdmin>) {
  const authorization = String(
    request.headers.get("authorization") || "",
  ).trim();
  const fallbackSession = String(
    request.headers.get("x-orcaly-session") || "",
  ).trim();
  const token = (authorization || fallbackSession)
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
}
'@

$Service = Replace-Exact `
  $Service `
  $OldRequester `
  $NewRequester `
  "backend aceita Authorization ou x-orcaly-session"

[IO.File]::WriteAllText(
  $ServicePath,
  $Service.TrimEnd() + "`n",
  $Utf8
)

$Component = [IO.File]::ReadAllText($ComponentPath).Replace("`r`n", "`n")

$OldGetToken = @'
  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);
'@

$NewGetToken = @'
  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const expiresAt = Number(session?.expires_at || 0);
    const stillValid =
      Boolean(session?.access_token) &&
      expiresAt > Math.floor(Date.now() / 1000) + 60;

    if (stillValid) {
      return session?.access_token || "";
    }

    const { data: refreshed } =
      await supabase.auth.refreshSession();

    return (
      refreshed.session?.access_token ||
      session?.access_token ||
      ""
    );
  }, []);
'@

$Component = Replace-Exact `
  $Component `
  $OldGetToken `
  $NewGetToken `
  "sessao renovada antes do pagamento"

$OldHeader = @'
            authorization: `Bearer ${token}`,
'@

$NewHeader = @'
            authorization: `Bearer ${token}`,
            "x-orcaly-session": token,
'@

$HeaderCountBefore = ([regex]::Matches(
  $Component,
  [regex]::Escape($OldHeader)
)).Count

if ($HeaderCountBefore -gt 0) {
  $Component = $Component.Replace($OldHeader, $NewHeader)
  Write-Host "[OK] cabecalho alternativo adicionado em $HeaderCountBefore requisicao(oes)" -ForegroundColor Green
} elseif ($Component.Contains($NewHeader)) {
  Write-Host "[JA APLICADO] cabecalho alternativo nas requisicoes" -ForegroundColor DarkGreen
} else {
  throw "Nao foi possivel localizar os cabecalhos protegidos da assinatura."
}

[IO.File]::WriteAllText(
  $ComponentPath,
  $Component.TrimEnd() + "`n",
  $Utf8
)

Write-Host ""
Write-Host "==> Verificando alteracoes" -ForegroundColor Cyan

$ServiceCheck = Select-String `
  -LiteralPath $ServicePath `
  -Pattern 'x-orcaly-session' `
  -SimpleMatch `
  -ErrorAction SilentlyContinue

$ComponentCheck = Select-String `
  -LiteralPath $ComponentPath `
  -Pattern '"x-orcaly-session": token' `
  -SimpleMatch `
  -ErrorAction SilentlyContinue

if (-not $ServiceCheck -or -not $ComponentCheck) {
  throw "A verificacao da correcao de autorizacao falhou."
}

Write-Host "[OK] cliente e servidor usam o mesmo fallback de sessao" -ForegroundColor Green

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Limpando cache do Next" -ForegroundColor Cyan
  Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build falhou. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "AUTORIZACAO DA ASSINATURA CORRIGIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "A sessao e renovada quando estiver perto de expirar."
Write-Host "Authorization continua sendo enviado normalmente."
Write-Host "x-orcaly-session funciona como fallback no servidor."
Write-Host "Backup: $Backup"
