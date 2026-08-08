param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$Path = Join-Path $Root "components/painel/AsaasMarketplaceSetup.tsx"

if (-not (Test-Path -LiteralPath $Path)) {
    throw "Arquivo não encontrado: $Path"
}

$content = [System.IO.File]::ReadAllText($Path)

$oldImport = @'
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
'@

$newImport = @'
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
'@

if (-not $content.Contains($oldImport)) {
    throw "Import esperado não encontrado."
}
$content = $content.Replace($oldImport, $newImport)

$oldAuthStart = @'
  async function authToken() {
'@

$newAuthStart = @'
  const authToken = useCallback(async () => {
'@

if (-not $content.Contains($oldAuthStart)) {
    throw "Início de authToken não encontrado."
}
$content = $content.Replace($oldAuthStart, $newAuthStart)

$oldBetween = @'
    return token;
  }

  async function load() {
'@

$newBetween = @'
    return token;
  }, []);

  const load = useCallback(async () => {
'@

if (-not $content.Contains($oldBetween)) {
    throw "Transição authToken/load não encontrada."
}
$content = $content.Replace($oldBetween, $newBetween)

$oldEffect = @'
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);
'@

$newEffect = @'
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);
'@

if (-not $content.Contains($oldEffect)) {
    throw "Bloco useEffect esperado não encontrado."
}
$content = $content.Replace($oldEffect, $newEffect)

[System.IO.File]::WriteAllText(
    $Path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/payments/asaas-config.ts",
    "app/api/payments/asaas/account/route.ts",
    "app/api/payments/asaas/account/status/route.ts",
    "app/painel/pagamentos/asaas/page.tsx",
    "components/painel/AsaasMarketplaceSetup.tsx"
)

Step "Build"
Run $Npm @("run", "build")

Step "Diff"
Run $Git @("diff", "--check")
& $Git --no-pager diff --stat

$targets = @(
    "lib/payments/asaas-config.ts",
    "app/api/payments/asaas/account/route.ts",
    "app/api/payments/asaas/account/status/route.ts",
    "app/painel/pagamentos/asaas/page.tsx",
    "components/painel/AsaasMarketplaceSetup.tsx"
)

Step "Commit"
Run $Git (@("add", "--") + $targets)
Run $Git @("diff", "--cached", "--check")

& $Git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Run $Git @(
        "commit",
        "-m",
        "Reativa cadastro Asaas em sandbox"
    )
}

if ($Push) {
    $branch = (& $Git branch --show-current).Trim()
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ASAAS_SUBCONTA_SETUP_FIX_OK=1" -ForegroundColor Green
