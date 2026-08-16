# ORCALY_HARDENING_V2_ASCII_ONLY
# Compatible source encoding strategy for Windows PowerShell 5.1.
param(
    [switch]$ApplySupabase,
    [switch]$Commit,
    [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ExpectedBaseBranch = "fix/unify-payment-flows-phase-1"
$HardeningBranch = "agent/hardening-orcaly-2026-08-08"
$CommitMessage = "Endurece seguranca autorizacao e integridade do Orcaly"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command([string[]]$Names) {
    foreach ($Name in $Names) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($Command) { return $Command.Source }
    }
    throw "Comando ausente: $($Names -join ' / ')"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments
    )
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Comando falhou ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    $Encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Test-ArtifactPath([string]$Path) {
    if ($Path -match '^[^/]+\.ps1$') { return $true }
    if ($Path -match '^\.orcaly-') { return $true }
    if ($Path -match '^qa-orcaly-') { return $true }
    if ($Path -match '^qa-.*\.txt$') { return $true }
    if ($Path -match '^auditoria-.*\.(txt|json|log)$') { return $true }
    if ($Path -match '^resultado-.*\.(txt|json|log)$') { return $true }
    if ($Path -match '^erro-.*\.log$') { return $true }
    if ($Path -eq 'orcaly-payment-flows-phase1.zip') { return $true }
    if ($Path -eq 'orcaly-payment-flows-phase1.mjs') { return $true }
    if ($Path -match '^orcaly-payment-flows-phase1/') { return $true }
    return $false
}

$script:RepairedMojibakeFiles = @()

function Repair-MojibakeTrackedFiles([string]$Git) {
    Write-Step "Reparando apenas sequencias reais de mojibake em arquivos rastreados"

    $Extensions = @(".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".sql", ".md", ".css")
    # ASCII-only source: build mojibake markers from Unicode code points so
    # Windows PowerShell 5.1 never has to parse smart quotes or corrupted UTF-8.
    $Markers = @(
        (-join @([char]0x00C3, [char]0x00A7)),
        (-join @([char]0x00C3, [char]0x00A3)),
        (-join @([char]0x00C3, [char]0x00B5)),
        (-join @([char]0x00C3, [char]0x00A9)),
        (-join @([char]0x00C3, [char]0x00AA)),
        (-join @([char]0x00C3, [char]0x00A1)),
        (-join @([char]0x00C3, [char]0x00ED)),
        (-join @([char]0x00C3, [char]0x00AD)),
        (-join @([char]0x00C3, [char]0x00B3)),
        (-join @([char]0x00C3, [char]0x00BA)),
        (-join @([char]0x00C2, [char]0x00B7)),
        (-join @([char]0x00C2, [char]0x00BA)),
        (-join @([char]0x00C2, [char]0x00AA)),
        (-join @([char]0x00E2, [char]0x0153, [char]0x201C)),
        (-join @([char]0x00E2, [char]0x2020, [char]0x2019)),
        (-join @([char]0x00E2, [char]0x20AC, [char]0x0153)),
        (-join @([char]0x00E2, [char]0x20AC))
    )
    $Cp1252 = [System.Text.Encoding]::GetEncoding(1252)
    $Utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $WriteEncoding = New-Object System.Text.UTF8Encoding($false)

    $Tracked = & $Git ls-files
    foreach ($Relative in $Tracked) {
        $Ext = [System.IO.Path]::GetExtension($Relative).ToLowerInvariant()
        if ($Extensions -notcontains $Ext) { continue }
        if (-not (Test-Path -LiteralPath $Relative)) { continue }

        $Lines = [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Relative))
        $Changed = $false

        for ($i = 0; $i -lt $Lines.Length; $i++) {
            $Line = $Lines[$i]
            $HasMarker = $false
            foreach ($Marker in $Markers) {
                if ($Line.Contains($Marker)) {
                    $HasMarker = $true
                    break
                }
            }
            if (-not $HasMarker) { continue }

            $Current = $Line
            for ($Pass = 0; $Pass -lt 3; $Pass++) {
                $StillBad = $false
                foreach ($Marker in $Markers) {
                    if ($Current.Contains($Marker)) {
                        $StillBad = $true
                        break
                    }
                }
                if (-not $StillBad) { break }

                try {
                    $Bytes = $Cp1252.GetBytes($Current)
                    $Candidate = $Utf8.GetString($Bytes)
                }
                catch {
                    break
                }

                if ($Candidate.Contains([char]0xFFFD) -or $Candidate -eq $Current) {
                    break
                }
                $Current = $Candidate
            }

            if ($Current -ne $Line) {
                $Lines[$i] = $Current
                $Changed = $true
            }
        }

        if ($Changed) {
            [System.IO.File]::WriteAllLines((Resolve-Path -LiteralPath $Relative), $Lines, $WriteEncoding)
            $script:RepairedMojibakeFiles += $Relative
            Write-Host "[UTF8] $Relative"
        }
    }
}

$Git = Require-Command @("git.exe", "git")
$Node = Require-Command @("node.exe", "node")
$Npm = Require-Command @("npm.cmd", "npm")
$Npx = Require-Command @("npx.cmd", "npx")

$RepoRoot = (& $Git rev-parse --show-toplevel).Trim()
if (-not $RepoRoot) { throw "Nao foi possivel localizar o repositorio Git." }
Set-Location $RepoRoot

$ReportDir = Join-Path $RepoRoot ".orcaly-hardening-local"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TranscriptPath = Join-Path $ReportDir "hardening-report-$Stamp.txt"
Start-Transcript -Path $TranscriptPath -Force | Out-Null

try {
    Write-Step "Validando repositorio e branch"
    $CurrentBranch = (& $Git branch --show-current).Trim()
    Write-Host "Repositorio: $RepoRoot"
    Write-Host "Branch atual: $CurrentBranch"

    $PorcelainBefore = @(& $Git status --porcelain)
    $TrackedDirty = @(
        $PorcelainBefore | Where-Object {
            $_ -and -not $_.StartsWith("??")
        }
    )
    if ($TrackedDirty.Count -gt 0) {
        Write-Host "Alteracoes rastreadas encontradas antes do hardening:" -ForegroundColor Yellow
        $TrackedDirty | ForEach-Object { Write-Host $_ }
        throw "O hardening exige arquivos rastreados limpos para nao misturar alteracoes antigas. Arquivos nao rastreados sao permitidos."
    }

    if ($Push -and -not $ApplySupabase) {
        throw "Por seguranca de rollout, -Push exige -ApplySupabase. A migration deve entrar antes do codigo."
    }
    if ($Push -and -not $Commit) {
        throw "-Push exige -Commit."
    }

    if ($CurrentBranch -eq $ExpectedBaseBranch) {
        $ExistingHardening = & $Git branch --list $HardeningBranch
        if ($ExistingHardening) {
            Invoke-Checked $Git switch $HardeningBranch
        } else {
            Invoke-Checked $Git switch -c $HardeningBranch
        }
    }
    elseif ($CurrentBranch -ne $HardeningBranch) {
        throw "Execute a partir de '$ExpectedBaseBranch' ou '$HardeningBranch'. Branch atual: $CurrentBranch"
    }

    Write-Host "Branch de hardening: $((& $Git branch --show-current).Trim())"

    Write-Step "Criando backup local dos arquivos que serao alterados"
    $BackupRoot = Join-Path $ReportDir "backup-$Stamp"
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

    $TargetFiles = @(
        ".gitignore",
        ".env.example",
        "proxy.ts",
        "lib/br-document.ts",
        "lib/company-access.ts",
        "app/api/company/current/route.ts",
        "lib/panel-modules.ts",
        "components/painel/PanelSidebar.tsx",
        "components/painel/PanelPremiumShell.tsx",
        "app/painel/layout.tsx",
        "components/parceiros/PartnerCoursesTab.tsx",
        "lib/affiliates/academy-catalog.ts",
        "lib/affiliates/workspace.ts",
        "components/parceiros/PartnerGrowthHub.tsx",
        "lib/affiliates/server.ts",
        "app/api/parceiros/route.ts",
        "app/api/parceiros/workspace/route.ts",
        "app/api/parceiros/register/route.ts",
        "app/api/parceiros/track/route.ts",
        "app/api/crm/leads/route.ts",
        "app/api/crm/leads/[id]/route.ts",
        "app/api/checkout/lead/route.ts",
        "app/api/leads/complete-account/route.ts",
        "components/checkout/SignupCheckout.tsx",
        "app/api/checkout/signup/pix/route.ts",
        "app/api/checkout/signup/card/route.ts",
        "app/api/checkout/signup/route.ts",
        "app/api/checkout/signup/status/route.ts",
        "lib/slug.ts",
        "lib/orcaly-security.ts",
        "lib/payments/server-context.ts",
        "app/api/public-site/[slug]/route.ts",
        "app/api/public/uploads/art/route.ts",
        "lib/panel-storage.ts",
        "lib/security/request.ts",
        "app/api/public/home-chat/route.ts",
        "app/api/ai/business-assistant/route.ts",
        "app/api/ai/orcamento/route.ts",
        "app/api/marketplace/coupon/route.ts",
        "app/api/marketplace/payments/settings/route.ts",
        "app/api/marketplace/payments/sales/route.ts",
        "app/api/marketplace/payments/mercado-pago/callback/route.ts",
        "app/api/marketplace/payments/mercado-pago/connect/route.ts",
        "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
        "app/api/mercado-pago/webhook/route.ts",
        "app/api/assinatura/checkout/webhook/route.ts",
        "lib/subscription-checkout-payment.ts",
        "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
        "lib/subscription-mercado-pago-transparent.ts",
        "app/api/company/subscription/route.ts",
        "app/api/mercado-pago/webhook-leads/route.ts",
        "app/api/webhooks/asaas/route.ts",
        "lib/subscription-service.ts",
        "lib/platform-admin.ts",
        "app/api/admin/scan/route.ts",
        "app/api/admin/team/route.ts",
        "app/api/admin/affiliates/route.ts",
        "app/api/admin/change-password/route.ts",
        "app/api/system/health/route.ts",
        "scripts/security-check.mjs"
    )

    $ExistingBefore = @{}
    foreach ($Relative in $TargetFiles) {
        $Full = Join-Path $RepoRoot $Relative
        $ExistingBefore[$Relative] = Test-Path -LiteralPath $Full
        if ($ExistingBefore[$Relative]) {
            $BackupPath = Join-Path $BackupRoot $Relative
            New-Item -ItemType Directory -Force -Path (Split-Path $BackupPath -Parent) | Out-Null
            Copy-Item -LiteralPath $Full -Destination $BackupPath -Force
        }
    }

    Write-Step "Executando patcher tipado e protegido contra substituicoes ambiguas"
    $PatcherPath = Join-Path $ReportDir "hardening-patcher.mjs"
    $PatcherBase64 = @'
aW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwoKY29uc3Qgcm9vdCA9IHByb2Nlc3MuY3dkKCk7CmNvbnN0
IGNoYW5nZWQgPSBbXTsKY29uc3QgY3JlYXRlZCA9IFtdOwoKZnVuY3Rpb24gYWJzKGZpbGUpIHsKICByZXR1cm4gcGF0aC5qb2luKHJvb3QsIC4uLmZpbGUu
c3BsaXQoIi8iKSk7Cn0KZnVuY3Rpb24gcmVhZChmaWxlKSB7CiAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhhYnMoZmlsZSksICJ1dGY4IikucmVwbGFjZSgv
XHJcbi9nLCAiXG4iKTsKfQpmdW5jdGlvbiB3cml0ZShmaWxlLCBjb250ZW50KSB7CiAgZnMubWtkaXJTeW5jKHBhdGguZGlybmFtZShhYnMoZmlsZSkpLCB7
IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsKICBmcy53cml0ZUZpbGVTeW5jKGFicyhmaWxlKSwgY29udGVudC5yZXBsYWNlKC9cclxuL2csICJcbiIpLCAidXRmOCIp
Owp9CmZ1bmN0aW9uIG11c3RFeGlzdChmaWxlKSB7CiAgaWYgKCFmcy5leGlzdHNTeW5jKGFicyhmaWxlKSkpIHRocm93IG5ldyBFcnJvcihgQXJxdWl2byBl
c3BlcmFkbyBuw6NvIGVuY29udHJhZG86ICR7ZmlsZX1gKTsKfQpmdW5jdGlvbiByZXBsYWNlT25jZVRleHQoY29udGVudCwgb2xkVGV4dCwgbmV3VGV4dCwg
bGFiZWwpIHsKICBpZiAoY29udGVudC5pbmNsdWRlcyhuZXdUZXh0KSkgcmV0dXJuIGNvbnRlbnQ7CiAgY29uc3QgZmlyc3QgPSBjb250ZW50LmluZGV4T2Yo
b2xkVGV4dCk7CiAgaWYgKGZpcnN0IDwgMCkgdGhyb3cgbmV3IEVycm9yKGBUcmVjaG8gbsOjbyBlbmNvbnRyYWRvICgke2xhYmVsfSlgKTsKICBpZiAoY29u
dGVudC5pbmRleE9mKG9sZFRleHQsIGZpcnN0ICsgb2xkVGV4dC5sZW5ndGgpID49IDApIHsKICAgIHRocm93IG5ldyBFcnJvcihgVHJlY2hvIGFwYXJlY2V1
IG1haXMgZGUgdW1hIHZleiAoJHtsYWJlbH0pYCk7CiAgfQogIHJldHVybiBjb250ZW50LnNsaWNlKDAsIGZpcnN0KSArIG5ld1RleHQgKyBjb250ZW50LnNs
aWNlKGZpcnN0ICsgb2xkVGV4dC5sZW5ndGgpOwp9CmZ1bmN0aW9uIHJlcGxhY2VPbmNlUmVnZXgoY29udGVudCwgcmVnZXgsIHJlcGxhY2VtZW50LCBsYWJl
bCkgewogIGlmICghcmVnZXguZ2xvYmFsKSB7CiAgICBjb25zdCBtYXRjaGVzID0gY29udGVudC5tYXRjaChuZXcgUmVnRXhwKHJlZ2V4LnNvdXJjZSwgcmVn
ZXguZmxhZ3MgKyAiZyIpKTsKICAgIGlmICghbWF0Y2hlcz8ubGVuZ3RoKSB0aHJvdyBuZXcgRXJyb3IoYFBhZHLDo28gbsOjbyBlbmNvbnRyYWRvICgke2xh
YmVsfSlgKTsKICAgIGlmIChtYXRjaGVzLmxlbmd0aCAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBQYWRyw6NvIGVuY29udHJvdSAke21hdGNoZXMubGVuZ3Ro
fSBvY29ycsOqbmNpYXMgKCR7bGFiZWx9KWApOwogIH0KICByZXR1cm4gY29udGVudC5yZXBsYWNlKHJlZ2V4LCByZXBsYWNlbWVudCk7Cn0KZnVuY3Rpb24g
cGF0Y2goZmlsZSwgdHJhbnNmb3JtKSB7CiAgbXVzdEV4aXN0KGZpbGUpOwogIGNvbnN0IGJlZm9yZSA9IHJlYWQoZmlsZSk7CiAgY29uc3QgYWZ0ZXIgPSB0
cmFuc2Zvcm0oYmVmb3JlKTsKICBpZiAoYWZ0ZXIgIT09IGJlZm9yZSkgewogICAgd3JpdGUoZmlsZSwgYWZ0ZXIpOwogICAgY2hhbmdlZC5wdXNoKGZpbGUp
OwogICAgY29uc29sZS5sb2coYFtQQVRDSF0gJHtmaWxlfWApOwogIH0gZWxzZSB7CiAgICBjb25zb2xlLmxvZyhgW09LXSAke2ZpbGV9IGrDoSBlc3RhdmEg
Y29tcGF0w612ZWxgKTsKICB9Cn0KZnVuY3Rpb24gY3JlYXRlT3JSZXBsYWNlKGZpbGUsIGNvbnRlbnQpIHsKICBjb25zdCBleGlzdGVkID0gZnMuZXhpc3Rz
U3luYyhhYnMoZmlsZSkpOwogIGNvbnN0IGJlZm9yZSA9IGV4aXN0ZWQgPyByZWFkKGZpbGUpIDogbnVsbDsKICBpZiAoYmVmb3JlICE9PSBjb250ZW50KSB7
CiAgICB3cml0ZShmaWxlLCBjb250ZW50KTsKICAgIChleGlzdGVkID8gY2hhbmdlZCA6IGNyZWF0ZWQpLnB1c2goZmlsZSk7CiAgICBjb25zb2xlLmxvZyhg
W1dSSVRFXSAke2ZpbGV9YCk7CiAgfQp9CmZ1bmN0aW9uIGFkZEltcG9ydEFmdGVyKGNvbnRlbnQsIGFuY2hvciwgaW1wb3J0TGluZSwgbGFiZWwpIHsKICBp
ZiAoY29udGVudC5pbmNsdWRlcyhpbXBvcnRMaW5lKSkgcmV0dXJuIGNvbnRlbnQ7CiAgcmV0dXJuIHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBhbmNob3Is
IGAke2FuY2hvcn0ke2ltcG9ydExpbmV9XG5gLCBsYWJlbCk7Cn0KCi8vIDEpIERvY3VtZW50byBicmFzaWxlaXJvIGNhbsO0bmljbwpjcmVhdGVPclJlcGxh
Y2UoImxpYi9ici1kb2N1bWVudC50cyIsIGBleHBvcnQgZnVuY3Rpb24gZG9jdW1lbnREaWdpdHModmFsdWU6IHVua25vd24pIHsKICByZXR1cm4gU3RyaW5n
KHZhbHVlIHx8ICIiKS5yZXBsYWNlKC9cXEQvZywgIiIpOwp9CgpmdW5jdGlvbiBhbGxFcXVhbCh2YWx1ZTogc3RyaW5nKSB7CiAgcmV0dXJuIC9eKFxcZClc
XDErJC8udGVzdCh2YWx1ZSk7Cn0KCmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQ3BmKHZhbHVlOiB1bmtub3duKSB7CiAgY29uc3QgY3BmID0gZG9jdW1lbnRE
aWdpdHModmFsdWUpOwogIGlmIChjcGYubGVuZ3RoICE9PSAxMSB8fCBhbGxFcXVhbChjcGYpKSByZXR1cm4gZmFsc2U7CgogIGNvbnN0IGRpZ2l0ID0gKGJh
c2VMZW5ndGg6IG51bWJlcikgPT4gewogICAgbGV0IHN1bSA9IDA7CiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgYmFzZUxlbmd0aDsgaW5kZXgg
Kz0gMSkgewogICAgICBzdW0gKz0gTnVtYmVyKGNwZltpbmRleF0pICogKGJhc2VMZW5ndGggKyAxIC0gaW5kZXgpOwogICAgfQogICAgY29uc3QgcmVtYWlu
ZGVyID0gKHN1bSAqIDEwKSAlIDExOwogICAgcmV0dXJuIHJlbWFpbmRlciA9PT0gMTAgPyAwIDogcmVtYWluZGVyOwogIH07CgogIHJldHVybiBkaWdpdCg5
KSA9PT0gTnVtYmVyKGNwZls5XSkgJiYgZGlnaXQoMTApID09PSBOdW1iZXIoY3BmWzEwXSk7Cn0KCmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQ25waih2YWx1
ZTogdW5rbm93bikgewogIGNvbnN0IGNucGogPSBkb2N1bWVudERpZ2l0cyh2YWx1ZSk7CiAgaWYgKGNucGoubGVuZ3RoICE9PSAxNCB8fCBhbGxFcXVhbChj
bnBqKSkgcmV0dXJuIGZhbHNlOwoKICBjb25zdCBjYWxjdWxhdGUgPSAoYmFzZUxlbmd0aDogMTIgfCAxMykgPT4gewogICAgY29uc3Qgd2VpZ2h0cyA9CiAg
ICAgIGJhc2VMZW5ndGggPT09IDEyCiAgICAgICAgPyBbNSwgNCwgMywgMiwgOSwgOCwgNywgNiwgNSwgNCwgMywgMl0KICAgICAgICA6IFs2LCA1LCA0LCAz
LCAyLCA5LCA4LCA3LCA2LCA1LCA0LCAzLCAyXTsKICAgIGNvbnN0IHN1bSA9IHdlaWdodHMucmVkdWNlKAogICAgICAodG90YWwsIHdlaWdodCwgaW5kZXgp
ID0+IHRvdGFsICsgTnVtYmVyKGNucGpbaW5kZXhdKSAqIHdlaWdodCwKICAgICAgMCwKICAgICk7CiAgICBjb25zdCByZW1haW5kZXIgPSBzdW0gJSAxMTsK
ICAgIHJldHVybiByZW1haW5kZXIgPCAyID8gMCA6IDExIC0gcmVtYWluZGVyOwogIH07CgogIHJldHVybiAoCiAgICBjYWxjdWxhdGUoMTIpID09PSBOdW1i
ZXIoY25walsxMl0pICYmCiAgICBjYWxjdWxhdGUoMTMpID09PSBOdW1iZXIoY25walsxM10pCiAgKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRDcGZD
bnBqKHZhbHVlOiB1bmtub3duKSB7CiAgY29uc3QgY2xlYW4gPSBkb2N1bWVudERpZ2l0cyh2YWx1ZSk7CiAgcmV0dXJuIGNsZWFuLmxlbmd0aCA9PT0gMTEg
PyBpc1ZhbGlkQ3BmKGNsZWFuKSA6IGlzVmFsaWRDbnBqKGNsZWFuKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVWYWxpZENwZkNucGoodmFsdWU6IHVu
a25vd24pIHsKICBjb25zdCBjbGVhbiA9IGRvY3VtZW50RGlnaXRzKHZhbHVlKTsKICBpZiAoIWlzVmFsaWRDcGZDbnBqKGNsZWFuKSkgewogICAgdGhyb3cg
bmV3IEVycm9yKCJDUEYgb3UgQ05QSiBpbnbDoWxpZG8uIik7CiAgfQogIHJldHVybiBjbGVhbjsKfQpgKTsKCi8vIDEuMSkgQWRtaW4gZGEgcGxhdGFmb3Jt
YSBkZXBlbmRlIGRvIGNhZGFzdHJvIG5vIGJhbmNvLCBuw6NvIGRlIGUtbWFpbCBmaXhvIG5vIGPDs2RpZ28uCnBhdGNoKCJwcm94eS50cyIsIChjb250ZW50
KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgICBjb25zdCBvd25lckVtYWlsTWF0Y2hlcyA9CiAgICAgICAgZGF0YWJhc2VS
b2xlICE9PSAnb3duZXInIHx8CiAgICAgICAgU3RyaW5nKHVzZXIuZW1haWwgfHwgJycpLnRvTG93ZXJDYXNlKCkgPT09CiAgICAgICAgICAndmluaWNpdXNh
ZG1Ab3JjYWx5LmNvbScKCmAsCiAgICAiIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgICAhYWxsb3dlZEFkbWluUm9s
ZXMuaGFzKGRhdGFiYXNlUm9sZSkgfHwKICAgICAgICAhb3duZXJFbWFpbE1hdGNoZXNgLAogICAgYCAgICAgICAgIWFsbG93ZWRBZG1pblJvbGVzLmhhcyhk
YXRhYmFzZVJvbGUpYCwKICApOwoKICBpZiAoY29udGVudC5pbmNsdWRlcygndmluaWNpdXNhZG1Ab3JjYWx5LmNvbScpKSB7CiAgICB0aHJvdyBuZXcgRXJy
b3IoJ3Byb3h5IGFpbmRhIGNvbnRlbSBvd25lciBhZG1pbmlzdHJhdGl2byBmaXhvIHBvciBlLW1haWwnKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoK
Ly8gMikgQXV0b3JpemHDp8OjbyBlIGFzc2luYXR1cmEgY2VudHJhbApwYXRjaCgibGliL2NvbXBhbnktYWNjZXNzLnRzIiwgKGNvbnRlbnQpID0+IHsKICBj
b250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IE5leHRSZXF1ZXN0IH0gZnJvbSAnbmV4dC9zZXJ2ZXInXG4iLAog
ICAgImltcG9ydCB7IGdldENvbXBhbnlTdWJzY3JpcHRpb25BY2Nlc3MsIHR5cGUgU3Vic2NyaXB0aW9uQWNjZXNzSW5wdXQgfSBmcm9tICdAL2xpYi9zdWJz
Y3JpcHRpb24tYWNjZXNzJyIsCiAgICAiY29tcGFueS1hY2Nlc3MgaW1wb3J0IGFzc2luYXR1cmEiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVy
KAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzLCB0eXBlIFN1YnNjcmlwdGlvbkFjY2Vzc0lucHV0IH0g
ZnJvbSAnQC9saWIvc3Vic2NyaXB0aW9uLWFjY2VzcydcbiIsCiAgICAiaW1wb3J0IHsgbm9ybWFsaXplUGxhbktleSwgdHlwZSBQbGFuS2V5IH0gZnJvbSAn
QC9saWIvcGxhbnMvcGxhbi1jb25maWcnIiwKICAgICJjb21wYW55LWFjY2VzcyBpbXBvcnQgcGxhbm8iLAogICk7CgogIGNvbnRlbnQgPSByZXBsYWNlT25j
ZVJlZ2V4KAogICAgY29udGVudCwKICAgIC9leHBvcnQgZnVuY3Rpb24gYXNzaW5hdHVyYUVzdGFBdGl2YVwoY29tcGFueTogUmVjb3JkPHN0cmluZywgdW5r
bm93bj4gXHwgbnVsbFwpIFx7W1xzXFNdKj9cblx9LywKICAgIGBleHBvcnQgZnVuY3Rpb24gYXNzaW5hdHVyYUVzdGFBdGl2YShjb21wYW55OiBSZWNvcmQ8
c3RyaW5nLCB1bmtub3duPiB8IG51bGwpIHsKICByZXR1cm4gZ2V0Q29tcGFueVN1YnNjcmlwdGlvbkFjY2Vzcyhjb21wYW55IGFzIFN1YnNjcmlwdGlvbkFj
Y2Vzc0lucHV0IHwgbnVsbCkuaGFzQWNjZXNzCn1gLAogICAgImFzc2luYXR1cmFFc3RhQXRpdmEgY2Fuw7RuaWNhIiwKICApOwoKICBpZiAoIWNvbnRlbnQu
aW5jbHVkZXMoImV4cG9ydCBmdW5jdGlvbiBjb21wYW55UGxhbkFsbG93cygiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29u
dGVudCwKICAgICAgYGV4cG9ydCBmdW5jdGlvbiBhc3NpbmF0dXJhRXN0YUF0aXZhKGNvbXBhbnk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCkg
ewogIHJldHVybiBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzKGNvbXBhbnkgYXMgU3Vic2NyaXB0aW9uQWNjZXNzSW5wdXQgfCBudWxsKS5oYXNBY2Nl
c3MKfWAsCiAgICAgIGBleHBvcnQgZnVuY3Rpb24gYXNzaW5hdHVyYUVzdGFBdGl2YShjb21wYW55OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IG51bGwp
IHsKICByZXR1cm4gZ2V0Q29tcGFueVN1YnNjcmlwdGlvbkFjY2Vzcyhjb21wYW55IGFzIFN1YnNjcmlwdGlvbkFjY2Vzc0lucHV0IHwgbnVsbCkuaGFzQWNj
ZXNzCn0KCmNvbnN0IENPTVBBTllfUExBTl9SQU5LOiBSZWNvcmQ8UGxhbktleSwgbnVtYmVyPiA9IHsKICBlc3NlbmNpYWw6IDEsCiAgcHJvZmlzc2lvbmFs
OiAyLAogIHByZW1pdW06IDMsCn0KCmV4cG9ydCBmdW5jdGlvbiBjb21wYW55UGxhbkFsbG93cygKICBjb21wYW55OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3du
PiB8IG51bGwsCiAgcmVxdWlyZWRQbGFuOiBQbGFuS2V5LAopIHsKICBpZiAoIWNvbXBhbnkpIHJldHVybiBmYWxzZQoKICBjb25zdCBjdXJyZW50ID0gbm9y
bWFsaXplUGxhbktleSgKICAgIGNvbXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fCBjb21wYW55LnBsYW5vLAogICkKCiAgcmV0dXJuIENPTVBBTllfUExBTl9S
QU5LW2N1cnJlbnRdID49IENPTVBBTllfUExBTl9SQU5LW3JlcXVpcmVkUGxhbl0KfQoKY29uc3QgQ0xJRU5UX0NPTVBBTllfQkxPQ0tFRF9LRVlTID0gbmV3
IFNldChbCiAgJ2Fzc2luYXR1cmFfbXBfcGF5bG9hZCcsCiAgJ3Jhd19wYXlsb2FkJywKICAncmF3X3BheW1lbnQnLAogICdyYXdfcHJlZmVyZW5jZScsCiAg
J3Jhd19zdWJzY3JpcHRpb24nLAogICdwcm92aWRlcl9tZXRhZGF0YScsCl0pCgpleHBvcnQgZnVuY3Rpb24gc2FuaXRpemVDb21wYW55Rm9yQ2xpZW50KAog
IGNvbXBhbnk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCwKKSB7CiAgaWYgKCFjb21wYW55KSByZXR1cm4gbnVsbAoKICByZXR1cm4gT2JqZWN0
LmZyb21FbnRyaWVzKAogICAgT2JqZWN0LmVudHJpZXMoY29tcGFueSkuZmlsdGVyKChba2V5XSkgPT4gewogICAgICBjb25zdCBub3JtYWxpemVkID0ga2V5
LnRvTG93ZXJDYXNlKCkKCiAgICAgIGlmIChDTElFTlRfQ09NUEFOWV9CTE9DS0VEX0tFWVMuaGFzKG5vcm1hbGl6ZWQpKSByZXR1cm4gZmFsc2UKICAgICAg
aWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ2FjY2Vzc190b2tlbicpKSByZXR1cm4gZmFsc2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ3JlZnJl
c2hfdG9rZW4nKSkgcmV0dXJuIGZhbHNlCiAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKCdjbGllbnRfc2VjcmV0JykpIHJldHVybiBmYWxzZQogICAg
ICBpZiAobm9ybWFsaXplZC5pbmNsdWRlcygnc2VjcmV0JykpIHJldHVybiBmYWxzZQogICAgICBpZiAobm9ybWFsaXplZC5pbmNsdWRlcygnYXBpX2tleScp
KSByZXR1cm4gZmFsc2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ2NyZWRlbnRpYWwnKSkgcmV0dXJuIGZhbHNlCiAgICAgIGlmIChub3JtYWxp
emVkLmluY2x1ZGVzKCdlbmNyeXB0ZWQnKSkgcmV0dXJuIGZhbHNlCiAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKCdwYXNzd29yZCcpKSByZXR1cm4g
ZmFsc2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuZW5kc1dpdGgoJ190b2tlbicpIHx8IG5vcm1hbGl6ZWQuc3RhcnRzV2l0aCgndG9rZW5fJykpIHJldHVybiBm
YWxzZQoKICAgICAgcmV0dXJuIHRydWUKICAgIH0pLAogICkKfWAsCiAgICAgICJjb21wYW55IHBsYW4gaGVscGVyIiwKICAgICk7CiAgfQoKICBjb250ZW50
ID0gcmVwbGFjZU9uY2VSZWdleCgKICAgIGNvbnRlbnQsCiAgICAvYXN5bmMgZnVuY3Rpb24gZ2V0QWRtaW5Sb2xlXChbXHNcU10qP1xuXH1cblxuZXhwb3J0
IGFzeW5jIGZ1bmN0aW9uIGdldENvbXBhbnlBY2Nlc3MvLAogICAgYGFzeW5jIGZ1bmN0aW9uIGdldFBsYXRmb3JtT3duZXJSb2xlKAogIHN1cGFiYXNlQWRt
aW46IFJldHVyblR5cGU8dHlwZW9mIGdldFN1cGFiYXNlQWRtaW4+LAogIGVtYWlsPzogc3RyaW5nIHwgbnVsbCwKKSB7CiAgY29uc3Qgbm9ybWFsaXplZCA9
IFN0cmluZyhlbWFpbCB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCkKICBpZiAoIW5vcm1hbGl6ZWQpIHJldHVybiBudWxsCgogIGNvbnN0IHsgZGF0YSwg
ZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgIC5mcm9tKCdwbGF0Zm9ybV9hZG1pbnMnKQogICAgLnNlbGVjdCgncm9sZSxpc19hY3RpdmUnKQog
ICAgLmVxKCdpc19hY3RpdmUnLCB0cnVlKQogICAgLmlsaWtlKCdlbWFpbCcsIG5vcm1hbGl6ZWQpCiAgICAubGltaXQoMSkKICAgIC5tYXliZVNpbmdsZSgp
CgogIGlmIChlcnJvcikgdGhyb3cgZXJyb3IKCiAgcmV0dXJuIFN0cmluZyhkYXRhPy5yb2xlIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PSAnb3duZXInCiAg
ICA/ICdzdXBlcl9hZG1pbicKICAgIDogbnVsbAp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29tcGFueUFjY2Vzc2AsCiAgICAicmVtb3ZlIGF1dG9y
aWRhZGUgYWRtaW5fdXNlcnMiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiY29uc3QgYWRtaW5Sb2xlID0gYXdhaXQgZ2V0QWRt
aW5Sb2xlKHN1cGFiYXNlQWRtaW4sIGVtYWlsKSIsCiAgICAiY29uc3QgYWRtaW5Sb2xlID0gYXdhaXQgZ2V0UGxhdGZvcm1Pd25lclJvbGUoc3VwYWJhc2VB
ZG1pbiwgZW1haWwpIiwKICApOwogIC8vIFJlbW92ZSBmYWxsYmFjayBsZWdhZG8gcXVlIHRyYW5zZm9ybWF2YSBvd25lciBkYSBwbGF0YWZvcm1hIGVtIGRv
bm8gZGUgdW0gdGVuYW50IGZpeG8uCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIGlmIChpc0FkbWluTWFzdGVyKSB7CiAgICBjb25zdCB7
IGRhdGE6IGFkbWluQ29tcGFueSwgZXJyb3I6IGFkbWluQ29tcGFueUVycm9yIH0gPQogICAgICBhd2FpdCBzdXBhYmFzZUFkbWluCiAgICAgICAgLmZyb20o
J2NvbXBhbmllcycpCiAgICAgICAgLnNlbGVjdCgnKicpCiAgICAgICAgLmVxKCdzbHVnJywgJ2dyYWZpY2EtZmxhc2gnKQogICAgICAgIC5tYXliZVNpbmds
ZSgpCgogICAgaWYgKGFkbWluQ29tcGFueUVycm9yKSB0aHJvdyBhZG1pbkNvbXBhbnlFcnJvcgoKICAgIGlmIChhZG1pbkNvbXBhbnk/LmlkKSB7CiAgICAg
IHJldHVybiB7CiAgICAgICAgY29tcGFueTogYWRtaW5Db21wYW55LAogICAgICAgIHJvbGU6ICdzdXBlcl9hZG1pbicgYXMgQ3VycmVudFJvbGUsCiAgICAg
ICAgLi4ucGVybWlzc2lvbnNCeVJvbGUoJ2Rvbm8nLCB0cnVlKSwKICAgICAgfQogICAgfQogIH0KCmAsCiAgICAiIiwKICApOwoKICBpZiAoY29udGVudC5p
bmNsdWRlcygiLmZyb20oJ2FkbWluX3VzZXJzJykiKSkgewogICAgdGhyb3cgbmV3IEVycm9yKCJjb21wYW55LWFjY2VzcyBhaW5kYSByZWZlcmVuY2lhIGFk
bWluX3VzZXJzIik7CiAgfQogIGlmIChjb250ZW50LmluY2x1ZGVzKCIuZXEoJ3NsdWcnLCAnZ3JhZmljYS1mbGFzaCcpIikpIHsKICAgIHRocm93IG5ldyBF
cnJvcigiY29tcGFueS1hY2Nlc3MgYWluZGEgcG9zc3VpIGZhbGxiYWNrIGRlIHRlbmFudCBwYXJhIGFkbWluIGRhIHBsYXRhZm9ybWEiKTsKICB9CiAgcmV0
dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvY29tcGFueS9jdXJyZW50L3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gY29u
dGVudC5yZXBsYWNlKCIgIGFzc2luYXR1cmFFc3RhQXRpdmEsXG4iLCAiIik7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgIGdldFN1cGFi
YXNlQWRtaW4sXG59IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgICAiICBnZXRTdXBhYmFzZUFkbWluLFxuICBzYW5pdGl6ZUNvbXBhbnlGb3JD
bGllbnQsXG59IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAg
In0gZnJvbSAnQC9saWIvY29tcGFueS1hY2Nlc3MnXG4iLAogICAgImltcG9ydCB7IGdldENvbXBhbnlTdWJzY3JpcHRpb25BY2Nlc3MgfSBmcm9tICdAL2xp
Yi9zdWJzY3JpcHRpb24tYWNjZXNzJyIsCiAgICAiY29tcGFueS9jdXJyZW50IGltcG9ydCBzdWJzY3JpcHRpb24iLAogICk7CiAgaWYgKCFjb250ZW50Lmlu
Y2x1ZGVzKCJjb25zdCBzdWJzY3JpcHRpb25BY2Nlc3MgPSBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNl
T25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgICIgICAgY29uc3QgYWNjZXNzID0gYXdhaXQgZ2V0Q29tcGFueUFjY2VzcyhzdXBhYmFzZUFkbWluLCBy
ZXF1ZXN0ZXIuaWQsIHJlcXVlc3Rlci5lbWFpbClcblxuIiwKICAgICAgIiAgICBjb25zdCBhY2Nlc3MgPSBhd2FpdCBnZXRDb21wYW55QWNjZXNzKHN1cGFi
YXNlQWRtaW4sIHJlcXVlc3Rlci5pZCwgcmVxdWVzdGVyLmVtYWlsKVxuICAgIGNvbnN0IHN1YnNjcmlwdGlvbkFjY2VzcyA9IGdldENvbXBhbnlTdWJzY3Jp
cHRpb25BY2Nlc3MoYWNjZXNzLmNvbXBhbnkpXG5cbiIsCiAgICAgICJjb21wYW55L2N1cnJlbnQgYWNjZXNzIiwKICAgICk7CiAgfQogIGNvbnRlbnQgPSBj
b250ZW50LnJlcGxhY2UoCiAgICAiICAgICAgYXNzaW5hdHVyYV9hdGl2YTogYXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSksIiwKICAgICIg
ICAgICBhc3NpbmF0dXJhX2F0aXZhOiBzdWJzY3JpcHRpb25BY2Nlc3MuaGFzQWNjZXNzLFxuICAgICAgc3Vic2NyaXB0aW9uX2FjY2Vzczogc3Vic2NyaXB0
aW9uQWNjZXNzLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgIGNvbXBhbnk6IGFjY2Vzcy5jb21wYW55LCIsCiAgICAi
ICAgICAgY29tcGFueTogc2FuaXRpemVDb21wYW55Rm9yQ2xpZW50KGFjY2Vzcy5jb21wYW55KSwiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8g
MykgQ2F0w6Fsb2dvIGRlIHBsYW5vcyBhcGxpY2FkbyDDoCBuYXZlZ2HDp8OjbyBlIHJvdGEKcGF0Y2goImxpYi9wYW5lbC1tb2R1bGVzLnRzIiwgKGNvbnRl
bnQpID0+IHsKICBpZiAoIWNvbnRlbnQuc3RhcnRzV2l0aCgiaW1wb3J0IHsgbm9ybWFsaXplUGxhbktleSIpKSB7CiAgICBjb250ZW50ID0gYGltcG9ydCB7
IG5vcm1hbGl6ZVBsYW5LZXkgfSBmcm9tICdAL2xpYi9wbGFucy9wbGFuLWNvbmZpZydcblxuJHtjb250ZW50fWA7CiAgfQogIGlmICghY29udGVudC5pbmNs
dWRlcygiZXhwb3J0IGZ1bmN0aW9uIHBhbmVsUGxhbkFsbG93cygiKSkgewogICAgY29uc3QgbWFya2VyID0gIlxuZXhwb3J0IHsgbm9ybWFsaXplQnVzaW5l
c3NUeXBlIGFzIG5vcm1hbGl6ZVBhbmVsQnVzaW5lc3NUeXBlIH0iOwogICAgY29uc3QgaGVscGVyID0gYApjb25zdCBSRVFVSVJFRF9QTEFOX1JBTks6IFJl
Y29yZDxFeGNsdWRlPFJlcXVpcmVkUGxhbiwgbnVsbD4sIG51bWJlcj4gPSB7CiAgYmFzaWM6IDEsCiAgaW50ZXJtZWRpYXRlOiAyLAogIHByZW1pdW06IDMs
Cn0KCmNvbnN0IEFDVFVBTF9QTEFOX1JBTksgPSB7CiAgZXNzZW5jaWFsOiAxLAogIHByb2Zpc3Npb25hbDogMiwKICBwcmVtaXVtOiAzLAp9IGFzIGNvbnN0
CgpleHBvcnQgZnVuY3Rpb24gcGFuZWxQbGFuQWxsb3dzKAogIHJlcXVpcmVkUGxhbjogUmVxdWlyZWRQbGFuLAogIGFjdHVhbFBsYW46IHVua25vd24sCikg
ewogIGlmICghcmVxdWlyZWRQbGFuKSByZXR1cm4gdHJ1ZQoKICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplUGxhbktleShhY3R1YWxQbGFuKQogIHJl
dHVybiBBQ1RVQUxfUExBTl9SQU5LW25vcm1hbGl6ZWRdID49IFJFUVVJUkVEX1BMQU5fUkFOS1tyZXF1aXJlZFBsYW5dCn0KCmV4cG9ydCB0eXBlIFBhbmVs
QWNjZXNzUGVybWlzc2lvbnMgPSB7CiAgY2FuX2ZpbmFuY2U/OiBib29sZWFuCiAgY2FuX2NvbmZpZz86IGJvb2xlYW4KICBjYW5fcHJvZHVjdHM/OiBib29s
ZWFuCiAgY2FuX3Byb3Bvc2FsPzogYm9vbGVhbgogIGNhbl9zdWJzY3JpcHRpb24/OiBib29sZWFuCiAgY2FuX3Byb2R1Y3Rpb24/OiBib29sZWFuCn0KCmV4
cG9ydCBmdW5jdGlvbiBwYW5lbFBlcm1pc3Npb25BbGxvd3MoCiAgbW9kdWxlSXRlbTogUGljazxQYW5lbE1vZHVsZSwgJ2lkJyB8ICdncm91cCc+LAogIHBl
cm1pc3Npb25zPzogUGFuZWxBY2Nlc3NQZXJtaXNzaW9ucyB8IG51bGwsCikgewogIGlmICghcGVybWlzc2lvbnMpIHJldHVybiB0cnVlCgogIGlmICgKICAg
IG1vZHVsZUl0ZW0uZ3JvdXAgPT09ICdmaW5hbmNlaXJvJyB8fAogICAgbW9kdWxlSXRlbS5pZCA9PT0gJ3BhZ2FtZW50b3NfbWFya2V0cGxhY2UnCiAgKSB7
CiAgICByZXR1cm4gcGVybWlzc2lvbnMuY2FuX2ZpbmFuY2UgPT09IHRydWUKICB9CgogIGlmICgKICAgIFsnY2xpZW50ZXNfY3JtJywgJ2ZvbGxvd191cCcs
ICdwcm9wb3N0YXMnXS5pbmNsdWRlcyhtb2R1bGVJdGVtLmlkKQogICkgewogICAgcmV0dXJuIHBlcm1pc3Npb25zLmNhbl9wcm9wb3NhbCA9PT0gdHJ1ZQog
IH0KCiAgaWYgKG1vZHVsZUl0ZW0uaWQgPT09ICdwcm9kdXRvc19zZXJ2aWNvcycpIHsKICAgIHJldHVybiBwZXJtaXNzaW9ucy5jYW5fcHJvZHVjdHMgPT09
IHRydWUKICB9CgogIGlmIChtb2R1bGVJdGVtLmlkID09PSAnY29uZmlndXJhY29lcycpIHsKICAgIHJldHVybiBwZXJtaXNzaW9ucy5jYW5fY29uZmlnID09
PSB0cnVlCiAgfQoKICBpZiAobW9kdWxlSXRlbS5pZCA9PT0gJ2Fzc2luYXR1cmEnKSB7CiAgICByZXR1cm4gcGVybWlzc2lvbnMuY2FuX3N1YnNjcmlwdGlv
biAhPT0gZmFsc2UKICB9CgogIGlmIChtb2R1bGVJdGVtLmlkID09PSAncHJvZHVjYW8nKSB7CiAgICByZXR1cm4gcGVybWlzc2lvbnMuY2FuX3Byb2R1Y3Rp
b24gPT09IHRydWUKICB9CgogIHJldHVybiB0cnVlCn0KCmV4cG9ydCBmdW5jdGlvbiBmaW5kUGFuZWxNb2R1bGVCeVBhdGgocGF0aG5hbWU6IHN0cmluZykg
ewogIGNvbnN0IGNsZWFuID0gU3RyaW5nKHBhdGhuYW1lIHx8ICcnKS5zcGxpdCgnPycpWzBdCgogIHJldHVybiBwYW5lbE1vZHVsZXMKICAgIC5maWx0ZXIo
KG1vZHVsZUl0ZW0pID0+IG1vZHVsZUl0ZW0uc3RhdHVzID09PSAnYWN0aXZlJykKICAgIC5tYXAoKG1vZHVsZUl0ZW0pID0+ICh7CiAgICAgIC4uLm1vZHVs
ZUl0ZW0sCiAgICAgIGhyZWY6IGdldFNhZmVNb2R1bGVIcmVmKG1vZHVsZUl0ZW0pLAogICAgfSkpCiAgICAuZmlsdGVyKAogICAgICAobW9kdWxlSXRlbSkg
PT4KICAgICAgICBjbGVhbiA9PT0gbW9kdWxlSXRlbS5ocmVmIHx8CiAgICAgICAgY2xlYW4uc3RhcnRzV2l0aChcYFwke21vZHVsZUl0ZW0uaHJlZn0vXGAp
LAogICAgKQogICAgLnNvcnQoKGEsIGIpID0+IGIuaHJlZi5sZW5ndGggLSBhLmhyZWYubGVuZ3RoKVswXSB8fCBudWxsCn0KYDsKICAgIGNvbnRlbnQgPSBy
ZXBsYWNlT25jZVRleHQoY29udGVudCwgbWFya2VyLCBgJHtoZWxwZXJ9JHttYXJrZXJ9YCwgInBhbmVsIHBsYW4gaGVscGVycyIpOwogIH0KICByZXR1cm4g
Y29udGVudDsKfSk7CgpwYXRjaCgiY29tcG9uZW50cy9wYWluZWwvUGFuZWxTaWRlYmFyLnRzeCIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRl
bnQucmVwbGFjZSgKICAgICJpbXBvcnQgeyBnZXRQYW5lbE1vZHVsZXNGb3JCdXNpbmVzc1R5cGUsIHBhbmVsR3JvdXBMYWJlbHMsIHR5cGUgUGFuZWxNb2R1
bGVHcm91cCB9IGZyb20gJ0AvbGliL3BhbmVsLW1vZHVsZXMnIiwKICAgICJpbXBvcnQgeyBnZXRQYW5lbE1vZHVsZXNGb3JCdXNpbmVzc1R5cGUsIHBhbmVs
R3JvdXBMYWJlbHMsIHBhbmVsUGVybWlzc2lvbkFsbG93cywgcGFuZWxQbGFuQWxsb3dzLCB0eXBlIFBhbmVsQWNjZXNzUGVybWlzc2lvbnMsIHR5cGUgUGFu
ZWxNb2R1bGVHcm91cCB9IGZyb20gJ0AvbGliL3BhbmVsLW1vZHVsZXMnIiwgCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgImV4cG9y
dCBkZWZhdWx0IGZ1bmN0aW9uIFBhbmVsU2lkZWJhcih7IGNvbXBhbnkgfTogeyBjb21wYW55OiBQYW5lbFNpZGViYXJDb21wYW55IH0pIHsiLAogICAgImV4
cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFBhbmVsU2lkZWJhcih7IGNvbXBhbnksIHBlcm1pc3Npb25zIH06IHsgY29tcGFueTogUGFuZWxTaWRlYmFyQ29tcGFu
eTsgcGVybWlzc2lvbnM/OiBQYW5lbEFjY2Vzc1Blcm1pc3Npb25zIHwgbnVsbCB9KSB7IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwo
CiAgICAiPFNpZGViYXJHcm91cHMgcGF0aG5hbWU9e3BhdGhuYW1lfSBtb2R1bGVzPXttb2R1bGVzfSAvPiIsCiAgICAiPFNpZGViYXJHcm91cHMgcGF0aG5h
bWU9e3BhdGhuYW1lfSBtb2R1bGVzPXttb2R1bGVzfSBwbGFuPXtjb21wYW55LmFzc2luYXR1cmFfcGxhbm8gfHwgY29tcGFueS5wbGFub30gcGVybWlzc2lv
bnM9e3Blcm1pc3Npb25zfSAvPiIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgImZ1bmN0aW9uIFNpZGViYXJHcm91cHMoeyBwYXRo
bmFtZSwgbW9kdWxlcyB9OiB7IHBhdGhuYW1lOiBzdHJpbmc7IG1vZHVsZXM6IFJldHVyblR5cGU8dHlwZW9mIGdldFBhbmVsTW9kdWxlc0ZvckJ1c2luZXNz
VHlwZT4gfSkgeyIsCiAgICAiZnVuY3Rpb24gU2lkZWJhckdyb3Vwcyh7IHBhdGhuYW1lLCBtb2R1bGVzLCBwbGFuLCBwZXJtaXNzaW9ucyB9OiB7IHBhdGhu
YW1lOiBzdHJpbmc7IG1vZHVsZXM6IFJldHVyblR5cGU8dHlwZW9mIGdldFBhbmVsTW9kdWxlc0ZvckJ1c2luZXNzVHlwZT47IHBsYW4/OiBzdHJpbmcgfCBu
dWxsOyBwZXJtaXNzaW9ucz86IFBhbmVsQWNjZXNzUGVybWlzc2lvbnMgfCBudWxsIH0pIHsiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgICIuZmlsdGVyKChtb2R1bGUpID0+IG1vZHVsZS5ncm91cCA9PT0gZ3JvdXAgJiYgbW9kdWxlLnN0YXR1cyA9PT0gJ2FjdGl2ZScpIiwKICAgICIuZmls
dGVyKChtb2R1bGUpID0+IG1vZHVsZS5ncm91cCA9PT0gZ3JvdXAgJiYgbW9kdWxlLnN0YXR1cyA9PT0gJ2FjdGl2ZScgJiYgcGFuZWxQbGFuQWxsb3dzKG1v
ZHVsZS5yZXF1aXJlZFBsYW4sIHBsYW4pICYmIHBhbmVsUGVybWlzc2lvbkFsbG93cyhtb2R1bGUsIHBlcm1pc3Npb25zKSkiLAogICk7CiAgcmV0dXJuIGNv
bnRlbnQ7Cn0pOwoKCnBhdGNoKCJjb21wb25lbnRzL3BhaW5lbC9QYW5lbFByZW1pdW1TaGVsbC50c3giLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBh
ZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHR5cGUgeyBSZWFjdE5vZGUgfSBmcm9tICdyZWFjdCdcbiIsCiAgICAiaW1wb3J0IHR5
cGUgeyBQYW5lbEFjY2Vzc1Blcm1pc3Npb25zIH0gZnJvbSAnQC9saWIvcGFuZWwtbW9kdWxlcyciLAogICAgInBhbmVsIHNoZWxsIHBlcm1pc3Npb25zIHR5
cGUiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIHBhdGhuYW1lLAogIGNoaWxkcmVuLAp9OiB7CiAgY29tcGFueTogUGFuZWxQ
cmVtaXVtQ29tcGFueQogIHBhdGhuYW1lOiBzdHJpbmcKICBjaGlsZHJlbjogUmVhY3ROb2RlCn0pIHtgLAogICAgYCAgcGF0aG5hbWUsCiAgcGVybWlzc2lv
bnMsCiAgY2hpbGRyZW4sCn06IHsKICBjb21wYW55OiBQYW5lbFByZW1pdW1Db21wYW55CiAgcGF0aG5hbWU6IHN0cmluZwogIHBlcm1pc3Npb25zPzogUGFu
ZWxBY2Nlc3NQZXJtaXNzaW9ucyB8IG51bGwKICBjaGlsZHJlbjogUmVhY3ROb2RlCn0pIHtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgICI8UGFuZWxTaWRlYmFyIGNvbXBhbnk9e2NvbXBhbnl9IC8+IiwKICAgICI8UGFuZWxTaWRlYmFyIGNvbXBhbnk9e2NvbXBhbnl9IHBlcm1pc3Npb25z
PXtwZXJtaXNzaW9uc30gLz4iLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9wYWluZWwvbGF5b3V0LnRzeCIsIChjb250ZW50KSA9
PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBnZXRDb21wYW55UHVibGljSG9zdCB9IGZyb20gJ0Av
bGliL2NvbXBhbnktdXJsJ1xuIiwKICAgICJpbXBvcnQgeyBmaW5kUGFuZWxNb2R1bGVCeVBhdGgsIHBhbmVsUGVybWlzc2lvbkFsbG93cywgcGFuZWxQbGFu
QWxsb3dzLCB0eXBlIFBhbmVsQWNjZXNzUGVybWlzc2lvbnMsIHR5cGUgUmVxdWlyZWRQbGFuIH0gZnJvbSAnQC9saWIvcGFuZWwtbW9kdWxlcyciLAogICAg
ImxheW91dCBwbGFuIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgcGVybWlzc2lvbnM/OiB7CiAgICBjYW5fc3Vi
c2NyaXB0aW9uPzogYm9vbGVhbgogIH1gLAogICAgYCAgcGVybWlzc2lvbnM/OiBQYW5lbEFjY2Vzc1Blcm1pc3Npb25zYCwKICApOwoKICBpZiAoIWNvbnRl
bnQuaW5jbHVkZXMoImZ1bmN0aW9uIFBhaW5lbFBsYW5vQmxvcXVlYWRvKCIpKSB7CiAgICBjb25zdCBtYXJrZXIgPSAiXG5leHBvcnQgZGVmYXVsdCBmdW5j
dGlvbiBQYWluZWxMYXlvdXQiOwogICAgY29uc3QgYmxvY2sgPSBgCmZ1bmN0aW9uIFBhaW5lbFBsYW5vQmxvcXVlYWRvKHsKICBtb2R1bGVMYWJlbCwKICBy
ZXF1aXJlZFBsYW4sCn06IHsKICBtb2R1bGVMYWJlbDogc3RyaW5nCiAgcmVxdWlyZWRQbGFuOiBSZXF1aXJlZFBsYW4KfSkgewogIGNvbnN0IHBsYW5vID0K
ICAgIHJlcXVpcmVkUGxhbiA9PT0gJ3ByZW1pdW0nCiAgICAgID8gJ1ByZW1pdW0nCiAgICAgIDogcmVxdWlyZWRQbGFuID09PSAnaW50ZXJtZWRpYXRlJwog
ICAgICAgID8gJ1Byb2Zpc3Npb25hbCcKICAgICAgICA6ICdFc3NlbmNpYWwnCgogIHJldHVybiAoCiAgICA8bWFpbiBjbGFzc05hbWU9ImdyaWQgbWluLWgt
WzcwdmhdIHBsYWNlLWl0ZW1zLWNlbnRlciBiZy1bI2Y4ZmJmZl0gcHgtNCBweS0xMCB0ZXh0LVsjMDcxYjNhXSI+CiAgICAgIDxzZWN0aW9uIGNsYXNzTmFt
ZT0idy1mdWxsIG1heC13LTJ4bCByb3VuZGVkLVsycmVtXSBib3JkZXIgYm9yZGVyLWJsdWUtMTAwIGJnLXdoaXRlIHAtNyB0ZXh0LWNlbnRlciBzaGFkb3ct
eGwgc2hhZG93LWJsdWUtOTUwLzggc206cC0xMCI+CiAgICAgICAgPHAgY2xhc3NOYW1lPSJ0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5n
LVswLjE4ZW1dIHRleHQtWyMxMzU5YTVdIj4KICAgICAgICAgIFJlY3Vyc28gZG8gcGxhbm8ge3BsYW5vfQogICAgICAgIDwvcD4KICAgICAgICA8aDEgY2xh
c3NOYW1lPSJtdC0zIHRleHQtM3hsIGZvbnQtYmxhY2sgdHJhY2tpbmctWy0wLjA0ZW1dIj4KICAgICAgICAgIHttb2R1bGVMYWJlbH0gbsOjbyBmYXogcGFy
dGUgZG8gc2V1IHBsYW5vIGF0dWFsLgogICAgICAgIDwvaDE+CiAgICAgICAgPHAgY2xhc3NOYW1lPSJteC1hdXRvIG10LTQgbWF4LXcteGwgZm9udC1ib2xk
IGxlYWRpbmctNyB0ZXh0LXNsYXRlLTUwMCI+CiAgICAgICAgICBTZXVzIGRhZG9zIHBlcm1hbmVjZW0gcHJlc2VydmFkb3MuIFBhcmEgdXNhciBlc3RlIHJl
Y3Vyc28sIGZhw6dhIG8gdXBncmFkZSBkYSBhc3NpbmF0dXJhLgogICAgICAgIDwvcD4KICAgICAgICA8TGluawogICAgICAgICAgaHJlZj0iL3BhaW5lbC9h
c3NpbmF0dXJhIgogICAgICAgICAgY2xhc3NOYW1lPSJtdC02IGlubGluZS1mbGV4IHJvdW5kZWQtMnhsIGJnLVsjMDUyNDVjXSBweC02IHB5LTQgZm9udC1i
bGFjayB0ZXh0LXdoaXRlIgogICAgICAgID4KICAgICAgICAgIFZlciBwbGFub3MgZSBmYXplciB1cGdyYWRlCiAgICAgICAgPC9MaW5rPgogICAgICA8L3Nl
Y3Rpb24+CiAgICA8L21haW4+CiAgKQp9CmA7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KGNvbnRlbnQsIG1hcmtlciwgYCR7YmxvY2t9JHttYXJr
ZXJ9YCwgImxheW91dCBwbGFubyBibG9xdWVhZG8iKTsKICB9CgogIGlmICghY29udGVudC5pbmNsdWRlcygiZnVuY3Rpb24gUGFpbmVsUGVybWlzc2FvQmxv
cXVlYWRhKCIpKSB7CiAgICBjb25zdCBtYXJrZXIgPSAiXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBQYWluZWxMYXlvdXQiOwogICAgY29uc3QgYmxvY2sg
PSBgCmZ1bmN0aW9uIFBhaW5lbFBlcm1pc3Nhb0Jsb3F1ZWFkYSh7IG1vZHVsZUxhYmVsIH06IHsgbW9kdWxlTGFiZWw6IHN0cmluZyB9KSB7CiAgcmV0dXJu
ICgKICAgIDxtYWluIGNsYXNzTmFtZT0iZ3JpZCBtaW4taC1bNzB2aF0gcGxhY2UtaXRlbXMtY2VudGVyIGJnLVsjZjhmYmZmXSBweC00IHB5LTEwIHRleHQt
WyMwNzFiM2FdIj4KICAgICAgPHNlY3Rpb24gY2xhc3NOYW1lPSJ3LWZ1bGwgbWF4LXctMnhsIHJvdW5kZWQtWzJyZW1dIGJvcmRlciBib3JkZXItYmx1ZS0x
MDAgYmctd2hpdGUgcC03IHRleHQtY2VudGVyIHNoYWRvdy14bCBzaGFkb3ctYmx1ZS05NTAvOCBzbTpwLTEwIj4KICAgICAgICA8cCBjbGFzc05hbWU9InRl
eHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMThlbV0gdGV4dC1bIzEzNTlhNV0iPgogICAgICAgICAgUGVybWlzc8OjbyBuZWNlc3PD
oXJpYQogICAgICAgIDwvcD4KICAgICAgICA8aDEgY2xhc3NOYW1lPSJtdC0zIHRleHQtM3hsIGZvbnQtYmxhY2sgdHJhY2tpbmctWy0wLjA0ZW1dIj4KICAg
ICAgICAgIFNldSBwZXJmaWwgbsOjbyBwb2RlIGFjZXNzYXIge21vZHVsZUxhYmVsfS4KICAgICAgICA8L2gxPgogICAgICAgIDxwIGNsYXNzTmFtZT0ibXgt
YXV0byBtdC00IG1heC13LXhsIGZvbnQtYm9sZCBsZWFkaW5nLTcgdGV4dC1zbGF0ZS01MDAiPgogICAgICAgICAgUGXDp2EgYW8gZG9ubyBvdSBnZXJlbnRl
IGRhIGVtcHJlc2EgcGFyYSByZXZpc2FyIHNldSBjYXJnbyBlIHBlcm1pc3PDtWVzLgogICAgICAgIDwvcD4KICAgICAgICA8TGluawogICAgICAgICAgaHJl
Zj0iL3BhaW5lbC9pbmljaW8iCiAgICAgICAgICBjbGFzc05hbWU9Im10LTYgaW5saW5lLWZsZXggcm91bmRlZC0yeGwgYmctWyMwNTI0NWNdIHB4LTYgcHkt
NCBmb250LWJsYWNrIHRleHQtd2hpdGUiCiAgICAgICAgPgogICAgICAgICAgVm9sdGFyIMOgIHZpc8OjbyBnZXJhbAogICAgICAgIDwvTGluaz4KICAgICAg
PC9zZWN0aW9uPgogICAgPC9tYWluPgogICkKfQpgOwogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBtYXJrZXIsIGAke2Jsb2NrfSR7
bWFya2VyfWAsICJsYXlvdXQgcGVybWlzc2FvIGJsb3F1ZWFkYSIpOwogIH0KCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBjdXJyZW50TW9kdWxl
ID0gZmluZFBhbmVsTW9kdWxlQnlQYXRoKHBhdGhuYW1lKSIpKSB7CiAgICBjb25zdCBvbGQgPSBgICBpZiAocGF5bG9hZC5hc3NpbmF0dXJhX2F0aXZhICE9
PSB0cnVlICYmIHBhdGhuYW1lICE9PSAnL3BhaW5lbC9hc3NpbmF0dXJhJykgewogICAgcmV0dXJuIDxQYWluZWxCbG9xdWVhZG8gcGF5bG9hZD17cGF5bG9h
ZH0gLz4KICB9CgogIHJldHVybiAoCmA7CiAgICBjb25zdCBuZXUgPSBgICBpZiAocGF5bG9hZC5hc3NpbmF0dXJhX2F0aXZhICE9PSB0cnVlICYmIHBhdGhu
YW1lICE9PSAnL3BhaW5lbC9hc3NpbmF0dXJhJykgewogICAgcmV0dXJuIDxQYWluZWxCbG9xdWVhZG8gcGF5bG9hZD17cGF5bG9hZH0gLz4KICB9CgogIGNv
bnN0IGN1cnJlbnRNb2R1bGUgPSBmaW5kUGFuZWxNb2R1bGVCeVBhdGgocGF0aG5hbWUpCiAgY29uc3QgY3VycmVudFBsYW4gPQogICAgcGF5bG9hZC5jb21w
YW55LmFzc2luYXR1cmFfcGxhbm8gfHwgcGF5bG9hZC5jb21wYW55LnBsYW5vCgogIGlmICgKICAgIGN1cnJlbnRNb2R1bGUgJiYKICAgICFwYW5lbFBsYW5B
bGxvd3MoY3VycmVudE1vZHVsZS5yZXF1aXJlZFBsYW4sIGN1cnJlbnRQbGFuKSAmJgogICAgcGF0aG5hbWUgIT09ICcvcGFpbmVsL2Fzc2luYXR1cmEnCiAg
KSB7CiAgICByZXR1cm4gKAogICAgICA8UGFpbmVsUGxhbm9CbG9xdWVhZG8KICAgICAgICBtb2R1bGVMYWJlbD17Y3VycmVudE1vZHVsZS5sYWJlbH0KICAg
ICAgICByZXF1aXJlZFBsYW49e2N1cnJlbnRNb2R1bGUucmVxdWlyZWRQbGFufQogICAgICAvPgogICAgKQogIH0KCiAgaWYgKAogICAgY3VycmVudE1vZHVs
ZSAmJgogICAgIXBhbmVsUGVybWlzc2lvbkFsbG93cyhjdXJyZW50TW9kdWxlLCBwYXlsb2FkLnBlcm1pc3Npb25zKSAmJgogICAgcGF0aG5hbWUgIT09ICcv
cGFpbmVsL2Fzc2luYXR1cmEnCiAgKSB7CiAgICByZXR1cm4gPFBhaW5lbFBlcm1pc3Nhb0Jsb3F1ZWFkYSBtb2R1bGVMYWJlbD17Y3VycmVudE1vZHVsZS5s
YWJlbH0gLz4KICB9CgogIHJldHVybiAoCmA7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KGNvbnRlbnQsIG9sZCwgbmV1LCAibGF5b3V0IHBsYW4g
Z2F0ZSIpOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgovLyA0KSBDYXTDoWxvZ28gY2Fuw7RuaWNvIGRhIEFjYWRlbWlhIGNvbXBhcnRpbGhhZG8gZW50
cmUgY2xpZW50ZSBlIHNlcnZpZG9yCnBhdGNoKCJjb21wb25lbnRzL3BhcmNlaXJvcy9QYXJ0bmVyQ291cnNlc1RhYi50c3giLCAoY29udGVudCkgPT4gewog
IGlmIChjb250ZW50LmluY2x1ZGVzKCJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyIpKSByZXR1cm4gY29udGVudDsKCiAgY29uc3QgdHlwZVN0
YXJ0ID0gY29udGVudC5pbmRleE9mKCJ0eXBlIExlc3NvbiA9IHsiKTsKICBjb25zdCBzdG9yYWdlU3RhcnQgPSBjb250ZW50LmluZGV4T2YoJ2NvbnN0IFNU
T1JBR0VfS0VZID0gIm9yY2FseS1wYXJ0bmVyLWFjYWRlbXktdjIiOycpOwogIGNvbnN0IGNvdXJzZVN0YXJ0ID0gY29udGVudC5pbmRleE9mKCJjb25zdCBj
b3Vyc2VzOiBDb3Vyc2VbXSA9IFsiKTsKICBjb25zdCBmdW5jdGlvblN0YXJ0ID0gY29udGVudC5pbmRleE9mKCJcblxuZnVuY3Rpb24gYWxsTGVzc29uSWRz
KGNvdXJzZTogQ291cnNlKSIpOwoKICBpZiAoW3R5cGVTdGFydCwgc3RvcmFnZVN0YXJ0LCBjb3Vyc2VTdGFydCwgZnVuY3Rpb25TdGFydF0uc29tZSgodmFs
dWUpID0+IHZhbHVlIDwgMCkpIHsKICAgIHRocm93IG5ldyBFcnJvcigiTsOjbyBmb2kgcG9zc8OtdmVsIGxvY2FsaXphciBibG9jb3MgZGEgQWNhZGVtaWEg
cGFyYSBleHRyYcOnw6NvIik7CiAgfQoKICBjb25zdCB0eXBlc0Jsb2NrID0gY29udGVudC5zbGljZSh0eXBlU3RhcnQsIHN0b3JhZ2VTdGFydCk7CiAgY29u
c3QgY291cnNlQmxvY2sgPSBjb250ZW50LnNsaWNlKGNvdXJzZVN0YXJ0LCBmdW5jdGlvblN0YXJ0KTsKICBjb25zdCBzaGFyZWQgPSBgJHt0eXBlc0Jsb2Nr
CiAgICAucmVwbGFjZSgidHlwZSBMZXNzb24gPSB7IiwgImV4cG9ydCB0eXBlIExlc3NvbiA9IHsiKQogICAgLnJlcGxhY2UoInR5cGUgQ291cnNlID0geyIs
ICJleHBvcnQgdHlwZSBDb3Vyc2UgPSB7Iil9CiR7Y291cnNlQmxvY2sucmVwbGFjZSgiY29uc3QgY291cnNlczogQ291cnNlW10gPSIsICJleHBvcnQgY29u
c3QgY291cnNlczogQ291cnNlW10gPSIpfQoKZXhwb3J0IGZ1bmN0aW9uIGdldENvdXJzZUJ5SWQoY291cnNlSWQ6IHN0cmluZykgewogIHJldHVybiBjb3Vy
c2VzLmZpbmQoKGNvdXJzZSkgPT4gY291cnNlLmlkID09PSBjb3Vyc2VJZCkgfHwgbnVsbDsKfQoKZXhwb3J0IGZ1bmN0aW9uIGdldENvdXJzZUxlc3Nvbklk
cyhjb3Vyc2VJZDogc3RyaW5nKSB7CiAgcmV0dXJuIGdldENvdXJzZUJ5SWQoY291cnNlSWQpPy5sZXNzb25zLm1hcCgobGVzc29uKSA9PiBsZXNzb24uaWQp
IHx8IFtdOwp9CgpleHBvcnQgZnVuY3Rpb24gaXNWYWxpZENvdXJzZUxlc3Nvbihjb3Vyc2VJZDogc3RyaW5nLCBsZXNzb25JZDogc3RyaW5nKSB7CiAgcmV0
dXJuIGdldENvdXJzZUxlc3Nvbklkcyhjb3Vyc2VJZCkuaW5jbHVkZXMobGVzc29uSWQpOwp9CmA7CiAgY3JlYXRlT3JSZXBsYWNlKCJsaWIvYWZmaWxpYXRl
cy9hY2FkZW15LWNhdGFsb2cudHMiLCBzaGFyZWQpOwoKICBjb250ZW50ID0gY29udGVudC5zbGljZSgwLCB0eXBlU3RhcnQpICsgY29udGVudC5zbGljZShz
dG9yYWdlU3RhcnQsIGNvdXJzZVN0YXJ0KSArIGNvbnRlbnQuc2xpY2UoZnVuY3Rpb25TdGFydCk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAg
Y29udGVudCwKICAgICdpbXBvcnQgeyBzdXBhYmFzZSB9IGZyb20gIkAvbGliL3N1cGFiYXNlIjtcbicsCiAgICAnaW1wb3J0IHsgY291cnNlcywgdHlwZSBD
b3Vyc2UgfSBmcm9tICJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyI7JywKICAgICJhY2FkZW15IHNoYXJlZCBpbXBvcnQiLAogICk7CgogIGNv
bnN0IG9sZFJlbW90ZSA9IGAgICAgICAgICAgY29uc3QgcmVtb3RlSWRzID0gKHBheWxvYWQuY291cnNlUHJvZ3Jlc3MgfHwgW10pCiAgICAgICAgICAgIC5t
YXAoKHJvdykgPT4gU3RyaW5nKHJvdy5sZXNzb25faWQgfHwgIiIpKQogICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pOwoKICAgICAgICAgIGlmIChyZW1v
dGVJZHMubGVuZ3RoKSB7CiAgICAgICAgICAgIHNldENvbXBsZXRlZExlc3NvbnMoKGN1cnJlbnQpID0+IHsKICAgICAgICAgICAgICByZXR1cm4gbmV3IFNl
dChbLi4uY3VycmVudCwgLi4ucmVtb3RlSWRzXSk7CiAgICAgICAgICAgIH0pOwogICAgICAgICAgfWA7CiAgY29uc3QgbmV3UmVtb3RlID0gYCAgICAgICAg
ICBjb25zdCByZW1vdGVJZHMgPSAocGF5bG9hZC5jb3Vyc2VQcm9ncmVzcyB8fCBbXSkKICAgICAgICAgICAgLm1hcCgocm93KSA9PiBTdHJpbmcocm93Lmxl
c3Nvbl9pZCB8fCAiIikpCiAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbik7CgogICAgICAgICAgLy8gQXV0ZW50aWNhZG86IG8gc2Vydmlkb3Igw6kgYSBm
b250ZSBkZSB2ZXJkYWRlLgogICAgICAgICAgc2V0Q29tcGxldGVkTGVzc29ucyhuZXcgU2V0KHJlbW90ZUlkcykpO2A7CiAgY29udGVudCA9IHJlcGxhY2VP
bmNlVGV4dChjb250ZW50LCBvbGRSZW1vdGUsIG5ld1JlbW90ZSwgImFjYWRlbXkgcmVtb3RlIHNvdXJjZSBvZiB0cnV0aCIpOwoKICByZXR1cm4gY29udGVu
dDsKfSk7CgovLyA1KSBDZW50cmFsIGRlIFBhcmNlaXJvczogdmFsaWRhw6fDtWVzIHNlcnZlci1zaWRlIGUgWFAgaWRlbXBvdGVudGUKcGF0Y2goImxpYi9h
ZmZpbGlhdGVzL3dvcmtzcGFjZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJ9IGZy
b20gXCJAL2xpYi9hZmZpbGlhdGVzL3NlcnZlclwiO1xuIiwKICAgICdpbXBvcnQgeyBnZXRDb3Vyc2VMZXNzb25JZHMsIGlzVmFsaWRDb3Vyc2VMZXNzb24g
fSBmcm9tICJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyI7JywKICAgICJ3b3Jrc3BhY2UgYWNhZGVteSBpbXBvcnQiLAogICk7CiAgY29udGVu
dCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBnZXRDb3Vyc2VMZXNzb25JZHMsIGlzVmFsaWRDb3Vyc2VMZXNzb24gfSBm
cm9tICJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyI7XG4nLAogICAgJ2ltcG9ydCB7IHBhcnRuZXJUcmFpbmVyU2NlbmFyaW9zIH0gZnJvbSAi
QC9jb21wb25lbnRzL3BhcmNlaXJvcy9wYXJ0bmVyLWdyb3d0aC1jb250ZW50IjsnLAogICAgIndvcmtzcGFjZSB0cmFpbmVyIGltcG9ydCIsCiAgKTsKCiAg
Ly8gVmFsaWRhIHByb2dyZXNzbyBoaXN0w7NyaWNvIHRhbWLDqW0uCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCB2YWxpZFByb2dyZXNzID0gcHJv
Z3Jlc3MuZmlsdGVyIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGBmdW5jdGlvbiBjZXJ0aWZpY2F0
aW9uRWxpZ2liaWxpdHkoCiAgZXhhbTogQ2VydGlmaWNhdGlvbkV4YW0sCiAgcHJvZ3Jlc3M6IEFycmF5PHsgY291cnNlX2lkPzogc3RyaW5nIHwgbnVsbDsg
bGVzc29uX2lkPzogc3RyaW5nIHwgbnVsbCB9PiwKKSB7CiAgaWYgKGV4YW0ucHJlcmVxdWlzaXRlLnR5cGUgPT09ICJsZXNzb25zIikgewogICAgcmV0dXJu
IHByb2dyZXNzLmxlbmd0aCA+PSBleGFtLnByZXJlcXVpc2l0ZS5taW5pbXVtOwogIH0KCiAgY29uc3QgYWxsb3dlZCA9IG5ldyBTZXQoZXhhbS5wcmVyZXF1
aXNpdGUuY291cnNlSWRzIHx8IFtdKTsKICBjb25zdCBjb21wbGV0ZWQgPSBwcm9ncmVzcy5maWx0ZXIoKHJvdykgPT4KICAgIGFsbG93ZWQuaGFzKFN0cmlu
Zyhyb3cuY291cnNlX2lkIHx8ICIiKSksCiAgKS5sZW5ndGg7CmAsCiAgICAgIGBmdW5jdGlvbiBjZXJ0aWZpY2F0aW9uRWxpZ2liaWxpdHkoCiAgZXhhbTog
Q2VydGlmaWNhdGlvbkV4YW0sCiAgcHJvZ3Jlc3M6IEFycmF5PHsgY291cnNlX2lkPzogc3RyaW5nIHwgbnVsbDsgbGVzc29uX2lkPzogc3RyaW5nIHwgbnVs
bCB9PiwKKSB7CiAgY29uc3QgdmFsaWRQcm9ncmVzcyA9IHByb2dyZXNzLmZpbHRlcigocm93KSA9PgogICAgaXNWYWxpZENvdXJzZUxlc3NvbigKICAgICAg
U3RyaW5nKHJvdy5jb3Vyc2VfaWQgfHwgIiIpLAogICAgICBTdHJpbmcocm93Lmxlc3Nvbl9pZCB8fCAiIiksCiAgICApLAogICk7CgogIGlmIChleGFtLnBy
ZXJlcXVpc2l0ZS50eXBlID09PSAibGVzc29ucyIpIHsKICAgIHJldHVybiB2YWxpZFByb2dyZXNzLmxlbmd0aCA+PSBleGFtLnByZXJlcXVpc2l0ZS5taW5p
bXVtOwogIH0KCiAgY29uc3QgYWxsb3dlZCA9IG5ldyBTZXQoZXhhbS5wcmVyZXF1aXNpdGUuY291cnNlSWRzIHx8IFtdKTsKICBjb25zdCBjb21wbGV0ZWQg
PSB2YWxpZFByb2dyZXNzLmZpbHRlcigocm93KSA9PgogICAgYWxsb3dlZC5oYXMoU3RyaW5nKHJvdy5jb3Vyc2VfaWQgfHwgIiIpKSwKICApLmxlbmd0aDsK
YCwKICAgICAgImNhbm9uaWNhbCBjZXJ0aWZpY2F0aW9uIHByb2dyZXNzIiwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoInNvdXJjZUtl
eT86IHN0cmluZzsiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgb3B0aW9uczogewogICAgbGVh
ZElkPzogc3RyaW5nIHwgbnVsbDsKICAgIG1ldGFkYXRhPzogSnNvblJlY29yZDsKICAgIHhwPzogbnVtYmVyOwogIH0gPSB7fSwKKSB7YCwKICAgICAgYCAg
b3B0aW9uczogewogICAgbGVhZElkPzogc3RyaW5nIHwgbnVsbDsKICAgIG1ldGFkYXRhPzogSnNvblJlY29yZDsKICAgIHhwPzogbnVtYmVyOwogICAgc291
cmNlS2V5Pzogc3RyaW5nOwogIH0gPSB7fSwKKSB7YCwKICAgICAgImluc2VydEV2ZW50IHNvdXJjZUtleSBvcHRpb24iLAogICAgKTsKICB9CgogIGlmICgh
Y29udGVudC5pbmNsdWRlcygnbWV0YWRhdGE6IGV2ZW50TWV0YWRhdGEnKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVu
dCwKICAgICAgYCAgY29uc3QgeyBlcnJvciB9ID0gYXdhaXQgYWRtaW4uZnJvbSgiYWZmaWxpYXRlX2FjdGl2aXR5X2V2ZW50cyIpLmluc2VydCh7CiAgICBh
ZmZpbGlhdGVfaWQ6IGFmZmlsaWF0ZUlkLAogICAgbGVhZF9pZDogb3B0aW9ucy5sZWFkSWQgfHwgbnVsbCwKICAgIGtpbmQsCiAgICB4cCwKICAgIG1ldGFk
YXRhOiBvcHRpb25zLm1ldGFkYXRhIHx8IHt9LAogIH0pOwoKICBpZiAoZXJyb3IpIHRocm93IGVycm9yO2AsCiAgICAgIGAgIGNvbnN0IGV2ZW50TWV0YWRh
dGEgPSB7CiAgICAuLi4ob3B0aW9ucy5tZXRhZGF0YSB8fCB7fSksCiAgICAuLi4ob3B0aW9ucy5zb3VyY2VLZXkgPyB7IHNvdXJjZV9rZXk6IG9wdGlvbnMu
c291cmNlS2V5IH0gOiB7fSksCiAgfTsKCiAgaWYgKG9wdGlvbnMuc291cmNlS2V5KSB7CiAgICBjb25zdCB7IGRhdGE6IGV4aXN0aW5nLCBlcnJvcjogbG9v
a3VwRXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJhZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzIikKICAgICAgLnNlbGVjdCgiaWQiKQogICAg
ICAuZXEoImFmZmlsaWF0ZV9pZCIsIGFmZmlsaWF0ZUlkKQogICAgICAuZXEoIm1ldGFkYXRhLT4+c291cmNlX2tleSIsIG9wdGlvbnMuc291cmNlS2V5KQog
ICAgICAubGltaXQoMSkKICAgICAgLm1heWJlU2luZ2xlKCk7CgogICAgaWYgKGxvb2t1cEVycm9yKSB0aHJvdyBsb29rdXBFcnJvcjsKICAgIGlmIChleGlz
dGluZz8uaWQpIHJldHVybjsKICB9CgogIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFkbWluLmZyb20oImFmZmlsaWF0ZV9hY3Rpdml0eV9ldmVudHMiKS5p
bnNlcnQoewogICAgYWZmaWxpYXRlX2lkOiBhZmZpbGlhdGVJZCwKICAgIGxlYWRfaWQ6IG9wdGlvbnMubGVhZElkIHx8IG51bGwsCiAgICBraW5kLAogICAg
eHAsCiAgICBtZXRhZGF0YTogZXZlbnRNZXRhZGF0YSwKICB9KTsKCiAgaWYgKGVycm9yKSB7CiAgICBjb25zdCBtZXNzYWdlID0gU3RyaW5nKGVycm9yLm1l
c3NhZ2UgfHwgIiIpLnRvTG93ZXJDYXNlKCk7CiAgICBpZiAob3B0aW9ucy5zb3VyY2VLZXkgJiYgKG1lc3NhZ2UuaW5jbHVkZXMoImR1cGxpY2F0ZSIpIHx8
IG1lc3NhZ2UuaW5jbHVkZXMoInVuaXF1ZSIpKSkgewogICAgICByZXR1cm47CiAgICB9CiAgICB0aHJvdyBlcnJvcjsKICB9YCwKICAgICAgImluc2VydEV2
ZW50IGlkZW1wb3RlbmN5IiwKICAgICk7CiAgfQoKICAvLyBNYXNjYXJhIG5vbWVzIG5vcyByYW5raW5ncy4KICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImZ1
bmN0aW9uIGxlYWRlcmJvYXJkTmFtZSgiKSkgewogICAgY29uc3QgbWFya2VyID0gIlxuYXN5bmMgZnVuY3Rpb24gYnVpbGRMZWFkZXJib2FyZHMoYWRtaW46
IEFkbWluQ2xpZW50KSI7CiAgICBjb25zdCBoZWxwZXIgPSBgCmZ1bmN0aW9uIGxlYWRlcmJvYXJkTmFtZSh2YWx1ZTogdW5rbm93bikgewogIGNvbnN0IHBh
cnRzID0gY2xlYW5UZXh0KHZhbHVlLCAxMjApLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJvb2xlYW4pOwogIGlmICghcGFydHMubGVuZ3RoKSByZXR1cm4gIlBh
cmNlaXJvIjsKICBpZiAocGFydHMubGVuZ3RoID09PSAxKSByZXR1cm4gcGFydHNbMF07CiAgcmV0dXJuIFxgXCR7cGFydHNbMF19IFwke3BhcnRzWzFdWzBd
IHx8ICIifSoqKlxgLnRyaW0oKTsKfQpgOwogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBtYXJrZXIsIGAke2hlbHBlcn0ke21hcmtl
cn1gLCAibGVhZGVyYm9hcmQgbWFzayBoZWxwZXIiKTsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICdTdHJpbmcocm93Lm5hbWUgfHwg
IlBhcmNlaXJvIiksJywKICAgICAgJ2xlYWRlcmJvYXJkTmFtZShyb3cubmFtZSksJywKICAgICk7CiAgfQoKICAvLyBMZWFkIGNyaWFkbzogWFAgdW1hIHZl
ei4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJtYW51YWwiLCB7
CiAgICAgIGxlYWRJZDogU3RyaW5nKGRhdGEuaWQpLAogICAgICBtZXRhZGF0YTogeyBldmVudDogImxlYWRfY3JlYXRlZCIgfSwKICAgICAgeHA6IDUsCiAg
ICB9KTtgLAogICAgYCAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJtYW51YWwiLCB7CiAgICAgIGxlYWRJZDogU3RyaW5nKGRh
dGEuaWQpLAogICAgICBtZXRhZGF0YTogeyBldmVudDogImxlYWRfY3JlYXRlZCIgfSwKICAgICAgeHA6IDUsCiAgICAgIHNvdXJjZUtleTogXGBsZWFkOlwk
e2RhdGEuaWR9OmNyZWF0ZWRcYCwKICAgIH0pO2AsCiAgKTsKCiAgLy8gTWlsZXN0b25lIGRvIGxlYWQ6IFhQIHVtYSB2ZXogcG9yIHN0YXR1cy4KICBjb250
ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgYXdhaXQgaW5zZXJ0RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCBraW5kLCB7CiAgICAgICAg
ICBsZWFkSWQsCiAgICAgICAgICBtZXRhZGF0YTogewogICAgICAgICAgICBmcm9tOiBjdXJyZW50LnN0YXR1cywKICAgICAgICAgICAgdG86IHN0YXR1cywK
ICAgICAgICAgIH0sCiAgICAgICAgfSk7YCwKICAgIGAgICAgICAgIGF3YWl0IGluc2VydEV2ZW50KGFkbWluLCBhZmZpbGlhdGVJZCwga2luZCwgewogICAg
ICAgICAgbGVhZElkLAogICAgICAgICAgbWV0YWRhdGE6IHsKICAgICAgICAgICAgZnJvbTogY3VycmVudC5zdGF0dXMsCiAgICAgICAgICAgIHRvOiBzdGF0
dXMsCiAgICAgICAgICB9LAogICAgICAgICAgc291cmNlS2V5OiBcYGxlYWQ6XCR7bGVhZElkfTpzdGF0dXM6XCR7a2luZH1cYCwKICAgICAgICB9KTtgLAog
ICk7CgogIC8vIFRhcmVmYTogWFAgdW1hIHZleiBwb3IgdGFyZWZhLgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgYXdhaXQgaW5z
ZXJ0RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAidGFzayIsIHsKICAgICAgICBsZWFkSWQ6IGRhdGEubGVhZF9pZCA/IFN0cmluZyhkYXRhLmxlYWRfaWQp
IDogbnVsbCwKICAgICAgICBtZXRhZGF0YTogeyB0YXNrSWQgfSwKICAgICAgfSk7YCwKICAgIGAgICAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZm
aWxpYXRlSWQsICJ0YXNrIiwgewogICAgICAgIGxlYWRJZDogZGF0YS5sZWFkX2lkID8gU3RyaW5nKGRhdGEubGVhZF9pZCkgOiBudWxsLAogICAgICAgIG1l
dGFkYXRhOiB7IHRhc2tJZCB9LAogICAgICAgIHNvdXJjZUtleTogXGB0YXNrOlwke3Rhc2tJZH06Y29tcGxldGVkXGAsCiAgICAgIH0pO2AsCiAgKTsKCiAg
Ly8gQXRpdmlkYWRlcyBtYW51YWlzIGNvbnRhbSBwYXJhIG3DqXRyaWNhcywgbWFzIG7Do28gZMOjbyBYUC4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNl
KAogICAgYCAgICAgICAgbWV0YWRhdGE6IHsKICAgICAgICAgIG5vdGU6IG9wdGlvbmFsVGV4dChib2R5Lm5vdGUsIDUwMCksCiAgICAgICAgICBzb3VyY2U6
ICJtYW51YWwiLAogICAgICAgIH0sCiAgICAgIH0sYCwKICAgIGAgICAgICAgIG1ldGFkYXRhOiB7CiAgICAgICAgICBub3RlOiBvcHRpb25hbFRleHQoYm9k
eS5ub3RlLCA1MDApLAogICAgICAgICAgc291cmNlOiAibWFudWFsIiwKICAgICAgICB9LAogICAgICAgIHhwOiAwLAogICAgICB9LGAsCiAgKTsKCiAgLy8g
Q29tcGxldGUgbGVzc29uOiB2YWxpZGEgY2F0w6Fsb2dvLgogIGlmICghY29udGVudC5pbmNsdWRlcygnaWYgKCFpc1ZhbGlkQ291cnNlTGVzc29uKGNvdXJz
ZUlkLCBsZXNzb25JZCkpJykpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgaWYgKCFjb3Vyc2VJ
ZCB8fCAhbGVzc29uSWQpIHsKICAgICAgdGhyb3cgbmV3IEFmZmlsaWF0ZUVycm9yKCJBdWxhIGludsOhbGlkYS4iKTsKICAgIH0KYCwKICAgICAgYCAgICBp
ZiAoIWNvdXJzZUlkIHx8ICFsZXNzb25JZCB8fCAhaXNWYWxpZENvdXJzZUxlc3Nvbihjb3Vyc2VJZCwgbGVzc29uSWQpKSB7CiAgICAgIHRocm93IG5ldyBB
ZmZpbGlhdGVFcnJvcigiQXVsYSBpbnbDoWxpZGEuIik7CiAgICB9CmAsCiAgICAgICJjb21wbGV0ZSBsZXNzb24gdmFsaWRhdGlvbiIsCiAgICApOwogIH0K
ICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgIGF3YWl0IGluc2VydEV2ZW50KGFkbWluLCBhZmZpbGlhdGVJZCwgImxlc3NvbiIsIHsK
ICAgICAgICBtZXRhZGF0YTogeyBjb3Vyc2VJZCwgbGVzc29uSWQgfSwKICAgICAgfSk7YCwKICAgIGAgICAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwg
YWZmaWxpYXRlSWQsICJsZXNzb24iLCB7CiAgICAgICAgbWV0YWRhdGE6IHsgY291cnNlSWQsIGxlc3NvbklkIH0sCiAgICAgICAgc291cmNlS2V5OiBcYGxl
c3NvbjpcJHtjb3Vyc2VJZH06XCR7bGVzc29uSWR9XGAsCiAgICAgIH0pO2AsCiAgKTsKCiAgLy8gVW5jb21wbGV0ZSBsZXNzb24gdGFtYsOpbSBzw7MgcGFy
YSBhdWxhIGNvbmhlY2lkYS4KICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ2lmICghaXNWYWxpZENvdXJzZUxlc3Nvbihjb3Vyc2VJZCwgbGVzc29uSWQpKSB7
XG4gICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIkF1bGEgaW52w6FsaWRhLiIpO1xuICAgIH1cblxuICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0
IGFkbWluXG4gICAgICAuZnJvbSgiYWZmaWxpYXRlX2NvdXJzZV9wcm9ncmVzcyIpXG4gICAgICAuZGVsZXRlKCknKSkgewogICAgY29udGVudCA9IHJlcGxh
Y2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgICBjb25zdCBjb3Vyc2VJZCA9IGNsZWFuVGV4dChib2R5LmNvdXJzZUlkLCA4MCk7CiAgICBj
b25zdCBsZXNzb25JZCA9IGNsZWFuVGV4dChib2R5Lmxlc3NvbklkLCAxMjApOwoKICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5m
cm9tKCJhZmZpbGlhdGVfY291cnNlX3Byb2dyZXNzIikKICAgICAgLmRlbGV0ZSgpYCwKICAgICAgYCAgICBjb25zdCBjb3Vyc2VJZCA9IGNsZWFuVGV4dChi
b2R5LmNvdXJzZUlkLCA4MCk7CiAgICBjb25zdCBsZXNzb25JZCA9IGNsZWFuVGV4dChib2R5Lmxlc3NvbklkLCAxMjApOwoKICAgIGlmICghaXNWYWxpZENv
dXJzZUxlc3Nvbihjb3Vyc2VJZCwgbGVzc29uSWQpKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigiQXVsYSBpbnbDoWxpZGEuIik7CiAgICB9
CgogICAgY29uc3QgeyBlcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgICAgLmZyb20oImFmZmlsaWF0ZV9jb3Vyc2VfcHJvZ3Jlc3MiKQogICAgICAuZGVsZXRl
KClgLAogICAgICAidW5jb21wbGV0ZSBsZXNzb24gdmFsaWRhdGlvbiIsCiAgICApOwogIH0KCiAgLy8gV2hvbGUgY291cnNlOiBzZXJ2aWRvciBkZXJpdmEg
SURzLgogIGNvbnRlbnQgPSByZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAgIC8gIGlmIFwoYWN0aW9uID09PSAic2V0X2NvdXJzZV9sZXNzb25z
IlwpIFx7XG4gICAgY29uc3QgY291cnNlSWQgPSBjbGVhblRleHRcKGJvZHlcLmNvdXJzZUlkLCA4MFwpO1xuICAgIGNvbnN0IGxlc3NvbklkcyA9IEFycmF5
XC5pc0FycmF5XChib2R5XC5sZXNzb25JZHNcKVtcc1xTXSo/ICAgIGNvbnN0IGNvbXBsZXRlID0gYm9keVwuY29tcGxldGUgPT09IHRydWU7LywKICAgIGAg
IGlmIChhY3Rpb24gPT09ICJzZXRfY291cnNlX2xlc3NvbnMiKSB7CiAgICBjb25zdCBjb3Vyc2VJZCA9IGNsZWFuVGV4dChib2R5LmNvdXJzZUlkLCA4MCk7
CiAgICBjb25zdCBsZXNzb25JZHMgPSBnZXRDb3Vyc2VMZXNzb25JZHMoY291cnNlSWQpOwogICAgY29uc3QgY29tcGxldGUgPSBib2R5LmNvbXBsZXRlID09
PSB0cnVlO2AsCiAgICAic2V0X2NvdXJzZV9sZXNzb25zIGNhbm9uaWNhbCBJRHMiLAogICk7CiAgLy8gc291cmNlS2V5IG5vIGxvb3AgZGUgd2hvbGUgY291
cnNlLgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJsZXNz
b24iLCB7CiAgICAgICAgICBtZXRhZGF0YTogeyBjb3Vyc2VJZCwgbGVzc29uSWQgfSwKICAgICAgICB9KTtgLAogICAgYCAgICAgICAgYXdhaXQgaW5zZXJ0
RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAibGVzc29uIiwgewogICAgICAgICAgbWV0YWRhdGE6IHsgY291cnNlSWQsIGxlc3NvbklkIH0sCiAgICAgICAg
ICBzb3VyY2VLZXk6IFxgbGVzc29uOlwke2NvdXJzZUlkfTpcJHtsZXNzb25JZH1cYCwKICAgICAgICB9KTtgLAogICk7CgogIC8vIFRyZWluYW1lbnRvOiBj
bGllbnRlIGVudmlhIHPDsyBjZW7DoXJpbyArIGVzY29saGE7IHNlcnZpZG9yIGNhbGN1bGEgdHVkby4KICBjb250ZW50ID0gcmVwbGFjZU9uY2VSZWdleCgK
ICAgIGNvbnRlbnQsCiAgICAvICBpZiBcKGFjdGlvbiA9PT0gInNhdmVfdHJhaW5pbmciXCkgXHtbXHNcU10qPyAgICByZXR1cm4gXHsgbWVzc2FnZTogIlRy
ZWluYW1lbnRvIHJlZ2lzdHJhZG9cLiIsIHRyYWluaW5nOiBkYXRhIFx9O1xuICBcfS8sCiAgICBgICBpZiAoYWN0aW9uID09PSAic2F2ZV90cmFpbmluZyIp
IHsKICAgIGNvbnN0IHNjZW5hcmlvSWQgPSBjbGVhblRleHQoYm9keS5zY2VuYXJpb0lkLCAxMDApOwogICAgY29uc3QgY2hvaWNlSW5kZXggPSBjbGVhbklu
dGVnZXIoYm9keS5jaG9pY2VJbmRleCwgLTEsIC0xLCAxMDApOwogICAgY29uc3Qgc2NlbmFyaW8gPSBwYXJ0bmVyVHJhaW5lclNjZW5hcmlvcy5maW5kKAog
ICAgICAoaXRlbSkgPT4gaXRlbS5pZCA9PT0gc2NlbmFyaW9JZCwKICAgICk7CiAgICBjb25zdCBvcHRpb24gPSBzY2VuYXJpbz8ub3B0aW9uc1tjaG9pY2VJ
bmRleF07CgogICAgaWYgKCFzY2VuYXJpbyB8fCAhb3B0aW9uKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigiVHJlaW5hbWVudG8gaW52w6Fs
aWRvLiIpOwogICAgfQoKICAgIGNvbnN0IG1vZGUgPQogICAgICBzY2VuYXJpby5jYXRlZ29yeSA9PT0gIkRlbW9uc3RyYcOnw6NvIgogICAgICAgID8gImRl
bW8iCiAgICAgICAgOiBzY2VuYXJpby5jYXRlZ29yeSA9PT0gIk9iamXDp8O1ZXMiCiAgICAgICAgICA/ICJvYmplY3Rpb24iCiAgICAgICAgICA6ICJzYWxl
cyI7CiAgICBjb25zdCB0b3RhbFNjb3JlID0gY2xlYW5OdW1iZXIob3B0aW9uLnNjb3JlLCAwLCAwLCAxMDApOwoKICAgIGNvbnN0IHsgZGF0YSwgZXJyb3Ig
fSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJhZmZpbGlhdGVfdHJhaW5pbmdfc2Vzc2lvbnMiKQogICAgICAuaW5zZXJ0KHsKICAgICAgICBhZmZpbGlh
dGVfaWQ6IGFmZmlsaWF0ZUlkLAogICAgICAgIG1vZGUsCiAgICAgICAgc2NlbmFyaW9faWQ6IHNjZW5hcmlvLmlkLAogICAgICAgIGFuc3dlcjogb3B0aW9u
LnRleHQsCiAgICAgICAgdG90YWxfc2NvcmU6IHRvdGFsU2NvcmUsCiAgICAgICAgc2NvcmVfanNvbjogb3B0aW9uLmRpbWVuc2lvbnMsCiAgICAgICAgZmVl
ZGJhY2s6IG9wdGlvbi5mZWVkYmFjaywKICAgICAgfSkKICAgICAgLnNlbGVjdCgiKiIpCiAgICAgIC5zaW5nbGUoKTsKCiAgICBpZiAoZXJyb3IpIHRocm93
IGVycm9yOwoKICAgIGNvbnN0IHV0Y0RheSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7CiAgICBhd2FpdCBpbnNlcnRFdmVudChh
ZG1pbiwgYWZmaWxpYXRlSWQsICJwcmFjdGljZSIsIHsKICAgICAgbWV0YWRhdGE6IHsKICAgICAgICBtb2RlLAogICAgICAgIHNjZW5hcmlvSWQ6IHNjZW5h
cmlvLmlkLAogICAgICAgIHRvdGFsU2NvcmUsCiAgICAgIH0sCiAgICAgIHNvdXJjZUtleTogXGBwcmFjdGljZTpcJHtzY2VuYXJpby5pZH06XCR7dXRjRGF5
fVxgLAogICAgfSk7CgogICAgcmV0dXJuIHsgbWVzc2FnZTogIlRyZWluYW1lbnRvIHJlZ2lzdHJhZG8uIiwgdHJhaW5pbmc6IGRhdGEgfTsKICB9YCwKICAg
ICJzZXJ2ZXItYXV0aG9yaXRhdGl2ZSB0cmFpbmluZyIsCiAgKTsKCiAgLy8gQ2VydGlmaWNhw6fDo286IHPDsyBhcHJvdmFkbyBkw6EgWFAsIHVtYSB2ZXou
CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgYXdhaXQgaW5zZXJ0RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAicXVpeiIsIHsKICAg
ICAgbWV0YWRhdGE6IHsgZXhhbUlkLCBzY29yZSwgcGFzc2VkIH0sCiAgICAgIHhwOiBwYXNzZWQgPyA4MCA6IDIwLAogICAgfSk7CgogICAgaWYgKHBhc3Nl
ZCkge2AsCiAgICBgICAgIGlmIChwYXNzZWQpIHsKICAgICAgYXdhaXQgaW5zZXJ0RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAicXVpeiIsIHsKICAgICAg
ICBtZXRhZGF0YTogeyBleGFtSWQsIHNjb3JlLCBwYXNzZWQgfSwKICAgICAgICB4cDogODAsCiAgICAgICAgc291cmNlS2V5OiBcYGNlcnRpZmljYXRpb246
XCR7ZXhhbUlkfTpwYXNzZWRcYCwKICAgICAgfSk7CmAsCiAgKTsKCiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImNvbXBvbmVudHMvcGFyY2Vpcm9z
L1BhcnRuZXJHcm93dGhIdWIudHN4IiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgICAgICAgICAg
ICAgICAgICAgICBkdWVBdDoKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVhZC5uZXh0X2ZvbGxvd191cF9hdCB8fAogICAgICAgICAgICAgICAg
ICAgICAgICAgICAgICBuZXcgRGF0ZSgKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50VGltZXN0YW1wICsgMjQgKiA2MCAqIDYwICog
MTAwMCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKS50b0lTT1N0cmluZygpLGAsCiAgICBgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1
ZUF0OgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZWFkLm5leHRfZm9sbG93X3VwX2F0IHx8CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAg
IG5ldyBEYXRlKAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERhdGUubm93KCkgKyAyNCAqIDYwICogNjAgKiAxMDAwLAogICAgICAgICAgICAg
ICAgICAgICAgICAgICAgICApLnRvSVNPU3RyaW5nKCksYCwKICApOwoKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgICAgICAg
ICAgICAgICB2b2lkIHBvc3RBY3Rpb24oInNhdmVfdHJhaW5pbmciLCB7CiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGU6CiAgICAgICAgICAgICAgICAg
ICAgICAgICAgYWN0aXZlVHJhaW5lci5jYXRlZ29yeSA9PT0gIkRlbW9uc3RyYcOnw6NvIgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPyAiZGVtbyIK
ICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYWN0aXZlVHJhaW5lci5jYXRlZ29yeSA9PT0gIk9iamXDp8O1ZXMiCiAgICAgICAgICAgICAgICAgICAg
ICAgICAgICAgID8gIm9iamVjdGlvbiIKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAic2FsZXMiLAogICAgICAgICAgICAgICAgICAgICAgICBz
Y2VuYXJpb0lkOiBhY3RpdmVUcmFpbmVyLmlkLAogICAgICAgICAgICAgICAgICAgICAgICBhbnN3ZXI6CiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0
aXZlVHJhaW5lci5vcHRpb25zW3RyYWluZXJDaG9pY2VdLnRleHQsCiAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsU2NvcmU6CiAgICAgICAgICAgICAg
ICAgICAgICAgICAgYWN0aXZlVHJhaW5lci5vcHRpb25zW3RyYWluZXJDaG9pY2VdLnNjb3JlLAogICAgICAgICAgICAgICAgICAgICAgICBzY29yZUpzb246
CiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVHJhaW5lci5vcHRpb25zW3RyYWluZXJDaG9pY2VdLmRpbWVuc2lvbnMsCiAgICAgICAgICAgICAg
ICAgICAgICAgIGZlZWRiYWNrOgogICAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2ZVRyYWluZXIub3B0aW9uc1t0cmFpbmVyQ2hvaWNlXS5mZWVkYmFj
aywKICAgICAgICAgICAgICAgICAgICAgIH0pYCwKICAgIGAgICAgICAgICAgICAgICAgICAgICAgdm9pZCBwb3N0QWN0aW9uKCJzYXZlX3RyYWluaW5nIiwg
ewogICAgICAgICAgICAgICAgICAgICAgICBzY2VuYXJpb0lkOiBhY3RpdmVUcmFpbmVyLmlkLAogICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2VJbmRl
eDogdHJhaW5lckNob2ljZSwKICAgICAgICAgICAgICAgICAgICAgIH0pYCwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDYpIFBhcmNlaXJvczog
Q1BGL0NOUEogcmVhbCArIGxpbWl0ZXMgSFRUUApwYXRjaCgibGliL2FmZmlsaWF0ZXMvc2VydmVyLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0g
YWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB0eXBlIHsgTmV4dFJlcXVlc3QgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAg
J2ltcG9ydCB7IGRvY3VtZW50RGlnaXRzLCBpc1ZhbGlkQ3BmQ25waiB9IGZyb20gIkAvbGliL2JyLWRvY3VtZW50IjsnLAogICAgImFmZmlsaWF0ZSBkb2N1
bWVudCBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAgICBjb250ZW50LAogICAgL2Z1bmN0aW9uIHZhbGlkYXRlRG9jdW1l
bnRcKHZhbHVlOiB1bmtub3duXCkgXHtbXHNcU10qP1xuXH0vLAogICAgYGZ1bmN0aW9uIHZhbGlkYXRlRG9jdW1lbnQodmFsdWU6IHVua25vd24pIHsKICBj
b25zdCBjbGVhbiA9IGRvY3VtZW50RGlnaXRzKHZhbHVlKTsKCiAgaWYgKCFpc1ZhbGlkQ3BmQ25waihjbGVhbikpIHsKICAgIHRocm93IG5ldyBBZmZpbGlh
dGVFcnJvcigiSW5mb3JtZSB1bSBDUEYgb3UgQ05QSiB2w6FsaWRvLiIpOwogIH0KCiAgcmV0dXJuIGNsZWFuOwp9YCwKICAgICJhZmZpbGlhdGUgZG9jdW1l
bnQgY2hlY2tzdW0iLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICByZXR1cm4gbm9ybWFsaXplZCA9PT0gInByZW1pdW0iID8g
InByZW1pdW0iIDogInByb2Zpc3Npb25hbCI7YCwKICAgIGAgIGlmIChub3JtYWxpemVkID09PSAicHJlbWl1bSIpIHJldHVybiAicHJlbWl1bSI7CiAgcmV0
dXJuICJiYXNpY28iO2AsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVxdWVzdEFmZmls
aWF0ZVBheW91dChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGNvbnN0IHsgYWRtaW4sIHByb2ZpbGUsIHVzZXIgfSA9IGF3YWl0IHJlcXVpcmVBZmZpbGlh
dGUocmVxdWVzdCk7CiAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgYWRtaW4ucnBjKGAsCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVl
c3RBZmZpbGlhdGVQYXlvdXQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICBjb25zdCB7IGFkbWluLCBwcm9maWxlLCB1c2VyIH0gPSBhd2FpdCByZXF1aXJl
QWZmaWxpYXRlKHJlcXVlc3QpOwogIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgcHJvZ3JhbVNldHRpbmdzKGFkbWluKTsKCiAgaWYgKCFCb29sZWFuKHNldHRp
bmdzLnBheW91dHNfZW5hYmxlZCkpIHsKICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigiUGFnYW1lbnRvcyBkZSBwYXJjZWlyb3MgZXN0w6NvIHRlbXBv
cmFyaWFtZW50ZSBpbmRpc3BvbsOtdmVpcy4iLCA1MDMpOwogIH0KCiAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgYWRtaW4ucnBjKGAsCiAgKTsK
CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGBpbXBvcnQgewogIEFzYWFzUHJvdmlkZXIsCiAgdHlwZSBQaXhLZXlUeXBlLAp9IGZyb20gIkAv
bGliL3BheW1lbnRzL3Byb3ZpZGVycy9hc2FhcyI7YCwKICAgIGBpbXBvcnQgewogIEFzYWFzQXBpRXJyb3IsCiAgQXNhYXNQcm92aWRlciwKICB0eXBlIFBp
eEtleVR5cGUsCn0gZnJvbSAiQC9saWIvcGF5bWVudHMvcHJvdmlkZXJzL2FzYWFzIjtgLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAg
ICBgICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJhZmZpbGlhdGVfcGF5b3V0cyIpCiAgICAgIC51cGRhdGUoewogICAg
ICAgIHN0YXR1czogImFwcHJvdmVkIiwKICAgICAgICBhcHByb3ZlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgIGFkbWluX25vdGU6
IHRleHQoaW5wdXQubm90ZSkuc2xpY2UoMCwgNTAwKSB8fCBudWxsLAogICAgICB9KQogICAgICAuZXEoImlkIiwgcGF5b3V0SWQpCiAgICAgIC5lcSgic3Rh
dHVzIiwgInJlcXVlc3RlZCIpOwogICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtgLAogICAgYCAgICBjb25zdCB7IGRhdGE6IGFwcHJvdmVkUGF5b3V0LCBl
cnJvciB9ID0gYXdhaXQgYWRtaW4KICAgICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRzIikKICAgICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOiAiYXBw
cm92ZWQiLAogICAgICAgIGFwcHJvdmVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgICAgYWRtaW5fbm90ZTogdGV4dChpbnB1dC5ub3Rl
KS5zbGljZSgwLCA1MDApIHx8IG51bGwsCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBwYXlvdXRJZCkKICAgICAgLmVxKCJzdGF0dXMiLCAicmVxdWVzdGVk
IikKICAgICAgLnNlbGVjdCgiaWQiKQogICAgICAubWF5YmVTaW5nbGUoKTsKICAgIGlmIChlcnJvcikgdGhyb3cgZXJyb3I7CiAgICBpZiAoIWFwcHJvdmVk
UGF5b3V0Py5pZCkgewogICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIlBhZ2FtZW50byBuw6NvIGVzdMOhIG1haXMgYWd1YXJkYW5kbyBhcHJvdmHD
p8Ojby4iLCA0MDkpOwogICAgfWAsCiAgKTsKCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJQYWdhbWVudG8gasOhIGVzdMOhIHNlbmRvIHByb2Nlc3NhZG8g
b3UgbsOjbyBmb2kgYXByb3ZhZG8uIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgY29uc3Qg
YWNjb3VudCA9IGF3YWl0IGdldFBheW91dEFjY291bnQoYWRtaW4sIHBheW91dC5hZmZpbGlhdGVfaWQpOwogICAgaWYgKCFhY2NvdW50Py5pc192ZXJpZmll
ZCkgewogICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIkEgY29udGEgUGl4IGFpbmRhIG7Do28gZm9pIHZlcmlmaWNhZGEuIiwgNDA5KTsKICAgIH0K
CiAgICBhd2FpdCBhZG1pbgogICAgICAuZnJvbSgiYWZmaWxpYXRlX3BheW91dHMiKQogICAgICAudXBkYXRlKHsKICAgICAgICBzdGF0dXM6ICJwcm9jZXNz
aW5nIiwKICAgICAgICBwcm92aWRlcjogImFzYWFzIiwKICAgICAgICBwcm9jZXNzaW5nX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgIH0p
CiAgICAgIC5lcSgiaWQiLCBwYXlvdXQuaWQpO2AsCiAgICAgIGAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldFBheW91dEFjY291bnQoYWRtaW4sIHBh
eW91dC5hZmZpbGlhdGVfaWQpOwogICAgaWYgKCFhY2NvdW50Py5pc192ZXJpZmllZCkgewogICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIkEgY29u
dGEgUGl4IGFpbmRhIG7Do28gZm9pIHZlcmlmaWNhZGEuIiwgNDA5KTsKICAgIH0KCiAgICBpZiAoU3RyaW5nKHBheW91dC5zdGF0dXMpICE9PSAiYXBwcm92
ZWQiKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigKICAgICAgICAiTyBwYWdhbWVudG8gcHJlY2lzYSBzZXIgYXByb3ZhZG8gYW50ZXMgZG8g
ZW52aW8uIiwKICAgICAgICA0MDksCiAgICAgICk7CiAgICB9CgogICAgY29uc3QgeyBkYXRhOiBjbGFpbWVkUGF5b3V0LCBlcnJvcjogY2xhaW1FcnJvciB9
ID0gYXdhaXQgYWRtaW4KICAgICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRzIikKICAgICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOiAicHJvY2Vzc2lu
ZyIsCiAgICAgICAgcHJvdmlkZXI6ICJhc2FhcyIsCiAgICAgICAgcHJvY2Vzc2luZ19hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgIGZh
aWx1cmVfcmVhc29uOiBudWxsLAogICAgICB9KQogICAgICAuZXEoImlkIiwgcGF5b3V0LmlkKQogICAgICAuZXEoInN0YXR1cyIsICJhcHByb3ZlZCIpCiAg
ICAgIC5zZWxlY3QoImlkIikKICAgICAgLm1heWJlU2luZ2xlKCk7CgogICAgaWYgKGNsYWltRXJyb3IpIHRocm93IGNsYWltRXJyb3I7CiAgICBpZiAoIWNs
YWltZWRQYXlvdXQ/LmlkKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigKICAgICAgICAiUGFnYW1lbnRvIGrDoSBlc3TDoSBzZW5kbyBwcm9j
ZXNzYWRvIG91IG7Do28gZm9pIGFwcm92YWRvLiIsCiAgICAgICAgNDA5LAogICAgICApOwogICAgfWAsCiAgICAgICJhZmZpbGlhdGUgcGF5b3V0IGF0b21p
YyBjbGFpbSIsCiAgICApOwoKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgIGAuZXEoImlkIiwgcGF5b3V0SWQpCiAgICAgIC5pbigic3Rh
dHVzIiwgWyJyZXF1ZXN0ZWQiLCAiYXBwcm92ZWQiXSkKICAgICAgLm1heWJlU2luZ2xlKCk7YCwKICAgICAgYC5lcSgiaWQiLCBwYXlvdXRJZCkKICAgICAg
LmVxKCJzdGF0dXMiLCAiYXBwcm92ZWQiKQogICAgICAubWF5YmVTaW5nbGUoKTtgLAogICAgKTsKCiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAog
ICAgICBjb250ZW50LAogICAgICBgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgIGNvbnN0IHJlYXNvbiA9CiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBF
cnJvciA/IGVycm9yLm1lc3NhZ2UgOiAiRmFsaGEgbmEgdHJhbnNmZXLDqm5jaWEgUGl4LiI7CiAgICAgIGF3YWl0IGFkbWluLnJwYygiZmFpbF9hZmZpbGlh
dGVfcGF5b3V0X2FkbWluIiwgewogICAgICAgIHBfcGF5b3V0X2lkOiBwYXlvdXQuaWQsCiAgICAgICAgcF9yZWFzb246IHJlYXNvbiwKICAgICAgfSk7CiAg
ICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcihyZWFzb24sIDUwMik7CiAgICB9YCwKICAgICAgYCAgICB9IGNhdGNoIChlcnJvcikgewogICAgICBjb25z
dCByZWFzb24gPQogICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogIkZhbGhhIG5hIHRyYW5zZmVyw6puY2lhIFBpeC4i
OwoKICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQXNhYXNBcGlFcnJvciAmJiBlcnJvci5zdGF0dXMgPj0gNDAwICYmIGVycm9yLnN0YXR1cyA8IDUwMCkg
ewogICAgICAgIGF3YWl0IGFkbWluLnJwYygiZmFpbF9hZmZpbGlhdGVfcGF5b3V0X2FkbWluIiwgewogICAgICAgICAgcF9wYXlvdXRfaWQ6IHBheW91dC5p
ZCwKICAgICAgICAgIHBfcmVhc29uOiByZWFzb24sCiAgICAgICAgfSk7CiAgICAgIH0gZWxzZSB7CiAgICAgICAgYXdhaXQgYWRtaW4KICAgICAgICAgIC5m
cm9tKCJhZmZpbGlhdGVfcGF5b3V0cyIpCiAgICAgICAgICAudXBkYXRlKHsKICAgICAgICAgICAgc3RhdHVzOiAicHJvY2Vzc2luZyIsCiAgICAgICAgICAg
IGZhaWx1cmVfcmVhc29uOiAoCiAgICAgICAgICAgICAgIlJlc3VsdGFkbyBpbmNlcnRvIG5vIHByb3ZlZG9yLiBOw6NvIHJlZW52aWFyIGF1dG9tYXRpY2Ft
ZW50ZTogIiArIHJlYXNvbgogICAgICAgICAgICApLnNsaWNlKDAsIDUwMCksCiAgICAgICAgICB9KQogICAgICAgICAgLmVxKCJpZCIsIHBheW91dC5pZCkK
ICAgICAgICAgIC5lcSgic3RhdHVzIiwgInByb2Nlc3NpbmciKTsKICAgICAgfQoKICAgICAgdGhyb3cgbmV3IEFmZmlsaWF0ZUVycm9yKAogICAgICAgIGVy
cm9yIGluc3RhbmNlb2YgQXNhYXNBcGlFcnJvciAmJiBlcnJvci5zdGF0dXMgPj0gNDAwICYmIGVycm9yLnN0YXR1cyA8IDUwMAogICAgICAgICAgPyByZWFz
b24KICAgICAgICAgIDogIk8gZW52aW8gZmljb3UgZW0gZXN0YWRvIGRlIGNvbmZpcm1hw6fDo28uIE7Do28gcmVlbnZpZTsgYWd1YXJkZSBhIGNvbmNpbGlh
w6fDo28gZG8gcHJvdmVkb3IuIiwKICAgICAgICA1MDIsCiAgICAgICk7CiAgICB9YCwKICAgICAgImFmZmlsaWF0ZSBwYXlvdXQgdW5jZXJ0YWluIHByb3Zp
ZGVyIHJlc3VsdCIsCiAgICApOwoKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIGNvbnN0IHsgZGF0YTog
cGF5b3V0LCBlcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgIC5mcm9tKCJhZmZpbGlhdGVfcGF5b3V0cyIpCiAgICAuc2VsZWN0KCIqIikKICAgIC5lcSgicHJv
dmlkZXIiLCAiYXNhYXMiKQogICAgLmVxKCJwcm92aWRlcl90cmFuc2Zlcl9pZCIsIHRyYW5zZmVySWQpCiAgICAubWF5YmVTaW5nbGUoKTsKCiAgaWYgKGVy
cm9yKSB0aHJvdyBlcnJvcjsKICBpZiAoIXBheW91dD8uaWQpIHJldHVybiBmYWxzZTtgLAogICAgICBgICBsZXQgeyBkYXRhOiBwYXlvdXQsIGVycm9yIH0g
PSBhd2FpdCBhZG1pbgogICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRzIikKICAgIC5zZWxlY3QoIioiKQogICAgLmVxKCJwcm92aWRlciIsICJhc2FhcyIp
CiAgICAuZXEoInByb3ZpZGVyX3RyYW5zZmVyX2lkIiwgdHJhbnNmZXJJZCkKICAgIC5tYXliZVNpbmdsZSgpOwoKICBpZiAoZXJyb3IpIHRocm93IGVycm9y
OwoKICBjb25zdCBleHRlcm5hbFJlZmVyZW5jZSA9IHRleHQodHJhbnNmZXIuZXh0ZXJuYWxSZWZlcmVuY2UpOwogIGlmICghcGF5b3V0Py5pZCAmJiBleHRl
cm5hbFJlZmVyZW5jZSkgewogICAgY29uc3QgZmFsbGJhY2sgPSBhd2FpdCBhZG1pbgogICAgICAuZnJvbSgiYWZmaWxpYXRlX3BheW91dHMiKQogICAgICAu
c2VsZWN0KCIqIikKICAgICAgLmVxKCJwcm92aWRlciIsICJhc2FhcyIpCiAgICAgIC5lcSgiZXh0ZXJuYWxfcmVmZXJlbmNlIiwgZXh0ZXJuYWxSZWZlcmVu
Y2UpCiAgICAgIC5lcSgic3RhdHVzIiwgInByb2Nlc3NpbmciKQogICAgICAubWF5YmVTaW5nbGUoKTsKCiAgICBpZiAoZmFsbGJhY2suZXJyb3IpIHRocm93
IGZhbGxiYWNrLmVycm9yOwogICAgcGF5b3V0ID0gZmFsbGJhY2suZGF0YTsKCiAgICBpZiAocGF5b3V0Py5pZCAmJiAhcGF5b3V0LnByb3ZpZGVyX3RyYW5z
ZmVyX2lkKSB7CiAgICAgIGF3YWl0IGFkbWluCiAgICAgICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRzIikKICAgICAgICAudXBkYXRlKHsgcHJvdmlkZXJf
dHJhbnNmZXJfaWQ6IHRyYW5zZmVySWQgfSkKICAgICAgICAuZXEoImlkIiwgcGF5b3V0LmlkKQogICAgICAgIC5lcSgic3RhdHVzIiwgInByb2Nlc3Npbmci
KTsKICAgIH0KICB9CgogIGlmICghcGF5b3V0Py5pZCkgcmV0dXJuIGZhbHNlO2AsCiAgICAgICJhZmZpbGlhdGUgcGF5b3V0IHdlYmhvb2sgZmFsbGJhY2sg
ZXh0ZXJuYWwgcmVmZXJlbmNlIiwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBpL3BhcmNlaXJvcy9yb3V0ZS50cyIs
IChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJl
c3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xuJywKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0
ZS1saW1pdCI7JywKICAgICJwYXJ0bmVyIHBvcnRhbCByYXRlIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50
LAogICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0IjtcbicsCiAgICAnaW1wb3J0IHsgcmVh
ZEpzb25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjsnLAogICAgInBhcnRuZXIgcG9ydGFs
IGJvZHkgaW1wb3J0IiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ3Njb3BlOiAiYWZmaWxpYXRlLXBvcnRhbC1yZWFkIicpKSB7CiAgICBjb250
ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7YCwK
ICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0
IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogImFmZmlsaWF0ZS1wb3J0YWwtcmVhZCIsCiAgICAgIGxpbWl0OiAxMjAsCiAgICAg
IHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7YCwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQu
aW5jbHVkZXMoJ3Njb3BlOiAiYWZmaWxpYXRlLXBvcnRhbC13cml0ZSInKSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYGV4cG9y
dCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGNvbnN0IGJvZHkgPSAoYXdhaXQgcmVxdWVzdC5qc29u
KCkuY2F0Y2goKCkgPT4gKHt9KSkpIGFzIFJlY29yZDwKICAgICAgc3RyaW5nLAogICAgICB1bmtub3duCiAgICA+O2AsCiAgICAgIGBleHBvcnQgYXN5bmMg
ZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChy
ZXF1ZXN0LCB7CiAgICAgIHNjb3BlOiAiYWZmaWxpYXRlLXBvcnRhbC13cml0ZSIsCiAgICAgIGxpbWl0OiAyMCwKICAgICAgd2luZG93U2Vjb25kczogNjAs
CiAgICB9KTsKICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZDsKCiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PFJlY29yZDxzdHJp
bmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwKICAgICAgMTYgKiAxMDI0LAogICAgKTtgLAogICAgKTsKICB9CgogIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2VBbGwoCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgICBgICB9IGNhdGNoIChlcnJvcikg
ewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJy
b3I7CgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgKTsKCiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvcGFyY2Vpcm9z
L3dvcmtzcGFjZS9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQg
eyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xuJywKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJv
bSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7JywKICAgICJ3b3Jrc3BhY2UgcmF0ZSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFm
dGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7XG4nLAog
ICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAg
ICJ3b3Jrc3BhY2UgYm9keSBpbXBvcnQiLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygnc2NvcGU6ICJhZmZpbGlhdGUtd29ya3NwYWNlLXJlYWQi
JykpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0
KSB7CiAgdHJ5IHtgLAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBi
bG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNjb3BlOiAiYWZmaWxpYXRlLXdvcmtzcGFjZS1yZWFkIiwKICAgICAg
bGltaXQ6IDEyMCwKICAgICAgd2luZG93U2Vjb25kczogNjAsCiAgICB9KTsKICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZDtgLAogICAgKTsKICB9
CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdzY29wZTogImFmZmlsaWF0ZS13b3Jrc3BhY2Utd3JpdGUiJykpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2UoCiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBib2R5ID0g
KGF3YWl0IHJlcXVlc3QuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpKSBhcyBSZWNvcmQ8CiAgICAgIHN0cmluZywKICAgICAgdW5rbm93bgogICAgPjtgLAog
ICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0
IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogImFmZmlsaWF0ZS13b3Jrc3BhY2Utd3JpdGUiLAogICAgICBsaW1pdDogNjAsCiAg
ICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJl
YWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3QsCiAgICAgIDMyICogMTAyNCwKICAgICk7YCwKICAgICk7CiAgfQog
IC8vIEFwbGljYSByZXNwb3N0YSA0MTMvNDAwIGRlIGJvZHkgbm9zIGRvaXMgY2F0Y2hlcyBzZW0gcmVlc2NyZXZlciBtZW5zYWdlbnMuCiAgY29udGVudCA9
IGNvbnRlbnQucmVwbGFjZUFsbCgKICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgIGAgIH0gY2F0
Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpOwogICAgaWYgKGJvZHlFcnJvcikgcmV0
dXJuIGJvZHlFcnJvcjsKCiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBp
L3BhcmNlaXJvcy9yZWdpc3Rlci9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAg
ICdpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xuJywKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxp
bWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7JywKICAgICJwYXJ0bmVyIHJlZ2lzdGVyIHJhdGUgaW1wb3J0IiwKICApOwogIGNvbnRl
bnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3Jh
dGUtbGltaXQiO1xuJywKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gIkAvbGliL3NlY3VyaXR5
L3JlcXVlc3QiOycsCiAgICAicGFydG5lciByZWdpc3RlciBib2R5IGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYGV4
cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpz
b24oKS5jYXRjaCgoKSA9PiAoe30pKTtgLAogICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsK
ICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICJhZmZpbGlhdGUtcmVnaXN0ZXIiLAog
ICAgICBsaW1pdDogNSwKICAgICAgd2luZG93U2Vjb25kczogMzYwMCwKICAgIH0pOwogICAgaWYgKGJsb2NrZWQpIHJldHVybiBibG9ja2VkOwoKICAgIGNv
bnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICAxNiAqIDEwMjQsCiAg
ICApO2AsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2Uu
anNvbihgLAogICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7CiAg
ICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yOwoKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7
Cn0pOwoKcGF0Y2goImFwcC9hcGkvcGFyY2Vpcm9zL3RyYWNrL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIo
CiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2UgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9y
dCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0IjsnLAogICAgInBhcnRuZXIgdHJhY2sgcmF0ZSBpbXBvcnQi
LAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9s
aWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAi
QC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJwYXJ0bmVyIHRyYWNrIGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxh
Y2UoCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3QgYm9keSA9IGF3YWl0
IHJlcXVlc3QuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO2AsCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3Qp
IHsKICB0cnkgewogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogImFmZmlsaWF0ZS10
cmFjayIsCiAgICAgIGxpbWl0OiAxMjAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7
CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3QsCiAgICAgIDggKiAx
MDI0LAogICAgKTtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIH0gY2F0Y2ggewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5q
c29uKHsgdHJhY2tlZDogZmFsc2UgfSk7CiAgfWAsCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlF
cnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyB0
cmFja2VkOiBmYWxzZSB9KTsKICB9YCwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDcpIFNpZ251cCBww7pibGljbzogYnl0ZSBsaW1pdCwgcmF0
ZSBsaW1pdCwgb3JpZ2VtLCBkYWRvcyBleHBsw61jaXRvcyBlIENQRi9DTlBKIHJlYWwKcGF0Y2goImFwcC9hcGkvY2hlY2tvdXQvbGVhZC9yb3V0ZS50cyIs
IChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9t
ICJAc3VwYWJhc2Uvc3VwYWJhc2UtanMiO1xuJywKICAgICdpbXBvcnQgeyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2FseS1zZWN1cml0
eSI7JywKICAgICJzaWdudXAgb3JpZ2luIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9y
dCB7IHJlcXVpcmVTYW1lT3JpZ2luIH0gZnJvbSAiQC9saWIvb3JjYWx5LXNlY3VyaXR5IjtcbicsCiAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9
IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiOycsCiAgICAic2lnbnVwIHJhdGUgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRB
ZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiO1xuJywK
ICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiOycsCiAg
ICAic2lnbnVwIGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgcmVhZEpz
b25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjtcbicsCiAgICAnaW1wb3J0IHsgZG9jdW1l
bnREaWdpdHMsIGlzVmFsaWRDcGZDbnBqIH0gZnJvbSAiQC9saWIvYnItZG9jdW1lbnQiOycsCiAgICAic2lnbnVwIGRvYyBpbXBvcnQiLAogICk7CiAgY29u
dGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBkb2N1bWVudERpZ2l0cywgaXNWYWxpZENwZkNucGogfSBmcm9tICJA
L2xpYi9ici1kb2N1bWVudCI7XG4nLAogICAgJ2ltcG9ydCB7IG5vcm1hbGl6ZVBsYW5LZXkgfSBmcm9tICJAL2xpYi9wbGFucy9wbGFuLWNvbmZpZyI7JywK
ICAgICJzaWdudXAgcGxhbiBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgZnVuY3Rpb24gZG9jdW1lbnRvTGltcG8o
dmFsb3I6IHVua25vd24pIHsKICByZXR1cm4gU3RyaW5nKHZhbG9yIHx8ICIiKS5yZXBsYWNlKC9cXEQvZywgIiIpOwp9CgpgLAogICAgIiIsCiAgKTsKCiAg
Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7
CiAgICBpZiAoIXN1cGFiYXNlVXJsIHx8ICFzZXJ2aWNlUm9sZUtleSkge2AsCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4
dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3Qgb3JpZ2luRXJyb3IgPSByZXF1aXJlU2FtZU9yaWdpbihyZXF1ZXN0KTsKICAgIGlmIChvcmlnaW5FcnJv
cikgcmV0dXJuIG9yaWdpbkVycm9yOwoKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6
ICJzaWdudXAtbGVhZCIsCiAgICAgIGxpbWl0OiA4LAogICAgICB3aW5kb3dTZWNvbmRzOiAzNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJu
IGJsb2NrZWQ7CgogICAgaWYgKCFzdXBhYmFzZVVybCB8fCAhc2VydmljZVJvbGVLZXkpIHtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgIGAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcXVlc3QuanNvbigpO2AsCiAgICBgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVj
b3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICAzMiAqIDEwMjQsCiAgICApO2AsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5y
ZXBsYWNlKCJjb25zdCBjcGZfY25waiA9IGRvY3VtZW50b0xpbXBvKCIsICJjb25zdCBjcGZfY25waiA9IGRvY3VtZW50RGlnaXRzKCIpOwogIGNvbnRlbnQg
PSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IHBsYW5vID0gU3RyaW5nKGJvZHkucGxhbm8gfHwgInByb2Zpc3Npb25hbCIpLnRyaW0oKS50b0xv
d2VyQ2FzZSgpO2AsCiAgICBgICAgIGNvbnN0IHBsYW5vID0gbm9ybWFsaXplUGxhbktleShib2R5LnBsYW5vIHx8ICJwcm9maXNzaW9uYWwiKTtgLAogICk7
CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgaWYgKCFbMTEsIDE0XS5pbmNsdWRlcyhjcGZfY25wai5sZW5ndGgpKSB7CiAgICAgIHJl
dHVybiBlcnJvKCJJbmZvcm1lIHVtIENQRiBvdSBDTlBKIHbDoWxpZG8uIik7CiAgICB9YCwKICAgIGAgICAgaWYgKCFpc1ZhbGlkQ3BmQ25waihjcGZfY25w
aikpIHsKICAgICAgcmV0dXJuIGVycm8oIkluZm9ybWUgdW0gQ1BGIG91IENOUEogdsOhbGlkby4iKTsKICAgIH1gLAogICk7CgogIC8vIE7Do28gcGVyc2lz
dGUgcHJvcHJpZWRhZGVzIGFyYml0csOhcmlhcyBlbnZpYWRhcyBwZWxvIG5hdmVnYWRvci4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAg
ICBjb25zdCByYXdEYXRhID0gewogICAgICAuLi5ib2R5LAogICAgICBjcGZfY25waixgLAogICAgYCAgICBjb25zdCByYXdEYXRhID0gewogICAgICBub21l
X3Jlc3BvbnNhdmVsLAogICAgICBlbWFpbCwKICAgICAgd2hhdHNhcHAsCiAgICAgIGVtcHJlc2Ffbm9tZSwKICAgICAgY2lkYWRlLAogICAgICBlc3RhZG8s
CiAgICAgIHBsYW5vLAogICAgICBjcGZfY25waixgLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICB9IGNhdGNoIChlcnJvcikg
ewogICAgcmV0dXJuIGVycm8oYCwKICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9u
c2UoZXJyb3IpOwogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcjsKCiAgICByZXR1cm4gZXJybyhgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7
Cn0pOwoKLy8gRmluYWxpemHDp8OjbyBkYSBjb250YSBleGlnZSBvIG1lc21vIHRva2VuIEhNQUMgZG8gY2hlY2tvdXQgZSBsaW1pdGEgdGVudGF0aXZhcy4K
cGF0Y2goImFwcC9hcGkvbGVhZHMvY29tcGxldGUtYWNjb3VudC9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVy
KAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tICJAc3VwYWJhc2Uvc3VwYWJhc2UtanMiO1xuJywKICAgICdpbXBvcnQg
eyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2FseS1zZWN1cml0eSI7JywKICAgICJjb21wbGV0ZSBhY2NvdW50IG9yaWdpbiBpbXBvcnQi
LAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAv
bGliL29yY2FseS1zZWN1cml0eSI7XG4nLAogICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0
IjsnLAogICAgImNvbXBsZXRlIGFjY291bnQgcmF0ZSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAg
ICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29u
Qm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJjb21wbGV0ZSBhY2NvdW50IGJv
ZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1
ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjtcbicsCiAgICAnaW1wb3J0IHsgdmVyaWZ5U2lnbnVwQ2hlY2tv
dXRUb2tlbiB9IGZyb20gIkAvbGliL3NpZ251cC1jaGVja291dCI7JywKICAgICJjb21wbGV0ZSBhY2NvdW50IHRva2VuIGltcG9ydCIsCiAgKTsKCiAgaWYg
KCFjb250ZW50LmluY2x1ZGVzKCJsZXQgY3JlYXRlZEF1dGhVc2VySWQ6IHN0cmluZyB8IG51bGwgPSBudWxsOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVu
dC5yZXBsYWNlKAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkge2AsCiAgICAgIGBleHBv
cnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGxldCBjcmVhdGVkQXV0aFVzZXJJZDogc3RyaW5nIHwgbnVsbCA9IG51
bGw7CiAgbGV0IGNyZWF0ZWRDb21wYW55SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsOwoKICB0cnkgewogICAgY29uc3Qgb3JpZ2luRXJyb3IgPSByZXF1aXJl
U2FtZU9yaWdpbihyZXF1ZXN0KTsKICAgIGlmIChvcmlnaW5FcnJvcikgcmV0dXJuIG9yaWdpbkVycm9yOwoKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBl
bmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICJjb21wbGV0ZS1zaWdudXAtYWNjb3VudCIsCiAgICAgIGxpbWl0OiA4LAogICAgICB3
aW5kb3dTZWNvbmRzOiAzNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7YCwKICAgICk7CiAgfQoKICBjb250ZW50ID0gY29u
dGVudC5yZXBsYWNlKAogICAgYCAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxdWVzdC5qc29uKCk7CgogICAgY29uc3QgbGVhZElkID0gU3RyaW5nKGJvZHku
bGVhZF9pZCB8fCAiIikudHJpbSgpOwogICAgY29uc3QgcGFzc3dvcmQgPSBTdHJpbmcoYm9keS5wYXNzd29yZCB8fCAiIik7CiAgICBjb25zdCBjb25maXJt
UGFzc3dvcmQgPSBTdHJpbmcoYm9keS5jb25maXJtX3Bhc3N3b3JkIHx8ICIiKTtgLAogICAgYCAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5
PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwKICAgICAgMTYgKiAxMDI0LAogICAgKTsKCiAgICBjb25zdCBsZWFkSWQgPSBTdHJp
bmcoYm9keS5sZWFkX2lkIHx8ICIiKS50cmltKCk7CiAgICBjb25zdCBwYXNzd29yZCA9IFN0cmluZyhib2R5LnBhc3N3b3JkIHx8ICIiKTsKICAgIGNvbnN0
IGNvbmZpcm1QYXNzd29yZCA9IFN0cmluZyhib2R5LmNvbmZpcm1fcGFzc3dvcmQgfHwgIiIpOwogICAgY29uc3QgZXhwaXJlcyA9IE51bWJlcihib2R5LmV4
cGlyZXMgfHwgMCk7CiAgICBjb25zdCBjaGVja291dFRva2VuID0gU3RyaW5nKGJvZHkudG9rZW4gfHwgIiIpLnRyaW0oKTtgLAogICk7CgogIGlmICghY29u
dGVudC5pbmNsdWRlcygnaWYgKCF2ZXJpZnlTaWdudXBDaGVja291dFRva2VuKGxlYWRJZCwgZXhwaXJlcywgY2hlY2tvdXRUb2tlbikpJykpIHsKICAgIGNv
bnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgaWYgKCFsZWFkSWQpIHJldHVybiBlcnJvKCJDYWRhc3RybyBhdXNl
bnRlLiIpOwogICAgaWYgKHBhc3N3b3JkLmxlbmd0aCA8IDgpIHsKICAgICAgcmV0dXJuIGVycm8oIkEgc2VuaGEgcHJlY2lzYSB0ZXIgcGVsbyBtZW5vcyA4
IGNhcmFjdGVyZXMuIik7CiAgICB9CiAgICBpZiAocGFzc3dvcmQgIT09IGNvbmZpcm1QYXNzd29yZCkge2AsCiAgICAgIGAgICAgaWYgKCFsZWFkSWQpIHJl
dHVybiBlcnJvKCJDYWRhc3RybyBhdXNlbnRlLiIpOwogICAgaWYgKCF2ZXJpZnlTaWdudXBDaGVja291dFRva2VuKGxlYWRJZCwgZXhwaXJlcywgY2hlY2tv
dXRUb2tlbikpIHsKICAgICAgcmV0dXJuIGVycm8oIkVzdGUgbGluayBkZSBjcmlhw6fDo28gZGUgY29udGEgw6kgaW52w6FsaWRvIG91IGV4cGlyb3UuIiwg
NDAxKTsKICAgIH0KICAgIGlmIChwYXNzd29yZC5sZW5ndGggPCA4KSB7CiAgICAgIHJldHVybiBlcnJvKCJBIHNlbmhhIHByZWNpc2EgdGVyIHBlbG8gbWVu
b3MgOCBjYXJhY3RlcmVzLiIpOwogICAgfQogICAgaWYgKCEvW0EtWmEtel0vLnRlc3QocGFzc3dvcmQpIHx8ICEvXFxkLy50ZXN0KHBhc3N3b3JkKSkgewog
ICAgICByZXR1cm4gZXJybygiVXNlIHBlbG8gbWVub3MgdW1hIGxldHJhIGUgdW0gbsO6bWVybyBuYSBzZW5oYS4iKTsKICAgIH0KICAgIGlmIChwYXNzd29y
ZCAhPT0gY29uZmlybVBhc3N3b3JkKSB7YCwKICAgICAgImNvbXBsZXRlIGFjY291bnQgdG9rZW4gdmFsaWRhdGlvbiIsCiAgICApOwogIH0KCiAgY29udGVu
dCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3QgdXNlcklkID0gYXV0aERhdGEudXNlci5pZDsKCiAgICBsZXQgc2x1ZyA9YCwKICAgIGAgICAg
Y29uc3QgdXNlcklkID0gYXV0aERhdGEudXNlci5pZDsKICAgIGNyZWF0ZWRBdXRoVXNlcklkID0gdXNlcklkOwoKICAgIGxldCBzbHVnID1gLAogICk7Cgog
IGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IGNvbXBhbnkgPSBhd2FpdCBpbnNlcnRDb21wYW55KGNvbXBhbnlQYXlsb2FkKTsK
CiAgICB0cnkge2AsCiAgICBgICAgIGNvbnN0IGNvbXBhbnkgPSBhd2FpdCBpbnNlcnRDb21wYW55KGNvbXBhbnlQYXlsb2FkKTsKICAgIGNyZWF0ZWRDb21w
YW55SWQgPSBTdHJpbmcoY29tcGFueS5pZCk7CgogICAgdHJ5IHtgLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICB9IGNhdGNo
IChlcnJvcikgewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0g
cmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CgogICAgbGV0IGF1dGhDbGVhbnVw
QWxsb3dlZCA9IHRydWU7CgogICAgaWYgKGNyZWF0ZWRDb21wYW55SWQpIHsKICAgICAgdHJ5IHsKICAgICAgICBjb25zdCBjbGVhbnVwQ29tcGFueSA9IGF3
YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgICAgIC5mcm9tKCJjb21wYW5pZXMiKQogICAgICAgICAgLmRlbGV0ZSgpCiAgICAgICAgICAuZXEoImlkIiwgY3Jl
YXRlZENvbXBhbnlJZCkKICAgICAgICAgIC5lcSgib3duZXJfaWQiLCBjcmVhdGVkQXV0aFVzZXJJZCk7CgogICAgICAgIGlmIChjbGVhbnVwQ29tcGFueS5l
cnJvcikgewogICAgICAgICAgYXV0aENsZWFudXBBbGxvd2VkID0gZmFsc2U7CiAgICAgICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgICAib3JjYWx5
X3NpZ251cF9vcnBoYW5fY29tcGFueV9jbGVhbnVwX2Vycm9yIiwKICAgICAgICAgICAgY2xlYW51cENvbXBhbnkuZXJyb3IubWVzc2FnZSwKICAgICAgICAg
ICk7CiAgICAgICAgfQogICAgICB9IGNhdGNoIChjbGVhbnVwRXJyb3IpIHsKICAgICAgICBhdXRoQ2xlYW51cEFsbG93ZWQgPSBmYWxzZTsKICAgICAgICBj
b25zb2xlLmVycm9yKAogICAgICAgICAgIm9yY2FseV9zaWdudXBfb3JwaGFuX2NvbXBhbnlfY2xlYW51cF9lcnJvciIsCiAgICAgICAgICBjbGVhbnVwRXJy
b3IgaW5zdGFuY2VvZiBFcnJvciA/IGNsZWFudXBFcnJvci5tZXNzYWdlIDogY2xlYW51cEVycm9yLAogICAgICAgICk7CiAgICAgIH0KICAgIH0KCiAgICBp
ZiAoY3JlYXRlZEF1dGhVc2VySWQgJiYgYXV0aENsZWFudXBBbGxvd2VkKSB7CiAgICAgIHRyeSB7CiAgICAgICAgYXdhaXQgc3VwYWJhc2VBZG1pbi5hdXRo
LmFkbWluLmRlbGV0ZVVzZXIoY3JlYXRlZEF1dGhVc2VySWQpOwogICAgICB9IGNhdGNoIChjbGVhbnVwRXJyb3IpIHsKICAgICAgICBjb25zb2xlLmVycm9y
KAogICAgICAgICAgIm9yY2FseV9zaWdudXBfb3JwaGFuX3VzZXJfY2xlYW51cF9lcnJvciIsCiAgICAgICAgICBjbGVhbnVwRXJyb3IgaW5zdGFuY2VvZiBF
cnJvciA/IGNsZWFudXBFcnJvci5tZXNzYWdlIDogY2xlYW51cEVycm9yLAogICAgICAgICk7CiAgICAgIH0KICAgIH0KCiAgICByZXR1cm4gTmV4dFJlc3Bv
bnNlLmpzb24oYCwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiY29tcG9uZW50cy9jaGVja291dC9TaWdudXBDaGVja291dC50c3giLCAo
Y29udGVudCkgPT4gewogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7CiAgICAgICAgICBs
ZWFkX2lkOiBsZWFkSWQsCiAgICAgICAgICBwYXNzd29yZCwKICAgICAgICAgIGNvbmZpcm1fcGFzc3dvcmQ6IGNvbmZpcm1QYXNzd29yZCwKICAgICAgICB9
KSxgLAogICAgYCAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoewogICAgICAgICAgbGVhZF9pZDogbGVhZElkLAogICAgICAgICAgZXhwaXJlcywKICAg
ICAgICAgIHRva2VuLAogICAgICAgICAgcGFzc3dvcmQsCiAgICAgICAgICBjb25maXJtX3Bhc3N3b3JkOiBjb25maXJtUGFzc3dvcmQsCiAgICAgICAgfSks
YCwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIEVuZHBvaW50cyBkZSBwYWdhbWVudG8gZG8gY2FkYXN0cm8gdGFtYsOpbSB1c2FtIGxpbWl0ZSBy
ZWFsIGRlIGJ5dGVzIGUgcmF0ZSBsaW1pdC4KZm9yIChjb25zdCBzaWdudXBQYXltZW50Um91dGUgb2YgWwogIHsKICAgIGZpbGU6ICJhcHAvYXBpL2NoZWNr
b3V0L3NpZ251cC9waXgvcm91dGUudHMiLAogICAgc2NvcGU6ICJzaWdudXAtcGl4IiwKICAgIG1heEJ5dGVzOiAxMiAqIDEwMjQsCiAgfSwKICB7CiAgICBm
aWxlOiAiYXBwL2FwaS9jaGVja291dC9zaWdudXAvY2FyZC9yb3V0ZS50cyIsCiAgICBzY29wZTogInNpZ251cC1jYXJkIiwKICAgIG1heEJ5dGVzOiAxNiAq
IDEwMjQsCiAgfSwKXSkgewogIHBhdGNoKHNpZ251cFBheW1lbnRSb3V0ZS5maWxlLCAoY29udGVudCkgPT4gewogICAgY29udGVudCA9IGFkZEltcG9ydEFm
dGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gIm5leHQvc2VydmVyIjtcbicsCiAg
ICAgICdpbXBvcnQgeyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2FseS1zZWN1cml0eSI7JywKICAgICAgYCR7c2lnbnVwUGF5bWVudFJv
dXRlLmZpbGV9IG9yaWdpbmAsCiAgICApOwogICAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsgcmVx
dWlyZVNhbWVPcmlnaW4gfSBmcm9tICJAL2xpYi9vcmNhbHktc2VjdXJpdHkiO1xuJywKICAgICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9t
ICJAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0IjsnLAogICAgICBgJHtzaWdudXBQYXltZW50Um91dGUuZmlsZX0gcmF0ZWAsCiAgICApOwogICAgY29udGVu
dCA9IGFkZEltcG9ydEFmdGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5
L3JhdGUtbGltaXQiO1xuJywKICAgICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2Vj
dXJpdHkvcmVxdWVzdCI7JywKICAgICAgYCR7c2lnbnVwUGF5bWVudFJvdXRlLmZpbGV9IGJvZHlgLAogICAgKTsKCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVk
ZXMoYHNjb3BlOiAiJHtzaWdudXBQYXltZW50Um91dGUuc2NvcGV9ImApKSB7CiAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICAgYGV4
cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpz
b24oKS5jYXRjaCgoKSA9PiAoe30pKTtgLAogICAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRy
eSB7CiAgICBjb25zdCBvcmlnaW5FcnJvciA9IHJlcXVpcmVTYW1lT3JpZ2luKHJlcXVlc3QpOwogICAgaWYgKG9yaWdpbkVycm9yKSByZXR1cm4gb3JpZ2lu
RXJyb3I7CgogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogIiR7c2lnbnVwUGF5bWVu
dFJvdXRlLnNjb3BlfSIsCiAgICAgIGxpbWl0OiAyMCwKICAgICAgd2luZG93U2Vjb25kczogNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJu
IGJsb2NrZWQ7CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3QsCiAg
ICAgICR7c2lnbnVwUGF5bWVudFJvdXRlLm1heEJ5dGVzfSwKICAgICk7YCwKICAgICAgKTsKICAgIH0KCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNv
bnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7IikpIHsKICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAg
ICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAg
IGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7CiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yOwoK
ICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgICApOwogICAgfQoKICAgIHJldHVybiBjb250ZW50OwogIH0pOwp9CgovLyBHRVRzIGFzc2lu
YWRvcyBkbyBjaGVja291dCB0YW1iw6ltIHByb3RlZ2VtIGNvbnN1bHRhcyBhbyBwcm92ZWRvci4KZm9yIChjb25zdCBzaWdudXBSZWFkUm91dGUgb2YgWwog
IHsKICAgIGZpbGU6ICJhcHAvYXBpL2NoZWNrb3V0L3NpZ251cC9yb3V0ZS50cyIsCiAgICBzY29wZTogInNpZ251cC1jaGVja291dC1yZWFkIiwKICAgIGxp
bWl0OiA2MCwKICB9LAogIHsKICAgIGZpbGU6ICJhcHAvYXBpL2NoZWNrb3V0L3NpZ251cC9zdGF0dXMvcm91dGUudHMiLAogICAgc2NvcGU6ICJzaWdudXAt
Y2hlY2tvdXQtc3RhdHVzIiwKICAgIGxpbWl0OiAxODAsCiAgfSwKXSkgewogIHBhdGNoKHNpZ251cFJlYWRSb3V0ZS5maWxlLCAoY29udGVudCkgPT4gewog
ICAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZy
b20gIm5leHQvc2VydmVyIjtcbicsCiAgICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7
JywKICAgICAgYCR7c2lnbnVwUmVhZFJvdXRlLmZpbGV9IHJhdGUgaW1wb3J0YCwKICAgICk7CgogICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKGBzY29wZTog
IiR7c2lnbnVwUmVhZFJvdXRlLnNjb3BlfSJgKSkgewogICAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICAgIGNvbnRlbnQsCiAgICAgICAg
YCAgICBjb25zdCBleHBpcmVzID0gcmVxdWVzdC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5nZXQoImV4cGlyZXMiKTsKICAgIGNvbnN0IHRva2VuID0gcmVxdWVz
dC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5nZXQoInRva2VuIik7CgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgICAgICAgYCAgICBjb25zdCBl
eHBpcmVzID0gcmVxdWVzdC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5nZXQoImV4cGlyZXMiKTsKICAgIGNvbnN0IHRva2VuID0gcmVxdWVzdC5uZXh0VXJsLnNl
YXJjaFBhcmFtcy5nZXQoInRva2VuIik7CgogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29w
ZTogIiR7c2lnbnVwUmVhZFJvdXRlLnNjb3BlfSIsCiAgICAgIGlkZW50aXR5OiBsZWFkSWQgfHwgdW5kZWZpbmVkLAogICAgICBsaW1pdDogJHtzaWdudXBS
ZWFkUm91dGUubGltaXR9LAogICAgICB3aW5kb3dTZWNvbmRzOiA2MDAsCiAgICB9KTsKICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZDsKCiAgICBy
ZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgICAgICBgJHtzaWdudXBSZWFkUm91dGUuZmlsZX0gcmF0ZSBjYWxsYCwKICAgICAgKTsKICAgIH0KICAg
IHJldHVybiBjb250ZW50OwogIH0pOwp9CgovLyA4KSBTbHVncyBjYW7DtG5pY29zIGUgYWxpbmhhbWVudG8gZGUgcmVzZXJ2YWRvcwpwYXRjaCgibGliL3Ns
dWcudHMiLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiJ3BhcmNlaXJvcycsIikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2UoIiAgJ3BhaW5lbCcsXG4iLCAiICAncGFpbmVsJyxcbiAgJ3BhcmNlaXJvcycsXG4iKTsKICB9CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJleHBv
cnQgZnVuY3Rpb24gcGFyc2VDYW5vbmljYWxQdWJsaWNTbHVnIikpIHsKICAgIGNvbnN0IG1hcmtlciA9ICJcbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVN1
YmRvbWFpblNsdWciOwogICAgY29uc3QgaGVscGVyID0gYApleHBvcnQgZnVuY3Rpb24gcGFyc2VDYW5vbmljYWxQdWJsaWNTbHVnKHZhbHVlOiB1bmtub3du
KSB7CiAgY29uc3QgcmF3ID0gU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKQoKICBpZiAoCiAgICByYXcubGVuZ3RoIDwgMSB8fAog
ICAgcmF3Lmxlbmd0aCA+IDQyIHx8CiAgICAhL15bYS16MC05XSg/OlthLXowLTktXSpbYS16MC05XSk/JC8udGVzdChyYXcpCiAgKSB7CiAgICByZXR1cm4g
bnVsbAogIH0KCiAgcmV0dXJuIHJhdwp9CmA7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KGNvbnRlbnQsIG1hcmtlciwgYCR7aGVscGVyfSR7bWFy
a2VyfWAsICJjYW5vbmljYWwgcHVibGljIHNsdWcgaGVscGVyIik7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJsaWIvb3JjYWx5LXNlY3Vy
aXR5LnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb25zdCByZXNlcnZlcyA9IFsiYXBwIiwgImRhc2hib2FyZCIsICJhc3NpbmF0dXJhIiwgInNpdGUiLCAibWFy
a2V0cGxhY2UiLCAicGFyY2Vpcm9zIiwgImhlbHAiLCAib3JjYWx5Il07CiAgZm9yIChjb25zdCBpdGVtIG9mIHJlc2VydmVzKSB7CiAgICBpZiAoIWNvbnRl
bnQuaW5jbHVkZXMoYCAgJyR7aXRlbX0nLGApKSB7CiAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoIiAgJ2FkbWluJyxcbiIsIGAgICdhZG1pbics
XG4gICcke2l0ZW19JyxcbmApOwogICAgfQogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgibGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0LnRz
IiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB0eXBlIHsgTmV4dFJlcXVlc3Qg
fSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IHBhcnNlQ2Fub25pY2FsUHVibGljU2x1ZyB9IGZyb20gIkAvbGliL3NsdWciOycsCiAg
ICAic2VydmVyLWNvbnRleHQgc2x1ZyBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIGNvbnN0IGNsZWFuID0gU3Ry
aW5nKHNsdWcgfHwgIiIpLnRyaW0oKS50b0xvd2VyQ2FzZSgpOwoKICBjb25zdCB7IGRhdGE6IGNvbXBhbnksIGVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZWAs
CiAgICBgICBjb25zdCBjbGVhbiA9IHBhcnNlQ2Fub25pY2FsUHVibGljU2x1ZyhzbHVnKTsKCiAgaWYgKCFjbGVhbikgewogICAgdGhyb3cgT2JqZWN0LmFz
c2lnbihuZXcgRXJyb3IoIkVtcHJlc2EgaW52w6FsaWRhLiIpLCB7IHN0YXR1czogNDAwIH0pOwogIH0KCiAgY29uc3QgeyBkYXRhOiBjb21wYW55LCBlcnJv
ciB9ID0gYXdhaXQgc3VwYWJhc2VgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvcHVibGljLXNpdGUvW3NsdWddL3JvdXRl
LnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImFzc2luYXR1cmFfc3RhdHVzPzogc3RyaW5nIHwgbnVsbCIpKSB7CiAgICBj
b250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICAiICBzaXRlX2RlbGl2ZXJ5X29wdGlvbnM/OiB1bmtub3duXG59IiwKICAg
ICAgYCAgc2l0ZV9kZWxpdmVyeV9vcHRpb25zPzogdW5rbm93bgogIGFzc2luYXR1cmFfc3RhdHVzPzogc3RyaW5nIHwgbnVsbAogIGFzc2luYXR1cmFfZXhw
aXJhX2VtPzogc3RyaW5nIHwgbnVsbAogIHRyaWFsX3N0YXJ0ZWRfYXQ/OiBzdHJpbmcgfCBudWxsCiAgdHJpYWxfZW5kc19hdD86IHN0cmluZyB8IG51bGwK
ICBjYW5jZWxfYXRfcGVyaW9kX2VuZD86IGJvb2xlYW4gfCBudWxsCiAgYWNjZXNzX3VudGlsPzogc3RyaW5nIHwgbnVsbAp9YCwKICAgICAgInB1YmxpYyBj
b21wYW55IHN1YnNjcmlwdGlvbiB0eXBlIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9y
dCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1
YmxpY1NsdWcgfSBmcm9tICdAL2xpYi9zbHVnJyIsCiAgICAicHVibGljIHNpdGUgc2x1ZyBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFm
dGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcgfSBmcm9tICdAL2xpYi9zbHVnJ1xuIiwKICAgICJpbXBv
cnQgeyBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzIH0gZnJvbSAnQC9saWIvc3Vic2NyaXB0aW9uLWFjY2VzcyciLAogICAgInB1YmxpYyBzaXRlIHN1
YnNjcmlwdGlvbiBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBnZXRDb21wYW55
U3Vic2NyaXB0aW9uQWNjZXNzIH0gZnJvbSAnQC9saWIvc3Vic2NyaXB0aW9uLWFjY2VzcydcbiIsCiAgICAiaW1wb3J0IHsgbm9ybWFsaXplUGxhbktleSB9
IGZyb20gJ0AvbGliL3BsYW5zL3BsYW4tY29uZmlnJyIsCiAgICAicHVibGljIHNpdGUgcGxhbiBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50
LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IHsgc2x1ZyB9ID0gYXdhaXQgY29udGV4dC5wYXJhbXMKICAgIGNvbnN0IGNsZWFuU2x1ZyA9IFN0cmluZyhzbHVn
IHx8ICcnKS50cmltKCkuc2xpY2UoMCwgODApCgogICAgaWYgKCFjbGVhblNsdWcpIHtgLAogICAgYCAgICBjb25zdCB7IHNsdWcgfSA9IGF3YWl0IGNvbnRl
eHQucGFyYW1zCiAgICBjb25zdCBjbGVhblNsdWcgPSBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcoc2x1ZykKCiAgICBpZiAoIWNsZWFuU2x1Zykge2AsCiAg
KTsKCiAgY29uc3QgZmllbGRzQW5jaG9yID0gIiAgICAgICdhdGl2bycsXG4iOwogIGNvbnN0IHN1YnNjcmlwdGlvbkZpZWxkcyA9IGAgICAgICAnYXNzaW5h
dHVyYV9zdGF0dXMnLAogICAgICAnYXNzaW5hdHVyYV9wbGFubycsCiAgICAgICdwbGFubycsCiAgICAgICdhc3NpbmF0dXJhX2V4cGlyYV9lbScsCiAgICAg
ICd0cmlhbF9zdGFydGVkX2F0JywKICAgICAgJ3RyaWFsX2VuZHNfYXQnLAogICAgICAnY2FuY2VsX2F0X3BlcmlvZF9lbmQnLAogICAgICAnYWNjZXNzX3Vu
dGlsJywKYDsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoIid0cmlhbF9lbmRzX2F0JyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKGZpZWxk
c0FuY2hvciwgYCR7c3Vic2NyaXB0aW9uRmllbGRzfSR7ZmllbGRzQW5jaG9yfWApOwogIH0KCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBzdWJz
Y3JpcHRpb25BY2Nlc3MgPSBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzKGNvbXBhbnkpIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQo
CiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgaWYgKAogICAgICAhY29tcGFueSB8fAogICAgICBjb21wYW55LmF0aXZvID09PSBmYWxzZSB8fAogICAgICBj
b21wYW55LnNpdGVfcHVibGljb19hdGl2byA9PT0gZmFsc2UKICAgICkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJv
cjogJ1NpdGUgbmFvIGVuY29udHJhZG8uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDQgfSwKICAgICAgKQogICAgfQoKICAgIGNvbnN0IHRlbXBsYXRlID1g
LAogICAgICBgICAgIGlmICgKICAgICAgIWNvbXBhbnkgfHwKICAgICAgY29tcGFueS5hdGl2byA9PT0gZmFsc2UgfHwKICAgICAgY29tcGFueS5zaXRlX3B1
YmxpY29fYXRpdm8gPT09IGZhbHNlCiAgICApIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdTaXRlIG5hbyBl
bmNvbnRyYWRvLicgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAgICkKICAgIH0KCiAgICBjb25zdCBzdWJzY3JpcHRpb25BY2Nlc3MgPSBnZXRD
b21wYW55U3Vic2NyaXB0aW9uQWNjZXNzKGNvbXBhbnkpCiAgICBpZiAoIXN1YnNjcmlwdGlvbkFjY2Vzcy5oYXNBY2Nlc3MpIHsKICAgICAgcmV0dXJuIE5l
eHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdTaXRlIG5hbyBlbmNvbnRyYWRvLicgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAg
ICkKICAgIH0KCiAgICBjb25zdCB0ZW1wbGF0ZSA9YCwKICAgICAgInB1YmxpYyBzaXRlIHN1YnNjcmlwdGlvbiBnYXRlIiwKICAgICk7CiAgfQoKICBpZiAo
IWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IG9ubGluZVBheW1lbnRzQWxsb3dlZCIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBj
b250ZW50LAogICAgICBgICAgIGNvbnN0IHNldHRpbmcgPSBwYXltZW50U2V0dGluZ3NSZXN1bHQuZXJyb3IKICAgICAgPyBudWxsCiAgICAgIDogcGF5bWVu
dFNldHRpbmdzUmVzdWx0LmRhdGEKICAgIGNvbnN0IGNvbm5lY3RlZCA9IEJvb2xlYW4oCiAgICAgIHNldHRpbmc/LmlzX2FjdGl2ZSA9PT0gdHJ1ZSAmJgog
ICAgICAgIHNldHRpbmc/Lm9uYm9hcmRpbmdfc3RhdHVzID09PSAnY29ubmVjdGVkJyAmJgogICAgICAgIHNldHRpbmc/LnB1YmxpY19rZXksCiAgICApYCwK
ICAgICAgYCAgICBjb25zdCBzZXR0aW5nID0gcGF5bWVudFNldHRpbmdzUmVzdWx0LmVycm9yCiAgICAgID8gbnVsbAogICAgICA6IHBheW1lbnRTZXR0aW5n
c1Jlc3VsdC5kYXRhCiAgICBjb25zdCBwdWJsaWNQbGFuID0gbm9ybWFsaXplUGxhbktleSgKICAgICAgY29tcGFueS5hc3NpbmF0dXJhX3BsYW5vIHx8IGNv
bXBhbnkucGxhbm8sCiAgICApCiAgICBjb25zdCBvbmxpbmVQYXltZW50c0FsbG93ZWQgPQogICAgICBwdWJsaWNQbGFuID09PSAncHJvZmlzc2lvbmFsJyB8
fCBwdWJsaWNQbGFuID09PSAncHJlbWl1bScKICAgIGNvbnN0IGNvbm5lY3RlZCA9CiAgICAgIG9ubGluZVBheW1lbnRzQWxsb3dlZCAmJgogICAgICBCb29s
ZWFuKAogICAgICAgIHNldHRpbmc/LmlzX2FjdGl2ZSA9PT0gdHJ1ZSAmJgogICAgICAgICAgc2V0dGluZz8ub25ib2FyZGluZ19zdGF0dXMgPT09ICdjb25u
ZWN0ZWQnICYmCiAgICAgICAgICBzZXR0aW5nPy5wdWJsaWNfa2V5LAogICAgICApYCwKICAgICAgInB1YmxpYyBzaXRlIG9ubGluZSBwYXltZW50cyBwbGFu
IGdhdGUiLAogICAgKTsKICB9CgogIC8vIE7Do28gcHVibGljYSBpdGVucyBleHBsaWNpdGFtZW50ZSBpbmRpc3BvbsOtdmVpcy9pbmF0aXZvcy4KICBjb250
ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICBjb25zdCBwcm9kdWN0cyA9CiAgICAgIChyYXdQcm9kdWN0cyB8fCBbXSkgYXMgdW5rbm93biBhcyBQ
dWJsaWNQcm9kdWN0Um93W11gLAogICAgYCAgICBjb25zdCBwcm9kdWN0cyA9CiAgICAgICgocmF3UHJvZHVjdHMgfHwgW10pIGFzIHVua25vd24gYXMgUHVi
bGljUHJvZHVjdFJvd1tdKS5maWx0ZXIoCiAgICAgICAgKHByb2R1Y3QpID0+CiAgICAgICAgICBwcm9kdWN0LmF0aXZvICE9PSBmYWxzZSAmJgogICAgICAg
ICAgcHJvZHVjdC5pc19hY3RpdmUgIT09IGZhbHNlICYmCiAgICAgICAgICBwcm9kdWN0LmF2YWlsYWJsZSAhPT0gZmFsc2UsCiAgICAgIClgLAogICk7CiAg
cmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvcHVibGljL3VwbG9hZHMvYXJ0L3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50
ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRl
LWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcgfSBmcm9tICdAL2xpYi9zbHVnJyIsCiAgICAiYXJ0IHNsdWcgaW1w
b3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IGZpbGUgPSBmb3JtLmdldCgnZmlsZScpCiAgICBjb25zdCBz
bHVnID0gU3RyaW5nKGZvcm0uZ2V0KCdzbHVnJykgfHwgJycpLnRyaW0oKS5zbGljZSgwLCA4MCkKCiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgRmlsZSkg
fHwgIXNsdWcpIHtgLAogICAgYCAgICBjb25zdCBmaWxlID0gZm9ybS5nZXQoJ2ZpbGUnKQogICAgY29uc3Qgc2x1ZyA9IHBhcnNlQ2Fub25pY2FsUHVibGlj
U2x1Zyhmb3JtLmdldCgnc2x1ZycpKQoKICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBGaWxlKSB8fCAhc2x1Zykge2AsCiAgKTsKICByZXR1cm4gY29udGVu
dDsKfSk7CgovLyA4LjEpIEFQSXMgZmluYW5jZWlyYXMgZSBJQSBpbnRlcm5hIHJlc3BlaXRhbSBjYXJnby9hc3NpbmF0dXJhLgpmb3IgKGNvbnN0IGZpbmFu
Y2VSb3V0ZSBvZiBbCiAgImFwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvc2V0dGluZ3Mvcm91dGUudHMiLAogICJhcHAvYXBpL21hcmtldHBsYWNlL3Bh
eW1lbnRzL3NhbGVzL3JvdXRlLnRzIiwKXSkgewogIHBhdGNoKGZpbmFuY2VSb3V0ZSwgKGNvbnRlbnQpID0+IHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2UoCiAgICAgICJpbXBvcnQgeyBnZXRDb21wYW55QWNjZXNzLCBnZXRSZXF1ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21w
YW55LWFjY2VzcyciLAogICAgICAiaW1wb3J0IHsgYXNzaW5hdHVyYUVzdGFBdGl2YSwgY29tcGFueVBsYW5BbGxvd3MsIGdldENvbXBhbnlBY2Nlc3MsIGdl
dFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1pbiB9IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgICApOwoKICAgIGlmICghY29udGVudC5pbmNs
dWRlcygiY29tcGFueVBsYW5BbGxvd3MoYWNjZXNzLmNvbXBhbnksICdwcm9maXNzaW9uYWwnKSIpKSB7CiAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxh
Y2UoCiAgICAgICAgYCAgICBpZiAoIWFjY2Vzcy5jb21wYW55Py5pZCkgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28g
ZW5jb250cmFkYS4nIH0sIHsgc3RhdHVzOiA0MDQgfSkKYCwKICAgICAgICBgICAgIGlmICghYWNjZXNzLmNvbXBhbnk/LmlkKSByZXR1cm4gTmV4dFJlc3Bv
bnNlLmpzb24oeyBlcnJvcjogJ0VtcHJlc2EgbsOjbyBlbmNvbnRyYWRhLicgfSwgeyBzdGF0dXM6IDQwNCB9KQogICAgaWYgKAogICAgICAhYXNzaW5hdHVy
YUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkgfHwKICAgICAgIWNvbXBhbnlQbGFuQWxsb3dzKGFjY2Vzcy5jb21wYW55LCAncHJvZmlzc2lvbmFsJykKICAg
ICkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ1JlY3Vyc28gZGlzcG9uw612ZWwgYSBwYXJ0aXIgZG8gcGxh
bm8gUHJvZmlzc2lvbmFsIGNvbSBhc3NpbmF0dXJhIGF0aXZhLicgfSwKICAgICAgICB7IHN0YXR1czogNDAzIH0sCiAgICAgICkKICAgIH0KYCwKICAgICAg
KTsKICAgIH0KCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImlmICghYWNjZXNzLmNhbkZpbmFuY2UpIikpIHsKICAgICAgY29udGVudCA9IGNvbnRlbnQu
cmVwbGFjZSgKICAgICAgICBgICAgIGlmICgKICAgICAgIWFzc2luYXR1cmFFc3RhQXRpdmEoYWNjZXNzLmNvbXBhbnkpIHx8CiAgICAgICFjb21wYW55UGxh
bkFsbG93cyhhY2Nlc3MuY29tcGFueSwgJ3Byb2Zpc3Npb25hbCcpCiAgICApIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsg
ZXJyb3I6ICdSZWN1cnNvIGRpc3BvbsOtdmVsIGEgcGFydGlyIGRvIHBsYW5vIFByb2Zpc3Npb25hbCBjb20gYXNzaW5hdHVyYSBhdGl2YS4nIH0sCiAgICAg
ICAgeyBzdGF0dXM6IDQwMyB9LAogICAgICApCiAgICB9CmAsCiAgICAgICAgYCAgICBpZiAoCiAgICAgICFhc3NpbmF0dXJhRXN0YUF0aXZhKGFjY2Vzcy5j
b21wYW55KSB8fAogICAgICAhY29tcGFueVBsYW5BbGxvd3MoYWNjZXNzLmNvbXBhbnksICdwcm9maXNzaW9uYWwnKQogICAgKSB7CiAgICAgIHJldHVybiBO
ZXh0UmVzcG9uc2UuanNvbigKICAgICAgICB7IGVycm9yOiAnUmVjdXJzbyBkaXNwb27DrXZlbCBhIHBhcnRpciBkbyBwbGFubyBQcm9maXNzaW9uYWwgY29t
IGFzc2luYXR1cmEgYXRpdmEuJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKQogICAgfQogICAgaWYgKCFhY2Nlc3MuY2FuRmluYW5jZSkg
ewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ1NldSBwZXJmaWwgbsOjbyBwb3NzdWkgYWNlc3NvIGZpbmFuY2Vp
cm8uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKQogICAgfQpgLAogICAgICApOwogICAgfQogICAgcmV0dXJuIGNvbnRlbnQ7CiAgfSk7
Cn0KCgpmb3IgKGNvbnN0IGNybVJvdXRlIG9mIFsKICAiYXBwL2FwaS9jcm0vbGVhZHMvcm91dGUudHMiLAogICJhcHAvYXBpL2NybS9sZWFkcy9baWRdL3Jv
dXRlLnRzIiwKXSkgewogIHBhdGNoKGNybVJvdXRlLCAoY29udGVudCkgPT4gewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgImltcG9y
dCB7IGdldENvbXBhbnlBY2Nlc3MsIGdldFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1pbiB9IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgICAg
ICJpbXBvcnQgeyBhc3NpbmF0dXJhRXN0YUF0aXZhLCBjb21wYW55UGxhbkFsbG93cywgZ2V0Q29tcGFueUFjY2VzcywgZ2V0UmVxdWVzdGVyLCBnZXRTdXBh
YmFzZUFkbWluIH0gZnJvbSAnQC9saWIvY29tcGFueS1hY2Nlc3MnIiwKICAgICk7CiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoIkAvbGliL3NlY3VyaXR5
L3JlcXVlc3QiKSkgewogICAgICBjb25zdCBmaXJzdEltcG9ydEVuZCA9IGNvbnRlbnQuaW5kZXhPZigiXG4iLCBjb250ZW50LmluZGV4T2YoImZyb20gJ0Av
bGliL29yY2FseS1hdWRpdCciKSk7CiAgICAgIGlmIChmaXJzdEltcG9ydEVuZCA8IDApIHRocm93IG5ldyBFcnJvcihgSW1wb3J0IGFuY2hvciBhdXNlbnRl
IGVtICR7Y3JtUm91dGV9YCk7CiAgICAgIGNvbnRlbnQgPQogICAgICAgIGNvbnRlbnQuc2xpY2UoMCwgZmlyc3RJbXBvcnRFbmQgKyAxKSArCiAgICAgICAg
ImltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAnQC9saWIvc2VjdXJpdHkvcmVxdWVzdCdcbiIgKwogICAg
ICAgIGNvbnRlbnQuc2xpY2UoZmlyc3RJbXBvcnRFbmQgKyAxKTsKICAgIH0KCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbXBhbnlQbGFuQWxsb3dz
KGNvbXBhbnlBY2Nlc3MuY29tcGFueSwgJ3Byb2Zpc3Npb25hbCcpIikpIHsKICAgICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgICBjb250
ZW50LAogICAgICAgIGAgIGlmICghY29tcGFueUFjY2Vzcy5jb21wYW55Py5pZCkgewogICAgcmV0dXJuIHsgc3VwYWJhc2VBZG1pbiwgZXJyb3I6IE5leHRS
ZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28gZW5jb250cmFkYS4nIH0sIHsgc3RhdHVzOiA0MDQgfSkgfQogIH0KCiAgcmV0dXJuIHsgc3Vw
YWJhc2VBZG1pbiwgcmVxdWVzdGVyLCBjb21wYW55QWNjZXNzIH1gLAogICAgICAgIGAgIGlmICghY29tcGFueUFjY2Vzcy5jb21wYW55Py5pZCkgewogICAg
cmV0dXJuIHsgc3VwYWJhc2VBZG1pbiwgZXJyb3I6IE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28gZW5jb250cmFkYS4nIH0sIHsg
c3RhdHVzOiA0MDQgfSkgfQogIH0KCiAgaWYgKAogICAgIWFzc2luYXR1cmFFc3RhQXRpdmEoY29tcGFueUFjY2Vzcy5jb21wYW55KSB8fAogICAgIWNvbXBh
bnlQbGFuQWxsb3dzKGNvbXBhbnlBY2Nlc3MuY29tcGFueSwgJ3Byb2Zpc3Npb25hbCcpCiAgKSB7CiAgICByZXR1cm4gewogICAgICBzdXBhYmFzZUFkbWlu
LAogICAgICBlcnJvcjogTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ0NSTSBkaXNwb27DrXZlbCBhIHBhcnRpciBkbyBwbGFubyBQcm9m
aXNzaW9uYWwgY29tIGFzc2luYXR1cmEgYXRpdmEuJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKSwKICAgIH0KICB9CgogIGlmICghY29t
cGFueUFjY2Vzcy5jYW5Qcm9wb3NhbCkgewogICAgcmV0dXJuIHsKICAgICAgc3VwYWJhc2VBZG1pbiwKICAgICAgZXJyb3I6IE5leHRSZXNwb25zZS5qc29u
KAogICAgICAgIHsgZXJyb3I6ICdTZXUgcGVyZmlsIG7Do28gcG9zc3VpIGFjZXNzbyBhbyBDUk0uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAg
ICAgKSwKICAgIH0KICB9CgogIHJldHVybiB7IHN1cGFiYXNlQWRtaW4sIHJlcXVlc3RlciwgY29tcGFueUFjY2VzcyB9YCwKICAgICAgICBgY3JtIGFjY2Vz
cyBnYXRlICR7Y3JtUm91dGV9YCwKICAgICAgKTsKICAgIH0KCiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICAiICAgIGNvbnN0IGJvZHkg
PSBhd2FpdCByZXF1ZXN0Lmpzb24oKSIsCiAgICAgICIgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3du
Pj4ocmVxdWVzdCwgMjQgKiAxMDI0KSIsCiAgICApOwoKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICAgIGAgIH0gY2F0Y2ggKGVycm9y
KSB7CiAgICBjb25zdCBtZXNzYWdlID1gLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJv
clJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcgoKICAgIGNvbnN0IG1lc3NhZ2UgPWAsCiAgICApOwogICAgcmV0
dXJuIGNvbnRlbnQ7CiAgfSk7Cn0KCnBhdGNoKCJhcHAvYXBpL2FpL29yY2FtZW50by9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNv
bnRlbnQucmVwbGFjZSgKICAgICJpbXBvcnQgeyBnZXRDb21wYW55QWNjZXNzLCBnZXRSZXF1ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xp
Yi9jb21wYW55LWFjY2VzcyciLAogICAgImltcG9ydCB7IGFzc2luYXR1cmFFc3RhQXRpdmEsIGdldENvbXBhbnlBY2Nlc3MsIGdldFJlcXVlc3RlciwgZ2V0
U3VwYWJhc2VBZG1pbiB9IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50
LAogICAgImltcG9ydCB7IGFzc2luYXR1cmFFc3RhQXRpdmEsIGdldENvbXBhbnlBY2Nlc3MsIGdldFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1pbiB9IGZy
b20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJ1xuIiwKICAgICJpbXBvcnQgeyBub3JtYWxpemVQbGFuS2V5IH0gZnJvbSAnQC9saWIvcGxhbnMvcGxhbi1jb25m
aWcnIiwKICAgICJvcmNhbWVudG8gQUkgcGxhbiBpbXBvcnQiLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygiaWYgKCFhc3NpbmF0dXJhRXN0YUF0
aXZhKGFjY2Vzcy5jb21wYW55KSkiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgICBjb25zdCBh
Y2Nlc3MgPSBhd2FpdCBnZXRDb21wYW55QWNjZXNzKHN1cGFiYXNlQWRtaW4sIHJlcXVlc3Rlci5pZCwgcmVxdWVzdGVyLmVtYWlsKQogICAgaWYgKCFhY2Nl
c3MuY29tcGFueT8uaWQpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnRW1wcmVzYSBuw6NvIGVuY29udHJhZGEuJyB9LCB7IHN0YXR1czog
NDA0IH0pCgogICAgY29uc3QgcGxhbiA9IFN0cmluZygKICAgICAgYWNjZXNzLmNvbXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fAogICAgICAgIGFjY2Vzcy5j
b21wYW55LnBsYW5vIHx8CiAgICAgICAgJ2Jhc2ljbycsCiAgICApLnRvTG93ZXJDYXNlKClgLAogICAgICBgICAgIGNvbnN0IGFjY2VzcyA9IGF3YWl0IGdl
dENvbXBhbnlBY2Nlc3Moc3VwYWJhc2VBZG1pbiwgcmVxdWVzdGVyLmlkLCByZXF1ZXN0ZXIuZW1haWwpCiAgICBpZiAoIWFjY2Vzcy5jb21wYW55Py5pZCkg
cmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28gZW5jb250cmFkYS4nIH0sIHsgc3RhdHVzOiA0MDQgfSkKICAgIGlmICgh
YXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdB
c3NpbmF0dXJhIHNlbSBhY2Vzc28gYXRpdm8uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKQogICAgfQoKICAgIGNvbnN0IHBsYW4gPSBu
b3JtYWxpemVQbGFuS2V5KAogICAgICBhY2Nlc3MuY29tcGFueS5hc3NpbmF0dXJhX3BsYW5vIHx8CiAgICAgICAgYWNjZXNzLmNvbXBhbnkucGxhbm8gfHwK
ICAgICAgICAnZXNzZW5jaWFsJywKICAgIClgLAogICAgICAib3JjYW1lbnRvIEFJIHN1YnNjcmlwdGlvbiBwbGFuIiwKICAgICk7CiAgfQogIGNvbnRlbnQg
PSBjb250ZW50LnJlcGxhY2UoImNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8YW55PihyZXF1ZXN0LCAxNiAqIDEwMjQpIiwgImNvbnN0IGJvZHkg
PSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KHJlcXVlc3QsIDE2ICogMTAyNCkiKTsKICByZXR1cm4gY29udGVudDsKfSk7
CgpwYXRjaCgiYXBwL2FwaS9tYXJrZXRwbGFjZS9jb3Vwb24vcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigK
ICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9y
ZXF1ZXN0J1xuIiwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcgfSBmcm9tICdAL2xpYi9zbHVnJyIsCiAgICAiY291cG9uIHNsdWcg
aW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxhbnk+KHJlcXVl
c3QsIDY0ICogMTAyNCkiLAogICAgImNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KHJlcXVlc3QsIDY0
ICogMTAyNCkiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhib2R5LnNsdWcgfHwgJycp
LnRyaW0oKSIsCiAgICAiICAgIGNvbnN0IHNsdWcgPSBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcoYm9keS5zbHVnKSIsCiAgKTsKICByZXR1cm4gY29udGVu
dDsKfSk7CgovLyA4LjIpIE9BdXRoIE1lcmNhZG8gUGFnbzogY29uc3VtbyBhdG9taWNvIGRlIHN0YXRlIGUgcHJvdGVjYW8gY29udHJhIHJlcGxheS4KcGF0
Y2goImFwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvbWVyY2Fkby1wYWdvL2NhbGxiYWNrL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNv
bnRlbnQuaW5jbHVkZXMoImxldCB2YWxpZGF0ZWRDb21wYW55SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5y
ZXBsYWNlKAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGNvbnN0IHN1cGFiYXNlQWRtaW4gPSBn
ZXRTdXBhYmFzZUFkbWluKCk7YCwKICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICBjb25zdCBzdXBh
YmFzZUFkbWluID0gZ2V0U3VwYWJhc2VBZG1pbigpOwogIGxldCB2YWxpZGF0ZWRDb21wYW55SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO2AsCiAgICApOwog
IH0KCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCB7IGRhdGE6IGNsYWltZWRTdGF0ZSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0
KAogICAgICBjb250ZW50LAogICAgICBgICAgIGlmICghb2F1dGhTdGF0ZT8uY29tcGFueV9pZCkgewogICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAg
IlN0YXRlIE9BdXRoIGludmFsaWRvLCBleHBpcmFkbyBvdSBqYSB1dGlsaXphZG8uIiwKICAgICAgKTsKICAgIH0KCiAgICBjb25zdCB0b2tlblBheWxvYWQg
PSBhd2FpdCBleGNoYW5nZU1lcmNhZG9QYWdvQ29kZShgLAogICAgICBgICAgIGlmICghb2F1dGhTdGF0ZT8uY29tcGFueV9pZCkgewogICAgICB0aHJvdyBu
ZXcgRXJyb3IoCiAgICAgICAgIlN0YXRlIE9BdXRoIGludmFsaWRvLCBleHBpcmFkbyBvdSBqYSB1dGlsaXphZG8uIiwKICAgICAgKTsKICAgIH0KCiAgICBj
b25zdCBjbGFpbWVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7CiAgICBjb25zdCB7IGRhdGE6IGNsYWltZWRTdGF0ZSwgZXJyb3I6IGNsYWltRXJy
b3IgfSA9CiAgICAgIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgICAuZnJvbSgibWFya2V0cGxhY2Vfb2F1dGhfc3RhdGVzIikKICAgICAgICAudXBkYXRl
KHsgY29uc3VtZWRfYXQ6IGNsYWltZWRBdCB9KQogICAgICAgIC5lcSgiaWQiLCBvYXV0aFN0YXRlLmlkKQogICAgICAgIC5pcygiY29uc3VtZWRfYXQiLCBu
dWxsKQogICAgICAgIC5ndCgiZXhwaXJlc19hdCIsIGNsYWltZWRBdCkKICAgICAgICAuc2VsZWN0KCJpZCxjb21wYW55X2lkIikKICAgICAgICAubWF5YmVT
aW5nbGUoKTsKCiAgICBpZiAoY2xhaW1FcnJvcikgdGhyb3cgY2xhaW1FcnJvcjsKICAgIGlmICghY2xhaW1lZFN0YXRlPy5pZCB8fCAhY2xhaW1lZFN0YXRl
LmNvbXBhbnlfaWQpIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICJTdGF0ZSBPQXV0aCBpbnZhbGlkbywgZXhwaXJhZG8gb3UgamEgdXRpbGl6
YWRvLiIsCiAgICAgICk7CiAgICB9CgogICAgdmFsaWRhdGVkQ29tcGFueUlkID0gU3RyaW5nKGNsYWltZWRTdGF0ZS5jb21wYW55X2lkKTsKCiAgICBjb25z
dCB0b2tlblBheWxvYWQgPSBhd2FpdCBleGNoYW5nZU1lcmNhZG9QYWdvQ29kZShgLAogICAgICAiYXRvbWljIG9hdXRoIHN0YXRlIGNsYWltIiwKICAgICk7
CiAgfQoKICAvLyBVc2EgYXBlbmFzIGEgZW1wcmVzYSBkbyBzdGF0ZSBhdG9taWNhbGx5IGNsYWltZWQuCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZUFs
bCgib2F1dGhTdGF0ZS5jb21wYW55X2lkIiwgInZhbGlkYXRlZENvbXBhbnlJZCIpOwoKICAvLyBPIHN0YXRlIGphIGZvaSBjb25zdW1pZG8gYXRvbWljYW1l
bnRlOyByZW1vdmUgbyB1cGRhdGUgdGFyZGlvLgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAg
ICAgLmZyb20oIm1hcmtldHBsYWNlX29hdXRoX3N0YXRlcyIpCiAgICAgIC51cGRhdGUoewogICAgICAgIGNvbnN1bWVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNP
U3RyaW5nKCksCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBvYXV0aFN0YXRlLmlkKTsKCmAsCiAgICAiIiwKICApOwoKICAvLyBDYXRjaCBudW5jYSBwZXNx
dWlzYSB1bSBzdGF0ZSBhcmJpdHJhcmlvL3JldXRpbGl6YWRvLgogIGNvbnRlbnQgPSByZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAgIC8gICAg
aWYgXChzdGF0ZVwpIFx7W1xzXFNdKj8gICAgXH1cblxuICAgIHJldHVybiBOZXh0UmVzcG9uc2VcLnJlZGlyZWN0XCgvLAogICAgYCAgICBpZiAodmFsaWRh
dGVkQ29tcGFueUlkKSB7CiAgICAgIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgICAuZnJvbSgibWFya2V0cGxhY2VfcGF5bWVudF9zZXR0aW5ncyIpCiAg
ICAgICAgLnVwc2VydCgKICAgICAgICAgIHsKICAgICAgICAgICAgY29tcGFueV9pZDogdmFsaWRhdGVkQ29tcGFueUlkLAogICAgICAgICAgICBwcm92aWRl
cjogIm1lcmNhZG9fcGFnbyIsCiAgICAgICAgICAgIG9uYm9hcmRpbmdfc3RhdHVzOiAiZXJyb3IiLAogICAgICAgICAgICBhY2NvdW50X3N0YXR1czogImVy
cm9yIiwKICAgICAgICAgICAgaXNfYWN0aXZlOiBmYWxzZSwKICAgICAgICAgICAgY2hhcmdlc19lbmFibGVkOiBmYWxzZSwKICAgICAgICAgICAgcGl4X2Vu
YWJsZWQ6IGZhbHNlLAogICAgICAgICAgICBjYXJkX2VuYWJsZWQ6IGZhbHNlLAogICAgICAgICAgICBsYXN0X3N0YXR1c19jaGVja19hdDogbmV3IERhdGUo
KS50b0lTT1N0cmluZygpLAogICAgICAgICAgICBsYXN0X2Vycm9yOiBtZXNzYWdlLnNsaWNlKDAsIDUwMCksCiAgICAgICAgICAgIHVwZGF0ZWRfYXQ6IG5l
dyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICAgIH0sCiAgICAgICAgICB7IG9uQ29uZmxpY3Q6ICJjb21wYW55X2lkLHByb3ZpZGVyIiB9LAogICAg
ICAgICk7CiAgICB9CgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5yZWRpcmVjdChgLAogICAgIm9hdXRoIGNhdGNoIG9ubHkgdmFsaWRhdGVkIHN0YXRlIiwK
ICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9tYXJrZXRwbGFjZS9wYXltZW50cy9tZXJjYWRvLXBhZ28vY29ubmVjdC9yb3V0
ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIGdldENvbXBhbnlBY2Nlc3MsCiAgZ2V0UmVxdWVzdGVy
LAogIGdldFN1cGFiYXNlQWRtaW4sYCwKICAgIGAgIGFzc2luYXR1cmFFc3RhQXRpdmEsCiAgY29tcGFueVBsYW5BbGxvd3MsCiAgZ2V0Q29tcGFueUFjY2Vz
cywKICBnZXRSZXF1ZXN0ZXIsCiAgZ2V0U3VwYWJhc2VBZG1pbixgLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAg
ICd9IGZyb20gIkAvbGliL2NvbXBhbnktYWNjZXNzIjtcbicsCiAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5
L3JhdGUtbGltaXQiOycsCiAgICAibXAgY29ubmVjdCByYXRlIGltcG9ydCIsCiAgKTsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImlmICghYXNzaW5hdHVy
YUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkpIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAg
aWYgKCFhY2Nlc3MuY29tcGFueT8uaWQpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICJFbXByZXNhIG5hbyBl
bmNvbnRyYWRhLiIgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAgICk7CiAgICB9CgogICAgaWYgKCFhY2Nlc3MuY2FuQ29uZmlnICYmICFhY2Nl
c3MuY2FuRmluYW5jZSkge2AsCiAgICAgIGAgICAgaWYgKCFhY2Nlc3MuY29tcGFueT8uaWQpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAog
ICAgICAgIHsgZXJyb3I6ICJFbXByZXNhIG5hbyBlbmNvbnRyYWRhLiIgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAgICk7CiAgICB9CgogICAg
aWYgKAogICAgICAhYXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkgfHwKICAgICAgIWNvbXBhbnlQbGFuQWxsb3dzKGFjY2Vzcy5jb21wYW55
LCAicHJvZmlzc2lvbmFsIikKICAgICkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogIlBhZ2FtZW50b3Mgb25s
aW5lIGV4aWdlbSBwbGFubyBQcm9maXNzaW9uYWwgb3UgUHJlbWl1bSBjb20gYXNzaW5hdHVyYSBhdGl2YS4iIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMyB9
LAogICAgICApOwogICAgfQoKICAgIGlmICghYWNjZXNzLmNhbkNvbmZpZyAmJiAhYWNjZXNzLmNhbkZpbmFuY2UpIHtgLAogICAgICAibXAgY29ubmVjdCBz
dWJzY3JpcHRpb24gZ2F0ZSIsCiAgICApOwogIH0KICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ3Njb3BlOiAibWFya2V0cGxhY2UtbXAtY29ubmVjdCInKSkg
ewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgICBpZiAoIWFjY2Vzcy5jYW5Db25maWcgJiYgIWFjY2Vz
cy5jYW5GaW5hbmNlKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAgICAgICB7CiAgICAgICAgICBlcnJvcjoKICAgICAgICAgICAgIlNl
bSBwZXJtaXNzYW8gcGFyYSBjb25maWd1cmFyIHBhZ2FtZW50b3MuIiwKICAgICAgICB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKTsKICAg
IH0KCiAgICBjb25zdCBvYXV0aCA9IGdlbmVyYXRlTWVyY2Fkb1BhZ29PYXV0aEZsb3coKTtgLAogICAgICBgICAgIGlmICghYWNjZXNzLmNhbkNvbmZpZyAm
JiAhYWNjZXNzLmNhbkZpbmFuY2UpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsKICAgICAgICAgIGVycm9yOgogICAgICAg
ICAgICAiU2VtIHBlcm1pc3NhbyBwYXJhIGNvbmZpZ3VyYXIgcGFnYW1lbnRvcy4iLAogICAgICAgIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMyB9LAogICAg
ICApOwogICAgfQoKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICJtYXJrZXRwbGFj
ZS1tcC1jb25uZWN0IiwKICAgICAgaWRlbnRpdHk6IHJlcXVlc3Rlci5pZCwKICAgICAgbGltaXQ6IDEwLAogICAgICB3aW5kb3dTZWNvbmRzOiAzNjAwLAog
ICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7CgogICAgY29uc3Qgb2F1dGggPSBnZW5lcmF0ZU1lcmNhZG9QYWdvT2F1dGhGbG93KCk7
YCwKICAgICAgIm1wIGNvbm5lY3QgcmF0ZSBsaW1pdCIsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgovLyA5KSBTdG9yYWdlIGludGVybm86
IFNWRyBuw6NvIHNhbml0aXphZG8gZGVpeGEgZGUgc2VyIGFjZWl0bwpwYXRjaCgibGliL3BhbmVsLXN0b3JhZ2UudHMiLCAoY29udGVudCkgPT4gewogIGNv
bnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgIG1pbWVUeXBlczogWydpbWFnZS9wbmcnLCAnaW1hZ2UvanBlZycsICdpbWFnZS9qcGcnLCAnaW1h
Z2Uvd2VicCcsICdpbWFnZS9zdmcreG1sJ10sIiwKICAgICIgICAgbWltZVR5cGVzOiBbJ2ltYWdlL3BuZycsICdpbWFnZS9qcGVnJywgJ2ltYWdlL2pwZycs
ICdpbWFnZS93ZWJwJ10sIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgIGV4dGVuc2lvbnM6IFsncG5nJywgJ2pwZycsICdq
cGVnJywgJ3dlYnAnLCAnc3ZnJ10sIiwKICAgICIgICAgZXh0ZW5zaW9uczogWydwbmcnLCAnanBnJywgJ2pwZWcnLCAnd2VicCddLCIsCiAgKTsKICByZXR1
cm4gY29udGVudDsKfSk7CgovLyAxMCkgTGltaXRlcyBkZSBjb3JwbyBjb21wYXJ0aWxoYWRvcwpwYXRjaCgibGliL3NlY3VyaXR5L3JlcXVlc3QudHMiLCAo
Y29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRUZXh0Qm9keSIpKSB7CiAgICBjb25zdCBt
YXJrZXIgPSAiXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZEpzb25Cb2R5IjsKICAgIGNvbnN0IGhlbHBlciA9IGAKZXhwb3J0IGFzeW5jIGZ1bmN0aW9u
IHJlYWRUZXh0Qm9keSgKICByZXF1ZXN0OiBOZXh0UmVxdWVzdCwKICBtYXhCeXRlczogbnVtYmVyLAopOiBQcm9taXNlPHN0cmluZz4gewogIGNvbnN0IGRl
Y2xhcmVkID0gTnVtYmVyKHJlcXVlc3QuaGVhZGVycy5nZXQoJ2NvbnRlbnQtbGVuZ3RoJykgfHwgMCkKCiAgaWYgKGRlY2xhcmVkID4gbWF4Qnl0ZXMpIHsK
ICAgIHRocm93IG5ldyBSZXF1ZXN0Qm9keUVycm9yKCdSZXF1aXNpY2FvIG11aXRvIGdyYW5kZS4nLCA0MTMpCiAgfQoKICBjb25zdCBidWZmZXIgPSBhd2Fp
dCByZXF1ZXN0LmFycmF5QnVmZmVyKCkKCiAgaWYgKGJ1ZmZlci5ieXRlTGVuZ3RoID4gbWF4Qnl0ZXMpIHsKICAgIHRocm93IG5ldyBSZXF1ZXN0Qm9keUVy
cm9yKCdSZXF1aXNpY2FvIG11aXRvIGdyYW5kZS4nLCA0MTMpCiAgfQoKICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGJ1ZmZlcikKfQpgOwog
ICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBtYXJrZXIsIGAke2hlbHBlcn0ke21hcmtlcn1gLCAicmVhZFRleHRCb2R5Iik7CiAgICBj
b250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICBjb25zdCBkZWNsYXJlZCA9IE51bWJlcihyZXF1ZXN0LmhlYWRlcnMuZ2V0KCdjb250ZW50LWxl
bmd0aCcpIHx8IDApCgogIGlmIChkZWNsYXJlZCA+IG1heEJ5dGVzKSB7CiAgICB0aHJvdyBuZXcgUmVxdWVzdEJvZHlFcnJvcignUmVxdWlzaWNhbyBtdWl0
byBncmFuZGUuJywgNDEzKQogIH0KCiAgY29uc3QgYnVmZmVyID0gYXdhaXQgcmVxdWVzdC5hcnJheUJ1ZmZlcigpCgogIGlmIChidWZmZXIuYnl0ZUxlbmd0
aCA+IG1heEJ5dGVzKSB7CiAgICB0aHJvdyBuZXcgUmVxdWVzdEJvZHlFcnJvcignUmVxdWlzaWNhbyBtdWl0byBncmFuZGUuJywgNDEzKQogIH0KCiAgdHJ5
IHsKICAgIHJldHVybiBKU09OLnBhcnNlKG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShidWZmZXIpIHx8ICd7fScpIGFzIFRgLAogICAgICBgICBjb25zdCBy
YXcgPSBhd2FpdCByZWFkVGV4dEJvZHkocmVxdWVzdCwgbWF4Qnl0ZXMpCgogIHRyeSB7CiAgICByZXR1cm4gSlNPTi5wYXJzZShyYXcgfHwgJ3t9JykgYXMg
VGAsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgovLyBIb21lIEFJOiBzZSByYXRlIGxpbWl0IGNhaXIsIHVzYSByZXNwb3N0YSBndWlhZGEg
c2VtIGdhc3RhciBtb2RlbG8uCnBhdGNoKCJhcHAvYXBpL3B1YmxpYy9ob21lLWNoYXQvcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBh
ZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JhdGUtbGlt
aXQnXG4iLAogICAgImltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAnQC9saWIvc2VjdXJpdHkvcmVxdWVz
dCciLAogICAgImhvbWUgQUkgYm9keSBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSByZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAgIC9leHBv
cnQgYXN5bmMgZnVuY3Rpb24gUE9TVFwocmVxdWVzdDogTmV4dFJlcXVlc3RcKSBce1tcc1xTXSpcblx9JC8sCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9u
IFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTx7CiAgICAgIHF1ZXN0aW9u
PzogdW5rbm93bgogICAgICBtZXNzYWdlcz86IHVua25vd24KICAgIH0+KHJlcXVlc3QsIDIwICogMTAyNCkKICAgIGNvbnN0IHF1ZXN0aW9uID0gY2xlYW5U
ZXh0KGJvZHkucXVlc3Rpb24sIDcwMCkKICAgIGNvbnN0IG1lc3NhZ2VzID0gbm9ybWFsaXplTWVzc2FnZXMoYm9keS5tZXNzYWdlcykKCiAgICBpZiAocXVl
c3Rpb24ubGVuZ3RoIDwgMikgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ0RpZ2l0ZSB1bWEgcGVyZ3VudGEu
JyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDAgfSwKICAgICAgKQogICAgfQoKICAgIGNvbnN0IGxpbWl0ZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJl
cXVlc3QsIHsKICAgICAgc2NvcGU6ICdwdWJsaWMtaG9tZS1haS1jaGF0LXYyJywKICAgICAgbGltaXQ6IDI0LAogICAgICB3aW5kb3dTZWNvbmRzOiA2MDAs
CiAgICB9KQoKICAgIGlmIChsaW1pdGVkKSB7CiAgICAgIGlmIChsaW1pdGVkLnN0YXR1cyA9PT0gNDI5KSByZXR1cm4gbGltaXRlZAoKICAgICAgY29uc3Qg
ZmFsbGJhY2sgPSBndWlkZWRBbnN3ZXIocXVlc3Rpb24pCiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7CiAgICAgICAgLi4uZmFsbGJhY2ssCiAg
ICAgICAgc291cmNlOiAnZ3VpZGVkLXByb3RlY3Rpb24nLAogICAgICB9KQogICAgfQoKICAgIGNvbnN0IGFpUmVzdWx0ID0gYXdhaXQgZ2VuZXJhdGVBbnN3
ZXIocXVlc3Rpb24sIG1lc3NhZ2VzKQoKICAgIGlmIChhaVJlc3VsdCkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oewogICAgICAgIGFuc3dl
cjogYWlSZXN1bHQuYW5zd2VyLAogICAgICAgIHN1Z2dlc3Rpb25zOiBhaVJlc3VsdC5zdWdnZXN0aW9ucywKICAgICAgICBhY3Rpb246IGFpUmVzdWx0LmFj
dGlvbiwKICAgICAgICBzb3VyY2U6ICdhaScsCiAgICAgIH0pCiAgICB9CgogICAgY29uc3QgZmFsbGJhY2sgPSBndWlkZWRBbnN3ZXIocXVlc3Rpb24pCgog
ICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsKICAgICAgLi4uZmFsbGJhY2ssCiAgICAgIHNvdXJjZTogJ2d1aWRlZCcsCiAgICB9KQogIH0gY2F0Y2gg
KGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpCiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4g
Ym9keUVycm9yCgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICB7IGVycm9yOiAnTsOjbyBmb2kgcG9zc8OtdmVsIHByb2Nlc3NhciBhIHBl
cmd1bnRhLicgfSwKICAgICAgeyBzdGF0dXM6IDQwMCB9LAogICAgKQogIH0KfWAsCiAgICAiaG9tZSBBSSBmYWlsIGNsb3NlZCB3aXRoIGd1aWRlZCBmYWxs
YmFjayIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgovLyBJbnRlcm5hbCBBSTogcGxhbm8gbm9ybWFsaXphZG8gKyBhc3NpbmF0dXJhIGF0aXZhLgpw
YXRjaCgiYXBwL2FwaS9haS9idXNpbmVzcy1hc3Npc3RhbnQvcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2Uo
CiAgICAiaW1wb3J0IHsgZ2V0Q29tcGFueUFjY2VzcywgZ2V0UmVxdWVzdGVyLCBnZXRTdXBhYmFzZUFkbWluIH0gZnJvbSAnQC9saWIvY29tcGFueS1hY2Nl
c3MnIiwKICAgICJpbXBvcnQgeyBhc3NpbmF0dXJhRXN0YUF0aXZhLCBnZXRDb21wYW55QWNjZXNzLCBnZXRSZXF1ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4g
fSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcyciLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQg
eyBhc3NpbmF0dXJhRXN0YUF0aXZhLCBnZXRDb21wYW55QWNjZXNzLCBnZXRSZXF1ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21w
YW55LWFjY2VzcydcbiIsCiAgICAiaW1wb3J0IHsgbm9ybWFsaXplUGxhbktleSB9IGZyb20gJ0AvbGliL3BsYW5zL3BsYW4tY29uZmlnJyIsCiAgICAiYnVz
aW5lc3MgQUkgcGxhbiBpbXBvcnQiLAogICk7CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJpZiAoIWFzc2luYXR1cmFFc3RhQXRpdmEoYWNjZXNzLmNvbXBh
bnkpKSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgIGlmICghYWNjZXNzLmNvbXBhbnk/Lmlk
KSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnRW1wcmVzYSBuw6NvIGVuY29udHJhZGEuJyB9LCB7IHN0YXR1czogNDA0IH0p
CiAgICB9CgogICAgY29uc3QgcGxhbiA9IFN0cmluZygKICAgICAgYWNjZXNzLmNvbXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fAogICAgICAgIGFjY2Vzcy5j
b21wYW55LnBsYW5vIHx8CiAgICAgICAgJ2Jhc2ljbycsCiAgICApLnRvTG93ZXJDYXNlKClgLAogICAgICBgICAgIGlmICghYWNjZXNzLmNvbXBhbnk/Lmlk
KSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnRW1wcmVzYSBuw6NvIGVuY29udHJhZGEuJyB9LCB7IHN0YXR1czogNDA0IH0p
CiAgICB9CgogICAgaWYgKCFhc3NpbmF0dXJhRXN0YUF0aXZhKGFjY2Vzcy5jb21wYW55KSkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAg
ICAgICAgeyBlcnJvcjogJ0Fzc2luYXR1cmEgc2VtIGFjZXNzbyBhdGl2by4nIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMyB9LAogICAgICApCiAgICB9Cgog
ICAgY29uc3QgcGxhbiA9IG5vcm1hbGl6ZVBsYW5LZXkoCiAgICAgIGFjY2Vzcy5jb21wYW55LmFzc2luYXR1cmFfcGxhbm8gfHwKICAgICAgICBhY2Nlc3Mu
Y29tcGFueS5wbGFubyB8fAogICAgICAgICdlc3NlbmNpYWwnLAogICAgKWAsCiAgICAgICJidXNpbmVzcyBBSSBzdWJzY3JpcHRpb24gKyBwbGFuIiwKICAg
ICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDExKSBXZWJob29rcyBjb20gYnl0ZSBsaW1pdApwYXRjaCgiYXBwL2FwaS9tZXJjYWRvLXBhZ28v
d2ViaG9vay9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBO
ZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xuJywKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5
RXJyb3JSZXNwb25zZSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiOycsCiAgICAic3Vic2NyaXB0aW9uIHdlYmhvb2sgYm9keSBpbXBvcnQiLAog
ICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3QgYm9keSA9IHJlY29yZCgKICAgICAgYXdhaXQgcmVxdWVzdC5qc29uKCku
Y2F0Y2goKCkgPT4gKHt9KSksCiAgICApO2AsCiAgICBgICAgIGNvbnN0IGJvZHkgPSByZWNvcmQoCiAgICAgIGF3YWl0IHJlYWRKc29uQm9keTxKc29uUmVj
b3JkPihyZXF1ZXN0LCA2NCAqIDEwMjQpLAogICAgKTtgLAogICk7CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0
Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewog
ICAgY29uc3QgbWVzc2FnZSA9YCwKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNw
b25zZShlcnJvcik7CiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yOwoKICAgIGNvbnN0IG1lc3NhZ2UgPWAsCiAgICApOwogIH0KICByZXR1
cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9hc3NpbmF0dXJhL2NoZWNrb3V0L3dlYmhvb2svcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNv
bnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHsgZ2V0U3Vic2NyaXB0aW9uV2ViaG9va1NlY3JldCB9IGZyb20gJ0Av
bGliL3BheW1lbnRzL3N1YnNjcmlwdGlvbi9tZXJjYWRvLXBhZ28nXG4iLAogICAgImltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJl
c3BvbnNlIH0gZnJvbSAnQC9saWIvc2VjdXJpdHkvcmVxdWVzdCciLAogICAgImNoZWNrb3V0IHdlYmhvb2sgYm9keSBpbXBvcnQiLAogICk7CiAgY29udGVu
dCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3QgYm9keSA9IChhd2FpdCByZXF1ZXN0CiAgICAgIC5qc29uKCkKICAgICAgLmNhdGNoKCgpID0+
ICh7fSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPmAsCiAgICBgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmlu
ZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICA2NCAqIDEwMjQsCiAgICApYCwKICApOwogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3Qg
Ym9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKSIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICB9
IGNhdGNoIChlcnJvcikgewogICAgY29uc29sZS5lcnJvcihgLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVx
dWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcgoKICAgIGNvbnNvbGUuZXJyb3IoYCwKICAg
ICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBpL21lcmNhZG8tcGFnby93ZWJob29rLWxlYWRzL3JvdXRlLnRzIiwgKGNvbnRl
bnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2Ug
fSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9s
aWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJsZWFkIHdlYmhvb2sgYm9keSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgo
CiAgICBjb250ZW50LAogICAgL2V4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUXChyZXF1ZXN0OiBOZXh0UmVxdWVzdFwpIFx7W1xzXFNdKlxuXH0kLywKICAg
IGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBsZXQgcGF5bWVudElkID0gZ2V0UGF5bWVu
dElkRnJvbVVybChyZXF1ZXN0KTsKCiAgICBpZiAoIXBheW1lbnRJZCkgewogICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PHsKICAgICAg
ICBkYXRhPzogeyBpZD86IHVua25vd24gfTsKICAgICAgICBpZD86IHVua25vd247CiAgICAgICAgcGF5bWVudF9pZD86IHVua25vd247CiAgICAgIH0+KHJl
cXVlc3QsIDY0ICogMTAyNCk7CgogICAgICBwYXltZW50SWQgPSBTdHJpbmcoCiAgICAgICAgYm9keT8uZGF0YT8uaWQgfHwgYm9keT8uaWQgfHwgYm9keT8u
cGF5bWVudF9pZCB8fCAiIiwKICAgICAgKTsKICAgIH0KCiAgICBjb25zdCB2YWxpZCA9IHZlcmlmeU1lcmNhZG9QYWdvV2ViaG9va1NpZ25hdHVyZSh7CiAg
ICAgIHhTaWduYXR1cmU6IHJlcXVlc3QuaGVhZGVycy5nZXQoIngtc2lnbmF0dXJlIiksCiAgICAgIHhSZXF1ZXN0SWQ6IHJlcXVlc3QuaGVhZGVycy5nZXQo
IngtcmVxdWVzdC1pZCIpLAogICAgICBkYXRhSWQ6IFN0cmluZyhwYXltZW50SWQgfHwgIiIpIHx8IG51bGwsCiAgICAgIHNlY3JldDogZ2V0U2lnbnVwV2Vi
aG9va1NlY3JldCgpLAogICAgfSk7CgogICAgaWYgKCF2YWxpZCkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjog
IkFzc2luYXR1cmEgaW52w6FsaWRhLiIgfSwKICAgICAgICB7IHN0YXR1czogNDAxIH0sCiAgICAgICk7CiAgICB9CgogICAgcmV0dXJuIE5leHRSZXNwb25z
ZS5qc29uKAogICAgICBhd2FpdCBwcm9jZXNzUGF5bWVudChTdHJpbmcocGF5bWVudElkIHx8ICIiKSksCiAgICApOwogIH0gY2F0Y2ggKGVycm9yKSB7CiAg
ICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpOwogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcjsK
CiAgICBjb25zb2xlLmVycm9yKAogICAgICAib3JjYWx5X3NpZ251cF93ZWJob29rX2Vycm9yIiwKICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVy
cm9yLm1lc3NhZ2UgOiBlcnJvciwKICAgICk7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgIHsgZXJyb3I6ICJOw6NvIGZvaSBwb3Nzw612
ZWwgcHJvY2Vzc2FyIG8gd2ViaG9vay4iIH0sCiAgICAgIHsgc3RhdHVzOiA1MDAgfSwKICAgICk7CiAgfQp9YCwKICAgICJzaWdudXAgd2ViaG9vayBib3Vu
ZGVkIGJvZHkiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvd2ViaG9va3MvYXNhYXMvcm91dGUudHMiLCAoY29udGVudCkg
PT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZy
b20gIm5leHQvc2VydmVyIjtcbicsCiAgICAnaW1wb3J0IHsgcmVhZFRleHRCb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9z
ZWN1cml0eS9yZXF1ZXN0IjsnLAogICAgImFzYWFzIGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNv
bnN0IHJhd1RleHQgPSBhd2FpdCByZXF1ZXN0LnRleHQoKTtgLAogICAgYCAgICBjb25zdCByYXdUZXh0ID0gYXdhaXQgcmVhZFRleHRCb2R5KHJlcXVlc3Qs
IDEyOCAqIDEwMjQpO2AsCiAgKTsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShl
cnJvcik7IikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zb2xlLmVycm9yKCJb
T3JjYWx5IGZpbmFuY2Vpcm9dIEZhbGhhIG5vIHdlYmhvb2s6IixgLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0g
cmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CgogICAgY29uc29sZS5lcnJvcigi
W09yY2FseSBmaW5hbmNlaXJvXSBGYWxoYSBubyB3ZWJob29rOiIsYCwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIE1hcmtldHBsYWNl
IE1lcmNhZG8gUGFnbzogYXNzaW5hdHVyYSBvYnJpZ2F0w7NyaWEsIGJvZHkgbGltaXRhZG8gZSBwYXlsb2FkIHNhbml0aXphZG8uCnBhdGNoKCJhcHAvYXBp
L21hcmtldHBsYWNlL3BheW1lbnRzL3dlYmhvb2svbWVyY2Fkby1wYWdvL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0
QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcydcbiIsCiAgICAi
aW1wb3J0IHsgY2xlYW5TZW5zaXRpdmVQYXlsb2FkIH0gZnJvbSAnQC9saWIvcGF5bWVudHMvc2VydmVyLWNvbnRleHQnIiwKICAgICJtYXJrZXRwbGFjZSB3
ZWJob29rIHNhbml0aXplIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGNsZWFu
U2Vuc2l0aXZlUGF5bG9hZCB9IGZyb20gJ0AvbGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0J1xuIiwKICAgICJpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJl
cXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JlcXVlc3QnIiwKICAgICJtYXJrZXRwbGFjZSB3ZWJob29rIGJvZHkgaW1w
b3J0IiwKICApOwoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1
ZXN0OiBOZXh0UmVxdWVzdCkgewogIGNvbnN0IHN1cGFiYXNlQWRtaW4gPSBnZXRTdXBhYmFzZUFkbWluKCkKICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVl
c3QudXJsKQogIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKQogIGNvbnN0IHBheW1lbnRJZCA9IGV4dHJhY3RQ
YXltZW50SWQoYm9keSwgdXJsKQogIGNvbnN0IG1hcmtldHBsYWNlUGF5bWVudElkRnJvbVVybCA9IFN0cmluZygKICAgIHVybC5zZWFyY2hQYXJhbXMuZ2V0
KCdtYXJrZXRwbGFjZV9wYXltZW50X2lkJykgfHwgJycsCiAgKQogIGNvbnN0IGNvbXBhbnlJZEZyb21VcmwgPSBTdHJpbmcoCiAgICB1cmwuc2VhcmNoUGFy
YW1zLmdldCgnY29tcGFueV9pZCcpIHx8ICcnLAogICkKCiAgdHJ5IHsKICAgIGNvbnN0IHNlY3JldCA9IGdldE1hcmtldHBsYWNlV2ViaG9va1NlY3JldCgp
YCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGNvbnN0IHN1cGFiYXNlQWRtaW4gPSBnZXRTdXBh
YmFzZUFkbWluKCkKICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJsKQogIGxldCBib2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9CiAg
Y29uc3QgbWFya2V0cGxhY2VQYXltZW50SWRGcm9tVXJsID0gU3RyaW5nKAogICAgdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ21hcmtldHBsYWNlX3BheW1lbnRf
aWQnKSB8fCAnJywKICApCiAgY29uc3QgY29tcGFueUlkRnJvbVVybCA9IFN0cmluZygKICAgIHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdjb21wYW55X2lkJykg
fHwgJycsCiAgKQoKICB0cnkgewogICAgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3Qs
CiAgICAgIDY0ICogMTAyNCwKICAgICkKICAgIGNvbnN0IHBheW1lbnRJZCA9IGV4dHJhY3RQYXltZW50SWQoYm9keSwgdXJsKQogICAgY29uc3Qgc2VjcmV0
ID0gZ2V0TWFya2V0cGxhY2VXZWJob29rU2VjcmV0KClgLAogICAgIm1hcmtldHBsYWNlIHdlYmhvb2sgYm91bmRlZCBib2R5IiwKICApOwoKICBjb250ZW50
ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgaWYgKCF4U2lnbmF0dXJlIHx8ICF4UmVxdWVzdElkKSB7CiAgICAgIHJldHVybiBO
ZXh0UmVzcG9uc2UuanNvbih7CiAgICAgICAgb2s6IHRydWUsCiAgICAgICAgaWdub3JlZDogJ05vdGlmaWNhY2FvIGxlZ2FkYSBzZW0gYXNzaW5hdHVyYS4n
LAogICAgICB9KQogICAgfWAsCiAgICBgICAgIGlmICgheFNpZ25hdHVyZSB8fCAheFJlcXVlc3RJZCkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpz
b24oCiAgICAgICAgeyBlcnJvcjogJ0Fzc2luYXR1cmEgb2JyaWdhdG9yaWEgYXVzZW50ZS4nIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMSB9LAogICAgICAp
CiAgICB9YCwKICAgICJtYXJrZXRwbGFjZSB3ZWJob29rIHVuc2lnbmVkIHJlamVjdGlvbiIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgICIgICAgICAgICAgcmF3X3BheWxvYWQ6IG1wUGF5bWVudCwiLAogICAgIiAgICAgICAgICByYXdfcGF5bG9hZDogY2xlYW5TZW5zaXRpdmVQYXlsb2Fk
KG1wUGF5bWVudCksIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgICAgICAgIHJhd19wYXlsb2FkOiBib2R5LCIsCiAgICAi
ICAgICAgICAgIHJhd19wYXlsb2FkOiBjbGVhblNlbnNpdGl2ZVBheWxvYWQoYm9keSksIiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0
IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcikiKSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYCAg
fSBjYXRjaCAoZXJyb3IpIHsKICAgIGlmIChtYXJrZXRwbGFjZVBheW1lbnRJZEZyb21VcmwgJiYgY29tcGFueUlkRnJvbVVybCkge2AsCiAgICAgIGAgIH0g
Y2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpCiAgICBpZiAoYm9keUVycm9yKSBy
ZXR1cm4gYm9keUVycm9yCgogICAgaWYgKG1hcmtldHBsYWNlUGF5bWVudElkRnJvbVVybCAmJiBjb21wYW55SWRGcm9tVXJsKSB7YCwKICAgICk7CiAgfQoK
ICByZXR1cm4gY29udGVudDsKfSk7CgovLyBDaGVja291dCBhdnVsc28gZGEgYXNzaW5hdHVyYTogYm9keSBsaW1pdGFkbyBlIG51bmNhIHBlcnNpc3RlIHBh
eWxvYWQgZmluYW5jZWlybyBjcnUuCnBhdGNoKCJsaWIvc3Vic2NyaXB0aW9uLWNoZWNrb3V0LXBheW1lbnQudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRl
bnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHR5cGUgeyBOZXh0UmVxdWVzdCB9IGZyb20gIm5leHQvc2VydmVyIjtcbics
CiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJzdWJzY3JpcHRpb24gY2hlY2tvdXQg
Ym9keSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHkgfSBm
cm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjtcbicsCiAgICAnaW1wb3J0IHsgY2xlYW5TZW5zaXRpdmVQYXlsb2FkIH0gZnJvbSAiQC9saWIvcGF5bWVu
dHMvc2VydmVyLWNvbnRleHQiOycsCiAgICAic3Vic2NyaXB0aW9uIGNoZWNrb3V0IHNhbml0aXplIGltcG9ydCIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRl
bnQucmVwbGFjZSgKICAgIGAgIGNvbnN0IGJvZHkgPSAoYXdhaXQgcmVxdWVzdC5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSkpIGFzIEpzb25SZWNvcmQ7YCwK
ICAgIGAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8SnNvblJlY29yZD4ocmVxdWVzdCwgMzIgKiAxMDI0KTtgLAogICk7CgogIGNvbnRlbnQg
PSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICAiICAgICAgICByYXdfcGF5bWVudDogcGF5bWVudCwiLAogICAgIiAgICAgICAgcmF3X3BheW1lbnQ6IGNsZWFu
U2Vuc2l0aXZlUGF5bG9hZChwYXltZW50KSwiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZUFsbCgKICAgICIgICAgICAgICAgICByYXdfcGF5
bWVudDogcGF5bWVudCwiLAogICAgIiAgICAgICAgICAgIHJhd19wYXltZW50OiBjbGVhblNlbnNpdGl2ZVBheWxvYWQocGF5bWVudCksIiwKICApOwogIHJl
dHVybiBjb250ZW50Owp9KTsKCgovLyBJZGVtcG90w6puY2lhIGRlIHBhZ2FtZW50byBhdnVsc28gZGUgYXNzaW5hdHVyYTogbyBjbGllbnRlIHJldXRpbGl6
YSBhIGNoYXZlCi8vIGFww7NzIGZhbGhhIGRlIHJlZGUgZSBvIHNlcnZpZG9yIGV4aWdlIFVVSUQgcGFyYSBpbXBlZGlyIGR1cGxpY2lkYWRlIGFjaWRlbnRh
bC4KcGF0Y2goImNvbXBvbmVudHMvc3Vic2NyaXB0aW9uL01lcmNhZG9QYWdvU3Vic2NyaXB0aW9uQ2hlY2tvdXQudHN4IiwgKGNvbnRlbnQpID0+IHsKICBp
ZiAoIWNvbnRlbnQuaW5jbHVkZXMoIm9uZVRpbWVJZGVtcG90ZW5jeVJlZiIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250
ZW50LAogICAgICBgICBjb25zdCBicmlja0NvbnRyb2xsZXJSZWYgPSB1c2VSZWY8YW55PihudWxsKTsKICBjb25zdCBwcm9jZXNzaW5nUmVmID0gdXNlUmVm
KGZhbHNlKTtgLAogICAgICBgICBjb25zdCBicmlja0NvbnRyb2xsZXJSZWYgPSB1c2VSZWY8YW55PihudWxsKTsKICBjb25zdCBwcm9jZXNzaW5nUmVmID0g
dXNlUmVmKGZhbHNlKTsKICBjb25zdCBvbmVUaW1lSWRlbXBvdGVuY3lSZWYgPSB1c2VSZWYoIiIpO2AsCiAgICAgICJzdWJzY3JpcHRpb24gaWRlbXBvdGVu
Y3kgcmVmIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgICAgIGNvbnN0IHJlc3BvbnNl
ID0gYXdhaXQgZmV0Y2hXaXRoUGF5bWVudFRpbWVvdXQoIi9hcGkvYXNzaW5hdHVyYS9jaGVja291dCIsIHsKICAgICAgICAgIG1ldGhvZDogIlBPU1QiLAog
ICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICAiY29udGVudC10eXBlIjogImFwcGxpY2F0aW9uL2pzb24iLAogICAgICAgICAgICBhdXRob3JpemF0
aW9uOiBcYEJlYXJlciBcJHt0b2tlbn1cYCwKICAgICAgICAgICAgIngtb3JjYWx5LXNlc3Npb24iOiB0b2tlbiwKICAgICAgICAgICAgImlkZW1wb3RlbmN5
LWtleSI6IGNyeXB0by5yYW5kb21VVUlEKCksCiAgICAgICAgICB9LAogICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoewogICAgICAgICAgICBwbGFu
OiBwbGFuS2V5LAogICAgICAgICAgICBmb3JtRGF0YSwKICAgICAgICAgIH0pLAogICAgICAgIH0pOwogICAgICAgIGNvbnN0IHBheWxvYWQgPSBhd2FpdCBy
ZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7CgogICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigK
ICAgICAgICAgICAgcGF5bG9hZC5lcnJvciB8fCAiTsOjbyBmb2kgcG9zc8OtdmVsIHByb2Nlc3NhciBvIHBhZ2FtZW50by4iLAogICAgICAgICAgKTsKICAg
ICAgICB9YCwKICAgIGAgICAgICAgIGNvbnN0IGlkZW1wb3RlbmN5S2V5ID0KICAgICAgICAgIG9uZVRpbWVJZGVtcG90ZW5jeVJlZi5jdXJyZW50IHx8IGNy
eXB0by5yYW5kb21VVUlEKCk7CiAgICAgICAgb25lVGltZUlkZW1wb3RlbmN5UmVmLmN1cnJlbnQgPSBpZGVtcG90ZW5jeUtleTsKCiAgICAgICAgY29uc3Qg
cmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhQYXltZW50VGltZW91dCgiL2FwaS9hc3NpbmF0dXJhL2NoZWNrb3V0IiwgewogICAgICAgICAgbWV0aG9kOiAi
UE9TVCIsCiAgICAgICAgICBoZWFkZXJzOiB7CiAgICAgICAgICAgICJjb250ZW50LXR5cGUiOiAiYXBwbGljYXRpb24vanNvbiIsCiAgICAgICAgICAgIGF1
dGhvcml6YXRpb246IFxgQmVhcmVyIFwke3Rva2VufVxgLAogICAgICAgICAgICAieC1vcmNhbHktc2Vzc2lvbiI6IHRva2VuLAogICAgICAgICAgICAiaWRl
bXBvdGVuY3kta2V5IjogaWRlbXBvdGVuY3lLZXksCiAgICAgICAgICB9LAogICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoewogICAgICAgICAgICBw
bGFuOiBwbGFuS2V5LAogICAgICAgICAgICBmb3JtRGF0YSwKICAgICAgICAgIH0pLAogICAgICAgIH0pOwogICAgICAgIGNvbnN0IHBheWxvYWQgPSBhd2Fp
dCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7CgogICAgICAgIGlmICghcmVzcG9uc2Uub2spIHsKICAgICAgICAgIGlmIChyZXNwb25zZS5z
dGF0dXMgPCA1MDApIHsKICAgICAgICAgICAgb25lVGltZUlkZW1wb3RlbmN5UmVmLmN1cnJlbnQgPSAiIjsKICAgICAgICAgIH0KICAgICAgICAgIHRocm93
IG5ldyBFcnJvcigKICAgICAgICAgICAgcGF5bG9hZC5lcnJvciB8fCAiTsOjbyBmb2kgcG9zc8OtdmVsIHByb2Nlc3NhciBvIHBhZ2FtZW50by4iLAogICAg
ICAgICAgKTsKICAgICAgICB9CgogICAgICAgIG9uZVRpbWVJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gIiI7YCwKICAgICJzdWJzY3JpcHRpb24gY2hlY2tv
dXQgcmV0cnkgaWRlbXBvdGVuY3kiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tY2hlY2tvdXQtcGF5bWVu
dC50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICdpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSAibm9kZTpj
cnlwdG8iO1xuJywKICAgICIiLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygiaWRlbXBvdGVuY3kta2V5IGludsOhbGlkYSIpKSB7CiAgICBjb250
ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICBpZiAoIWNvbnRleHQuY2FuTWFuYWdlKSB7CiAgICB0aHJvdyBPYmplY3Qu
YXNzaWduKAogICAgICBuZXcgRXJyb3IoIlZvY8OqIG7Do28gcG9zc3VpIHBlcm1pc3PDo28gcGFyYSBwYWdhciBhIGFzc2luYXR1cmEuIiksCiAgICAgIHsg
c3RhdHVzOiA0MDMgfSwKICAgICk7CiAgfQoKICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PEpzb25SZWNvcmQ+KHJlcXVlc3QsIDMyICogMTAy
NCk7YCwKICAgICAgYCAgaWYgKCFjb250ZXh0LmNhbk1hbmFnZSkgewogICAgdGhyb3cgT2JqZWN0LmFzc2lnbigKICAgICAgbmV3IEVycm9yKCJWb2PDqiBu
w6NvIHBvc3N1aSBwZXJtaXNzw6NvIHBhcmEgcGFnYXIgYSBhc3NpbmF0dXJhLiIpLAogICAgICB7IHN0YXR1czogNDAzIH0sCiAgICApOwogIH0KCiAgY29u
c3QgaWRlbXBvdGVuY3lLZXkgPSB0ZXh0KAogICAgcmVxdWVzdC5oZWFkZXJzLmdldCgiaWRlbXBvdGVuY3kta2V5IiksCiAgKTsKICBpZiAoCiAgICAhL15b
MC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaS50ZXN0KAogICAgICBpZGVt
cG90ZW5jeUtleSwKICAgICkKICApIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigiQ2hhdmUgZGUgaWRlbXBvdMOqbmNpYSBk
byBwYWdhbWVudG8gaW52w6FsaWRhLiIpLAogICAgICB7IHN0YXR1czogNDAwIH0sCiAgICApOwogIH0KCiAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29u
Qm9keTxKc29uUmVjb3JkPihyZXF1ZXN0LCAzMiAqIDEwMjQpO2AsCiAgICAgICJzdWJzY3JpcHRpb24gcmVxdWlyZSBpZGVtcG90ZW5jeSBrZXkiLAogICAg
KTsKICB9CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICBjb25zdCBpZGVtcG90ZW5jeUtleSA9CiAgICB0ZXh0KHJlcXVlc3QuaGVhZGVy
cy5nZXQoImlkZW1wb3RlbmN5LWtleSIpKSB8fCByYW5kb21VVUlEKCk7YCwKICAgICIiLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygiZXhpc3Rp
bmdQYXltZW50Um93IikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIGNvbnN0IHsgZGF0YTogcGF5
bWVudFJvdywgZXJyb3I6IHBheW1lbnRFcnJvciB9ID0KICAgIGF3YWl0IGNvbnRleHQuYWRtaW4KICAgICAgLmZyb20oInBsYW5fcGF5bWVudHMiKQogICAg
ICAuaW5zZXJ0KHsKICAgICAgICBjb21wYW55X2lkOiBjb21wYW55SWQsCiAgICAgICAgcGxhbm86IHBsYW5LZXksCiAgICAgICAgdmFsb3I6IHBsYW4ucHJp
Y2UsCiAgICAgICAgc3RhdHVzOiAiY3JlYXRlZCIsCiAgICAgICAgdGlwbzoga2luZCA9PT0gInBpeCIgPyAicGl4X2F2dWxzbyIgOiAiY2FyZF9hdnVsc28i
LAogICAgICAgIHBheW1lbnRfbWV0aG9kOiBwYXltZW50TWV0aG9kSWQsCiAgICAgICAgZW1haWw6IHBheWVyRW1haWwsCiAgICAgICAgbm9tZV9lbXByZXNh
OiB0ZXh0KGNvbXBhbnkubm9tZSkgfHwgIkVtcHJlc2EiLAogICAgICB9KQogICAgICAuc2VsZWN0KCJpZCIpCiAgICAgIC5zaW5nbGUoKTsKCiAgaWYgKHBh
eW1lbnRFcnJvciB8fCAhcGF5bWVudFJvdz8uaWQpIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigKICAgICAgICBwYXltZW50
RXJyb3I/Lm1lc3NhZ2UgfHwKICAgICAgICAgICJOw6NvIGZvaSBwb3Nzw612ZWwgcHJlcGFyYXIgbyBwYWdhbWVudG8uIiwKICAgICAgKSwKICAgICAgeyBz
dGF0dXM6IDUwMCB9LAogICAgKTsKICB9YCwKICAgICAgYCAgY29uc3QgeyBkYXRhOiBleGlzdGluZ1BheW1lbnRSb3csIGVycm9yOiBleGlzdGluZ1BheW1l
bnRFcnJvciB9ID0KICAgIGF3YWl0IGNvbnRleHQuYWRtaW4KICAgICAgLmZyb20oInBsYW5fcGF5bWVudHMiKQogICAgICAuc2VsZWN0KCIqIikKICAgICAg
LmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgICAuZXEoImlkZW1wb3RlbmN5X2tleSIsIGlkZW1wb3RlbmN5S2V5KQogICAgICAubWF5YmVTaW5n
bGUoKTsKCiAgaWYgKGV4aXN0aW5nUGF5bWVudEVycm9yKSB0aHJvdyBleGlzdGluZ1BheW1lbnRFcnJvcjsKCiAgbGV0IHBheW1lbnRSb3cgPSBleGlzdGlu
Z1BheW1lbnRSb3cgYXMgSnNvblJlY29yZCB8IG51bGw7CgogIGlmIChwYXltZW50Um93Py5tZXJjYWRvX3BhZ29fcGF5bWVudF9pZCkgewogICAgY29uc3Qg
ZXhpc3RpbmdQYXltZW50ID0gKGF3YWl0IGdldE1lcmNhZG9QYWdvUGF5bWVudCgKICAgICAgZ2V0UGxhdGZvcm1BY2Nlc3NUb2tlbigpLAogICAgICB0ZXh0
KHBheW1lbnRSb3cubWVyY2Fkb19wYWdvX3BheW1lbnRfaWQpLAogICAgKSkgYXMgSnNvblJlY29yZDsKCiAgICByZXR1cm4gcGVyc2lzdFJlbW90ZVN0YXR1
cygKICAgICAgY29udGV4dC5hZG1pbiwKICAgICAgcGF5bWVudFJvdywKICAgICAgY29tcGFueSwKICAgICAgZXhpc3RpbmdQYXltZW50LAogICAgKTsKICB9
CgogIGlmICghcGF5bWVudFJvdykgewogICAgY29uc3QgaW5zZXJ0ZWQgPSBhd2FpdCBjb250ZXh0LmFkbWluCiAgICAgIC5mcm9tKCJwbGFuX3BheW1lbnRz
IikKICAgICAgLmluc2VydCh7CiAgICAgICAgY29tcGFueV9pZDogY29tcGFueUlkLAogICAgICAgIHBsYW5vOiBwbGFuS2V5LAogICAgICAgIHZhbG9yOiBw
bGFuLnByaWNlLAogICAgICAgIHN0YXR1czogImNyZWF0ZWQiLAogICAgICAgIHRpcG86IGtpbmQgPT09ICJwaXgiID8gInBpeF9hdnVsc28iIDogImNhcmRf
YXZ1bHNvIiwKICAgICAgICBwYXltZW50X21ldGhvZDogcGF5bWVudE1ldGhvZElkLAogICAgICAgIHByb3ZpZGVyOiAibWVyY2Fkb19wYWdvIiwKICAgICAg
ICBpZGVtcG90ZW5jeV9rZXk6IGlkZW1wb3RlbmN5S2V5LAogICAgICAgIGVtYWlsOiBwYXllckVtYWlsLAogICAgICAgIG5vbWVfZW1wcmVzYTogdGV4dChj
b21wYW55Lm5vbWUpIHx8ICJFbXByZXNhIiwKICAgICAgfSkKICAgICAgLnNlbGVjdCgiKiIpCiAgICAgIC5zaW5nbGUoKTsKCiAgICBpZiAoaW5zZXJ0ZWQu
ZXJyb3IgfHwgIWluc2VydGVkLmRhdGE/LmlkKSB7CiAgICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgICAgbmV3IEVycm9yKAogICAgICAgICAgaW5z
ZXJ0ZWQuZXJyb3I/Lm1lc3NhZ2UgfHwKICAgICAgICAgICAgIk7Do28gZm9pIHBvc3PDrXZlbCBwcmVwYXJhciBvIHBhZ2FtZW50by4iLAogICAgICAgICks
CiAgICAgICAgeyBzdGF0dXM6IDUwMCB9LAogICAgICApOwogICAgfQoKICAgIHBheW1lbnRSb3cgPSBpbnNlcnRlZC5kYXRhIGFzIEpzb25SZWNvcmQ7CiAg
fWAsCiAgICAgICJzdWJzY3JpcHRpb24gb25lLXRpbWUgaWRlbXBvdGVudCByb3cgcmV1c2UiLAogICAgKTsKCiAgICBjb250ZW50ID0gY29udGVudC5yZXBs
YWNlKAogICAgICBgICBjb25zdCBwYXltZW50Um93SWQgPSB0ZXh0KHBheW1lbnRSb3cuaWQpO2AsCiAgICAgIGAgIGNvbnN0IHBheW1lbnRSb3dJZCA9IHRl
eHQocGF5bWVudFJvdy5pZCk7YCwKICAgICk7CiAgfQoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgIH0gY2F0Y2gg
KGVycm9yKSB7CiAgICBhd2FpdCBjb250ZXh0LmFkbWluCiAgICAgIC5mcm9tKCJwbGFuX3BheW1lbnRzIikKICAgICAgLnVwZGF0ZSh7CiAgICAgICAgc3Rh
dHVzOiAiZmFpbGVkIiwKICAgICAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBwYXlt
ZW50Um93SWQpCiAgICAgIC5lcSgiY29tcGFueV9pZCIsIGNvbXBhbnlJZCk7CgogICAgdGhyb3cgZXJyb3I7CiAgfWAsCiAgICBgICB9IGNhdGNoIChlcnJv
cikgewogICAgY29uc3QgcHJvdmlkZXJTdGF0dXMgPQogICAgICBlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09ICJvYmplY3QiICYmICJzdGF0dXMiIGluIGVy
cm9yCiAgICAgICAgPyBOdW1iZXIoKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pLnN0YXR1cyB8fCAwKQogICAgICAgIDogMDsKCiAgICBhd2FpdCBj
b250ZXh0LmFkbWluCiAgICAgIC5mcm9tKCJwbGFuX3BheW1lbnRzIikKICAgICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOgogICAgICAgICAgcHJvdmlk
ZXJTdGF0dXMgPj0gNDAwICYmIHByb3ZpZGVyU3RhdHVzIDwgNTAwCiAgICAgICAgICAgID8gImZhaWxlZCIKICAgICAgICAgICAgOiAiY3JlYXRpbmciLAog
ICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgfSkKICAgICAgLmVxKCJpZCIsIHBheW1lbnRSb3dJZCkKICAgICAg
LmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKTsKCiAgICB0aHJvdyBlcnJvcjsKICB9YCwKICAgICJzdWJzY3JpcHRpb24gb25lLXRpbWUgYW1iaWd1b3Vz
IHByb3ZpZGVyIHJlc3VsdCIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgoKLy8gQXNzaW5hdHVyYSByZWNvcnJlbnRlIHRyYW5zcGFyZW50ZTogYm9k
eSBsaW1pdGFkbywgaWRlbXBvdMOqbmNpYSBlIHBheWxvYWQgc2FuaXRpemFkby4KcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5z
cGFyZW50LnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB0eXBlIHsgTmV4
dFJlcXVlc3QgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVl
c3QiOycsCiAgICAidHJhbnNwYXJlbnQgc3Vic2NyaXB0aW9uIGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNv
bnRlbnQsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7XG4nLAogICAgJ2ltcG9ydCB7IGNsZWFu
U2Vuc2l0aXZlUGF5bG9hZCB9IGZyb20gIkAvbGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0IjsnLAogICAgInRyYW5zcGFyZW50IHN1YnNjcmlwdGlvbiBz
YW5pdGl6ZSBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICBjb25zdCBib2R5ID0gKGF3YWl0IHJlcXVlc3QKICAg
IC5qc29uKCkKICAgIC5jYXRjaCgoKSA9PiAoe30pKSkgYXMgSnNvblJlY29yZDtgLAogICAgYCAgY29uc3QgaWRlbXBvdGVuY3lLZXkgPSB0ZXh0KAogICAg
cmVxdWVzdC5oZWFkZXJzLmdldCgiaWRlbXBvdGVuY3kta2V5IiksCiAgKTsKICBpZiAoCiAgICAhL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVsw
LTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaS50ZXN0KAogICAgICBpZGVtcG90ZW5jeUtleSwKICAgICkKICApIHsKICAgIHRo
cm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigiQ2hhdmUgZGUgaWRlbXBvdMOqbmNpYSBkYSBhc3NpbmF0dXJhIGludsOhbGlkYS4iKSwKICAg
ICAgeyBzdGF0dXM6IDQwMCB9LAogICAgKTsKICB9CgogIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8SnNvblJlY29yZD4oCiAgICByZXF1ZXN0
LAogICAgMjQgKiAxMDI0LAogICk7YCwKICApOwoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgICAgIHByb3Zp
ZGVyOiAibWVyY2Fkb19wYWdvIiwKICAgICAgICBlbWFpbDogcGF5ZXJFbWFpbCxgLAogICAgYCAgICAgICAgcHJvdmlkZXI6ICJtZXJjYWRvX3BhZ28iLAog
ICAgICAgIGlkZW1wb3RlbmN5X2tleTogaWRlbXBvdGVuY3lLZXksCiAgICAgICAgZW1haWw6IHBheWVyRW1haWwsYCwKICAgICJ0cmFuc3BhcmVudCBzdWJz
Y3JpcHRpb24gaWRlbXBvdGVuY3kgcGVyc2lzdGVuY2UiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICAiICAgICAgICByYXdf
c3Vic2NyaXB0aW9uOiBzdWJzY3JpcHRpb24sIiwKICAgICIgICAgICAgIHJhd19zdWJzY3JpcHRpb246IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChzdWJzY3Jp
cHRpb24pLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICBhc3NpbmF0dXJhX21wX3BheWxvYWQ6IHN1YnNjcmlwdGlvbiwi
LAogICAgIiAgICBhc3NpbmF0dXJhX21wX3BheWxvYWQ6IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChzdWJzY3JpcHRpb24pLCIsCiAgKTsKICByZXR1cm4gY29u
dGVudDsKfSk7CgpwYXRjaCgiY29tcG9uZW50cy9zdWJzY3JpcHRpb24vTWVyY2Fkb1BhZ29TdWJzY3JpcHRpb25DaGVja291dC50c3giLCAoY29udGVudCkg
PT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygicmVjdXJyaW5nSWRlbXBvdGVuY3lSZWYiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgK
ICAgICAgY29udGVudCwKICAgICAgYCAgY29uc3QgcHJvY2Vzc2luZ1JlZiA9IHVzZVJlZihmYWxzZSk7CiAgY29uc3Qgb25lVGltZUlkZW1wb3RlbmN5UmVm
ID0gdXNlUmVmKCIiKTtgLAogICAgICBgICBjb25zdCBwcm9jZXNzaW5nUmVmID0gdXNlUmVmKGZhbHNlKTsKICBjb25zdCBvbmVUaW1lSWRlbXBvdGVuY3lS
ZWYgPSB1c2VSZWYoIiIpOwogIGNvbnN0IHJlY3VycmluZ0lkZW1wb3RlbmN5UmVmID0gdXNlUmVmKCIiKTtgLAogICAgICAicmVjdXJyaW5nIGlkZW1wb3Rl
bmN5IHJlZiIsCiAgICApOwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgIGNvbnRlbnQsCiAgICBgICAgICAgICAgIGNvbnN0IHJlc3Bv
bnNlID0gYXdhaXQgZmV0Y2hXaXRoUGF5bWVudFRpbWVvdXQoCiAgICAgICAgICAgICIvYXBpL2Fzc2luYXR1cmEvbWVyY2Fkby1wYWdvIiwKICAgICAgICAg
ICAgewogICAgICAgICAgICAgIG1ldGhvZDogIlBPU1QiLAogICAgICAgICAgICAgIGhlYWRlcnM6IHsKICAgICAgICAgICAgICAgICJjb250ZW50LXR5cGUi
OiAiYXBwbGljYXRpb24vanNvbiIsCiAgICAgICAgICAgICAgICBhdXRob3JpemF0aW9uOiBcYEJlYXJlciBcJHt0b2tlbn1cYCwKICAgICAgICAgICAgIngt
b3JjYWx5LXNlc3Npb24iOiB0b2tlbiwKICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsKICAgICAgICAgICAg
ICAgIHBsYW46IHBsYW5LZXksCiAgICAgICAgICAgICAgICBjYXJkVG9rZW5JZDogZm9ybURhdGEudG9rZW4sCiAgICAgICAgICAgICAgICBwYXllckVtYWls
OgogICAgICAgICAgICAgICAgICBwYXllci5lbWFpbCB8fAogICAgICAgICAgICAgICAgICBzbmFwc2hvdD8uY29tcGFueT8uZW1haWwgfHwKICAgICAgICAg
ICAgICAgICAgIiIsCiAgICAgICAgICAgICAgfSksCiAgICAgICAgICAgIH0sCiAgICAgICAgICApOwogICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0
IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTsKCiAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7YCwKICAgIGAgICAgICAgICAgY29uc3Qg
aWRlbXBvdGVuY3lLZXkgPQogICAgICAgICAgICByZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50IHx8IGNyeXB0by5yYW5kb21VVUlEKCk7CiAgICAg
ICAgICByZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gaWRlbXBvdGVuY3lLZXk7CgogICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBm
ZXRjaFdpdGhQYXltZW50VGltZW91dCgKICAgICAgICAgICAgIi9hcGkvYXNzaW5hdHVyYS9tZXJjYWRvLXBhZ28iLAogICAgICAgICAgICB7CiAgICAgICAg
ICAgICAgbWV0aG9kOiAiUE9TVCIsCiAgICAgICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICAgICAgImNvbnRlbnQtdHlwZSI6ICJhcHBsaWNhdGlv
bi9qc29uIiwKICAgICAgICAgICAgICAgIGF1dGhvcml6YXRpb246IFxgQmVhcmVyIFwke3Rva2VufVxgLAogICAgICAgICAgICAgICAgIngtb3JjYWx5LXNl
c3Npb24iOiB0b2tlbiwKICAgICAgICAgICAgICAgICJpZGVtcG90ZW5jeS1rZXkiOiBpZGVtcG90ZW5jeUtleSwKICAgICAgICAgICAgICB9LAogICAgICAg
ICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsKICAgICAgICAgICAgICAgIHBsYW46IHBsYW5LZXksCiAgICAgICAgICAgICAgICBjYXJkVG9rZW5JZDog
Zm9ybURhdGEudG9rZW4sCiAgICAgICAgICAgICAgICBwYXllckVtYWlsOgogICAgICAgICAgICAgICAgICBwYXllci5lbWFpbCB8fAogICAgICAgICAgICAg
ICAgICBzbmFwc2hvdD8uY29tcGFueT8uZW1haWwgfHwKICAgICAgICAgICAgICAgICAgIiIsCiAgICAgICAgICAgICAgfSksCiAgICAgICAgICAgIH0sCiAg
ICAgICAgICApOwogICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTsKCiAgICAgICAgICBp
ZiAoIXJlc3BvbnNlLm9rKSB7CiAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPCA1MDApIHsKICAgICAgICAgICAgICByZWN1cnJpbmdJZGVtcG90
ZW5jeVJlZi5jdXJyZW50ID0gIiI7CiAgICAgICAgICAgIH1gLAogICAgInJlY3VycmluZyBjaGVja291dCByZXRyeSBpZGVtcG90ZW5jeSIsCiAgKTsKICBy
ZXR1cm4gY29udGVudDsKfSk7CgovLyBFbmRwb2ludCBkZSBnZXJlbmNpYW1lbnRvIGRlIGFzc2luYXR1cmEgdGFtYsOpbSBwYXNzYSBwZWxvIGJ5dGUtbGlt
aXQgY29tcGFydGlsaGFkby4KcGF0Y2goImFwcC9hcGkvY29tcGFueS9zdWJzY3JpcHRpb24vcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQg
PSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gIm5leHQvc2VydmVy
IjtcbicsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0
IjsnLAogICAgImNvbXBhbnkgc3Vic2NyaXB0aW9uIGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNv
bnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtgLAogICAgYCAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25C
b2R5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwKICAgICAgMTYgKiAxMDI0LAogICAgKTtgLAogICk7CiAgaWYgKCFjb250ZW50
LmluY2x1ZGVzKCJjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5y
ZXBsYWNlKAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNz
YWdlIDogIkVycm8gYW8gZ2VyZW5jaWFyIGFzc2luYXR1cmEuIjtgLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0g
cmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CgogICAgY29uc3QgbWVzc2FnZSA9
IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogIkVycm8gYW8gZ2VyZW5jaWFyIGFzc2luYXR1cmEuIjtgLAogICAgKTsKICB9CiAg
cmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8gUGF5bG9hZHMgZGUgYXNzaW5hdHVyYSBndWFyZGFkb3Mgbm8gYmFuY28gZmljYW0gc2FuaXRpemFkb3MuCnBhdGNo
KCJhcHAvYXBpL21lcmNhZG8tcGFnby93ZWJob29rL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBj
b250ZW50LAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVz
dCI7XG4nLAogICAgJ2ltcG9ydCB7IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZCB9IGZyb20gIkAvbGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0IjsnLAogICAg
InN1YnNjcmlwdGlvbiB3ZWJob29rIHNhbml0aXplIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgIGFzc2lu
YXR1cmFfbXBfcGF5bG9hZDogc3Vic2NyaXB0aW9uLCIsCiAgICAiICAgICAgYXNzaW5hdHVyYV9tcF9wYXlsb2FkOiBjbGVhblNlbnNpdGl2ZVBheWxvYWQo
c3Vic2NyaXB0aW9uKSwiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgICAgIHJhd193ZWJob29rOiBib2R5LCIsCiAgICAi
ICAgICAgICByYXdfd2ViaG9vazogY2xlYW5TZW5zaXRpdmVQYXlsb2FkKGJvZHkpLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAg
IiAgICAgICAgcmF3X3BheW1lbnQ6IHBheW1lbnQsIiwKICAgICIgICAgICAgIHJhd19wYXltZW50OiBjbGVhblNlbnNpdGl2ZVBheWxvYWQocGF5bWVudCks
IiwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBpL21lcmNhZG8tcGFnby93ZWJob29rLWxlYWRzL3JvdXRlLnRzIiwgKGNvbnRl
bnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlF
cnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7XG4nLAogICAgJ2ltcG9ydCB7IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZCB9IGZy
b20gIkAvbGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0IjsnLAogICAgInNpZ251cCB3ZWJob29rIHNhbml0aXplIGltcG9ydCIsCiAgKTsKICBjb250ZW50
ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgIG1lcmNhZG9fcGFnb19wYXltZW50OiBwYXltZW50LCIsCiAgICAiICAgICAgbWVyY2Fkb19wYWdvX3Bh
eW1lbnQ6IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChwYXltZW50KSwiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImxpYi9zdWJzY3JpcHRp
b24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBjcmVh
dGVDbGllbnQgfSBmcm9tICJAc3VwYWJhc2Uvc3VwYWJhc2UtanMiO1xuJywKICAgICdpbXBvcnQgeyBjbGVhblNlbnNpdGl2ZVBheWxvYWQgfSBmcm9tICJA
L2xpYi9wYXltZW50cy9zZXJ2ZXItY29udGV4dCI7JywKICAgICJzdWJzY3JpcHRpb24gc2VydmljZSBzYW5pdGl6ZSBpbXBvcnQiLAogICk7CiAgY29udGVu
dCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgICByYXdfc3Vic2NyaXB0aW9uOiBzdWJzY3JpcHRpb24sIiwKICAgICIgICAgICByYXdfc3Vic2NyaXB0
aW9uOiBjbGVhblNlbnNpdGl2ZVBheWxvYWQoc3Vic2NyaXB0aW9uKSwiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgICBh
c3NpbmF0dXJhX21wX3BheWxvYWQ6IHN1YnNjcmlwdGlvbiwiLAogICAgIiAgICAgIGFzc2luYXR1cmFfbXBfcGF5bG9hZDogY2xlYW5TZW5zaXRpdmVQYXls
b2FkKHN1YnNjcmlwdGlvbiksIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgICAgcmF3X3ByZWZlcmVuY2U6IHByZWZlcmVu
Y2UsIiwKICAgICIgICAgICByYXdfcHJlZmVyZW5jZTogY2xlYW5TZW5zaXRpdmVQYXlsb2FkKHByZWZlcmVuY2UpLCIsCiAgKTsKICBjb250ZW50ID0gY29u
dGVudC5yZXBsYWNlKAogICAgIiAgICAgIGFzc2luYXR1cmFfbXBfcGF5bG9hZDogcmVtb3RlU3Vic2NyaXB0aW9uIHx8IGNvbXBhbnkuYXNzaW5hdHVyYV9t
cF9wYXlsb2FkIHx8IG51bGwsIiwKICAgICIgICAgICBhc3NpbmF0dXJhX21wX3BheWxvYWQ6IHJlbW90ZVN1YnNjcmlwdGlvbiA/IGNsZWFuU2Vuc2l0aXZl
UGF5bG9hZChyZW1vdGVTdWJzY3JpcHRpb24pIDogY29tcGFueS5hc3NpbmF0dXJhX21wX3BheWxvYWQgfHwgbnVsbCwiLAogICk7CiAgcmV0dXJuIGNvbnRl
bnQ7Cn0pOwoKLy8gMTIpIFN1YnNjcmlwdGlvbiBzeW5jL2hpc3RvcnkgY29tIHBlcm1pc3PDo28KcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tc2VydmljZS50
cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCBnZXRIaXN0b3J5KGNv
bnRleHQuYWRtaW4sIGNvbnRleHQuY29tcGFueS5pZCk7CiAgcmV0dXJuIHsKICAgIGNvbXBhbnk6IHNhZmVDb21wYW55KGNvbnRleHQuY29tcGFueSksCiAg
ICByb2xlOiBjb250ZXh0LnJvbGUsCiAgICBjYW5fbWFuYWdlOiBjb250ZXh0LmNhbk1hbmFnZSwKICAgIHBsYW5zOiBPUkNBTFlfUExBTlMsCiAgICBoaXN0
b3J5LAogIH07YCwKICAgIGAgIGNvbnN0IGhpc3RvcnkgPSBjb250ZXh0LmNhbk1hbmFnZQogICAgPyBhd2FpdCBnZXRIaXN0b3J5KGNvbnRleHQuYWRtaW4s
IGNvbnRleHQuY29tcGFueS5pZCkKICAgIDogeyBldmVudHM6IFtdLCBwYXltZW50czogW10gfTsKICByZXR1cm4gewogICAgY29tcGFueTogc2FmZUNvbXBh
bnkoY29udGV4dC5jb21wYW55KSwKICAgIHJvbGU6IGNvbnRleHQucm9sZSwKICAgIGNhbl9tYW5hZ2U6IGNvbnRleHQuY2FuTWFuYWdlLAogICAgcGxhbnM6
IE9SQ0FMWV9QTEFOUywKICAgIGhpc3RvcnksCiAgfTtgLAogICk7CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdpZiAoIWNvbnRleHQuY2FuTWFuYWdlKSB0
aHJvdyBuZXcgRXJyb3IoIlZvY8OqIG7Do28gcG9zc3VpIHBlcm1pc3PDo28gcGFyYSBzaW5jcm9uaXphciBhIGFzc2luYXR1cmEuIik7JykpIHsKICAgIGNv
bnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIGlmICghY29udGV4dC51c2VyKSB0aHJvdyBuZXcgRXJyb3IoIk7Do28g
YXV0b3JpemFkby4iKTsKICBpZiAoIWNvbXBhbnk/LmlkKSB0aHJvdyBuZXcgRXJyb3IoIkVtcHJlc2EgbsOjbyBlbmNvbnRyYWRhLiIpOwoKICBjb25zdCBw
cmVhcHByb3ZhbElkID1gLAogICAgICBgICBpZiAoIWNvbnRleHQudXNlcikgdGhyb3cgbmV3IEVycm9yKCJOw6NvIGF1dG9yaXphZG8uIik7CiAgaWYgKCFj
b21wYW55Py5pZCkgdGhyb3cgbmV3IEVycm9yKCJFbXByZXNhIG7Do28gZW5jb250cmFkYS4iKTsKICBpZiAoIWNvbnRleHQuY2FuTWFuYWdlKSB7CiAgICB0
aHJvdyBuZXcgRXJyb3IoIlZvY8OqIG7Do28gcG9zc3VpIHBlcm1pc3PDo28gcGFyYSBzaW5jcm9uaXphciBhIGFzc2luYXR1cmEuIik7CiAgfQoKICBjb25z
dCBwcmVhcHByb3ZhbElkID1gLAogICAgICAic3Vic2NyaXB0aW9uIHN5bmMgYXV0aG9yaXphdGlvbiIsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsK
fSk7CgovLyAxMykgQWRtaW4gc2Nhbm5lcjogY3JvbiBhdXRlbnRpY2FkbyBlIHBlcm1pc3PDo28gcmVhbApwYXRjaCgibGliL3BsYXRmb3JtLWFkbWluLnRz
IiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoInwgJ3N5c3RlbS5zY2FuJyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBs
YWNlKAogICAgICAiICB8ICdzZXR0aW5ncy5tYW5hZ2UnXG4iLAogICAgICAiICB8ICdzZXR0aW5ncy5tYW5hZ2UnXG4gIHwgJ3N5c3RlbS5zY2FuJ1xuIiwK
ICAgICk7CiAgfQogIGlmICghY29udGVudC5pbmNsdWRlcygia2V5OiAnc3lzdGVtLnNjYW4nIikpIHsKICAgIGNvbnN0IGFuY2hvciA9IGAgIHsKICAgIGtl
eTogJ3NldHRpbmdzLm1hbmFnZScsCiAgICBsYWJlbDogJ0FsdGVyYXIgY29uZmlndXJhw6fDtWVzJywKICAgIGRlc2NyaXB0aW9uOiAnTW9kaWZpY2FyIHJl
Z3JhcyBjcsOtdGljYXMgZGEgcGxhdGFmb3JtYS4nLAogICAgc3VwcG9ydEFzc2lnbmFibGU6IGZhbHNlLAogIH0sCl1gOwogICAgY29uc3QgcmVwbGFjZW1l
bnQgPSBgICB7CiAgICBrZXk6ICdzZXR0aW5ncy5tYW5hZ2UnLAogICAgbGFiZWw6ICdBbHRlcmFyIGNvbmZpZ3VyYcOnw7VlcycsCiAgICBkZXNjcmlwdGlv
bjogJ01vZGlmaWNhciByZWdyYXMgY3LDrXRpY2FzIGRhIHBsYXRhZm9ybWEuJywKICAgIHN1cHBvcnRBc3NpZ25hYmxlOiBmYWxzZSwKICB9LAogIHsKICAg
IGtleTogJ3N5c3RlbS5zY2FuJywKICAgIGxhYmVsOiAnRXhlY3V0YXIgc2Nhbm5lcicsCiAgICBkZXNjcmlwdGlvbjogJ0V4ZWN1dGFyIHZhcnJlZHVyYXMg
YWRtaW5pc3RyYXRpdmFzIGUgZGUgY29uc2lzdMOqbmNpYS4nLAogICAgc3VwcG9ydEFzc2lnbmFibGU6IGZhbHNlLAogIH0sCl1gOwogICAgY29udGVudCA9
IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBhbmNob3IsIHJlcGxhY2VtZW50LCAicGxhdGZvcm0gc3lzdGVtLnNjYW4gY2F0YWxvZyIpOwogIH0KICBpZiAo
IWNvbnRlbnQuaW5jbHVkZXMoIiAgJ3N5c3RlbS5zY2FuJyxcbl0pIikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICIgICdzZXR0
aW5ncy5tYW5hZ2UnLFxuXSkiLAogICAgICAiICAnc2V0dGluZ3MubWFuYWdlJyxcbiAgJ3N5c3RlbS5zY2FuJyxcbl0pIiwKICAgICk7CiAgfQoKICBpZiAo
IWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGFkbWluRmllbGRzID0iKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwK
ICAgICAgYCAgY29uc3QgZW1haWwgPSByZXF1ZXN0ZXIuZW1haWwudG9Mb3dlckNhc2UoKQogIGNvbnN0IHsgZGF0YTogYWRtaW4sIGVycm9yIH0gPSBhd2Fp
dCBzdXBhYmFzZUFkbWluCiAgICAuZnJvbSgncGxhdGZvcm1fYWRtaW5zJykKICAgIC5zZWxlY3QoCiAgICAgICdpZCx1c2VyX2lkLGVtYWlsLHJvbGUsaXNf
YWN0aXZlLG5vbWUscGVybWlzc2lvbnMsYXJlYSxvYnNlcnZhY29lcyxsYXN0X2xvZ2luX2F0LG11c3RfY2hhbmdlX3Bhc3N3b3JkJywKICAgICkKICAgIC5v
cigKICAgICAgXGB1c2VyX2lkLmVxLlwke3JlcXVlc3Rlci5pZH0sZW1haWwuaWxpa2UuXCR7ZW1haWx9XGAsCiAgICApCiAgICAuZXEoJ2lzX2FjdGl2ZScs
IHRydWUpCiAgICAubGltaXQoMSkKICAgIC5tYXliZVNpbmdsZSgpCgogIGlmIChlcnJvciB8fCAhYWRtaW4pIHJldHVybiBudWxsYCwKICAgICAgYCAgY29u
c3QgZW1haWwgPSByZXF1ZXN0ZXIuZW1haWwudG9Mb3dlckNhc2UoKQogIGNvbnN0IGFkbWluRmllbGRzID0KICAgICdpZCx1c2VyX2lkLGVtYWlsLHJvbGUs
aXNfYWN0aXZlLG5vbWUscGVybWlzc2lvbnMsYXJlYSxvYnNlcnZhY29lcyxsYXN0X2xvZ2luX2F0LG11c3RfY2hhbmdlX3Bhc3N3b3JkJwoKICBjb25zdCBi
eVVzZXIgPSBhd2FpdCBzdXBhYmFzZUFkbWluCiAgICAuZnJvbSgncGxhdGZvcm1fYWRtaW5zJykKICAgIC5zZWxlY3QoYWRtaW5GaWVsZHMpCiAgICAuZXEo
J3VzZXJfaWQnLCByZXF1ZXN0ZXIuaWQpCiAgICAuZXEoJ2lzX2FjdGl2ZScsIHRydWUpCiAgICAubGltaXQoMSkKICAgIC5tYXliZVNpbmdsZSgpCgogIGxl
dCBhZG1pbiA9IGJ5VXNlci5kYXRhCiAgbGV0IGxvb2t1cEVycm9yID0gYnlVc2VyLmVycm9yCgogIGlmICghYWRtaW4gJiYgIWxvb2t1cEVycm9yKSB7CiAg
ICBjb25zdCBieUVtYWlsID0gYXdhaXQgc3VwYWJhc2VBZG1pbgogICAgICAuZnJvbSgncGxhdGZvcm1fYWRtaW5zJykKICAgICAgLnNlbGVjdChhZG1pbkZp
ZWxkcykKICAgICAgLmlsaWtlKCdlbWFpbCcsIGVtYWlsKQogICAgICAuZXEoJ2lzX2FjdGl2ZScsIHRydWUpCiAgICAgIC5saW1pdCgxKQogICAgICAubWF5
YmVTaW5nbGUoKQoKICAgIGFkbWluID0gYnlFbWFpbC5kYXRhCiAgICBsb29rdXBFcnJvciA9IGJ5RW1haWwuZXJyb3IKICB9CgogIGlmIChsb29rdXBFcnJv
ciB8fCAhYWRtaW4pIHJldHVybiBudWxsYCwKICAgICAgInBsYXRmb3JtIGFkbWluIGlkZW50aXR5IHdpdGhvdXQgaW50ZXJwb2xhdGVkIG9yIiwKICAgICk7
CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IHNob3VsZFJlZnJlc2hMb2dpbiIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0
KAogICAgICBjb250ZW50LAogICAgICBgICBjb25zdCBwYXRjaDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7CiAgICBsYXN0X2xvZ2luX2F0OiBuZXcg
RGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgfQoKICBpZiAoIWFkbWluLnVzZXJfaWQp
IHsKICAgIHBhdGNoLnVzZXJfaWQgPSByZXF1ZXN0ZXIuaWQKICB9CgogIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgIC5mcm9tKCdwbGF0Zm9ybV9hZG1pbnMn
KQogICAgLnVwZGF0ZShwYXRjaCkKICAgIC5lcSgnaWQnLCBhZG1pbi5pZCkKCiAgcmV0dXJuIHJlc29sdmVkYCwKICAgICAgYCAgY29uc3QgbGFzdExvZ2lu
QXQgPSBhZG1pbi5sYXN0X2xvZ2luX2F0CiAgICA/IG5ldyBEYXRlKFN0cmluZyhhZG1pbi5sYXN0X2xvZ2luX2F0KSkuZ2V0VGltZSgpCiAgICA6IDAKICBj
b25zdCBzaG91bGRSZWZyZXNoTG9naW4gPQogICAgIWxhc3RMb2dpbkF0IHx8CiAgICBEYXRlLm5vdygpIC0gbGFzdExvZ2luQXQgPiA1ICogNjAgKiAxMDAw
IHx8CiAgICAhYWRtaW4udXNlcl9pZAoKICBpZiAoc2hvdWxkUmVmcmVzaExvZ2luKSB7CiAgICBjb25zdCBwYXRjaDogUmVjb3JkPHN0cmluZywgdW5rbm93
bj4gPSB7CiAgICAgIGxhc3RfbG9naW5fYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0
cmluZygpLAogICAgfQoKICAgIGlmICghYWRtaW4udXNlcl9pZCkgewogICAgICBwYXRjaC51c2VyX2lkID0gcmVxdWVzdGVyLmlkCiAgICB9CgogICAgYXdh
aXQgc3VwYWJhc2VBZG1pbgogICAgICAuZnJvbSgncGxhdGZvcm1fYWRtaW5zJykKICAgICAgLnVwZGF0ZShwYXRjaCkKICAgICAgLmVxKCdpZCcsIGFkbWlu
LmlkKQogIH0KCiAgcmV0dXJuIHJlc29sdmVkYCwKICAgICAgInBsYXRmb3JtIGFkbWluIGxvZ2luIHdyaXRlIHRocm90dGxlIiwKICAgICk7CiAgfQoKICBy
ZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9hZG1pbi9zY2FuL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuc3Rh
cnRzV2l0aCgiaW1wb3J0IHsgdGltaW5nU2FmZUVxdWFsIikpIHsKICAgIGNvbnRlbnQgPSBgaW1wb3J0IHsgdGltaW5nU2FmZUVxdWFsIH0gZnJvbSAnbm9k
ZTpjcnlwdG8nXG4ke2NvbnRlbnR9YDsKICB9CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJmdW5jdGlvbiBpc0Nyb25SZXF1ZXN0KCIpKSB7CiAgICBjb25z
dCBtYXJrZXIgPSAiXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSI7CiAgICBjb25zdCBoZWxwZXIgPSBgCmZ1bmN0
aW9uIGlzQ3JvblJlcXVlc3QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICBjb25zdCBzZWNyZXQgPSBTdHJpbmcocHJvY2Vzcy5lbnYuQ1JPTl9TRUNSRVQg
fHwgJycpCiAgY29uc3QgaGVhZGVyID0gU3RyaW5nKHJlcXVlc3QuaGVhZGVycy5nZXQoJ2F1dGhvcml6YXRpb24nKSB8fCAnJykKICBjb25zdCBleHBlY3Rl
ZCA9IFxgQmVhcmVyIFwke3NlY3JldH1cYAoKICBpZiAoIXNlY3JldCB8fCBoZWFkZXIubGVuZ3RoICE9PSBleHBlY3RlZC5sZW5ndGgpIHJldHVybiBmYWxz
ZQoKICByZXR1cm4gdGltaW5nU2FmZUVxdWFsKAogICAgQnVmZmVyLmZyb20oaGVhZGVyKSwKICAgIEJ1ZmZlci5mcm9tKGV4cGVjdGVkKSwKICApCn0KYDsK
ICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoY29udGVudCwgbWFya2VyLCBgJHtoZWxwZXJ9JHttYXJrZXJ9YCwgImNyb24gYXV0aCBoZWxwZXIiKTsK
ICB9CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJpZiAoaXNDcm9uUmVxdWVzdChyZXF1ZXN0KSkgcmV0dXJuIFBPU1QocmVxdWVzdCkiKSkgewogICAgY29u
dGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkge2As
CiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGlmIChpc0Nyb25SZXF1ZXN0KHJl
cXVlc3QpKSByZXR1cm4gUE9TVChyZXF1ZXN0KWAsCiAgICApOwogIH0KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgImlmICghY2FuKGFkbWlu
LCAnYnVncycpKSByZXR1cm4gZmFpbCgnU2VtIHBlcm1pc3PDo28gcGFyYSBzY2FubmVyLicsIDQwMykiLAogICAgImlmICghY2FuKGFkbWluLCAnYXVkaXQu
dmlldycpKSByZXR1cm4gZmFpbCgnU2VtIHBlcm1pc3PDo28gcGFyYSB2aXN1YWxpemFyIG8gc2Nhbm5lci4nLCA0MDMpIiwKICApOwoKICBpZiAoIWNvbnRl
bnQuaW5jbHVkZXMoImNvbnN0IGNyb25SZXF1ZXN0ID0gaXNDcm9uUmVxdWVzdChyZXF1ZXN0KSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0
KAogICAgICBjb250ZW50LAogICAgICBgICB0cnkgewogICAgY29uc3QgYWRtaW4gPSBhd2FpdCBnZXRDdXJyZW50QWRtaW4ocmVxdWVzdCkKICAgIGlmICgh
YWRtaW4pIHJldHVybiBmYWlsKCdBY2Vzc28gbmVnYWRvLicsIDQwMykKICAgIGlmICghY2FuKGFkbWluLCAnc2Nhbm5lcicpKSByZXR1cm4gZmFpbCgnU2Vt
IHBlcm1pc3PDo28gcGFyYSByb2RhciBzY2FubmVyLicsIDQwMykKCiAgICBjb25zdCB7IGRhdGE6IHJ1biB9ID0gYXdhaXQgc3VwYWJhc2VBZG1pbmAsCiAg
ICAgIGAgIHRyeSB7CiAgICBjb25zdCBjcm9uUmVxdWVzdCA9IGlzQ3JvblJlcXVlc3QocmVxdWVzdCkKICAgIGNvbnN0IGFkbWluID0gY3JvblJlcXVlc3Qg
PyBudWxsIDogYXdhaXQgZ2V0Q3VycmVudEFkbWluKHJlcXVlc3QpCgogICAgaWYgKCFjcm9uUmVxdWVzdCAmJiAhYWRtaW4pIHJldHVybiBmYWlsKCdBY2Vz
c28gbmVnYWRvLicsIDQwMykKICAgIGlmICghY3JvblJlcXVlc3QgJiYgYWRtaW4gJiYgIWNhbihhZG1pbiwgJ3N5c3RlbS5zY2FuJykpIHsKICAgICAgcmV0
dXJuIGZhaWwoJ1NlbSBwZXJtaXNzw6NvIHBhcmEgcm9kYXIgc2Nhbm5lci4nLCA0MDMpCiAgICB9CgogICAgY29uc3QgYWN0b3JFbWFpbCA9IGNyb25SZXF1
ZXN0CiAgICAgID8gJ2Nyb25Ab3JjYWx5LnN5c3RlbScKICAgICAgOiBhZG1pbj8uZW1haWwgfHwgJ3N5c3RlbUBvcmNhbHkubG9jYWwnCgogICAgY29uc3Qg
eyBkYXRhOiBydW4gfSA9IGF3YWl0IHN1cGFiYXNlQWRtaW5gLAogICAgICAic2Nhbm5lciBjcm9uIGF1dGgiLAogICAgKTsKICB9CiAgY29udGVudCA9IGNv
bnRlbnQucmVwbGFjZSgiICAgICAgICBjcmVhdGVkX2J5OiBhZG1pbi5lbWFpbCwiLCAiICAgICAgICBjcmVhdGVkX2J5OiBhY3RvckVtYWlsLCIpOwogIGNv
bnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgIGF3YWl0IGF1ZGl0TG9nKGFkbWluLmVtYWlsLCAnc2Nhbm5lci5ydW5fZGV0YWlsZWQnLCIsCiAg
ICAiICAgIGF3YWl0IGF1ZGl0TG9nKGFjdG9yRW1haWwsICdzY2FubmVyLnJ1bl9kZXRhaWxlZCcsIiwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCi8v
IDEzLjEpIEFkbWluaXN0cmHDp8OjbyBkZSBlcXVpcGUgY29tIGNvcnBvIGxpbWl0YWRvIGUgcmF0ZSBsaW1pdC4KcGF0Y2goImFwcC9hcGkvYWRtaW4vdGVh
bS9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBOZXh0UmVx
dWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInXG4iLAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9z
ZWN1cml0eS9yYXRlLWxpbWl0JyIsCiAgICAiYWRtaW4gdGVhbSByYXRlIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBj
b250ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQg
eyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JlcXVlc3QnIiwKICAgICJhZG1pbiB0ZWFt
IGJvZHkgaW1wb3J0IiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoInNjb3BlOiAnYWRtaW4tdGVhbS13cml0ZSciKSkgewogICAgY29udGVudCA9
IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgaWYgKCFzZXNzaW9uLm9rKSB7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24o
CiAgICAgIHsgZXJyb3I6IHNlc3Npb24uZXJyb3IgfSwKICAgICAgeyBzdGF0dXM6IHNlc3Npb24uc3RhdHVzIH0sCiAgICApCiAgfQoKICB0cnkgewogICAg
Y29uc3QgYm9keSA9IGF3YWl0IHJlcXVlc3QKICAgICAgLmpzb24oKQogICAgICAuY2F0Y2goKCkgPT4gKHt9KSlgLAogICAgICBgICBpZiAoIXNlc3Npb24u
b2spIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAgICAgeyBlcnJvcjogc2Vzc2lvbi5lcnJvciB9LAogICAgICB7IHN0YXR1czogc2Vzc2lv
bi5zdGF0dXMgfSwKICAgICkKICB9CgogIHRyeSB7CiAgICBjb25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAg
IHNjb3BlOiAnYWRtaW4tdGVhbS13cml0ZScsCiAgICAgIGlkZW50aXR5OiBzZXNzaW9uLmFkbWluLmlkLAogICAgICBsaW1pdDogMzAsCiAgICAgIHdpbmRv
d1NlY29uZHM6IDYwLAogICAgfSkKICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZAoKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8
UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICAzMiAqIDEwMjQsCiAgICApYCwKICAgICAgImFkbWluIHRlYW0gYm91bmRl
ZCBib2R5IiwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShl
cnJvcikiKSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIHJldHVybiBOZXh0UmVzcG9u
c2UuanNvbihgLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9y
KQogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcgoKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgKTsKICB9CiAgcmV0dXJu
IGNvbnRlbnQ7Cn0pOwoKCi8vIDEzLjIpIEFkbWluIGRlIGFmaWxpYWRvcyBlIHRyb2NhIGRlIHNlbmhhIGNvbSBsaW1pdGVzIGUgbWV0YWRhdGEgcHJlc2Vy
dmFkYS4KcGF0Y2goImFwcC9hcGkvYWRtaW4vYWZmaWxpYXRlcy9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVy
KAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInXG4iLAogICAgImltcG9y
dCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0JyIsCiAgICAiYWRtaW4gYWZmaWxpYXRlcyByYXRlIGltcG9y
dCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdA
L2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20g
J0AvbGliL3NlY3VyaXR5L3JlcXVlc3QnIiwKICAgICJhZG1pbiBhZmZpbGlhdGVzIGJvZHkgaW1wb3J0IiwKICApOwoKICBjb250ZW50ID0gY29udGVudC5y
ZXBsYWNlKAogICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGNvbnN0IGJvZHkgPSBh
d2FpdCByZXF1ZXN0CiAgICAgIC5qc29uKCkKICAgICAgLmNhdGNoKCgpID0+ICh7fSkpYCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1
ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNj
b3BlOiAnYWRtaW4tYWZmaWxpYXRlLWFjdGlvbnMnLAogICAgICBsaW1pdDogNjAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSkKICAgIGlmIChi
bG9ja2VkKSByZXR1cm4gYmxvY2tlZAoKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAg
ICByZXF1ZXN0LAogICAgICAzMiAqIDEwMjQsCiAgICApYCwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGJvZHlFcnJvciA9IHJlcXVl
c3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcikiKSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsK
ICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJv
ZHlFcnJvclJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcgoKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihg
LAogICAgKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvYWRtaW4vY2hhbmdlLXBhc3N3b3JkL3JvdXRlLnRzIiwgKGNvbnRl
bnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2Ug
fSBmcm9tICduZXh0L3NlcnZlcidcbiIsCiAgICAiaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQn
IiwKICAgICJhZG1pbiBwYXNzd29yZCByYXRlIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImlt
cG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyByZWFkSnNvbkJvZHks
IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JlcXVlc3QnIiwKICAgICJhZG1pbiBwYXNzd29yZCBib2R5IGltcG9y
dCIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIHRyeSB7CiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxdWVzdAogICAgICAu
anNvbigpCiAgICAgIC5jYXRjaCgoKSA9PiAoe30pKQogICAgY29uc3QgcGFzc3dvcmQgPSB0ZXh0KGJvZHkucGFzc3dvcmQpYCwKICAgIGAgIHRyeSB7CiAg
ICBjb25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNjb3BlOiAnYWRtaW4tcGFzc3dvcmQtY2hhbmdlJywK
ICAgICAgaWRlbnRpdHk6IHNlc3Npb24uYWRtaW4uaWQsCiAgICAgIGxpbWl0OiAxMCwKICAgICAgd2luZG93U2Vjb25kczogMzYwMCwKICAgIH0pCiAgICBp
ZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQKCiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigK
ICAgICAgcmVxdWVzdCwKICAgICAgOCAqIDEwMjQsCiAgICApCiAgICBjb25zdCBwYXNzd29yZCA9IHRleHQoYm9keS5wYXNzd29yZClgLAogICk7CgogIGlm
ICghY29udGVudC5pbmNsdWRlcygiY29uc3QgZXhpc3RpbmdBdXRoVXNlciA9IikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNv
bnRlbnQsCiAgICAgIGAgICAgY29uc3QgeyBlcnJvciB9ID0KICAgICAgYXdhaXQgc2Vzc2lvbi5zdXBhYmFzZUFkbWluLmF1dGguYWRtaW4udXBkYXRlVXNl
ckJ5SWQoCiAgICAgICAgc2Vzc2lvbi5hZG1pbi51c2VyX2lkLAogICAgICAgIHsKICAgICAgICAgIHBhc3N3b3JkLAogICAgICAgICAgdXNlcl9tZXRhZGF0
YTogewogICAgICAgICAgICBtdXN0X2NoYW5nZV9wYXNzd29yZDogZmFsc2UsCiAgICAgICAgICB9LAogICAgICAgIH0sCiAgICAgICkKCiAgICBpZiAoZXJy
b3IpIHRocm93IGVycm9yYCwKICAgICAgYCAgICBjb25zdCBleGlzdGluZ0F1dGhVc2VyID0KICAgICAgYXdhaXQgc2Vzc2lvbi5zdXBhYmFzZUFkbWluLmF1
dGguYWRtaW4uZ2V0VXNlckJ5SWQoCiAgICAgICAgc2Vzc2lvbi5hZG1pbi51c2VyX2lkLAogICAgICApCgogICAgaWYgKAogICAgICBleGlzdGluZ0F1dGhV
c2VyLmVycm9yIHx8CiAgICAgICFleGlzdGluZ0F1dGhVc2VyLmRhdGEudXNlcj8uaWQKICAgICkgewogICAgICB0aHJvdyAoCiAgICAgICAgZXhpc3RpbmdB
dXRoVXNlci5lcnJvciB8fAogICAgICAgIG5ldyBFcnJvcignQ29udGEgYWRtaW5pc3RyYXRpdmEgbsOjbyBlbmNvbnRyYWRhLicpCiAgICAgICkKICAgIH0K
CiAgICBjb25zdCB7IGVycm9yIH0gPQogICAgICBhd2FpdCBzZXNzaW9uLnN1cGFiYXNlQWRtaW4uYXV0aC5hZG1pbi51cGRhdGVVc2VyQnlJZCgKICAgICAg
ICBzZXNzaW9uLmFkbWluLnVzZXJfaWQsCiAgICAgICAgewogICAgICAgICAgcGFzc3dvcmQsCiAgICAgICAgICB1c2VyX21ldGFkYXRhOiB7CiAgICAgICAg
ICAgIC4uLihleGlzdGluZ0F1dGhVc2VyLmRhdGEudXNlci51c2VyX21ldGFkYXRhIHx8IHt9KSwKICAgICAgICAgICAgbXVzdF9jaGFuZ2VfcGFzc3dvcmQ6
IGZhbHNlLAogICAgICAgICAgfSwKICAgICAgICB9LAogICAgICApCgogICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcmAsCiAgICAgICJhZG1pbiBwYXNzd29y
ZCBtZXRhZGF0YSBtZXJnZSIsCiAgICApOwogIH0KCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9y
UmVzcG9uc2UoZXJyb3IpIikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICByZXR1cm4g
TmV4dFJlc3BvbnNlLmpzb24oYCwKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNw
b25zZShlcnJvcikKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJyb3IKCiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgICk7CiAg
fQogIHJldHVybiBjb250ZW50Owp9KTsKCgovLyAxNCkgSGVhbHRoIGNoZWNrIGNvZXJlbnRlIGNvbSBkb2lzIGJhY2tlbmRzIGRlIElBICsgU3RvcmFnZSBy
ZWFsCnBhdGNoKCJhcHAvYXBpL3N5c3RlbS9oZWFsdGgvcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3Qg
eyBkYXRhOiBzdG9yYWdlQnVja2V0cyIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgIGNvbnN0
IGNvbXBhbnlJZCA9IGFjY2Vzcy5jb21wYW55LmlkCgogICAgY29uc3QgW2AsCiAgICAgIGAgICAgY29uc3QgY29tcGFueUlkID0gYWNjZXNzLmNvbXBhbnku
aWQKCiAgICBjb25zdCB7IGRhdGE6IHN0b3JhZ2VCdWNrZXRzLCBlcnJvcjogc3RvcmFnZUVycm9yIH0gPQogICAgICBhd2FpdCBzdXBhYmFzZUFkbWluLnN0
b3JhZ2UubGlzdEJ1Y2tldHMoKQogICAgY29uc3Qgc3RvcmFnZU5hbWVzID0gbmV3IFNldCgKICAgICAgKHN0b3JhZ2VCdWNrZXRzIHx8IFtdKS5tYXAoKGJ1
Y2tldCkgPT4gYnVja2V0Lm5hbWUpLAogICAgKQogICAgY29uc3QgcmVxdWlyZWRTdG9yYWdlQnVja2V0cyA9IFsKICAgICAgJ3NpdGUtYXNzZXRzJywKICAg
ICAgJ3Byb2R1dG9zJywKICAgICAgJ2ZpbmFuY2Vpcm8nLAogICAgICAnYXJ0ZXMnLAogICAgXQogICAgY29uc3QgbWlzc2luZ1N0b3JhZ2VCdWNrZXRzID0g
cmVxdWlyZWRTdG9yYWdlQnVja2V0cy5maWx0ZXIoCiAgICAgIChidWNrZXQpID0+ICFzdG9yYWdlTmFtZXMuaGFzKGJ1Y2tldCksCiAgICApCgogICAgY29u
c3QgW2AsCiAgICAgICJoZWFsdGggc3RvcmFnZSBjaGVjayIsCiAgICApOwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgIGNvbnRlbnQs
CiAgICBgICAgICAgewogICAgICAgIGtleTogJ3N0b3JhZ2UnLAogICAgICAgIHRpdGxlOiAnU3RvcmFnZSBkZSBpbWFnZW5zJywKICAgICAgICBvazogdHJ1
ZSwKICAgICAgICBkZXNjcmlwdGlvbjogJ0J1Y2tldCBzaXRlLWFzc2V0cyBkZXZlIGV4aXN0aXIgbm8gU3VwYWJhc2UuJywKICAgICAgfSxgLAogICAgYCAg
ICAgIHsKICAgICAgICBrZXk6ICdzdG9yYWdlJywKICAgICAgICB0aXRsZTogJ1N1cGFiYXNlIFN0b3JhZ2UnLAogICAgICAgIG9rOiAhc3RvcmFnZUVycm9y
ICYmIG1pc3NpbmdTdG9yYWdlQnVja2V0cy5sZW5ndGggPT09IDAsCiAgICAgICAgZGVzY3JpcHRpb246IHN0b3JhZ2VFcnJvcgogICAgICAgICAgPyAnTsOj
byBmb2kgcG9zc8OtdmVsIGNvbnN1bHRhciBvcyBidWNrZXRzLicKICAgICAgICAgIDogbWlzc2luZ1N0b3JhZ2VCdWNrZXRzLmxlbmd0aAogICAgICAgICAg
ICA/IFxgQnVja2V0cyBhdXNlbnRlczogXCR7bWlzc2luZ1N0b3JhZ2VCdWNrZXRzLmpvaW4oJywgJyl9LlxgCiAgICAgICAgICAgIDogJ0J1Y2tldHMgZXNz
ZW5jaWFpcyBkaXNwb27DrXZlaXMuJywKICAgICAgfSxgLAogICAgImhlYWx0aCBzdG9yYWdlIHRydXRoZnVsIiwKICApOwoKICBjb250ZW50ID0gcmVwbGFj
ZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgICB7CiAgICAgICAga2V5OiAnb3BlbmFpJywKICAgICAgICB0aXRsZTogJ09wZW5BSSAvIElBJywK
ICAgICAgICBvazogQm9vbGVhbihwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSksCiAgICAgICAgZGVzY3JpcHRpb246ICdDaGF2ZSB1c2FkYSBwZWxvIGFz
c2lzdGVudGUgSUEuJywKICAgICAgfSxgLAogICAgYCAgICAgIHsKICAgICAgICBrZXk6ICdvcGVuYWlfZGlyZWN0JywKICAgICAgICB0aXRsZTogJ0lBIGlu
dGVybmEgLyBPcGVuQUknLAogICAgICAgIG9rOiBCb29sZWFuKHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZKSwKICAgICAgICBkZXNjcmlwdGlvbjogJ0Ny
ZWRlbmNpYWwgZG8gYXNzaXN0ZW50ZSBpbnRlcm5vIGNvbmZpZ3VyYWRhLicsCiAgICAgIH0sCiAgICAgIHsKICAgICAgICBrZXk6ICdhaV9nYXRld2F5JywK
ICAgICAgICB0aXRsZTogJ0lBIHDDumJsaWNhIC8gVmVyY2VsIEFJIEdhdGV3YXknLAogICAgICAgIG9rOiBCb29sZWFuKAogICAgICAgICAgcHJvY2Vzcy5l
bnYuQUlfR0FURVdBWV9BUElfS0VZIHx8CiAgICAgICAgICBwcm9jZXNzLmVudi5WRVJDRUxfT0lEQ19UT0tFTgogICAgICAgICksCiAgICAgICAgZGVzY3Jp
cHRpb246ICdDcmVkZW5jaWFsIG91IGlkZW50aWRhZGUgZG8gQUkgR2F0ZXdheSBkaXNwb27DrXZlbC4nLAogICAgICB9LAogICAgICB7CiAgICAgICAga2V5
OiAnY3JvbicsCiAgICAgICAgdGl0bGU6ICdDcm9uIGFkbWluaXN0cmF0aXZvJywKICAgICAgICBvazogQm9vbGVhbihwcm9jZXNzLmVudi5DUk9OX1NFQ1JF
VCksCiAgICAgICAgZGVzY3JpcHRpb246ICdDUk9OX1NFQ1JFVCBwcm90ZWdlIGEgZXhlY3XDp8OjbyBhdXRvbcOhdGljYSBkbyBzY2FubmVyLicsCiAgICAg
IH0sYCwKICAgICJoZWFsdGggQUkgYW5kIGNyb24iLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKCi8vIDE0LjEpIENvbmZpZ3VyYcOnw6NvIGRlY2xh
cmFkYSBzZW0gcXVhbHF1ZXIgc2VncmVkbyByZWFsLgpwYXRjaCgiLmVudi5leGFtcGxlIiwgKGNvbnRlbnQpID0+IHsKICBjb25zdCBhZGRpdGlvbnMgPSBg
CiMgSUEKT1BFTkFJX0FQSV9LRVk9Ck9SQ0FMWV9BSV9NT0RFTD0KQUlfR0FURVdBWV9BUElfS0VZPQoKIyBWZXJjZWwgQ3JvbgpDUk9OX1NFQ1JFVD0KCiMg
QXNhYXMgLSByZXBhc3NlcyBlIGxlZ2FkbyBjb250cm9sYWRvIHBvciBmbGFncwpBU0FBU19FTlY9c2FuZGJveApBU0FBU19BUElfQkFTRV9VUkw9CkFTQUFT
X01BU1RFUl9BUElfS0VZPQpBU0FBU19ST09UX1dBTExFVF9JRD0KQVNBQVNfV0VCSE9PS19BVVRIX1RPS0VOPQpBU0FBU19QUk9EVUNUSU9OX0FQUFJPVkVE
PWZhbHNlCkFTQUFTX0VOQUJMRUQ9ZmFsc2UKQVNBQVNfU1VCQUNDT1VOVFNfRU5BQkxFRD1mYWxzZQpBU0FBU19NQVJLRVRQTEFDRV9FTkFCTEVEPWZhbHNl
CkFTQUFTX1NVQlNDUklQVElPTlNfRU5BQkxFRD1mYWxzZQpBU0FBU19DQVJEX1RPS0VOSVpBVElPTl9FTkFCTEVEPWZhbHNlClBBWU1FTlRfQ0hFQ0tPVVRf
VjJfRU5BQkxFRD1mYWxzZQpQQVlNRU5UX1BST1ZJREVSX0RFRkFVTFQ9bWVyY2Fkb19wYWdvCk9SQ0FMWV9GT1JDRV9ORVdfUEFZTUVOVFM9ZmFsc2UKYDsK
CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJDUk9OX1NFQ1JFVD0iKSkgewogICAgY29udGVudCA9IGAke2NvbnRlbnQudHJpbUVuZCgpfVxuJHthZGRpdGlv
bnN9YDsKICB9CiAgcmV0dXJuIGAke2NvbnRlbnQudHJpbUVuZCgpfVxuYDsKfSk7CgovLyAxNSkgR2l0aWdub3JlIGxpbXBvCmNyZWF0ZU9yUmVwbGFjZSgi
LmdpdGlnbm9yZSIsIGAjIGRlcGVuZGVuY2llcwovbm9kZV9tb2R1bGVzCi8ucG5wCi5wbnAuKgoueWFybi8qCiEueWFybi9wYXRjaGVzCiEueWFybi9wbHVn
aW5zCiEueWFybi9yZWxlYXNlcwohLnlhcm4vdmVyc2lvbnMKCiMgdGVzdGluZwovY292ZXJhZ2UKCiMgbmV4dC5qcwovLm5leHQvCi9vdXQvCgojIHByb2R1
Y3Rpb24KL2J1aWxkCgojIG1pc2MKLkRTX1N0b3JlCioucGVtCioudHNidWlsZGluZm8KbmV4dC1lbnYuZC50cwoKIyBkZWJ1ZyBhbmQgbG9jYWwgcmVwb3J0
cwpucG0tZGVidWcubG9nKgp5YXJuLWRlYnVnLmxvZyoKeWFybi1lcnJvci5sb2cqCi5wbnBtLWRlYnVnLmxvZyoKKi5sb2cKL3FhLW9yY2FseS0qLwovcWEt
Ki50eHQKL2F1ZGl0b3JpYS0qLnR4dAovcmVzdWx0YWRvLSoudHh0Ci9yZXN1bHRhZG8tKi5qc29uCgojIGVudmlyb25tZW50IGFuZCBkZXBsb3ltZW50Ci5l
bnYqCiEuZW52LmV4YW1wbGUKLnZlcmNlbC8KCiMgbG9jYWwgYmFja3VwcyBhbmQgb25lLW9mZiByZXBhaXIgYXJ0aWZhY3RzCi8ub3JjYWx5LSovCi9vcmNh
bHktcGF5bWVudC1mbG93cy1waGFzZTEvCi9vcmNhbHktcGF5bWVudC1mbG93cy1waGFzZTEuemlwCi8qLnBzMQoKIyBsb2NhbCBoYXJkZW5pbmcgb3V0cHV0
Ci8ub3JjYWx5LWhhcmRlbmluZy1sb2NhbC8KL2hhcmRlbmluZy1yZXBvcnQtKi5qc29uCi9oYXJkZW5pbmctcmVwb3J0LSoudHh0CmApOwoKLy8gMTYpIFNl
Y3VyaXR5IGNoZWNrZXIgcGVybWFuZW50ZSBlIGFicmFuZ2VudGUuCgovLyAxOS44KSBJZGVtcG90w6puY2lhIHJlY29ycmVudGUgZGUgYXNzaW5hdHVyYSBl
IGVzdG9ybm8gc2VndXJvIGRlIGFjZXNzby4KcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9
IHJlcGxhY2VPbmNlVGV4dCgKICAgIGNvbnRlbnQsCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1lcmNhZG9QYWdvUGxhdGZvcm1SZXF1ZXN0KAogIHBh
dGg6IHN0cmluZywKICBvcHRpb25zOiBSZXF1ZXN0SW5pdCA9IHt9LAopIHsKICByZXR1cm4gc3Vic2NyaXB0aW9uTWVyY2Fkb1BhZ29SZXF1ZXN0KHBhdGgs
IG9wdGlvbnMpOwp9YCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gbWVyY2Fkb1BhZ29QbGF0Zm9ybVJlcXVlc3QoCiAgcGF0aDogc3RyaW5nLAogIG9w
dGlvbnM6IFJlcXVlc3RJbml0ID0ge30sCiAgaWRlbXBvdGVuY3lLZXk/OiBzdHJpbmcsCikgewogIHJldHVybiBzdWJzY3JpcHRpb25NZXJjYWRvUGFnb1Jl
cXVlc3QoCiAgICBwYXRoLAogICAgb3B0aW9ucywKICAgIGlkZW1wb3RlbmN5S2V5LAogICk7Cn1gLAogICAgInN1YnNjcmlwdGlvbiBwbGF0Zm9ybSByZXF1
ZXN0IGlkZW1wb3RlbmN5IHBhc3N0aHJvdWdoIiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWNvbmNp
bGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQiKSkgewogICAgY29uc3QgYW5jaG9yID0gYGV4cG9ydCBmdW5jdGlvbiBwYXJzZU9yY2FseVN1YnNjcmlw
dGlvblJlZmVyZW5jZSh2YWx1ZTogdW5rbm93bikge2A7CiAgICBjb25zdCBoZWxwZXIgPSBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlY29uY2lsZVJldmVy
c2VkU3Vic2NyaXB0aW9uUGF5bWVudCgKICBhZG1pbjogUmV0dXJuVHlwZTx0eXBlb2YgZ2V0U3VwYWJhc2VBZG1pbj4sCiAgY29tcGFueTogYW55LAogIHBy
b3ZpZGVyUmVmZXJlbmNlOiBzdHJpbmcsCiAgcHJvdmlkZXJTdGF0dXM6IHN0cmluZywKKSB7CiAgY29uc3QgY29tcGFueUlkID0gU3RyaW5nKGNvbXBhbnk/
LmlkIHx8ICIiKS50cmltKCk7CiAgY29uc3QgcmVmZXJlbmNlID0gU3RyaW5nKHByb3ZpZGVyUmVmZXJlbmNlIHx8ICIiKS50cmltKCk7CiAgY29uc3QgcmVt
b3RlU3RhdHVzID0gU3RyaW5nKHByb3ZpZGVyU3RhdHVzIHx8ICJyZXZlcnNlZCIpCiAgICAudHJpbSgpCiAgICAudG9Mb3dlckNhc2UoKTsKCiAgaWYgKCFj
b21wYW55SWQgfHwgIXJlZmVyZW5jZSkgewogICAgcmV0dXJuIHsgcm9sbGVkQmFjazogZmFsc2UsIHJlYXNvbjogIm1pc3NpbmdfcmVmZXJlbmNlIiB9Owog
IH0KCiAgY29uc3QgeyBkYXRhOiBhcHByb3ZhbEV2ZW50LCBlcnJvcjogZXZlbnRFcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgIC5mcm9tKCJzdWJzY3JpcHRp
b25fZXZlbnRzIikKICAgIC5zZWxlY3QoIm1ldGFkYXRhLGNyZWF0ZWRfYXQiKQogICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgLmVxKCJl
dmVudF90eXBlIiwgInBheW1lbnRfYXBwcm92ZWQiKQogICAgLmVxKCJwcm92aWRlcl9yZWZlcmVuY2UiLCByZWZlcmVuY2UpCiAgICAub3JkZXIoImNyZWF0
ZWRfYXQiLCB7IGFzY2VuZGluZzogZmFsc2UgfSkKICAgIC5saW1pdCgxKQogICAgLm1heWJlU2luZ2xlKCk7CgogIGlmIChldmVudEVycm9yKSB0aHJvdyBl
dmVudEVycm9yOwoKICBjb25zdCBtZXRhZGF0YSA9CiAgICBhcHByb3ZhbEV2ZW50Py5tZXRhZGF0YSAmJgogICAgdHlwZW9mIGFwcHJvdmFsRXZlbnQubWV0
YWRhdGEgPT09ICJvYmplY3QiICYmCiAgICAhQXJyYXkuaXNBcnJheShhcHByb3ZhbEV2ZW50Lm1ldGFkYXRhKQogICAgICA/IChhcHByb3ZhbEV2ZW50Lm1l
dGFkYXRhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KQogICAgICA6IHt9OwogIGNvbnN0IGdyYW50ZWRVbnRpbCA9IHZhbGlkRGF0ZShtZXRhZGF0YS5h
Y2Nlc3NfdW50aWwpOwogIGNvbnN0IHByZXZpb3VzVW50aWwgPSB2YWxpZERhdGUobWV0YWRhdGEucHJldmlvdXNfYWNjZXNzX3VudGlsKTsKCiAgY29uc3Qg
eyBkYXRhOiBmcmVzaENvbXBhbnksIGVycm9yOiBjb21wYW55RXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAuZnJvbSgiY29tcGFuaWVzIikKICAgIC5zZWxl
Y3QoIioiKQogICAgLmVxKCJpZCIsIGNvbXBhbnlJZCkKICAgIC5tYXliZVNpbmdsZSgpOwoKICBpZiAoY29tcGFueUVycm9yKSB0aHJvdyBjb21wYW55RXJy
b3I7CiAgaWYgKCFmcmVzaENvbXBhbnk/LmlkKSB7CiAgICByZXR1cm4geyByb2xsZWRCYWNrOiBmYWxzZSwgcmVhc29uOiAiY29tcGFueV9ub3RfZm91bmQi
IH07CiAgfQoKICBjb25zdCBjdXJyZW50VW50aWwgPSBtYXhEYXRlKAogICAgZnJlc2hDb21wYW55LmFjY2Vzc191bnRpbCwKICAgIGZyZXNoQ29tcGFueS5h
c3NpbmF0dXJhX2V4cGlyYV9lbSwKICApOwogIGNvbnN0IHNhbWVHcmFudCA9IEJvb2xlYW4oCiAgICBncmFudGVkVW50aWwgJiYKICAgICAgY3VycmVudFVu
dGlsICYmCiAgICAgIE1hdGguYWJzKGN1cnJlbnRVbnRpbC5nZXRUaW1lKCkgLSBncmFudGVkVW50aWwuZ2V0VGltZSgpKSA8PSA1MDAwLAogICk7CiAgbGV0
IHJvbGxlZEJhY2sgPSBmYWxzZTsKICBsZXQgbmV3U3RhdHVzID0gZnJlc2hDb21wYW55LmFzc2luYXR1cmFfc3RhdHVzIHx8IG51bGw7CiAgbGV0IHJvbGxi
YWNrVW50aWw6IERhdGUgfCBudWxsID0gY3VycmVudFVudGlsOwoKICBpZiAoc2FtZUdyYW50KSB7CiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpOwogICAg
cm9sbGJhY2tVbnRpbCA9IHByZXZpb3VzVW50aWwgJiYgcHJldmlvdXNVbnRpbCA+IG5vdwogICAgICA/IHByZXZpb3VzVW50aWwKICAgICAgOiBub3c7CiAg
ICBuZXdTdGF0dXMgPSAicGFzdF9kdWUiOwoKICAgIGNvbnN0IHsgZXJyb3I6IHJvbGxiYWNrRXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJj
b21wYW5pZXMiKQogICAgICAudXBkYXRlKHsKICAgICAgICBhc3NpbmF0dXJhX3N0YXR1czogbmV3U3RhdHVzLAogICAgICAgIGFzc2luYXR1cmFfZXhwaXJh
X2VtOiByb2xsYmFja1VudGlsLnRvSVNPU3RyaW5nKCksCiAgICAgICAgYWNjZXNzX3VudGlsOiByb2xsYmFja1VudGlsLnRvSVNPU3RyaW5nKCksCiAgICAg
ICAgYXNzaW5hdHVyYV9waXhfYXZ1bHNvX3N0YXR1czoKICAgICAgICAgIFN0cmluZyhmcmVzaENvbXBhbnkuYXNzaW5hdHVyYV9mb3JtYV9wYWdhbWVudG9f
cHJlZmVyaWRhIHx8ICIiKQogICAgICAgICAgICAudG9Mb3dlckNhc2UoKQogICAgICAgICAgICAuaW5jbHVkZXMoInBpeCIpCiAgICAgICAgICAgID8gcmVt
b3RlU3RhdHVzCiAgICAgICAgICAgIDogZnJlc2hDb21wYW55LmFzc2luYXR1cmFfcGl4X2F2dWxzb19zdGF0dXMgfHwgbnVsbCwKICAgICAgICB1cGRhdGVk
X2F0OiBub3cudG9JU09TdHJpbmcoKSwKICAgICAgfSkKICAgICAgLmVxKCJpZCIsIGNvbXBhbnlJZCk7CgogICAgaWYgKHJvbGxiYWNrRXJyb3IpIHRocm93
IHJvbGxiYWNrRXJyb3I7CiAgICByb2xsZWRCYWNrID0gdHJ1ZTsKICB9CgogIGF3YWl0IHJlY29yZFN1YnNjcmlwdGlvbkV2ZW50KGFkbWluLCB7CiAgICBj
b21wYW55SWQsCiAgICBldmVudFR5cGU6ICJwYXltZW50X3JldmVyc2VkIiwKICAgIG9sZFN0YXR1czogZnJlc2hDb21wYW55LmFzc2luYXR1cmFfc3RhdHVz
IHx8IG51bGwsCiAgICBuZXdTdGF0dXMsCiAgICBwcm92aWRlclJlZmVyZW5jZTogcmVmZXJlbmNlICsgIjoiICsgcmVtb3RlU3RhdHVzLAogICAgbWV0YWRh
dGE6IHsKICAgICAgb3JpZ2luYWxfcHJvdmlkZXJfcmVmZXJlbmNlOiByZWZlcmVuY2UsCiAgICAgIHByb3ZpZGVyX3N0YXR1czogcmVtb3RlU3RhdHVzLAog
ICAgICByb2xsZWRfYmFjazogcm9sbGVkQmFjaywKICAgICAgZ3JhbnRlZF9hY2Nlc3NfdW50aWw6IGdyYW50ZWRVbnRpbD8udG9JU09TdHJpbmcoKSB8fCBu
dWxsLAogICAgICBwcmV2aW91c19hY2Nlc3NfdW50aWw6IHByZXZpb3VzVW50aWw/LnRvSVNPU3RyaW5nKCkgfHwgbnVsbCwKICAgICAgY3VycmVudF9hY2Nl
c3NfdW50aWw6IGN1cnJlbnRVbnRpbD8udG9JU09TdHJpbmcoKSB8fCBudWxsLAogICAgICByZXN1bHRpbmdfYWNjZXNzX3VudGlsOiByb2xsYmFja1VudGls
Py50b0lTT1N0cmluZygpIHx8IG51bGwsCiAgICB9LAogIH0pOwoKICByZXR1cm4gewogICAgcm9sbGVkQmFjaywKICAgIGFjY2Vzc1VudGlsOiByb2xsYmFj
a1VudGlsPy50b0lTT1N0cmluZygpIHx8IG51bGwsCiAgfTsKfQoKYDsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAg
ICAgIGFuY2hvciwKICAgICAgYCR7aGVscGVyfSR7YW5jaG9yfWAsCiAgICAgICJzdWJzY3JpcHRpb24gcmV2ZXJzYWwgaGVscGVyIiwKICAgICk7CiAgfQoK
ICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgIGFtb3VudDogb3B0aW9ucy5hbW91bnQgfHwgbnVsbCwKICAgICAgYWNjZXNzX3VudGls
OiBuZXdBY2Nlc3NVbnRpbC50b0lTT1N0cmluZygpLGAsCiAgICBgICAgICAgYW1vdW50OiBvcHRpb25zLmFtb3VudCB8fCBudWxsLAogICAgICBwcmV2aW91
c19hY2Nlc3NfdW50aWw6IGN1cnJlbnRFbmQ/LnRvSVNPU3RyaW5nKCkgfHwgbnVsbCwKICAgICAgYWNjZXNzX3VudGlsOiBuZXdBY2Nlc3NVbnRpbC50b0lT
T1N0cmluZygpLGAsCiAgKTsKCiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50
LnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImV4aXN0aW5nUGF5bWVudFJvdyIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFj
ZU9uY2VSZWdleCgKICAgICAgY29udGVudCwKICAgICAgLyAgY29uc3QgXHsgZGF0YTogcGF5bWVudFJvdywgZXJyb3I6IHBheW1lbnRFcnJvciBcfSA9W1xz
XFNdKj8gIGNvbnN0IGV4dGVybmFsUmVmZXJlbmNlID0gYnVpbGRTdWJzY3JpcHRpb25SZWZlcmVuY2VcKFx7XG4gICAga2luZDogInJlY3VycmluZyIsXG4g
ICAgY29tcGFueUlkLFxuICAgIHBsYW46IHBsYW5LZXksXG4gICAgcGF5bWVudFJvd0lkOiBTdHJpbmdcKHBheW1lbnRSb3dcLmlkXCksXG4gIFx9XCk7LywK
ICAgICAgYCAgY29uc3QgeyBkYXRhOiBleGlzdGluZ1BheW1lbnRSb3csIGVycm9yOiBleGlzdGluZ1BheW1lbnRFcnJvciB9ID0KICAgIGF3YWl0IGNvbnRl
eHQuYWRtaW4KICAgICAgLmZyb20oInBsYW5fcGF5bWVudHMiKQogICAgICAuc2VsZWN0KCIqIikKICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlk
KQogICAgICAuZXEoImlkZW1wb3RlbmN5X2tleSIsIGlkZW1wb3RlbmN5S2V5KQogICAgICAubWF5YmVTaW5nbGUoKTsKCiAgaWYgKGV4aXN0aW5nUGF5bWVu
dEVycm9yKSB0aHJvdyBleGlzdGluZ1BheW1lbnRFcnJvcjsKCiAgbGV0IHBheW1lbnRSb3cgPSBleGlzdGluZ1BheW1lbnRSb3cgYXMgSnNvblJlY29yZCB8
IG51bGw7CgogIGlmICgKICAgIHBheW1lbnRSb3cgJiYKICAgIG5vcm1hbGl6ZVBsYW5LZXkocGF5bWVudFJvdy5wbGFubykgIT09IHBsYW5LZXkKICApIHsK
ICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigiQSBjaGF2ZSBkZSBpZGVtcG90w6puY2lhIGrDoSBmb2kgdXNhZGEgZW0gb3V0cm8g
cGxhbm8uIiksCiAgICAgIHsgc3RhdHVzOiA0MDkgfSwKICAgICk7CiAgfQoKICBpZiAoIXBheW1lbnRSb3cpIHsKICAgIGNvbnN0IGluc2VydGVkID0gYXdh
aXQgY29udGV4dC5hZG1pbgogICAgICAuZnJvbSgicGxhbl9wYXltZW50cyIpCiAgICAgIC5pbnNlcnQoewogICAgICAgIGNvbXBhbnlfaWQ6IGNvbXBhbnlJ
ZCwKICAgICAgICBwbGFubzogcGxhbktleSwKICAgICAgICB2YWxvcjogcGxhbi5wcmljZSwKICAgICAgICBzdGF0dXM6ICJjcmVhdGVkIiwKICAgICAgICB0
aXBvOiAic3Vic2NyaXB0aW9uIiwKICAgICAgICBwYXltZW50X21ldGhvZDogImNhcmRfcmVjdXJyaW5nIiwKICAgICAgICBwcm92aWRlcjogIm1lcmNhZG9f
cGFnbyIsCiAgICAgICAgaWRlbXBvdGVuY3lfa2V5OiBpZGVtcG90ZW5jeUtleSwKICAgICAgICBlbWFpbDogcGF5ZXJFbWFpbCwKICAgICAgICBub21lX2Vt
cHJlc2E6IHRleHQoY29tcGFueS5ub21lKSB8fCAiRW1wcmVzYSIsCiAgICAgIH0pCiAgICAgIC5zZWxlY3QoIioiKQogICAgICAuc2luZ2xlKCk7CgogICAg
aWYgKGluc2VydGVkLmVycm9yIHx8ICFpbnNlcnRlZC5kYXRhPy5pZCkgewogICAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICAgIG5ldyBFcnJvcigK
ICAgICAgICAgIGluc2VydGVkLmVycm9yPy5tZXNzYWdlIHx8CiAgICAgICAgICAgICJOYW8gZm9pIHBvc3NpdmVsIHByZXBhcmFyIGEgYXNzaW5hdHVyYS4i
LAogICAgICAgICksCiAgICAgICAgeyBzdGF0dXM6IDUwMCB9LAogICAgICApOwogICAgfQoKICAgIHBheW1lbnRSb3cgPSBpbnNlcnRlZC5kYXRhIGFzIEpz
b25SZWNvcmQ7CiAgfQoKICBjb25zdCBleHRlcm5hbFJlZmVyZW5jZSA9CiAgICB0ZXh0KHBheW1lbnRSb3cuZXh0ZXJuYWxfcmVmZXJlbmNlKSB8fAogICAg
YnVpbGRTdWJzY3JpcHRpb25SZWZlcmVuY2UoewogICAgICBraW5kOiAicmVjdXJyaW5nIiwKICAgICAgY29tcGFueUlkLAogICAgICBwbGFuOiBwbGFuS2V5
LAogICAgICBwYXltZW50Um93SWQ6IFN0cmluZyhwYXltZW50Um93LmlkKSwKICAgIH0pOwoKICBpZiAoIXRleHQocGF5bWVudFJvdy5leHRlcm5hbF9yZWZl
cmVuY2UpKSB7CiAgICBjb25zdCB7IGVycm9yOiByZWZlcmVuY2VFcnJvciB9ID0gYXdhaXQgY29udGV4dC5hZG1pbgogICAgICAuZnJvbSgicGxhbl9wYXlt
ZW50cyIpCiAgICAgIC51cGRhdGUoewogICAgICAgIGV4dGVybmFsX3JlZmVyZW5jZTogZXh0ZXJuYWxSZWZlcmVuY2UsCiAgICAgICAgdXBkYXRlZF9hdDog
bmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICB9KQogICAgICAuZXEoImlkIiwgcGF5bWVudFJvdy5pZCkKICAgICAgLmVxKCJjb21wYW55X2lkIiwg
Y29tcGFueUlkKTsKCiAgICBpZiAocmVmZXJlbmNlRXJyb3IpIHRocm93IHJlZmVyZW5jZUVycm9yOwogICAgcGF5bWVudFJvdy5leHRlcm5hbF9yZWZlcmVu
Y2UgPSBleHRlcm5hbFJlZmVyZW5jZTsKICB9YCwKICAgICAgInRyYW5zcGFyZW50IHN1YnNjcmlwdGlvbiBpZGVtcG90ZW50IHJvdyByZXVzZSIsCiAgICAp
OwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAgICBjb250ZW50LAogICAgLyAgbGV0IHN1YnNjcmlwdGlvbjogSnNvblJlY29yZDtcblxu
ICB0cnkgXHtbXHNcU10qP1xuICBcfVxuXG4gIGNvbnN0IHN1YnNjcmlwdGlvbklkID0gdGV4dFwoc3Vic2NyaXB0aW9uXC5pZFwpOy8sCiAgICBgICBsZXQg
c3Vic2NyaXB0aW9uOiBKc29uUmVjb3JkOwogIGNvbnN0IGV4aXN0aW5nU3Vic2NyaXB0aW9uSWQgPSB0ZXh0KAogICAgcGF5bWVudFJvdy5wcm92aWRlcl9z
dWJzY3JpcHRpb25faWQgfHwKICAgICAgcGF5bWVudFJvdy5tZXJjYWRvX3BhZ29fcHJlYXBwcm92YWxfaWQsCiAgKTsKCiAgaWYgKGV4aXN0aW5nU3Vic2Ny
aXB0aW9uSWQpIHsKICAgIHN1YnNjcmlwdGlvbiA9IChhd2FpdCBtZXJjYWRvUGFnb1BsYXRmb3JtUmVxdWVzdCgKICAgICAgXGAvcHJlYXBwcm92YWwvXCR7
ZW5jb2RlVVJJQ29tcG9uZW50KGV4aXN0aW5nU3Vic2NyaXB0aW9uSWQpfVxgLAogICAgKSkgYXMgSnNvblJlY29yZDsKICB9IGVsc2UgewogICAgdHJ5IHsK
ICAgICAgc3Vic2NyaXB0aW9uID0KICAgICAgICAoYXdhaXQgbWVyY2Fkb1BhZ29QbGF0Zm9ybVJlcXVlc3QoCiAgICAgICAgICAiL3ByZWFwcHJvdmFsIiwK
ICAgICAgICAgIHsKICAgICAgICAgICAgbWV0aG9kOiAiUE9TVCIsCiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsKICAgICAgICAgICAgICBy
ZWFzb246IFxgUGxhbm8gXCR7cGxhbi5uYW1lfSAtIE9yY2FseVxgLAogICAgICAgICAgICAgIGV4dGVybmFsX3JlZmVyZW5jZTogZXh0ZXJuYWxSZWZlcmVu
Y2UsCiAgICAgICAgICAgICAgcGF5ZXJfZW1haWw6IHBheWVyRW1haWwsCiAgICAgICAgICAgICAgY2FyZF90b2tlbl9pZDogY2FyZFRva2VuSWQsCiAgICAg
ICAgICAgICAgYXV0b19yZWN1cnJpbmc6IGF1dG9SZWN1cnJpbmcsCiAgICAgICAgICAgICAgYmFja191cmw6IFxgXCR7Z2V0QXBwVXJsKCl9L3BhaW5lbC9h
c3NpbmF0dXJhXGAsCiAgICAgICAgICAgICAgc3RhdHVzOiAiYXV0aG9yaXplZCIsCiAgICAgICAgICAgIH0pLAogICAgICAgICAgfSwKICAgICAgICAgIGlk
ZW1wb3RlbmN5S2V5LAogICAgICAgICkpIGFzIEpzb25SZWNvcmQ7CiAgICB9IGNhdGNoIChlcnJvcikgewogICAgICBjb25zdCBwcm92aWRlclN0YXR1cyA9
CiAgICAgICAgZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAib2JqZWN0IiAmJiAic3RhdHVzIiBpbiBlcnJvcgogICAgICAgICAgPyBOdW1iZXIoKGVycm9y
IGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pLnN0YXR1cyB8fCAwKQogICAgICAgICAgOiAwOwoKICAgICAgYXdhaXQgY29udGV4dC5hZG1pbgogICAgICAgIC5m
cm9tKCJwbGFuX3BheW1lbnRzIikKICAgICAgICAudXBkYXRlKHsKICAgICAgICAgIHN0YXR1czoKICAgICAgICAgICAgcHJvdmlkZXJTdGF0dXMgPj0gNDAw
ICYmIHByb3ZpZGVyU3RhdHVzIDwgNTAwCiAgICAgICAgICAgICAgPyAiZmFpbGVkIgogICAgICAgICAgICAgIDogImNyZWF0aW5nIiwKICAgICAgICAgIHVw
ZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICB9KQogICAgICAgIC5lcSgiaWQiLCBwYXltZW50Um93LmlkKQogICAgICAgIC5l
cSgiY29tcGFueV9pZCIsIGNvbXBhbnlJZCk7CgogICAgICB0aHJvdyBlcnJvcjsKICAgIH0KICB9CgogIGNvbnN0IHN1YnNjcmlwdGlvbklkID0gdGV4dChz
dWJzY3JpcHRpb24uaWQpO2AsCiAgICAidHJhbnNwYXJlbnQgc3Vic2NyaXB0aW9uIHByb3ZpZGVyIGlkZW1wb3RlbmN5IiwKICApOwoKICByZXR1cm4gY29u
dGVudDsKfSk7CgoKcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNv
bnRlbnQuaW5jbHVkZXMoInNhbWVJZGVtcG90ZW50U3Vic2NyaXB0aW9uIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRl
bnQsCiAgICAgIGAgIGlmICgKICAgIGN1cnJlbnRTdWJzY3JpcHRpb25JZCAmJgogICAgWyJhdXRob3JpemVkIiwgInBlbmRpbmciLCAicGF1c2VkIl0uaW5j
bHVkZXMoCiAgICAgIGN1cnJlbnRQcm92aWRlclN0YXR1cywKICAgICkgJiYKICAgICFCb29sZWFuKGNvbXBhbnkuY2FuY2VsX2F0X3BlcmlvZF9lbmQpCiAg
KSB7CiAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICBuZXcgRXJyb3IoCiAgICAgICAgIkVzdGEgZW1wcmVzYSBqYSBwb3NzdWkgdW1hIGFzc2luYXR1
cmEgcmVjb3JyZW50ZS4iLAogICAgICApLAogICAgICB7IHN0YXR1czogNDA5IH0sCiAgICApOwogIH1gLAogICAgICBgICBjb25zdCB7IGRhdGE6IGN1cnJl
bnRJZGVtcG90ZW50Um93LCBlcnJvcjogY3VycmVudElkZW1wb3RlbnRFcnJvciB9ID0KICAgIGF3YWl0IGNvbnRleHQuYWRtaW4KICAgICAgLmZyb20oInBs
YW5fcGF5bWVudHMiKQogICAgICAuc2VsZWN0KCJwcm92aWRlcl9zdWJzY3JpcHRpb25faWQsbWVyY2Fkb19wYWdvX3ByZWFwcHJvdmFsX2lkIikKICAgICAg
LmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgICAuZXEoImlkZW1wb3RlbmN5X2tleSIsIGlkZW1wb3RlbmN5S2V5KQogICAgICAubWF5YmVTaW5n
bGUoKTsKCiAgaWYgKGN1cnJlbnRJZGVtcG90ZW50RXJyb3IpIHRocm93IGN1cnJlbnRJZGVtcG90ZW50RXJyb3I7CgogIGNvbnN0IGlkZW1wb3RlbnRTdWJz
Y3JpcHRpb25JZCA9IHRleHQoCiAgICBjdXJyZW50SWRlbXBvdGVudFJvdz8ucHJvdmlkZXJfc3Vic2NyaXB0aW9uX2lkIHx8CiAgICAgIGN1cnJlbnRJZGVt
cG90ZW50Um93Py5tZXJjYWRvX3BhZ29fcHJlYXBwcm92YWxfaWQsCiAgKTsKICBjb25zdCBzYW1lSWRlbXBvdGVudFN1YnNjcmlwdGlvbiA9IEJvb2xlYW4o
CiAgICBjdXJyZW50U3Vic2NyaXB0aW9uSWQgJiYKICAgICAgaWRlbXBvdGVudFN1YnNjcmlwdGlvbklkICYmCiAgICAgIGN1cnJlbnRTdWJzY3JpcHRpb25J
ZCA9PT0gaWRlbXBvdGVudFN1YnNjcmlwdGlvbklkLAogICk7CgogIGlmICgKICAgIGN1cnJlbnRTdWJzY3JpcHRpb25JZCAmJgogICAgWyJhdXRob3JpemVk
IiwgInBlbmRpbmciLCAicGF1c2VkIl0uaW5jbHVkZXMoCiAgICAgIGN1cnJlbnRQcm92aWRlclN0YXR1cywKICAgICkgJiYKICAgICFCb29sZWFuKGNvbXBh
bnkuY2FuY2VsX2F0X3BlcmlvZF9lbmQpICYmCiAgICAhc2FtZUlkZW1wb3RlbnRTdWJzY3JpcHRpb24KICApIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24o
CiAgICAgIG5ldyBFcnJvcigKICAgICAgICAiRXN0YSBlbXByZXNhIGphIHBvc3N1aSB1bWEgYXNzaW5hdHVyYSByZWNvcnJlbnRlLiIsCiAgICAgICksCiAg
ICAgIHsgc3RhdHVzOiA0MDkgfSwKICAgICk7CiAgfWAsCiAgICAgICJ0cmFuc3BhcmVudCBzdWJzY3JpcHRpb24gc2FtZSBpZGVtcG90ZW50IHJldHJ5IiwK
ICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJjb21wb25lbnRzL3N1YnNjcmlwdGlvbi9NZXJjYWRvUGFnb1N1YnNjcmlwdGlvbkNo
ZWNrb3V0LnRzeCIsIChjb250ZW50KSA9PiB7CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdyZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gIiI7
XG4gICAgICAgICAgc2V0UGF5bWVudFN0YXR1cygicGFpZCIpOycpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAog
ICAgICBgICAgICAgICAgIHNldFBheW1lbnRTdGF0dXMoInBhaWQiKTsKICAgICAgICAgIHNldE1lc3NhZ2UoIlJlbm92YcOnw6NvIGF1dG9tw6F0aWNhIGF0
aXZhZGEuIik7YCwKICAgICAgYCAgICAgICAgICByZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gIiI7CiAgICAgICAgICBzZXRQYXltZW50U3Rh
dHVzKCJwYWlkIik7CiAgICAgICAgICBzZXRNZXNzYWdlKCJSZW5vdmHDp8OjbyBhdXRvbcOhdGljYSBhdGl2YWRhLiIpO2AsCiAgICAgICJyZWN1cnJpbmcg
Y2hlY2tvdXQgY2xlYXIgaWRlbXBvdGVuY3kgb24gc3VjY2VzcyIsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgibGliL3N1YnNj
cmlwdGlvbi1jaGVja291dC1wYXltZW50LnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAg
JyAgYXBwbHlBcHByb3ZlZFN1YnNjcmlwdGlvblBheW1lbnQsXG4nLAogICAgJyAgcmVjb25jaWxlUmV2ZXJzZWRTdWJzY3JpcHRpb25QYXltZW50LCcsCiAg
ICAic3Vic2NyaXB0aW9uIG9uZS10aW1lIHJldmVyc2FsIGltcG9ydCIsCiAgKTsKCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJhd2FpdCByZWNvbmNpbGVS
ZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQoXG4gICAgICAgIGFkbWluLFxuICAgICAgICBjb21wYW55LCIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9u
Y2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFk
bWluLAogICAgICAgIHBheW1lbnRJZCwKICAgICAgICBcYFBhZ2FtZW50byBcJHtyZW1vdGVTdGF0dXN9IG5vIE1lcmNhZG8gUGFnby5cYCwKICAgICAgKS5j
YXRjaCgoYWZmaWxpYXRlRXJyb3IpID0+IHsKICAgICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgIm9yY2FseV9hZmZpbGlhdGVfcmV2ZXJzYWxfZXJy
b3IiLAogICAgICAgICAgYWZmaWxpYXRlRXJyb3IgaW5zdGFuY2VvZiBFcnJvcgogICAgICAgICAgICA/IGFmZmlsaWF0ZUVycm9yLm1lc3NhZ2UKICAgICAg
ICAgICAgOiBhZmZpbGlhdGVFcnJvciwKICAgICAgICApOwogICAgICB9KTtgLAogICAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Np
b25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHBheW1lbnRJZCwKICAgICAgICBcYFBhZ2FtZW50byBcJHtyZW1vdGVTdGF0dXN9IG5vIE1l
cmNhZG8gUGFnby5cYCwKICAgICAgKS5jYXRjaCgoYWZmaWxpYXRlRXJyb3IpID0+IHsKICAgICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgIm9yY2Fs
eV9hZmZpbGlhdGVfcmV2ZXJzYWxfZXJyb3IiLAogICAgICAgICAgYWZmaWxpYXRlRXJyb3IgaW5zdGFuY2VvZiBFcnJvcgogICAgICAgICAgICA/IGFmZmls
aWF0ZUVycm9yLm1lc3NhZ2UKICAgICAgICAgICAgOiBhZmZpbGlhdGVFcnJvciwKICAgICAgICApOwogICAgICB9KTsKCiAgICAgIGF3YWl0IHJlY29uY2ls
ZVJldmVyc2VkU3Vic2NyaXB0aW9uUGF5bWVudCgKICAgICAgICBhZG1pbiwKICAgICAgICBjb21wYW55LAogICAgICAgIHBheW1lbnRJZCwKICAgICAgICBy
ZW1vdGVTdGF0dXMsCiAgICAgICk7YCwKICAgICAgInN1YnNjcmlwdGlvbiBvbmUtdGltZSBhY2Nlc3MgcmV2ZXJzYWwiLAogICAgKTsKICB9CiAgcmV0dXJu
IGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvbWVyY2Fkby1wYWdvL3dlYmhvb2svcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBh
ZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnICByZWNvcmRTdWJzY3JpcHRpb25FdmVudCxcbicsCiAgICAnICByZWNvbmNpbGVSZXZlcnNlZFN1
YnNjcmlwdGlvblBheW1lbnQsJywKICAgICJzdWJzY3JpcHRpb24gd2ViaG9vayByZXZlcnNhbCBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50
LnJlcGxhY2UoCiAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHBy
b3ZpZGVyUmVmZXJlbmNlLAogICAgICAgIFxgUGFnYW1lbnRvIHJlY29ycmVudGUgXCR7cGF5bWVudFN0YXR1c30uXGAsCiAgICAgICk7YCwKICAgIGAgICAg
ICBhd2FpdCByZXZlcnNlQWZmaWxpYXRlQ29tbWlzc2lvbkZvclBheW1lbnQoCiAgICAgICAgYWRtaW4sCiAgICAgICAgcHJvdmlkZXJSZWZlcmVuY2UsCiAg
ICAgICAgXGBQYWdhbWVudG8gcmVjb3JyZW50ZSBcJHtwYXltZW50U3RhdHVzfS5cYCwKICAgICAgKTsKICAgICAgYXdhaXQgcmVjb25jaWxlUmV2ZXJzZWRT
dWJzY3JpcHRpb25QYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIGZvdW5kLmNvbXBhbnksCiAgICAgICAgcHJvdmlkZXJSZWZlcmVuY2UsCiAgICAg
ICAgcGF5bWVudFN0YXR1cywKICAgICAgKTtgLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFm
ZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHByb3ZpZGVyUmVmZXJlbmNlLAogICAgICAgIFxgUGFnYW1lbnRv
IFBpeCBcJHtzdGF0dXN9LlxgLAogICAgICApO2AsCiAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAg
ICAgIGFkbWluLAogICAgICAgIHByb3ZpZGVyUmVmZXJlbmNlLAogICAgICAgIFxgUGFnYW1lbnRvIFBpeCBcJHtzdGF0dXN9LlxgLAogICAgICApOwogICAg
ICBhd2FpdCByZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQoCiAgICAgICAgYWRtaW4sCiAgICAgICAgZm91bmQuY29tcGFueSwKICAgICAg
ICBwcm92aWRlclJlZmVyZW5jZSwKICAgICAgICBzdGF0dXMsCiAgICAgICk7YCwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgoKLy8gMTkuOSkgQXBs
aWNhw6fDo28gZGUgcGFnYW1lbnRvIGFwcm92YWRhIGV4YXRhbWVudGUgdW1hIHZleiwgbWVzbW8gY29tIHdlYmhvb2tzIHJlcGV0aWRvcy4KcGF0Y2goImxp
Yi9zdWJzY3JpcHRpb24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAgICBjb250ZW50LAogICAg
L2V4cG9ydCBhc3luYyBmdW5jdGlvbiBhcHBseUFwcHJvdmVkU3Vic2NyaXB0aW9uUGF5bWVudFwoW1xzXFNdKlxuXH0kLywKICAgIGBleHBvcnQgYXN5bmMg
ZnVuY3Rpb24gYXBwbHlBcHByb3ZlZFN1YnNjcmlwdGlvblBheW1lbnQoCiAgYWRtaW46IFJldHVyblR5cGU8dHlwZW9mIGdldFN1cGFiYXNlQWRtaW4+LAog
IGNvbXBhbnk6IGFueSwKICBvcHRpb25zOiB7CiAgICBwbGFuPzogdW5rbm93bjsKICAgIHByb3ZpZGVyUmVmZXJlbmNlOiBzdHJpbmc7CiAgICBwcmVhcHBy
b3ZhbElkPzogc3RyaW5nIHwgbnVsbDsKICAgIG5leHRQYXltZW50RGF0ZT86IHN0cmluZyB8IG51bGw7CiAgICBwYXltZW50VHlwZTogInBpeCIgfCAiY2Fy
ZCIgfCAiY2FyZF9yZWN1cnJpbmciOwogICAgYW1vdW50PzogbnVtYmVyIHwgbnVsbDsKICB9LAopIHsKICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpOwogIGNv
bnN0IHBsYW5LZXkgPSBub3JtYWxpemVQbGFuKAogICAgb3B0aW9ucy5wbGFuIHx8IGNvbXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fCBjb21wYW55LnBsYW5v
LAogICk7CiAgY29uc3QgY3VycmVudEVuZCA9IG1heERhdGUoCiAgICBjb21wYW55LmFjY2Vzc191bnRpbCwKICAgIGNvbXBhbnkuYXNzaW5hdHVyYV9leHBp
cmFfZW0sCiAgKTsKICBjb25zdCBwcm92aWRlck5leHQgPSB2YWxpZERhdGUob3B0aW9ucy5uZXh0UGF5bWVudERhdGUpOwogIGNvbnN0IG5ld0FjY2Vzc1Vu
dGlsID0KICAgIHByb3ZpZGVyTmV4dCAmJiBwcm92aWRlck5leHQgPiBub3cKICAgICAgPyBwcm92aWRlck5leHQKICAgICAgOiBhZGRNb250aChjdXJyZW50
RW5kICYmIGN1cnJlbnRFbmQgPiBub3cgPyBjdXJyZW50RW5kIDogbm93KTsKICBjb25zdCBwcm92aWRlclJlZmVyZW5jZSA9IFN0cmluZyhvcHRpb25zLnBy
b3ZpZGVyUmVmZXJlbmNlIHx8ICIiKS50cmltKCk7CgogIGlmICghcHJvdmlkZXJSZWZlcmVuY2UpIHsKICAgIHRocm93IG5ldyBFcnJvcigiUmVmZXLDqm5j
aWEgZG8gcGFnYW1lbnRvIGFwcm92YWRhIGF1c2VudGUuIik7CiAgfQoKICBjb25zdCB7IGRhdGE6IGFwcGxpZWQsIGVycm9yOiBhcHBseUVycm9yIH0gPSBh
d2FpdCBhZG1pbi5ycGMoCiAgICAib3JjYWx5X2FwcGx5X3N1YnNjcmlwdGlvbl9wYXltZW50X29uY2UiLAogICAgewogICAgICBwX2NvbXBhbnlfaWQ6IGNv
bXBhbnkuaWQsCiAgICAgIHBfcHJvdmlkZXJfcmVmZXJlbmNlOiBwcm92aWRlclJlZmVyZW5jZSwKICAgICAgcF9wbGFuOiBwbGFuS2V5LAogICAgICBwX3Bh
eW1lbnRfdHlwZTogb3B0aW9ucy5wYXltZW50VHlwZSwKICAgICAgcF9hbW91bnQ6IG9wdGlvbnMuYW1vdW50IHx8IG51bGwsCiAgICAgIHBfcHJldmlvdXNf
c3RhdHVzOiBjb21wYW55LmFzc2luYXR1cmFfc3RhdHVzIHx8IG51bGwsCiAgICAgIHBfcHJldmlvdXNfYWNjZXNzX3VudGlsOiBjdXJyZW50RW5kPy50b0lT
T1N0cmluZygpIHx8IG51bGwsCiAgICAgIHBfbmV3X2FjY2Vzc191bnRpbDogbmV3QWNjZXNzVW50aWwudG9JU09TdHJpbmcoKSwKICAgICAgcF9wcmVhcHBy
b3ZhbF9pZDogb3B0aW9ucy5wcmVhcHByb3ZhbElkIHx8IG51bGwsCiAgICAgIHBfbmV4dF9wYXltZW50X2RhdGU6IG9wdGlvbnMubmV4dFBheW1lbnREYXRl
IHx8IG51bGwsCiAgICB9LAogICk7CgogIGlmIChhcHBseUVycm9yKSB0aHJvdyBhcHBseUVycm9yOwoKICBjb25zdCB7IGRhdGE6IHVwZGF0ZWRDb21wYW55
LCBlcnJvcjogY29tcGFueUVycm9yIH0gPSBhd2FpdCBhZG1pbgogICAgLmZyb20oImNvbXBhbmllcyIpCiAgICAuc2VsZWN0KCIqIikKICAgIC5lcSgiaWQi
LCBjb21wYW55LmlkKQogICAgLnNpbmdsZSgpOwoKICBpZiAoY29tcGFueUVycm9yIHx8ICF1cGRhdGVkQ29tcGFueT8uaWQpIHsKICAgIHRocm93IGNvbXBh
bnlFcnJvciB8fCBuZXcgRXJyb3IoIkVtcHJlc2EgbsOjbyBlbmNvbnRyYWRhIGFww7NzIHBhZ2FtZW50by4iKTsKICB9CgogIHRyeSB7CiAgICBhd2FpdCBj
cmVhdGVBZmZpbGlhdGVDb21taXNzaW9uRm9yQXBwcm92ZWRQYXltZW50KAogICAgICBhZG1pbiwKICAgICAgdXBkYXRlZENvbXBhbnksCiAgICAgIHsKICAg
ICAgICBwcm92aWRlclBheW1lbnRJZDogcHJvdmlkZXJSZWZlcmVuY2UsCiAgICAgICAgcGxhbjogcGxhbktleSwKICAgICAgICBhbW91bnQ6IG9wdGlvbnMu
YW1vdW50IHx8IG51bGwsCiAgICAgICAgcGFpZEF0OiBub3cudG9JU09TdHJpbmcoKSwKICAgICAgfSwKICAgICk7CiAgfSBjYXRjaCAoYWZmaWxpYXRlRXJy
b3IpIHsKICAgIGNvbnNvbGUuZXJyb3IoCiAgICAgICJvcmNhbHlfYWZmaWxpYXRlX2NvbW1pc3Npb25fZXJyb3IiLAogICAgICBhZmZpbGlhdGVFcnJvciBp
bnN0YW5jZW9mIEVycm9yCiAgICAgICAgPyBhZmZpbGlhdGVFcnJvci5tZXNzYWdlCiAgICAgICAgOiBhZmZpbGlhdGVFcnJvciwKICAgICk7CiAgfQoKICBp
ZiAoYXBwbGllZCAhPT0gdHJ1ZSkgewogICAgcmV0dXJuIHVwZGF0ZWRDb21wYW55OwogIH0KCiAgcmV0dXJuIHVwZGF0ZWRDb21wYW55Owp9YCwKICAgICJz
dWJzY3JpcHRpb24gcGF5bWVudCBhcHBseSBleGFjdGx5IG9uY2UiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKY3JlYXRlT3JSZXBsYWNlKCJzY3Jp
cHRzL3NlY3VyaXR5LWNoZWNrLm1qcyIsIGBpbXBvcnQgZnMgZnJvbSAnbm9kZTpmcycKaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJwppbXBvcnQgeyBl
eGVjRmlsZVN5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnCgpjb25zdCByb290ID0gcHJvY2Vzcy5jd2QoKQpjb25zdCBmYWlsdXJlcyA9IFtdCmNv
bnN0IHdhcm5pbmdzID0gW10KCmZ1bmN0aW9uIHJlYWQoZmlsZSkgewogIHJldHVybiBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJvb3QsIGZpbGUpLCAn
dXRmOCcpCn0KCmZ1bmN0aW9uIHJlcXVpcmVUZXh0KGZpbGUsIHRleHQsIGxhYmVsKSB7CiAgaWYgKCFyZWFkKGZpbGUpLmluY2x1ZGVzKHRleHQpKSBmYWls
dXJlcy5wdXNoKFxgXCR7bGFiZWx9OiBcJHtmaWxlfVxgKQp9CgpmdW5jdGlvbiBmb3JiaWRUZXh0KGZpbGUsIHRleHQsIGxhYmVsKSB7CiAgaWYgKHJlYWQo
ZmlsZSkuaW5jbHVkZXModGV4dCkpIGZhaWx1cmVzLnB1c2goXGBcJHtsYWJlbH06IFwke2ZpbGV9XGApCn0KCnJlcXVpcmVUZXh0KCdsaWIvb3JjYWx5LXNl
Y3VyaXR5LnRzJywgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JywgJ0NTUCBvYnJpZ2F0b3JpYSBhdXNlbnRlJykKZm9yYmlkVGV4dCgnbGliL29yY2FseS1z
ZWN1cml0eS50cycsICdDb250ZW50LVNlY3VyaXR5LVBvbGljeS1SZXBvcnQtT25seScsICdDU1AgYWluZGEgZXN0YSBhcGVuYXMgZW0gcmVwb3J0LW9ubHkn
KQpyZXF1aXJlVGV4dCgKICAnbGliL21lcmNhZG8tcGFnby50cycsCiAgJ2lmICghc2VjcmV0IHx8ICF4U2lnbmF0dXJlIHx8ICF4UmVxdWVzdElkIHx8ICFk
YXRhSWQpIHJldHVybiBmYWxzZScsCiAgJ1dlYmhvb2sgYWluZGEgcGVybWl0ZSBzZWdyZWRvIGF1c2VudGUnLAopCmZvcmJpZFRleHQoJ2xpYi9hZG1pbi1h
dXRoLnRzJywgJ2FyYXVqb3ZpbmljaXVzMjQ5QGdtYWlsLmNvbScsICdTdXBlciBhZG1pbiBmaXhvIG5vIGNvZGlnbycpCmZvcmJpZFRleHQoJ2xpYi9jb21w
YW55LWFjY2Vzcy50cycsICdhcmF1am92aW5pY2l1czI0OUBnbWFpbC5jb20nLCAnU3VwZXIgYWRtaW4gZml4byBubyBhY2Vzc28gZGEgZW1wcmVzYScpCmZv
cmJpZFRleHQoJ2xpYi9jb21wYW55LWFjY2Vzcy50cycsICIuZnJvbSgnYWRtaW5fdXNlcnMnKSIsICdhZG1pbl91c2VycyBhaW5kYSBhdHVhIGNvbW8gYXV0
b3JpZGFkZSBhZG1pbmlzdHJhdGl2YScpCmZvcmJpZFRleHQoJ2xpYi9jb21wYW55LWFjY2Vzcy50cycsICdzaG91bGRBdHRhY2hPd25lcicsICdWaW5jdWxv
IGF1dG9tYXRpY28gcG9yIGUtbWFpbCBhaW5kYSBhdGl2bycpCmZvcmJpZFRleHQoJ3Byb3h5LnRzJywgJ3ZpbmljaXVzYWRtQG9yY2FseS5jb20nLCAnT3du
ZXIgZGEgcGxhdGFmb3JtYSBhaW5kYSBlc3RhIGZpeG8gcG9yIGUtbWFpbCBubyBwcm94eScpCmZvcmJpZFRleHQoJ2FwcC9hcGkvcHVibGljLXNpdGUvW3Ns
dWddL3JvdXRlLnRzJywgIi5zZWxlY3QoJyonKSIsICdBUEkgcHVibGljYSBhaW5kYSBzZWxlY2lvbmEgdG9kb3Mgb3MgY2FtcG9zJykKcmVxdWlyZVRleHQo
J2xpYi9hZmZpbGlhdGVzL3dvcmtzcGFjZS50cycsICdpc1ZhbGlkQ291cnNlTGVzc29uJywgJ0FjYWRlbWlhIHNlbSB2YWxpZGFjYW8gc2VydmVyLXNpZGUn
KQpmb3JiaWRUZXh0KCdsaWIvYWZmaWxpYXRlcy93b3Jrc3BhY2UudHMnLCAndG90YWxTY29yZSA9IGNsZWFuTnVtYmVyKGJvZHkudG90YWxTY29yZScsICdU
cmVpbmFtZW50byBhaW5kYSBjb25maWEgZW0gbm90YSBkbyBjbGllbnRlJykKZm9yYmlkVGV4dCgnbGliL3BhbmVsLXN0b3JhZ2UudHMnLCAnaW1hZ2Uvc3Zn
K3htbCcsICdMb2dvIGFpbmRhIGFjZWl0YSBTVkcgbmFvIHNhbml0aXphZG8nKQpmb3JiaWRUZXh0KCdhcHAvYXBpL3B1YmxpYy9ob21lLWNoYXQvcm91dGUu
dHMnLCAnZmFpbE9wZW46IHRydWUnLCAnQ2hhdCBwYWdvIGFpbmRhIGFicmUgbyByYXRlIGxpbWl0IGVtIGZhbGhhJykKcmVxdWlyZVRleHQoJ2FwcC9hcGkv
YWRtaW4vc2Nhbi9yb3V0ZS50cycsICdDUk9OX1NFQ1JFVCcsICdTY2FubmVyIGNyb24gc2VtIHNlZ3JlZG8nKQpyZXF1aXJlVGV4dCgnYXBwL2FwaS9jb21w
YW55L2N1cnJlbnQvcm91dGUudHMnLCAnZ2V0Q29tcGFueVN1YnNjcmlwdGlvbkFjY2VzcycsICdBY2Vzc28gZGEgZW1wcmVzYSBzZW0gcmVncmEgY2Fub25p
Y2EgZGUgYXNzaW5hdHVyYScpCmZvcmJpZFRleHQoCiAgJ2FwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvd2ViaG9vay9tZXJjYWRvLXBhZ28vcm91dGUu
dHMnLAogICdOb3RpZmljYWNhbyBsZWdhZGEgc2VtIGFzc2luYXR1cmEnLAogICdXZWJob29rIG1hcmtldHBsYWNlIGFpbmRhIGFjZWl0YSBub3RpZmljYWNh
byBzZW0gYXNzaW5hdHVyYScsCikKcmVxdWlyZVRleHQoCiAgJ2FwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvd2ViaG9vay9tZXJjYWRvLXBhZ28vcm91
dGUudHMnLAogICdjbGVhblNlbnNpdGl2ZVBheWxvYWQnLAogICdXZWJob29rIG1hcmtldHBsYWNlIGFpbmRhIHBlcnNpc3RlIHBheWxvYWQgZmluYW5jZWly
byBzZW0gc2FuaXRpemFjYW8nLAopCnJlcXVpcmVUZXh0KAogICdhcHAvYXBpL2xlYWRzL2NvbXBsZXRlLWFjY291bnQvcm91dGUudHMnLAogICd2ZXJpZnlT
aWdudXBDaGVja291dFRva2VuJywKICAnRmluYWxpemFjYW8gZGUgY29udGEgc2VtIHRva2VuIEhNQUMgZG8gY2hlY2tvdXQnLAopCnJlcXVpcmVUZXh0KAog
ICdsaWIvc3Vic2NyaXB0aW9uLWNoZWNrb3V0LXBheW1lbnQudHMnLAogICdDaGF2ZSBkZSBpZGVtcG90w6puY2lhIGRvIHBhZ2FtZW50byBpbnbDoWxpZGEu
JywKICAnQ2hlY2tvdXQgYXZ1bHNvIGRlIGFzc2luYXR1cmEgc2VtIGlkZW1wb3RlbmNpYSBvYnJpZ2F0b3JpYScsCikKcmVxdWlyZVRleHQoCiAgJ2xpYi9z
dWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzJywKICAnQ2hhdmUgZGUgaWRlbXBvdMOqbmNpYSBkYSBhc3NpbmF0dXJhIGludsOhbGlk
YS4nLAogICdBc3NpbmF0dXJhIHJlY29ycmVudGUgc2VtIGlkZW1wb3RlbmNpYSBvYnJpZ2F0b3JpYScsCikKcmVxdWlyZVRleHQoCiAgJ2xpYi9zdWJzY3Jp
cHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzJywKICAnZXhpc3RpbmdQYXltZW50Um93JywKICAnQXNzaW5hdHVyYSByZWNvcnJlbnRlIHNlbSBy
ZXV0aWxpemFjYW8gZGEgbGluaGEgaWRlbXBvdGVudGUnLAopCnJlcXVpcmVUZXh0KAogICdjb21wb25lbnRzL3N1YnNjcmlwdGlvbi9NZXJjYWRvUGFnb1N1
YnNjcmlwdGlvbkNoZWNrb3V0LnRzeCcsCiAgJ3JlY3VycmluZ0lkZW1wb3RlbmN5UmVmLmN1cnJlbnQgPSAiIjsnLAogICdDbGllbnRlIHJlY29ycmVudGUg
bmFvIGxpbXBhIGNoYXZlIGlkZW1wb3RlbnRlIGFwb3Mgc3VjZXNzbycsCikKcmVxdWlyZVRleHQoCiAgJ2xpYi9zdWJzY3JpcHRpb24tc2VydmljZS50cycs
CiAgJ3JlY29uY2lsZVJldmVyc2VkU3Vic2NyaXB0aW9uUGF5bWVudCcsCiAgJ0VzdG9ybm8gZGUgYXNzaW5hdHVyYSBuYW8gcmVjb25jaWxpYSBhY2Vzc28g
Y29uY2VkaWRvJywKKQpyZXF1aXJlVGV4dCgKICAnbGliL3N1YnNjcmlwdGlvbi1zZXJ2aWNlLnRzJywKICAncHJldmlvdXNfYWNjZXNzX3VudGlsJywKICAn
UGFnYW1lbnRvIGFwcm92YWRvIG5hbyByZWdpc3RyYSBhY2Vzc28gYW50ZXJpb3IgcGFyYSByb2xsYmFjayBzZWd1cm8nLAopCnJlcXVpcmVUZXh0KAogICds
aWIvc3Vic2NyaXB0aW9uLXNlcnZpY2UudHMnLAogICdvcmNhbHlfYXBwbHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZScsCiAgJ1BhZ2FtZW50byBhcHJv
dmFkbyBhaW5kYSBwb2RlIHNlciBhcGxpY2FkbyBtYWlzIGRlIHVtYSB2ZXonLAopCnJlcXVpcmVUZXh0KAogICdsaWIvc3Vic2NyaXB0aW9uLWNoZWNrb3V0
LXBheW1lbnQudHMnLAogICdyZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQnLAogICdDaGVja291dCBhdnVsc28gbmFvIHJldmVydGUgYWNl
c3NvIGVtIGVzdG9ybm8nLAopCnJlcXVpcmVUZXh0KAogICdsaWIvYWZmaWxpYXRlcy9zZXJ2ZXIudHMnLAogICdQYWdhbWVudG8gasOhIGVzdMOhIHNlbmRv
IHByb2Nlc3NhZG8gb3UgbsOjbyBmb2kgYXByb3ZhZG8uJywKICAnUGF5b3V0IHNlbSBjbGFpbSBhdG9taWNvIGFudGVzIGRhIHRyYW5zZmVyZW5jaWEnLAop
CnJlcXVpcmVUZXh0KAogICdsaWIvYWZmaWxpYXRlcy9zZXJ2ZXIudHMnLAogICdyZXR1cm4gImJhc2ljbyI7JywKICAnUGxhbm8gZGVzY29uaGVjaWRvIGRl
IGFmaWxpYWRvIGFpbmRhIHBvZGUgY2FpciBlbSBwbGFubyBpbnRlcm1lZGlhcmlvJywKKQpyZXF1aXJlVGV4dCgKICAnbGliL2FmZmlsaWF0ZXMvc2VydmVy
LnRzJywKICAnc2V0dGluZ3MucGF5b3V0c19lbmFibGVkJywKICAnU29saWNpdGFjYW8gZGUgcGF5b3V0IG5hbyByZXNwZWl0YSBmbGFnIGdsb2JhbCBkZSBw
YWdhbWVudG9zJywKKQpyZXF1aXJlVGV4dCgKICAnbGliL2FmZmlsaWF0ZXMvc2VydmVyLnRzJywKICAnUmVzdWx0YWRvIGluY2VydG8gbm8gcHJvdmVkb3Iu
IE7Do28gcmVlbnZpYXIgYXV0b21hdGljYW1lbnRlJywKICAnUGF5b3V0IGFpbmRhIHBvZGUgc2VyIHJlZW52aWFkbyBhcG9zIHJlc3VsdGFkbyBpbmNlcnRv
JywKKQpmb3JiaWRUZXh0KAogICdsaWIvY29tcGFueS1hY2Nlc3MudHMnLAogICIuZXEoJ3NsdWcnLCAnZ3JhZmljYS1mbGFzaCcpIiwKICAnRmFsbGJhY2sg
ZGUgdGVuYW50IGZpeG8gcGFyYSBhZG1pbiBkYSBwbGF0YWZvcm1hIGFpbmRhIGV4aXN0ZScsCikKcmVxdWlyZVRleHQoCiAgJ2FwcC9hcGkvY29tcGFueS9j
dXJyZW50L3JvdXRlLnRzJywKICAnc2FuaXRpemVDb21wYW55Rm9yQ2xpZW50JywKICAnQVBJIGNvbXBhbnkvY3VycmVudCBhaW5kYSBkZXZvbHZlIGxpbmhh
IGFkbWluaXN0cmF0aXZhIHNlbSBzYW5pdGl6YWNhbycsCikKcmVxdWlyZVRleHQoCiAgJ2FwcC9hcGkvY3JtL2xlYWRzL3JvdXRlLnRzJywKICAiY29tcGFu
eVBsYW5BbGxvd3MoY29tcGFueUFjY2Vzcy5jb21wYW55LCAncHJvZmlzc2lvbmFsJykiLAogICdDUk0gc2VtIGdhdGUgZGUgcGxhbm8gc2VydmVyLXNpZGUn
LAopCgpjb25zdCBzb3VyY2VFeHRlbnNpb25zID0gbmV3IFNldChbCiAgJy50cycsICcudHN4JywgJy5qcycsICcubWpzJywgJy5janMnLCAnLnNxbCcsICcu
Y3NzJywgJy5tZCcsICcuanNvbicsCl0pCgpjb25zdCB0cmFja2VkID0gZXhlY0ZpbGVTeW5jKCdnaXQnLCBbJ2xzLWZpbGVzJywgJy16J10sIHsKICBjd2Q6
IHJvb3QsCiAgZW5jb2Rpbmc6ICd1dGY4JywKfSkKICAuc3BsaXQoJ1xcMCcpCiAgLmZpbHRlcihCb29sZWFuKQoKY29uc3QgbW9qaWJha2VNYXJrZXJzID0g
WwogICfDg8KnJywgJ8ODwqMnLCAnw4PCtScsICfDg8KpJywgJ8ODwqonLCAnw4PCoScsICfDg8OtJywgJ8ODwq0nLCAnw4PDsycsICfDg8KzJywKICAnw4PD
uicsICfDg8K6JywgJ8OCwrcnLCAnw4LCuicsICfDgsKqJywgJ8OixZPigJwnLCAnw6LigKDigJknLCAnw6LigqzFkycsICfDouKCrCcsCl0KCmZvciAoY29u
c3QgZmlsZSBvZiB0cmFja2VkKSB7CiAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkKICBpZiAoIXNvdXJjZUV4
dGVuc2lvbnMuaGFzKGV4dGVuc2lvbikpIGNvbnRpbnVlCgogIGxldCBjb250ZW50ID0gJycKICB0cnkgewogICAgY29udGVudCA9IHJlYWQoZmlsZSkKICB9
IGNhdGNoIHsKICAgIGNvbnRpbnVlCiAgfQoKICBjb25zdCBmaXJzdENodW5rID0gY29udGVudC5zbGljZSgwLCAzMDApCiAgY29uc3QgaXNDbGllbnQgPSAv
WyciXXVzZSBjbGllbnRbJyJdLy50ZXN0KGZpcnN0Q2h1bmspCgogIGlmIChpc0NsaWVudCAmJiBjb250ZW50LmluY2x1ZGVzKCdTVVBBQkFTRV9TRVJWSUNF
X1JPTEVfS0VZJykpIHsKICAgIGZhaWx1cmVzLnB1c2goXGBTZXJ2aWNlIHJvbGUgcmVmZXJlbmNpYWRhIGVtIGFycXVpdm8gY2xpZW50OiBcJHtmaWxlfVxg
KQogIH0KCiAgZm9yIChjb25zdCBtYXJrZXIgb2YgbW9qaWJha2VNYXJrZXJzKSB7CiAgICBpZiAoY29udGVudC5pbmNsdWRlcyhtYXJrZXIpKSB7CiAgICAg
IGZhaWx1cmVzLnB1c2goXGBNb2ppYmFrZSAiXCR7bWFya2VyfSIgZW5jb250cmFkbzogXCR7ZmlsZX1cYCkKICAgICAgYnJlYWsKICAgIH0KICB9CgogIGlm
ICgvXFxiZXZhbFxccypcXCgvLnRlc3QoY29udGVudCkgfHwgL25ld1xccytGdW5jdGlvblxccypcXCgvLnRlc3QoY29udGVudCkpIHsKICAgIGZhaWx1cmVz
LnB1c2goXGBFeGVjdWNhbyBkaW5hbWljYSBwZXJpZ29zYSBlbmNvbnRyYWRhOiBcJHtmaWxlfVxgKQogIH0KCiAgaWYgKAogICAgL0FQUF9VU1ItW0EtWmEt
ejAtOV8tXXsyMCx9Ly50ZXN0KGNvbnRlbnQpIHx8CiAgICAvc2tfKD86bGl2ZXx0ZXN0KV9bQS1aYS16MC05XXsyMCx9Ly50ZXN0KGNvbnRlbnQpCiAgKSB7
CiAgICBmYWlsdXJlcy5wdXNoKFxgU2VncmVkbyBjb20gZm9ybWF0byBjb25oZWNpZG8gZW5jb250cmFkbyBubyBjb2RpZ286IFwke2ZpbGV9XGApCiAgfQoK
ICBpZiAoZmlsZS5zdGFydHNXaXRoKCdhcHAvYXBpLycpICYmIC9yZXF1ZXN0XFwuanNvblxccypcXCgvLnRlc3QoY29udGVudCkgJiYgIWNvbnRlbnQuaW5j
bHVkZXMoJ3JlYWRKc29uQm9keScpKSB7CiAgICB3YXJuaW5ncy5wdXNoKFxgUm90YSB1c2EgcmVxdWVzdC5qc29uKCkgc2VtIGhlbHBlciBkZSBieXRlLWxp
bWl0OiBcJHtmaWxlfVxgKQogIH0KCiAgaWYgKAogICAgZmlsZS5zdGFydHNXaXRoKCdhcHAvYXBpLycpICYmCiAgICAvcmVxdWVzdFxcLnRleHRcXHMqXFwo
Ly50ZXN0KGNvbnRlbnQpICYmCiAgICAhY29udGVudC5pbmNsdWRlcygncmVhZFRleHRCb2R5JykgJiYKICAgICFjb250ZW50LmluY2x1ZGVzKCdCdWZmZXIu
Ynl0ZUxlbmd0aCcpCiAgKSB7CiAgICB3YXJuaW5ncy5wdXNoKFxgUm90YSB1c2EgcmVxdWVzdC50ZXh0KCkgc2VtIGJ5dGUtbGltaXQgY29tcGFydGlsaGFk
bzogXCR7ZmlsZX1cYCkKICB9CgogIGlmICgvZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUwvLnRlc3QoY29udGVudCkpIHsKICAgIHdhcm5pbmdzLnB1c2goXGBS
ZXZpc2FyIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MOiBcJHtmaWxlfVxgKQogIH0KCiAgaWYgKC9cXC5vclxccypcXChcXHMqXGAvLnRlc3QoY29udGVudCkg
JiYgY29udGVudC5pbmNsdWRlcygnXCR7JykpIHsKICAgIHdhcm5pbmdzLnB1c2goXGBSZXZpc2FyIGZpbHRybyBQb3N0Z1JFU1QgLm9yKCkgaW50ZXJwb2xh
ZG86IFwke2ZpbGV9XGApCiAgfQp9Cgpjb25zdCBtaWdyYXRpb25EaXIgPSBwYXRoLmpvaW4ocm9vdCwgJ3N1cGFiYXNlJywgJ21pZ3JhdGlvbnMnKQpjb25z
dCBwYXJ0bmVyQXV0aG9yaXR5TWlncmF0aW9uID0gZnMuZXhpc3RzU3luYyhtaWdyYXRpb25EaXIpCiAgPyBmcy5yZWFkZGlyU3luYyhtaWdyYXRpb25EaXIp
LmZpbmQoKG5hbWUpID0+CiAgICAgIG5hbWUuZW5kc1dpdGgoJ19hZmZpbGlhdGVfd29ya3NwYWNlX3NlcnZlcl9hdXRob3JpdHkuc3FsJyksCiAgICApCiAg
OiBudWxsCgppZiAoIXBhcnRuZXJBdXRob3JpdHlNaWdyYXRpb24pIHsKICBmYWlsdXJlcy5wdXNoKCdNaWdyYXRpb24gYWZmaWxpYXRlX3dvcmtzcGFjZV9z
ZXJ2ZXJfYXV0aG9yaXR5IGF1c2VudGUnKQp9IGVsc2UgewogIGNvbnN0IG1pZ3JhdGlvbiA9IHJlYWQocGF0aC5qb2luKCdzdXBhYmFzZScsICdtaWdyYXRp
b25zJywgcGFydG5lckF1dGhvcml0eU1pZ3JhdGlvbikpCiAgaWYgKCFtaWdyYXRpb24uaW5jbHVkZXMoJ3Jldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVsZXRl
JykpIHsKICAgIGZhaWx1cmVzLnB1c2goJ01pZ3JhdGlvbiBkZSBwYXJjZWlyb3MgbmFvIHJldm9nYSBlc2NyaXRhIGRpcmV0YScpCiAgfQogIGlmICghbWln
cmF0aW9uLmluY2x1ZGVzKCdhZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzX3NvdXJjZV9rZXlfdXEnKSkgewogICAgZmFpbHVyZXMucHVzaCgnSW5kaWNlIGRl
IGlkZW1wb3RlbmNpYSBkZSBYUCBhdXNlbnRlJykKICB9CiAgaWYgKCFtaWdyYXRpb24uaW5jbHVkZXMoJ3BsYW5fcGF5bWVudHNfY29tcGFueV9pZGVtcG90
ZW5jeV91cScpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdJbmRpY2UgZGUgaWRlbXBvdGVuY2lhIGRlIGNvYnJhbmNhIGRlIGFzc2luYXR1cmEgYXVzZW50ZScp
CiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdvcmNhbHlfYXBwbHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZScpKSB7CiAgICBmYWlsdXJlcy5w
dXNoKCdMZWRnZXIgaWRlbXBvdGVudGUgZGUgYXBsaWNhY2FvIGRlIGFzc2luYXR1cmEgYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVz
KCdvcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3MnKSkgewogICAgZmFpbHVyZXMucHVzaCgnRnVuY2FvIGNhbm9uaWNhIGRlIHBsYW5vL2Fzc2luYXR1
cmEgbm8gYmFuY28gYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdvcmNhbHlfY3VycmVudF91c2VyX2NhbicpKSB7CiAgICBmYWls
dXJlcy5wdXNoKCdGdW5jYW8gY2Fub25pY2EgZGUgY2FwYWNpZGFkZSBwb3IgY2FyZ28gbm8gYmFuY28gYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9u
LmluY2x1ZGVzKCdhcyByZXN0cmljdGl2ZScpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdQb2xpY2llcyByZXN0cml0aXZhcyBkZSBwbGFuby9jYXJnbyBhdXNl
bnRlcycpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCInY3JtX2xlYWRzJyIpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdDUk0gYWluZGEgbmFvIGZv
aSB0b3JuYWRvIHNlcnZlci1hdXRob3JpdGF0aXZlJykKICB9CiAgaWYgKCFtaWdyYXRpb24uaW5jbHVkZXMoIigncHJvZHVjdHMnLCAnZXNzZW5jaWFsJywg
J3Byb2R1Y3RzJykiKSkgewogICAgZmFpbHVyZXMucHVzaCgnUHJvZHVjdHMgYWluZGEgbmFvIGVzdGEgcHJvdGVnaWRvIHBvciBwbGFuby9jYXJnbyBubyBi
YW5jbycpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCIoJ29yZGVycycsICdlc3NlbmNpYWwnLCAnb3JkZXJzJykiKSkgewogICAgZmFpbHVyZXMu
cHVzaCgnT3JkZXJzIGFpbmRhIG5hbyBlc3RhIHByb3RlZ2lkbyBwb3IgcGxhbm8vY2FyZ28gbm8gYmFuY28nKQogIH0KICBpZiAoIW1pZ3JhdGlvbi5pbmNs
dWRlcygnb3JjYWx5X29yZGVyX2l0ZW1zX2NhcGFiaWxpdHknKSkgewogICAgZmFpbHVyZXMucHVzaCgnT3JkZXIgaXRlbXMgYWluZGEgbmFvIGhlcmRhIGF1
dG9yaXphY2FvIGRvIHBlZGlkbycpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdvcmNhbHlfY29tcGFueV91cGRhdGVfY2FwYWJpbGl0eScpKSB7
CiAgICBmYWlsdXJlcy5wdXNoKCdBdHVhbGl6YWNhbyBkaXJldGEgZGUgY29tcGFuaWVzIHNlbSBnYXRlIGRlIGNvbmZpZ3VyYWNhbycpCiAgfQp9Cgpjb25z
b2xlLmxvZyhcYFNFQ1VSSVRZX1NDQU5fVFJBQ0tFRF9GSUxFUz1cJHt0cmFja2VkLmxlbmd0aH1cYCkKY29uc29sZS5sb2coXGBTRUNVUklUWV9TQ0FOX1dB
Uk5JTkdTPVwke3dhcm5pbmdzLmxlbmd0aH1cYCkKZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSBjb25zb2xlLndhcm4oXGBbV0FSTl0gXCR7d2Fy
bmluZ31cYCkKCmlmIChmYWlsdXJlcy5sZW5ndGgpIHsKICBjb25zb2xlLmVycm9yKCdcXG5GQUxIQVMgREUgU0VHVVJBTkNBIEVOQ09OVFJBREFTOicpCiAg
Zm9yIChjb25zdCBmYWlsdXJlIG9mIGZhaWx1cmVzKSBjb25zb2xlLmVycm9yKFxgLSBcJHtmYWlsdXJlfVxgKQogIHByb2Nlc3MuZXhpdCgxKQp9Cgpjb25z
b2xlLmxvZygnU0VDVVJJVFlfQ0hFQ0tfRVhJVF9DT0RFPTAnKQpgKTsKCi8vIFNRTCBzZXLDoSBjb3BpYWRvIHBhcmEgbWlncmF0aW9uIGNyaWFkYSBwZWxv
IFN1cGFiYXNlIENMSSBubyBQb3dlclNoZWxsLgpjcmVhdGVPclJlcGxhY2UoIi5vcmNhbHktaGFyZGVuaW5nLWxvY2FsL2FmZmlsaWF0ZV93b3Jrc3BhY2Vf
c2VydmVyX2F1dGhvcml0eS5zcWwiLCBgLS0gT1JDQUxZX0FGRklMSUFURV9XT1JLU1BBQ0VfU0VSVkVSX0FVVEhPUklUWV9WMQpiZWdpbjsKCi0tIE8gcGFy
Y2Vpcm8gY29uc3VsdGEgb3MgcHLDs3ByaW9zIGRhZG9zLCBtYXMgbXV0YcOnw7VlcyBwYXNzYW0gcGVsbyBiYWNrZW5kLgpyZXZva2UgaW5zZXJ0LCB1cGRh
dGUsIGRlbGV0ZSBvbiBwdWJsaWMuYWZmaWxpYXRlX2xlYWRzIGZyb20gYXV0aGVudGljYXRlZDsKcmV2b2tlIGluc2VydCwgdXBkYXRlLCBkZWxldGUgb24g
cHVibGljLmFmZmlsaWF0ZV90YXNrcyBmcm9tIGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVsZXRlIG9uIHB1YmxpYy5hZmZpbGlh
dGVfZ29hbHMgZnJvbSBhdXRoZW50aWNhdGVkOwpyZXZva2UgaW5zZXJ0LCB1cGRhdGUsIGRlbGV0ZSBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjdGl2aXR5X2V2
ZW50cyBmcm9tIGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVsZXRlIG9uIHB1YmxpYy5hZmZpbGlhdGVfY291cnNlX3Byb2dyZXNz
IGZyb20gYXV0aGVudGljYXRlZDsKcmV2b2tlIGluc2VydCwgdXBkYXRlLCBkZWxldGUgb24gcHVibGljLmFmZmlsaWF0ZV9jZXJ0aWZpY2F0aW9ucyBmcm9t
IGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVsZXRlIG9uIHB1YmxpYy5hZmZpbGlhdGVfdHJhaW5pbmdfc2Vzc2lvbnMgZnJvbSBh
dXRoZW50aWNhdGVkOwpyZXZva2UgaW5zZXJ0LCB1cGRhdGUsIGRlbGV0ZSBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50cyBmcm9tIGF1dGhlbnRp
Y2F0ZWQ7Cgpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2xlYWRzX2luc2VydF9vd24gb24gcHVibGljLmFmZmlsaWF0ZV9sZWFkczsKZHJvcCBw
b2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9sZWFkc191cGRhdGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfbGVhZHM7CmRyb3AgcG9saWN5IGlmIGV4aXN0
cyBhZmZpbGlhdGVfbGVhZHNfZGVsZXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2xlYWRzOwoKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV90
YXNrc19pbnNlcnRfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfdGFza3M7CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfdGFza3NfdXBkYXRlX293
biBvbiBwdWJsaWMuYWZmaWxpYXRlX3Rhc2tzOwpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX3Rhc2tzX2RlbGV0ZV9vd24gb24gcHVibGljLmFm
ZmlsaWF0ZV90YXNrczsKCmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfZ29hbHNfaW5zZXJ0X293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2dvYWxz
Owpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2dvYWxzX3VwZGF0ZV9vd24gb24gcHVibGljLmFmZmlsaWF0ZV9nb2FsczsKZHJvcCBwb2xpY3kg
aWYgZXhpc3RzIGFmZmlsaWF0ZV9nb2Fsc19kZWxldGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfZ29hbHM7Cgpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZm
aWxpYXRlX2V2ZW50c19pbnNlcnRfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzOwpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxp
YXRlX2V2ZW50c191cGRhdGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzOwpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRl
X2V2ZW50c19kZWxldGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzOwoKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9j
b3Vyc2VfaW5zZXJ0X293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2NvdXJzZV9wcm9ncmVzczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9jb3Vy
c2VfdXBkYXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2NvdXJzZV9wcm9ncmVzczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9jb3Vyc2Vf
ZGVsZXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2NvdXJzZV9wcm9ncmVzczsKCmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfY2VydF9pbnNl
cnRfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfY2VydGlmaWNhdGlvbnM7CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfY2VydF91cGRhdGVfb3du
IG9uIHB1YmxpYy5hZmZpbGlhdGVfY2VydGlmaWNhdGlvbnM7CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfY2VydF9kZWxldGVfb3duIG9uIHB1
YmxpYy5hZmZpbGlhdGVfY2VydGlmaWNhdGlvbnM7Cgpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX3RyYWluaW5nX2luc2VydF9vd24gb24gcHVi
bGljLmFmZmlsaWF0ZV90cmFpbmluZ19zZXNzaW9uczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV90cmFpbmluZ191cGRhdGVfb3duIG9uIHB1
YmxpYy5hZmZpbGlhdGVfdHJhaW5pbmdfc2Vzc2lvbnM7CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfdHJhaW5pbmdfZGVsZXRlX293biBvbiBw
dWJsaWMuYWZmaWxpYXRlX3RyYWluaW5nX3Nlc3Npb25zOwoKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9hY2hpZXZlbWVudHNfaW5zZXJ0X293
biBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50czsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9hY2hpZXZlbWVudHNfdXBkYXRlX293
biBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50czsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9hY2hpZXZlbWVudHNfZGVsZXRlX293
biBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50czsKCi0tIEV2aXRhIFhQIGR1cGxpY2FkbyBtZXNtbyBzb2IgZHVhcyByZXF1aXNpw6fDtWVzIGNv
bmNvcnJlbnRlcy4KY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhpc3RzIGFmZmlsaWF0ZV9hY3Rpdml0eV9ldmVudHNfc291cmNlX2tleV91cQogIG9u
IHB1YmxpYy5hZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzICgKICAgIGFmZmlsaWF0ZV9pZCwKICAgIChtZXRhZGF0YS0+Pidzb3VyY2Vfa2V5JykKICApCiAg
d2hlcmUgbWV0YWRhdGEgPyAnc291cmNlX2tleSc7CgotLSBBIG1lc21hIHRlbnRhdGl2YSBkZSBjb2JyYW7Dp2EgYXZ1bHNhIG51bmNhIGNyaWEgZHVhcyBs
aW5oYXMvY2hhcmdlcy4KY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhpc3RzIHBsYW5fcGF5bWVudHNfY29tcGFueV9pZGVtcG90ZW5jeV91cQogIG9u
IHB1YmxpYy5wbGFuX3BheW1lbnRzIChjb21wYW55X2lkLCBpZGVtcG90ZW5jeV9rZXkpCiAgd2hlcmUgaWRlbXBvdGVuY3lfa2V5IGlzIG5vdCBudWxsOwoK
LS0gTGVkZ2VyIHByaXZhZG8gZ2FyYW50ZSBxdWUgbyBtZXNtbyBwYWdhbWVudG8gYXByb3ZhZG8gc8OzIGVzdGVuZGEgYWNlc3NvIHVtYSB2ZXouCmNyZWF0
ZSBzY2hlbWEgaWYgbm90IGV4aXN0cyBvcmNhbHlfcHJpdmF0ZTsKcmV2b2tlIGFsbCBvbiBzY2hlbWEgb3JjYWx5X3ByaXZhdGUgZnJvbSBwdWJsaWMsIGFu
b24sIGF1dGhlbnRpY2F0ZWQ7CgpjcmVhdGUgdGFibGUgaWYgbm90IGV4aXN0cyBvcmNhbHlfcHJpdmF0ZS5zdWJzY3JpcHRpb25fcGF5bWVudF9hcHBsaWNh
dGlvbnMgKAogIGNvbXBhbnlfaWQgdXVpZCBub3QgbnVsbCByZWZlcmVuY2VzIHB1YmxpYy5jb21wYW5pZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLAogIHBy
b3ZpZGVyX3JlZmVyZW5jZSB0ZXh0IG5vdCBudWxsLAogIGFwcGxpZWRfYXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBjbG9ja190aW1lc3RhbXAo
KSwKICBwcmltYXJ5IGtleSAoY29tcGFueV9pZCwgcHJvdmlkZXJfcmVmZXJlbmNlKQopOwoKcmV2b2tlIGFsbCBvbiBvcmNhbHlfcHJpdmF0ZS5zdWJzY3Jp
cHRpb25fcGF5bWVudF9hcHBsaWNhdGlvbnMKICBmcm9tIHB1YmxpYywgYW5vbiwgYXV0aGVudGljYXRlZDsKCmNyZWF0ZSBvciByZXBsYWNlIGZ1bmN0aW9u
IHB1YmxpYy5vcmNhbHlfYXBwbHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZSgKICBwX2NvbXBhbnlfaWQgdXVpZCwKICBwX3Byb3ZpZGVyX3JlZmVyZW5j
ZSB0ZXh0LAogIHBfcGxhbiB0ZXh0LAogIHBfcGF5bWVudF90eXBlIHRleHQsCiAgcF9hbW91bnQgbnVtZXJpYywKICBwX3ByZXZpb3VzX3N0YXR1cyB0ZXh0
LAogIHBfcHJldmlvdXNfYWNjZXNzX3VudGlsIHRpbWVzdGFtcHR6LAogIHBfbmV3X2FjY2Vzc191bnRpbCB0aW1lc3RhbXB0eiwKICBwX3ByZWFwcHJvdmFs
X2lkIHRleHQsCiAgcF9uZXh0X3BheW1lbnRfZGF0ZSB0aW1lc3RhbXB0egopCnJldHVybnMgYm9vbGVhbgpsYW5ndWFnZSBwbHBnc3FsCnNlY3VyaXR5IGRl
ZmluZXIKc2V0IHNlYXJjaF9wYXRoID0gJycKYXMgJCQKZGVjbGFyZQogIHZfaW5zZXJ0ZWQgaW50ZWdlciA6PSAwOwogIHZfbm93IHRpbWVzdGFtcHR6IDo9
IGNsb2NrX3RpbWVzdGFtcCgpOwogIHZfcHJldmlvdXNfc3RhdHVzIHRleHQ7CiAgdl9wcmV2aW91c19hY2Nlc3NfdW50aWwgdGltZXN0YW1wdHo7CiAgdl9u
ZXdfYWNjZXNzX3VudGlsIHRpbWVzdGFtcHR6OwpiZWdpbgogIGlmIHBfY29tcGFueV9pZCBpcyBudWxsIG9yIGNvYWxlc2NlKGxlbmd0aCh0cmltKHBfcHJv
dmlkZXJfcmVmZXJlbmNlKSksIDApIDwgMSB0aGVuCiAgICByYWlzZSBleGNlcHRpb24gJ2ludmFsaWQgc3Vic2NyaXB0aW9uIHBheW1lbnQgYXBwbGljYXRp
b24nOwogIGVuZCBpZjsKCiAgc2VsZWN0CiAgICBjLmFzc2luYXR1cmFfc3RhdHVzLAogICAgZ3JlYXRlc3QoCiAgICAgIGNvYWxlc2NlKGMuYWNjZXNzX3Vu
dGlsLCAnLWluZmluaXR5Jzo6dGltZXN0YW1wdHopLAogICAgICBjb2FsZXNjZShjLmFzc2luYXR1cmFfZXhwaXJhX2VtLCAnLWluZmluaXR5Jzo6dGltZXN0
YW1wdHopCiAgICApCiAgaW50byB2X3ByZXZpb3VzX3N0YXR1cywgdl9wcmV2aW91c19hY2Nlc3NfdW50aWwKICBmcm9tIHB1YmxpYy5jb21wYW5pZXMgYwog
IHdoZXJlIGMuaWQgPSBwX2NvbXBhbnlfaWQKICBmb3IgdXBkYXRlOwoKICBpZiBub3QgZm91bmQgdGhlbgogICAgcmFpc2UgZXhjZXB0aW9uICdjb21wYW55
IG5vdCBmb3VuZCc7CiAgZW5kIGlmOwoKICBpZiB2X3ByZXZpb3VzX2FjY2Vzc191bnRpbCA9ICctaW5maW5pdHknOjp0aW1lc3RhbXB0eiB0aGVuCiAgICB2
X3ByZXZpb3VzX2FjY2Vzc191bnRpbCA6PSBudWxsOwogIGVuZCBpZjsKCiAgdl9uZXdfYWNjZXNzX3VudGlsIDo9IGNhc2UKICAgIHdoZW4gcF9uZXh0X3Bh
eW1lbnRfZGF0ZSBpcyBub3QgbnVsbCBhbmQgcF9uZXh0X3BheW1lbnRfZGF0ZSA+IHZfbm93CiAgICAgIHRoZW4gcF9uZXh0X3BheW1lbnRfZGF0ZQogICAg
ZWxzZSBncmVhdGVzdChjb2FsZXNjZSh2X3ByZXZpb3VzX2FjY2Vzc191bnRpbCwgdl9ub3cpLCB2X25vdykgKyBpbnRlcnZhbCAnMSBtb250aCcKICBlbmQ7
CgogIGluc2VydCBpbnRvIG9yY2FseV9wcml2YXRlLnN1YnNjcmlwdGlvbl9wYXltZW50X2FwcGxpY2F0aW9ucyAoCiAgICBjb21wYW55X2lkLAogICAgcHJv
dmlkZXJfcmVmZXJlbmNlLAogICAgYXBwbGllZF9hdAogICkKICB2YWx1ZXMgKAogICAgcF9jb21wYW55X2lkLAogICAgdHJpbShwX3Byb3ZpZGVyX3JlZmVy
ZW5jZSksCiAgICB2X25vdwogICkKICBvbiBjb25mbGljdCAoY29tcGFueV9pZCwgcHJvdmlkZXJfcmVmZXJlbmNlKSBkbyBub3RoaW5nOwoKICBnZXQgZGlh
Z25vc3RpY3Mgdl9pbnNlcnRlZCA9IHJvd19jb3VudDsKICBpZiB2X2luc2VydGVkID0gMCB0aGVuCiAgICByZXR1cm4gZmFsc2U7CiAgZW5kIGlmOwoKICB1
cGRhdGUgcHVibGljLmNvbXBhbmllcwogIHNldAogICAgYXRpdm8gPSB0cnVlLAogICAgcGxhbm8gPSBwX3BsYW4sCiAgICBhc3NpbmF0dXJhX3BsYW5vID0g
cF9wbGFuLAogICAgYXNzaW5hdHVyYV9zdGF0dXMgPSAnYXRpdmEnLAogICAgYXNzaW5hdHVyYV9pbmljaW8gPSBjb2FsZXNjZShhc3NpbmF0dXJhX2luaWNp
bywgdl9ub3cpLAogICAgYXNzaW5hdHVyYV9leHBpcmFfZW0gPSB2X25ld19hY2Nlc3NfdW50aWwsCiAgICBhY2Nlc3NfdW50aWwgPSB2X25ld19hY2Nlc3Nf
dW50aWwsCiAgICBhc3NpbmF0dXJhX3VsdGltb19wYWdhbWVudG8gPSB2X25vdywKICAgIGFzc2luYXR1cmFfcHJveGltYV9jb2JyYW5jYSA9IHBfbmV4dF9w
YXltZW50X2RhdGUsCiAgICBhc3NpbmF0dXJhX2F1dG9fcmVjb3JyZW50ZSA9IChwX3BheW1lbnRfdHlwZSA9ICdjYXJkX3JlY3VycmluZycpLAogICAgYXNz
aW5hdHVyYV9mb3JtYV9wYWdhbWVudG9fcHJlZmVyaWRhID0gY2FzZQogICAgICB3aGVuIHBfcGF5bWVudF90eXBlID0gJ2NhcmRfcmVjdXJyaW5nJyB0aGVu
ICdjYXJ0YW9fcmVjb3JyZW50ZScKICAgICAgd2hlbiBwX3BheW1lbnRfdHlwZSA9ICdjYXJkJyB0aGVuICdjYXJ0YW9fYXZ1bHNvJwogICAgICBlbHNlICdw
aXhfYXZ1bHNvJwogICAgZW5kLAogICAgYXNzaW5hdHVyYV9waXhfYXZ1bHNvX3N0YXR1cyA9IGNhc2UKICAgICAgd2hlbiBwX3BheW1lbnRfdHlwZSA9ICdw
aXgnIHRoZW4gJ3BhaWQnCiAgICAgIGVsc2UgYXNzaW5hdHVyYV9waXhfYXZ1bHNvX3N0YXR1cwogICAgZW5kLAogICAgYXNzaW5hdHVyYV9waXhfYXZ1bHNv
X3VsdGltb19wYWdhbWVudG8gPSBjYXNlCiAgICAgIHdoZW4gcF9wYXltZW50X3R5cGUgPSAncGl4JyB0aGVuIHZfbm93CiAgICAgIGVsc2UgYXNzaW5hdHVy
YV9waXhfYXZ1bHNvX3VsdGltb19wYWdhbWVudG8KICAgIGVuZCwKICAgIG1lcmNhZG9fcGFnb19zdWJzY3JpcHRpb25faWQgPSBjb2FsZXNjZSgKICAgICAg
bnVsbGlmKHBfcHJlYXBwcm92YWxfaWQsICcnKSwKICAgICAgbWVyY2Fkb19wYWdvX3N1YnNjcmlwdGlvbl9pZAogICAgKSwKICAgIG1lcmNhZG9fcGFnb19z
dWJzY3JpcHRpb25fc3RhdHVzID0gY2FzZQogICAgICB3aGVuIHBfcGF5bWVudF90eXBlID0gJ2NhcmRfcmVjdXJyaW5nJyB0aGVuICdhdXRob3JpemVkJwog
ICAgICBlbHNlIG1lcmNhZG9fcGFnb19zdWJzY3JpcHRpb25fc3RhdHVzCiAgICBlbmQsCiAgICBjYW5jZWxfYXRfcGVyaW9kX2VuZCA9IGZhbHNlLAogICAg
dXBkYXRlZF9hdCA9IHZfbm93CiAgd2hlcmUgaWQgPSBwX2NvbXBhbnlfaWQ7CgogIGlmIG5vdCBmb3VuZCB0aGVuCiAgICByYWlzZSBleGNlcHRpb24gJ2Nv
bXBhbnkgbm90IGZvdW5kJzsKICBlbmQgaWY7CgogIGluc2VydCBpbnRvIHB1YmxpYy5zdWJzY3JpcHRpb25fZXZlbnRzICgKICAgIGNvbXBhbnlfaWQsCiAg
ICBldmVudF90eXBlLAogICAgb2xkX3N0YXR1cywKICAgIG5ld19zdGF0dXMsCiAgICBwcm92aWRlciwKICAgIHByb3ZpZGVyX3JlZmVyZW5jZSwKICAgIG1l
dGFkYXRhCiAgKQogIHZhbHVlcyAoCiAgICBwX2NvbXBhbnlfaWQsCiAgICAncGF5bWVudF9hcHByb3ZlZCcsCiAgICB2X3ByZXZpb3VzX3N0YXR1cywKICAg
ICdhdGl2YScsCiAgICAnbWVyY2Fkb19wYWdvJywKICAgIHRyaW0ocF9wcm92aWRlcl9yZWZlcmVuY2UpLAogICAganNvbmJfYnVpbGRfb2JqZWN0KAogICAg
ICAncGxhbicsIHBfcGxhbiwKICAgICAgJ3BheW1lbnRfdHlwZScsIHBfcGF5bWVudF90eXBlLAogICAgICAnYW1vdW50JywgcF9hbW91bnQsCiAgICAgICdw
cmV2aW91c19hY2Nlc3NfdW50aWwnLCB2X3ByZXZpb3VzX2FjY2Vzc191bnRpbCwKICAgICAgJ2FjY2Vzc191bnRpbCcsIHZfbmV3X2FjY2Vzc191bnRpbAog
ICAgKQogICkKICBvbiBjb25mbGljdCAoY29tcGFueV9pZCwgZXZlbnRfdHlwZSwgcHJvdmlkZXJfcmVmZXJlbmNlKSBkbyBub3RoaW5nOwoKICByZXR1cm4g
dHJ1ZTsKZXhjZXB0aW9uCiAgd2hlbiBvdGhlcnMgdGhlbgogICAgZGVsZXRlIGZyb20gb3JjYWx5X3ByaXZhdGUuc3Vic2NyaXB0aW9uX3BheW1lbnRfYXBw
bGljYXRpb25zCiAgICB3aGVyZSBjb21wYW55X2lkID0gcF9jb21wYW55X2lkCiAgICAgIGFuZCBwcm92aWRlcl9yZWZlcmVuY2UgPSB0cmltKHBfcHJvdmlk
ZXJfcmVmZXJlbmNlKTsKICAgIHJhaXNlOwplbmQ7CiQkOwoKcmV2b2tlIGFsbCBvbiBmdW5jdGlvbiBwdWJsaWMub3JjYWx5X2FwcGx5X3N1YnNjcmlwdGlv
bl9wYXltZW50X29uY2UoCiAgdXVpZCwgdGV4dCwgdGV4dCwgdGV4dCwgbnVtZXJpYywgdGV4dCwgdGltZXN0YW1wdHosIHRpbWVzdGFtcHR6LCB0ZXh0LCB0
aW1lc3RhbXB0egopIGZyb20gcHVibGljLCBhbm9uLCBhdXRoZW50aWNhdGVkOwpncmFudCBleGVjdXRlIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfYXBw
bHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZSgKICB1dWlkLCB0ZXh0LCB0ZXh0LCB0ZXh0LCBudW1lcmljLCB0ZXh0LCB0aW1lc3RhbXB0eiwgdGltZXN0
YW1wdHosIHRleHQsIHRpbWVzdGFtcHR6CikgdG8gc2VydmljZV9yb2xlOwoKLS0gUmVncmEgw7puaWNhIGRlIGFjZXNzbyBjb21lcmNpYWw6IGFzc2luYXR1
cmEgdsOhbGlkYSArIG7DrXZlbCBkZSBwbGFuby4KY3JlYXRlIG9yIHJlcGxhY2UgZnVuY3Rpb24gcHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2Fj
Y2VzcygKICBwX2NvbXBhbnlfaWQgdXVpZCwKICBwX3JlcXVpcmVkX3BsYW4gdGV4dAopCnJldHVybnMgYm9vbGVhbgpsYW5ndWFnZSBzcWwKc3RhYmxlCnNl
Y3VyaXR5IGRlZmluZXIKc2V0IHNlYXJjaF9wYXRoID0gJycKYXMgJCQKICBzZWxlY3QgZXhpc3RzICgKICAgIHNlbGVjdCAxCiAgICBmcm9tIHB1YmxpYy5j
b21wYW5pZXMgYwogICAgd2hlcmUgYy5pZCA9IHBfY29tcGFueV9pZAogICAgICBhbmQgY29hbGVzY2UoYy5hdGl2bywgdHJ1ZSkgPSB0cnVlCiAgICAgIGFu
ZCBncmVhdGVzdCgKICAgICAgICBjb2FsZXNjZShjLmFjY2Vzc191bnRpbCwgJy1pbmZpbml0eSc6OnRpbWVzdGFtcHR6KSwKICAgICAgICBjb2FsZXNjZShj
LmFzc2luYXR1cmFfZXhwaXJhX2VtLCAnLWluZmluaXR5Jzo6dGltZXN0YW1wdHopLAogICAgICAgIGNhc2UKICAgICAgICAgIHdoZW4gbG93ZXIoY29hbGVz
Y2UoYy5hc3NpbmF0dXJhX3N0YXR1cywgJycpKSA9ICd0cmlhbGluZycKICAgICAgICAgICAgdGhlbiBjb2FsZXNjZShjLnRyaWFsX2VuZHNfYXQsICctaW5m
aW5pdHknOjp0aW1lc3RhbXB0eikKICAgICAgICAgIGVsc2UgJy1pbmZpbml0eSc6OnRpbWVzdGFtcHR6CiAgICAgICAgZW5kCiAgICAgICkgPiBub3coKQog
ICAgICBhbmQgKAogICAgICAgIGNhc2UgbG93ZXIoY29hbGVzY2UoYy5hc3NpbmF0dXJhX3BsYW5vLCBjLnBsYW5vLCAnZXNzZW5jaWFsJykpCiAgICAgICAg
ICB3aGVuICdwcmVtaXVtJyB0aGVuIDMKICAgICAgICAgIHdoZW4gJ3Byb2Zpc3Npb25hbCcgdGhlbiAyCiAgICAgICAgICB3aGVuICdpbnRlcm1lZGlhcmlv
JyB0aGVuIDIKICAgICAgICAgIHdoZW4gJ2ludGVybWVkacOhcmlvJyB0aGVuIDIKICAgICAgICAgIGVsc2UgMQogICAgICAgIGVuZAogICAgICApID49ICgK
ICAgICAgICBjYXNlIGxvd2VyKGNvYWxlc2NlKHBfcmVxdWlyZWRfcGxhbiwgJ2Vzc2VuY2lhbCcpKQogICAgICAgICAgd2hlbiAncHJlbWl1bScgdGhlbiAz
CiAgICAgICAgICB3aGVuICdwcm9maXNzaW9uYWwnIHRoZW4gMgogICAgICAgICAgd2hlbiAnaW50ZXJtZWRpYXRlJyB0aGVuIDIKICAgICAgICAgIHdoZW4g
J2ludGVybWVkaWFyaW8nIHRoZW4gMgogICAgICAgICAgd2hlbiAnaW50ZXJtZWRpw6FyaW8nIHRoZW4gMgogICAgICAgICAgZWxzZSAxCiAgICAgICAgZW5k
CiAgICAgICkKICApOwokJDsKCnJldm9rZSBhbGwgb24gZnVuY3Rpb24gcHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2FjY2Vzcyh1dWlkLCB0ZXh0
KQogIGZyb20gcHVibGljLCBhbm9uOwpncmFudCBleGVjdXRlIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3ModXVp
ZCwgdGV4dCkKICB0byBhdXRoZW50aWNhdGVkLCBzZXJ2aWNlX3JvbGU7CgotLSBDYXBhY2lkYWRlIHBvciBjYXJnby4gQSBwb2xpY3kgZGUgcG9zc2UgZGEg
ZW1wcmVzYSBjb250aW51YSBzZW5kbyBuZWNlc3PDoXJpYTsKLS0gZXN0YSBmdW7Dp8OjbyBhZGljaW9uYSBvIGxpbWl0ZSBmdW5jaW9uYWwgKGZpbmFuY2Vp
cm8sIENSTSwgcHJvcG9zdGEsIGdlc3TDo28pLgpjcmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbiBwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oCiAg
cF9jb21wYW55X2lkIHV1aWQsCiAgcF9jYXBhYmlsaXR5IHRleHQKKQpyZXR1cm5zIGJvb2xlYW4KbGFuZ3VhZ2Ugc3FsCnN0YWJsZQpzZWN1cml0eSBkZWZp
bmVyCnNldCBzZWFyY2hfcGF0aCA9ICcnCmFzICQkCiAgc2VsZWN0CiAgICBleGlzdHMgKAogICAgICBzZWxlY3QgMQogICAgICBmcm9tIHB1YmxpYy5jb21w
YW5pZXMgYwogICAgICB3aGVyZSBjLmlkID0gcF9jb21wYW55X2lkCiAgICAgICAgYW5kICgKICAgICAgICAgIGMub3duZXJfaWQgPSAoc2VsZWN0IGF1dGgu
dWlkKCkpCiAgICAgICAgICBvciBjLnRlc3Rlcl9pZCA9IChzZWxlY3QgYXV0aC51aWQoKSkKICAgICAgICApCiAgICApCiAgICBvciBleGlzdHMgKAogICAg
ICBzZWxlY3QgMQogICAgICBmcm9tIHB1YmxpYy5jb21wYW55X21lbWJlcnMgbQogICAgICB3aGVyZSBtLmNvbXBhbnlfaWQgPSBwX2NvbXBhbnlfaWQKICAg
ICAgICBhbmQgbS51c2VyX2lkID0gKHNlbGVjdCBhdXRoLnVpZCgpKQogICAgICAgIGFuZCBsb3dlcihjb2FsZXNjZShtLnN0YXR1cywgJycpKSA9ICdhdGl2
bycKICAgICAgICBhbmQgKAogICAgICAgICAgY2FzZSBsb3dlcihjb2FsZXNjZShwX2NhcGFiaWxpdHksICcnKSkKICAgICAgICAgICAgd2hlbiAnZmluYW5j
ZScgdGhlbgogICAgICAgICAgICAgIGxvd2VyKGNvYWxlc2NlKG0uY2FyZ28sICcnKSkgaW4gKCdkb25vJywgJ293bmVyJywgJ2dlcmVudGUnLCAnYWRtaW4n
KQogICAgICAgICAgICB3aGVuICdwcm9wb3NhbCcgdGhlbgogICAgICAgICAgICAgIGxvd2VyKGNvYWxlc2NlKG0uY2FyZ28sICcnKSkgaW4gKCdkb25vJywg
J293bmVyJywgJ2dlcmVudGUnLCAnYWRtaW4nLCAnYXRlbmRlbnRlJykKICAgICAgICAgICAgd2hlbiAnY3JtJyB0aGVuCiAgICAgICAgICAgICAgbG93ZXIo
Y29hbGVzY2UobS5jYXJnbywgJycpKSBpbiAoJ2Rvbm8nLCAnb3duZXInLCAnZ2VyZW50ZScsICdhZG1pbicsICdhdGVuZGVudGUnKQogICAgICAgICAgICB3
aGVuICdtYW5hZ2UnIHRoZW4KICAgICAgICAgICAgICBsb3dlcihjb2FsZXNjZShtLmNhcmdvLCAnJykpIGluICgnZG9ubycsICdvd25lcicsICdnZXJlbnRl
JywgJ2FkbWluJykKICAgICAgICAgICAgd2hlbiAncHJvZHVjdHMnIHRoZW4KICAgICAgICAgICAgICBsb3dlcihjb2FsZXNjZShtLmNhcmdvLCAnJykpIGlu
ICgnZG9ubycsICdvd25lcicsICdnZXJlbnRlJywgJ2FkbWluJywgJ3Byb2R1Y2FvJykKICAgICAgICAgICAgd2hlbiAnb3JkZXJzJyB0aGVuCiAgICAgICAg
ICAgICAgbG93ZXIoY29hbGVzY2UobS5jYXJnbywgJycpKSBpbiAoJ2Rvbm8nLCAnb3duZXInLCAnZ2VyZW50ZScsICdhZG1pbicsICdhdGVuZGVudGUnLCAn
cHJvZHVjYW8nKQogICAgICAgICAgICB3aGVuICdwcm9kdWN0aW9uJyB0aGVuCiAgICAgICAgICAgICAgbG93ZXIoY29hbGVzY2UobS5jYXJnbywgJycpKSBp
biAoJ2Rvbm8nLCAnb3duZXInLCAnZ2VyZW50ZScsICdhZG1pbicsICdwcm9kdWNhbycpCiAgICAgICAgICAgIHdoZW4gJ2NvbmZpZycgdGhlbgogICAgICAg
ICAgICAgIGxvd2VyKGNvYWxlc2NlKG0uY2FyZ28sICcnKSkgaW4gKCdkb25vJywgJ293bmVyJywgJ2FkbWluJykKICAgICAgICAgICAgZWxzZSBmYWxzZQog
ICAgICAgICAgZW5kCiAgICAgICAgKQogICAgKTsKJCQ7CgpyZXZva2UgYWxsIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2Nhbih1
dWlkLCB0ZXh0KQogIGZyb20gcHVibGljLCBhbm9uOwpncmFudCBleGVjdXRlIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2Nhbih1
dWlkLCB0ZXh0KQogIHRvIGF1dGhlbnRpY2F0ZWQsIHNlcnZpY2Vfcm9sZTsKCi0tIFRhYmVsYXMgcXVlIGNvbnRpbnVhbSBhY2Vzc2FkYXMgZGlyZXRhbWVu
dGUgcGVsbyBjbGllbnRlIHJlY2ViZW0gZHVhcyBjYW1hZGFzOgotLSB1bWEgcG9saWN5IHBlcm1pc3NpdmEgZGUgY2FyZ28vZW1wcmVzYSBlIG91dHJhIFJF
U1RSSUNUSVZFIGRlIHBsYW5vL2Fzc2luYXR1cmEuCmRvICQkCmRlY2xhcmUKICBpdGVtIHJlY29yZDsKICBtZW1iZXJfcG9saWN5IHRleHQ7CiAgY2FwYWJp
bGl0eV9wb2xpY3kgdGV4dDsKICBwbGFuX3BvbGljeSB0ZXh0OwpiZWdpbgogIGZvciBpdGVtIGluCiAgICBzZWxlY3QgKgogICAgZnJvbSAoCiAgICAgIHZh
bHVlcwogICAgICAgICgncHJvZHVjdHMnLCAnZXNzZW5jaWFsJywgJ3Byb2R1Y3RzJyksCiAgICAgICAgKCdvcmRlcnMnLCAnZXNzZW5jaWFsJywgJ29yZGVy
cycpLAogICAgICAgICgnZmluYW5jaWFsX3RyYW5zYWN0aW9ucycsICdwcm9maXNzaW9uYWwnLCAnZmluYW5jZScpLAogICAgICAgICgnZmluYW5jaWFsX21h
dGVyaWFsX2VudHJpZXMnLCAncHJvZmlzc2lvbmFsJywgJ2ZpbmFuY2UnKSwKICAgICAgICAoJ21hcmtldHBsYWNlX2NvdXBvbnMnLCAncHJvZmlzc2lvbmFs
JywgJ21hbmFnZScpLAogICAgICAgICgncHJvcG9zYWxzJywgJ3ByZW1pdW0nLCAncHJvcG9zYWwnKSwKICAgICAgICAoJ3Byb3Bvc2FsX2V2ZW50cycsICdw
cmVtaXVtJywgJ3Byb3Bvc2FsJykKICAgICkgYXMgZmVhdHVyZV90YWJsZSh0YWJsZV9uYW1lLCByZXF1aXJlZF9wbGFuLCBjYXBhYmlsaXR5KQogIGxvb3AK
ICAgIGlmIHRvX3JlZ2NsYXNzKGZvcm1hdCgncHVibGljLiVJJywgaXRlbS50YWJsZV9uYW1lKSkgaXMgbnVsbCB0aGVuCiAgICAgIGNvbnRpbnVlOwogICAg
ZW5kIGlmOwoKICAgIGV4ZWN1dGUgZm9ybWF0KCdhbHRlciB0YWJsZSBwdWJsaWMuJUkgZW5hYmxlIHJvdyBsZXZlbCBzZWN1cml0eScsIGl0ZW0udGFibGVf
bmFtZSk7CgogICAgbWVtYmVyX3BvbGljeSA6PSBmb3JtYXQoJ29yY2FseV9mZWF0dXJlX21lbWJlcl8lcycsIGl0ZW0udGFibGVfbmFtZSk7CiAgICBjYXBh
YmlsaXR5X3BvbGljeSA6PSBmb3JtYXQoJ29yY2FseV9mZWF0dXJlX2NhcGFiaWxpdHlfJXMnLCBpdGVtLnRhYmxlX25hbWUpOwogICAgcGxhbl9wb2xpY3kg
Oj0gZm9ybWF0KCdvcmNhbHlfZmVhdHVyZV9wbGFuXyVzJywgaXRlbS50YWJsZV9uYW1lKTsKCiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2Ryb3AgcG9s
aWN5IGlmIGV4aXN0cyAlSSBvbiBwdWJsaWMuJUknLAogICAgICBtZW1iZXJfcG9saWN5LAogICAgICBpdGVtLnRhYmxlX25hbWUKICAgICk7CiAgICBleGVj
dXRlIGZvcm1hdCgKICAgICAgJ2Ryb3AgcG9saWN5IGlmIGV4aXN0cyAlSSBvbiBwdWJsaWMuJUknLAogICAgICBjYXBhYmlsaXR5X3BvbGljeSwKICAgICAg
aXRlbS50YWJsZV9uYW1lCiAgICApOwogICAgZXhlY3V0ZSBmb3JtYXQoCiAgICAgICdkcm9wIHBvbGljeSBpZiBleGlzdHMgJUkgb24gcHVibGljLiVJJywK
ICAgICAgcGxhbl9wb2xpY3ksCiAgICAgIGl0ZW0udGFibGVfbmFtZQogICAgKTsKCiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2NyZWF0ZSBwb2xpY3kg
JUkgb24gcHVibGljLiVJIGFzIHBlcm1pc3NpdmUgZm9yIGFsbCB0byBhdXRoZW50aWNhdGVkIHVzaW5nIChwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9j
YW4oY29tcGFueV9pZCwgJUwpKSB3aXRoIGNoZWNrIChwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oY29tcGFueV9pZCwgJUwpKScsCiAgICAgIG1l
bWJlcl9wb2xpY3ksCiAgICAgIGl0ZW0udGFibGVfbmFtZSwKICAgICAgaXRlbS5jYXBhYmlsaXR5LAogICAgICBpdGVtLmNhcGFiaWxpdHkKICAgICk7Cgog
ICAgLS0gUkVTVFJJQ1RJVkUgaW1wZWRlIHF1ZSB1bWEgcG9saWN5IHBlcm1pc3NpdmEgYW50aWdhL2Jyb2FkIGNvbnRvcm5lIG8gY2FyZ28uCiAgICBleGVj
dXRlIGZvcm1hdCgKICAgICAgJ2NyZWF0ZSBwb2xpY3kgJUkgb24gcHVibGljLiVJIGFzIHJlc3RyaWN0aXZlIGZvciBhbGwgdG8gYXV0aGVudGljYXRlZCB1
c2luZyAocHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKGNvbXBhbnlfaWQsICVMKSkgd2l0aCBjaGVjayAocHVibGljLm9yY2FseV9jdXJyZW50X3Vz
ZXJfY2FuKGNvbXBhbnlfaWQsICVMKSknLAogICAgICBjYXBhYmlsaXR5X3BvbGljeSwKICAgICAgaXRlbS50YWJsZV9uYW1lLAogICAgICBpdGVtLmNhcGFi
aWxpdHksCiAgICAgIGl0ZW0uY2FwYWJpbGl0eQogICAgKTsKCiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2NyZWF0ZSBwb2xpY3kgJUkgb24gcHVibGlj
LiVJIGFzIHJlc3RyaWN0aXZlIGZvciBhbGwgdG8gYXV0aGVudGljYXRlZCB1c2luZyAocHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2FjY2Vzcyhj
b21wYW55X2lkLCAlTCkpIHdpdGggY2hlY2sgKHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3MoY29tcGFueV9pZCwgJUwpKScsCiAgICAg
IHBsYW5fcG9saWN5LAogICAgICBpdGVtLnRhYmxlX25hbWUsCiAgICAgIGl0ZW0ucmVxdWlyZWRfcGxhbiwKICAgICAgaXRlbS5yZXF1aXJlZF9wbGFuCiAg
ICApOwogIGVuZCBsb29wOwplbmQ7CiQkOwoKLS0gSXRlbnMgZGUgcGVkaWRvIGhlcmRhbSBlbXByZXNhL3BsYW5vL2NhcmdvIGF0cmF2w6lzIGRvIHBlZGlk
byBwYWkuCmRvICQkCmJlZ2luCiAgaWYgdG9fcmVnY2xhc3MoJ3B1YmxpYy5vcmRlcl9pdGVtcycpIGlzIG5vdCBudWxsIHRoZW4KICAgIGFsdGVyIHRhYmxl
IHB1YmxpYy5vcmRlcl9pdGVtcyBlbmFibGUgcm93IGxldmVsIHNlY3VyaXR5OwoKICAgIGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfb3JkZXJfaXRl
bXNfbWVtYmVyCiAgICAgIG9uIHB1YmxpYy5vcmRlcl9pdGVtczsKICAgIGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfb3JkZXJfaXRlbXNfY2FwYWJp
bGl0eQogICAgICBvbiBwdWJsaWMub3JkZXJfaXRlbXM7CiAgICBkcm9wIHBvbGljeSBpZiBleGlzdHMgb3JjYWx5X29yZGVyX2l0ZW1zX3BsYW4KICAgICAg
b24gcHVibGljLm9yZGVyX2l0ZW1zOwoKICAgIGNyZWF0ZSBwb2xpY3kgb3JjYWx5X29yZGVyX2l0ZW1zX21lbWJlcgogICAgICBvbiBwdWJsaWMub3JkZXJf
aXRlbXMKICAgICAgYXMgcGVybWlzc2l2ZQogICAgICBmb3IgYWxsCiAgICAgIHRvIGF1dGhlbnRpY2F0ZWQKICAgICAgdXNpbmcgKAogICAgICAgIGV4aXN0
cyAoCiAgICAgICAgICBzZWxlY3QgMQogICAgICAgICAgZnJvbSBwdWJsaWMub3JkZXJzIG8KICAgICAgICAgIHdoZXJlIG8uaWQgPSBvcmRlcl9pdGVtcy5v
cmRlcl9pZAogICAgICAgICAgICBhbmQgcHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKG8uY29tcGFueV9pZCwgJ29yZGVycycpCiAgICAgICAgKQog
ICAgICApCiAgICAgIHdpdGggY2hlY2sgKAogICAgICAgIGV4aXN0cyAoCiAgICAgICAgICBzZWxlY3QgMQogICAgICAgICAgZnJvbSBwdWJsaWMub3JkZXJz
IG8KICAgICAgICAgIHdoZXJlIG8uaWQgPSBvcmRlcl9pdGVtcy5vcmRlcl9pZAogICAgICAgICAgICBhbmQgcHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJf
Y2FuKG8uY29tcGFueV9pZCwgJ29yZGVycycpCiAgICAgICAgKQogICAgICApOwoKICAgIGNyZWF0ZSBwb2xpY3kgb3JjYWx5X29yZGVyX2l0ZW1zX2NhcGFi
aWxpdHkKICAgICAgb24gcHVibGljLm9yZGVyX2l0ZW1zCiAgICAgIGFzIHJlc3RyaWN0aXZlCiAgICAgIGZvciBhbGwKICAgICAgdG8gYXV0aGVudGljYXRl
ZAogICAgICB1c2luZyAoCiAgICAgICAgZXhpc3RzICgKICAgICAgICAgIHNlbGVjdCAxCiAgICAgICAgICBmcm9tIHB1YmxpYy5vcmRlcnMgbwogICAgICAg
ICAgd2hlcmUgby5pZCA9IG9yZGVyX2l0ZW1zLm9yZGVyX2lkCiAgICAgICAgICAgIGFuZCBwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oby5jb21w
YW55X2lkLCAnb3JkZXJzJykKICAgICAgICApCiAgICAgICkKICAgICAgd2l0aCBjaGVjayAoCiAgICAgICAgZXhpc3RzICgKICAgICAgICAgIHNlbGVjdCAx
CiAgICAgICAgICBmcm9tIHB1YmxpYy5vcmRlcnMgbwogICAgICAgICAgd2hlcmUgby5pZCA9IG9yZGVyX2l0ZW1zLm9yZGVyX2lkCiAgICAgICAgICAgIGFu
ZCBwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oby5jb21wYW55X2lkLCAnb3JkZXJzJykKICAgICAgICApCiAgICAgICk7CgogICAgY3JlYXRlIHBv
bGljeSBvcmNhbHlfb3JkZXJfaXRlbXNfcGxhbgogICAgICBvbiBwdWJsaWMub3JkZXJfaXRlbXMKICAgICAgYXMgcmVzdHJpY3RpdmUKICAgICAgZm9yIGFs
bAogICAgICB0byBhdXRoZW50aWNhdGVkCiAgICAgIHVzaW5nICgKICAgICAgICBleGlzdHMgKAogICAgICAgICAgc2VsZWN0IDEKICAgICAgICAgIGZyb20g
cHVibGljLm9yZGVycyBvCiAgICAgICAgICB3aGVyZSBvLmlkID0gb3JkZXJfaXRlbXMub3JkZXJfaWQKICAgICAgICAgICAgYW5kIHB1YmxpYy5vcmNhbHlf
Y29tcGFueV9oYXNfcGxhbl9hY2Nlc3Moby5jb21wYW55X2lkLCAnZXNzZW5jaWFsJykKICAgICAgICApCiAgICAgICkKICAgICAgd2l0aCBjaGVjayAoCiAg
ICAgICAgZXhpc3RzICgKICAgICAgICAgIHNlbGVjdCAxCiAgICAgICAgICBmcm9tIHB1YmxpYy5vcmRlcnMgbwogICAgICAgICAgd2hlcmUgby5pZCA9IG9y
ZGVyX2l0ZW1zLm9yZGVyX2lkCiAgICAgICAgICAgIGFuZCBwdWJsaWMub3JjYWx5X2NvbXBhbnlfaGFzX3BsYW5fYWNjZXNzKG8uY29tcGFueV9pZCwgJ2Vz
c2VuY2lhbCcpCiAgICAgICAgKQogICAgICApOwogIGVuZCBpZjsKZW5kOwokJDsKCi0tIEEgZW1wcmVzYSBwb2RlIHNlciBsaWRhIHBlbGFzIHBvbGljaWVz
IGV4aXN0ZW50ZXMsIG1hcyBjb25maWd1cmHDp8OjbyBkaXJldGEKLS0gc8OzIHBvZGUgc2VyIGFsdGVyYWRhIHBlbG8gZG9uby9hZG1pbiBlIGVucXVhbnRv
IGhvdXZlciBhY2Vzc28gYXRpdm8uCmRvICQkCmJlZ2luCiAgaWYgdG9fcmVnY2xhc3MoJ3B1YmxpYy5jb21wYW5pZXMnKSBpcyBub3QgbnVsbCB0aGVuCiAg
ICBhbHRlciB0YWJsZSBwdWJsaWMuY29tcGFuaWVzIGVuYWJsZSByb3cgbGV2ZWwgc2VjdXJpdHk7CgogICAgZHJvcCBwb2xpY3kgaWYgZXhpc3RzIG9yY2Fs
eV9jb21wYW55X3VwZGF0ZV9tZW1iZXIKICAgICAgb24gcHVibGljLmNvbXBhbmllczsKICAgIGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfY29tcGFu
eV91cGRhdGVfY2FwYWJpbGl0eQogICAgICBvbiBwdWJsaWMuY29tcGFuaWVzOwogICAgZHJvcCBwb2xpY3kgaWYgZXhpc3RzIG9yY2FseV9jb21wYW55X3Vw
ZGF0ZV9wbGFuCiAgICAgIG9uIHB1YmxpYy5jb21wYW5pZXM7CgogICAgY3JlYXRlIHBvbGljeSBvcmNhbHlfY29tcGFueV91cGRhdGVfbWVtYmVyCiAgICAg
IG9uIHB1YmxpYy5jb21wYW5pZXMKICAgICAgYXMgcGVybWlzc2l2ZQogICAgICBmb3IgdXBkYXRlCiAgICAgIHRvIGF1dGhlbnRpY2F0ZWQKICAgICAgdXNp
bmcgKHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2NhbihpZCwgJ2NvbmZpZycpKQogICAgICB3aXRoIGNoZWNrIChwdWJsaWMub3JjYWx5X2N1cnJlbnRf
dXNlcl9jYW4oaWQsICdjb25maWcnKSk7CgogICAgY3JlYXRlIHBvbGljeSBvcmNhbHlfY29tcGFueV91cGRhdGVfY2FwYWJpbGl0eQogICAgICBvbiBwdWJs
aWMuY29tcGFuaWVzCiAgICAgIGFzIHJlc3RyaWN0aXZlCiAgICAgIGZvciB1cGRhdGUKICAgICAgdG8gYXV0aGVudGljYXRlZAogICAgICB1c2luZyAocHVi
bGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKGlkLCAnY29uZmlnJykpCiAgICAgIHdpdGggY2hlY2sgKHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2Nh
bihpZCwgJ2NvbmZpZycpKTsKCiAgICBjcmVhdGUgcG9saWN5IG9yY2FseV9jb21wYW55X3VwZGF0ZV9wbGFuCiAgICAgIG9uIHB1YmxpYy5jb21wYW5pZXMK
ICAgICAgYXMgcmVzdHJpY3RpdmUKICAgICAgZm9yIHVwZGF0ZQogICAgICB0byBhdXRoZW50aWNhdGVkCiAgICAgIHVzaW5nIChwdWJsaWMub3JjYWx5X2Nv
bXBhbnlfaGFzX3BsYW5fYWNjZXNzKGlkLCAnZXNzZW5jaWFsJykpCiAgICAgIHdpdGggY2hlY2sgKHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9h
Y2Nlc3MoaWQsICdlc3NlbmNpYWwnKSk7CiAgZW5kIGlmOwplbmQ7CiQkOwoKLS0gTm90YXMgZmlzY2FpcyBzw6NvIFByZW1pdW0gZW1ib3JhIGNvbXBhcnRp
bGhlbSBmaW5hbmNpYWxfdHJhbnNhY3Rpb25zLgpkbyAkJApiZWdpbgogIGlmCiAgICB0b19yZWdjbGFzcygncHVibGljLmZpbmFuY2lhbF90cmFuc2FjdGlv
bnMnKSBpcyBub3QgbnVsbAogICAgYW5kIGV4aXN0cyAoCiAgICAgIHNlbGVjdCAxCiAgICAgIGZyb20gaW5mb3JtYXRpb25fc2NoZW1hLmNvbHVtbnMKICAg
ICAgd2hlcmUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYycKICAgICAgICBhbmQgdGFibGVfbmFtZSA9ICdmaW5hbmNpYWxfdHJhbnNhY3Rpb25zJwogICAgICAg
IGFuZCBjb2x1bW5fbmFtZSA9ICdvcmlnZW0nCiAgICApCiAgICBhbmQgZXhpc3RzICgKICAgICAgc2VsZWN0IDEKICAgICAgZnJvbSBpbmZvcm1hdGlvbl9z
Y2hlbWEuY29sdW1ucwogICAgICB3aGVyZSB0YWJsZV9zY2hlbWEgPSAncHVibGljJwogICAgICAgIGFuZCB0YWJsZV9uYW1lID0gJ2ZpbmFuY2lhbF90cmFu
c2FjdGlvbnMnCiAgICAgICAgYW5kIGNvbHVtbl9uYW1lID0gJ25vdGFfbnVtZXJvJwogICAgKQogICAgYW5kIGV4aXN0cyAoCiAgICAgIHNlbGVjdCAxCiAg
ICAgIGZyb20gaW5mb3JtYXRpb25fc2NoZW1hLmNvbHVtbnMKICAgICAgd2hlcmUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYycKICAgICAgICBhbmQgdGFibGVf
bmFtZSA9ICdmaW5hbmNpYWxfdHJhbnNhY3Rpb25zJwogICAgICAgIGFuZCBjb2x1bW5fbmFtZSA9ICdkb2N1bWVudG9fdXJsJwogICAgKQogIHRoZW4KICAg
IGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfZmluYW5jaWFsX25vdGVzX3ByZW1pdW0KICAgICAgb24gcHVibGljLmZpbmFuY2lhbF90cmFuc2FjdGlv
bnM7CgogICAgY3JlYXRlIHBvbGljeSBvcmNhbHlfZmluYW5jaWFsX25vdGVzX3ByZW1pdW0KICAgICAgb24gcHVibGljLmZpbmFuY2lhbF90cmFuc2FjdGlv
bnMKICAgICAgYXMgcmVzdHJpY3RpdmUKICAgICAgZm9yIGFsbAogICAgICB0byBhdXRoZW50aWNhdGVkCiAgICAgIHVzaW5nICgKICAgICAgICAoCiAgICAg
ICAgICBsb3dlcihjb2FsZXNjZShvcmlnZW0sICcnKSkgPD4gJ25vdGFfZmlzY2FsJwogICAgICAgICAgYW5kIGNvYWxlc2NlKG5vdGFfbnVtZXJvLCAnJykg
PSAnJwogICAgICAgICAgYW5kIGNvYWxlc2NlKGRvY3VtZW50b191cmwsICcnKSA9ICcnCiAgICAgICAgKQogICAgICAgIG9yIHB1YmxpYy5vcmNhbHlfY29t
cGFueV9oYXNfcGxhbl9hY2Nlc3MoY29tcGFueV9pZCwgJ3ByZW1pdW0nKQogICAgICApCiAgICAgIHdpdGggY2hlY2sgKAogICAgICAgICgKICAgICAgICAg
IGxvd2VyKGNvYWxlc2NlKG9yaWdlbSwgJycpKSA8PiAnbm90YV9maXNjYWwnCiAgICAgICAgICBhbmQgY29hbGVzY2Uobm90YV9udW1lcm8sICcnKSA9ICcn
CiAgICAgICAgICBhbmQgY29hbGVzY2UoZG9jdW1lbnRvX3VybCwgJycpID0gJycKICAgICAgICApCiAgICAgICAgb3IgcHVibGljLm9yY2FseV9jb21wYW55
X2hhc19wbGFuX2FjY2Vzcyhjb21wYW55X2lkLCAncHJlbWl1bScpCiAgICAgICk7CiAgZW5kIGlmOwplbmQ7CiQkOwoKLS0gQ1JNIGUgZGFkb3MgZmluYW5j
ZWlyb3MgYXV0b3JpdGF0aXZvcyBwYXNzYW0gc29tZW50ZSBwZWxhcyBBUElzIHNlcnZpY2Utcm9sZS4KZG8gJCQKZGVjbGFyZQogIHRhYmxlX25hbWUgdGV4
dDsKYmVnaW4KICBmb3JlYWNoIHRhYmxlX25hbWUgaW4gYXJyYXkgYXJyYXlbCiAgICAnY3JtX2xlYWRzJywKICAgICdtYXJrZXRwbGFjZV9wYXltZW50X3Nl
dHRpbmdzJywKICAgICdtYXJrZXRwbGFjZV9wYXltZW50cycsCiAgICAnbWFya2V0cGxhY2VfY29tbWlzc2lvbnMnLAogICAgJ21hcmtldHBsYWNlX2NvbW1p
c3Npb25fcnVsZXMnLAogICAgJ21hcmtldHBsYWNlX29hdXRoX3N0YXRlcycsCiAgICAncGF5bWVudF93ZWJob29rX2V2ZW50cycsCiAgICAncGxhbl9wYXlt
ZW50cycKICBdCiAgbG9vcAogICAgaWYgdG9fcmVnY2xhc3MoZm9ybWF0KCdwdWJsaWMuJUknLCB0YWJsZV9uYW1lKSkgaXMgbm90IG51bGwgdGhlbgogICAg
ICBleGVjdXRlIGZvcm1hdCgKICAgICAgICAncmV2b2tlIGFsbCBwcml2aWxlZ2VzIG9uIHRhYmxlIHB1YmxpYy4lSSBmcm9tIGF1dGhlbnRpY2F0ZWQnLAog
ICAgICAgIHRhYmxlX25hbWUKICAgICAgKTsKICAgIGVuZCBpZjsKICBlbmQgbG9vcDsKZW5kOwokJDsKCi0tIFZpZXdzIGRlIHByb3Bvc3RhIHBhc3NhbSBh
IG9iZWRlY2VyIFJMUyBkYXMgdGFiZWxhcy1iYXNlLgpkbyAkJApiZWdpbgogIGlmIHRvX3JlZ2NsYXNzKCdwdWJsaWMucHJvcG9zYWxzX2Rhc2hib2FyZCcp
IGlzIG5vdCBudWxsIHRoZW4KICAgIGV4ZWN1dGUgJ2FsdGVyIHZpZXcgcHVibGljLnByb3Bvc2Fsc19kYXNoYm9hcmQgc2V0IChzZWN1cml0eV9pbnZva2Vy
ID0gdHJ1ZSknOwogIGVuZCBpZjsKZW5kOwokJDsKCmNvbW1pdDsKYCk7Cgpjb25zb2xlLmxvZyhgUEFUQ0hfQ0hBTkdFRD0ke2NoYW5nZWQubGVuZ3RofWAp
Owpjb25zb2xlLmxvZyhgUEFUQ0hfQ1JFQVRFRD0ke2NyZWF0ZWQubGVuZ3RofWApOwpjb25zb2xlLmxvZygiT1JDQUxZX1BBVENIRVJfT0s9MSIpOwo=
'@
    $PatcherBase64 = $PatcherBase64 -replace "\s", ""
    [System.IO.File]::WriteAllBytes(
        $PatcherPath,
        [Convert]::FromBase64String($PatcherBase64)
    )

    try {
        Invoke-Checked $Node --check $PatcherPath
        Invoke-Checked $Node $PatcherPath
    }
    catch {
        Write-Host "Patcher falhou. Restaurando apenas os arquivos alvo..." -ForegroundColor Red
        foreach ($Relative in $TargetFiles) {
            $Full = Join-Path $RepoRoot $Relative
            $BackupPath = Join-Path $BackupRoot $Relative
            if ($ExistingBefore[$Relative] -and (Test-Path -LiteralPath $BackupPath)) {
                New-Item -ItemType Directory -Force -Path (Split-Path $Full -Parent) | Out-Null
                Copy-Item -LiteralPath $BackupPath -Destination $Full -Force
            }
            elseif (-not $ExistingBefore[$Relative] -and (Test-Path -LiteralPath $Full)) {
                Remove-Item -LiteralPath $Full -Force
            }
        }
        throw
    }

    Write-Step "Criando migration pelo Supabase CLI"
    & $Npx supabase migration new --help | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase CLI nao respondeu a 'migration new --help'."
    }

    $Migration = Get-ChildItem -LiteralPath (Join-Path $RepoRoot "supabase\migrations") -Filter "*_affiliate_workspace_server_authority.sql" |
        Sort-Object LastWriteTime |
        Select-Object -Last 1

    if (-not $Migration) {
        Invoke-Checked $Npx supabase migration new affiliate_workspace_server_authority
        $Migration = Get-ChildItem -LiteralPath (Join-Path $RepoRoot "supabase\migrations") -Filter "*_affiliate_workspace_server_authority.sql" |
            Sort-Object LastWriteTime |
            Select-Object -Last 1
    }

    if (-not $Migration) {
        throw "A migration foi solicitada ao CLI, mas o arquivo nao foi encontrado."
    }

    $SqlTemplate = Join-Path $ReportDir "affiliate_workspace_server_authority.sql"
    $SqlContent = [System.IO.File]::ReadAllText($SqlTemplate)
    Write-Utf8NoBom $Migration.FullName $SqlContent
    $MigrationRelative = $Migration.FullName.Substring($RepoRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar).Replace('\','/')
    Write-Host "Migration: $MigrationRelative"

    Write-Step "Procurando credenciais acidentais no conteudo rastreado e no historico Git"
    $SecretPatterns = @(
        'APP_USR-[A-Za-z0-9_-]{20,}',
        'sk-proj-[A-Za-z0-9_-]{20,}',
        'github_pat_[A-Za-z0-9_]{20,}',
        'ghp_[A-Za-z0-9]{30,}',
        'sk_live_[A-Za-z0-9]{20,}',
        'AKIA[0-9A-Z]{16}',
        '(?i)(?:SUPABASE_SERVICE_ROLE_KEY|PAYMENT_CREDENTIALS_ENCRYPTION_KEY|MP_[A-Z0-9_]*(?:ACCESS_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET)|ASAAS_[A-Z0-9_]*API_KEY)\s*[:=]\s*["'']?[A-Za-z0-9._-]{16,}'
    )

    $TrackedSecretFound = $false
    foreach ($TrackedFile in @(& $Git ls-files)) {
        $TrackedPath = Join-Path $RepoRoot $TrackedFile
        if (-not (Test-Path -LiteralPath $TrackedPath -PathType Leaf)) { continue }

        try {
            $Info = Get-Item -LiteralPath $TrackedPath
            if ($Info.Length -gt 8MB) { continue }
            $TrackedText = [System.IO.File]::ReadAllText($TrackedPath)
        }
        catch {
            continue
        }

        foreach ($Pattern in $SecretPatterns) {
            if ([regex]::IsMatch($TrackedText, $Pattern)) {
                $TrackedSecretFound = $true
                Write-Host "[SECRET-SUSPECT] arquivo rastreado: $TrackedFile" -ForegroundColor Red
                break
            }
        }
    }

    $HistorySecretFound = $false
    & $Git log -p --all --no-ext-diff --pretty=format: 2>$null | ForEach-Object {
        if ($HistorySecretFound) { return }
        $HistoryLine = [string]$_
        foreach ($Pattern in $SecretPatterns) {
            if ([regex]::IsMatch($HistoryLine, $Pattern)) {
                $HistorySecretFound = $true
                break
            }
        }
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao auditar o historico Git em busca de credenciais."
    }

    if ($TrackedSecretFound -or $HistorySecretFound) {
        Write-Host "Nenhum valor de credencial foi impresso por seguranca." -ForegroundColor Yellow
        throw "Foi detectado possivel segredo versionado no Git. Pare antes do push: a credencial precisa ser rotacionada e o historico precisa ser saneado."
    }
    Write-Host "GIT_SECRET_HISTORY_SCAN_OK=1" -ForegroundColor Green

    Write-Step "Removendo artefatos temporarios apenas do indice Git"
    $ArtifactPaths = @(& $Git ls-files | Where-Object { Test-ArtifactPath $_ })
    foreach ($Artifact in $ArtifactPaths) {
        & $Git rm --cached --ignore-unmatch -- "$Artifact" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao remover artefato do indice: $Artifact"
        }
        Write-Host "[UNTRACK] $Artifact"
    }
    Write-Host "Artefatos desversionados: $($ArtifactPaths.Count)"

    Repair-MojibakeTrackedFiles $Git
    Write-Host "Arquivos UTF-8 reparados: $($script:RepairedMojibakeFiles.Count)"

    Write-Step "Varredura estatica de seguranca em todos os arquivos rastreados"
    Invoke-Checked $Node scripts/security-check.mjs

    Write-Step "ESLint completo"
    Invoke-Checked $Npm run lint

    Write-Step "TypeScript noEmit"
    Invoke-Checked $Npx tsc --noEmit

    Write-Step "Verificacao de fronteiras de pagamentos"
    Invoke-Checked $Npm run verify:payments

    Write-Step "Verificacao de isolamento de credenciais"
    Invoke-Checked $Npm run verify:payment-credentials

    Write-Step "Auditoria de dependencias de producao"
    & $Npm audit --omit=dev --audit-level=high
    if ($LASTEXITCODE -ne 0) {
        throw "npm audit encontrou vulnerabilidade high/critical ou nao conseguiu concluir. Nenhum deploy sera feito."
    }

    Write-Step "Build de producao"
    Invoke-Checked $Npm run build

    Write-Step "Verificando whitespace e conflitos de diff"
    Invoke-Checked $Git diff --check

    Write-Step "Auditoria local de policies/migrations relacionadas a dados sensiveis"
    $SensitiveTerms = @(
        "financial_transactions",
        "proposals",
        "proposals_dashboard",
        "company_members",
        "storage.objects",
        "affiliate_activity_events",
        "affiliate_certifications"
    )
    $PolicyAuditPath = Join-Path $ReportDir "policy-audit-$Stamp.txt"
    $AuditLines = New-Object System.Collections.Generic.List[string]
    foreach ($SqlFile in Get-ChildItem -LiteralPath (Join-Path $RepoRoot "supabase\migrations") -Filter "*.sql" | Sort-Object Name) {
        $Text = [System.IO.File]::ReadAllText($SqlFile.FullName)
        foreach ($Term in $SensitiveTerms) {
            if ($Text.IndexOf($Term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $AuditLines.Add("$($SqlFile.Name) :: $Term")
            }
        }
    }
    [System.IO.File]::WriteAllLines($PolicyAuditPath, $AuditLines, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Policy audit local: $PolicyAuditPath"

    Write-Step "Supabase dry-run quando o CLI estiver vinculado"
    $DryRunOk = $false
    $PushHelp = (& $Npx supabase db push --help 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel consultar 'supabase db push --help'."
    }

    if ($PushHelp -match "--dry-run") {
        & $Npx supabase db push --dry-run
        if ($LASTEXITCODE -eq 0) {
            $DryRunOk = $true
            Write-Host "ORCALY_SUPABASE_DRY_RUN_OK=1" -ForegroundColor Green
        } else {
            if ($ApplySupabase) {
                throw "Supabase dry-run falhou. Migration NAO sera aplicada."
            }
            Write-Warning "Supabase dry-run nao concluiu. Codigo segue validado, banco nao foi alterado."
        }
    } else {
        Write-Warning "A versao local do Supabase CLI nao anuncia --dry-run."
        if ($ApplySupabase) {
            throw "Por seguranca, -ApplySupabase exige suporte a --dry-run."
        }
    }

    if ($ApplySupabase) {
        if (-not $DryRunOk) {
            throw "Migration nao sera aplicada sem dry-run bem sucedido."
        }
        Write-Step "Aplicando migrations pendentes no projeto Supabase vinculado"
        $PushArgs = @("supabase", "db", "push")
        if ($PushHelp -match "--yes") {
            $PushArgs += "--yes"
        }
        & $Npx @PushArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Supabase db push falhou. Codigo NAO sera enviado ao GitHub."
        }
        Write-Host "ORCALY_SUPABASE_APPLIED=1" -ForegroundColor Green
    }

    Write-Step "Staging explicito, sem git add -A"
    $StageFiles = @(
        ".gitignore",
        ".env.example",
        "proxy.ts",
        "lib/br-document.ts",
        "lib/company-access.ts",
        "app/api/company/current/route.ts",
        "lib/panel-modules.ts",
        "components/painel/PanelSidebar.tsx",
        "components/painel/PanelPremiumShell.tsx",
        "app/painel/layout.tsx",
        "components/parceiros/PartnerCoursesTab.tsx",
        "lib/affiliates/academy-catalog.ts",
        "lib/affiliates/workspace.ts",
        "components/parceiros/PartnerGrowthHub.tsx",
        "lib/affiliates/server.ts",
        "app/api/parceiros/route.ts",
        "app/api/parceiros/workspace/route.ts",
        "app/api/parceiros/register/route.ts",
        "app/api/parceiros/track/route.ts",
        "app/api/crm/leads/route.ts",
        "app/api/crm/leads/[id]/route.ts",
        "app/api/checkout/lead/route.ts",
        "app/api/leads/complete-account/route.ts",
        "components/checkout/SignupCheckout.tsx",
        "app/api/checkout/signup/pix/route.ts",
        "app/api/checkout/signup/card/route.ts",
        "app/api/checkout/signup/route.ts",
        "app/api/checkout/signup/status/route.ts",
        "lib/slug.ts",
        "lib/orcaly-security.ts",
        "lib/payments/server-context.ts",
        "app/api/public-site/[slug]/route.ts",
        "app/api/public/uploads/art/route.ts",
        "lib/panel-storage.ts",
        "lib/security/request.ts",
        "app/api/public/home-chat/route.ts",
        "app/api/ai/business-assistant/route.ts",
        "app/api/ai/orcamento/route.ts",
        "app/api/marketplace/coupon/route.ts",
        "app/api/marketplace/payments/settings/route.ts",
        "app/api/marketplace/payments/sales/route.ts",
        "app/api/marketplace/payments/mercado-pago/callback/route.ts",
        "app/api/marketplace/payments/mercado-pago/connect/route.ts",
        "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
        "app/api/mercado-pago/webhook/route.ts",
        "app/api/assinatura/checkout/webhook/route.ts",
        "lib/subscription-checkout-payment.ts",
        "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
        "lib/subscription-mercado-pago-transparent.ts",
        "app/api/company/subscription/route.ts",
        "app/api/mercado-pago/webhook-leads/route.ts",
        "app/api/webhooks/asaas/route.ts",
        "lib/subscription-service.ts",
        "lib/platform-admin.ts",
        "app/api/admin/scan/route.ts",
        "app/api/admin/team/route.ts",
        "app/api/admin/affiliates/route.ts",
        "app/api/admin/change-password/route.ts",
        "app/api/system/health/route.ts",
        "scripts/security-check.mjs",
        $MigrationRelative
    )

    foreach ($StageFile in $StageFiles) {
        if (Test-Path -LiteralPath $StageFile) {
            & $Git add -- "$StageFile"
            if ($LASTEXITCODE -ne 0) { throw "git add falhou: $StageFile" }
        }
    }

    foreach ($RepairedFile in $script:RepairedMojibakeFiles) {
        if (Test-Path -LiteralPath $RepairedFile) {
            & $Git add -- "$RepairedFile"
            if ($LASTEXITCODE -ne 0) { throw "git add falhou no reparo UTF-8: $RepairedFile" }
        }
    }

    Invoke-Checked $Git diff --cached --check

    Write-Step "Resumo do diff"
    & $Git status --short
    & $Git diff --cached --stat

    $Current = (& $Git branch --show-current).Trim()
    $Head = (& $Git rev-parse HEAD).Trim()

    $Summary = [ordered]@{
        ok = $true
        timestamp = (Get-Date).ToString("o")
        branch = $Current
        head_before_commit = $Head
        migration = $MigrationRelative
        artifact_untracks = $ArtifactPaths.Count
        supabase_dry_run = $DryRunOk
        supabase_applied = [bool]$ApplySupabase
        committed = $false
        pushed = $false
        transcript = $TranscriptPath
        policy_audit = $PolicyAuditPath
    }

    if ($Commit) {
        Write-Step "Commit"
        & $Git diff --cached --quiet
        $HasStaged = $LASTEXITCODE -ne 0
        if ($HasStaged) {
            Invoke-Checked $Git commit -m $CommitMessage
            $Summary.committed = $true
            Write-Host "ORCALY_COMMIT_OK=1" -ForegroundColor Green
        } else {
            Write-Host "Nenhuma alteracao staged para commit."
        }
    }

    if ($Push) {
        Write-Step "Push da branch de hardening"
        Invoke-Checked $Git push -u origin $Current
        $Summary.pushed = $true
        Write-Host "ORCALY_PUSH_OK=1" -ForegroundColor Green
    }

    $SummaryPath = Join-Path $ReportDir "hardening-summary-$Stamp.json"
    $Summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8

    Write-Host ""
    Write-Host "ORCALY_HARDENING_CODE_OK=1" -ForegroundColor Green
    Write-Host "HARDENING_BRANCH=$Current"
    Write-Host "HARDENING_MIGRATION=$MigrationRelative"
    Write-Host "HARDENING_REPORT=$TranscriptPath"
    Write-Host "HARDENING_SUMMARY=$SummaryPath"
    Write-Host "ORCALY_HARDENING_READY=1" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ORCALY_HARDENING_FAILED=1" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    try { & $Git status --short } catch {}
    throw
}
finally {
    try { Stop-Transcript | Out-Null } catch {}
}
