param(
    [string]$ProjectRoot = "",
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Marker = "ORCALY_SELF_PASSWORD_SETTINGS_V1"
$ExpectedBranch = "fix/unify-payment-flows-phase-1"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\self-password-settings-" + $Timestamp)
$AuditReport = Join-Path $BackupRoot "AUDITORIA-SENHA-CONFIGURACOES.md"
$ChangedFiles = New-Object System.Collections.Generic.List[string]
$BackupMap = @{}

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

function ReadUtf8([string]$Path) {
    return [IO.File]::ReadAllText($Path)
}

function WriteUtf8([string]$Path, [string]$Text) {
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
    [IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function NewlineFor([string]$Text) {
    if ($Text.Contains("`r`n")) { return "`r`n" }
    return "`n"
}

function CountExact([string]$Text, [string]$Needle) {
    if ([string]::IsNullOrEmpty($Needle)) { return 0 }

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

function ReplaceExactOnce(
    [string]$Text,
    [string]$Needle,
    [string]$Replacement,
    [string]$Label
) {
    $count = CountExact $Text $Needle

    if ($count -ne 1) {
        throw ($Label + ": âncora esperada 1 vez, encontrada " + $count + " vez(es).")
    }

    $index = $Text.IndexOf($Needle, [StringComparison]::Ordinal)

    return (
        $Text.Substring(0, $index) +
        $Replacement +
        $Text.Substring($index + $Needle.Length)
    )
}

function Backup([string]$Relative) {
    $source = FullPath $Relative

    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        return
    }

    if ($BackupMap.ContainsKey($Relative)) {
        return
    }

    $dest = Join-Path $BackupRoot ($Relative -replace "/", "\")
    [IO.Directory]::CreateDirectory((Split-Path -Parent $dest)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $dest -Force
    $BackupMap[$Relative] = $dest
}

function Restore-Patch {
    [array]$items = @($ChangedFiles)

    [Array]::Reverse($items)

    foreach ($relative in $items) {
        $target = FullPath $relative

        if ($BackupMap.ContainsKey($relative)) {
            Copy-Item -LiteralPath $BackupMap[$relative] -Destination $target -Force
            Warn ("Restaurado: " + $relative)
        } elseif (Test-Path -LiteralPath $target -PathType Leaf) {
            Remove-Item -LiteralPath $target -Force
            Warn ("Removido arquivo criado: " + $relative)
        }
    }
}

function GitHeadBlob([string]$Relative) {
    $result = & git rev-parse ("HEAD:" + $Relative) 2>$null

    if ($LASTEXITCODE -ne 0) {
        return ""
    }

    return ([string]($result | Select-Object -First 1)).Trim().ToLowerInvariant()
}

function Assert-HeadBlob(
    [string]$Relative,
    [string]$Expected
) {
    $actual = GitHeadBlob $Relative

    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw (
            $Relative +
            " não corresponde à versão auditada no HEAD. Esperado " +
            $Expected +
            "; atual " +
            $actual +
            "."
        )
    }

    Ok ($Relative + " corresponde ao HEAD auditado.")
}

function Assert-TargetClean([string]$Relative) {
    & git diff --quiet -- $Relative

    if ($LASTEXITCODE -ne 0) {
        throw (
            $Relative +
            " possui alteração local não auditada. O script recusou sobrescrever."
        )
    }

    & git diff --cached --quiet -- $Relative

    if ($LASTEXITCODE -ne 0) {
        throw (
            $Relative +
            " possui alteração staged não auditada. O script recusou sobrescrever."
        )
    }

    Ok ($Relative + " está limpo para patch.")
}

function Audit-AllSourceLines {
    $extensions = @(
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".css", ".scss", ".json", ".sql", ".ps1"
    )

    $skipTokens = @(
        "\node_modules\",
        "\.next\",
        "\.git\",
        "\.orcaly-backups\",
        "\coverage\",
        "\dist\",
        "\build\"
    )

    $patterns = @(
        "updateUser(",
        "updateUserById",
        "current_password",
        "change-password",
        "alterar-senha",
        "resetPasswordForEmail",
        "signInWithPassword",
        "SUPABASE_SERVICE_ROLE_KEY",
        "password",
        "senha"
    )

    $files = @(
        Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File | Where-Object {
            $extensionAllowed = $extensions -contains $_.Extension.ToLowerInvariant()

            if (-not $extensionAllowed) {
                return $false
            }

            $full = $_.FullName

            foreach ($token in $skipTokens) {
                if (
                    $full.IndexOf(
                        $token,
                        [StringComparison]::OrdinalIgnoreCase
                    ) -ge 0
                ) {
                    return $false
                }
            }

            return $true
        }
    )

    $totalLines = 0
    $findings = New-Object System.Collections.Generic.List[string]

    foreach ($file in $files) {
        $relative = $file.FullName.Substring($ProjectRoot.Length).TrimStart("\")
        $lines = [IO.File]::ReadAllLines($file.FullName)
        $totalLines += $lines.Length

        for ($i = 0; $i -lt $lines.Length; $i++) {
            $line = $lines[$i]

            foreach ($pattern in $patterns) {
                if (
                    $line.IndexOf(
                        $pattern,
                        [StringComparison]::OrdinalIgnoreCase
                    ) -ge 0
                ) {
                    $findings.Add(
                        (
                            "- `" +
                            $relative.Replace("\", "/") +
                            ":" +
                            ($i + 1) +
                            "` — ocorrência `" +
                            $pattern +
                            "`"
                        )
                    )
                }
            }
        }
    }

    $status = (& git status --short | Out-String).TrimEnd()

    $report = New-Object System.Collections.Generic.List[string]
    $report.Add("# Auditoria local - alteração de senha")
    $report.Add("")
    $report.Add("- Data: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $report.Add("- Branch: " + ((& git branch --show-current) | Select-Object -First 1))
    $report.Add("- Arquivos-fonte lidos: " + $files.Count)
    $report.Add("- Linhas lidas: " + $totalLines)
    $report.Add("")
    $report.Add("## Git status antes do patch")
    $report.Add("")
    $report.Add('```text')

    if ([string]::IsNullOrWhiteSpace($status)) {
        $report.Add("(sem alterações)")
    } else {
        $report.Add($status)
    }

    $report.Add('```')
    $report.Add("")
    $report.Add("## Ocorrências relacionadas a Auth/senha")
    $report.Add("")

    if ($findings.Count -eq 0) {
        $report.Add("- Nenhuma ocorrência encontrada.")
    } else {
        foreach ($finding in $findings) {
            $report.Add($finding)
        }
    }

    WriteUtf8 $AuditReport ($report -join "`r`n")

    Ok (
        "Auditoria linha a linha: " +
        $files.Count +
        " arquivos, " +
        $totalLines +
        " linhas."
    )
    Ok ("Relatório: " + $AuditReport)
}

try {
    Write-Host ""
    Write-Host "ORÇALY - SENHA NAS CONFIGURAÇÕES V1" -ForegroundColor Cyan
    Write-Host "Conta principal + Portal de Parceiros." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (FullPath "package.json") -PathType Leaf)) {
        throw "Execute este script na raiz do projeto Orçaly."
    }

    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        throw "Git não foi encontrado no PATH."
    }

    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm.cmd não foi encontrado no PATH."
    }

    Set-Location $ProjectRoot
    [IO.Directory]::CreateDirectory($BackupRoot) | Out-Null

    Step "Validando branch e arquitetura auditada"

    $branch = ([string]((& git branch --show-current) | Select-Object -First 1)).Trim()

    if ($branch -ne $ExpectedBranch) {
        throw (
            "Branch inesperada: " +
            $branch +
            ". Esperada: " +
            $ExpectedBranch +
            "."
        )
    }

    Assert-HeadBlob "app/painel/configuracoes/page.tsx" "55c53fe69102ce7297d1bb76d92c6b7fe29ed118"
    Assert-HeadBlob "app/painel/configuracoes/ConfiguracoesLegacy.tsx" "0096ea85daf11ad51f36ba416bfa6bde998425fd"
    Assert-HeadBlob "components/settings/SettingsPremiumShell.tsx" "468e1fc46a7a440c3458e40a87c0a5838af7bed0"
    Assert-HeadBlob "app/parceiros/painel/page.tsx" "25bfabb208a4b6e65131dece7ae5a9796ce4ec17"
    Assert-HeadBlob "app/login/page.tsx" "6872974531a3abc97b4a138ffbb896446d29b01a"
    Assert-HeadBlob "app/parceiros/login/page.tsx" "9f13dbd5e7db2d7a0f6862b8aec42d3fef86b40c"
    Assert-HeadBlob "lib/supabase.ts" "94a4e8e4611a49b03f90dbb48bab8a396254ff7b"
    Assert-HeadBlob "app/admin/alterar-senha/page.tsx" "17112dd203ebdcbc7953bc141f3d5ba8483e42cd"
    Assert-HeadBlob "app/api/admin/change-password/route.ts" "98da4a24a44b21fe3b00a6e437eb0da19c36506e"
    Assert-HeadBlob "app/api/company/team/route.ts" "21e05cb3fde7564093159d0a8b7e27ef616d59ca"
    Assert-HeadBlob "package.json" "a3700d6948f5899418ebd20014dad0f5243b5f2f"

    $proxy = ReadUtf8 (FullPath "proxy.ts")

    if (-not $proxy.Contains("ORCALY_OWNER_BACKOFFICE_V2")) {
        throw "O proxy local não contém o hardening/backoffice V2 já aprovado."
    }

    $partnerApi = ReadUtf8 (FullPath "app/api/parceiros/route.ts")

    if (-not $partnerApi.Contains("ORCALY_OWNER_BACKOFFICE_V2")) {
        throw "A API local de parceiros não contém a integração owner/suporte V2."
    }

    Ok "Backoffice owner/suporte preservado."

    Assert-TargetClean "app/painel/configuracoes/ConfiguracoesLegacy.tsx"
    Assert-TargetClean "app/parceiros/painel/page.tsx"

    $newComponentPath = FullPath "components/auth/ChangePasswordCard.tsx"

    if (Test-Path -LiteralPath $newComponentPath -PathType Leaf) {
        throw (
            "components/auth/ChangePasswordCard.tsx já existe. " +
            "O script recusou sobrescrever para preservar código local."
        )
    }

    Step "Lendo todas as linhas-fonte locais antes de alterar"
    Audit-AllSourceLines

    if (-not $SkipInitialBuild) {
        Step "Build inicial"
        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "O projeto já falha no build antes desta alteração. Nada foi modificado."
        }

        Ok "Build inicial passou."
    }

    Step "Criando backup dos arquivos existentes que serão alterados"
    Backup "app/painel/configuracoes/ConfiguracoesLegacy.tsx"
    Backup "app/parceiros/painel/page.tsx"

    Step "Criando componente reutilizável de troca de senha"

    $componentBytes = [Convert]::FromBase64String("InVzZSBjbGllbnQiOwoKLy8gT1JDQUxZX1NFTEZfUEFTU1dPUkRfU0VUVElOR1NfVjEKaW1wb3J0IHsgRm9ybUV2ZW50LCB1c2VTdGF0ZSB9IGZyb20gInJlYWN0IjsKaW1wb3J0IHsgc3VwYWJhc2UgfSBmcm9tICJAL2xpYi9zdXBhYmFzZSI7Cgp0eXBlIENoYW5nZVBhc3N3b3JkQ2FyZFByb3BzID0gewogIHRpdGxlPzogc3RyaW5nOwogIGRlc2NyaXB0aW9uPzogc3RyaW5nOwogIGNvbXBhY3Q/OiBib29sZWFuOwp9OwoKZnVuY3Rpb24gZnJpZW5kbHlQYXNzd29yZEVycm9yKG1lc3NhZ2U6IHN0cmluZykgewogIGNvbnN0IG5vcm1hbGl6ZWQgPSBtZXNzYWdlLnRvTG93ZXJDYXNlKCk7CgogIGlmICgKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoImN1cnJlbnQgcGFzc3dvcmQiKSB8fAogICAgbm9ybWFsaXplZC5pbmNsdWRlcygiaW52YWxpZCBsb2dpbiBjcmVkZW50aWFscyIpIHx8CiAgICBub3JtYWxpemVkLmluY2x1ZGVzKCJpbnZhbGlkIHBhc3N3b3JkIikKICApIHsKICAgIHJldHVybiAiQSBzZW5oYSBhdHVhbCBlc3TDoSBpbmNvcnJldGEuIjsKICB9CgogIGlmICgKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoInNhbWUgcGFzc3dvcmQiKSB8fAogICAgbm9ybWFsaXplZC5pbmNsdWRlcygiZGlmZmVyZW50IGZyb20gdGhlIG9sZCBwYXNzd29yZCIpCiAgKSB7CiAgICByZXR1cm4gIkEgbm92YSBzZW5oYSBwcmVjaXNhIHNlciBkaWZlcmVudGUgZGEgc2VuaGEgYXR1YWwuIjsKICB9CgogIGlmICgKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoIndlYWsiKSB8fAogICAgbm9ybWFsaXplZC5pbmNsdWRlcygicGFzc3dvcmQgc2hvdWxkIikgfHwKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoInBhc3N3b3JkIG11c3QiKQogICkgewogICAgcmV0dXJuICJBIG5vdmEgc2VuaGEgbsOjbyBhdGVuZGUgYW9zIHJlcXVpc2l0b3MgZGUgc2VndXJhbsOnYS4iOwogIH0KCiAgaWYgKAogICAgbm9ybWFsaXplZC5pbmNsdWRlcygicmVhdXRoIikgfHwKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoIm5vbmNlIikKICApIHsKICAgIHJldHVybiAiUG9yIHNlZ3VyYW7Dp2EsIGVudHJlIG5vdmFtZW50ZSBuYSBjb250YSBhbnRlcyBkZSBhbHRlcmFyIGEgc2VuaGEuIjsKICB9CgogIGlmICgKICAgIG5vcm1hbGl6ZWQuaW5jbHVkZXMoInJhdGUgbGltaXQiKSB8fAogICAgbm9ybWFsaXplZC5pbmNsdWRlcygidG9vIG1hbnkiKQogICkgewogICAgcmV0dXJuICJNdWl0YXMgdGVudGF0aXZhcyBlbSBwb3VjbyB0ZW1wby4gQWd1YXJkZSB1bSBtb21lbnRvIGUgdGVudGUgbm92YW1lbnRlLiI7CiAgfQoKICByZXR1cm4gIk7Do28gZm9pIHBvc3PDrXZlbCBhbHRlcmFyIGEgc2VuaGEgYWdvcmEuIjsKfQoKZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQ2hhbmdlUGFzc3dvcmRDYXJkKHsKICB0aXRsZSA9ICJBbHRlcmFyIHNlbmhhIiwKICBkZXNjcmlwdGlvbiA9ICJDb25maXJtZSBzdWEgc2VuaGEgYXR1YWwgZSBlc2NvbGhhIHVtYSBub3ZhIHNlbmhhIHBhcmEgZXN0YSBjb250YS4iLAogIGNvbXBhY3QgPSBmYWxzZSwKfTogQ2hhbmdlUGFzc3dvcmRDYXJkUHJvcHMpIHsKICBjb25zdCBbY3VycmVudFBhc3N3b3JkLCBzZXRDdXJyZW50UGFzc3dvcmRdID0gdXNlU3RhdGUoIiIpOwogIGNvbnN0IFtuZXdQYXNzd29yZCwgc2V0TmV3UGFzc3dvcmRdID0gdXNlU3RhdGUoIiIpOwogIGNvbnN0IFtjb25maXJtUGFzc3dvcmQsIHNldENvbmZpcm1QYXNzd29yZF0gPSB1c2VTdGF0ZSgiIik7CiAgY29uc3QgW3Nob3dQYXNzd29yZHMsIHNldFNob3dQYXNzd29yZHNdID0gdXNlU3RhdGUoZmFsc2UpOwogIGNvbnN0IFtidXN5LCBzZXRCdXN5XSA9IHVzZVN0YXRlKGZhbHNlKTsKICBjb25zdCBbbWVzc2FnZSwgc2V0TWVzc2FnZV0gPSB1c2VTdGF0ZSgiIik7CiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSB1c2VTdGF0ZSgiIik7CgogIGFzeW5jIGZ1bmN0aW9uIHN1Ym1pdChldmVudDogRm9ybUV2ZW50PEhUTUxGb3JtRWxlbWVudD4pIHsKICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7CgogICAgaWYgKGJ1c3kpIHJldHVybjsKCiAgICBzZXRNZXNzYWdlKCIiKTsKICAgIHNldEVycm9yKCIiKTsKCiAgICBpZiAoIWN1cnJlbnRQYXNzd29yZCkgewogICAgICBzZXRFcnJvcigiSW5mb3JtZSBzdWEgc2VuaGEgYXR1YWwuIik7CiAgICAgIHJldHVybjsKICAgIH0KCiAgICBpZiAoCiAgICAgIG5ld1Bhc3N3b3JkLmxlbmd0aCA8IDEwIHx8CiAgICAgICEvW0EtWmEtel0vLnRlc3QobmV3UGFzc3dvcmQpIHx8CiAgICAgICEvXGQvLnRlc3QobmV3UGFzc3dvcmQpCiAgICApIHsKICAgICAgc2V0RXJyb3IoCiAgICAgICAgIkEgbm92YSBzZW5oYSBwcmVjaXNhIHRlciBwZWxvIG1lbm9zIDEwIGNhcmFjdGVyZXMsIGNvbSBsZXRyYSBlIG7Dum1lcm8uIiwKICAgICAgKTsKICAgICAgcmV0dXJuOwogICAgfQoKICAgIGlmIChuZXdQYXNzd29yZCA9PT0gY3VycmVudFBhc3N3b3JkKSB7CiAgICAgIHNldEVycm9yKCJBIG5vdmEgc2VuaGEgcHJlY2lzYSBzZXIgZGlmZXJlbnRlIGRhIHNlbmhhIGF0dWFsLiIpOwogICAgICByZXR1cm47CiAgICB9CgogICAgaWYgKG5ld1Bhc3N3b3JkICE9PSBjb25maXJtUGFzc3dvcmQpIHsKICAgICAgc2V0RXJyb3IoIkEgY29uZmlybWHDp8OjbyBkYSBub3ZhIHNlbmhhIG7Do28gY29uZmVyZS4iKTsKICAgICAgcmV0dXJuOwogICAgfQoKICAgIHNldEJ1c3kodHJ1ZSk7CgogICAgdHJ5IHsKICAgICAgY29uc3QgewogICAgICAgIGRhdGE6IHsgdXNlciB9LAogICAgICAgIGVycm9yOiB1c2VyRXJyb3IsCiAgICAgIH0gPSBhd2FpdCBzdXBhYmFzZS5hdXRoLmdldFVzZXIoKTsKCiAgICAgIGlmICh1c2VyRXJyb3IgfHwgIXVzZXI/LmlkKSB7CiAgICAgICAgc2V0RXJyb3IoCiAgICAgICAgICAiU3VhIHNlc3PDo28gbsOjbyBww7RkZSBzZXIgY29uZmlybWFkYS4gRW50cmUgbm92YW1lbnRlIG5hIGNvbnRhLiIsCiAgICAgICAgKTsKICAgICAgICByZXR1cm47CiAgICAgIH0KCiAgICAgIGNvbnN0IHsgZXJyb3I6IHVwZGF0ZUVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZS5hdXRoLnVwZGF0ZVVzZXIoewogICAgICAgIHBhc3N3b3JkOiBuZXdQYXNzd29yZCwKICAgICAgICBjdXJyZW50X3Bhc3N3b3JkOiBjdXJyZW50UGFzc3dvcmQsCiAgICAgIH0pOwoKICAgICAgaWYgKHVwZGF0ZUVycm9yKSB7CiAgICAgICAgc2V0RXJyb3IoZnJpZW5kbHlQYXNzd29yZEVycm9yKHVwZGF0ZUVycm9yLm1lc3NhZ2UpKTsKICAgICAgICByZXR1cm47CiAgICAgIH0KCiAgICAgIGF3YWl0IHN1cGFiYXNlLmF1dGgucmVmcmVzaFNlc3Npb24oKTsKCiAgICAgIHNldEN1cnJlbnRQYXNzd29yZCgiIik7CiAgICAgIHNldE5ld1Bhc3N3b3JkKCIiKTsKICAgICAgc2V0Q29uZmlybVBhc3N3b3JkKCIiKTsKICAgICAgc2V0TWVzc2FnZSgiU2VuaGEgYWx0ZXJhZGEgY29tIHN1Y2Vzc28uIik7CiAgICB9IGNhdGNoIHsKICAgICAgc2V0RXJyb3IoIk7Do28gZm9pIHBvc3PDrXZlbCBhbHRlcmFyIGEgc2VuaGEgYWdvcmEuIik7CiAgICB9IGZpbmFsbHkgewogICAgICBzZXRCdXN5KGZhbHNlKTsKICAgIH0KICB9CgogIHJldHVybiAoCiAgICA8c2VjdGlvbgogICAgICBkYXRhLWFjY291bnQtc2VjdXJpdHkKICAgICAgY2xhc3NOYW1lPXsKICAgICAgICBjb21wYWN0CiAgICAgICAgICA/ICJyb3VuZGVkLVsxLjdyZW1dIGJvcmRlciBib3JkZXItd2hpdGUgYmctd2hpdGUgcC01IHNoYWRvdy1zbSBzbTpwLTYiCiAgICAgICAgICA6ICJyb3VuZGVkLVsycmVtXSBib3JkZXIgYm9yZGVyLWJsdWUtMTAwIGJnLXdoaXRlIHAtNiBzaGFkb3cteGwgc2hhZG93LWJsdWUtOTUwLzUiCiAgICAgIH0KICAgID4KICAgICAgPGRpdiBjbGFzc05hbWU9ImZsZXggZmxleC1jb2wgZ2FwLTMgc206ZmxleC1yb3cgc206aXRlbXMtc3RhcnQgc206anVzdGlmeS1iZXR3ZWVuIj4KICAgICAgICA8ZGl2PgogICAgICAgICAgPHAgY2xhc3NOYW1lPSJ0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLVswLjE2ZW1dIHRleHQtWyMxMzU5YTVdIj4KICAgICAgICAgICAgU2VndXJhbsOnYSBkYSBjb250YQogICAgICAgICAgPC9wPgogICAgICAgICAgPGgyIGNsYXNzTmFtZT0ibXQtMiB0ZXh0LTJ4bCBmb250LWJsYWNrIHRleHQtWyMwNzFiM2FdIj4KICAgICAgICAgICAge3RpdGxlfQogICAgICAgICAgPC9oMj4KICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiBtYXgtdy0yeGwgdGV4dC1zbSBmb250LXNlbWlib2xkIGxlYWRpbmctNiB0ZXh0LXNsYXRlLTUwMCI+CiAgICAgICAgICAgIHtkZXNjcmlwdGlvbn0KICAgICAgICAgIDwvcD4KICAgICAgICA8L2Rpdj4KICAgICAgICA8c3BhbiBjbGFzc05hbWU9InctZml0IHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWVtZXJhbGQtMTAwIGJnLWVtZXJhbGQtNTAgcHgtMyBweS0yIHRleHQtWzEwcHhdIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLVswLjEyZW1dIHRleHQtZW1lcmFsZC03MDAiPgogICAgICAgICAgU3VwYWJhc2UgQXV0aAogICAgICAgIDwvc3Bhbj4KICAgICAgPC9kaXY+CgogICAgICB7bWVzc2FnZSA/ICgKICAgICAgICA8ZGl2CiAgICAgICAgICByb2xlPSJzdGF0dXMiCiAgICAgICAgICBhcmlhLWxpdmU9InBvbGl0ZSIKICAgICAgICAgIGNsYXNzTmFtZT0ibXQtNSByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLWVtZXJhbGQtMTAwIGJnLWVtZXJhbGQtNTAgcC00IHRleHQtc20gZm9udC1ibGFjayB0ZXh0LWVtZXJhbGQtNzAwIgogICAgICAgID4KICAgICAgICAgIHttZXNzYWdlfQogICAgICAgIDwvZGl2PgogICAgICApIDogbnVsbH0KCiAgICAgIHtlcnJvciA/ICgKICAgICAgICA8ZGl2CiAgICAgICAgICByb2xlPSJhbGVydCIKICAgICAgICAgIGNsYXNzTmFtZT0ibXQtNSByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLXJlZC0xMDAgYmctcmVkLTUwIHAtNCB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1yZWQtNzAwIgogICAgICAgID4KICAgICAgICAgIHtlcnJvcn0KICAgICAgICA8L2Rpdj4KICAgICAgKSA6IG51bGx9CgogICAgICA8Zm9ybSBvblN1Ym1pdD17c3VibWl0fSBjbGFzc05hbWU9Im10LTYgZ3JpZCBnYXAtNCI+CiAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT0iZ3JpZCBnYXAtMiB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1zbGF0ZS03MDAiPgogICAgICAgICAgU2VuaGEgYXR1YWwKICAgICAgICAgIDxpbnB1dAogICAgICAgICAgICB0eXBlPXtzaG93UGFzc3dvcmRzID8gInRleHQiIDogInBhc3N3b3JkIn0KICAgICAgICAgICAgdmFsdWU9e2N1cnJlbnRQYXNzd29yZH0KICAgICAgICAgICAgb25DaGFuZ2U9eyhldmVudCkgPT4gc2V0Q3VycmVudFBhc3N3b3JkKGV2ZW50LnRhcmdldC52YWx1ZSl9CiAgICAgICAgICAgIGF1dG9Db21wbGV0ZT0iY3VycmVudC1wYXNzd29yZCIKICAgICAgICAgICAgbWF4TGVuZ3RoPXsxMjh9CiAgICAgICAgICAgIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgYmctc2xhdGUtNTAgcHgtNCBweS00IGZvbnQtc2VtaWJvbGQgb3V0bGluZS1ub25lIHRyYW5zaXRpb24gZm9jdXM6Ym9yZGVyLVsjMDUyNDVjXSBmb2N1czpiZy13aGl0ZSBmb2N1czpyaW5nLTQgZm9jdXM6cmluZy1ibHVlLTEwMCIKICAgICAgICAgIC8+CiAgICAgICAgPC9sYWJlbD4KCiAgICAgICAgPGRpdiBjbGFzc05hbWU9ImdyaWQgZ2FwLTQgbWQ6Z3JpZC1jb2xzLTIiPgogICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT0iZ3JpZCBnYXAtMiB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1zbGF0ZS03MDAiPgogICAgICAgICAgICBOb3ZhIHNlbmhhCiAgICAgICAgICAgIDxpbnB1dAogICAgICAgICAgICAgIHR5cGU9e3Nob3dQYXNzd29yZHMgPyAidGV4dCIgOiAicGFzc3dvcmQifQogICAgICAgICAgICAgIHZhbHVlPXtuZXdQYXNzd29yZH0KICAgICAgICAgICAgICBvbkNoYW5nZT17KGV2ZW50KSA9PiBzZXROZXdQYXNzd29yZChldmVudC50YXJnZXQudmFsdWUpfQogICAgICAgICAgICAgIGF1dG9Db21wbGV0ZT0ibmV3LXBhc3N3b3JkIgogICAgICAgICAgICAgIG1heExlbmd0aD17MTI4fQogICAgICAgICAgICAgIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgYmctc2xhdGUtNTAgcHgtNCBweS00IGZvbnQtc2VtaWJvbGQgb3V0bGluZS1ub25lIHRyYW5zaXRpb24gZm9jdXM6Ym9yZGVyLVsjMDUyNDVjXSBmb2N1czpiZy13aGl0ZSBmb2N1czpyaW5nLTQgZm9jdXM6cmluZy1ibHVlLTEwMCIKICAgICAgICAgICAgLz4KICAgICAgICAgIDwvbGFiZWw+CgogICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT0iZ3JpZCBnYXAtMiB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1zbGF0ZS03MDAiPgogICAgICAgICAgICBDb25maXJtYXIgbm92YSBzZW5oYQogICAgICAgICAgICA8aW5wdXQKICAgICAgICAgICAgICB0eXBlPXtzaG93UGFzc3dvcmRzID8gInRleHQiIDogInBhc3N3b3JkIn0KICAgICAgICAgICAgICB2YWx1ZT17Y29uZmlybVBhc3N3b3JkfQogICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IHNldENvbmZpcm1QYXNzd29yZChldmVudC50YXJnZXQudmFsdWUpfQogICAgICAgICAgICAgIGF1dG9Db21wbGV0ZT0ibmV3LXBhc3N3b3JkIgogICAgICAgICAgICAgIG1heExlbmd0aD17MTI4fQogICAgICAgICAgICAgIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgYmctc2xhdGUtNTAgcHgtNCBweS00IGZvbnQtc2VtaWJvbGQgb3V0bGluZS1ub25lIHRyYW5zaXRpb24gZm9jdXM6Ym9yZGVyLVsjMDUyNDVjXSBmb2N1czpiZy13aGl0ZSBmb2N1czpyaW5nLTQgZm9jdXM6cmluZy1ibHVlLTEwMCIKICAgICAgICAgICAgLz4KICAgICAgICAgIDwvbGFiZWw+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxkaXYgY2xhc3NOYW1lPSJmbGV4IGZsZXgtY29sIGdhcC0zIHJvdW5kZWQtMnhsIGJnLVsjZjdmOWZjXSBwLTQgc206ZmxleC1yb3cgc206aXRlbXMtY2VudGVyIHNtOmp1c3RpZnktYmV0d2VlbiI+CiAgICAgICAgICA8ZGl2PgogICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB0ZXh0LVsjMDcxYjNhXSI+CiAgICAgICAgICAgICAgUmVxdWlzaXRvcyBkYSBub3ZhIHNlbmhhCiAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0xIHRleHQteHMgZm9udC1zZW1pYm9sZCB0ZXh0LXNsYXRlLTUwMCI+CiAgICAgICAgICAgICAgUGVsbyBtZW5vcyAxMCBjYXJhY3RlcmVzLCBpbmNsdWluZG8gbGV0cmEgZSBuw7ptZXJvLgogICAgICAgICAgICA8L3A+CiAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPSJmbGV4IGN1cnNvci1wb2ludGVyIGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXhzIGZvbnQtYmxhY2sgdGV4dC1bIzA1MjQ1Y10iPgogICAgICAgICAgICA8aW5wdXQKICAgICAgICAgICAgICB0eXBlPSJjaGVja2JveCIKICAgICAgICAgICAgICBjaGVja2VkPXtzaG93UGFzc3dvcmRzfQogICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+CiAgICAgICAgICAgICAgICBzZXRTaG93UGFzc3dvcmRzKGV2ZW50LnRhcmdldC5jaGVja2VkKQogICAgICAgICAgICAgIH0KICAgICAgICAgICAgLz4KICAgICAgICAgICAgTW9zdHJhciBzZW5oYXMKICAgICAgICAgIDwvbGFiZWw+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxidXR0b24KICAgICAgICAgIHR5cGU9InN1Ym1pdCIKICAgICAgICAgIGRpc2FibGVkPXtidXN5fQogICAgICAgICAgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBiZy1bIzA1MjQ1Y10gcHgtNSBweS00IGZvbnQtYmxhY2sgdGV4dC13aGl0ZSBzaGFkb3cteGwgc2hhZG93LWJsdWUtOTUwLzE1IHRyYW5zaXRpb24gaG92ZXI6LXRyYW5zbGF0ZS15LTAuNSBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWQgZGlzYWJsZWQ6b3BhY2l0eS01MCIKICAgICAgICA+CiAgICAgICAgICB7YnVzeSA/ICJBbHRlcmFuZG8gc2VuaGEuLi4iIDogIkFsdGVyYXIgbWluaGEgc2VuaGEifQogICAgICAgIDwvYnV0dG9uPgogICAgICA8L2Zvcm0+CgogICAgICA8cCBjbGFzc05hbWU9Im10LTQgdGV4dC14cyBmb250LXNlbWlib2xkIGxlYWRpbmctNSB0ZXh0LXNsYXRlLTQwMCI+CiAgICAgICAgQSBzZW5oYSDDqSBlbnZpYWRhIGRpcmV0YW1lbnRlIGFvIFN1cGFiYXNlIEF1dGguIE8gT3LDp2FseSBuw6NvIGdyYXZhIGEKICAgICAgICBzZW5oYSBlbSB0YWJlbGFzIHByw7NwcmlhcyBuZW0gYSBpbmNsdWkgZW0gbG9ncyBkbyBwYWluZWwuCiAgICAgIDwvcD4KICAgIDwvc2VjdGlvbj4KICApOwp9Cg==")
    $componentText = [Text.Encoding]::UTF8.GetString($componentBytes)
    WriteUtf8 $newComponentPath $componentText
    $ChangedFiles.Add("components/auth/ChangePasswordCard.tsx")
    Ok "Criado: components/auth/ChangePasswordCard.tsx"

    Step "Integrando Segurança nas configurações da conta principal"

    $companyPath = FullPath "app/painel/configuracoes/ConfiguracoesLegacy.tsx"
    $companyText = ReadUtf8 $companyPath
    $companyNl = NewlineFor $companyText

    $importNeedle = "import { getCompanyPublicUrl, getRootDomain, normalizeCompanySlug } from '@/lib/company-url'"
    $importReplacement = (
        $importNeedle +
        $companyNl +
        "import ChangePasswordCard from '@/components/auth/ChangePasswordCard'"
    )

    $companyText = ReplaceExactOnce `
        $companyText `
        $importNeedle `
        $importReplacement `
        "Import ChangePasswordCard no painel principal"

    $securityAnchor = "        {tab !== 'equipe' && ("

    $securityBlock = @'
        {/* ORCALY_SELF_PASSWORD_SETTINGS_V1 */}
        <div className="mt-6">
          <div className="mb-4">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
              Conta
            </p>
            <h2
              data-settings-section
              className="mt-2 text-2xl font-black"
            >
              Segurança da conta
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              Altere somente a senha do usuário que está conectado neste navegador.
            </p>
          </div>
          <ChangePasswordCard
            title="Senha de acesso ao Orçaly"
            description="A alteração vale para este login. Funcionários e outros usuários continuam com as próprias credenciais."
          />
        </div>

'@

    $securityBlock = $securityBlock -replace "`r?`n", $companyNl

    $companyText = ReplaceExactOnce `
        $companyText `
        $securityAnchor `
        ($securityBlock + $securityAnchor) `
        "Seção Segurança no painel principal"

    WriteUtf8 $companyPath $companyText
    $ChangedFiles.Add("app/painel/configuracoes/ConfiguracoesLegacy.tsx")
    Ok "Configurações principais atualizadas."

    Step "Adicionando Configurações ao Portal de Parceiros"

    $partnerPath = FullPath "app/parceiros/painel/page.tsx"
    $partnerText = ReadUtf8 $partnerPath
    $partnerNl = NewlineFor $partnerText

    $partnerImport = 'import PartnerGrowthHub from "@/components/parceiros/PartnerGrowthHub";'
    $partnerImportReplacement = (
        $partnerImport +
        $partnerNl +
        'import ChangePasswordCard from "@/components/auth/ChangePasswordCard";'
    )

    $partnerText = ReplaceExactOnce `
        $partnerText `
        $partnerImport `
        $partnerImportReplacement `
        "Import ChangePasswordCard no Portal de Parceiros"

    $tabNeedle = '    | "payments"'
    $tabReplacement = (
        $tabNeedle +
        $partnerNl +
        '    | "settings"'
    )

    $partnerText = ReplaceExactOnce `
        $partnerText `
        $tabNeedle `
        $tabReplacement `
        "Tipo da aba Configurações"

    $navNeedle = '    ["payments", "Pagamentos e Pix"],'
    $navReplacement = (
        $navNeedle +
        $partnerNl +
        '    ["settings", "Configurações"],'
    )

    $partnerText = ReplaceExactOnce `
        $partnerText `
        $navNeedle `
        $navReplacement `
        "Menu Configurações do Portal de Parceiros"

    $rankingAnchor = '          {tab === "ranking" ? ('

    $partnerSettings = @'
          {/* ORCALY_SELF_PASSWORD_SETTINGS_V1 */}
          {tab === "settings" ? (
            <div className="grid gap-5">
              <section
                data-partner-card
                className="partner-fade-up rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6"
              >
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                  Configurações
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                  Minha conta
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Gerencie a segurança do seu login de indicador sem alterar dados de comissão, Pix ou indicações.
                </p>
              </section>

              <ChangePasswordCard
                compact
                title="Senha do Portal de Parceiros"
                description="Confirme a senha atual antes de definir a nova senha deste login."
              />
            </div>
          ) : null}

'@

    $partnerSettings = $partnerSettings -replace "`r?`n", $partnerNl

    $partnerText = ReplaceExactOnce `
        $partnerText `
        $rankingAnchor `
        ($partnerSettings + $rankingAnchor) `
        "Conteúdo Configurações do Portal de Parceiros"

    WriteUtf8 $partnerPath $partnerText
    $ChangedFiles.Add("app/parceiros/painel/page.tsx")
    Ok "Portal de Parceiros atualizado."

    Step "Validação estrutural"

    $componentAfter = ReadUtf8 $newComponentPath
    $companyAfter = ReadUtf8 $companyPath
    $partnerAfter = ReadUtf8 $partnerPath

    $checks = New-Object System.Collections.Generic.List[object]
    $checks.Add(@($componentAfter.Contains("current_password: currentPassword"), "current_password no componente"))
    $checks.Add(@($componentAfter.Contains("supabase.auth.updateUser"), "updateUser no componente"))
    $checks.Add(@($componentAfter.Contains("supabase.auth.getUser"), "getUser antes da alteração"))
    $checks.Add(@((-not $componentAfter.Contains("SUPABASE_SERVICE_ROLE_KEY")), "sem service_role no componente"))
    $checks.Add(@($companyAfter.Contains("data-settings-section"), "seção Segurança detectável pelo SettingsPremiumShell"))
    $checks.Add(@($companyAfter.Contains("ChangePasswordCard"), "componente no painel principal"))
    $checks.Add(@($partnerAfter.Contains('| "settings"'), "aba settings tipada"))
    $checks.Add(@($partnerAfter.Contains('["settings", "Configurações"]'), "Configurações no menu de parceiros"))
    $checks.Add(@($partnerAfter.Contains("ChangePasswordCard"), "componente no Portal de Parceiros"))

    foreach ($check in $checks) {
        if (-not [bool]$check[0]) {
            throw ("Validação falhou: " + [string]$check[1])
        }

        Ok ([string]$check[1])
    }

    & git --no-pager diff --check -- `
        "components/auth/ChangePasswordCard.tsx" `
        "app/painel/configuracoes/ConfiguracoesLegacy.tsx" `
        "app/parceiros/painel/page.tsx"

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check encontrou problema de whitespace no patch."
    }

    Step "Lint do componente novo"
    & npx.cmd eslint "components/auth/ChangePasswordCard.tsx"

    if ($LASTEXITCODE -ne 0) {
        throw "O componente novo falhou no lint."
    }

    Ok "Componente novo passou no lint."

    if (-not $SkipFinalBuild) {
        Step "Build final"
        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "O build final falhou após a alteração de senha."
        }

        Ok "Build final passou."
    }

    Step "Diff final limitado ao escopo"

    & git --no-pager diff -- `
        "components/auth/ChangePasswordCard.tsx" `
        "app/painel/configuracoes/ConfiguracoesLegacy.tsx" `
        "app/parceiros/painel/page.tsx"

    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host " ALTERAÇÃO DE SENHA NAS CONFIGURAÇÕES APLICADA" -ForegroundColor Green
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Conta principal: /painel/configuracoes > Segurança"
    Write-Host "Indicadores: /parceiros/painel > Configurações"
    Write-Host ""
    Write-Host "Segurança:"
    Write-Host " - exige sessão autenticada"
    Write-Host " - exige senha atual"
    Write-Host " - usa supabase.auth.updateUser"
    Write-Host " - não usa service_role no navegador"
    Write-Host " - não grava senha em tabela própria"
    Write-Host " - não altera proxy, login, comissão, Pix ou RLS"
    Write-Host ""
    Write-Host ("Auditoria: " + $AuditReport)
    Write-Host ("Backup: " + $BackupRoot)
    Write-Host ""
    Write-Host "Nenhuma migration, commit, push ou deploy foi executado." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host ("[ERRO] " + $_.Exception.Message) -ForegroundColor Red

    if ($ChangedFiles.Count -gt 0) {
        Warn "Executando rollback dos arquivos alterados por este patch."
        Restore-Patch
    }

    Write-Host ("Diagnóstico/backup: " + $BackupRoot) -ForegroundColor Yellow
    exit 1
}
