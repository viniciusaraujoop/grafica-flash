param(
    [string]$ProjectRoot = "C:\Users\arauj\grafica-flash"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$ExpectedBranch = "fix/unify-payment-flows-phase-1"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\fase2-merge-v5-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

$MigrationRelative = "supabase/migrations/20260811231921_platform_admin_prospector_permissions_foundation.sql"
$MigrationSha = "039C88B48FD4B030DEBBF8B7B9BA179D5B0A7BB01903BC5ED3A630F0934F4102"
$MigrationBase64 = "LS0gT3LDp2FseSDigJQgRkFTRSAyCi0tIEZ1bmRhw6fDo28gZGUgYXV0b3JpemHDp8OjbyBhZG1pbmlzdHJhdGl2YSBwYXJhIG8gcGFwZWwgUHJvc3BlY3Rvci4KLS0gQSBhdXRvcmlkYWRlIHByaW5jaXBhbCBjb250aW51YSBzZW5kbyBwdWJsaWMucGxhdGZvcm1fYWRtaW5zLgoKZG8gJCQKYmVnaW4KICBpZiBub3QgZXhpc3RzICgKICAgIHNlbGVjdCAxIGZyb20gcGdfY29uc3RyYWludAogICAgd2hlcmUgY29ucmVsaWQgPSAncHVibGljLnBsYXRmb3JtX2FkbWlucyc6OnJlZ2NsYXNzCiAgICAgIGFuZCBjb25uYW1lID0gJ3BsYXRmb3JtX2FkbWluc19yb2xlX2NoZWNrX3YyJwogICkgdGhlbgogICAgYWx0ZXIgdGFibGUgcHVibGljLnBsYXRmb3JtX2FkbWlucwogICAgICBhZGQgY29uc3RyYWludCBwbGF0Zm9ybV9hZG1pbnNfcm9sZV9jaGVja192MgogICAgICBjaGVjayAoCiAgICAgICAgbG93ZXIocm9sZSkgaW4gKAogICAgICAgICAgJ293bmVyJywKICAgICAgICAgICdzdXBlcl9hZG1pbicsCiAgICAgICAgICAnYWRtaW4nLAogICAgICAgICAgJ2ZpbmFuY2UnLAogICAgICAgICAgJ3N1cHBvcnQnLAogICAgICAgICAgJ3N1cG9ydGUnLAogICAgICAgICAgJ3Byb3NwZWN0b3InCiAgICAgICAgKQogICAgICApOwogIGVuZCBpZjsKZW5kCiQkOwoKY3JlYXRlIG9yIHJlcGxhY2UgZnVuY3Rpb24gcHVibGljLmdldF9teV9wbGF0Zm9ybV9hZG1pbl9hY2Nlc3MoKQpyZXR1cm5zIHRhYmxlKAogIGFkbWluX2lkIHV1aWQsCiAgYWRtaW5fZW1haWwgdGV4dCwKICBhZG1pbl9yb2xlIHRleHQsCiAgYWRtaW5faXNfYWN0aXZlIGJvb2xlYW4sCiAgbXVzdF9jaGFuZ2VfcGFzc3dvcmQgYm9vbGVhbiwKICBwZXJtaXNzaW9ucyBqc29uYgopCmxhbmd1YWdlIHNxbApzdGFibGUKc2VjdXJpdHkgZGVmaW5lcgpzZXQgc2VhcmNoX3BhdGggdG8gJ3BnX2NhdGFsb2cnLCAncHVibGljJwphcyAkJAogIHNlbGVjdAogICAgcC5pZCwKICAgIGxvd2VyKHAuZW1haWwpLAogICAgY2FzZQogICAgICB3aGVuIGxvd2VyKHAucm9sZSkgaW4gKCdvd25lcicsICdzdXBlcl9hZG1pbicpIHRoZW4gJ293bmVyJwogICAgICB3aGVuIGxvd2VyKHAucm9sZSkgaW4gKCdzdXBwb3J0JywgJ3N1cG9ydGUnKSB0aGVuICdzdXBwb3J0JwogICAgICB3aGVuIGxvd2VyKHAucm9sZSkgPSAnZmluYW5jZScgdGhlbiAnZmluYW5jZScKICAgICAgd2hlbiBsb3dlcihwLnJvbGUpID0gJ3Byb3NwZWN0b3InIHRoZW4gJ3Byb3NwZWN0b3InCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSA9ICdhZG1pbicgdGhlbiAnYWRtaW4nCiAgICAgIGVsc2UgbnVsbAogICAgZW5kLAogICAgcC5pc19hY3RpdmUsCiAgICBwLm11c3RfY2hhbmdlX3Bhc3N3b3JkLAogICAgY29hbGVzY2UocC5wZXJtaXNzaW9ucywgJ3t9Jzo6anNvbmIpCiAgZnJvbSBwdWJsaWMucGxhdGZvcm1fYWRtaW5zIHAKICB3aGVyZSBwLnVzZXJfaWQgPSBhdXRoLnVpZCgpCiAgICBhbmQgcC5pc19hY3RpdmUgPSB0cnVlCiAgICBhbmQgbG93ZXIocC5yb2xlKSBpbiAoCiAgICAgICdvd25lcicsCiAgICAgICdzdXBlcl9hZG1pbicsCiAgICAgICdhZG1pbicsCiAgICAgICdmaW5hbmNlJywKICAgICAgJ3N1cHBvcnQnLAogICAgICAnc3Vwb3J0ZScsCiAgICAgICdwcm9zcGVjdG9yJwogICAgKQogIG9yZGVyIGJ5CiAgICBjYXNlCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSBpbiAoJ293bmVyJywgJ3N1cGVyX2FkbWluJykgdGhlbiAwCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSA9ICdhZG1pbicgdGhlbiAxCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSA9ICdmaW5hbmNlJyB0aGVuIDIKICAgICAgd2hlbiBsb3dlcihwLnJvbGUpIGluICgnc3VwcG9ydCcsICdzdXBvcnRlJykgdGhlbiAzCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSA9ICdwcm9zcGVjdG9yJyB0aGVuIDQKICAgICAgZWxzZSA5CiAgICBlbmQsCiAgICBwLmNyZWF0ZWRfYXQKICBsaW1pdCAxOwokJDsKCnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHVibGljLmdldF9teV9wbGF0Zm9ybV9hZG1pbl9hY2Nlc3MoKSBmcm9tIHB1YmxpYywgYW5vbjsKZ3JhbnQgZXhlY3V0ZSBvbiBmdW5jdGlvbiBwdWJsaWMuZ2V0X215X3BsYXRmb3JtX2FkbWluX2FjY2VzcygpCiAgdG8gYXV0aGVudGljYXRlZCwgc2VydmljZV9yb2xlOwoKY3JlYXRlIG9yIHJlcGxhY2UgZnVuY3Rpb24gb3JjYWx5X3ByaXZhdGUuaXNfb3JjYWx5X2FkbWluKCkKcmV0dXJucyBib29sZWFuCmxhbmd1YWdlIHNxbApzdGFibGUKc2VjdXJpdHkgZGVmaW5lcgpzZXQgc2VhcmNoX3BhdGggdG8gJycKYXMgJCQKICBzZWxlY3QgZXhpc3RzICgKICAgIHNlbGVjdCAxCiAgICBmcm9tIHB1YmxpYy5wbGF0Zm9ybV9hZG1pbnMgcAogICAgd2hlcmUgcC5pc19hY3RpdmUgPSB0cnVlCiAgICAgIGFuZCBwLnVzZXJfaWQgPSBhdXRoLnVpZCgpCiAgICAgIGFuZCBsb3dlcihwLnJvbGUpIGluICgKICAgICAgICAnb3duZXInLAogICAgICAgICdzdXBlcl9hZG1pbicsCiAgICAgICAgJ2FkbWluJywKICAgICAgICAnc3VwcG9ydCcsCiAgICAgICAgJ3N1cG9ydGUnCiAgICAgICkKICApOwokJDsKCnVwZGF0ZSBwdWJsaWMuYWRtaW5fdXNlcnMgYXUKc2V0CiAgYXRpdm8gPSBmYWxzZSwKICB1cGRhdGVkX2F0ID0gbm93KCkKd2hlcmUgYXUuYXRpdm8gPSB0cnVlCiAgYW5kIGV4aXN0cyAoCiAgICBzZWxlY3QgMQogICAgZnJvbSBwdWJsaWMucGxhdGZvcm1fYWRtaW5zIHAKICAgIHdoZXJlIGxvd2VyKHAuZW1haWwpID0gbG93ZXIoYXUuZW1haWwpCiAgICAgIGFuZCBwLmlzX2FjdGl2ZSA9IGZhbHNlCiAgKTsK"

$Changed = New-Object System.Collections.Generic.List[string]
$Backups = @{}

function Step([string]$Text) {
    Write-Host ""
    Write-Host ("==> " + $Text) -ForegroundColor Cyan
}

function Ok([string]$Text) {
    Write-Host ("[OK] " + $Text) -ForegroundColor Green
}

function Warn([string]$Text) {
    Write-Host ("[AVISO] " + $Text) -ForegroundColor Yellow
}

function FullPath([string]$Relative) {
    return Join-Path $ProjectRoot ($Relative -replace "/", "\")
}

function ReadNormalized([string]$Relative) {
    $raw = [IO.File]::ReadAllText((FullPath $Relative))
    return $raw.Replace("`r`n", "`n")
}

function WriteNormalized([string]$Relative, [string]$Text) {
    $path = FullPath $Relative
    [IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
    [IO.File]::WriteAllText($path, $Text.Replace("`r`n", "`n"), $Utf8NoBom)
}

function CountExact([string]$Text, [string]$Needle) {
    $count = 0
    $start = 0

    while ($true) {
        $index = $Text.IndexOf($Needle, $start, [StringComparison]::Ordinal)
        if ($index -lt 0) { break }

        $count++
        $start = $index + $Needle.Length
    }

    return $count
}

function NormalizeNewlines([string]$Value) {
    if ($null -eq $Value) {
        return ""
    }

    return $Value.Replace("`r`n", "`n").Replace("`r", "`n")
}

function ReplaceOnce(
    [string]$Text,
    [string]$Needle,
    [string]$Replacement,
    [string]$Label
) {
    $normalizedText = NormalizeNewlines $Text
    $normalizedNeedle = NormalizeNewlines $Needle
    $normalizedReplacement = NormalizeNewlines $Replacement

    $count = CountExact $normalizedText $normalizedNeedle

    if ($count -ne 1) {
        throw (
            $Label +
            ": trecho encontrado " +
            $count +
            " vez(es), esperado 1."
        )
    }

    $index = $normalizedText.IndexOf(
        $normalizedNeedle,
        [StringComparison]::Ordinal
    )

    return (
        $normalizedText.Substring(0, $index) +
        $normalizedReplacement +
        $normalizedText.Substring(
            $index + $normalizedNeedle.Length
        )
    )
}

function Backup([string]$Relative) {
    $source = FullPath $Relative

    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        return
    }

    $destination = Join-Path $BackupRoot ($Relative -replace "/", "\")
    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
    $Backups[$Relative] = $destination
}

function MarkChanged([string]$Relative) {
    if (-not $Changed.Contains($Relative)) {
        $Changed.Add($Relative)
    }
}

function Rollback {
    [array]$items = @($Changed)
    [Array]::Reverse($items)

    foreach ($relative in $items) {
        if ($Backups.ContainsKey($relative)) {
            Copy-Item -LiteralPath $Backups[$relative] -Destination (FullPath $relative) -Force
            Warn ("Restaurado: " + $relative)
        }
        else {
            Remove-Item -LiteralPath (FullPath $relative) -Force -ErrorAction SilentlyContinue
            Warn ("Removido: " + $relative)
        }
    }
}

try {
    Write-Host ""
    Write-Host "ORCALY - FASE 2 - MERGE OWNER/SUPPORT + PROSPECTOR V6" -ForegroundColor Cyan
    Write-Host "Preserva o hardening local ORCALY_OWNER_BACKOFFICE_V2." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (FullPath "package.json") -PathType Leaf)) {
        throw "Repositorio Orcaly nao encontrado."
    }

    Set-Location $ProjectRoot

    $branch = ([string]((& git branch --show-current) | Select-Object -First 1)).Trim()

    if ($branch -ne $ExpectedBranch) {
        throw ("Branch atual: " + $branch + ". Esperada: " + $ExpectedBranch)
    }

    Step "Validando o hardening local real"

    $platformPath = "lib/platform-admin.ts"
    $proxyPath = "proxy.ts"
    $sessionPath = "app/api/admin/session/route.ts"
    $companyPath = "lib/company-access.ts"
    $prospectingPath = "app/admin/prospeccao/page.tsx"

    foreach ($relative in @($platformPath, $proxyPath, $sessionPath, $companyPath)) {
        if (-not (Test-Path -LiteralPath (FullPath $relative) -PathType Leaf)) {
            throw ("Arquivo nao encontrado: " + $relative)
        }
    }

    $platform = ReadNormalized $platformPath
    $proxy = ReadNormalized $proxyPath
    $session = ReadNormalized $sessionPath
    $company = ReadNormalized $companyPath

    $platformAnchors = @(
        "// ORCALY_OWNER_BACKOFFICE_V2",
        "export const OFFICIAL_PLATFORM_OWNER_EMAIL = 'viniciusadm@orcaly.com'",
        "export type PlatformRole = 'owner' | 'admin' | 'finance' | 'support'",
        "const SUPPORT_ALLOWED = new Set<PlatformPermission>([",
        "if (admin.role !== 'support') return false",
        "if (role !== 'owner' && role !== 'support') return null",
        "export async function requireOfficialPlatformOwner("
    )

    foreach ($anchor in $platformAnchors) {
        if (-not $platform.Contains($anchor)) {
            throw ("platform-admin.ts local nao corresponde ao hardening V2 mostrado. Trecho ausente: " + $anchor)
        }
    }

    $proxyAnchors = @(
        "// ORCALY_OWNER_BACKOFFICE_V2",
        "const OFFICIAL_OWNER_EMAIL = 'viniciusadm@orcaly.com'",
        "const activeSupport = active && role === 'support'",
        "if (adminPage && !officialOwner) {",
        "destination.pathname = activeSupport ? '/suporte' : '/parceiros/login'",
        "if (supportPage && !activeSupport && !officialOwner) {"
    )

    foreach ($anchor in $proxyAnchors) {
        if (-not $proxy.Contains($anchor)) {
            throw ("proxy.ts local nao corresponde ao hardening V2 mostrado. Trecho ausente: " + $anchor)
        }
    }

    if ($platform.Contains("sanitizeProspectorPermissions") -or
        $platform.Contains("| 'portal.access'") -or
        $proxy.Contains("activeProspector")) {
        throw "Detectei aplicacao parcial da FASE 2. Interrompendo para evitar duplicacao."
    }

    foreach ($relative in @($sessionPath, $companyPath)) {
        $status = @(& git status --porcelain -- $relative)

        if ($status.Count -gt 0) {
            throw (
                $relative +
                " possui alteracao local/staged que nao apareceu no diagnostico anterior: " +
                [string]$status[0]
            )
        }

        Ok ($relative + " continua limpo.")
    }

    if (Test-Path -LiteralPath (FullPath $prospectingPath)) {
        throw ($prospectingPath + " ja existe. Nao vou sobrescrever.")
    }

    Ok "Hardening Owner/Support local reconhecido."
    Ok "A FASE 2 ainda nao esta parcialmente aplicada."

    Step "Criando backups"

    foreach ($relative in @($platformPath, $proxyPath, $sessionPath, $companyPath)) {
        Backup $relative
    }

    Step "Sincronizando a migration ja aplicada no Supabase"

    $migrationPath = FullPath $MigrationRelative

    if (Test-Path -LiteralPath $migrationPath) {
        $actualSha = (Get-FileHash $migrationPath -Algorithm SHA256).Hash.ToUpperInvariant()

        if ($actualSha -ne $MigrationSha) {
            throw "A migration da FASE 2 existe localmente com conteudo diferente do banco."
        }

        Ok "Migration FASE 2 ja estava sincronizada."
    }
    else {
        [IO.Directory]::CreateDirectory((Split-Path -Parent $migrationPath)) | Out-Null
        [IO.File]::WriteAllBytes(
            $migrationPath,
            [Convert]::FromBase64String($MigrationBase64)
        )
        MarkChanged $MigrationRelative
        Ok "Migration FASE 2 criada localmente."
    }

    Step "Mesclando Prospector em lib/platform-admin.ts"

    if (-not $platform.Contains("export type PlatformPermission =")) {
        throw "platform-admin.ts nao possui a declaracao PlatformPermission esperada."
    }

    Ok "Declaracoes-base do platform-admin.ts localizadas."

    $platform = ReplaceOnce $platform @'
export type PlatformRole = 'owner' | 'admin' | 'finance' | 'support'
'@ @'
export type PlatformRole = 'owner' | 'admin' | 'finance' | 'support' | 'prospector'
'@ "PlatformRole"

    $platform = ReplaceOnce $platform @'
export type PlatformPermission =
  | 'dashboard.view'
'@ @'
export type PlatformPermission =
  | 'portal.access'
  | 'dashboard.view'
'@ "portal.access"

    $platform = ReplaceOnce $platform @'
  | 'audit.view'
  | 'settings.manage'
'@ @'
  | 'audit.view'
  | 'settings.manage'
  | 'founders.view_own'
  | 'founders.view_all'
  | 'founders.create_invite'
  | 'founders.resend_invite'
  | 'founders.revoke_pending'
  | 'prospecting.access'
  | 'prospecting.view_own'
  | 'prospecting.view_all'
  | 'prospecting.create'
  | 'prospecting.edit_own'
  | 'performance.view_own'
  | 'performance.view_all'
'@ "Permissoes comerciais"

    $platform = ReplaceOnce $platform @'
]> = [
  { key: 'dashboard.view', label: 'Ver central de suporte', description: 'Acessar o resumo operacional permitido ao suporte.', supportAssignable: true },
'@ @'
]> = [
  { key: 'portal.access', label: 'Acessar portal interno', description: 'Entrar somente nas areas internas permitidas ao perfil.', supportAssignable: true },
  { key: 'dashboard.view', label: 'Ver central de suporte', description: 'Acessar o resumo operacional permitido ao suporte.', supportAssignable: true },
'@ "Catalogo portal"

    $commercialCatalog = @'
  { key: 'founders.view_own', label: 'Ver próprios Fundadores', description: 'Consultar convites e Fundadores criados pelo próprio usuário.', supportAssignable: false },
  { key: 'founders.view_all', label: 'Ver todos os Fundadores', description: 'Consultar todos os Fundadores da plataforma.', supportAssignable: false },
  { key: 'founders.create_invite', label: 'Criar convite Founder', description: 'Gerar convite seguro para Cliente Fundador.', supportAssignable: false },
  { key: 'founders.resend_invite', label: 'Reenviar convite Founder', description: 'Rotacionar e reenviar convite Founder pendente.', supportAssignable: false },
  { key: 'founders.revoke_pending', label: 'Revogar convite Founder', description: 'Revogar convite Founder ainda pendente.', supportAssignable: false },
  { key: 'prospecting.access', label: 'Acessar Prospecção', description: 'Acessar a área comercial de prospecção.', supportAssignable: false },
  { key: 'prospecting.view_own', label: 'Ver próprios prospects', description: 'Consultar prospects atribuídos ao próprio usuário.', supportAssignable: false },
  { key: 'prospecting.view_all', label: 'Ver todos os prospects', description: 'Consultar todo o pipeline comercial.', supportAssignable: false },
  { key: 'prospecting.create', label: 'Criar prospects', description: 'Cadastrar novas oportunidades comerciais.', supportAssignable: false },
  { key: 'prospecting.edit_own', label: 'Editar próprios prospects', description: 'Atualizar oportunidades atribuídas ao próprio usuário.', supportAssignable: false },
  { key: 'performance.view_own', label: 'Ver própria performance', description: 'Consultar os próprios indicadores comerciais.', supportAssignable: false },
  { key: 'performance.view_all', label: 'Ver performance da equipe', description: 'Consultar indicadores da equipe comercial.', supportAssignable: false },
'@

    $platform = ReplaceOnce $platform @'
  { key: 'team.manage', label: 'Gerenciar equipe', description: 'Criar e administrar acessos internos.', supportAssignable: false },
'@ ($commercialCatalog + @'
  { key: 'team.manage', label: 'Gerenciar equipe', description: 'Criar e administrar acessos internos.', supportAssignable: false },
'@) "Catalogo comercial"

    $platform = ReplaceOnce $platform @'
  'team.manage', 'audit.view', 'settings.manage',
])
'@ @'
  'team.manage', 'audit.view', 'settings.manage',
  'founders.view_all', 'prospecting.view_all', 'performance.view_all',
])
'@ "Owner only comercial"

    $platform = ReplaceOnce $platform @'
const SUPPORT_ALLOWED = new Set<PlatformPermission>([
  'dashboard.view', 'companies.view', 'marketplace.view',
  'affiliates.view', 'referrals.view', 'contact.view',
])
'@ @'
const SUPPORT_ALLOWED = new Set<PlatformPermission>([
  'portal.access', 'dashboard.view', 'companies.view', 'marketplace.view',
  'affiliates.view', 'referrals.view', 'contact.view',
])

const PROSPECTOR_ALLOWED = new Set<PlatformPermission>([
  'portal.access',
  'founders.view_own',
  'founders.create_invite',
  'founders.resend_invite',
  'founders.revoke_pending',
  'prospecting.access',
  'prospecting.view_own',
  'prospecting.create',
  'prospecting.edit_own',
  'performance.view_own',
])

const PROSPECTOR_DEFAULTS = new Set<PlatformPermission>([
  'portal.access',
  'founders.view_own',
  'founders.create_invite',
  'founders.resend_invite',
  'founders.revoke_pending',
  'prospecting.access',
  'prospecting.view_own',
  'prospecting.create',
  'prospecting.edit_own',
  'performance.view_own',
])
'@ "Sets Support/Prospector"

    $platform = ReplaceOnce $platform @'
  if (role === 'owner' || role === 'admin' || role === 'finance' || role === 'support') return role
'@ @'
  if (role === 'owner' || role === 'admin' || role === 'finance' || role === 'support' || role === 'prospector') return role
'@ "Normalize Prospector"

    $platform = ReplaceOnce $platform @'
export function canPlatform(admin: PlatformAdmin, permission: PlatformPermission) {
  if (admin.role === 'owner') return isOfficialPlatformOwner(admin)
  if (admin.role !== 'support') return false
  if (OWNER_ONLY.has(permission) || !SUPPORT_ALLOWED.has(permission)) return false
  if (typeof admin.permissions[permission] === 'boolean') return admin.permissions[permission] === true
  return permission === 'dashboard.view'
}
'@ @'
export function canPlatform(admin: PlatformAdmin, permission: PlatformPermission) {
  if (admin.role === 'owner') return isOfficialPlatformOwner(admin)

  if (OWNER_ONLY.has(permission)) return false

  if (admin.role === 'support') {
    if (!SUPPORT_ALLOWED.has(permission)) return false
    if (typeof admin.permissions[permission] === 'boolean') {
      return admin.permissions[permission] === true
    }
    return permission === 'portal.access' || permission === 'dashboard.view'
  }

  if (admin.role === 'prospector') {
    if (!PROSPECTOR_ALLOWED.has(permission)) return false
    if (typeof admin.permissions[permission] === 'boolean') {
      return admin.permissions[permission] === true
    }
    return PROSPECTOR_DEFAULTS.has(permission)
  }

  return false
}
'@ "canPlatform Prospector"

    $platform = ReplaceOnce $platform @'
  for (const permission of SUPPORT_ALLOWED) {
    result[permission] = permission === 'dashboard.view' ? true : input[permission] === true
  }
'@ @'
  for (const permission of SUPPORT_ALLOWED) {
    result[permission] =
      permission === 'portal.access' || permission === 'dashboard.view'
        ? true
        : input[permission] === true
  }
'@ "Support portal.access"

    $prospectorSanitizer = @'

export function sanitizeProspectorPermissions(value: unknown) {
  const input = normalizePermissions(value)
  const result: Record<string, boolean> = {}

  for (const permission of PROSPECTOR_ALLOWED) {
    result[permission] =
      typeof input[permission] === 'boolean'
        ? input[permission]
        : PROSPECTOR_DEFAULTS.has(permission)
  }

  result['portal.access'] = true
  result['founders.view_own'] = true
  result['prospecting.access'] = true
  result['prospecting.view_own'] = true
  result['performance.view_own'] = true

  return result
}

'@

    $platform = ReplaceOnce $platform @'
export async function getCurrentPlatformAdminFromRequest(request: NextRequest): Promise<PlatformAdmin | null> {
'@ ($prospectorSanitizer + @'
export async function getCurrentPlatformAdminFromRequest(request: NextRequest): Promise<PlatformAdmin | null> {
'@) "sanitizeProspectorPermissions"

    $platform = ReplaceOnce $platform @'
  const email = requester.email.toLowerCase()
  const { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select('id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password')
    .or(`user_id.eq.${requester.id},email.ilike.${email}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !admin) return null
'@ @'
  const email = requester.email.toLowerCase()
  const adminSelect =
    'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password'

  let { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select(adminSelect)
    .eq('user_id', requester.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!error && !admin) {
    const fallback = await supabaseAdmin
      .from('platform_admins')
      .select(adminSelect)
      .is('user_id', null)
      .ilike('email', email)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    admin = fallback.data
    error = fallback.error
  }

  if (error || !admin) return null
'@ "Lookup platform_admins seguro"

    $platform = ReplaceOnce $platform @'
  if (role === 'owner' && email !== OFFICIAL_PLATFORM_OWNER_EMAIL) return null
  if (role !== 'owner' && role !== 'support') return null
'@ @'
  if (role === 'owner' && email !== OFFICIAL_PLATFORM_OWNER_EMAIL) return null
  if (role !== 'owner' && role !== 'support' && role !== 'prospector') return null
'@ "Whitelist PlatformAdmin"

    WriteNormalized $platformPath $platform
    MarkChanged $platformPath
    Ok "Prospector mesclado preservando Owner/Support."

    Step "Separando portal.access de dashboard.view"

    $session = ReplaceOnce $session @'
    'dashboard.view',
'@ @'
    'portal.access',
'@ "Sessao portal.access"

    WriteNormalized $sessionPath $session
    MarkChanged $sessionPath
    Ok "Sessao administrativa agora usa portal.access."

    Step "Migrando company-access para platform_admins"

    $company = ReplaceOnce $company @'
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('role,ativo')
    .eq('ativo', true)
    .ilike('email', normalized)
    .maybeSingle()

  if (error) throw error
  return data?.role || null
'@ @'
  const { data, error } = await supabaseAdmin
    .from('platform_admins')
    .select('role,is_active')
    .eq('is_active', true)
    .ilike('email', normalized)
    .maybeSingle()

  if (error) throw error

  return data?.role
    ? String(data.role).trim().toLowerCase()
    : null
'@ "company-access platform_admins"

    $company = ReplaceOnce $company @'
  const adminRole = await getAdminRole(supabaseAdmin, email)
  const isAdminMaster = adminRole === 'super_admin'
'@ @'
  const adminRole = await getAdminRole(supabaseAdmin, email)
  const isAdminMaster =
    adminRole === 'owner' ||
    adminRole === 'super_admin'
'@ "Owner admin master"

    WriteNormalized $companyPath $company
    MarkChanged $companyPath
    Ok "company-access nao depende mais de admin_users para autoridade."

    Step "Mesclando o Prospector no proxy atual"

    $proxy = ReplaceOnce $proxy @'
      const officialOwner = active && role === 'owner' && String(user.email || '').toLowerCase() === OFFICIAL_OWNER_EMAIL
      const activeSupport = active && role === 'support'

      if (adminPage && !officialOwner) {
        const destination = request.nextUrl.clone()
        destination.pathname = activeSupport ? '/suporte' : '/parceiros/login'
        destination.search = ''
        return secureResponse(NextResponse.redirect(destination), request, cookiesToSet)
      }
'@ @'
      const officialOwner = active && role === 'owner' && String(user.email || '').toLowerCase() === OFFICIAL_OWNER_EMAIL
      const activeSupport = active && role === 'support'
      const activeProspector = active && role === 'prospector'
      const prospectorAllowedPage =
        pathname === '/admin/prospeccao' ||
        pathname.startsWith('/admin/prospeccao/') ||
        pathname === '/admin/fundadores' ||
        pathname.startsWith('/admin/fundadores/')

      if (adminPage && activeProspector && !prospectorAllowedPage) {
        const commercial = request.nextUrl.clone()
        commercial.pathname = '/admin/prospeccao'
        commercial.search = ''
        return secureResponse(NextResponse.redirect(commercial), request, cookiesToSet)
      }

      if (adminPage && !officialOwner && !activeProspector) {
        const destination = request.nextUrl.clone()
        destination.pathname = activeSupport ? '/suporte' : '/parceiros/login'
        destination.search = ''
        return secureResponse(NextResponse.redirect(destination), request, cookiesToSet)
      }
'@ "Proxy Prospector"

    $proxy = ReplaceOnce $proxy @'
      if (passwordPage && !officialOwner && !activeSupport) {
'@ @'
      if (passwordPage && !officialOwner && !activeSupport && !activeProspector) {
'@ "Senha Prospector"

    $proxy = ReplaceOnce $proxy @'
      if ((officialOwner || activeSupport) && access?.must_change_password === true && !passwordPage) {
'@ @'
      if ((officialOwner || activeSupport || activeProspector) && access?.must_change_password === true && !passwordPage) {
'@ "Must change Prospector"

    $proxy = ReplaceOnce $proxy @'
      if (affiliatePage && activeSupport) {
        const support = request.nextUrl.clone(); support.pathname = '/suporte'; support.search = ''
        return secureResponse(NextResponse.redirect(support), request, cookiesToSet)
      }
'@ @'
      if (affiliatePage && activeSupport) {
        const support = request.nextUrl.clone(); support.pathname = '/suporte'; support.search = ''
        return secureResponse(NextResponse.redirect(support), request, cookiesToSet)
      }
      if (affiliatePage && activeProspector) {
        const commercial = request.nextUrl.clone(); commercial.pathname = '/admin/prospeccao'; commercial.search = ''
        return secureResponse(NextResponse.redirect(commercial), request, cookiesToSet)
      }
'@ "Affiliate redirect Prospector"

    WriteNormalized $proxyPath $proxy
    MarkChanged $proxyPath
    Ok "Proxy preservou Owner/Support e adicionou Prospector."

    Step "Criando /admin/prospeccao"

    $prospectingPage = @'
export default function ProspeccaoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">
          Orçaly Comercial
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
          Prospecção
        </h1>

        <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600">
          Esta área já está isolada do backoffice financeiro e administrativo.
          O pipeline comercial será conectado aqui na FASE 4.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Prospecção', 'Prospects atribuídos ao usuário comercial.'],
            ['Clientes Fundadores', 'Convites Founder com autorização própria.'],
            ['Minha performance', 'Indicadores individuais preparados para a equipe comercial.'],
          ].map(([title, description]) => (
            <section
              key={title}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-black">{title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {description}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
'@

    WriteNormalized $prospectingPath $prospectingPage
    MarkChanged $prospectingPath
    Ok "/admin/prospeccao criada."

    Step "Validando isolamento"

    $platformAfter = ReadNormalized $platformPath
    $proxyAfter = ReadNormalized $proxyPath
    $sessionAfter = ReadNormalized $sessionPath
    $companyAfter = ReadNormalized $companyPath

    $checks = @(
        @($platformAfter.Contains("| 'prospector'"), "role prospector"),
        @($platformAfter.Contains("| 'portal.access'"), "portal.access"),
        @($platformAfter.Contains("const PROSPECTOR_ALLOWED"), "allowlist Prospector"),
        @($platformAfter.Contains("sanitizeProspectorPermissions"), "sanitizacao Prospector"),
        @($platformAfter.Contains("OFFICIAL_PLATFORM_OWNER_EMAIL"), "Owner oficial preservado"),
        @($sessionAfter.Contains("'portal.access'"), "sessao sem dashboard global"),
        @($proxyAfter.Contains("activeProspector"), "proxy reconhece Prospector"),
        @($proxyAfter.Contains("prospectorAllowedPage"), "proxy limita paginas comerciais"),
        @($proxyAfter.Contains("activeSupport"), "Support preservado"),
        @($proxyAfter.Contains("OFFICIAL_OWNER_EMAIL"), "Owner no proxy preservado"),
        @(-not $companyAfter.Contains(".from('admin_users')"), "company-access sem autoridade legada"),
        @($companyAfter.Contains(".from('platform_admins')"), "company-access usa platform_admins")
    )

    foreach ($check in $checks) {
        if (-not [bool]$check[0]) {
            throw ("Validacao falhou: " + [string]$check[1])
        }

        Ok ([string]$check[1])
    }

    Step "git diff --check"

    $phase2Files = @(
        $MigrationRelative,
        $platformPath,
        $proxyPath,
        $sessionPath,
        $companyPath,
        $prospectingPath
    )

    & git --no-pager diff --check -- $phase2Files

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check falhou."
    }

    Ok "Whitespace validado."

    Step "ESLint direcionado sem o baseline legado do proxy"

    & npx.cmd eslint `
        $platformPath `
        $sessionPath `
        $companyPath `
        $prospectingPath

    if ($LASTEXITCODE -ne 0) {
        throw "ESLint direcionado falhou."
    }

    Ok "ESLint direcionado passou."

    Step "Build de producao"

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build final falhou."
    }

    Ok "Build final passou."

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " FASE 2 - MERGE V5 APLICADO E VALIDADO" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Preservado:"
    Write-Host " - Owner oficial"
    Write-Host " - Support /suporte"
    Write-Host " - hardening financeiro atual"
    Write-Host ""
    Write-Host "Adicionado:"
    Write-Host " - role Prospector"
    Write-Host " - portal.access"
    Write-Host " - permissoes Founder / Prospecção / Performance"
    Write-Host " - /admin/prospeccao"
    Write-Host " - isolamento de rotas do Prospector"
    Write-Host " - company-access baseado em platform_admins"
    Write-Host ""
    Write-Host "IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "O commit NAO foi criado automaticamente porque platform-admin.ts e proxy.ts"
    Write-Host "ja continham hardening local nao commitado antes da FASE 2."
    Write-Host "Isso evita misturar commits sem revisar o conjunto existente."
    Write-Host ""
    Write-Host "Nenhum push e nenhum deploy foram executados." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host ("[ERRO] " + $_.Exception.Message) -ForegroundColor Red

    if ($Changed.Count -gt 0) {
        Warn "Executando rollback para o estado exato anterior."
        Rollback
    }

    Write-Host ("Backup: " + $BackupRoot) -ForegroundColor Yellow
    exit 1
}
