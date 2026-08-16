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
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\fase2-permissoes-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

$ExpectedBlobs = @{
    "lib/platform-admin.ts" = "483cbc0e89ce1685f9cf206bdfdbf2d51236ff76"
    "proxy.ts" = "af9061a8fc772815f2e8385a873531de3912f4b7"
    "app/api/admin/session/route.ts" = "4f1b863d06ad56d4b4c602946a0b73d17c04688b"
    "lib/company-access.ts" = "1bb1c3af2c5dfd33b9ea8e0caf0807c8487468c9"
}

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

function ReadText([string]$Relative) {
    return [IO.File]::ReadAllText((FullPath $Relative))
}

function WriteText([string]$Relative, [string]$Text) {
    $path = FullPath $Relative
    [IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
    [IO.File]::WriteAllText($path, $Text, $Utf8NoBom)
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

function ReplaceOnce(
    [string]$Text,
    [string]$Needle,
    [string]$Replacement,
    [string]$Label
) {
    $count = CountExact $Text $Needle

    if ($count -ne 1) {
        throw ($Label + ": ancora encontrada " + $count + " vez(es), esperado 1.")
    }

    $index = $Text.IndexOf($Needle, [StringComparison]::Ordinal)

    return (
        $Text.Substring(0, $index) +
        $Replacement +
        $Text.Substring($index + $Needle.Length)
    )
}

function AssertWorkingBlob([string]$Relative, [string]$Expected) {
    $path = FullPath $Relative

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw ("Arquivo nao encontrado: " + $Relative)
    }

    $actual = (& git hash-object --path=$Relative -- $Relative 2>$null | Select-Object -First 1)

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$actual)) {
        throw ("Nao foi possivel calcular o blob local de " + $Relative)
    }

    $actual = ([string]$actual).Trim().ToLowerInvariant()

    if ($actual -ne $Expected.ToLowerInvariant()) {
        $status = [string]((& git status --short -- $Relative) | Select-Object -First 1)

        throw (
            $Relative +
            " nao corresponde ao codigo auditado. Esperado " +
            $Expected +
            "; blob local " +
            $actual +
            $(if ($status) { "; git status: " + $status } else { "" }) +
            ". Nao vou sobrescrever codigo diferente."
        )
    }

    $tracked = (& git ls-files --error-unmatch -- $Relative 2>$null)
    if ($LASTEXITCODE -eq 0) {
        Ok ($Relative + " corresponde ao codigo auditado e esta rastreado pelo Git.")
    }
    else {
        Warn ($Relative + " corresponde ao codigo auditado, mas nao esta no HEAD/indice atual. Ele sera incluido no commit da FASE 2.")
    }
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
    Write-Host "ORCALY - FASE 2 - PERMISSOES GRANULARES V2" -ForegroundColor Cyan
    Write-Host "Role Prospector + isolamento server-side do backoffice." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (FullPath "package.json") -PathType Leaf)) {
        throw "Repositorio Orcaly nao encontrado."
    }

    Set-Location $ProjectRoot

    $branch = ([string]((& git branch --show-current) | Select-Object -First 1)).Trim()

    if ($branch -ne $ExpectedBranch) {
        throw ("Branch atual: " + $branch + ". Esperada: " + $ExpectedBranch)
    }

    Step "Validando arquivos auditados"

    foreach ($entry in $ExpectedBlobs.GetEnumerator()) {
        AssertWorkingBlob $entry.Key $entry.Value
    }

    $proxyTracked = (& git ls-files --error-unmatch -- "proxy.ts" 2>$null)
    if ($LASTEXITCODE -eq 0) {
        Ok "proxy.ts esta rastreado pelo Git."
    }
    else {
        Warn "proxy.ts nao esta rastreado no HEAD/indice local, mas o conteudo foi validado pelo blob auditado."
    }

    $newPage = "app/admin/prospeccao/page.tsx"

    if (Test-Path -LiteralPath (FullPath $newPage)) {
        throw ($newPage + " ja existe. Nao vou sobrescrever.")
    }

    $migrationPath = FullPath $MigrationRelative

    if (Test-Path -LiteralPath $migrationPath) {
        $actualMigSha = (Get-FileHash $migrationPath -Algorithm SHA256).Hash.ToUpperInvariant()

        if ($actualMigSha -ne $MigrationSha) {
            throw "A migration da FASE 2 ja existe localmente com conteudo diferente."
        }

        Ok "Migration FASE 2 ja sincronizada."
    }

    Step "Criando backups"

    foreach ($relative in $ExpectedBlobs.Keys) {
        Backup $relative
    }

    Step "Sincronizando migration ja aplicada no Supabase"

    if (-not (Test-Path -LiteralPath $migrationPath)) {
        [IO.Directory]::CreateDirectory((Split-Path -Parent $migrationPath)) | Out-Null
        [IO.File]::WriteAllBytes(
            $migrationPath,
            [Convert]::FromBase64String($MigrationBase64)
        )
        $Changed.Add($MigrationRelative)
    }

    $actualMigSha = (Get-FileHash $migrationPath -Algorithm SHA256).Hash.ToUpperInvariant()

    if ($actualMigSha -ne $MigrationSha) {
        throw "SHA256 da migration local nao corresponde ao SQL aplicado."
    }

    Ok "Migration local corresponde ao SQL aplicado no banco."

    Step "Atualizando lib/platform-admin.ts"

    $platformText = ReadText "lib/platform-admin.ts"

    $platformText = ReplaceOnce $platformText @'
export type PlatformRole =
  | 'owner'
  | 'admin'
  | 'finance'
  | 'support'
'@ @'
export type PlatformRole =
  | 'owner'
  | 'admin'
  | 'finance'
  | 'support'
  | 'prospector'
'@ "PlatformRole"

    $platformText = ReplaceOnce $platformText @'
export type PlatformPermission =
  | 'dashboard.view'
'@ @'
export type PlatformPermission =
  | 'portal.access'
  | 'dashboard.view'
'@ "portal.access"

    $platformText = ReplaceOnce $platformText @'
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

    $platformText = ReplaceOnce $platformText @'
> = [
  {
    key: 'dashboard.view',
'@ @'
> = [
  {
    key: 'portal.access',
    label: 'Acessar portal interno',
    description: 'Entrar nas areas internas autorizadas da plataforma.',
    supportAssignable: true,
  },
  {
    key: 'dashboard.view',
'@ "Catalogo portal"

    $commercialCatalog = @'
  {
    key: 'founders.view_own',
    label: 'Ver próprios Fundadores',
    description: 'Consultar convites e clientes Fundadores criados pelo próprio usuário.',
    supportAssignable: false,
  },
  {
    key: 'founders.view_all',
    label: 'Ver todos os Fundadores',
    description: 'Consultar todos os convites e clientes Fundadores da plataforma.',
    supportAssignable: false,
  },
  {
    key: 'founders.create_invite',
    label: 'Criar convite Founder',
    description: 'Gerar convite seguro para Cliente Fundador.',
    supportAssignable: false,
  },
  {
    key: 'founders.resend_invite',
    label: 'Reenviar convite Founder',
    description: 'Rotacionar e reenviar convite pendente.',
    supportAssignable: false,
  },
  {
    key: 'founders.revoke_pending',
    label: 'Revogar convite Founder',
    description: 'Revogar convite Founder ainda pendente.',
    supportAssignable: false,
  },
  {
    key: 'prospecting.access',
    label: 'Acessar Prospecção',
    description: 'Acessar a área comercial de prospecção.',
    supportAssignable: false,
  },
  {
    key: 'prospecting.view_own',
    label: 'Ver próprios prospects',
    description: 'Consultar prospects atribuídos ao próprio usuário.',
    supportAssignable: false,
  },
  {
    key: 'prospecting.view_all',
    label: 'Ver todos os prospects',
    description: 'Consultar o pipeline comercial completo.',
    supportAssignable: false,
  },
  {
    key: 'prospecting.create',
    label: 'Criar prospects',
    description: 'Cadastrar novas oportunidades comerciais.',
    supportAssignable: false,
  },
  {
    key: 'prospecting.edit_own',
    label: 'Editar próprios prospects',
    description: 'Atualizar oportunidades atribuídas ao próprio usuário.',
    supportAssignable: false,
  },
  {
    key: 'performance.view_own',
    label: 'Ver própria performance',
    description: 'Consultar os próprios indicadores comerciais.',
    supportAssignable: false,
  },
  {
    key: 'performance.view_all',
    label: 'Ver performance da equipe',
    description: 'Consultar indicadores de toda a equipe comercial.',
    supportAssignable: false,
  },
'@

    $platformText = ReplaceOnce $platformText @'
  {
    key: 'team.manage',
'@ ($commercialCatalog + @'
  {
    key: 'team.manage',
'@) "Catalogo comercial"

    $platformText = ReplaceOnce $platformText @'
  'pix.reveal',
  'team.manage',
  'settings.manage',
'@ @'
  'pix.reveal',
  'team.manage',
  'settings.manage',
  'founders.view_all',
  'prospecting.view_all',
  'performance.view_all',
'@ "Owner only comercial"

    $platformText = ReplaceOnce $platformText @'
  owner: {
    'dashboard.view': true,
  },
'@ @'
  owner: {
    'portal.access': true,
    'dashboard.view': true,
  },
'@ "Owner portal"

    $platformText = ReplaceOnce $platformText @'
  admin: {
    'dashboard.view': true,
'@ @'
  admin: {
    'portal.access': true,
    'dashboard.view': true,
'@ "Admin portal"

    $platformText = ReplaceOnce $platformText @'
  finance: {
    'dashboard.view': true,
'@ @'
  finance: {
    'portal.access': true,
    'dashboard.view': true,
'@ "Finance portal"

    $platformText = ReplaceOnce $platformText @'
  support: {
    'dashboard.view': true,
'@ @'
  support: {
    'portal.access': true,
    'dashboard.view': true,
'@ "Support portal"

    $platformText = ReplaceOnce $platformText @'
  support: {
    'portal.access': true,
    'dashboard.view': true,
    'companies.view': true,
    'affiliates.view': true,
    'referrals.view': true,
    'contact.view': true,
  },
}
'@ @'
  support: {
    'portal.access': true,
    'dashboard.view': true,
    'companies.view': true,
    'affiliates.view': true,
    'referrals.view': true,
    'contact.view': true,
  },
  prospector: {
    'portal.access': true,
    'founders.view_own': true,
    'founders.create_invite': true,
    'founders.resend_invite': true,
    'founders.revoke_pending': true,
    'prospecting.access': true,
    'prospecting.view_own': true,
    'prospecting.create': true,
    'prospecting.edit_own': true,
    'performance.view_own': true,
  },
}
'@ "Defaults prospector"

    $platformText = ReplaceOnce $platformText @'
    role === 'finance' ||
    role === 'support'
'@ @'
    role === 'finance' ||
    role === 'support' ||
    role === 'prospector'
'@ "Normalize prospector"

    $prospectorSanitizer = @'

export function sanitizeProspectorPermissions(
  value: unknown,
) {
  const input = normalizePermissions(value)
  const allowed = new Set<PlatformPermission>([
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
  const result: Record<string, boolean> = {}

  for (const key of allowed) {
    result[key] = input[key] !== false
  }

  result['portal.access'] = true
  result['founders.view_own'] = true
  result['prospecting.access'] = true
  result['prospecting.view_own'] = true
  result['performance.view_own'] = true

  return result
}

'@

    $platformText = ReplaceOnce $platformText @'
export async function getCurrentPlatformAdminFromRequest(
'@ ($prospectorSanitizer + @'
export async function getCurrentPlatformAdminFromRequest(
'@) "Sanitizer prospector"

    $platformText = ReplaceOnce $platformText @'
  const { data: admin, error } = await supabaseAdmin
    .from('platform_admins')
    .select(
      'id,user_id,email,role,is_active,nome,permissions,area,observacoes,last_login_at,must_change_password',
    )
    .or(
      `user_id.eq.${requester.id},email.ilike.${email}`,
    )
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !admin) return null
'@ @'
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
'@ "Lookup seguro do admin"

    WriteText "lib/platform-admin.ts" $platformText
    $Changed.Add("lib/platform-admin.ts")
    Ok "platform-admin.ts atualizado."

    Step "Atualizando sessao administrativa"

    $sessionText = ReadText "app/api/admin/session/route.ts"

    $sessionText = ReplaceOnce $sessionText @'
    'dashboard.view',
'@ @'
    'portal.access',
'@ "Sessao usa portal.access"

    WriteText "app/api/admin/session/route.ts" $sessionText
    $Changed.Add("app/api/admin/session/route.ts")
    Ok "Sessao administrativa atualizada."

    Step "Isolando Prospector no proxy"

    $proxyText = ReadText "proxy.ts"

    $proxyText = ReplaceOnce $proxyText @'
        'finance',
        'support',
      ])
'@ @'
        'finance',
        'support',
        'prospector',
      ])
'@ "Whitelist do proxy"

    $prospectorBlock = @'

      if (databaseRole === 'prospector') {
        const allowedProspectorPage =
          pathname === '/admin/prospeccao' ||
          pathname.startsWith('/admin/prospeccao/') ||
          pathname === '/admin/fundadores' ||
          pathname.startsWith('/admin/fundadores/') ||
          pathname === '/admin/alterar-senha'

        if (!allowedProspectorPage) {
          const commercial = request.nextUrl.clone()
          commercial.pathname = '/admin/prospeccao'
          commercial.search = ''

          return secureResponse(
            NextResponse.redirect(commercial),
            request,
            cookiesToSet,
          )
        }
      }
'@

    $proxyText = ReplaceOnce $proxyText @'
      if (
        adminAccess?.must_change_password === true &&
        pathname !== '/admin/alterar-senha'
      ) {
        const passwordPage =
          request.nextUrl.clone()
        passwordPage.pathname =
          '/admin/alterar-senha'
        passwordPage.search = ''

        return secureResponse(
          NextResponse.redirect(passwordPage),
          request,
          cookiesToSet,
        )
      }
'@ (@'
      if (
        adminAccess?.must_change_password === true &&
        pathname !== '/admin/alterar-senha'
      ) {
        const passwordPage =
          request.nextUrl.clone()
        passwordPage.pathname =
          '/admin/alterar-senha'
        passwordPage.search = ''

        return secureResponse(
          NextResponse.redirect(passwordPage),
          request,
          cookiesToSet,
        )
      }
'@ + $prospectorBlock) "Redirect Prospector"

    WriteText "proxy.ts" $proxyText
    $Changed.Add("proxy.ts")
    Ok "Proxy isolou o Prospector das paginas Owner."

    Step "Removendo admin_users da autoridade de company-access"

    $companyText = ReadText "lib/company-access.ts"

    $companyText = ReplaceOnce $companyText @'
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
'@ "company-access usa platform_admins"

    $companyText = ReplaceOnce $companyText @'
  const adminRole = await getAdminRole(supabaseAdmin, email)
  const isAdminMaster = adminRole === 'super_admin'
'@ @'
  const adminRole = await getAdminRole(supabaseAdmin, email)
  const isAdminMaster =
    adminRole === 'owner' ||
    adminRole === 'super_admin'
'@ "Owner master"

    WriteText "lib/company-access.ts" $companyText
    $Changed.Add("lib/company-access.ts")
    Ok "company-access.ts usa a autoridade atual."

    Step "Criando pagina comercial restrita"

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
          A área comercial está protegida e preparada para o papel Prospector.
          O pipeline de leads será conectado aqui na FASE 4.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Prospecção', 'Acesso comercial isolado do backoffice financeiro.'],
            ['Fundadores', 'Permissões próprias para convites Founder.'],
            ['Performance', 'Indicadores pessoais preparados para as próximas fases.'],
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

    WriteText $newPage $prospectingPage
    $Changed.Add($newPage)
    Ok "Pagina /admin/prospeccao criada."

    Step "Validacoes de seguranca do patch"

    $platformAfter = ReadText "lib/platform-admin.ts"
    $proxyAfter = ReadText "proxy.ts"
    $sessionAfter = ReadText "app/api/admin/session/route.ts"
    $companyAfter = ReadText "lib/company-access.ts"

    $checks = @(
        @($platformAfter.Contains("| 'prospector'"), "role prospector"),
        @($platformAfter.Contains("| 'portal.access'"), "portal.access"),
        @($platformAfter.Contains("'founders.create_invite': true"), "permissao de convite Founder"),
        @($platformAfter.Contains("'prospecting.view_own': true"), "prospeccao propria"),
        @($platformAfter.Contains("'performance.view_own': true"), "performance propria"),
        @($platformAfter.Contains("sanitizeProspectorPermissions"), "sanitizacao Prospector"),
        @($sessionAfter.Contains("'portal.access'"), "sessao sem dashboard global"),
        @($proxyAfter.Contains("'prospector'"), "proxy reconhece Prospector"),
        @($proxyAfter.Contains("allowedProspectorPage"), "proxy restringe paginas"),
        @(-not $companyAfter.Contains(".from('admin_users')"), "company-access sem admin_users"),
        @($companyAfter.Contains(".from('platform_admins')"), "company-access usa platform_admins"),
        @((Test-Path -LiteralPath (FullPath $newPage)), "pagina comercial")
    )

    foreach ($check in $checks) {
        if (-not [bool]$check[0]) {
            throw ("Validacao falhou: " + [string]$check[1])
        }

        Ok ([string]$check[1])
    }

    Step "Conferindo escopo do diff"

    $allowedFiles = @(
        $MigrationRelative,
        "lib/platform-admin.ts",
        "proxy.ts",
        "app/api/admin/session/route.ts",
        "lib/company-access.ts",
        $newPage
    )

    & git --no-pager diff --check -- $allowedFiles

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check falhou."
    }

    Ok "Escopo e whitespace validados."

    Step "ESLint direcionado"

    & npx.cmd eslint `
        "lib/platform-admin.ts" `
        "app/api/admin/session/route.ts" `
        "lib/company-access.ts" `
        "app/admin/prospeccao/page.tsx"

    if ($LASTEXITCODE -ne 0) {
        throw "ESLint direcionado falhou."
    }

    Ok "ESLint direcionado passou."

    Step "Build final"

    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build final falhou."
    }

    Ok "Build final passou."

    Step "Criando commit da FASE 2"

    & git add -- `
        $MigrationRelative `
        "lib/platform-admin.ts" `
        "proxy.ts" `
        "app/api/admin/session/route.ts" `
        "lib/company-access.ts" `
        $newPage

    if ($LASTEXITCODE -ne 0) {
        throw "git add falhou."
    }

    $staged = @(& git diff --cached --name-only)

    foreach ($file in $staged) {
        if ($allowedFiles -notcontains $file) {
            throw ("Arquivo staged fora da FASE 2: " + $file)
        }
    }

    & git commit -m "feat(admin): add granular platform permissions"

    if ($LASTEXITCODE -ne 0) {
        throw "git commit falhou."
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " FASE 2 CONCLUIDA LOCALMENTE" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Implementado:"
    Write-Host " - role prospector"
    Write-Host " - portal.access separado de dashboard.view"
    Write-Host " - permissoes Founder / Prospeccao / Performance"
    Write-Host " - isolamento de paginas Owner no proxy"
    Write-Host " - /admin/prospeccao"
    Write-Host " - company-access usando platform_admins"
    Write-Host " - migration sincronizada"
    Write-Host " - ESLint direcionado"
    Write-Host " - build final"
    Write-Host " - commit da FASE 2"
    Write-Host ""
    Write-Host "Nenhum push e nenhum deploy foram executados." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host ("[ERRO] " + $_.Exception.Message) -ForegroundColor Red

    if ($Changed.Count -gt 0) {
        Warn "Executando rollback dos arquivos alterados."
        Rollback
    }

    Write-Host ("Backup: " + $BackupRoot) -ForegroundColor Yellow
    exit 1
}
