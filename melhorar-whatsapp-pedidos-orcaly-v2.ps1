param(
    [string]$ProjectRoot = "",
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding =
        New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding =
        New-Object System.Text.UTF8Encoding($false)
} catch {}

$Utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

$ExpectedBranch =
    "fix/unify-payment-flows-phase-1"

$Marker =
    "ORCALY_ORDER_WHATSAPP_MESSAGE_V1"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot =
        (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$BackupRoot = Join-Path `
    $ProjectRoot `
    (".orcaly-backups\whatsapp-pedidos-" + $Timestamp)

$AuditReport = Join-Path `
    $BackupRoot `
    "AUDITORIA-WHATSAPP-PEDIDOS.txt"

$ChangedFiles =
    New-Object System.Collections.Generic.List[string]

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
    return Join-Path `
        $ProjectRoot `
        ($Relative -replace "/", "\")
}

function ReadUtf8([string]$Path) {
    return [IO.File]::ReadAllText($Path)
}

function WriteUtf8(
    [string]$Path,
    [string]$Text
) {
    [IO.Directory]::CreateDirectory(
        (Split-Path -Parent $Path)
    ) | Out-Null

    [IO.File]::WriteAllText(
        $Path,
        $Text,
        $Utf8NoBom
    )
}

function NewlineFor([string]$Text) {
    if ($Text.Contains("`r`n")) {
        return "`r`n"
    }

    return "`n"
}

function CountExact(
    [string]$Text,
    [string]$Needle
) {
    if ([string]::IsNullOrEmpty($Needle)) {
        return 0
    }

    $count = 0
    $start = 0

    while ($true) {
        $index = $Text.IndexOf(
            $Needle,
            $start,
            [StringComparison]::Ordinal
        )

        if ($index -lt 0) {
            break
        }

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
        throw (
            $Label +
            ": ancora encontrada " +
            $count +
            " vez(es), esperado 1."
        )
    }

    $index = $Text.IndexOf(
        $Needle,
        [StringComparison]::Ordinal
    )

    return (
        $Text.Substring(0, $index) +
        $Replacement +
        $Text.Substring(
            $index + $Needle.Length
        )
    )
}

function Backup([string]$Relative) {
    $source = FullPath $Relative

    if (
        -not (
            Test-Path `
                -LiteralPath $source `
                -PathType Leaf
        )
    ) {
        return
    }

    if ($BackupMap.ContainsKey($Relative)) {
        return
    }

    $destination = Join-Path `
        $BackupRoot `
        ($Relative -replace "/", "\")

    [IO.Directory]::CreateDirectory(
        (Split-Path -Parent $destination)
    ) | Out-Null

    Copy-Item `
        -LiteralPath $source `
        -Destination $destination `
        -Force

    $BackupMap[$Relative] = $destination
}

function Rollback {
    [array]$items = @($ChangedFiles)
    [Array]::Reverse($items)

    foreach ($relative in $items) {
        $target = FullPath $relative

        if ($BackupMap.ContainsKey($relative)) {
            Copy-Item `
                -LiteralPath $BackupMap[$relative] `
                -Destination $target `
                -Force

            Warn ("Restaurado: " + $relative)
        }
        elseif (
            Test-Path `
                -LiteralPath $target `
                -PathType Leaf
        ) {
            Remove-Item `
                -LiteralPath $target `
                -Force

            Warn (
                "Removido arquivo criado: " +
                $relative
            )
        }
    }
}

function GitHeadBlob([string]$Relative) {
    $result = & git rev-parse `
        ("HEAD:" + $Relative) `
        2>$null

    if ($LASTEXITCODE -ne 0) {
        return ""
    }

    return (
        [string](
            $result |
                Select-Object -First 1
        )
    ).Trim().ToLowerInvariant()
}

function Assert-HeadBlob(
    [string]$Relative,
    [string]$Expected
) {
    $actual = GitHeadBlob $Relative

    if (
        $actual -ne
        $Expected.ToLowerInvariant()
    ) {
        throw (
            $Relative +
            " nao corresponde ao codigo auditado. " +
            "Esperado " +
            $Expected +
            "; atual " +
            $actual +
            "."
        )
    }

    Ok (
        $Relative +
        " corresponde ao HEAD auditado."
    )
}

function Assert-TargetClean(
    [string]$Relative
) {
    & git diff --quiet -- $Relative

    if ($LASTEXITCODE -ne 0) {
        throw (
            $Relative +
            " possui alteracao local. " +
            "O script recusou sobrescrever."
        )
    }

    & git diff --cached --quiet -- $Relative

    if ($LASTEXITCODE -ne 0) {
        throw (
            $Relative +
            " possui alteracao staged. " +
            "O script recusou sobrescrever."
        )
    }

    Ok ($Relative + " esta limpo.")
}

function Audit-WhatsAppSources {
    $extensions = @(
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs"
    )

    $skip = @(
        "\node_modules\",
        "\.next\",
        "\.git\",
        "\.orcaly-backups\",
        "\dist\",
        "\build\"
    )

    $patterns = @(
        "wa.me",
        "whatsappLink",
        "WhatsApp",
        "customer_phone",
        "telefone",
        "items_snapshot"
    )

    $files = @(
        Get-ChildItem `
            -LiteralPath $ProjectRoot `
            -Recurse `
            -File |
        Where-Object {
            if (
                -not (
                    $extensions -contains
                    $_.Extension.ToLowerInvariant()
                )
            ) {
                return $false
            }

            foreach ($token in $skip) {
                if (
                    $_.FullName.IndexOf(
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
    $findings =
        New-Object System.Collections.Generic.List[string]

    foreach ($file in $files) {
        $relative =
            $file.FullName.Substring(
                $ProjectRoot.Length
            ).TrimStart("\")

        $safeRelative =
            $relative.Replace(
                [char]92,
                [char]47
            )

        $lines =
            [IO.File]::ReadAllLines(
                $file.FullName
            )

        $totalLines += $lines.Length

        for (
            $index = 0;
            $index -lt $lines.Length;
            $index++
        ) {
            foreach ($pattern in $patterns) {
                if (
                    $lines[$index].IndexOf(
                        $pattern,
                        [StringComparison]::OrdinalIgnoreCase
                    ) -ge 0
                ) {
                    $findings.Add(
                        (
                            $safeRelative +
                            ":" +
                            ($index + 1) +
                            " [" +
                            $pattern +
                            "]"
                        )
                    )
                }
            }
        }
    }

    $report = @(
        "ORCALY - AUDITORIA WHATSAPP PEDIDOS"
        ""
        (
            "Data: " +
            (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        )
        (
            "Branch: " +
            (
                (& git branch --show-current) |
                    Select-Object -First 1
            )
        )
        (
            "Arquivos-fonte lidos: " +
            $files.Count
        )
        (
            "Linhas lidas: " +
            $totalLines
        )
        ""
        "Ocorrencias relacionadas:"
    )

    if ($findings.Count -eq 0) {
        $report += "(nenhuma)"
    }
    else {
        $report += @($findings)
    }

    WriteUtf8 `
        $AuditReport `
        ($report -join "`r`n")

    Ok (
        "Auditoria local: " +
        $files.Count +
        " arquivos, " +
        $totalLines +
        " linhas."
    )

    Ok (
        "Relatorio: " +
        $AuditReport
    )
}

try {
    Write-Host ""
    Write-Host `
        "ORCALY - WHATSAPP PEDIDOS DETALHADO V2" `
        -ForegroundColor Cyan

    Write-Host `
        "Pedido, horario, itens, entrega e pagamento na mensagem." `
        -ForegroundColor DarkCyan

    if (
        -not (
            Test-Path `
                -LiteralPath (FullPath "package.json") `
                -PathType Leaf
        )
    ) {
        throw (
            "Execute este script na raiz " +
            "do projeto Orcaly."
        )
    }

    if (
        -not (
            Get-Command `
                git.exe `
                -ErrorAction SilentlyContinue
        )
    ) {
        throw "Git nao encontrado."
    }

    if (
        -not (
            Get-Command `
                npm.cmd `
                -ErrorAction SilentlyContinue
        )
    ) {
        throw "npm.cmd nao encontrado."
    }

    Set-Location $ProjectRoot

    [IO.Directory]::CreateDirectory(
        $BackupRoot
    ) | Out-Null

    Step "Validando branch e arquivos auditados"

    $branch = (
        [string](
            (& git branch --show-current) |
                Select-Object -First 1
        )
    ).Trim()

    if ($branch -ne $ExpectedBranch) {
        throw (
            "Branch inesperada: " +
            $branch +
            ". Esperada: " +
            $ExpectedBranch
        )
    }

    Assert-HeadBlob `
        "app/painel/pedidos/page.tsx" `
        "c97215a7d704702c68aa8d2e09d93d38d4071d63"

    Assert-HeadBlob `
        "app/painel/pedidos/[id]/page.tsx" `
        "7dc1834db01ce2ec5ce5d49286381fdabfd1f64d"

    Assert-TargetClean `
        "app/painel/pedidos/page.tsx"

    Assert-TargetClean `
        "app/painel/pedidos/[id]/page.tsx"

    $helperPath =
        FullPath "lib/order-whatsapp.ts"

    if (
        Test-Path `
            -LiteralPath $helperPath `
            -PathType Leaf
    ) {
        throw (
            "lib/order-whatsapp.ts ja existe. " +
            "O script recusou sobrescrever."
        )
    }

    Step "Auditando WhatsApp no codigo local"
    Audit-WhatsAppSources

    if (-not $SkipInitialBuild) {
        Step "Build inicial"

        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw (
                "O projeto ja falha no build " +
                "antes deste patch. " +
                "Nada foi alterado."
            )
        }

        Ok "Build inicial passou."
    }

    Step "Criando backups"

    Backup "app/painel/pedidos/page.tsx"
    Backup "app/painel/pedidos/[id]/page.tsx"

    Step "Criando gerador unico de mensagem"

    $helperBytes =
        [Convert]::FromBase64String(
            "Ly8gT1JDQUxZX09SREVSX1dIQVRTQVBQX01FU1NBR0VfVjEKCnR5cGUgVW5rbm93blJlY29yZCA9IFJlY29yZDxzdHJpbmcsIHVua25vd24+CgpmdW5jdGlvbiBhc1JlY29yZCh2YWx1ZTogdW5rbm93bik6IFVua25vd25SZWNvcmQgfCBudWxsIHsKICByZXR1cm4gdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkKICAgID8gKHZhbHVlIGFzIFVua25vd25SZWNvcmQpCiAgICA6IG51bGwKfQoKZnVuY3Rpb24gYXNBcnJheSh2YWx1ZTogdW5rbm93bik6IHVua25vd25bXSB7CiAgcmV0dXJuIEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiBbXQp9CgpmdW5jdGlvbiBmaXJzdFRleHQoCiAgcmVjb3JkOiBVbmtub3duUmVjb3JkLAogIGtleXM6IHN0cmluZ1tdLAopOiBzdHJpbmcgewogIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHsKICAgIGNvbnN0IHZhbHVlID0gcmVjb3JkW2tleV0KCiAgICBpZiAoCiAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYKICAgICAgdmFsdWUudHJpbSgpCiAgICApIHsKICAgICAgcmV0dXJuIHZhbHVlLnRyaW0oKQogICAgfQoKICAgIGlmICgKICAgICAgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJgogICAgICBOdW1iZXIuaXNGaW5pdGUodmFsdWUpCiAgICApIHsKICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSkKICAgIH0KICB9CgogIHJldHVybiAnJwp9CgpmdW5jdGlvbiBmaXJzdE51bWJlcigKICByZWNvcmQ6IFVua25vd25SZWNvcmQsCiAga2V5czogc3RyaW5nW10sCik6IG51bWJlciB7CiAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykgewogICAgY29uc3QgcGFyc2VkID0gTnVtYmVyKHJlY29yZFtrZXldKQoKICAgIGlmIChOdW1iZXIuaXNGaW5pdGUocGFyc2VkKSAmJiBwYXJzZWQgIT09IDApIHsKICAgICAgcmV0dXJuIHBhcnNlZAogICAgfQogIH0KCiAgcmV0dXJuIDAKfQoKZnVuY3Rpb24gbW9uZXkodmFsdWU6IHVua25vd24pIHsKICBjb25zdCBwYXJzZWQgPSBOdW1iZXIodmFsdWUgfHwgMCkKCiAgcmV0dXJuIHBhcnNlZC50b0xvY2FsZVN0cmluZygncHQtQlInLCB7CiAgICBzdHlsZTogJ2N1cnJlbmN5JywKICAgIGN1cnJlbmN5OiAnQlJMJywKICB9KQp9CgpmdW5jdGlvbiBub3JtYWxpemVTdGF0dXModmFsdWU6IHVua25vd24pIHsKICByZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICcnKQogICAgLnRyaW0oKQogICAgLnRvTG93ZXJDYXNlKCkKfQoKZnVuY3Rpb24gcGF5bWVudFN0YXR1c0xhYmVsKHZhbHVlOiB1bmtub3duKSB7CiAgY29uc3Qgc3RhdHVzID0gbm9ybWFsaXplU3RhdHVzKHZhbHVlKQoKICBjb25zdCBsYWJlbHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7CiAgICBwYWlkOiAnUGFnbycsCiAgICBhcHByb3ZlZDogJ1BhZ28nLAogICAgYXV0aG9yaXplZDogJ0F1dG9yaXphZG8nLAogICAgcGVuZGluZzogJ1BlbmRlbnRlJywKICAgIGluX3Byb2Nlc3M6ICdFbSBwcm9jZXNzYW1lbnRvJywKICAgIGZhaWxlZDogJ0ZhbGhvdScsCiAgICByZWplY3RlZDogJ1JlY3VzYWRvJywKICAgIHJlZnVuZGVkOiAnRXN0b3JuYWRvJywKICAgIGNhbmNlbGxlZDogJ0NhbmNlbGFkbycsCiAgICBjYW5jZWxlZDogJ0NhbmNlbGFkbycsCiAgfQoKICByZXR1cm4gbGFiZWxzW3N0YXR1c10gfHwgU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCkKfQoKZnVuY3Rpb24gZGVsaXZlcnlUeXBlTGFiZWwodmFsdWU6IHVua25vd24pIHsKICBjb25zdCBzdGF0dXMgPSBub3JtYWxpemVTdGF0dXModmFsdWUpCgogIGNvbnN0IGxhYmVsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsKICAgIGRlbGl2ZXJ5OiAnRW50cmVnYScsCiAgICBlbnRyZWdhOiAnRW50cmVnYScsCiAgICBwaWNrdXA6ICdSZXRpcmFkYScsCiAgICByZXRpcmFkYTogJ1JldGlyYWRhJywKICAgIHRha2VvdXQ6ICdSZXRpcmFkYScsCiAgfQoKICByZXR1cm4gbGFiZWxzW3N0YXR1c10gfHwgU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCkKfQoKZnVuY3Rpb24gZm9ybWF0RGF0ZVRpbWVQYXJ0cyh2YWx1ZTogdW5rbm93bikgewogIGlmICghdmFsdWUpIHsKICAgIHJldHVybiB7CiAgICAgIGRhdGU6ICcnLAogICAgICB0aW1lOiAnJywKICAgIH0KICB9CgogIGNvbnN0IHBhcnNlZCA9IG5ldyBEYXRlKFN0cmluZyh2YWx1ZSkpCgogIGlmIChOdW1iZXIuaXNOYU4ocGFyc2VkLmdldFRpbWUoKSkpIHsKICAgIHJldHVybiB7CiAgICAgIGRhdGU6ICcnLAogICAgICB0aW1lOiAnJywKICAgIH0KICB9CgogIHJldHVybiB7CiAgICBkYXRlOiBuZXcgSW50bC5EYXRlVGltZUZvcm1hdCgncHQtQlInLCB7CiAgICAgIGRheTogJzItZGlnaXQnLAogICAgICBtb250aDogJzItZGlnaXQnLAogICAgICB5ZWFyOiAnbnVtZXJpYycsCiAgICB9KS5mb3JtYXQocGFyc2VkKSwKICAgIHRpbWU6IG5ldyBJbnRsLkRhdGVUaW1lRm9ybWF0KCdwdC1CUicsIHsKICAgICAgaG91cjogJzItZGlnaXQnLAogICAgICBtaW51dGU6ICcyLWRpZ2l0JywKICAgIH0pLmZvcm1hdChwYXJzZWQpLAogIH0KfQoKZnVuY3Rpb24gZm9ybWF0RGF0ZVRpbWUodmFsdWU6IHVua25vd24pIHsKICBpZiAoIXZhbHVlKSByZXR1cm4gJycKCiAgY29uc3QgcGFyc2VkID0gbmV3IERhdGUoU3RyaW5nKHZhbHVlKSkKICBpZiAoTnVtYmVyLmlzTmFOKHBhcnNlZC5nZXRUaW1lKCkpKSByZXR1cm4gJycKCiAgcmV0dXJuIG5ldyBJbnRsLkRhdGVUaW1lRm9ybWF0KCdwdC1CUicsIHsKICAgIGRhdGVTdHlsZTogJ3Nob3J0JywKICAgIHRpbWVTdHlsZTogJ3Nob3J0JywKICB9KS5mb3JtYXQocGFyc2VkKQp9CgpmdW5jdGlvbiBvcHRpb25MYWJlbCh2YWx1ZTogdW5rbm93bikgewogIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7CiAgICByZXR1cm4gdmFsdWUudHJpbSgpCiAgfQoKICBpZiAoCiAgICB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmCiAgICBOdW1iZXIuaXNGaW5pdGUodmFsdWUpCiAgKSB7CiAgICByZXR1cm4gU3RyaW5nKHZhbHVlKQogIH0KCiAgY29uc3QgcmVjb3JkID0gYXNSZWNvcmQodmFsdWUpCgogIGlmICghcmVjb3JkKSByZXR1cm4gJycKCiAgY29uc3QgbGFiZWwgPSBmaXJzdFRleHQocmVjb3JkLCBbCiAgICAnbmFtZScsCiAgICAnbGFiZWwnLAogICAgJ3RpdGxlJywKICAgICd2YWx1ZScsCiAgICAnb3B0aW9uX25hbWUnLAogICAgJ3ZhcmlhdGlvbl9uYW1lJywKICBdKQoKICBjb25zdCBkZXRhaWwgPSBmaXJzdFRleHQocmVjb3JkLCBbCiAgICAnb3B0aW9uJywKICAgICdjaG9pY2UnLAogICAgJ2Rlc2NyaXB0aW9uJywKICBdKQoKICBpZiAobGFiZWwgJiYgZGV0YWlsICYmIGRldGFpbCAhPT0gbGFiZWwpIHsKICAgIHJldHVybiBgJHtsYWJlbH06ICR7ZGV0YWlsfWAKICB9CgogIHJldHVybiBsYWJlbCB8fCBkZXRhaWwKfQoKZnVuY3Rpb24gYWRkb25MYWJlbCh2YWx1ZTogdW5rbm93bikgewogIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7CiAgICByZXR1cm4gdmFsdWUudHJpbSgpCiAgfQoKICBjb25zdCByZWNvcmQgPSBhc1JlY29yZCh2YWx1ZSkKCiAgaWYgKCFyZWNvcmQpIHJldHVybiAnJwoKICBjb25zdCBuYW1lID0gZmlyc3RUZXh0KHJlY29yZCwgWwogICAgJ25hbWUnLAogICAgJ2xhYmVsJywKICAgICd0aXRsZScsCiAgICAncHJvZHVjdF9uYW1lJywKICBdKQoKICBpZiAoIW5hbWUpIHJldHVybiAnJwoKICBjb25zdCBxdWFudGl0eSA9IGZpcnN0TnVtYmVyKHJlY29yZCwgWwogICAgJ3F1YW50aXR5JywKICAgICdxdHknLAogIF0pCgogIGNvbnN0IHByaWNlID0gZmlyc3ROdW1iZXIocmVjb3JkLCBbCiAgICAncHJpY2UnLAogICAgJ3VuaXRfcHJpY2UnLAogICAgJ2Ftb3VudCcsCiAgXSkKCiAgY29uc3QgcGllY2VzID0gWwogICAgcXVhbnRpdHkgPiAxID8gYCR7cXVhbnRpdHl9eCAke25hbWV9YCA6IG5hbWUsCiAgXQoKICBpZiAocHJpY2UgPiAwKSB7CiAgICBwaWVjZXMucHVzaChtb25leShwcmljZSkpCiAgfQoKICByZXR1cm4gcGllY2VzLmpvaW4oJyDigJQgJykKfQoKZXhwb3J0IGZ1bmN0aW9uIGdldE9yZGVyRGlzcGxheU51bWJlcigKICBvcmRlclZhbHVlOiB1bmtub3duLAopIHsKICBjb25zdCBvcmRlciA9IGFzUmVjb3JkKG9yZGVyVmFsdWUpIHx8IHt9CgogIGNvbnN0IGV4cGxpY2l0ID0gZmlyc3RUZXh0KG9yZGVyLCBbCiAgICAnb3JkZXJfbnVtYmVyJywKICAgICdudW1lcm9fcGVkaWRvJywKICAgICdudW1iZXInLAogICAgJ2NvZGUnLAogICAgJ3B1YmxpY19pZCcsCiAgXSkKCiAgaWYgKGV4cGxpY2l0KSB7CiAgICByZXR1cm4gZXhwbGljaXQKICAgICAgLnJlcGxhY2UoL14jKy8sICcnKQogICAgICAudHJpbSgpCiAgICAgIC50b1VwcGVyQ2FzZSgpCiAgfQoKICBjb25zdCBpZCA9IGZpcnN0VGV4dChvcmRlciwgWydpZCddKQogICAgLnJlcGxhY2UoL1teYS16QS1aMC05XS9nLCAnJykKICAgIC50b1VwcGVyQ2FzZSgpCgogIGlmICghaWQpIHJldHVybiAnU0VNLVJFRicKCiAgcmV0dXJuIGlkLnNsaWNlKDAsIDgpCn0KCmV4cG9ydCBmdW5jdGlvbiBnZXRPcmRlcldoYXRzQXBwUGhvbmUoCiAgb3JkZXJWYWx1ZTogdW5rbm93biwKKSB7CiAgY29uc3Qgb3JkZXIgPSBhc1JlY29yZChvcmRlclZhbHVlKSB8fCB7fQoKICByZXR1cm4gZmlyc3RUZXh0KG9yZGVyLCBbCiAgICAnY3VzdG9tZXJfcGhvbmUnLAogICAgJ3RlbGVmb25lJywKICAgICdwaG9uZScsCiAgXSkKfQoKZXhwb3J0IGZ1bmN0aW9uIGhhc09yZGVyV2hhdHNBcHBQaG9uZSgKICBvcmRlclZhbHVlOiB1bmtub3duLAopIHsKICByZXR1cm4gQm9vbGVhbigKICAgIGdldE9yZGVyV2hhdHNBcHBQaG9uZShvcmRlclZhbHVlKQogICAgICAucmVwbGFjZSgvXEQvZywgJycpLAogICkKfQoKZnVuY3Rpb24gbm9ybWFsaXplZFdoYXRzQXBwUGhvbmUoCiAgb3JkZXJWYWx1ZTogdW5rbm93biwKKSB7CiAgY29uc3QgY2xlYW4gPSBnZXRPcmRlcldoYXRzQXBwUGhvbmUob3JkZXJWYWx1ZSkKICAgIC5yZXBsYWNlKC9cRC9nLCAnJykKCiAgaWYgKCFjbGVhbikgcmV0dXJuICcnCgogIHJldHVybiBjbGVhbi5zdGFydHNXaXRoKCc1NScpCiAgICA/IGNsZWFuCiAgICA6IGA1NSR7Y2xlYW59YAp9CgpmdW5jdGlvbiBidWlsZEl0ZW1zU2VjdGlvbihvcmRlcjogVW5rbm93blJlY29yZCkgewogIGNvbnN0IHNuYXBzaG90ID0gYXNBcnJheShvcmRlci5pdGVtc19zbmFwc2hvdCkKICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXQoKICBpZiAoc25hcHNob3QubGVuZ3RoID4gMCkgewogICAgc25hcHNob3QuZm9yRWFjaCgocmF3SXRlbSwgaW5kZXgpID0+IHsKICAgICAgY29uc3QgaXRlbSA9IGFzUmVjb3JkKHJhd0l0ZW0pCgogICAgICBpZiAoIWl0ZW0pIHJldHVybgoKICAgICAgY29uc3QgcHJvZHVjdE5hbWUgPQogICAgICAgIGZpcnN0VGV4dChpdGVtLCBbCiAgICAgICAgICAncHJvZHVjdF9uYW1lJywKICAgICAgICAgICduYW1lJywKICAgICAgICAgICd0aXRsZScsCiAgICAgICAgXSkgfHwgYEl0ZW0gJHtpbmRleCArIDF9YAoKICAgICAgY29uc3QgcXVhbnRpdHkgPQogICAgICAgIGZpcnN0TnVtYmVyKGl0ZW0sIFsKICAgICAgICAgICdxdWFudGl0eScsCiAgICAgICAgICAncXR5JywKICAgICAgICBdKSB8fCAxCgogICAgICBsaW5lcy5wdXNoKAogICAgICAgIGAke2luZGV4ICsgMX0uICoke3F1YW50aXR5fXggJHtwcm9kdWN0TmFtZX0qYCwKICAgICAgKQoKICAgICAgY29uc3QgdmFyaWF0aW9uID0gb3B0aW9uTGFiZWwoaXRlbS52YXJpYXRpb24pCgogICAgICBpZiAodmFyaWF0aW9uKSB7CiAgICAgICAgbGluZXMucHVzaChgICAg4oCiIFZhcmlhw6fDo286ICR7dmFyaWF0aW9ufWApCiAgICAgIH0KCiAgICAgIGNvbnN0IGFkZG9ucyA9IGFzQXJyYXkoaXRlbS5hZGRvbnMpCiAgICAgICAgLm1hcChhZGRvbkxhYmVsKQogICAgICAgIC5maWx0ZXIoQm9vbGVhbikKCiAgICAgIGlmIChhZGRvbnMubGVuZ3RoID4gMCkgewogICAgICAgIGxpbmVzLnB1c2goCiAgICAgICAgICBgICAg4oCiIEFkaWNpb25haXM6ICR7YWRkb25zLmpvaW4oJywgJyl9YCwKICAgICAgICApCiAgICAgIH0KCiAgICAgIGNvbnN0IG5vdGVzID0gZmlyc3RUZXh0KGl0ZW0sIFsKICAgICAgICAnbm90ZXMnLAogICAgICAgICdvYnNlcnZhdGlvbicsCiAgICAgICAgJ29ic2VydmFjYW8nLAogICAgICBdKQoKICAgICAgaWYgKG5vdGVzKSB7CiAgICAgICAgbGluZXMucHVzaChgICAg4oCiIE9ic2VydmHDp8OjbzogJHtub3Rlc31gKQogICAgICB9CgogICAgICBjb25zdCB1bml0UHJpY2UgPSBmaXJzdE51bWJlcihpdGVtLCBbCiAgICAgICAgJ3VuaXRfcHJpY2UnLAogICAgICAgICdiYXNlX3ByaWNlJywKICAgICAgXSkKCiAgICAgIGNvbnN0IHN1YnRvdGFsID0gZmlyc3ROdW1iZXIoaXRlbSwgWwogICAgICAgICdzdWJ0b3RhbCcsCiAgICAgICAgJ3RvdGFsJywKICAgICAgXSkKCiAgICAgIGlmICh1bml0UHJpY2UgPiAwKSB7CiAgICAgICAgbGluZXMucHVzaCgKICAgICAgICAgIGAgICDigKIgVmFsb3IgdW5pdMOhcmlvOiAke21vbmV5KHVuaXRQcmljZSl9YCwKICAgICAgICApCiAgICAgIH0KCiAgICAgIGlmIChzdWJ0b3RhbCA+IDApIHsKICAgICAgICBsaW5lcy5wdXNoKAogICAgICAgICAgYCAgIOKAoiBTdWJ0b3RhbDogJHttb25leShzdWJ0b3RhbCl9YCwKICAgICAgICApCiAgICAgIH0KICAgIH0pCiAgfQoKICBpZiAobGluZXMubGVuZ3RoID4gMCkgewogICAgcmV0dXJuIGxpbmVzCiAgfQoKICBjb25zdCBwcm9kdWN0ID0gZmlyc3RUZXh0KG9yZGVyLCBbCiAgICAncHJvZHV0bycsCiAgICAncHJvZHVjdF9uYW1lJywKICBdKQoKICBjb25zdCBzdW1tYXJ5ID0gZmlyc3RUZXh0KG9yZGVyLCBbCiAgICAnaXRlbnNfcmVzdW1vJywKICBdKQoKICBjb25zdCBxdWFudGl0eSA9CiAgICBmaXJzdE51bWJlcihvcmRlciwgWydxdWFudGlkYWRlJ10pIHx8IDEKCiAgaWYgKHByb2R1Y3QpIHsKICAgIGxpbmVzLnB1c2goYDEuICoke3F1YW50aXR5fXggJHtwcm9kdWN0fSpgKQoKICAgIGNvbnN0IHdpZHRoID0gZmlyc3ROdW1iZXIob3JkZXIsIFsnbGFyZ3VyYSddKQogICAgY29uc3QgaGVpZ2h0ID0gZmlyc3ROdW1iZXIob3JkZXIsIFsnYWx0dXJhJ10pCgogICAgaWYgKHdpZHRoID4gMCB8fCBoZWlnaHQgPiAwKSB7CiAgICAgIGxpbmVzLnB1c2goCiAgICAgICAgYCAgIOKAoiBNZWRpZGE6ICR7d2lkdGggfHwgJy0nfSB4ICR7aGVpZ2h0IHx8ICctJ31gLAogICAgICApCiAgICB9CiAgfSBlbHNlIGlmIChzdW1tYXJ5KSB7CiAgICBsaW5lcy5wdXNoKGAxLiAqJHtzdW1tYXJ5fSpgKQogIH0KCiAgcmV0dXJuIGxpbmVzCn0KCmZ1bmN0aW9uIHB1c2hTZWN0aW9uKAogIHRhcmdldDogc3RyaW5nW10sCiAgdGl0bGU6IHN0cmluZywKICByb3dzOiBzdHJpbmdbXSwKKSB7CiAgY29uc3QgY2xlYW5Sb3dzID0gcm93cy5maWx0ZXIoQm9vbGVhbikKCiAgaWYgKGNsZWFuUm93cy5sZW5ndGggPT09IDApIHJldHVybgoKICB0YXJnZXQucHVzaCgnJykKICB0YXJnZXQucHVzaCh0aXRsZSkKICB0YXJnZXQucHVzaCguLi5jbGVhblJvd3MpCn0KCmV4cG9ydCBmdW5jdGlvbiBidWlsZE9yZGVyV2hhdHNBcHBNZXNzYWdlKAogIG9yZGVyVmFsdWU6IHVua25vd24sCikgewogIGNvbnN0IG9yZGVyID0gYXNSZWNvcmQob3JkZXJWYWx1ZSkgfHwge30KCiAgY29uc3QgY3VzdG9tZXJOYW1lID0KICAgIGZpcnN0VGV4dChvcmRlciwgWwogICAgICAnY3VzdG9tZXJfbmFtZScsCiAgICAgICdub21lJywKICAgIF0pIHx8ICdjbGllbnRlJwoKICBjb25zdCBvcmRlck51bWJlciA9CiAgICBnZXRPcmRlckRpc3BsYXlOdW1iZXIob3JkZXIpCgogIGNvbnN0IHB1cmNoYXNlRGF0ZSA9CiAgICBmb3JtYXREYXRlVGltZVBhcnRzKG9yZGVyLmNyZWF0ZWRfYXQpCgogIGNvbnN0IG9yZGVyU3RhdHVzID0KICAgIGZpcnN0VGV4dChvcmRlciwgWydzdGF0dXMnXSkgfHwgJ1JlY2ViaWRvJwoKICBjb25zdCBwYXltZW50U3RhdHVzID0KICAgIHBheW1lbnRTdGF0dXNMYWJlbChvcmRlci5wYXltZW50X3N0YXR1cykKCiAgY29uc3QgaXRlbXMgPSBidWlsZEl0ZW1zU2VjdGlvbihvcmRlcikKCiAgY29uc3QgbGluZXM6IHN0cmluZ1tdID0gWwogICAgYE9sw6EsICoke2N1c3RvbWVyTmFtZX0qISDwn5GLYCwKICAgICcnLAogICAgJ1R1ZG8gYmVtPyBFc3RhbW9zIGVudHJhbmRvIGVtIGNvbnRhdG8gcGFyYSBmYWxhciBzb2JyZSBvIHNldSBwZWRpZG8uIFBhcmEgZmFjaWxpdGFyLCBkZWl4YW1vcyBvIHJlc3VtbyBjb21wbGV0byBsb2dvIGFiYWl4bzonLAogICAgJycsCiAgICAn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJywKICAgIGDwn5OmICpQRURJRE8gIyR7b3JkZXJOdW1iZXJ9KmAsCiAgICAn4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSB4pSBJywKICBdCgogIGlmIChwdXJjaGFzZURhdGUuZGF0ZSkgewogICAgbGluZXMucHVzaCgKICAgICAgYPCfk4UgKkRhdGEgZGEgY29tcHJhOiogJHtwdXJjaGFzZURhdGUuZGF0ZX1gLAogICAgKQogIH0KCiAgaWYgKHB1cmNoYXNlRGF0ZS50aW1lKSB7CiAgICBsaW5lcy5wdXNoKAogICAgICBg8J+VkiAqSG9yw6FyaW8gZGEgY29tcHJhOiogJHtwdXJjaGFzZURhdGUudGltZX1gLAogICAgKQogIH0KCiAgbGluZXMucHVzaChg8J+TjCAqU3RhdHVzIGRvIHBlZGlkbzoqICR7b3JkZXJTdGF0dXN9YCkKCiAgaWYgKHBheW1lbnRTdGF0dXMpIHsKICAgIGxpbmVzLnB1c2goCiAgICAgIGDwn5KzICpTdGF0dXMgZG8gcGFnYW1lbnRvOiogJHtwYXltZW50U3RhdHVzfWAsCiAgICApCiAgfQoKICBjb25zdCBkZWFkbGluZSA9IGZvcm1hdERhdGVUaW1lKG9yZGVyLnByYXpvX2VudHJlZ2EpCgogIGlmIChkZWFkbGluZSkgewogICAgbGluZXMucHVzaChg4o+x77iPICpQcmF6byBwcmV2aXN0bzoqICR7ZGVhZGxpbmV9YCkKICB9CgogIHB1c2hTZWN0aW9uKAogICAgbGluZXMsCiAgICAn8J+bje+4jyAqSVRFTlMgRE8gUEVESURPKicsCiAgICBpdGVtcywKICApCgogIGNvbnN0IGRlbGl2ZXJ5VHlwZSA9IGRlbGl2ZXJ5VHlwZUxhYmVsKAogICAgb3JkZXIuZGVsaXZlcnlfdHlwZSwKICApCgogIGNvbnN0IGFkZHJlc3MgPQogICAgZmlyc3RUZXh0KG9yZGVyLCBbCiAgICAgICdhZGRyZXNzJywKICAgICAgJ2VuZGVyZWNvX2VudHJlZ2EnLAogICAgXSkKCiAgY29uc3QgbmVpZ2hib3Job29kID0KICAgIGZpcnN0VGV4dChvcmRlciwgWyduZWlnaGJvcmhvb2QnXSkKCiAgY29uc3QgY29tcGxlbWVudCA9CiAgICBmaXJzdFRleHQob3JkZXIsIFsnY29tcGxlbWVudCddKQoKICBjb25zdCByZWZlcmVuY2VQb2ludCA9CiAgICBmaXJzdFRleHQob3JkZXIsIFsncmVmZXJlbmNlX3BvaW50J10pCgogIGNvbnN0IGRlbGl2ZXJ5RmVlID0KICAgIGZpcnN0TnVtYmVyKG9yZGVyLCBbJ2RlbGl2ZXJ5X2ZlZSddKQoKICBjb25zdCBkZWxpdmVyeVJvd3M6IHN0cmluZ1tdID0gW10KCiAgaWYgKGRlbGl2ZXJ5VHlwZSkgewogICAgZGVsaXZlcnlSb3dzLnB1c2goCiAgICAgIGDwn5qaICpNb2RhbGlkYWRlOiogJHtkZWxpdmVyeVR5cGV9YCwKICAgICkKICB9CgogIGlmIChhZGRyZXNzKSB7CiAgICBkZWxpdmVyeVJvd3MucHVzaChg8J+TjSAqRW5kZXJlw6dvOiogJHthZGRyZXNzfWApCiAgfQoKICBpZiAobmVpZ2hib3Job29kKSB7CiAgICBkZWxpdmVyeVJvd3MucHVzaCgKICAgICAgYPCfj5jvuI8gKkJhaXJybzoqICR7bmVpZ2hib3Job29kfWAsCiAgICApCiAgfQoKICBpZiAoY29tcGxlbWVudCkgewogICAgZGVsaXZlcnlSb3dzLnB1c2goCiAgICAgIGDwn4+gICpDb21wbGVtZW50bzoqICR7Y29tcGxlbWVudH1gLAogICAgKQogIH0KCiAgaWYgKHJlZmVyZW5jZVBvaW50KSB7CiAgICBkZWxpdmVyeVJvd3MucHVzaCgKICAgICAgYPCfp60gKlBvbnRvIGRlIHJlZmVyw6puY2lhOiogJHtyZWZlcmVuY2VQb2ludH1gLAogICAgKQogIH0KCiAgaWYgKGRlbGl2ZXJ5RmVlID4gMCkgewogICAgZGVsaXZlcnlSb3dzLnB1c2goCiAgICAgIGDwn5u1ICpUYXhhIGRlIGVudHJlZ2E6KiAke21vbmV5KGRlbGl2ZXJ5RmVlKX1gLAogICAgKQogIH0KCiAgcHVzaFNlY3Rpb24oCiAgICBsaW5lcywKICAgIGRlbGl2ZXJ5VHlwZQogICAgICA/IGDwn5qaICoke2RlbGl2ZXJ5VHlwZS50b1VwcGVyQ2FzZSgpfSpgCiAgICAgIDogJ/CfmpogKkVOVFJFR0EgLyBSRVRJUkFEQSonLAogICAgZGVsaXZlcnlSb3dzLAogICkKCiAgY29uc3QgcGF5bWVudE1ldGhvZCA9IGZpcnN0VGV4dChvcmRlciwgWwogICAgJ3BheW1lbnRfbWV0aG9kJywKICAgICdmb3JtYV9wYWdhbWVudG8nLAogIF0pCgogIGNvbnN0IHN1YnRvdGFsID0gZmlyc3ROdW1iZXIob3JkZXIsIFsKICAgICdzdWJ0b3RhbCcsCiAgXSkKCiAgY29uc3QgZGlzY291bnQgPSBmaXJzdE51bWJlcihvcmRlciwgWwogICAgJ2Rpc2NvdW50X2Ftb3VudCcsCiAgICAndmFsb3JfZGVzY29udG8nLAogIF0pCgogIGNvbnN0IGNvdXBvbiA9IGZpcnN0VGV4dChvcmRlciwgWwogICAgJ2NvdXBvbl9jb2RlJywKICAgICdjdXBvbV9jb2RpZ28nLAogIF0pCgogIGNvbnN0IHRvdGFsID0gZmlyc3ROdW1iZXIob3JkZXIsIFsKICAgICd0b3RhbF9hbW91bnQnLAogICAgJ3RvdGFsJywKICAgICd2YWxvcl90b3RhbCcsCiAgICAncHJlY29fZXN0aW1hZG8nLAogIF0pCgogIGNvbnN0IGNoYW5nZUZvciA9IGZpcnN0TnVtYmVyKG9yZGVyLCBbCiAgICAnY2hhbmdlX2ZvcicsCiAgXSkKCiAgY29uc3QgaW5zdGFsbG1lbnRzID0gZmlyc3ROdW1iZXIob3JkZXIsIFsKICAgICdwYXJjZWxhcycsCiAgXSkKCiAgY29uc3QgcGF5bWVudFJvd3M6IHN0cmluZ1tdID0gW10KCiAgaWYgKHBheW1lbnRNZXRob2QpIHsKICAgIHBheW1lbnRSb3dzLnB1c2goCiAgICAgIGDwn5KzICpGb3JtYSBkZSBwYWdhbWVudG86KiAke3BheW1lbnRNZXRob2R9YCwKICAgICkKICB9CgogIGlmIChpbnN0YWxsbWVudHMgPiAxKSB7CiAgICBwYXltZW50Um93cy5wdXNoKAogICAgICBg8J+nviAqUGFyY2VsYXM6KiAke2luc3RhbGxtZW50c314YCwKICAgICkKICB9CgogIGlmIChzdWJ0b3RhbCA+IDApIHsKICAgIHBheW1lbnRSb3dzLnB1c2goCiAgICAgIGDwn5KwICpTdWJ0b3RhbDoqICR7bW9uZXkoc3VidG90YWwpfWAsCiAgICApCiAgfQoKICBpZiAoZGlzY291bnQgPiAwKSB7CiAgICBwYXltZW50Um93cy5wdXNoKAogICAgICBg8J+Pt++4jyAqRGVzY29udG86KiAtJHttb25leShkaXNjb3VudCl9YCwKICAgICkKICB9CgogIGlmIChjb3Vwb24pIHsKICAgIHBheW1lbnRSb3dzLnB1c2goCiAgICAgIGDwn46f77iPICpDdXBvbToqICR7Y291cG9ufWAsCiAgICApCiAgfQoKICBpZiAoZGVsaXZlcnlGZWUgPiAwKSB7CiAgICBwYXltZW50Um93cy5wdXNoKAogICAgICBg8J+btSAqRW50cmVnYToqICR7bW9uZXkoZGVsaXZlcnlGZWUpfWAsCiAgICApCiAgfQoKICBpZiAodG90YWwgPiAwKSB7CiAgICBwYXltZW50Um93cy5wdXNoKAogICAgICBg8J+StSAqVE9UQUwgRE8gUEVESURPOiogKiR7bW9uZXkodG90YWwpfSpgLAogICAgKQogIH0KCiAgaWYgKGNoYW5nZUZvciA+IDApIHsKICAgIHBheW1lbnRSb3dzLnB1c2goCiAgICAgIGDwn5K4ICpUcm9jbyBwYXJhOiogJHttb25leShjaGFuZ2VGb3IpfWAsCiAgICApCiAgfQoKICBwdXNoU2VjdGlvbigKICAgIGxpbmVzLAogICAgJ/CfkrAgKlBBR0FNRU5UTyBFIFZBTE9SRVMqJywKICAgIHBheW1lbnRSb3dzLAogICkKCiAgY29uc3QgY3VzdG9tZXJOb3RlcyA9IGZpcnN0VGV4dChvcmRlciwgWwogICAgJ29ic2VydmFjb2VzJywKICBdKQoKICBpZiAoY3VzdG9tZXJOb3RlcykgewogICAgcHVzaFNlY3Rpb24oCiAgICAgIGxpbmVzLAogICAgICAn8J+TnSAqT0JTRVJWQcOHw5VFUyBETyBQRURJRE8qJywKICAgICAgW2N1c3RvbWVyTm90ZXNdLAogICAgKQogIH0KCiAgbGluZXMucHVzaCgnJykKICBsaW5lcy5wdXNoKCfilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIHilIEnKQogIGxpbmVzLnB1c2goCiAgICAnU2UgcHJlY2lzYXIgY29ycmlnaXIgYWxndW1hIGluZm9ybWHDp8OjbyBvdSB0aXZlciBhbGd1bWEgZMO6dmlkYSwgcG9kZSByZXNwb25kZXIgcG9yIGFxdWkuIPCfmIonLAogICkKCiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xuJykKfQoKZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkT3JkZXJXaGF0c0FwcExpbmsoCiAgb3JkZXJWYWx1ZTogdW5rbm93biwKKSB7CiAgY29uc3QgcGhvbmUgPSBub3JtYWxpemVkV2hhdHNBcHBQaG9uZShvcmRlclZhbHVlKQoKICBpZiAoIXBob25lKSByZXR1cm4gJyMnCgogIGNvbnN0IG1lc3NhZ2UgPQogICAgYnVpbGRPcmRlcldoYXRzQXBwTWVzc2FnZShvcmRlclZhbHVlKQoKICByZXR1cm4gYGh0dHBzOi8vd2EubWUvJHtwaG9uZX0/dGV4dD0ke2VuY29kZVVSSUNvbXBvbmVudChtZXNzYWdlKX1gCn0K"
        )

    $helperText =
        [Text.Encoding]::UTF8.GetString(
            $helperBytes
        )

    WriteUtf8 `
        $helperPath `
        $helperText

    $ChangedFiles.Add(
        "lib/order-whatsapp.ts"
    )

    Ok "Criado: lib/order-whatsapp.ts"

    Step "Atualizando lista de pedidos"

    $listPath =
        FullPath "app/painel/pedidos/page.tsx"

    $listText = ReadUtf8 $listPath
    $listNl = NewlineFor $listText

    $listImportNeedle =
        "import { getOrderStatusVisual, isOrderPaid } from '@/lib/order-status'"

    $listImportReplacement =
        $listImportNeedle +
        $listNl +
        "import { buildOrderWhatsAppLink, hasOrderWhatsAppPhone } from '@/lib/order-whatsapp'"

    $listText = ReplaceExactOnce `
        $listText `
        $listImportNeedle `
        $listImportReplacement `
        "Import WhatsApp na lista"

    $listOldHelpers = @'
function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(phone?: string | null, text?: string) {
  const clean = phoneOnly(phone)
  if (!clean) return '#'
  const finalPhone = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text || 'Olá! Vim falar sobre meu pedido.')}`
}

'@

    $listOldHelpers =
        $listOldHelpers -replace "`r?`n", $listNl

    $listText = ReplaceExactOnce `
        $listText `
        $listOldHelpers `
        "" `
        "Helpers WhatsApp antigos da lista"

    $listOldHref = @'
href={whatsappLink(order.telefone, `Olá, ${order.nome || ''}! Vim falar sobre seu pedido: ${order.produto || ''}.`)}
'@
    $listOldHref = $listOldHref.Trim()

    $listNewHref = @'
href={buildOrderWhatsAppLink(order)}
'@
    $listNewHref = $listNewHref.Trim()

    $listText = ReplaceExactOnce `
        $listText `
        $listOldHref `
        $listNewHref `
        "Link WhatsApp da lista"

    $listOldClass = @'
`${phoneOnly(order.telefone) ? 'bg-[#05245c]' : 'pointer-events-none bg-slate-300'}`
'@
    $listOldClass = $listOldClass.Trim()

    $listNewClass = @'
`${hasOrderWhatsAppPhone(order) ? 'bg-[#05245c]' : 'pointer-events-none bg-slate-300'}`
'@
    $listNewClass = $listNewClass.Trim()

    $listText = ReplaceExactOnce `
        $listText `
        $listOldClass `
        $listNewClass `
        "Validacao de telefone da lista"

    WriteUtf8 `
        $listPath `
        $listText

    $ChangedFiles.Add(
        "app/painel/pedidos/page.tsx"
    )

    Ok "Lista de pedidos atualizada."

    Step "Atualizando Pedido Pro"

    $detailPath =
        FullPath "app/painel/pedidos/[id]/page.tsx"

    $detailText = ReadUtf8 $detailPath
    $detailNl = NewlineFor $detailText

    $detailImportNeedle =
        "import { getOrderStatusVisual, isOrderPaid } from '@/lib/order-status'"

    $detailImportReplacement =
        $detailImportNeedle +
        $detailNl +
        "import { buildOrderWhatsAppLink, hasOrderWhatsAppPhone } from '@/lib/order-whatsapp'"

    $detailText = ReplaceExactOnce `
        $detailText `
        $detailImportNeedle `
        $detailImportReplacement `
        "Import WhatsApp no Pedido Pro"

    $detailOldHelpers = @'
function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(phone?: string | null, text?: string) {
  const clean = phoneOnly(phone)
  if (!clean) return '#'
  const finalPhone = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text || 'Olá! Vim falar sobre meu pedido.')}`
}

'@

    $detailOldHelpers =
        $detailOldHelpers -replace "`r?`n", $detailNl

    $detailText = ReplaceExactOnce `
        $detailText `
        $detailOldHelpers `
        "" `
        "Helpers WhatsApp antigos do Pedido Pro"

    $detailOldLink = @'
<a href={whatsappLink(order.telefone, `Olá, ${order.nome || ''}! Vim falar sobre seu pedido: ${order.produto || ''}.`)} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-black text-[#05245c]">Enviar WhatsApp</a>
'@
    $detailOldLink = $detailOldLink.Trim()

    $detailNewLink = @'
<a href={buildOrderWhatsAppLink(order)} target="_blank" rel="noreferrer" className={`rounded-2xl border border-blue-100 px-5 py-4 text-sm font-black ${hasOrderWhatsAppPhone(order) ? 'bg-white text-[#05245c]' : 'pointer-events-none bg-slate-100 text-slate-400'}`}>Enviar WhatsApp</a>
'@
    $detailNewLink = $detailNewLink.Trim()

    $detailText = ReplaceExactOnce `
        $detailText `
        $detailOldLink `
        $detailNewLink `
        "Link WhatsApp do Pedido Pro"

    WriteUtf8 `
        $detailPath `
        $detailText

    $ChangedFiles.Add(
        "app/painel/pedidos/[id]/page.tsx"
    )

    Ok "Pedido Pro atualizado."

    Step "Validacao estrutural"

    $helperAfter = ReadUtf8 $helperPath
    $listAfter = ReadUtf8 $listPath
    $detailAfter = ReadUtf8 $detailPath

    $checks =
        New-Object System.Collections.Generic.List[object]

    $checks.Add(
        @(
            $helperAfter.Contains(
                "PEDIDO #"
            ),
            "numero do pedido"
        )
    )

    $checks.Add(
        @(
            $helperAfter.Contains(
                "Horário da compra"
            ),
            "horario da compra"
        )
    )

    $checks.Add(
        @(
            $helperAfter.Contains(
                "items_snapshot"
            ),
            "itens do checkout"
        )
    )

    $checks.Add(
        @(
            $helperAfter.Contains(
                "PAGAMENTO E VALORES"
            ),
            "resumo financeiro"
        )
    )

    $checks.Add(
        @(
            -not $helperAfter.Contains(
                "observacoes_internas"
            ),
            "sem observacoes internas"
        )
    )

    $checks.Add(
        @(
            $listAfter.Contains(
                "buildOrderWhatsAppLink(order)"
            ),
            "lista usa gerador novo"
        )
    )

    $checks.Add(
        @(
            $detailAfter.Contains(
                "buildOrderWhatsAppLink(order)"
            ),
            "Pedido Pro usa gerador novo"
        )
    )

    foreach ($check in $checks) {
        if (-not [bool]$check[0]) {
            throw (
                "Validacao falhou: " +
                [string]$check[1]
            )
        }

        Ok ([string]$check[1])
    }

    & git --no-pager diff --check -- `
        "lib/order-whatsapp.ts" `
        "app/painel/pedidos/page.tsx" `
        "app/painel/pedidos/[id]/page.tsx"

    if ($LASTEXITCODE -ne 0) {
        throw (
            "git diff --check encontrou " +
            "problema no patch."
        )
    }

    Step "Lint do gerador novo"

    & npx.cmd eslint `
        "lib/order-whatsapp.ts"

    if ($LASTEXITCODE -ne 0) {
        throw (
            "O novo gerador WhatsApp " +
            "falhou no lint."
        )
    }

    Ok "Gerador novo passou no lint."

    if (-not $SkipFinalBuild) {
        Step "Build final"

        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw (
                "O build final falhou " +
                "apos a melhoria do WhatsApp."
            )
        }

        Ok "Build final passou."
    }

    Step "Resumo"

    Write-Host ""
    Write-Host `
        "WHATSAPP DE PEDIDOS ATUALIZADO" `
        -ForegroundColor Green

    Write-Host ""
    Write-Host "Mensagem agora inclui:"
    Write-Host " - Pedido # com referencia curta"
    Write-Host " - Data e horario da compra"
    Write-Host " - Status do pedido e pagamento"
    Write-Host " - Itens, quantidade e variacoes"
    Write-Host " - Adicionais e observacoes"
    Write-Host " - Entrega ou retirada"
    Write-Host " - Endereco, bairro e referencia"
    Write-Host " - Subtotal, desconto, cupom e taxa"
    Write-Host " - Forma de pagamento e troco"
    Write-Host " - Total em destaque"
    Write-Host ""
    Write-Host (
        "Auditoria: " +
        $AuditReport
    )
    Write-Host (
        "Backup: " +
        $BackupRoot
    )
    Write-Host ""
    Write-Host `
        "Nenhuma migration, commit, push ou deploy foi executado." `
        -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host `
        ("[ERRO] " + $_.Exception.Message) `
        -ForegroundColor Red

    if ($ChangedFiles.Count -gt 0) {
        Warn "Executando rollback."
        Rollback
    }

    Write-Host `
        ("Diagnostico/backup: " + $BackupRoot) `
        -ForegroundColor Yellow

    exit 1
}
