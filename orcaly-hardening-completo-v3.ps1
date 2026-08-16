# ORCALY_HARDENING_V2_ASCII_ONLY
# Compatible source encoding strategy for Windows PowerShell 5.1.
param(
    [switch]$ApplySupabase,
    [switch]$Commit,
    [switch]$Push
)

$ErrorActionPreference = "Stop"
$ORCALY_HARDENING_SCRIPT_VERSION = "v3-eof-safe"
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
IFBBVENIRVJfVkVSU0lPTiA9ICJ2My1lb2Ytc2FmZSI7CmNvbnN0IGNoYW5nZWQgPSBbXTsKY29uc3QgY3JlYXRlZCA9IFtdOwoKZnVuY3Rpb24gYWJzKGZp
bGUpIHsKICByZXR1cm4gcGF0aC5qb2luKHJvb3QsIC4uLmZpbGUuc3BsaXQoIi8iKSk7Cn0KZnVuY3Rpb24gcmVhZChmaWxlKSB7CiAgcmV0dXJuIGZzLnJl
YWRGaWxlU3luYyhhYnMoZmlsZSksICJ1dGY4IikucmVwbGFjZSgvXHJcbi9nLCAiXG4iKTsKfQpmdW5jdGlvbiB3cml0ZShmaWxlLCBjb250ZW50KSB7CiAg
ZnMubWtkaXJTeW5jKHBhdGguZGlybmFtZShhYnMoZmlsZSkpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTsKICBmcy53cml0ZUZpbGVTeW5jKGFicyhmaWxlKSwg
Y29udGVudC5yZXBsYWNlKC9cclxuL2csICJcbiIpLCAidXRmOCIpOwp9CmZ1bmN0aW9uIG11c3RFeGlzdChmaWxlKSB7CiAgaWYgKCFmcy5leGlzdHNTeW5j
KGFicyhmaWxlKSkpIHRocm93IG5ldyBFcnJvcihgQXJxdWl2byBlc3BlcmFkbyBuw6NvIGVuY29udHJhZG86ICR7ZmlsZX1gKTsKfQpmdW5jdGlvbiByZXBs
YWNlT25jZVRleHQoY29udGVudCwgb2xkVGV4dCwgbmV3VGV4dCwgbGFiZWwpIHsKICBpZiAoY29udGVudC5pbmNsdWRlcyhuZXdUZXh0KSkgcmV0dXJuIGNv
bnRlbnQ7CiAgY29uc3QgZmlyc3QgPSBjb250ZW50LmluZGV4T2Yob2xkVGV4dCk7CiAgaWYgKGZpcnN0IDwgMCkgdGhyb3cgbmV3IEVycm9yKGBUcmVjaG8g
bsOjbyBlbmNvbnRyYWRvICgke2xhYmVsfSlgKTsKICBpZiAoY29udGVudC5pbmRleE9mKG9sZFRleHQsIGZpcnN0ICsgb2xkVGV4dC5sZW5ndGgpID49IDAp
IHsKICAgIHRocm93IG5ldyBFcnJvcihgVHJlY2hvIGFwYXJlY2V1IG1haXMgZGUgdW1hIHZleiAoJHtsYWJlbH0pYCk7CiAgfQogIHJldHVybiBjb250ZW50
LnNsaWNlKDAsIGZpcnN0KSArIG5ld1RleHQgKyBjb250ZW50LnNsaWNlKGZpcnN0ICsgb2xkVGV4dC5sZW5ndGgpOwp9CmZ1bmN0aW9uIHJlcGxhY2VPbmNl
UmVnZXgoY29udGVudCwgcmVnZXgsIHJlcGxhY2VtZW50LCBsYWJlbCkgewogIGlmICghcmVnZXguZ2xvYmFsKSB7CiAgICBjb25zdCBtYXRjaGVzID0gY29u
dGVudC5tYXRjaChuZXcgUmVnRXhwKHJlZ2V4LnNvdXJjZSwgcmVnZXguZmxhZ3MgKyAiZyIpKTsKICAgIGlmICghbWF0Y2hlcz8ubGVuZ3RoKSB0aHJvdyBu
ZXcgRXJyb3IoYFBhZHLDo28gbsOjbyBlbmNvbnRyYWRvICgke2xhYmVsfSlgKTsKICAgIGlmIChtYXRjaGVzLmxlbmd0aCAhPT0gMSkgdGhyb3cgbmV3IEVy
cm9yKGBQYWRyw6NvIGVuY29udHJvdSAke21hdGNoZXMubGVuZ3RofSBvY29ycsOqbmNpYXMgKCR7bGFiZWx9KWApOwogIH0KICByZXR1cm4gY29udGVudC5y
ZXBsYWNlKHJlZ2V4LCByZXBsYWNlbWVudCk7Cn0KZnVuY3Rpb24gcGF0Y2goZmlsZSwgdHJhbnNmb3JtKSB7CiAgbXVzdEV4aXN0KGZpbGUpOwogIGNvbnN0
IGJlZm9yZSA9IHJlYWQoZmlsZSk7CiAgY29uc3QgYWZ0ZXIgPSB0cmFuc2Zvcm0oYmVmb3JlKTsKICBpZiAoYWZ0ZXIgIT09IGJlZm9yZSkgewogICAgd3Jp
dGUoZmlsZSwgYWZ0ZXIpOwogICAgY2hhbmdlZC5wdXNoKGZpbGUpOwogICAgY29uc29sZS5sb2coYFtQQVRDSF0gJHtmaWxlfWApOwogIH0gZWxzZSB7CiAg
ICBjb25zb2xlLmxvZyhgW09LXSAke2ZpbGV9IGrDoSBlc3RhdmEgY29tcGF0w612ZWxgKTsKICB9Cn0KZnVuY3Rpb24gY3JlYXRlT3JSZXBsYWNlKGZpbGUs
IGNvbnRlbnQpIHsKICBjb25zdCBleGlzdGVkID0gZnMuZXhpc3RzU3luYyhhYnMoZmlsZSkpOwogIGNvbnN0IGJlZm9yZSA9IGV4aXN0ZWQgPyByZWFkKGZp
bGUpIDogbnVsbDsKICBpZiAoYmVmb3JlICE9PSBjb250ZW50KSB7CiAgICB3cml0ZShmaWxlLCBjb250ZW50KTsKICAgIChleGlzdGVkID8gY2hhbmdlZCA6
IGNyZWF0ZWQpLnB1c2goZmlsZSk7CiAgICBjb25zb2xlLmxvZyhgW1dSSVRFXSAke2ZpbGV9YCk7CiAgfQp9CmZ1bmN0aW9uIGFkZEltcG9ydEFmdGVyKGNv
bnRlbnQsIGFuY2hvciwgaW1wb3J0TGluZSwgbGFiZWwpIHsKICBpZiAoY29udGVudC5pbmNsdWRlcyhpbXBvcnRMaW5lKSkgcmV0dXJuIGNvbnRlbnQ7CiAg
cmV0dXJuIHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBhbmNob3IsIGAke2FuY2hvcn0ke2ltcG9ydExpbmV9XG5gLCBsYWJlbCk7Cn0KCi8vIDEpIERvY3Vt
ZW50byBicmFzaWxlaXJvIGNhbsO0bmljbwpjcmVhdGVPclJlcGxhY2UoImxpYi9ici1kb2N1bWVudC50cyIsIGBleHBvcnQgZnVuY3Rpb24gZG9jdW1lbnRE
aWdpdHModmFsdWU6IHVua25vd24pIHsKICByZXR1cm4gU3RyaW5nKHZhbHVlIHx8ICIiKS5yZXBsYWNlKC9cXEQvZywgIiIpOwp9CgpmdW5jdGlvbiBhbGxF
cXVhbCh2YWx1ZTogc3RyaW5nKSB7CiAgcmV0dXJuIC9eKFxcZClcXDErJC8udGVzdCh2YWx1ZSk7Cn0KCmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQ3BmKHZh
bHVlOiB1bmtub3duKSB7CiAgY29uc3QgY3BmID0gZG9jdW1lbnREaWdpdHModmFsdWUpOwogIGlmIChjcGYubGVuZ3RoICE9PSAxMSB8fCBhbGxFcXVhbChj
cGYpKSByZXR1cm4gZmFsc2U7CgogIGNvbnN0IGRpZ2l0ID0gKGJhc2VMZW5ndGg6IG51bWJlcikgPT4gewogICAgbGV0IHN1bSA9IDA7CiAgICBmb3IgKGxl
dCBpbmRleCA9IDA7IGluZGV4IDwgYmFzZUxlbmd0aDsgaW5kZXggKz0gMSkgewogICAgICBzdW0gKz0gTnVtYmVyKGNwZltpbmRleF0pICogKGJhc2VMZW5n
dGggKyAxIC0gaW5kZXgpOwogICAgfQogICAgY29uc3QgcmVtYWluZGVyID0gKHN1bSAqIDEwKSAlIDExOwogICAgcmV0dXJuIHJlbWFpbmRlciA9PT0gMTAg
PyAwIDogcmVtYWluZGVyOwogIH07CgogIHJldHVybiBkaWdpdCg5KSA9PT0gTnVtYmVyKGNwZls5XSkgJiYgZGlnaXQoMTApID09PSBOdW1iZXIoY3BmWzEw
XSk7Cn0KCmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQ25waih2YWx1ZTogdW5rbm93bikgewogIGNvbnN0IGNucGogPSBkb2N1bWVudERpZ2l0cyh2YWx1ZSk7
CiAgaWYgKGNucGoubGVuZ3RoICE9PSAxNCB8fCBhbGxFcXVhbChjbnBqKSkgcmV0dXJuIGZhbHNlOwoKICBjb25zdCBjYWxjdWxhdGUgPSAoYmFzZUxlbmd0
aDogMTIgfCAxMykgPT4gewogICAgY29uc3Qgd2VpZ2h0cyA9CiAgICAgIGJhc2VMZW5ndGggPT09IDEyCiAgICAgICAgPyBbNSwgNCwgMywgMiwgOSwgOCwg
NywgNiwgNSwgNCwgMywgMl0KICAgICAgICA6IFs2LCA1LCA0LCAzLCAyLCA5LCA4LCA3LCA2LCA1LCA0LCAzLCAyXTsKICAgIGNvbnN0IHN1bSA9IHdlaWdo
dHMucmVkdWNlKAogICAgICAodG90YWwsIHdlaWdodCwgaW5kZXgpID0+IHRvdGFsICsgTnVtYmVyKGNucGpbaW5kZXhdKSAqIHdlaWdodCwKICAgICAgMCwK
ICAgICk7CiAgICBjb25zdCByZW1haW5kZXIgPSBzdW0gJSAxMTsKICAgIHJldHVybiByZW1haW5kZXIgPCAyID8gMCA6IDExIC0gcmVtYWluZGVyOwogIH07
CgogIHJldHVybiAoCiAgICBjYWxjdWxhdGUoMTIpID09PSBOdW1iZXIoY25walsxMl0pICYmCiAgICBjYWxjdWxhdGUoMTMpID09PSBOdW1iZXIoY25walsx
M10pCiAgKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRDcGZDbnBqKHZhbHVlOiB1bmtub3duKSB7CiAgY29uc3QgY2xlYW4gPSBkb2N1bWVudERpZ2l0
cyh2YWx1ZSk7CiAgcmV0dXJuIGNsZWFuLmxlbmd0aCA9PT0gMTEgPyBpc1ZhbGlkQ3BmKGNsZWFuKSA6IGlzVmFsaWRDbnBqKGNsZWFuKTsKfQoKZXhwb3J0
IGZ1bmN0aW9uIHJlcXVpcmVWYWxpZENwZkNucGoodmFsdWU6IHVua25vd24pIHsKICBjb25zdCBjbGVhbiA9IGRvY3VtZW50RGlnaXRzKHZhbHVlKTsKICBp
ZiAoIWlzVmFsaWRDcGZDbnBqKGNsZWFuKSkgewogICAgdGhyb3cgbmV3IEVycm9yKCJDUEYgb3UgQ05QSiBpbnbDoWxpZG8uIik7CiAgfQogIHJldHVybiBj
bGVhbjsKfQpgKTsKCi8vIDEuMSkgQWRtaW4gZGEgcGxhdGFmb3JtYSBkZXBlbmRlIGRvIGNhZGFzdHJvIG5vIGJhbmNvLCBuw6NvIGRlIGUtbWFpbCBmaXhv
IG5vIGPDs2RpZ28uCnBhdGNoKCJwcm94eS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgICBjb25z
dCBvd25lckVtYWlsTWF0Y2hlcyA9CiAgICAgICAgZGF0YWJhc2VSb2xlICE9PSAnb3duZXInIHx8CiAgICAgICAgU3RyaW5nKHVzZXIuZW1haWwgfHwgJycp
LnRvTG93ZXJDYXNlKCkgPT09CiAgICAgICAgICAndmluaWNpdXNhZG1Ab3JjYWx5LmNvbScKCmAsCiAgICAiIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50
LnJlcGxhY2UoCiAgICBgICAgICAgICAhYWxsb3dlZEFkbWluUm9sZXMuaGFzKGRhdGFiYXNlUm9sZSkgfHwKICAgICAgICAhb3duZXJFbWFpbE1hdGNoZXNg
LAogICAgYCAgICAgICAgIWFsbG93ZWRBZG1pblJvbGVzLmhhcyhkYXRhYmFzZVJvbGUpYCwKICApOwoKICBpZiAoY29udGVudC5pbmNsdWRlcygndmluaWNp
dXNhZG1Ab3JjYWx5LmNvbScpKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb3h5IGFpbmRhIGNvbnRlbSBvd25lciBhZG1pbmlzdHJhdGl2byBmaXhvIHBv
ciBlLW1haWwnKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8gMikgQXV0b3JpemHDp8OjbyBlIGFzc2luYXR1cmEgY2VudHJhbApwYXRjaCgibGli
L2NvbXBhbnktYWNjZXNzLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7
IE5leHRSZXF1ZXN0IH0gZnJvbSAnbmV4dC9zZXJ2ZXInXG4iLAogICAgImltcG9ydCB7IGdldENvbXBhbnlTdWJzY3JpcHRpb25BY2Nlc3MsIHR5cGUgU3Vi
c2NyaXB0aW9uQWNjZXNzSW5wdXQgfSBmcm9tICdAL2xpYi9zdWJzY3JpcHRpb24tYWNjZXNzJyIsCiAgICAiY29tcGFueS1hY2Nlc3MgaW1wb3J0IGFzc2lu
YXR1cmEiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBnZXRDb21wYW55U3Vic2NyaXB0aW9u
QWNjZXNzLCB0eXBlIFN1YnNjcmlwdGlvbkFjY2Vzc0lucHV0IH0gZnJvbSAnQC9saWIvc3Vic2NyaXB0aW9uLWFjY2VzcydcbiIsCiAgICAiaW1wb3J0IHsg
bm9ybWFsaXplUGxhbktleSwgdHlwZSBQbGFuS2V5IH0gZnJvbSAnQC9saWIvcGxhbnMvcGxhbi1jb25maWcnIiwKICAgICJjb21wYW55LWFjY2VzcyBpbXBv
cnQgcGxhbm8iLAogICk7CgogIGNvbnRlbnQgPSByZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAgIC9leHBvcnQgZnVuY3Rpb24gYXNzaW5hdHVy
YUVzdGFBdGl2YVwoY29tcGFueTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gXHwgbnVsbFwpIFx7W1xzXFNdKj9cblx9LywKICAgIGBleHBvcnQgZnVuY3Rp
b24gYXNzaW5hdHVyYUVzdGFBdGl2YShjb21wYW55OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IG51bGwpIHsKICByZXR1cm4gZ2V0Q29tcGFueVN1YnNj
cmlwdGlvbkFjY2Vzcyhjb21wYW55IGFzIFN1YnNjcmlwdGlvbkFjY2Vzc0lucHV0IHwgbnVsbCkuaGFzQWNjZXNzCn1gLAogICAgImFzc2luYXR1cmFFc3Rh
QXRpdmEgY2Fuw7RuaWNhIiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImV4cG9ydCBmdW5jdGlvbiBjb21wYW55UGxhbkFsbG93cygiKSkgewog
ICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYGV4cG9ydCBmdW5jdGlvbiBhc3NpbmF0dXJhRXN0YUF0aXZhKGNv
bXBhbnk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCkgewogIHJldHVybiBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzKGNvbXBhbnkgYXMg
U3Vic2NyaXB0aW9uQWNjZXNzSW5wdXQgfCBudWxsKS5oYXNBY2Nlc3MKfWAsCiAgICAgIGBleHBvcnQgZnVuY3Rpb24gYXNzaW5hdHVyYUVzdGFBdGl2YShj
b21wYW55OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IG51bGwpIHsKICByZXR1cm4gZ2V0Q29tcGFueVN1YnNjcmlwdGlvbkFjY2Vzcyhjb21wYW55IGFz
IFN1YnNjcmlwdGlvbkFjY2Vzc0lucHV0IHwgbnVsbCkuaGFzQWNjZXNzCn0KCmNvbnN0IENPTVBBTllfUExBTl9SQU5LOiBSZWNvcmQ8UGxhbktleSwgbnVt
YmVyPiA9IHsKICBlc3NlbmNpYWw6IDEsCiAgcHJvZmlzc2lvbmFsOiAyLAogIHByZW1pdW06IDMsCn0KCmV4cG9ydCBmdW5jdGlvbiBjb21wYW55UGxhbkFs
bG93cygKICBjb21wYW55OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IG51bGwsCiAgcmVxdWlyZWRQbGFuOiBQbGFuS2V5LAopIHsKICBpZiAoIWNvbXBh
bnkpIHJldHVybiBmYWxzZQoKICBjb25zdCBjdXJyZW50ID0gbm9ybWFsaXplUGxhbktleSgKICAgIGNvbXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fCBjb21w
YW55LnBsYW5vLAogICkKCiAgcmV0dXJuIENPTVBBTllfUExBTl9SQU5LW2N1cnJlbnRdID49IENPTVBBTllfUExBTl9SQU5LW3JlcXVpcmVkUGxhbl0KfQoK
Y29uc3QgQ0xJRU5UX0NPTVBBTllfQkxPQ0tFRF9LRVlTID0gbmV3IFNldChbCiAgJ2Fzc2luYXR1cmFfbXBfcGF5bG9hZCcsCiAgJ3Jhd19wYXlsb2FkJywK
ICAncmF3X3BheW1lbnQnLAogICdyYXdfcHJlZmVyZW5jZScsCiAgJ3Jhd19zdWJzY3JpcHRpb24nLAogICdwcm92aWRlcl9tZXRhZGF0YScsCl0pCgpleHBv
cnQgZnVuY3Rpb24gc2FuaXRpemVDb21wYW55Rm9yQ2xpZW50KAogIGNvbXBhbnk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbCwKKSB7CiAgaWYg
KCFjb21wYW55KSByZXR1cm4gbnVsbAoKICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKAogICAgT2JqZWN0LmVudHJpZXMoY29tcGFueSkuZmlsdGVyKChb
a2V5XSkgPT4gewogICAgICBjb25zdCBub3JtYWxpemVkID0ga2V5LnRvTG93ZXJDYXNlKCkKCiAgICAgIGlmIChDTElFTlRfQ09NUEFOWV9CTE9DS0VEX0tF
WVMuaGFzKG5vcm1hbGl6ZWQpKSByZXR1cm4gZmFsc2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ2FjY2Vzc190b2tlbicpKSByZXR1cm4gZmFs
c2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ3JlZnJlc2hfdG9rZW4nKSkgcmV0dXJuIGZhbHNlCiAgICAgIGlmIChub3JtYWxpemVkLmluY2x1
ZGVzKCdjbGllbnRfc2VjcmV0JykpIHJldHVybiBmYWxzZQogICAgICBpZiAobm9ybWFsaXplZC5pbmNsdWRlcygnc2VjcmV0JykpIHJldHVybiBmYWxzZQog
ICAgICBpZiAobm9ybWFsaXplZC5pbmNsdWRlcygnYXBpX2tleScpKSByZXR1cm4gZmFsc2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoJ2NyZWRl
bnRpYWwnKSkgcmV0dXJuIGZhbHNlCiAgICAgIGlmIChub3JtYWxpemVkLmluY2x1ZGVzKCdlbmNyeXB0ZWQnKSkgcmV0dXJuIGZhbHNlCiAgICAgIGlmIChu
b3JtYWxpemVkLmluY2x1ZGVzKCdwYXNzd29yZCcpKSByZXR1cm4gZmFsc2UKICAgICAgaWYgKG5vcm1hbGl6ZWQuZW5kc1dpdGgoJ190b2tlbicpIHx8IG5v
cm1hbGl6ZWQuc3RhcnRzV2l0aCgndG9rZW5fJykpIHJldHVybiBmYWxzZQoKICAgICAgcmV0dXJuIHRydWUKICAgIH0pLAogICkKfWAsCiAgICAgICJjb21w
YW55IHBsYW4gaGVscGVyIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VSZWdleCgKICAgIGNvbnRlbnQsCiAgICAvYXN5bmMgZnVuY3Rp
b24gZ2V0QWRtaW5Sb2xlXChbXHNcU10qP1xuXH1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbXBhbnlBY2Nlc3MvLAogICAgYGFzeW5jIGZ1bmN0
aW9uIGdldFBsYXRmb3JtT3duZXJSb2xlKAogIHN1cGFiYXNlQWRtaW46IFJldHVyblR5cGU8dHlwZW9mIGdldFN1cGFiYXNlQWRtaW4+LAogIGVtYWlsPzog
c3RyaW5nIHwgbnVsbCwKKSB7CiAgY29uc3Qgbm9ybWFsaXplZCA9IFN0cmluZyhlbWFpbCB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCkKICBpZiAoIW5v
cm1hbGl6ZWQpIHJldHVybiBudWxsCgogIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgIC5mcm9tKCdwbGF0Zm9ybV9h
ZG1pbnMnKQogICAgLnNlbGVjdCgncm9sZSxpc19hY3RpdmUnKQogICAgLmVxKCdpc19hY3RpdmUnLCB0cnVlKQogICAgLmlsaWtlKCdlbWFpbCcsIG5vcm1h
bGl6ZWQpCiAgICAubGltaXQoMSkKICAgIC5tYXliZVNpbmdsZSgpCgogIGlmIChlcnJvcikgdGhyb3cgZXJyb3IKCiAgcmV0dXJuIFN0cmluZyhkYXRhPy5y
b2xlIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PSAnb3duZXInCiAgICA/ICdzdXBlcl9hZG1pbicKICAgIDogbnVsbAp9CgpleHBvcnQgYXN5bmMgZnVuY3Rp
b24gZ2V0Q29tcGFueUFjY2Vzc2AsCiAgICAicmVtb3ZlIGF1dG9yaWRhZGUgYWRtaW5fdXNlcnMiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxh
Y2UoCiAgICAiY29uc3QgYWRtaW5Sb2xlID0gYXdhaXQgZ2V0QWRtaW5Sb2xlKHN1cGFiYXNlQWRtaW4sIGVtYWlsKSIsCiAgICAiY29uc3QgYWRtaW5Sb2xl
ID0gYXdhaXQgZ2V0UGxhdGZvcm1Pd25lclJvbGUoc3VwYWJhc2VBZG1pbiwgZW1haWwpIiwKICApOwogIC8vIFJlbW92ZSBmYWxsYmFjayBsZWdhZG8gcXVl
IHRyYW5zZm9ybWF2YSBvd25lciBkYSBwbGF0YWZvcm1hIGVtIGRvbm8gZGUgdW0gdGVuYW50IGZpeG8uCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgIGAgIGlmIChpc0FkbWluTWFzdGVyKSB7CiAgICBjb25zdCB7IGRhdGE6IGFkbWluQ29tcGFueSwgZXJyb3I6IGFkbWluQ29tcGFueUVycm9yIH0gPQog
ICAgICBhd2FpdCBzdXBhYmFzZUFkbWluCiAgICAgICAgLmZyb20oJ2NvbXBhbmllcycpCiAgICAgICAgLnNlbGVjdCgnKicpCiAgICAgICAgLmVxKCdzbHVn
JywgJ2dyYWZpY2EtZmxhc2gnKQogICAgICAgIC5tYXliZVNpbmdsZSgpCgogICAgaWYgKGFkbWluQ29tcGFueUVycm9yKSB0aHJvdyBhZG1pbkNvbXBhbnlF
cnJvcgoKICAgIGlmIChhZG1pbkNvbXBhbnk/LmlkKSB7CiAgICAgIHJldHVybiB7CiAgICAgICAgY29tcGFueTogYWRtaW5Db21wYW55LAogICAgICAgIHJv
bGU6ICdzdXBlcl9hZG1pbicgYXMgQ3VycmVudFJvbGUsCiAgICAgICAgLi4ucGVybWlzc2lvbnNCeVJvbGUoJ2Rvbm8nLCB0cnVlKSwKICAgICAgfQogICAg
fQogIH0KCmAsCiAgICAiIiwKICApOwoKICBpZiAoY29udGVudC5pbmNsdWRlcygiLmZyb20oJ2FkbWluX3VzZXJzJykiKSkgewogICAgdGhyb3cgbmV3IEVy
cm9yKCJjb21wYW55LWFjY2VzcyBhaW5kYSByZWZlcmVuY2lhIGFkbWluX3VzZXJzIik7CiAgfQogIGlmIChjb250ZW50LmluY2x1ZGVzKCIuZXEoJ3NsdWcn
LCAnZ3JhZmljYS1mbGFzaCcpIikpIHsKICAgIHRocm93IG5ldyBFcnJvcigiY29tcGFueS1hY2Nlc3MgYWluZGEgcG9zc3VpIGZhbGxiYWNrIGRlIHRlbmFu
dCBwYXJhIGFkbWluIGRhIHBsYXRhZm9ybWEiKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvY29tcGFueS9jdXJyZW50L3Jv
dXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKCIgIGFzc2luYXR1cmFFc3RhQXRpdmEsXG4iLCAiIik7CiAgY29u
dGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgIGdldFN1cGFiYXNlQWRtaW4sXG59IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgICAiICBn
ZXRTdXBhYmFzZUFkbWluLFxuICBzYW5pdGl6ZUNvbXBhbnlGb3JDbGllbnQsXG59IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgKTsKICBjb250
ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgIn0gZnJvbSAnQC9saWIvY29tcGFueS1hY2Nlc3MnXG4iLAogICAgImltcG9ydCB7IGdl
dENvbXBhbnlTdWJzY3JpcHRpb25BY2Nlc3MgfSBmcm9tICdAL2xpYi9zdWJzY3JpcHRpb24tYWNjZXNzJyIsCiAgICAiY29tcGFueS9jdXJyZW50IGltcG9y
dCBzdWJzY3JpcHRpb24iLAogICk7CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBzdWJzY3JpcHRpb25BY2Nlc3MgPSBnZXRDb21wYW55U3Vic2Ny
aXB0aW9uQWNjZXNzIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgICIgICAgY29uc3QgYWNjZXNzID0g
YXdhaXQgZ2V0Q29tcGFueUFjY2VzcyhzdXBhYmFzZUFkbWluLCByZXF1ZXN0ZXIuaWQsIHJlcXVlc3Rlci5lbWFpbClcblxuIiwKICAgICAgIiAgICBjb25z
dCBhY2Nlc3MgPSBhd2FpdCBnZXRDb21wYW55QWNjZXNzKHN1cGFiYXNlQWRtaW4sIHJlcXVlc3Rlci5pZCwgcmVxdWVzdGVyLmVtYWlsKVxuICAgIGNvbnN0
IHN1YnNjcmlwdGlvbkFjY2VzcyA9IGdldENvbXBhbnlTdWJzY3JpcHRpb25BY2Nlc3MoYWNjZXNzLmNvbXBhbnkpXG5cbiIsCiAgICAgICJjb21wYW55L2N1
cnJlbnQgYWNjZXNzIiwKICAgICk7CiAgfQogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgICAgYXNzaW5hdHVyYV9hdGl2YTogYXNzaW5h
dHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSksIiwKICAgICIgICAgICBhc3NpbmF0dXJhX2F0aXZhOiBzdWJzY3JpcHRpb25BY2Nlc3MuaGFzQWNjZXNz
LFxuICAgICAgc3Vic2NyaXB0aW9uX2FjY2Vzczogc3Vic2NyaXB0aW9uQWNjZXNzLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAg
IiAgICAgIGNvbXBhbnk6IGFjY2Vzcy5jb21wYW55LCIsCiAgICAiICAgICAgY29tcGFueTogc2FuaXRpemVDb21wYW55Rm9yQ2xpZW50KGFjY2Vzcy5jb21w
YW55KSwiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8gMykgQ2F0w6Fsb2dvIGRlIHBsYW5vcyBhcGxpY2FkbyDDoCBuYXZlZ2HDp8OjbyBlIHJv
dGEKcGF0Y2goImxpYi9wYW5lbC1tb2R1bGVzLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuc3RhcnRzV2l0aCgiaW1wb3J0IHsgbm9ybWFs
aXplUGxhbktleSIpKSB7CiAgICBjb250ZW50ID0gYGltcG9ydCB7IG5vcm1hbGl6ZVBsYW5LZXkgfSBmcm9tICdAL2xpYi9wbGFucy9wbGFuLWNvbmZpZydc
blxuJHtjb250ZW50fWA7CiAgfQogIGlmICghY29udGVudC5pbmNsdWRlcygiZXhwb3J0IGZ1bmN0aW9uIHBhbmVsUGxhbkFsbG93cygiKSkgewogICAgY29u
c3QgbWFya2VyID0gIlxuZXhwb3J0IHsgbm9ybWFsaXplQnVzaW5lc3NUeXBlIGFzIG5vcm1hbGl6ZVBhbmVsQnVzaW5lc3NUeXBlIH0iOwogICAgY29uc3Qg
aGVscGVyID0gYApjb25zdCBSRVFVSVJFRF9QTEFOX1JBTks6IFJlY29yZDxFeGNsdWRlPFJlcXVpcmVkUGxhbiwgbnVsbD4sIG51bWJlcj4gPSB7CiAgYmFz
aWM6IDEsCiAgaW50ZXJtZWRpYXRlOiAyLAogIHByZW1pdW06IDMsCn0KCmNvbnN0IEFDVFVBTF9QTEFOX1JBTksgPSB7CiAgZXNzZW5jaWFsOiAxLAogIHBy
b2Zpc3Npb25hbDogMiwKICBwcmVtaXVtOiAzLAp9IGFzIGNvbnN0CgpleHBvcnQgZnVuY3Rpb24gcGFuZWxQbGFuQWxsb3dzKAogIHJlcXVpcmVkUGxhbjog
UmVxdWlyZWRQbGFuLAogIGFjdHVhbFBsYW46IHVua25vd24sCikgewogIGlmICghcmVxdWlyZWRQbGFuKSByZXR1cm4gdHJ1ZQoKICBjb25zdCBub3JtYWxp
emVkID0gbm9ybWFsaXplUGxhbktleShhY3R1YWxQbGFuKQogIHJldHVybiBBQ1RVQUxfUExBTl9SQU5LW25vcm1hbGl6ZWRdID49IFJFUVVJUkVEX1BMQU5f
UkFOS1tyZXF1aXJlZFBsYW5dCn0KCmV4cG9ydCB0eXBlIFBhbmVsQWNjZXNzUGVybWlzc2lvbnMgPSB7CiAgY2FuX2ZpbmFuY2U/OiBib29sZWFuCiAgY2Fu
X2NvbmZpZz86IGJvb2xlYW4KICBjYW5fcHJvZHVjdHM/OiBib29sZWFuCiAgY2FuX3Byb3Bvc2FsPzogYm9vbGVhbgogIGNhbl9zdWJzY3JpcHRpb24/OiBi
b29sZWFuCiAgY2FuX3Byb2R1Y3Rpb24/OiBib29sZWFuCn0KCmV4cG9ydCBmdW5jdGlvbiBwYW5lbFBlcm1pc3Npb25BbGxvd3MoCiAgbW9kdWxlSXRlbTog
UGljazxQYW5lbE1vZHVsZSwgJ2lkJyB8ICdncm91cCc+LAogIHBlcm1pc3Npb25zPzogUGFuZWxBY2Nlc3NQZXJtaXNzaW9ucyB8IG51bGwsCikgewogIGlm
ICghcGVybWlzc2lvbnMpIHJldHVybiB0cnVlCgogIGlmICgKICAgIG1vZHVsZUl0ZW0uZ3JvdXAgPT09ICdmaW5hbmNlaXJvJyB8fAogICAgbW9kdWxlSXRl
bS5pZCA9PT0gJ3BhZ2FtZW50b3NfbWFya2V0cGxhY2UnCiAgKSB7CiAgICByZXR1cm4gcGVybWlzc2lvbnMuY2FuX2ZpbmFuY2UgPT09IHRydWUKICB9Cgog
IGlmICgKICAgIFsnY2xpZW50ZXNfY3JtJywgJ2ZvbGxvd191cCcsICdwcm9wb3N0YXMnXS5pbmNsdWRlcyhtb2R1bGVJdGVtLmlkKQogICkgewogICAgcmV0
dXJuIHBlcm1pc3Npb25zLmNhbl9wcm9wb3NhbCA9PT0gdHJ1ZQogIH0KCiAgaWYgKG1vZHVsZUl0ZW0uaWQgPT09ICdwcm9kdXRvc19zZXJ2aWNvcycpIHsK
ICAgIHJldHVybiBwZXJtaXNzaW9ucy5jYW5fcHJvZHVjdHMgPT09IHRydWUKICB9CgogIGlmIChtb2R1bGVJdGVtLmlkID09PSAnY29uZmlndXJhY29lcycp
IHsKICAgIHJldHVybiBwZXJtaXNzaW9ucy5jYW5fY29uZmlnID09PSB0cnVlCiAgfQoKICBpZiAobW9kdWxlSXRlbS5pZCA9PT0gJ2Fzc2luYXR1cmEnKSB7
CiAgICByZXR1cm4gcGVybWlzc2lvbnMuY2FuX3N1YnNjcmlwdGlvbiAhPT0gZmFsc2UKICB9CgogIGlmIChtb2R1bGVJdGVtLmlkID09PSAncHJvZHVjYW8n
KSB7CiAgICByZXR1cm4gcGVybWlzc2lvbnMuY2FuX3Byb2R1Y3Rpb24gPT09IHRydWUKICB9CgogIHJldHVybiB0cnVlCn0KCmV4cG9ydCBmdW5jdGlvbiBm
aW5kUGFuZWxNb2R1bGVCeVBhdGgocGF0aG5hbWU6IHN0cmluZykgewogIGNvbnN0IGNsZWFuID0gU3RyaW5nKHBhdGhuYW1lIHx8ICcnKS5zcGxpdCgnPycp
WzBdCgogIHJldHVybiBwYW5lbE1vZHVsZXMKICAgIC5maWx0ZXIoKG1vZHVsZUl0ZW0pID0+IG1vZHVsZUl0ZW0uc3RhdHVzID09PSAnYWN0aXZlJykKICAg
IC5tYXAoKG1vZHVsZUl0ZW0pID0+ICh7CiAgICAgIC4uLm1vZHVsZUl0ZW0sCiAgICAgIGhyZWY6IGdldFNhZmVNb2R1bGVIcmVmKG1vZHVsZUl0ZW0pLAog
ICAgfSkpCiAgICAuZmlsdGVyKAogICAgICAobW9kdWxlSXRlbSkgPT4KICAgICAgICBjbGVhbiA9PT0gbW9kdWxlSXRlbS5ocmVmIHx8CiAgICAgICAgY2xl
YW4uc3RhcnRzV2l0aChcYFwke21vZHVsZUl0ZW0uaHJlZn0vXGApLAogICAgKQogICAgLnNvcnQoKGEsIGIpID0+IGIuaHJlZi5sZW5ndGggLSBhLmhyZWYu
bGVuZ3RoKVswXSB8fCBudWxsCn0KYDsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoY29udGVudCwgbWFya2VyLCBgJHtoZWxwZXJ9JHttYXJrZXJ9
YCwgInBhbmVsIHBsYW4gaGVscGVycyIpOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiY29tcG9uZW50cy9wYWluZWwvUGFuZWxTaWRlYmFy
LnRzeCIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICJpbXBvcnQgeyBnZXRQYW5lbE1vZHVsZXNGb3JCdXNpbmVz
c1R5cGUsIHBhbmVsR3JvdXBMYWJlbHMsIHR5cGUgUGFuZWxNb2R1bGVHcm91cCB9IGZyb20gJ0AvbGliL3BhbmVsLW1vZHVsZXMnIiwKICAgICJpbXBvcnQg
eyBnZXRQYW5lbE1vZHVsZXNGb3JCdXNpbmVzc1R5cGUsIHBhbmVsR3JvdXBMYWJlbHMsIHBhbmVsUGVybWlzc2lvbkFsbG93cywgcGFuZWxQbGFuQWxsb3dz
LCB0eXBlIFBhbmVsQWNjZXNzUGVybWlzc2lvbnMsIHR5cGUgUGFuZWxNb2R1bGVHcm91cCB9IGZyb20gJ0AvbGliL3BhbmVsLW1vZHVsZXMnIiwgCiAgKTsK
ICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFBhbmVsU2lkZWJhcih7IGNvbXBhbnkgfTogeyBjb21w
YW55OiBQYW5lbFNpZGViYXJDb21wYW55IH0pIHsiLAogICAgImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFBhbmVsU2lkZWJhcih7IGNvbXBhbnksIHBlcm1p
c3Npb25zIH06IHsgY29tcGFueTogUGFuZWxTaWRlYmFyQ29tcGFueTsgcGVybWlzc2lvbnM/OiBQYW5lbEFjY2Vzc1Blcm1pc3Npb25zIHwgbnVsbCB9KSB7
IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICAiPFNpZGViYXJHcm91cHMgcGF0aG5hbWU9e3BhdGhuYW1lfSBtb2R1bGVzPXtt
b2R1bGVzfSAvPiIsCiAgICAiPFNpZGViYXJHcm91cHMgcGF0aG5hbWU9e3BhdGhuYW1lfSBtb2R1bGVzPXttb2R1bGVzfSBwbGFuPXtjb21wYW55LmFzc2lu
YXR1cmFfcGxhbm8gfHwgY29tcGFueS5wbGFub30gcGVybWlzc2lvbnM9e3Blcm1pc3Npb25zfSAvPiIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBs
YWNlKAogICAgImZ1bmN0aW9uIFNpZGViYXJHcm91cHMoeyBwYXRobmFtZSwgbW9kdWxlcyB9OiB7IHBhdGhuYW1lOiBzdHJpbmc7IG1vZHVsZXM6IFJldHVy
blR5cGU8dHlwZW9mIGdldFBhbmVsTW9kdWxlc0ZvckJ1c2luZXNzVHlwZT4gfSkgeyIsCiAgICAiZnVuY3Rpb24gU2lkZWJhckdyb3Vwcyh7IHBhdGhuYW1l
LCBtb2R1bGVzLCBwbGFuLCBwZXJtaXNzaW9ucyB9OiB7IHBhdGhuYW1lOiBzdHJpbmc7IG1vZHVsZXM6IFJldHVyblR5cGU8dHlwZW9mIGdldFBhbmVsTW9k
dWxlc0ZvckJ1c2luZXNzVHlwZT47IHBsYW4/OiBzdHJpbmcgfCBudWxsOyBwZXJtaXNzaW9ucz86IFBhbmVsQWNjZXNzUGVybWlzc2lvbnMgfCBudWxsIH0p
IHsiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIuZmlsdGVyKChtb2R1bGUpID0+IG1vZHVsZS5ncm91cCA9PT0gZ3JvdXAgJiYg
bW9kdWxlLnN0YXR1cyA9PT0gJ2FjdGl2ZScpIiwKICAgICIuZmlsdGVyKChtb2R1bGUpID0+IG1vZHVsZS5ncm91cCA9PT0gZ3JvdXAgJiYgbW9kdWxlLnN0
YXR1cyA9PT0gJ2FjdGl2ZScgJiYgcGFuZWxQbGFuQWxsb3dzKG1vZHVsZS5yZXF1aXJlZFBsYW4sIHBsYW4pICYmIHBhbmVsUGVybWlzc2lvbkFsbG93cyht
b2R1bGUsIHBlcm1pc3Npb25zKSkiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKCnBhdGNoKCJjb21wb25lbnRzL3BhaW5lbC9QYW5lbFByZW1pdW1T
aGVsbC50c3giLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHR5cGUgeyBSZWFj
dE5vZGUgfSBmcm9tICdyZWFjdCdcbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBQYW5lbEFjY2Vzc1Blcm1pc3Npb25zIH0gZnJvbSAnQC9saWIvcGFuZWwtbW9k
dWxlcyciLAogICAgInBhbmVsIHNoZWxsIHBlcm1pc3Npb25zIHR5cGUiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIHBhdGhu
YW1lLAogIGNoaWxkcmVuLAp9OiB7CiAgY29tcGFueTogUGFuZWxQcmVtaXVtQ29tcGFueQogIHBhdGhuYW1lOiBzdHJpbmcKICBjaGlsZHJlbjogUmVhY3RO
b2RlCn0pIHtgLAogICAgYCAgcGF0aG5hbWUsCiAgcGVybWlzc2lvbnMsCiAgY2hpbGRyZW4sCn06IHsKICBjb21wYW55OiBQYW5lbFByZW1pdW1Db21wYW55
CiAgcGF0aG5hbWU6IHN0cmluZwogIHBlcm1pc3Npb25zPzogUGFuZWxBY2Nlc3NQZXJtaXNzaW9ucyB8IG51bGwKICBjaGlsZHJlbjogUmVhY3ROb2RlCn0p
IHtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICI8UGFuZWxTaWRlYmFyIGNvbXBhbnk9e2NvbXBhbnl9IC8+IiwKICAgICI8UGFu
ZWxTaWRlYmFyIGNvbXBhbnk9e2NvbXBhbnl9IHBlcm1pc3Npb25zPXtwZXJtaXNzaW9uc30gLz4iLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0
Y2goImFwcC9wYWluZWwvbGF5b3V0LnRzeCIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJp
bXBvcnQgeyBnZXRDb21wYW55UHVibGljSG9zdCB9IGZyb20gJ0AvbGliL2NvbXBhbnktdXJsJ1xuIiwKICAgICJpbXBvcnQgeyBmaW5kUGFuZWxNb2R1bGVC
eVBhdGgsIHBhbmVsUGVybWlzc2lvbkFsbG93cywgcGFuZWxQbGFuQWxsb3dzLCB0eXBlIFBhbmVsQWNjZXNzUGVybWlzc2lvbnMsIHR5cGUgUmVxdWlyZWRQ
bGFuIH0gZnJvbSAnQC9saWIvcGFuZWwtbW9kdWxlcyciLAogICAgImxheW91dCBwbGFuIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBs
YWNlKAogICAgYCAgcGVybWlzc2lvbnM/OiB7CiAgICBjYW5fc3Vic2NyaXB0aW9uPzogYm9vbGVhbgogIH1gLAogICAgYCAgcGVybWlzc2lvbnM/OiBQYW5l
bEFjY2Vzc1Blcm1pc3Npb25zYCwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImZ1bmN0aW9uIFBhaW5lbFBsYW5vQmxvcXVlYWRvKCIpKSB7CiAg
ICBjb25zdCBtYXJrZXIgPSAiXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBQYWluZWxMYXlvdXQiOwogICAgY29uc3QgYmxvY2sgPSBgCmZ1bmN0aW9uIFBh
aW5lbFBsYW5vQmxvcXVlYWRvKHsKICBtb2R1bGVMYWJlbCwKICByZXF1aXJlZFBsYW4sCn06IHsKICBtb2R1bGVMYWJlbDogc3RyaW5nCiAgcmVxdWlyZWRQ
bGFuOiBSZXF1aXJlZFBsYW4KfSkgewogIGNvbnN0IHBsYW5vID0KICAgIHJlcXVpcmVkUGxhbiA9PT0gJ3ByZW1pdW0nCiAgICAgID8gJ1ByZW1pdW0nCiAg
ICAgIDogcmVxdWlyZWRQbGFuID09PSAnaW50ZXJtZWRpYXRlJwogICAgICAgID8gJ1Byb2Zpc3Npb25hbCcKICAgICAgICA6ICdFc3NlbmNpYWwnCgogIHJl
dHVybiAoCiAgICA8bWFpbiBjbGFzc05hbWU9ImdyaWQgbWluLWgtWzcwdmhdIHBsYWNlLWl0ZW1zLWNlbnRlciBiZy1bI2Y4ZmJmZl0gcHgtNCBweS0xMCB0
ZXh0LVsjMDcxYjNhXSI+CiAgICAgIDxzZWN0aW9uIGNsYXNzTmFtZT0idy1mdWxsIG1heC13LTJ4bCByb3VuZGVkLVsycmVtXSBib3JkZXIgYm9yZGVyLWJs
dWUtMTAwIGJnLXdoaXRlIHAtNyB0ZXh0LWNlbnRlciBzaGFkb3cteGwgc2hhZG93LWJsdWUtOTUwLzggc206cC0xMCI+CiAgICAgICAgPHAgY2xhc3NOYW1l
PSJ0ZXh0LXhzIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLVswLjE4ZW1dIHRleHQtWyMxMzU5YTVdIj4KICAgICAgICAgIFJlY3Vyc28gZG8gcGxh
bm8ge3BsYW5vfQogICAgICAgIDwvcD4KICAgICAgICA8aDEgY2xhc3NOYW1lPSJtdC0zIHRleHQtM3hsIGZvbnQtYmxhY2sgdHJhY2tpbmctWy0wLjA0ZW1d
Ij4KICAgICAgICAgIHttb2R1bGVMYWJlbH0gbsOjbyBmYXogcGFydGUgZG8gc2V1IHBsYW5vIGF0dWFsLgogICAgICAgIDwvaDE+CiAgICAgICAgPHAgY2xh
c3NOYW1lPSJteC1hdXRvIG10LTQgbWF4LXcteGwgZm9udC1ib2xkIGxlYWRpbmctNyB0ZXh0LXNsYXRlLTUwMCI+CiAgICAgICAgICBTZXVzIGRhZG9zIHBl
cm1hbmVjZW0gcHJlc2VydmFkb3MuIFBhcmEgdXNhciBlc3RlIHJlY3Vyc28sIGZhw6dhIG8gdXBncmFkZSBkYSBhc3NpbmF0dXJhLgogICAgICAgIDwvcD4K
ICAgICAgICA8TGluawogICAgICAgICAgaHJlZj0iL3BhaW5lbC9hc3NpbmF0dXJhIgogICAgICAgICAgY2xhc3NOYW1lPSJtdC02IGlubGluZS1mbGV4IHJv
dW5kZWQtMnhsIGJnLVsjMDUyNDVjXSBweC02IHB5LTQgZm9udC1ibGFjayB0ZXh0LXdoaXRlIgogICAgICAgID4KICAgICAgICAgIFZlciBwbGFub3MgZSBm
YXplciB1cGdyYWRlCiAgICAgICAgPC9MaW5rPgogICAgICA8L3NlY3Rpb24+CiAgICA8L21haW4+CiAgKQp9CmA7CiAgICBjb250ZW50ID0gcmVwbGFjZU9u
Y2VUZXh0KGNvbnRlbnQsIG1hcmtlciwgYCR7YmxvY2t9JHttYXJrZXJ9YCwgImxheW91dCBwbGFubyBibG9xdWVhZG8iKTsKICB9CgogIGlmICghY29udGVu
dC5pbmNsdWRlcygiZnVuY3Rpb24gUGFpbmVsUGVybWlzc2FvQmxvcXVlYWRhKCIpKSB7CiAgICBjb25zdCBtYXJrZXIgPSAiXG5leHBvcnQgZGVmYXVsdCBm
dW5jdGlvbiBQYWluZWxMYXlvdXQiOwogICAgY29uc3QgYmxvY2sgPSBgCmZ1bmN0aW9uIFBhaW5lbFBlcm1pc3Nhb0Jsb3F1ZWFkYSh7IG1vZHVsZUxhYmVs
IH06IHsgbW9kdWxlTGFiZWw6IHN0cmluZyB9KSB7CiAgcmV0dXJuICgKICAgIDxtYWluIGNsYXNzTmFtZT0iZ3JpZCBtaW4taC1bNzB2aF0gcGxhY2UtaXRl
bXMtY2VudGVyIGJnLVsjZjhmYmZmXSBweC00IHB5LTEwIHRleHQtWyMwNzFiM2FdIj4KICAgICAgPHNlY3Rpb24gY2xhc3NOYW1lPSJ3LWZ1bGwgbWF4LXct
MnhsIHJvdW5kZWQtWzJyZW1dIGJvcmRlciBib3JkZXItYmx1ZS0xMDAgYmctd2hpdGUgcC03IHRleHQtY2VudGVyIHNoYWRvdy14bCBzaGFkb3ctYmx1ZS05
NTAvOCBzbTpwLTEwIj4KICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMThlbV0gdGV4dC1b
IzEzNTlhNV0iPgogICAgICAgICAgUGVybWlzc8OjbyBuZWNlc3PDoXJpYQogICAgICAgIDwvcD4KICAgICAgICA8aDEgY2xhc3NOYW1lPSJtdC0zIHRleHQt
M3hsIGZvbnQtYmxhY2sgdHJhY2tpbmctWy0wLjA0ZW1dIj4KICAgICAgICAgIFNldSBwZXJmaWwgbsOjbyBwb2RlIGFjZXNzYXIge21vZHVsZUxhYmVsfS4K
ICAgICAgICA8L2gxPgogICAgICAgIDxwIGNsYXNzTmFtZT0ibXgtYXV0byBtdC00IG1heC13LXhsIGZvbnQtYm9sZCBsZWFkaW5nLTcgdGV4dC1zbGF0ZS01
MDAiPgogICAgICAgICAgUGXDp2EgYW8gZG9ubyBvdSBnZXJlbnRlIGRhIGVtcHJlc2EgcGFyYSByZXZpc2FyIHNldSBjYXJnbyBlIHBlcm1pc3PDtWVzLgog
ICAgICAgIDwvcD4KICAgICAgICA8TGluawogICAgICAgICAgaHJlZj0iL3BhaW5lbC9pbmljaW8iCiAgICAgICAgICBjbGFzc05hbWU9Im10LTYgaW5saW5l
LWZsZXggcm91bmRlZC0yeGwgYmctWyMwNTI0NWNdIHB4LTYgcHktNCBmb250LWJsYWNrIHRleHQtd2hpdGUiCiAgICAgICAgPgogICAgICAgICAgVm9sdGFy
IMOgIHZpc8OjbyBnZXJhbAogICAgICAgIDwvTGluaz4KICAgICAgPC9zZWN0aW9uPgogICAgPC9tYWluPgogICkKfQpgOwogICAgY29udGVudCA9IHJlcGxh
Y2VPbmNlVGV4dChjb250ZW50LCBtYXJrZXIsIGAke2Jsb2NrfSR7bWFya2VyfWAsICJsYXlvdXQgcGVybWlzc2FvIGJsb3F1ZWFkYSIpOwogIH0KCiAgaWYg
KCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBjdXJyZW50TW9kdWxlID0gZmluZFBhbmVsTW9kdWxlQnlQYXRoKHBhdGhuYW1lKSIpKSB7CiAgICBjb25zdCBv
bGQgPSBgICBpZiAocGF5bG9hZC5hc3NpbmF0dXJhX2F0aXZhICE9PSB0cnVlICYmIHBhdGhuYW1lICE9PSAnL3BhaW5lbC9hc3NpbmF0dXJhJykgewogICAg
cmV0dXJuIDxQYWluZWxCbG9xdWVhZG8gcGF5bG9hZD17cGF5bG9hZH0gLz4KICB9CgogIHJldHVybiAoCmA7CiAgICBjb25zdCBuZXUgPSBgICBpZiAocGF5
bG9hZC5hc3NpbmF0dXJhX2F0aXZhICE9PSB0cnVlICYmIHBhdGhuYW1lICE9PSAnL3BhaW5lbC9hc3NpbmF0dXJhJykgewogICAgcmV0dXJuIDxQYWluZWxC
bG9xdWVhZG8gcGF5bG9hZD17cGF5bG9hZH0gLz4KICB9CgogIGNvbnN0IGN1cnJlbnRNb2R1bGUgPSBmaW5kUGFuZWxNb2R1bGVCeVBhdGgocGF0aG5hbWUp
CiAgY29uc3QgY3VycmVudFBsYW4gPQogICAgcGF5bG9hZC5jb21wYW55LmFzc2luYXR1cmFfcGxhbm8gfHwgcGF5bG9hZC5jb21wYW55LnBsYW5vCgogIGlm
ICgKICAgIGN1cnJlbnRNb2R1bGUgJiYKICAgICFwYW5lbFBsYW5BbGxvd3MoY3VycmVudE1vZHVsZS5yZXF1aXJlZFBsYW4sIGN1cnJlbnRQbGFuKSAmJgog
ICAgcGF0aG5hbWUgIT09ICcvcGFpbmVsL2Fzc2luYXR1cmEnCiAgKSB7CiAgICByZXR1cm4gKAogICAgICA8UGFpbmVsUGxhbm9CbG9xdWVhZG8KICAgICAg
ICBtb2R1bGVMYWJlbD17Y3VycmVudE1vZHVsZS5sYWJlbH0KICAgICAgICByZXF1aXJlZFBsYW49e2N1cnJlbnRNb2R1bGUucmVxdWlyZWRQbGFufQogICAg
ICAvPgogICAgKQogIH0KCiAgaWYgKAogICAgY3VycmVudE1vZHVsZSAmJgogICAgIXBhbmVsUGVybWlzc2lvbkFsbG93cyhjdXJyZW50TW9kdWxlLCBwYXls
b2FkLnBlcm1pc3Npb25zKSAmJgogICAgcGF0aG5hbWUgIT09ICcvcGFpbmVsL2Fzc2luYXR1cmEnCiAgKSB7CiAgICByZXR1cm4gPFBhaW5lbFBlcm1pc3Nh
b0Jsb3F1ZWFkYSBtb2R1bGVMYWJlbD17Y3VycmVudE1vZHVsZS5sYWJlbH0gLz4KICB9CgogIHJldHVybiAoCmA7CiAgICBjb250ZW50ID0gcmVwbGFjZU9u
Y2VUZXh0KGNvbnRlbnQsIG9sZCwgbmV1LCAibGF5b3V0IHBsYW4gZ2F0ZSIpOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgovLyA0KSBDYXTDoWxvZ28g
Y2Fuw7RuaWNvIGRhIEFjYWRlbWlhIGNvbXBhcnRpbGhhZG8gZW50cmUgY2xpZW50ZSBlIHNlcnZpZG9yCnBhdGNoKCJjb21wb25lbnRzL3BhcmNlaXJvcy9Q
YXJ0bmVyQ291cnNlc1RhYi50c3giLCAoY29udGVudCkgPT4gewogIGlmIChjb250ZW50LmluY2x1ZGVzKCJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0
YWxvZyIpKSByZXR1cm4gY29udGVudDsKCiAgY29uc3QgdHlwZVN0YXJ0ID0gY29udGVudC5pbmRleE9mKCJ0eXBlIExlc3NvbiA9IHsiKTsKICBjb25zdCBz
dG9yYWdlU3RhcnQgPSBjb250ZW50LmluZGV4T2YoJ2NvbnN0IFNUT1JBR0VfS0VZID0gIm9yY2FseS1wYXJ0bmVyLWFjYWRlbXktdjIiOycpOwogIGNvbnN0
IGNvdXJzZVN0YXJ0ID0gY29udGVudC5pbmRleE9mKCJjb25zdCBjb3Vyc2VzOiBDb3Vyc2VbXSA9IFsiKTsKICBjb25zdCBmdW5jdGlvblN0YXJ0ID0gY29u
dGVudC5pbmRleE9mKCJcblxuZnVuY3Rpb24gYWxsTGVzc29uSWRzKGNvdXJzZTogQ291cnNlKSIpOwoKICBpZiAoW3R5cGVTdGFydCwgc3RvcmFnZVN0YXJ0
LCBjb3Vyc2VTdGFydCwgZnVuY3Rpb25TdGFydF0uc29tZSgodmFsdWUpID0+IHZhbHVlIDwgMCkpIHsKICAgIHRocm93IG5ldyBFcnJvcigiTsOjbyBmb2kg
cG9zc8OtdmVsIGxvY2FsaXphciBibG9jb3MgZGEgQWNhZGVtaWEgcGFyYSBleHRyYcOnw6NvIik7CiAgfQoKICBjb25zdCB0eXBlc0Jsb2NrID0gY29udGVu
dC5zbGljZSh0eXBlU3RhcnQsIHN0b3JhZ2VTdGFydCk7CiAgY29uc3QgY291cnNlQmxvY2sgPSBjb250ZW50LnNsaWNlKGNvdXJzZVN0YXJ0LCBmdW5jdGlv
blN0YXJ0KTsKICBjb25zdCBzaGFyZWQgPSBgJHt0eXBlc0Jsb2NrCiAgICAucmVwbGFjZSgidHlwZSBMZXNzb24gPSB7IiwgImV4cG9ydCB0eXBlIExlc3Nv
biA9IHsiKQogICAgLnJlcGxhY2UoInR5cGUgQ291cnNlID0geyIsICJleHBvcnQgdHlwZSBDb3Vyc2UgPSB7Iil9CiR7Y291cnNlQmxvY2sucmVwbGFjZSgi
Y29uc3QgY291cnNlczogQ291cnNlW10gPSIsICJleHBvcnQgY29uc3QgY291cnNlczogQ291cnNlW10gPSIpfQoKZXhwb3J0IGZ1bmN0aW9uIGdldENvdXJz
ZUJ5SWQoY291cnNlSWQ6IHN0cmluZykgewogIHJldHVybiBjb3Vyc2VzLmZpbmQoKGNvdXJzZSkgPT4gY291cnNlLmlkID09PSBjb3Vyc2VJZCkgfHwgbnVs
bDsKfQoKZXhwb3J0IGZ1bmN0aW9uIGdldENvdXJzZUxlc3Nvbklkcyhjb3Vyc2VJZDogc3RyaW5nKSB7CiAgcmV0dXJuIGdldENvdXJzZUJ5SWQoY291cnNl
SWQpPy5sZXNzb25zLm1hcCgobGVzc29uKSA9PiBsZXNzb24uaWQpIHx8IFtdOwp9CgpleHBvcnQgZnVuY3Rpb24gaXNWYWxpZENvdXJzZUxlc3Nvbihjb3Vy
c2VJZDogc3RyaW5nLCBsZXNzb25JZDogc3RyaW5nKSB7CiAgcmV0dXJuIGdldENvdXJzZUxlc3Nvbklkcyhjb3Vyc2VJZCkuaW5jbHVkZXMobGVzc29uSWQp
Owp9CmA7CiAgY3JlYXRlT3JSZXBsYWNlKCJsaWIvYWZmaWxpYXRlcy9hY2FkZW15LWNhdGFsb2cudHMiLCBzaGFyZWQpOwoKICBjb250ZW50ID0gY29udGVu
dC5zbGljZSgwLCB0eXBlU3RhcnQpICsgY29udGVudC5zbGljZShzdG9yYWdlU3RhcnQsIGNvdXJzZVN0YXJ0KSArIGNvbnRlbnQuc2xpY2UoZnVuY3Rpb25T
dGFydCk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBzdXBhYmFzZSB9IGZyb20gIkAvbGliL3N1cGFi
YXNlIjtcbicsCiAgICAnaW1wb3J0IHsgY291cnNlcywgdHlwZSBDb3Vyc2UgfSBmcm9tICJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyI7JywK
ICAgICJhY2FkZW15IHNoYXJlZCBpbXBvcnQiLAogICk7CgogIGNvbnN0IG9sZFJlbW90ZSA9IGAgICAgICAgICAgY29uc3QgcmVtb3RlSWRzID0gKHBheWxv
YWQuY291cnNlUHJvZ3Jlc3MgfHwgW10pCiAgICAgICAgICAgIC5tYXAoKHJvdykgPT4gU3RyaW5nKHJvdy5sZXNzb25faWQgfHwgIiIpKQogICAgICAgICAg
ICAuZmlsdGVyKEJvb2xlYW4pOwoKICAgICAgICAgIGlmIChyZW1vdGVJZHMubGVuZ3RoKSB7CiAgICAgICAgICAgIHNldENvbXBsZXRlZExlc3NvbnMoKGN1
cnJlbnQpID0+IHsKICAgICAgICAgICAgICByZXR1cm4gbmV3IFNldChbLi4uY3VycmVudCwgLi4ucmVtb3RlSWRzXSk7CiAgICAgICAgICAgIH0pOwogICAg
ICAgICAgfWA7CiAgY29uc3QgbmV3UmVtb3RlID0gYCAgICAgICAgICBjb25zdCByZW1vdGVJZHMgPSAocGF5bG9hZC5jb3Vyc2VQcm9ncmVzcyB8fCBbXSkK
ICAgICAgICAgICAgLm1hcCgocm93KSA9PiBTdHJpbmcocm93Lmxlc3Nvbl9pZCB8fCAiIikpCiAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbik7CgogICAg
ICAgICAgLy8gQXV0ZW50aWNhZG86IG8gc2Vydmlkb3Igw6kgYSBmb250ZSBkZSB2ZXJkYWRlLgogICAgICAgICAgc2V0Q29tcGxldGVkTGVzc29ucyhuZXcg
U2V0KHJlbW90ZUlkcykpO2A7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBvbGRSZW1vdGUsIG5ld1JlbW90ZSwgImFjYWRlbXkgcmVt
b3RlIHNvdXJjZSBvZiB0cnV0aCIpOwoKICByZXR1cm4gY29udGVudDsKfSk7CgovLyA1KSBDZW50cmFsIGRlIFBhcmNlaXJvczogdmFsaWRhw6fDtWVzIHNl
cnZlci1zaWRlIGUgWFAgaWRlbXBvdGVudGUKcGF0Y2goImxpYi9hZmZpbGlhdGVzL3dvcmtzcGFjZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9
IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJ9IGZyb20gXCJAL2xpYi9hZmZpbGlhdGVzL3NlcnZlclwiO1xuIiwKICAgICdpbXBvcnQgeyBn
ZXRDb3Vyc2VMZXNzb25JZHMsIGlzVmFsaWRDb3Vyc2VMZXNzb24gfSBmcm9tICJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyI7JywKICAgICJ3
b3Jrc3BhY2UgYWNhZGVteSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBnZXRD
b3Vyc2VMZXNzb25JZHMsIGlzVmFsaWRDb3Vyc2VMZXNzb24gfSBmcm9tICJAL2xpYi9hZmZpbGlhdGVzL2FjYWRlbXktY2F0YWxvZyI7XG4nLAogICAgJ2lt
cG9ydCB7IHBhcnRuZXJUcmFpbmVyU2NlbmFyaW9zIH0gZnJvbSAiQC9jb21wb25lbnRzL3BhcmNlaXJvcy9wYXJ0bmVyLWdyb3d0aC1jb250ZW50IjsnLAog
ICAgIndvcmtzcGFjZSB0cmFpbmVyIGltcG9ydCIsCiAgKTsKCiAgLy8gVmFsaWRhIHByb2dyZXNzbyBoaXN0w7NyaWNvIHRhbWLDqW0uCiAgaWYgKCFjb250
ZW50LmluY2x1ZGVzKCJjb25zdCB2YWxpZFByb2dyZXNzID0gcHJvZ3Jlc3MuZmlsdGVyIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAg
ICAgIGNvbnRlbnQsCiAgICAgIGBmdW5jdGlvbiBjZXJ0aWZpY2F0aW9uRWxpZ2liaWxpdHkoCiAgZXhhbTogQ2VydGlmaWNhdGlvbkV4YW0sCiAgcHJvZ3Jl
c3M6IEFycmF5PHsgY291cnNlX2lkPzogc3RyaW5nIHwgbnVsbDsgbGVzc29uX2lkPzogc3RyaW5nIHwgbnVsbCB9PiwKKSB7CiAgaWYgKGV4YW0ucHJlcmVx
dWlzaXRlLnR5cGUgPT09ICJsZXNzb25zIikgewogICAgcmV0dXJuIHByb2dyZXNzLmxlbmd0aCA+PSBleGFtLnByZXJlcXVpc2l0ZS5taW5pbXVtOwogIH0K
CiAgY29uc3QgYWxsb3dlZCA9IG5ldyBTZXQoZXhhbS5wcmVyZXF1aXNpdGUuY291cnNlSWRzIHx8IFtdKTsKICBjb25zdCBjb21wbGV0ZWQgPSBwcm9ncmVz
cy5maWx0ZXIoKHJvdykgPT4KICAgIGFsbG93ZWQuaGFzKFN0cmluZyhyb3cuY291cnNlX2lkIHx8ICIiKSksCiAgKS5sZW5ndGg7CmAsCiAgICAgIGBmdW5j
dGlvbiBjZXJ0aWZpY2F0aW9uRWxpZ2liaWxpdHkoCiAgZXhhbTogQ2VydGlmaWNhdGlvbkV4YW0sCiAgcHJvZ3Jlc3M6IEFycmF5PHsgY291cnNlX2lkPzog
c3RyaW5nIHwgbnVsbDsgbGVzc29uX2lkPzogc3RyaW5nIHwgbnVsbCB9PiwKKSB7CiAgY29uc3QgdmFsaWRQcm9ncmVzcyA9IHByb2dyZXNzLmZpbHRlcigo
cm93KSA9PgogICAgaXNWYWxpZENvdXJzZUxlc3NvbigKICAgICAgU3RyaW5nKHJvdy5jb3Vyc2VfaWQgfHwgIiIpLAogICAgICBTdHJpbmcocm93Lmxlc3Nv
bl9pZCB8fCAiIiksCiAgICApLAogICk7CgogIGlmIChleGFtLnByZXJlcXVpc2l0ZS50eXBlID09PSAibGVzc29ucyIpIHsKICAgIHJldHVybiB2YWxpZFBy
b2dyZXNzLmxlbmd0aCA+PSBleGFtLnByZXJlcXVpc2l0ZS5taW5pbXVtOwogIH0KCiAgY29uc3QgYWxsb3dlZCA9IG5ldyBTZXQoZXhhbS5wcmVyZXF1aXNp
dGUuY291cnNlSWRzIHx8IFtdKTsKICBjb25zdCBjb21wbGV0ZWQgPSB2YWxpZFByb2dyZXNzLmZpbHRlcigocm93KSA9PgogICAgYWxsb3dlZC5oYXMoU3Ry
aW5nKHJvdy5jb3Vyc2VfaWQgfHwgIiIpKSwKICApLmxlbmd0aDsKYCwKICAgICAgImNhbm9uaWNhbCBjZXJ0aWZpY2F0aW9uIHByb2dyZXNzIiwKICAgICk7
CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoInNvdXJjZUtleT86IHN0cmluZzsiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAg
ICAgY29udGVudCwKICAgICAgYCAgb3B0aW9uczogewogICAgbGVhZElkPzogc3RyaW5nIHwgbnVsbDsKICAgIG1ldGFkYXRhPzogSnNvblJlY29yZDsKICAg
IHhwPzogbnVtYmVyOwogIH0gPSB7fSwKKSB7YCwKICAgICAgYCAgb3B0aW9uczogewogICAgbGVhZElkPzogc3RyaW5nIHwgbnVsbDsKICAgIG1ldGFkYXRh
PzogSnNvblJlY29yZDsKICAgIHhwPzogbnVtYmVyOwogICAgc291cmNlS2V5Pzogc3RyaW5nOwogIH0gPSB7fSwKKSB7YCwKICAgICAgImluc2VydEV2ZW50
IHNvdXJjZUtleSBvcHRpb24iLAogICAgKTsKICB9CgogIGlmICghY29udGVudC5pbmNsdWRlcygnbWV0YWRhdGE6IGV2ZW50TWV0YWRhdGEnKSkgewogICAg
Y29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgY29uc3QgeyBlcnJvciB9ID0gYXdhaXQgYWRtaW4uZnJvbSgiYWZm
aWxpYXRlX2FjdGl2aXR5X2V2ZW50cyIpLmluc2VydCh7CiAgICBhZmZpbGlhdGVfaWQ6IGFmZmlsaWF0ZUlkLAogICAgbGVhZF9pZDogb3B0aW9ucy5sZWFk
SWQgfHwgbnVsbCwKICAgIGtpbmQsCiAgICB4cCwKICAgIG1ldGFkYXRhOiBvcHRpb25zLm1ldGFkYXRhIHx8IHt9LAogIH0pOwoKICBpZiAoZXJyb3IpIHRo
cm93IGVycm9yO2AsCiAgICAgIGAgIGNvbnN0IGV2ZW50TWV0YWRhdGEgPSB7CiAgICAuLi4ob3B0aW9ucy5tZXRhZGF0YSB8fCB7fSksCiAgICAuLi4ob3B0
aW9ucy5zb3VyY2VLZXkgPyB7IHNvdXJjZV9rZXk6IG9wdGlvbnMuc291cmNlS2V5IH0gOiB7fSksCiAgfTsKCiAgaWYgKG9wdGlvbnMuc291cmNlS2V5KSB7
CiAgICBjb25zdCB7IGRhdGE6IGV4aXN0aW5nLCBlcnJvcjogbG9va3VwRXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJhZmZpbGlhdGVfYWN0
aXZpdHlfZXZlbnRzIikKICAgICAgLnNlbGVjdCgiaWQiKQogICAgICAuZXEoImFmZmlsaWF0ZV9pZCIsIGFmZmlsaWF0ZUlkKQogICAgICAuZXEoIm1ldGFk
YXRhLT4+c291cmNlX2tleSIsIG9wdGlvbnMuc291cmNlS2V5KQogICAgICAubGltaXQoMSkKICAgICAgLm1heWJlU2luZ2xlKCk7CgogICAgaWYgKGxvb2t1
cEVycm9yKSB0aHJvdyBsb29rdXBFcnJvcjsKICAgIGlmIChleGlzdGluZz8uaWQpIHJldHVybjsKICB9CgogIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFk
bWluLmZyb20oImFmZmlsaWF0ZV9hY3Rpdml0eV9ldmVudHMiKS5pbnNlcnQoewogICAgYWZmaWxpYXRlX2lkOiBhZmZpbGlhdGVJZCwKICAgIGxlYWRfaWQ6
IG9wdGlvbnMubGVhZElkIHx8IG51bGwsCiAgICBraW5kLAogICAgeHAsCiAgICBtZXRhZGF0YTogZXZlbnRNZXRhZGF0YSwKICB9KTsKCiAgaWYgKGVycm9y
KSB7CiAgICBjb25zdCBtZXNzYWdlID0gU3RyaW5nKGVycm9yLm1lc3NhZ2UgfHwgIiIpLnRvTG93ZXJDYXNlKCk7CiAgICBpZiAob3B0aW9ucy5zb3VyY2VL
ZXkgJiYgKG1lc3NhZ2UuaW5jbHVkZXMoImR1cGxpY2F0ZSIpIHx8IG1lc3NhZ2UuaW5jbHVkZXMoInVuaXF1ZSIpKSkgewogICAgICByZXR1cm47CiAgICB9
CiAgICB0aHJvdyBlcnJvcjsKICB9YCwKICAgICAgImluc2VydEV2ZW50IGlkZW1wb3RlbmN5IiwKICAgICk7CiAgfQoKICAvLyBNYXNjYXJhIG5vbWVzIG5v
cyByYW5raW5ncy4KICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImZ1bmN0aW9uIGxlYWRlcmJvYXJkTmFtZSgiKSkgewogICAgY29uc3QgbWFya2VyID0gIlxu
YXN5bmMgZnVuY3Rpb24gYnVpbGRMZWFkZXJib2FyZHMoYWRtaW46IEFkbWluQ2xpZW50KSI7CiAgICBjb25zdCBoZWxwZXIgPSBgCmZ1bmN0aW9uIGxlYWRl
cmJvYXJkTmFtZSh2YWx1ZTogdW5rbm93bikgewogIGNvbnN0IHBhcnRzID0gY2xlYW5UZXh0KHZhbHVlLCAxMjApLnNwbGl0KC9cXHMrLykuZmlsdGVyKEJv
b2xlYW4pOwogIGlmICghcGFydHMubGVuZ3RoKSByZXR1cm4gIlBhcmNlaXJvIjsKICBpZiAocGFydHMubGVuZ3RoID09PSAxKSByZXR1cm4gcGFydHNbMF07
CiAgcmV0dXJuIFxgXCR7cGFydHNbMF19IFwke3BhcnRzWzFdWzBdIHx8ICIifSoqKlxgLnRyaW0oKTsKfQpgOwogICAgY29udGVudCA9IHJlcGxhY2VPbmNl
VGV4dChjb250ZW50LCBtYXJrZXIsIGAke2hlbHBlcn0ke21hcmtlcn1gLCAibGVhZGVyYm9hcmQgbWFzayBoZWxwZXIiKTsKICAgIGNvbnRlbnQgPSBjb250
ZW50LnJlcGxhY2UoCiAgICAgICdTdHJpbmcocm93Lm5hbWUgfHwgIlBhcmNlaXJvIiksJywKICAgICAgJ2xlYWRlcmJvYXJkTmFtZShyb3cubmFtZSksJywK
ICAgICk7CiAgfQoKICAvLyBMZWFkIGNyaWFkbzogWFAgdW1hIHZlei4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICBhd2FpdCBpbnNl
cnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJtYW51YWwiLCB7CiAgICAgIGxlYWRJZDogU3RyaW5nKGRhdGEuaWQpLAogICAgICBtZXRhZGF0YTogeyBl
dmVudDogImxlYWRfY3JlYXRlZCIgfSwKICAgICAgeHA6IDUsCiAgICB9KTtgLAogICAgYCAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRl
SWQsICJtYW51YWwiLCB7CiAgICAgIGxlYWRJZDogU3RyaW5nKGRhdGEuaWQpLAogICAgICBtZXRhZGF0YTogeyBldmVudDogImxlYWRfY3JlYXRlZCIgfSwK
ICAgICAgeHA6IDUsCiAgICAgIHNvdXJjZUtleTogXGBsZWFkOlwke2RhdGEuaWR9OmNyZWF0ZWRcYCwKICAgIH0pO2AsCiAgKTsKCiAgLy8gTWlsZXN0b25l
IGRvIGxlYWQ6IFhQIHVtYSB2ZXogcG9yIHN0YXR1cy4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgYXdhaXQgaW5zZXJ0RXZl
bnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCBraW5kLCB7CiAgICAgICAgICBsZWFkSWQsCiAgICAgICAgICBtZXRhZGF0YTogewogICAgICAgICAgICBmcm9tOiBj
dXJyZW50LnN0YXR1cywKICAgICAgICAgICAgdG86IHN0YXR1cywKICAgICAgICAgIH0sCiAgICAgICAgfSk7YCwKICAgIGAgICAgICAgIGF3YWl0IGluc2Vy
dEV2ZW50KGFkbWluLCBhZmZpbGlhdGVJZCwga2luZCwgewogICAgICAgICAgbGVhZElkLAogICAgICAgICAgbWV0YWRhdGE6IHsKICAgICAgICAgICAgZnJv
bTogY3VycmVudC5zdGF0dXMsCiAgICAgICAgICAgIHRvOiBzdGF0dXMsCiAgICAgICAgICB9LAogICAgICAgICAgc291cmNlS2V5OiBcYGxlYWQ6XCR7bGVh
ZElkfTpzdGF0dXM6XCR7a2luZH1cYCwKICAgICAgICB9KTtgLAogICk7CgogIC8vIFRhcmVmYTogWFAgdW1hIHZleiBwb3IgdGFyZWZhLgogIGNvbnRlbnQg
PSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgYXdhaXQgaW5zZXJ0RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAidGFzayIsIHsKICAgICAgICBsZWFk
SWQ6IGRhdGEubGVhZF9pZCA/IFN0cmluZyhkYXRhLmxlYWRfaWQpIDogbnVsbCwKICAgICAgICBtZXRhZGF0YTogeyB0YXNrSWQgfSwKICAgICAgfSk7YCwK
ICAgIGAgICAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJ0YXNrIiwgewogICAgICAgIGxlYWRJZDogZGF0YS5sZWFkX2lkID8g
U3RyaW5nKGRhdGEubGVhZF9pZCkgOiBudWxsLAogICAgICAgIG1ldGFkYXRhOiB7IHRhc2tJZCB9LAogICAgICAgIHNvdXJjZUtleTogXGB0YXNrOlwke3Rh
c2tJZH06Y29tcGxldGVkXGAsCiAgICAgIH0pO2AsCiAgKTsKCiAgLy8gQXRpdmlkYWRlcyBtYW51YWlzIGNvbnRhbSBwYXJhIG3DqXRyaWNhcywgbWFzIG7D
o28gZMOjbyBYUC4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgbWV0YWRhdGE6IHsKICAgICAgICAgIG5vdGU6IG9wdGlvbmFs
VGV4dChib2R5Lm5vdGUsIDUwMCksCiAgICAgICAgICBzb3VyY2U6ICJtYW51YWwiLAogICAgICAgIH0sCiAgICAgIH0sYCwKICAgIGAgICAgICAgIG1ldGFk
YXRhOiB7CiAgICAgICAgICBub3RlOiBvcHRpb25hbFRleHQoYm9keS5ub3RlLCA1MDApLAogICAgICAgICAgc291cmNlOiAibWFudWFsIiwKICAgICAgICB9
LAogICAgICAgIHhwOiAwLAogICAgICB9LGAsCiAgKTsKCiAgLy8gQ29tcGxldGUgbGVzc29uOiB2YWxpZGEgY2F0w6Fsb2dvLgogIGlmICghY29udGVudC5p
bmNsdWRlcygnaWYgKCFpc1ZhbGlkQ291cnNlTGVzc29uKGNvdXJzZUlkLCBsZXNzb25JZCkpJykpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQo
CiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgaWYgKCFjb3Vyc2VJZCB8fCAhbGVzc29uSWQpIHsKICAgICAgdGhyb3cgbmV3IEFmZmlsaWF0ZUVycm9yKCJB
dWxhIGludsOhbGlkYS4iKTsKICAgIH0KYCwKICAgICAgYCAgICBpZiAoIWNvdXJzZUlkIHx8ICFsZXNzb25JZCB8fCAhaXNWYWxpZENvdXJzZUxlc3Nvbihj
b3Vyc2VJZCwgbGVzc29uSWQpKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigiQXVsYSBpbnbDoWxpZGEuIik7CiAgICB9CmAsCiAgICAgICJj
b21wbGV0ZSBsZXNzb24gdmFsaWRhdGlvbiIsCiAgICApOwogIH0KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgIGF3YWl0IGluc2Vy
dEV2ZW50KGFkbWluLCBhZmZpbGlhdGVJZCwgImxlc3NvbiIsIHsKICAgICAgICBtZXRhZGF0YTogeyBjb3Vyc2VJZCwgbGVzc29uSWQgfSwKICAgICAgfSk7
YCwKICAgIGAgICAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJsZXNzb24iLCB7CiAgICAgICAgbWV0YWRhdGE6IHsgY291cnNl
SWQsIGxlc3NvbklkIH0sCiAgICAgICAgc291cmNlS2V5OiBcYGxlc3NvbjpcJHtjb3Vyc2VJZH06XCR7bGVzc29uSWR9XGAsCiAgICAgIH0pO2AsCiAgKTsK
CiAgLy8gVW5jb21wbGV0ZSBsZXNzb24gdGFtYsOpbSBzw7MgcGFyYSBhdWxhIGNvbmhlY2lkYS4KICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ2lmICghaXNW
YWxpZENvdXJzZUxlc3Nvbihjb3Vyc2VJZCwgbGVzc29uSWQpKSB7XG4gICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIkF1bGEgaW52w6FsaWRhLiIp
O1xuICAgIH1cblxuICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFkbWluXG4gICAgICAuZnJvbSgiYWZmaWxpYXRlX2NvdXJzZV9wcm9ncmVzcyIpXG4g
ICAgICAuZGVsZXRlKCknKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgICBjb25zdCBjb3Vyc2VJ
ZCA9IGNsZWFuVGV4dChib2R5LmNvdXJzZUlkLCA4MCk7CiAgICBjb25zdCBsZXNzb25JZCA9IGNsZWFuVGV4dChib2R5Lmxlc3NvbklkLCAxMjApOwoKICAg
IGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJhZmZpbGlhdGVfY291cnNlX3Byb2dyZXNzIikKICAgICAgLmRlbGV0ZSgpYCwK
ICAgICAgYCAgICBjb25zdCBjb3Vyc2VJZCA9IGNsZWFuVGV4dChib2R5LmNvdXJzZUlkLCA4MCk7CiAgICBjb25zdCBsZXNzb25JZCA9IGNsZWFuVGV4dChi
b2R5Lmxlc3NvbklkLCAxMjApOwoKICAgIGlmICghaXNWYWxpZENvdXJzZUxlc3Nvbihjb3Vyc2VJZCwgbGVzc29uSWQpKSB7CiAgICAgIHRocm93IG5ldyBB
ZmZpbGlhdGVFcnJvcigiQXVsYSBpbnbDoWxpZGEuIik7CiAgICB9CgogICAgY29uc3QgeyBlcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgICAgLmZyb20oImFm
ZmlsaWF0ZV9jb3Vyc2VfcHJvZ3Jlc3MiKQogICAgICAuZGVsZXRlKClgLAogICAgICAidW5jb21wbGV0ZSBsZXNzb24gdmFsaWRhdGlvbiIsCiAgICApOwog
IH0KCiAgLy8gV2hvbGUgY291cnNlOiBzZXJ2aWRvciBkZXJpdmEgSURzLgogIGNvbnRlbnQgPSByZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAg
IC8gIGlmIFwoYWN0aW9uID09PSAic2V0X2NvdXJzZV9sZXNzb25zIlwpIFx7XG4gICAgY29uc3QgY291cnNlSWQgPSBjbGVhblRleHRcKGJvZHlcLmNvdXJz
ZUlkLCA4MFwpO1xuICAgIGNvbnN0IGxlc3NvbklkcyA9IEFycmF5XC5pc0FycmF5XChib2R5XC5sZXNzb25JZHNcKVtcc1xTXSo/ICAgIGNvbnN0IGNvbXBs
ZXRlID0gYm9keVwuY29tcGxldGUgPT09IHRydWU7LywKICAgIGAgIGlmIChhY3Rpb24gPT09ICJzZXRfY291cnNlX2xlc3NvbnMiKSB7CiAgICBjb25zdCBj
b3Vyc2VJZCA9IGNsZWFuVGV4dChib2R5LmNvdXJzZUlkLCA4MCk7CiAgICBjb25zdCBsZXNzb25JZHMgPSBnZXRDb3Vyc2VMZXNzb25JZHMoY291cnNlSWQp
OwogICAgY29uc3QgY29tcGxldGUgPSBib2R5LmNvbXBsZXRlID09PSB0cnVlO2AsCiAgICAic2V0X2NvdXJzZV9sZXNzb25zIGNhbm9uaWNhbCBJRHMiLAog
ICk7CiAgLy8gc291cmNlS2V5IG5vIGxvb3AgZGUgd2hvbGUgY291cnNlLgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgICBhd2Fp
dCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJsZXNzb24iLCB7CiAgICAgICAgICBtZXRhZGF0YTogeyBjb3Vyc2VJZCwgbGVzc29uSWQgfSwK
ICAgICAgICB9KTtgLAogICAgYCAgICAgICAgYXdhaXQgaW5zZXJ0RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAibGVzc29uIiwgewogICAgICAgICAgbWV0
YWRhdGE6IHsgY291cnNlSWQsIGxlc3NvbklkIH0sCiAgICAgICAgICBzb3VyY2VLZXk6IFxgbGVzc29uOlwke2NvdXJzZUlkfTpcJHtsZXNzb25JZH1cYCwK
ICAgICAgICB9KTtgLAogICk7CgogIC8vIFRyZWluYW1lbnRvOiBjbGllbnRlIGVudmlhIHPDsyBjZW7DoXJpbyArIGVzY29saGE7IHNlcnZpZG9yIGNhbGN1
bGEgdHVkby4KICBjb250ZW50ID0gcmVwbGFjZU9uY2VSZWdleCgKICAgIGNvbnRlbnQsCiAgICAvICBpZiBcKGFjdGlvbiA9PT0gInNhdmVfdHJhaW5pbmci
XCkgXHtbXHNcU10qPyAgICByZXR1cm4gXHsgbWVzc2FnZTogIlRyZWluYW1lbnRvIHJlZ2lzdHJhZG9cLiIsIHRyYWluaW5nOiBkYXRhIFx9O1xuICBcfS8s
CiAgICBgICBpZiAoYWN0aW9uID09PSAic2F2ZV90cmFpbmluZyIpIHsKICAgIGNvbnN0IHNjZW5hcmlvSWQgPSBjbGVhblRleHQoYm9keS5zY2VuYXJpb0lk
LCAxMDApOwogICAgY29uc3QgY2hvaWNlSW5kZXggPSBjbGVhbkludGVnZXIoYm9keS5jaG9pY2VJbmRleCwgLTEsIC0xLCAxMDApOwogICAgY29uc3Qgc2Nl
bmFyaW8gPSBwYXJ0bmVyVHJhaW5lclNjZW5hcmlvcy5maW5kKAogICAgICAoaXRlbSkgPT4gaXRlbS5pZCA9PT0gc2NlbmFyaW9JZCwKICAgICk7CiAgICBj
b25zdCBvcHRpb24gPSBzY2VuYXJpbz8ub3B0aW9uc1tjaG9pY2VJbmRleF07CgogICAgaWYgKCFzY2VuYXJpbyB8fCAhb3B0aW9uKSB7CiAgICAgIHRocm93
IG5ldyBBZmZpbGlhdGVFcnJvcigiVHJlaW5hbWVudG8gaW52w6FsaWRvLiIpOwogICAgfQoKICAgIGNvbnN0IG1vZGUgPQogICAgICBzY2VuYXJpby5jYXRl
Z29yeSA9PT0gIkRlbW9uc3RyYcOnw6NvIgogICAgICAgID8gImRlbW8iCiAgICAgICAgOiBzY2VuYXJpby5jYXRlZ29yeSA9PT0gIk9iamXDp8O1ZXMiCiAg
ICAgICAgICA/ICJvYmplY3Rpb24iCiAgICAgICAgICA6ICJzYWxlcyI7CiAgICBjb25zdCB0b3RhbFNjb3JlID0gY2xlYW5OdW1iZXIob3B0aW9uLnNjb3Jl
LCAwLCAwLCAxMDApOwoKICAgIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJhZmZpbGlhdGVfdHJhaW5pbmdfc2Vz
c2lvbnMiKQogICAgICAuaW5zZXJ0KHsKICAgICAgICBhZmZpbGlhdGVfaWQ6IGFmZmlsaWF0ZUlkLAogICAgICAgIG1vZGUsCiAgICAgICAgc2NlbmFyaW9f
aWQ6IHNjZW5hcmlvLmlkLAogICAgICAgIGFuc3dlcjogb3B0aW9uLnRleHQsCiAgICAgICAgdG90YWxfc2NvcmU6IHRvdGFsU2NvcmUsCiAgICAgICAgc2Nv
cmVfanNvbjogb3B0aW9uLmRpbWVuc2lvbnMsCiAgICAgICAgZmVlZGJhY2s6IG9wdGlvbi5mZWVkYmFjaywKICAgICAgfSkKICAgICAgLnNlbGVjdCgiKiIp
CiAgICAgIC5zaW5nbGUoKTsKCiAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yOwoKICAgIGNvbnN0IHV0Y0RheSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmco
KS5zbGljZSgwLCAxMCk7CiAgICBhd2FpdCBpbnNlcnRFdmVudChhZG1pbiwgYWZmaWxpYXRlSWQsICJwcmFjdGljZSIsIHsKICAgICAgbWV0YWRhdGE6IHsK
ICAgICAgICBtb2RlLAogICAgICAgIHNjZW5hcmlvSWQ6IHNjZW5hcmlvLmlkLAogICAgICAgIHRvdGFsU2NvcmUsCiAgICAgIH0sCiAgICAgIHNvdXJjZUtl
eTogXGBwcmFjdGljZTpcJHtzY2VuYXJpby5pZH06XCR7dXRjRGF5fVxgLAogICAgfSk7CgogICAgcmV0dXJuIHsgbWVzc2FnZTogIlRyZWluYW1lbnRvIHJl
Z2lzdHJhZG8uIiwgdHJhaW5pbmc6IGRhdGEgfTsKICB9YCwKICAgICJzZXJ2ZXItYXV0aG9yaXRhdGl2ZSB0cmFpbmluZyIsCiAgKTsKCiAgLy8gQ2VydGlm
aWNhw6fDo286IHPDsyBhcHJvdmFkbyBkw6EgWFAsIHVtYSB2ZXouCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgYXdhaXQgaW5zZXJ0
RXZlbnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAicXVpeiIsIHsKICAgICAgbWV0YWRhdGE6IHsgZXhhbUlkLCBzY29yZSwgcGFzc2VkIH0sCiAgICAgIHhwOiBw
YXNzZWQgPyA4MCA6IDIwLAogICAgfSk7CgogICAgaWYgKHBhc3NlZCkge2AsCiAgICBgICAgIGlmIChwYXNzZWQpIHsKICAgICAgYXdhaXQgaW5zZXJ0RXZl
bnQoYWRtaW4sIGFmZmlsaWF0ZUlkLCAicXVpeiIsIHsKICAgICAgICBtZXRhZGF0YTogeyBleGFtSWQsIHNjb3JlLCBwYXNzZWQgfSwKICAgICAgICB4cDog
ODAsCiAgICAgICAgc291cmNlS2V5OiBcYGNlcnRpZmljYXRpb246XCR7ZXhhbUlkfTpwYXNzZWRcYCwKICAgICAgfSk7CmAsCiAgKTsKCiAgcmV0dXJuIGNv
bnRlbnQ7Cn0pOwoKcGF0Y2goImNvbXBvbmVudHMvcGFyY2Vpcm9zL1BhcnRuZXJHcm93dGhIdWIudHN4IiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0g
Y29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWVBdDoKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGVh
ZC5uZXh0X2ZvbGxvd191cF9hdCB8fAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgRGF0ZSgKICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgICBjdXJyZW50VGltZXN0YW1wICsgMjQgKiA2MCAqIDYwICogMTAwMCwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKS50b0lTT1N0cmluZygp
LGAsCiAgICBgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZUF0OgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZWFkLm5leHRfZm9sbG93
X3VwX2F0IHx8CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBEYXRlKAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERhdGUubm93
KCkgKyAyNCAqIDYwICogNjAgKiAxMDAwLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICApLnRvSVNPU3RyaW5nKCksYCwKICApOwoKICBjb250ZW50
ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgICAgICAgICAgICAgICAgICB2b2lkIHBvc3RBY3Rpb24oInNhdmVfdHJhaW5pbmciLCB7CiAgICAgICAg
ICAgICAgICAgICAgICAgIG1vZGU6CiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVHJhaW5lci5jYXRlZ29yeSA9PT0gIkRlbW9uc3RyYcOnw6Nv
IgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPyAiZGVtbyIKICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYWN0aXZlVHJhaW5lci5jYXRlZ29y
eSA9PT0gIk9iamXDp8O1ZXMiCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gIm9iamVjdGlvbiIKICAgICAgICAgICAgICAgICAgICAgICAgICAg
ICAgOiAic2FsZXMiLAogICAgICAgICAgICAgICAgICAgICAgICBzY2VuYXJpb0lkOiBhY3RpdmVUcmFpbmVyLmlkLAogICAgICAgICAgICAgICAgICAgICAg
ICBhbnN3ZXI6CiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVHJhaW5lci5vcHRpb25zW3RyYWluZXJDaG9pY2VdLnRleHQsCiAgICAgICAgICAg
ICAgICAgICAgICAgIHRvdGFsU2NvcmU6CiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVHJhaW5lci5vcHRpb25zW3RyYWluZXJDaG9pY2VdLnNj
b3JlLAogICAgICAgICAgICAgICAgICAgICAgICBzY29yZUpzb246CiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVHJhaW5lci5vcHRpb25zW3Ry
YWluZXJDaG9pY2VdLmRpbWVuc2lvbnMsCiAgICAgICAgICAgICAgICAgICAgICAgIGZlZWRiYWNrOgogICAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2
ZVRyYWluZXIub3B0aW9uc1t0cmFpbmVyQ2hvaWNlXS5mZWVkYmFjaywKICAgICAgICAgICAgICAgICAgICAgIH0pYCwKICAgIGAgICAgICAgICAgICAgICAg
ICAgICAgdm9pZCBwb3N0QWN0aW9uKCJzYXZlX3RyYWluaW5nIiwgewogICAgICAgICAgICAgICAgICAgICAgICBzY2VuYXJpb0lkOiBhY3RpdmVUcmFpbmVy
LmlkLAogICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2VJbmRleDogdHJhaW5lckNob2ljZSwKICAgICAgICAgICAgICAgICAgICAgIH0pYCwKICApOwog
IHJldHVybiBjb250ZW50Owp9KTsKCi8vIDYpIFBhcmNlaXJvczogQ1BGL0NOUEogcmVhbCArIGxpbWl0ZXMgSFRUUApwYXRjaCgibGliL2FmZmlsaWF0ZXMv
c2VydmVyLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB0eXBlIHsgTmV4
dFJlcXVlc3QgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IGRvY3VtZW50RGlnaXRzLCBpc1ZhbGlkQ3BmQ25waiB9IGZyb20gIkAv
bGliL2JyLWRvY3VtZW50IjsnLAogICAgImFmZmlsaWF0ZSBkb2N1bWVudCBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAg
ICBjb250ZW50LAogICAgL2Z1bmN0aW9uIHZhbGlkYXRlRG9jdW1lbnRcKHZhbHVlOiB1bmtub3duXCkgXHtbXHNcU10qP1xuXH0vLAogICAgYGZ1bmN0aW9u
IHZhbGlkYXRlRG9jdW1lbnQodmFsdWU6IHVua25vd24pIHsKICBjb25zdCBjbGVhbiA9IGRvY3VtZW50RGlnaXRzKHZhbHVlKTsKCiAgaWYgKCFpc1ZhbGlk
Q3BmQ25waihjbGVhbikpIHsKICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigiSW5mb3JtZSB1bSBDUEYgb3UgQ05QSiB2w6FsaWRvLiIpOwogIH0KCiAg
cmV0dXJuIGNsZWFuOwp9YCwKICAgICJhZmZpbGlhdGUgZG9jdW1lbnQgY2hlY2tzdW0iLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAg
ICBgICByZXR1cm4gbm9ybWFsaXplZCA9PT0gInByZW1pdW0iID8gInByZW1pdW0iIDogInByb2Zpc3Npb25hbCI7YCwKICAgIGAgIGlmIChub3JtYWxpemVk
ID09PSAicHJlbWl1bSIpIHJldHVybiAicHJlbWl1bSI7CiAgcmV0dXJuICJiYXNpY28iO2AsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVxdWVzdEFmZmlsaWF0ZVBheW91dChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGNvbnN0IHsgYWRtaW4s
IHByb2ZpbGUsIHVzZXIgfSA9IGF3YWl0IHJlcXVpcmVBZmZpbGlhdGUocmVxdWVzdCk7CiAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgYWRtaW4u
cnBjKGAsCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlcXVlc3RBZmZpbGlhdGVQYXlvdXQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICBjb25zdCB7
IGFkbWluLCBwcm9maWxlLCB1c2VyIH0gPSBhd2FpdCByZXF1aXJlQWZmaWxpYXRlKHJlcXVlc3QpOwogIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgcHJvZ3Jh
bVNldHRpbmdzKGFkbWluKTsKCiAgaWYgKCFCb29sZWFuKHNldHRpbmdzLnBheW91dHNfZW5hYmxlZCkpIHsKICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJv
cigiUGFnYW1lbnRvcyBkZSBwYXJjZWlyb3MgZXN0w6NvIHRlbXBvcmFyaWFtZW50ZSBpbmRpc3BvbsOtdmVpcy4iLCA1MDMpOwogIH0KCiAgY29uc3QgeyBk
YXRhLCBlcnJvciB9ID0gYXdhaXQgYWRtaW4ucnBjKGAsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGBpbXBvcnQgewogIEFzYWFz
UHJvdmlkZXIsCiAgdHlwZSBQaXhLZXlUeXBlLAp9IGZyb20gIkAvbGliL3BheW1lbnRzL3Byb3ZpZGVycy9hc2FhcyI7YCwKICAgIGBpbXBvcnQgewogIEFz
YWFzQXBpRXJyb3IsCiAgQXNhYXNQcm92aWRlciwKICB0eXBlIFBpeEtleVR5cGUsCn0gZnJvbSAiQC9saWIvcGF5bWVudHMvcHJvdmlkZXJzL2FzYWFzIjtg
LAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJh
ZmZpbGlhdGVfcGF5b3V0cyIpCiAgICAgIC51cGRhdGUoewogICAgICAgIHN0YXR1czogImFwcHJvdmVkIiwKICAgICAgICBhcHByb3ZlZF9hdDogbmV3IERh
dGUoKS50b0lTT1N0cmluZygpLAogICAgICAgIGFkbWluX25vdGU6IHRleHQoaW5wdXQubm90ZSkuc2xpY2UoMCwgNTAwKSB8fCBudWxsLAogICAgICB9KQog
ICAgICAuZXEoImlkIiwgcGF5b3V0SWQpCiAgICAgIC5lcSgic3RhdHVzIiwgInJlcXVlc3RlZCIpOwogICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtgLAog
ICAgYCAgICBjb25zdCB7IGRhdGE6IGFwcHJvdmVkUGF5b3V0LCBlcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRz
IikKICAgICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOiAiYXBwcm92ZWQiLAogICAgICAgIGFwcHJvdmVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5n
KCksCiAgICAgICAgYWRtaW5fbm90ZTogdGV4dChpbnB1dC5ub3RlKS5zbGljZSgwLCA1MDApIHx8IG51bGwsCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBw
YXlvdXRJZCkKICAgICAgLmVxKCJzdGF0dXMiLCAicmVxdWVzdGVkIikKICAgICAgLnNlbGVjdCgiaWQiKQogICAgICAubWF5YmVTaW5nbGUoKTsKICAgIGlm
IChlcnJvcikgdGhyb3cgZXJyb3I7CiAgICBpZiAoIWFwcHJvdmVkUGF5b3V0Py5pZCkgewogICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIlBhZ2Ft
ZW50byBuw6NvIGVzdMOhIG1haXMgYWd1YXJkYW5kbyBhcHJvdmHDp8Ojby4iLCA0MDkpOwogICAgfWAsCiAgKTsKCiAgaWYgKCFjb250ZW50LmluY2x1ZGVz
KCJQYWdhbWVudG8gasOhIGVzdMOhIHNlbmRvIHByb2Nlc3NhZG8gb3UgbsOjbyBmb2kgYXByb3ZhZG8uIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25j
ZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgY29uc3QgYWNjb3VudCA9IGF3YWl0IGdldFBheW91dEFjY291bnQoYWRtaW4sIHBheW91dC5hZmZp
bGlhdGVfaWQpOwogICAgaWYgKCFhY2NvdW50Py5pc192ZXJpZmllZCkgewogICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIkEgY29udGEgUGl4IGFp
bmRhIG7Do28gZm9pIHZlcmlmaWNhZGEuIiwgNDA5KTsKICAgIH0KCiAgICBhd2FpdCBhZG1pbgogICAgICAuZnJvbSgiYWZmaWxpYXRlX3BheW91dHMiKQog
ICAgICAudXBkYXRlKHsKICAgICAgICBzdGF0dXM6ICJwcm9jZXNzaW5nIiwKICAgICAgICBwcm92aWRlcjogImFzYWFzIiwKICAgICAgICBwcm9jZXNzaW5n
X2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBwYXlvdXQuaWQpO2AsCiAgICAgIGAgICAgY29uc3QgYWNj
b3VudCA9IGF3YWl0IGdldFBheW91dEFjY291bnQoYWRtaW4sIHBheW91dC5hZmZpbGlhdGVfaWQpOwogICAgaWYgKCFhY2NvdW50Py5pc192ZXJpZmllZCkg
ewogICAgICB0aHJvdyBuZXcgQWZmaWxpYXRlRXJyb3IoIkEgY29udGEgUGl4IGFpbmRhIG7Do28gZm9pIHZlcmlmaWNhZGEuIiwgNDA5KTsKICAgIH0KCiAg
ICBpZiAoU3RyaW5nKHBheW91dC5zdGF0dXMpICE9PSAiYXBwcm92ZWQiKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigKICAgICAgICAiTyBw
YWdhbWVudG8gcHJlY2lzYSBzZXIgYXByb3ZhZG8gYW50ZXMgZG8gZW52aW8uIiwKICAgICAgICA0MDksCiAgICAgICk7CiAgICB9CgogICAgY29uc3QgeyBk
YXRhOiBjbGFpbWVkUGF5b3V0LCBlcnJvcjogY2xhaW1FcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRzIikKICAg
ICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOiAicHJvY2Vzc2luZyIsCiAgICAgICAgcHJvdmlkZXI6ICJhc2FhcyIsCiAgICAgICAgcHJvY2Vzc2luZ19h
dDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgIGZhaWx1cmVfcmVhc29uOiBudWxsLAogICAgICB9KQogICAgICAuZXEoImlkIiwgcGF5b3V0
LmlkKQogICAgICAuZXEoInN0YXR1cyIsICJhcHByb3ZlZCIpCiAgICAgIC5zZWxlY3QoImlkIikKICAgICAgLm1heWJlU2luZ2xlKCk7CgogICAgaWYgKGNs
YWltRXJyb3IpIHRocm93IGNsYWltRXJyb3I7CiAgICBpZiAoIWNsYWltZWRQYXlvdXQ/LmlkKSB7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcigK
ICAgICAgICAiUGFnYW1lbnRvIGrDoSBlc3TDoSBzZW5kbyBwcm9jZXNzYWRvIG91IG7Do28gZm9pIGFwcm92YWRvLiIsCiAgICAgICAgNDA5LAogICAgICAp
OwogICAgfWAsCiAgICAgICJhZmZpbGlhdGUgcGF5b3V0IGF0b21pYyBjbGFpbSIsCiAgICApOwoKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAg
ICAgIGAuZXEoImlkIiwgcGF5b3V0SWQpCiAgICAgIC5pbigic3RhdHVzIiwgWyJyZXF1ZXN0ZWQiLCAiYXBwcm92ZWQiXSkKICAgICAgLm1heWJlU2luZ2xl
KCk7YCwKICAgICAgYC5lcSgiaWQiLCBwYXlvdXRJZCkKICAgICAgLmVxKCJzdGF0dXMiLCAiYXBwcm92ZWQiKQogICAgICAubWF5YmVTaW5nbGUoKTtgLAog
ICAgKTsKCiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAgIGNv
bnN0IHJlYXNvbiA9CiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAiRmFsaGEgbmEgdHJhbnNmZXLDqm5jaWEgUGl4
LiI7CiAgICAgIGF3YWl0IGFkbWluLnJwYygiZmFpbF9hZmZpbGlhdGVfcGF5b3V0X2FkbWluIiwgewogICAgICAgIHBfcGF5b3V0X2lkOiBwYXlvdXQuaWQs
CiAgICAgICAgcF9yZWFzb246IHJlYXNvbiwKICAgICAgfSk7CiAgICAgIHRocm93IG5ldyBBZmZpbGlhdGVFcnJvcihyZWFzb24sIDUwMik7CiAgICB9YCwK
ICAgICAgYCAgICB9IGNhdGNoIChlcnJvcikgewogICAgICBjb25zdCByZWFzb24gPQogICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5t
ZXNzYWdlIDogIkZhbGhhIG5hIHRyYW5zZmVyw6puY2lhIFBpeC4iOwoKICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQXNhYXNBcGlFcnJvciAmJiBlcnJv
ci5zdGF0dXMgPj0gNDAwICYmIGVycm9yLnN0YXR1cyA8IDUwMCkgewogICAgICAgIGF3YWl0IGFkbWluLnJwYygiZmFpbF9hZmZpbGlhdGVfcGF5b3V0X2Fk
bWluIiwgewogICAgICAgICAgcF9wYXlvdXRfaWQ6IHBheW91dC5pZCwKICAgICAgICAgIHBfcmVhc29uOiByZWFzb24sCiAgICAgICAgfSk7CiAgICAgIH0g
ZWxzZSB7CiAgICAgICAgYXdhaXQgYWRtaW4KICAgICAgICAgIC5mcm9tKCJhZmZpbGlhdGVfcGF5b3V0cyIpCiAgICAgICAgICAudXBkYXRlKHsKICAgICAg
ICAgICAgc3RhdHVzOiAicHJvY2Vzc2luZyIsCiAgICAgICAgICAgIGZhaWx1cmVfcmVhc29uOiAoCiAgICAgICAgICAgICAgIlJlc3VsdGFkbyBpbmNlcnRv
IG5vIHByb3ZlZG9yLiBOw6NvIHJlZW52aWFyIGF1dG9tYXRpY2FtZW50ZTogIiArIHJlYXNvbgogICAgICAgICAgICApLnNsaWNlKDAsIDUwMCksCiAgICAg
ICAgICB9KQogICAgICAgICAgLmVxKCJpZCIsIHBheW91dC5pZCkKICAgICAgICAgIC5lcSgic3RhdHVzIiwgInByb2Nlc3NpbmciKTsKICAgICAgfQoKICAg
ICAgdGhyb3cgbmV3IEFmZmlsaWF0ZUVycm9yKAogICAgICAgIGVycm9yIGluc3RhbmNlb2YgQXNhYXNBcGlFcnJvciAmJiBlcnJvci5zdGF0dXMgPj0gNDAw
ICYmIGVycm9yLnN0YXR1cyA8IDUwMAogICAgICAgICAgPyByZWFzb24KICAgICAgICAgIDogIk8gZW52aW8gZmljb3UgZW0gZXN0YWRvIGRlIGNvbmZpcm1h
w6fDo28uIE7Do28gcmVlbnZpZTsgYWd1YXJkZSBhIGNvbmNpbGlhw6fDo28gZG8gcHJvdmVkb3IuIiwKICAgICAgICA1MDIsCiAgICAgICk7CiAgICB9YCwK
ICAgICAgImFmZmlsaWF0ZSBwYXlvdXQgdW5jZXJ0YWluIHByb3ZpZGVyIHJlc3VsdCIsCiAgICApOwoKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQo
CiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIGNvbnN0IHsgZGF0YTogcGF5b3V0LCBlcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgIC5mcm9tKCJhZmZpbGlhdGVf
cGF5b3V0cyIpCiAgICAuc2VsZWN0KCIqIikKICAgIC5lcSgicHJvdmlkZXIiLCAiYXNhYXMiKQogICAgLmVxKCJwcm92aWRlcl90cmFuc2Zlcl9pZCIsIHRy
YW5zZmVySWQpCiAgICAubWF5YmVTaW5nbGUoKTsKCiAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjsKICBpZiAoIXBheW91dD8uaWQpIHJldHVybiBmYWxzZTtg
LAogICAgICBgICBsZXQgeyBkYXRhOiBwYXlvdXQsIGVycm9yIH0gPSBhd2FpdCBhZG1pbgogICAgLmZyb20oImFmZmlsaWF0ZV9wYXlvdXRzIikKICAgIC5z
ZWxlY3QoIioiKQogICAgLmVxKCJwcm92aWRlciIsICJhc2FhcyIpCiAgICAuZXEoInByb3ZpZGVyX3RyYW5zZmVyX2lkIiwgdHJhbnNmZXJJZCkKICAgIC5t
YXliZVNpbmdsZSgpOwoKICBpZiAoZXJyb3IpIHRocm93IGVycm9yOwoKICBjb25zdCBleHRlcm5hbFJlZmVyZW5jZSA9IHRleHQodHJhbnNmZXIuZXh0ZXJu
YWxSZWZlcmVuY2UpOwogIGlmICghcGF5b3V0Py5pZCAmJiBleHRlcm5hbFJlZmVyZW5jZSkgewogICAgY29uc3QgZmFsbGJhY2sgPSBhd2FpdCBhZG1pbgog
ICAgICAuZnJvbSgiYWZmaWxpYXRlX3BheW91dHMiKQogICAgICAuc2VsZWN0KCIqIikKICAgICAgLmVxKCJwcm92aWRlciIsICJhc2FhcyIpCiAgICAgIC5l
cSgiZXh0ZXJuYWxfcmVmZXJlbmNlIiwgZXh0ZXJuYWxSZWZlcmVuY2UpCiAgICAgIC5lcSgic3RhdHVzIiwgInByb2Nlc3NpbmciKQogICAgICAubWF5YmVT
aW5nbGUoKTsKCiAgICBpZiAoZmFsbGJhY2suZXJyb3IpIHRocm93IGZhbGxiYWNrLmVycm9yOwogICAgcGF5b3V0ID0gZmFsbGJhY2suZGF0YTsKCiAgICBp
ZiAocGF5b3V0Py5pZCAmJiAhcGF5b3V0LnByb3ZpZGVyX3RyYW5zZmVyX2lkKSB7CiAgICAgIGF3YWl0IGFkbWluCiAgICAgICAgLmZyb20oImFmZmlsaWF0
ZV9wYXlvdXRzIikKICAgICAgICAudXBkYXRlKHsgcHJvdmlkZXJfdHJhbnNmZXJfaWQ6IHRyYW5zZmVySWQgfSkKICAgICAgICAuZXEoImlkIiwgcGF5b3V0
LmlkKQogICAgICAgIC5lcSgic3RhdHVzIiwgInByb2Nlc3NpbmciKTsKICAgIH0KICB9CgogIGlmICghcGF5b3V0Py5pZCkgcmV0dXJuIGZhbHNlO2AsCiAg
ICAgICJhZmZpbGlhdGUgcGF5b3V0IHdlYmhvb2sgZmFsbGJhY2sgZXh0ZXJuYWwgcmVmZXJlbmNlIiwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9
KTsKCnBhdGNoKCJhcHAvYXBpL3BhcmNlaXJvcy9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29u
dGVudCwKICAgICdpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xuJywKICAgICdpbXBvcnQgeyBlbmZv
cmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7JywKICAgICJwYXJ0bmVyIHBvcnRhbCByYXRlIGltcG9ydCIsCiAgKTsK
ICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICJAL2xpYi9zZWN1
cml0eS9yYXRlLWxpbWl0IjtcbicsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9z
ZWN1cml0eS9yZXF1ZXN0IjsnLAogICAgInBhcnRuZXIgcG9ydGFsIGJvZHkgaW1wb3J0IiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ3Njb3Bl
OiAiYWZmaWxpYXRlLXBvcnRhbC1yZWFkIicpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9u
IEdFVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7YCwKICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxdWVzdDogTmV4dFJlcXVl
c3QpIHsKICB0cnkgewogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogImFmZmlsaWF0
ZS1wb3J0YWwtcmVhZCIsCiAgICAgIGxpbWl0OiAxMjAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJu
IGJsb2NrZWQ7YCwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoJ3Njb3BlOiAiYWZmaWxpYXRlLXBvcnRhbC13cml0ZSInKSkgewogICAg
Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5
IHsKICAgIGNvbnN0IGJvZHkgPSAoYXdhaXQgcmVxdWVzdC5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSkpIGFzIFJlY29yZDwKICAgICAgc3RyaW5nLAogICAg
ICB1bmtub3duCiAgICA+O2AsCiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBj
b25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNjb3BlOiAiYWZmaWxpYXRlLXBvcnRhbC13cml0ZSIsCiAg
ICAgIGxpbWl0OiAyMCwKICAgICAgd2luZG93U2Vjb25kczogNjAsCiAgICB9KTsKICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZDsKCiAgICBjb25z
dCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwKICAgICAgMTYgKiAxMDI0LAogICAg
KTtgLAogICAgKTsKICB9CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgcmV0dXJuIE5leHRS
ZXNwb25zZS5qc29uKGAsCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVy
cm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgKTsKCiAgcmV0dXJu
IGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvcGFyY2Vpcm9zL3dvcmtzcGFjZS9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFk
ZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xu
JywKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7JywKICAgICJ3b3Jrc3BhY2UgcmF0
ZSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0g
ZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNl
IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJ3b3Jrc3BhY2UgYm9keSBpbXBvcnQiLAogICk7CgogIGlmICghY29udGVudC5pbmNs
dWRlcygnc2NvcGU6ICJhZmZpbGlhdGUtd29ya3NwYWNlLXJlYWQiJykpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgIGBleHBvcnQg
YXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHtgLAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVChyZXF1
ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNj
b3BlOiAiYWZmaWxpYXRlLXdvcmtzcGFjZS1yZWFkIiwKICAgICAgbGltaXQ6IDEyMCwKICAgICAgd2luZG93U2Vjb25kczogNjAsCiAgICB9KTsKICAgIGlm
IChibG9ja2VkKSByZXR1cm4gYmxvY2tlZDtgLAogICAgKTsKICB9CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCdzY29wZTogImFmZmlsaWF0ZS13b3Jrc3Bh
Y2Utd3JpdGUiJykpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBO
ZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBib2R5ID0gKGF3YWl0IHJlcXVlc3QuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpKSBhcyBSZWNvcmQ8
CiAgICAgIHN0cmluZywKICAgICAgdW5rbm93bgogICAgPjtgLAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVl
c3QpIHsKICB0cnkgewogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogImFmZmlsaWF0
ZS13b3Jrc3BhY2Utd3JpdGUiLAogICAgICBsaW1pdDogNjAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0
dXJuIGJsb2NrZWQ7CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3Qs
CiAgICAgIDMyICogMTAyNCwKICAgICk7YCwKICAgICk7CiAgfQogIC8vIEFwbGljYSByZXNwb3N0YSA0MTMvNDAwIGRlIGJvZHkgbm9zIGRvaXMgY2F0Y2hl
cyBzZW0gcmVlc2NyZXZlciBtZW5zYWdlbnMuCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZUFsbCgKICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBy
ZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9y
UmVzcG9uc2UoZXJyb3IpOwogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcjsKCiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAp
OwogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBpL3BhcmNlaXJvcy9yZWdpc3Rlci9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29u
dGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9z
ZXJ2ZXIiO1xuJywKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7JywKICAgICJwYXJ0
bmVyIHJlZ2lzdGVyIHJhdGUgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgZW5m
b3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiO1xuJywKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RC
b2R5RXJyb3JSZXNwb25zZSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiOycsCiAgICAicGFydG5lciByZWdpc3RlciBib2R5IGltcG9ydCIsCiAg
KTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAg
dHJ5IHsKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtgLAogICAgYGV4cG9ydCBhc3luYyBmdW5jdGlv
biBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3Qs
IHsKICAgICAgc2NvcGU6ICJhZmZpbGlhdGUtcmVnaXN0ZXIiLAogICAgICBsaW1pdDogNSwKICAgICAgd2luZG93U2Vjb25kczogMzYwMCwKICAgIH0pOwog
ICAgaWYgKGJsb2NrZWQpIHJldHVybiBibG9ja2VkOwoKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93
bj4+KAogICAgICByZXF1ZXN0LAogICAgICAxNiAqIDEwMjQsCiAgICApO2AsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgfSBj
YXRjaCAoZXJyb3IpIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGNvbnN0IGJvZHlFcnJv
ciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7CiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yOwoKICAgIHJldHVybiBOZXh0
UmVzcG9uc2UuanNvbihgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvcGFyY2Vpcm9zL3RyYWNrL3JvdXRlLnRzIiwgKGNv
bnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9u
c2UgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yYXRlLWxp
bWl0IjsnLAogICAgInBhcnRuZXIgdHJhY2sgcmF0ZSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAg
ICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29u
Qm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJwYXJ0bmVyIHRyYWNrIGJvZHkg
aW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJl
cXVlc3QpIHsKICB0cnkgewogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcXVlc3QuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO2AsCiAgICBgZXhwb3J0IGFz
eW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGlt
aXQocmVxdWVzdCwgewogICAgICBzY29wZTogImFmZmlsaWF0ZS10cmFjayIsCiAgICAgIGxpbWl0OiAxMjAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAog
ICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5n
LCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3QsCiAgICAgIDggKiAxMDI0LAogICAgKTtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAg
IGAgIH0gY2F0Y2ggewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgdHJhY2tlZDogZmFsc2UgfSk7CiAgfWAsCiAgICBgICB9IGNhdGNoIChlcnJv
cikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5
RXJyb3I7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyB0cmFja2VkOiBmYWxzZSB9KTsKICB9YCwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsK
Ci8vIDcpIFNpZ251cCBww7pibGljbzogYnl0ZSBsaW1pdCwgcmF0ZSBsaW1pdCwgb3JpZ2VtLCBkYWRvcyBleHBsw61jaXRvcyBlIENQRi9DTlBKIHJlYWwK
cGF0Y2goImFwcC9hcGkvY2hlY2tvdXQvbGVhZC9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29u
dGVudCwKICAgICdpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tICJAc3VwYWJhc2Uvc3VwYWJhc2UtanMiO1xuJywKICAgICdpbXBvcnQgeyByZXF1aXJl
U2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2FseS1zZWN1cml0eSI7JywKICAgICJzaWdudXAgb3JpZ2luIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0g
YWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IHJlcXVpcmVTYW1lT3JpZ2luIH0gZnJvbSAiQC9saWIvb3JjYWx5LXNlY3VyaXR5
IjtcbicsCiAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiOycsCiAgICAic2lnbnVwIHJh
dGUgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgZW5mb3JjZVJhdGVMaW1pdCB9
IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiO1xuJywKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25z
ZSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiOycsCiAgICAic2lnbnVwIGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRB
ZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1
cml0eS9yZXF1ZXN0IjtcbicsCiAgICAnaW1wb3J0IHsgZG9jdW1lbnREaWdpdHMsIGlzVmFsaWRDcGZDbnBqIH0gZnJvbSAiQC9saWIvYnItZG9jdW1lbnQi
OycsCiAgICAic2lnbnVwIGRvYyBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBk
b2N1bWVudERpZ2l0cywgaXNWYWxpZENwZkNucGogfSBmcm9tICJAL2xpYi9ici1kb2N1bWVudCI7XG4nLAogICAgJ2ltcG9ydCB7IG5vcm1hbGl6ZVBsYW5L
ZXkgfSBmcm9tICJAL2xpYi9wbGFucy9wbGFuLWNvbmZpZyI7JywKICAgICJzaWdudXAgcGxhbiBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50
LnJlcGxhY2UoCiAgICBgZnVuY3Rpb24gZG9jdW1lbnRvTGltcG8odmFsb3I6IHVua25vd24pIHsKICByZXR1cm4gU3RyaW5nKHZhbG9yIHx8ICIiKS5yZXBs
YWNlKC9cXEQvZywgIiIpOwp9CgpgLAogICAgIiIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rp
b24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBpZiAoIXN1cGFiYXNlVXJsIHx8ICFzZXJ2aWNlUm9sZUtleSkge2AsCiAgICBg
ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3Qgb3JpZ2luRXJyb3IgPSByZXF1aXJl
U2FtZU9yaWdpbihyZXF1ZXN0KTsKICAgIGlmIChvcmlnaW5FcnJvcikgcmV0dXJuIG9yaWdpbkVycm9yOwoKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBl
bmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICJzaWdudXAtbGVhZCIsCiAgICAgIGxpbWl0OiA4LAogICAgICB3aW5kb3dTZWNvbmRz
OiAzNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7CgogICAgaWYgKCFzdXBhYmFzZVVybCB8fCAhc2VydmljZVJvbGVLZXkp
IHtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcXVlc3QuanNvbigpO2AsCiAgICBg
ICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICAzMiAqIDEw
MjQsCiAgICApO2AsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKCJjb25zdCBjcGZfY25waiA9IGRvY3VtZW50b0xpbXBvKCIsICJjb25zdCBj
cGZfY25waiA9IGRvY3VtZW50RGlnaXRzKCIpOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IHBsYW5vID0gU3RyaW5nKGJv
ZHkucGxhbm8gfHwgInByb2Zpc3Npb25hbCIpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO2AsCiAgICBgICAgIGNvbnN0IHBsYW5vID0gbm9ybWFsaXplUGxhbktl
eShib2R5LnBsYW5vIHx8ICJwcm9maXNzaW9uYWwiKTtgLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgaWYgKCFbMTEsIDE0
XS5pbmNsdWRlcyhjcGZfY25wai5sZW5ndGgpKSB7CiAgICAgIHJldHVybiBlcnJvKCJJbmZvcm1lIHVtIENQRiBvdSBDTlBKIHbDoWxpZG8uIik7CiAgICB9
YCwKICAgIGAgICAgaWYgKCFpc1ZhbGlkQ3BmQ25waihjcGZfY25waikpIHsKICAgICAgcmV0dXJuIGVycm8oIkluZm9ybWUgdW0gQ1BGIG91IENOUEogdsOh
bGlkby4iKTsKICAgIH1gLAogICk7CgogIC8vIE7Do28gcGVyc2lzdGUgcHJvcHJpZWRhZGVzIGFyYml0csOhcmlhcyBlbnZpYWRhcyBwZWxvIG5hdmVnYWRv
ci4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICBjb25zdCByYXdEYXRhID0gewogICAgICAuLi5ib2R5LAogICAgICBjcGZfY25waixg
LAogICAgYCAgICBjb25zdCByYXdEYXRhID0gewogICAgICBub21lX3Jlc3BvbnNhdmVsLAogICAgICBlbWFpbCwKICAgICAgd2hhdHNhcHAsCiAgICAgIGVt
cHJlc2Ffbm9tZSwKICAgICAgY2lkYWRlLAogICAgICBlc3RhZG8sCiAgICAgIHBsYW5vLAogICAgICBjcGZfY25waixgLAogICk7CgogIGNvbnRlbnQgPSBj
b250ZW50LnJlcGxhY2UoCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgcmV0dXJuIGVycm8oYCwKICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBj
b25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpOwogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcjsKCiAg
ICByZXR1cm4gZXJybyhgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8gRmluYWxpemHDp8OjbyBkYSBjb250YSBleGlnZSBvIG1lc21vIHRva2Vu
IEhNQUMgZG8gY2hlY2tvdXQgZSBsaW1pdGEgdGVudGF0aXZhcy4KcGF0Y2goImFwcC9hcGkvbGVhZHMvY29tcGxldGUtYWNjb3VudC9yb3V0ZS50cyIsIChj
b250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tICJA
c3VwYWJhc2Uvc3VwYWJhc2UtanMiO1xuJywKICAgICdpbXBvcnQgeyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2FseS1zZWN1cml0eSI7
JywKICAgICJjb21wbGV0ZSBhY2NvdW50IG9yaWdpbiBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAg
ICdpbXBvcnQgeyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2FseS1zZWN1cml0eSI7XG4nLAogICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRl
TGltaXQgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0IjsnLAogICAgImNvbXBsZXRlIGFjY291bnQgcmF0ZSBpbXBvcnQiLAogICk7CiAgY29u
dGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxpbWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkv
cmF0ZS1saW1pdCI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJp
dHkvcmVxdWVzdCI7JywKICAgICJjb21wbGV0ZSBhY2NvdW50IGJvZHkgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNv
bnRlbnQsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0
IjtcbicsCiAgICAnaW1wb3J0IHsgdmVyaWZ5U2lnbnVwQ2hlY2tvdXRUb2tlbiB9IGZyb20gIkAvbGliL3NpZ251cC1jaGVja291dCI7JywKICAgICJjb21w
bGV0ZSBhY2NvdW50IHRva2VuIGltcG9ydCIsCiAgKTsKCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJsZXQgY3JlYXRlZEF1dGhVc2VySWQ6IHN0cmluZyB8
IG51bGwgPSBudWxsOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVz
dDogTmV4dFJlcXVlc3QpIHsKICB0cnkge2AsCiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGxl
dCBjcmVhdGVkQXV0aFVzZXJJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7CiAgbGV0IGNyZWF0ZWRDb21wYW55SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsOwoK
ICB0cnkgewogICAgY29uc3Qgb3JpZ2luRXJyb3IgPSByZXF1aXJlU2FtZU9yaWdpbihyZXF1ZXN0KTsKICAgIGlmIChvcmlnaW5FcnJvcikgcmV0dXJuIG9y
aWdpbkVycm9yOwoKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICJjb21wbGV0ZS1z
aWdudXAtYWNjb3VudCIsCiAgICAgIGxpbWl0OiA4LAogICAgICB3aW5kb3dTZWNvbmRzOiAzNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJu
IGJsb2NrZWQ7YCwKICAgICk7CiAgfQoKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxdWVzdC5q
c29uKCk7CgogICAgY29uc3QgbGVhZElkID0gU3RyaW5nKGJvZHkubGVhZF9pZCB8fCAiIikudHJpbSgpOwogICAgY29uc3QgcGFzc3dvcmQgPSBTdHJpbmco
Ym9keS5wYXNzd29yZCB8fCAiIik7CiAgICBjb25zdCBjb25maXJtUGFzc3dvcmQgPSBTdHJpbmcoYm9keS5jb25maXJtX3Bhc3N3b3JkIHx8ICIiKTtgLAog
ICAgYCAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwKICAgICAgMTYg
KiAxMDI0LAogICAgKTsKCiAgICBjb25zdCBsZWFkSWQgPSBTdHJpbmcoYm9keS5sZWFkX2lkIHx8ICIiKS50cmltKCk7CiAgICBjb25zdCBwYXNzd29yZCA9
IFN0cmluZyhib2R5LnBhc3N3b3JkIHx8ICIiKTsKICAgIGNvbnN0IGNvbmZpcm1QYXNzd29yZCA9IFN0cmluZyhib2R5LmNvbmZpcm1fcGFzc3dvcmQgfHwg
IiIpOwogICAgY29uc3QgZXhwaXJlcyA9IE51bWJlcihib2R5LmV4cGlyZXMgfHwgMCk7CiAgICBjb25zdCBjaGVja291dFRva2VuID0gU3RyaW5nKGJvZHku
dG9rZW4gfHwgIiIpLnRyaW0oKTtgLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygnaWYgKCF2ZXJpZnlTaWdudXBDaGVja291dFRva2VuKGxlYWRJ
ZCwgZXhwaXJlcywgY2hlY2tvdXRUb2tlbikpJykpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAg
aWYgKCFsZWFkSWQpIHJldHVybiBlcnJvKCJDYWRhc3RybyBhdXNlbnRlLiIpOwogICAgaWYgKHBhc3N3b3JkLmxlbmd0aCA8IDgpIHsKICAgICAgcmV0dXJu
IGVycm8oIkEgc2VuaGEgcHJlY2lzYSB0ZXIgcGVsbyBtZW5vcyA4IGNhcmFjdGVyZXMuIik7CiAgICB9CiAgICBpZiAocGFzc3dvcmQgIT09IGNvbmZpcm1Q
YXNzd29yZCkge2AsCiAgICAgIGAgICAgaWYgKCFsZWFkSWQpIHJldHVybiBlcnJvKCJDYWRhc3RybyBhdXNlbnRlLiIpOwogICAgaWYgKCF2ZXJpZnlTaWdu
dXBDaGVja291dFRva2VuKGxlYWRJZCwgZXhwaXJlcywgY2hlY2tvdXRUb2tlbikpIHsKICAgICAgcmV0dXJuIGVycm8oIkVzdGUgbGluayBkZSBjcmlhw6fD
o28gZGUgY29udGEgw6kgaW52w6FsaWRvIG91IGV4cGlyb3UuIiwgNDAxKTsKICAgIH0KICAgIGlmIChwYXNzd29yZC5sZW5ndGggPCA4KSB7CiAgICAgIHJl
dHVybiBlcnJvKCJBIHNlbmhhIHByZWNpc2EgdGVyIHBlbG8gbWVub3MgOCBjYXJhY3RlcmVzLiIpOwogICAgfQogICAgaWYgKCEvW0EtWmEtel0vLnRlc3Qo
cGFzc3dvcmQpIHx8ICEvXFxkLy50ZXN0KHBhc3N3b3JkKSkgewogICAgICByZXR1cm4gZXJybygiVXNlIHBlbG8gbWVub3MgdW1hIGxldHJhIGUgdW0gbsO6
bWVybyBuYSBzZW5oYS4iKTsKICAgIH0KICAgIGlmIChwYXNzd29yZCAhPT0gY29uZmlybVBhc3N3b3JkKSB7YCwKICAgICAgImNvbXBsZXRlIGFjY291bnQg
dG9rZW4gdmFsaWRhdGlvbiIsCiAgICApOwogIH0KCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3QgdXNlcklkID0gYXV0aERh
dGEudXNlci5pZDsKCiAgICBsZXQgc2x1ZyA9YCwKICAgIGAgICAgY29uc3QgdXNlcklkID0gYXV0aERhdGEudXNlci5pZDsKICAgIGNyZWF0ZWRBdXRoVXNl
cklkID0gdXNlcklkOwoKICAgIGxldCBzbHVnID1gLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IGNvbXBhbnkg
PSBhd2FpdCBpbnNlcnRDb21wYW55KGNvbXBhbnlQYXlsb2FkKTsKCiAgICB0cnkge2AsCiAgICBgICAgIGNvbnN0IGNvbXBhbnkgPSBhd2FpdCBpbnNlcnRD
b21wYW55KGNvbXBhbnlQYXlsb2FkKTsKICAgIGNyZWF0ZWRDb21wYW55SWQgPSBTdHJpbmcoY29tcGFueS5pZCk7CgogICAgdHJ5IHtgLAogICk7CgogIGNv
bnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKGAsCiAgICBgICB9
IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5RXJyb3Ip
IHJldHVybiBib2R5RXJyb3I7CgogICAgbGV0IGF1dGhDbGVhbnVwQWxsb3dlZCA9IHRydWU7CgogICAgaWYgKGNyZWF0ZWRDb21wYW55SWQpIHsKICAgICAg
dHJ5IHsKICAgICAgICBjb25zdCBjbGVhbnVwQ29tcGFueSA9IGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgICAgIC5mcm9tKCJjb21wYW5pZXMiKQogICAg
ICAgICAgLmRlbGV0ZSgpCiAgICAgICAgICAuZXEoImlkIiwgY3JlYXRlZENvbXBhbnlJZCkKICAgICAgICAgIC5lcSgib3duZXJfaWQiLCBjcmVhdGVkQXV0
aFVzZXJJZCk7CgogICAgICAgIGlmIChjbGVhbnVwQ29tcGFueS5lcnJvcikgewogICAgICAgICAgYXV0aENsZWFudXBBbGxvd2VkID0gZmFsc2U7CiAgICAg
ICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgICAib3JjYWx5X3NpZ251cF9vcnBoYW5fY29tcGFueV9jbGVhbnVwX2Vycm9yIiwKICAgICAgICAgICAg
Y2xlYW51cENvbXBhbnkuZXJyb3IubWVzc2FnZSwKICAgICAgICAgICk7CiAgICAgICAgfQogICAgICB9IGNhdGNoIChjbGVhbnVwRXJyb3IpIHsKICAgICAg
ICBhdXRoQ2xlYW51cEFsbG93ZWQgPSBmYWxzZTsKICAgICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgIm9yY2FseV9zaWdudXBfb3JwaGFuX2NvbXBh
bnlfY2xlYW51cF9lcnJvciIsCiAgICAgICAgICBjbGVhbnVwRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGNsZWFudXBFcnJvci5tZXNzYWdlIDogY2xlYW51
cEVycm9yLAogICAgICAgICk7CiAgICAgIH0KICAgIH0KCiAgICBpZiAoY3JlYXRlZEF1dGhVc2VySWQgJiYgYXV0aENsZWFudXBBbGxvd2VkKSB7CiAgICAg
IHRyeSB7CiAgICAgICAgYXdhaXQgc3VwYWJhc2VBZG1pbi5hdXRoLmFkbWluLmRlbGV0ZVVzZXIoY3JlYXRlZEF1dGhVc2VySWQpOwogICAgICB9IGNhdGNo
IChjbGVhbnVwRXJyb3IpIHsKICAgICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgIm9yY2FseV9zaWdudXBfb3JwaGFuX3VzZXJfY2xlYW51cF9lcnJv
ciIsCiAgICAgICAgICBjbGVhbnVwRXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGNsZWFudXBFcnJvci5tZXNzYWdlIDogY2xlYW51cEVycm9yLAogICAgICAg
ICk7CiAgICAgIH0KICAgIH0KCiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiY29t
cG9uZW50cy9jaGVja291dC9TaWdudXBDaGVja291dC50c3giLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAg
ICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7CiAgICAgICAgICBsZWFkX2lkOiBsZWFkSWQsCiAgICAgICAgICBwYXNzd29yZCwKICAgICAgICAgIGNvbmZp
cm1fcGFzc3dvcmQ6IGNvbmZpcm1QYXNzd29yZCwKICAgICAgICB9KSxgLAogICAgYCAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoewogICAgICAgICAg
bGVhZF9pZDogbGVhZElkLAogICAgICAgICAgZXhwaXJlcywKICAgICAgICAgIHRva2VuLAogICAgICAgICAgcGFzc3dvcmQsCiAgICAgICAgICBjb25maXJt
X3Bhc3N3b3JkOiBjb25maXJtUGFzc3dvcmQsCiAgICAgICAgfSksYCwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIEVuZHBvaW50cyBkZSBwYWdh
bWVudG8gZG8gY2FkYXN0cm8gdGFtYsOpbSB1c2FtIGxpbWl0ZSByZWFsIGRlIGJ5dGVzIGUgcmF0ZSBsaW1pdC4KZm9yIChjb25zdCBzaWdudXBQYXltZW50
Um91dGUgb2YgWwogIHsKICAgIGZpbGU6ICJhcHAvYXBpL2NoZWNrb3V0L3NpZ251cC9waXgvcm91dGUudHMiLAogICAgc2NvcGU6ICJzaWdudXAtcGl4IiwK
ICAgIG1heEJ5dGVzOiAxMiAqIDEwMjQsCiAgfSwKICB7CiAgICBmaWxlOiAiYXBwL2FwaS9jaGVja291dC9zaWdudXAvY2FyZC9yb3V0ZS50cyIsCiAgICBz
Y29wZTogInNpZ251cC1jYXJkIiwKICAgIG1heEJ5dGVzOiAxNiAqIDEwMjQsCiAgfSwKXSkgewogIHBhdGNoKHNpZ251cFBheW1lbnRSb3V0ZS5maWxlLCAo
Y29udGVudCkgPT4gewogICAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5l
eHRSZXNwb25zZSB9IGZyb20gIm5leHQvc2VydmVyIjtcbicsCiAgICAgICdpbXBvcnQgeyByZXF1aXJlU2FtZU9yaWdpbiB9IGZyb20gIkAvbGliL29yY2Fs
eS1zZWN1cml0eSI7JywKICAgICAgYCR7c2lnbnVwUGF5bWVudFJvdXRlLmZpbGV9IG9yaWdpbmAsCiAgICApOwogICAgY29udGVudCA9IGFkZEltcG9ydEFm
dGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsgcmVxdWlyZVNhbWVPcmlnaW4gfSBmcm9tICJAL2xpYi9vcmNhbHktc2VjdXJpdHkiO1xuJywK
ICAgICAgJ2ltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0IjsnLAogICAgICBgJHtzaWdudXBQYXlt
ZW50Um91dGUuZmlsZX0gcmF0ZWAsCiAgICApOwogICAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgICBjb250ZW50LAogICAgICAnaW1wb3J0IHsg
ZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiO1xuJywKICAgICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVx
dWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICAgYCR7c2lnbnVwUGF5bWVudFJvdXRlLmZpbGV9
IGJvZHlgLAogICAgKTsKCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoYHNjb3BlOiAiJHtzaWdudXBQYXltZW50Um91dGUuc2NvcGV9ImApKSB7CiAgICAg
IGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAg
dHJ5IHsKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtgLAogICAgICAgIGBleHBvcnQgYXN5bmMgZnVu
Y3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBvcmlnaW5FcnJvciA9IHJlcXVpcmVTYW1lT3JpZ2luKHJlcXVl
c3QpOwogICAgaWYgKG9yaWdpbkVycm9yKSByZXR1cm4gb3JpZ2luRXJyb3I7CgogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IGVuZm9yY2VSYXRlTGltaXQo
cmVxdWVzdCwgewogICAgICBzY29wZTogIiR7c2lnbnVwUGF5bWVudFJvdXRlLnNjb3BlfSIsCiAgICAgIGxpbWl0OiAyMCwKICAgICAgd2luZG93U2Vjb25k
czogNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7CgogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxSZWNv
cmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3QsCiAgICAgICR7c2lnbnVwUGF5bWVudFJvdXRlLm1heEJ5dGVzfSwKICAgICk7YCwKICAgICAg
KTsKICAgIH0KCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7Iikp
IHsKICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgcmV0dXJuIE5leHRSZXNwb25zZS5q
c29uKGAsCiAgICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7
CiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yOwoKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgICApOwogICAgfQoKICAg
IHJldHVybiBjb250ZW50OwogIH0pOwp9CgovLyBHRVRzIGFzc2luYWRvcyBkbyBjaGVja291dCB0YW1iw6ltIHByb3RlZ2VtIGNvbnN1bHRhcyBhbyBwcm92
ZWRvci4KZm9yIChjb25zdCBzaWdudXBSZWFkUm91dGUgb2YgWwogIHsKICAgIGZpbGU6ICJhcHAvYXBpL2NoZWNrb3V0L3NpZ251cC9yb3V0ZS50cyIsCiAg
ICBzY29wZTogInNpZ251cC1jaGVja291dC1yZWFkIiwKICAgIGxpbWl0OiA2MCwKICB9LAogIHsKICAgIGZpbGU6ICJhcHAvYXBpL2NoZWNrb3V0L3NpZ251
cC9zdGF0dXMvcm91dGUudHMiLAogICAgc2NvcGU6ICJzaWdudXAtY2hlY2tvdXQtc3RhdHVzIiwKICAgIGxpbWl0OiAxODAsCiAgfSwKXSkgewogIHBhdGNo
KHNpZ251cFJlYWRSb3V0ZS5maWxlLCAoY29udGVudCkgPT4gewogICAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgICBjb250ZW50LAogICAgICAn
aW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gIm5leHQvc2VydmVyIjtcbicsCiAgICAgICdpbXBvcnQgeyBlbmZvcmNlUmF0ZUxp
bWl0IH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmF0ZS1saW1pdCI7JywKICAgICAgYCR7c2lnbnVwUmVhZFJvdXRlLmZpbGV9IHJhdGUgaW1wb3J0YCwKICAg
ICk7CgogICAgaWYgKCFjb250ZW50LmluY2x1ZGVzKGBzY29wZTogIiR7c2lnbnVwUmVhZFJvdXRlLnNjb3BlfSJgKSkgewogICAgICBjb250ZW50ID0gcmVw
bGFjZU9uY2VUZXh0KAogICAgICAgIGNvbnRlbnQsCiAgICAgICAgYCAgICBjb25zdCBleHBpcmVzID0gcmVxdWVzdC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5n
ZXQoImV4cGlyZXMiKTsKICAgIGNvbnN0IHRva2VuID0gcmVxdWVzdC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5nZXQoInRva2VuIik7CgogICAgcmV0dXJuIE5l
eHRSZXNwb25zZS5qc29uKGAsCiAgICAgICAgYCAgICBjb25zdCBleHBpcmVzID0gcmVxdWVzdC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5nZXQoImV4cGlyZXMi
KTsKICAgIGNvbnN0IHRva2VuID0gcmVxdWVzdC5uZXh0VXJsLnNlYXJjaFBhcmFtcy5nZXQoInRva2VuIik7CgogICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0
IGVuZm9yY2VSYXRlTGltaXQocmVxdWVzdCwgewogICAgICBzY29wZTogIiR7c2lnbnVwUmVhZFJvdXRlLnNjb3BlfSIsCiAgICAgIGlkZW50aXR5OiBsZWFk
SWQgfHwgdW5kZWZpbmVkLAogICAgICBsaW1pdDogJHtzaWdudXBSZWFkUm91dGUubGltaXR9LAogICAgICB3aW5kb3dTZWNvbmRzOiA2MDAsCiAgICB9KTsK
ICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZDsKCiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgICAgICBgJHtzaWdudXBSZWFkUm91
dGUuZmlsZX0gcmF0ZSBjYWxsYCwKICAgICAgKTsKICAgIH0KICAgIHJldHVybiBjb250ZW50OwogIH0pOwp9CgovLyA4KSBTbHVncyBjYW7DtG5pY29zIGUg
YWxpbmhhbWVudG8gZGUgcmVzZXJ2YWRvcwpwYXRjaCgibGliL3NsdWcudHMiLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiJ3Bh
cmNlaXJvcycsIikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoIiAgJ3BhaW5lbCcsXG4iLCAiICAncGFpbmVsJyxcbiAgJ3BhcmNlaXJvcycs
XG4iKTsKICB9CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJleHBvcnQgZnVuY3Rpb24gcGFyc2VDYW5vbmljYWxQdWJsaWNTbHVnIikpIHsKICAgIGNvbnN0
IG1hcmtlciA9ICJcbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZVN1YmRvbWFpblNsdWciOwogICAgY29uc3QgaGVscGVyID0gYApleHBvcnQgZnVuY3Rpb24g
cGFyc2VDYW5vbmljYWxQdWJsaWNTbHVnKHZhbHVlOiB1bmtub3duKSB7CiAgY29uc3QgcmF3ID0gU3RyaW5nKHZhbHVlIHx8ICcnKS50cmltKCkudG9Mb3dl
ckNhc2UoKQoKICBpZiAoCiAgICByYXcubGVuZ3RoIDwgMSB8fAogICAgcmF3Lmxlbmd0aCA+IDQyIHx8CiAgICAhL15bYS16MC05XSg/OlthLXowLTktXSpb
YS16MC05XSk/JC8udGVzdChyYXcpCiAgKSB7CiAgICByZXR1cm4gbnVsbAogIH0KCiAgcmV0dXJuIHJhdwp9CmA7CiAgICBjb250ZW50ID0gcmVwbGFjZU9u
Y2VUZXh0KGNvbnRlbnQsIG1hcmtlciwgYCR7aGVscGVyfSR7bWFya2VyfWAsICJjYW5vbmljYWwgcHVibGljIHNsdWcgaGVscGVyIik7CiAgfQogIHJldHVy
biBjb250ZW50Owp9KTsKCnBhdGNoKCJsaWIvb3JjYWx5LXNlY3VyaXR5LnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb25zdCByZXNlcnZlcyA9IFsiYXBwIiwg
ImRhc2hib2FyZCIsICJhc3NpbmF0dXJhIiwgInNpdGUiLCAibWFya2V0cGxhY2UiLCAicGFyY2Vpcm9zIiwgImhlbHAiLCAib3JjYWx5Il07CiAgZm9yIChj
b25zdCBpdGVtIG9mIHJlc2VydmVzKSB7CiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoYCAgJyR7aXRlbX0nLGApKSB7CiAgICAgIGNvbnRlbnQgPSBjb250
ZW50LnJlcGxhY2UoIiAgJ2FkbWluJyxcbiIsIGAgICdhZG1pbicsXG4gICcke2l0ZW19JyxcbmApOwogICAgfQogIH0KICByZXR1cm4gY29udGVudDsKfSk7
CgpwYXRjaCgibGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0LnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBj
b250ZW50LAogICAgJ2ltcG9ydCB0eXBlIHsgTmV4dFJlcXVlc3QgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IHBhcnNlQ2Fub25p
Y2FsUHVibGljU2x1ZyB9IGZyb20gIkAvbGliL3NsdWciOycsCiAgICAic2VydmVyLWNvbnRleHQgc2x1ZyBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGNv
bnRlbnQucmVwbGFjZSgKICAgIGAgIGNvbnN0IGNsZWFuID0gU3RyaW5nKHNsdWcgfHwgIiIpLnRyaW0oKS50b0xvd2VyQ2FzZSgpOwoKICBjb25zdCB7IGRh
dGE6IGNvbXBhbnksIGVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZWAsCiAgICBgICBjb25zdCBjbGVhbiA9IHBhcnNlQ2Fub25pY2FsUHVibGljU2x1ZyhzbHVn
KTsKCiAgaWYgKCFjbGVhbikgewogICAgdGhyb3cgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoIkVtcHJlc2EgaW52w6FsaWRhLiIpLCB7IHN0YXR1czogNDAw
IH0pOwogIH0KCiAgY29uc3QgeyBkYXRhOiBjb21wYW55LCBlcnJvciB9ID0gYXdhaXQgc3VwYWJhc2VgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoK
cGF0Y2goImFwcC9hcGkvcHVibGljLXNpdGUvW3NsdWddL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImFzc2lu
YXR1cmFfc3RhdHVzPzogc3RyaW5nIHwgbnVsbCIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICAiICBz
aXRlX2RlbGl2ZXJ5X29wdGlvbnM/OiB1bmtub3duXG59IiwKICAgICAgYCAgc2l0ZV9kZWxpdmVyeV9vcHRpb25zPzogdW5rbm93bgogIGFzc2luYXR1cmFf
c3RhdHVzPzogc3RyaW5nIHwgbnVsbAogIGFzc2luYXR1cmFfZXhwaXJhX2VtPzogc3RyaW5nIHwgbnVsbAogIHRyaWFsX3N0YXJ0ZWRfYXQ/OiBzdHJpbmcg
fCBudWxsCiAgdHJpYWxfZW5kc19hdD86IHN0cmluZyB8IG51bGwKICBjYW5jZWxfYXRfcGVyaW9kX2VuZD86IGJvb2xlYW4gfCBudWxsCiAgYWNjZXNzX3Vu
dGlsPzogc3RyaW5nIHwgbnVsbAp9YCwKICAgICAgInB1YmxpYyBjb21wYW55IHN1YnNjcmlwdGlvbiB0eXBlIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0g
YWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxp
bWl0J1xuIiwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcgfSBmcm9tICdAL2xpYi9zbHVnJyIsCiAgICAicHVibGljIHNpdGUgc2x1
ZyBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1Ymxp
Y1NsdWcgfSBmcm9tICdAL2xpYi9zbHVnJ1xuIiwKICAgICJpbXBvcnQgeyBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzIH0gZnJvbSAnQC9saWIvc3Vi
c2NyaXB0aW9uLWFjY2VzcyciLAogICAgInB1YmxpYyBzaXRlIHN1YnNjcmlwdGlvbiBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVy
KAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzIH0gZnJvbSAnQC9saWIvc3Vic2NyaXB0aW9uLWFjY2Vz
cydcbiIsCiAgICAiaW1wb3J0IHsgbm9ybWFsaXplUGxhbktleSB9IGZyb20gJ0AvbGliL3BsYW5zL3BsYW4tY29uZmlnJyIsCiAgICAicHVibGljIHNpdGUg
cGxhbiBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IHsgc2x1ZyB9ID0gYXdhaXQgY29udGV4dC5w
YXJhbXMKICAgIGNvbnN0IGNsZWFuU2x1ZyA9IFN0cmluZyhzbHVnIHx8ICcnKS50cmltKCkuc2xpY2UoMCwgODApCgogICAgaWYgKCFjbGVhblNsdWcpIHtg
LAogICAgYCAgICBjb25zdCB7IHNsdWcgfSA9IGF3YWl0IGNvbnRleHQucGFyYW1zCiAgICBjb25zdCBjbGVhblNsdWcgPSBwYXJzZUNhbm9uaWNhbFB1Ymxp
Y1NsdWcoc2x1ZykKCiAgICBpZiAoIWNsZWFuU2x1Zykge2AsCiAgKTsKCiAgY29uc3QgZmllbGRzQW5jaG9yID0gIiAgICAgICdhdGl2bycsXG4iOwogIGNv
bnN0IHN1YnNjcmlwdGlvbkZpZWxkcyA9IGAgICAgICAnYXNzaW5hdHVyYV9zdGF0dXMnLAogICAgICAnYXNzaW5hdHVyYV9wbGFubycsCiAgICAgICdwbGFu
bycsCiAgICAgICdhc3NpbmF0dXJhX2V4cGlyYV9lbScsCiAgICAgICd0cmlhbF9zdGFydGVkX2F0JywKICAgICAgJ3RyaWFsX2VuZHNfYXQnLAogICAgICAn
Y2FuY2VsX2F0X3BlcmlvZF9lbmQnLAogICAgICAnYWNjZXNzX3VudGlsJywKYDsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoIid0cmlhbF9lbmRzX2F0JyIp
KSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKGZpZWxkc0FuY2hvciwgYCR7c3Vic2NyaXB0aW9uRmllbGRzfSR7ZmllbGRzQW5jaG9yfWApOwog
IH0KCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBzdWJzY3JpcHRpb25BY2Nlc3MgPSBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzKGNvbXBh
bnkpIikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgaWYgKAogICAgICAhY29tcGFueSB8fAog
ICAgICBjb21wYW55LmF0aXZvID09PSBmYWxzZSB8fAogICAgICBjb21wYW55LnNpdGVfcHVibGljb19hdGl2byA9PT0gZmFsc2UKICAgICkgewogICAgICBy
ZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ1NpdGUgbmFvIGVuY29udHJhZG8uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDQg
fSwKICAgICAgKQogICAgfQoKICAgIGNvbnN0IHRlbXBsYXRlID1gLAogICAgICBgICAgIGlmICgKICAgICAgIWNvbXBhbnkgfHwKICAgICAgY29tcGFueS5h
dGl2byA9PT0gZmFsc2UgfHwKICAgICAgY29tcGFueS5zaXRlX3B1YmxpY29fYXRpdm8gPT09IGZhbHNlCiAgICApIHsKICAgICAgcmV0dXJuIE5leHRSZXNw
b25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdTaXRlIG5hbyBlbmNvbnRyYWRvLicgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAgICkKICAg
IH0KCiAgICBjb25zdCBzdWJzY3JpcHRpb25BY2Nlc3MgPSBnZXRDb21wYW55U3Vic2NyaXB0aW9uQWNjZXNzKGNvbXBhbnkpCiAgICBpZiAoIXN1YnNjcmlw
dGlvbkFjY2Vzcy5oYXNBY2Nlc3MpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdTaXRlIG5hbyBlbmNvbnRy
YWRvLicgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAgICkKICAgIH0KCiAgICBjb25zdCB0ZW1wbGF0ZSA9YCwKICAgICAgInB1YmxpYyBzaXRl
IHN1YnNjcmlwdGlvbiBnYXRlIiwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IG9ubGluZVBheW1lbnRzQWxsb3dlZCIpKSB7
CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgIGNvbnN0IHNldHRpbmcgPSBwYXltZW50U2V0dGluZ3NS
ZXN1bHQuZXJyb3IKICAgICAgPyBudWxsCiAgICAgIDogcGF5bWVudFNldHRpbmdzUmVzdWx0LmRhdGEKICAgIGNvbnN0IGNvbm5lY3RlZCA9IEJvb2xlYW4o
CiAgICAgIHNldHRpbmc/LmlzX2FjdGl2ZSA9PT0gdHJ1ZSAmJgogICAgICAgIHNldHRpbmc/Lm9uYm9hcmRpbmdfc3RhdHVzID09PSAnY29ubmVjdGVkJyAm
JgogICAgICAgIHNldHRpbmc/LnB1YmxpY19rZXksCiAgICApYCwKICAgICAgYCAgICBjb25zdCBzZXR0aW5nID0gcGF5bWVudFNldHRpbmdzUmVzdWx0LmVy
cm9yCiAgICAgID8gbnVsbAogICAgICA6IHBheW1lbnRTZXR0aW5nc1Jlc3VsdC5kYXRhCiAgICBjb25zdCBwdWJsaWNQbGFuID0gbm9ybWFsaXplUGxhbktl
eSgKICAgICAgY29tcGFueS5hc3NpbmF0dXJhX3BsYW5vIHx8IGNvbXBhbnkucGxhbm8sCiAgICApCiAgICBjb25zdCBvbmxpbmVQYXltZW50c0FsbG93ZWQg
PQogICAgICBwdWJsaWNQbGFuID09PSAncHJvZmlzc2lvbmFsJyB8fCBwdWJsaWNQbGFuID09PSAncHJlbWl1bScKICAgIGNvbnN0IGNvbm5lY3RlZCA9CiAg
ICAgIG9ubGluZVBheW1lbnRzQWxsb3dlZCAmJgogICAgICBCb29sZWFuKAogICAgICAgIHNldHRpbmc/LmlzX2FjdGl2ZSA9PT0gdHJ1ZSAmJgogICAgICAg
ICAgc2V0dGluZz8ub25ib2FyZGluZ19zdGF0dXMgPT09ICdjb25uZWN0ZWQnICYmCiAgICAgICAgICBzZXR0aW5nPy5wdWJsaWNfa2V5LAogICAgICApYCwK
ICAgICAgInB1YmxpYyBzaXRlIG9ubGluZSBwYXltZW50cyBwbGFuIGdhdGUiLAogICAgKTsKICB9CgogIC8vIE7Do28gcHVibGljYSBpdGVucyBleHBsaWNp
dGFtZW50ZSBpbmRpc3BvbsOtdmVpcy9pbmF0aXZvcy4KICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICBjb25zdCBwcm9kdWN0cyA9CiAg
ICAgIChyYXdQcm9kdWN0cyB8fCBbXSkgYXMgdW5rbm93biBhcyBQdWJsaWNQcm9kdWN0Um93W11gLAogICAgYCAgICBjb25zdCBwcm9kdWN0cyA9CiAgICAg
ICgocmF3UHJvZHVjdHMgfHwgW10pIGFzIHVua25vd24gYXMgUHVibGljUHJvZHVjdFJvd1tdKS5maWx0ZXIoCiAgICAgICAgKHByb2R1Y3QpID0+CiAgICAg
ICAgICBwcm9kdWN0LmF0aXZvICE9PSBmYWxzZSAmJgogICAgICAgICAgcHJvZHVjdC5pc19hY3RpdmUgIT09IGZhbHNlICYmCiAgICAgICAgICBwcm9kdWN0
LmF2YWlsYWJsZSAhPT0gZmFsc2UsCiAgICAgIClgLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvcHVibGljL3VwbG9hZHMv
YXJ0L3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGVuZm9y
Y2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcg
fSBmcm9tICdAL2xpYi9zbHVnJyIsCiAgICAiYXJ0IHNsdWcgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNv
bnN0IGZpbGUgPSBmb3JtLmdldCgnZmlsZScpCiAgICBjb25zdCBzbHVnID0gU3RyaW5nKGZvcm0uZ2V0KCdzbHVnJykgfHwgJycpLnRyaW0oKS5zbGljZSgw
LCA4MCkKCiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgRmlsZSkgfHwgIXNsdWcpIHtgLAogICAgYCAgICBjb25zdCBmaWxlID0gZm9ybS5nZXQoJ2ZpbGUn
KQogICAgY29uc3Qgc2x1ZyA9IHBhcnNlQ2Fub25pY2FsUHVibGljU2x1Zyhmb3JtLmdldCgnc2x1ZycpKQoKICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBG
aWxlKSB8fCAhc2x1Zykge2AsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgovLyA4LjEpIEFQSXMgZmluYW5jZWlyYXMgZSBJQSBpbnRlcm5hIHJlc3Bl
aXRhbSBjYXJnby9hc3NpbmF0dXJhLgpmb3IgKGNvbnN0IGZpbmFuY2VSb3V0ZSBvZiBbCiAgImFwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvc2V0dGlu
Z3Mvcm91dGUudHMiLAogICJhcHAvYXBpL21hcmtldHBsYWNlL3BheW1lbnRzL3NhbGVzL3JvdXRlLnRzIiwKXSkgewogIHBhdGNoKGZpbmFuY2VSb3V0ZSwg
KGNvbnRlbnQpID0+IHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICJpbXBvcnQgeyBnZXRDb21wYW55QWNjZXNzLCBnZXRSZXF1ZXN0
ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcyciLAogICAgICAiaW1wb3J0IHsgYXNzaW5hdHVyYUVzdGFBdGl2YSwg
Y29tcGFueVBsYW5BbGxvd3MsIGdldENvbXBhbnlBY2Nlc3MsIGdldFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1pbiB9IGZyb20gJ0AvbGliL2NvbXBhbnkt
YWNjZXNzJyIsCiAgICApOwoKICAgIGlmICghY29udGVudC5pbmNsdWRlcygiY29tcGFueVBsYW5BbGxvd3MoYWNjZXNzLmNvbXBhbnksICdwcm9maXNzaW9u
YWwnKSIpKSB7CiAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICAgYCAgICBpZiAoIWFjY2Vzcy5jb21wYW55Py5pZCkgcmV0dXJuIE5l
eHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28gZW5jb250cmFkYS4nIH0sIHsgc3RhdHVzOiA0MDQgfSkKYCwKICAgICAgICBgICAgIGlm
ICghYWNjZXNzLmNvbXBhbnk/LmlkKSByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogJ0VtcHJlc2EgbsOjbyBlbmNvbnRyYWRhLicgfSwgeyBz
dGF0dXM6IDQwNCB9KQogICAgaWYgKAogICAgICAhYXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkgfHwKICAgICAgIWNvbXBhbnlQbGFuQWxs
b3dzKGFjY2Vzcy5jb21wYW55LCAncHJvZmlzc2lvbmFsJykKICAgICkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJv
cjogJ1JlY3Vyc28gZGlzcG9uw612ZWwgYSBwYXJ0aXIgZG8gcGxhbm8gUHJvZmlzc2lvbmFsIGNvbSBhc3NpbmF0dXJhIGF0aXZhLicgfSwKICAgICAgICB7
IHN0YXR1czogNDAzIH0sCiAgICAgICkKICAgIH0KYCwKICAgICAgKTsKICAgIH0KCiAgICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImlmICghYWNjZXNzLmNh
bkZpbmFuY2UpIikpIHsKICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgICBgICAgIGlmICgKICAgICAgIWFzc2luYXR1cmFFc3RhQXRp
dmEoYWNjZXNzLmNvbXBhbnkpIHx8CiAgICAgICFjb21wYW55UGxhbkFsbG93cyhhY2Nlc3MuY29tcGFueSwgJ3Byb2Zpc3Npb25hbCcpCiAgICApIHsKICAg
ICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdSZWN1cnNvIGRpc3BvbsOtdmVsIGEgcGFydGlyIGRvIHBsYW5vIFByb2Zp
c3Npb25hbCBjb20gYXNzaW5hdHVyYSBhdGl2YS4nIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMyB9LAogICAgICApCiAgICB9CmAsCiAgICAgICAgYCAgICBp
ZiAoCiAgICAgICFhc3NpbmF0dXJhRXN0YUF0aXZhKGFjY2Vzcy5jb21wYW55KSB8fAogICAgICAhY29tcGFueVBsYW5BbGxvd3MoYWNjZXNzLmNvbXBhbnks
ICdwcm9maXNzaW9uYWwnKQogICAgKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAgICAgICB7IGVycm9yOiAnUmVjdXJzbyBkaXNwb27D
rXZlbCBhIHBhcnRpciBkbyBwbGFubyBQcm9maXNzaW9uYWwgY29tIGFzc2luYXR1cmEgYXRpdmEuJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAg
ICAgKQogICAgfQogICAgaWYgKCFhY2Nlc3MuY2FuRmluYW5jZSkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjog
J1NldSBwZXJmaWwgbsOjbyBwb3NzdWkgYWNlc3NvIGZpbmFuY2Vpcm8uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKQogICAgfQpgLAog
ICAgICApOwogICAgfQogICAgcmV0dXJuIGNvbnRlbnQ7CiAgfSk7Cn0KCgpmb3IgKGNvbnN0IGNybVJvdXRlIG9mIFsKICAiYXBwL2FwaS9jcm0vbGVhZHMv
cm91dGUudHMiLAogICJhcHAvYXBpL2NybS9sZWFkcy9baWRdL3JvdXRlLnRzIiwKXSkgewogIHBhdGNoKGNybVJvdXRlLCAoY29udGVudCkgPT4gewogICAg
Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgImltcG9ydCB7IGdldENvbXBhbnlBY2Nlc3MsIGdldFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1p
biB9IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgICAgICJpbXBvcnQgeyBhc3NpbmF0dXJhRXN0YUF0aXZhLCBjb21wYW55UGxhbkFsbG93cywg
Z2V0Q29tcGFueUFjY2VzcywgZ2V0UmVxdWVzdGVyLCBnZXRTdXBhYmFzZUFkbWluIH0gZnJvbSAnQC9saWIvY29tcGFueS1hY2Nlc3MnIiwKICAgICk7CiAg
ICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiKSkgewogICAgICBjb25zdCBmaXJzdEltcG9ydEVuZCA9IGNvbnRlbnQu
aW5kZXhPZigiXG4iLCBjb250ZW50LmluZGV4T2YoImZyb20gJ0AvbGliL29yY2FseS1hdWRpdCciKSk7CiAgICAgIGlmIChmaXJzdEltcG9ydEVuZCA8IDAp
IHRocm93IG5ldyBFcnJvcihgSW1wb3J0IGFuY2hvciBhdXNlbnRlIGVtICR7Y3JtUm91dGV9YCk7CiAgICAgIGNvbnRlbnQgPQogICAgICAgIGNvbnRlbnQu
c2xpY2UoMCwgZmlyc3RJbXBvcnRFbmQgKyAxKSArCiAgICAgICAgImltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0g
ZnJvbSAnQC9saWIvc2VjdXJpdHkvcmVxdWVzdCdcbiIgKwogICAgICAgIGNvbnRlbnQuc2xpY2UoZmlyc3RJbXBvcnRFbmQgKyAxKTsKICAgIH0KCiAgICBp
ZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbXBhbnlQbGFuQWxsb3dzKGNvbXBhbnlBY2Nlc3MuY29tcGFueSwgJ3Byb2Zpc3Npb25hbCcpIikpIHsKICAgICAg
Y29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgICBjb250ZW50LAogICAgICAgIGAgIGlmICghY29tcGFueUFjY2Vzcy5jb21wYW55Py5pZCkgewog
ICAgcmV0dXJuIHsgc3VwYWJhc2VBZG1pbiwgZXJyb3I6IE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28gZW5jb250cmFkYS4nIH0s
IHsgc3RhdHVzOiA0MDQgfSkgfQogIH0KCiAgcmV0dXJuIHsgc3VwYWJhc2VBZG1pbiwgcmVxdWVzdGVyLCBjb21wYW55QWNjZXNzIH1gLAogICAgICAgIGAg
IGlmICghY29tcGFueUFjY2Vzcy5jb21wYW55Py5pZCkgewogICAgcmV0dXJuIHsgc3VwYWJhc2VBZG1pbiwgZXJyb3I6IE5leHRSZXNwb25zZS5qc29uKHsg
ZXJyb3I6ICdFbXByZXNhIG7Do28gZW5jb250cmFkYS4nIH0sIHsgc3RhdHVzOiA0MDQgfSkgfQogIH0KCiAgaWYgKAogICAgIWFzc2luYXR1cmFFc3RhQXRp
dmEoY29tcGFueUFjY2Vzcy5jb21wYW55KSB8fAogICAgIWNvbXBhbnlQbGFuQWxsb3dzKGNvbXBhbnlBY2Nlc3MuY29tcGFueSwgJ3Byb2Zpc3Npb25hbCcp
CiAgKSB7CiAgICByZXR1cm4gewogICAgICBzdXBhYmFzZUFkbWluLAogICAgICBlcnJvcjogTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjog
J0NSTSBkaXNwb27DrXZlbCBhIHBhcnRpciBkbyBwbGFubyBQcm9maXNzaW9uYWwgY29tIGFzc2luYXR1cmEgYXRpdmEuJyB9LAogICAgICAgIHsgc3RhdHVz
OiA0MDMgfSwKICAgICAgKSwKICAgIH0KICB9CgogIGlmICghY29tcGFueUFjY2Vzcy5jYW5Qcm9wb3NhbCkgewogICAgcmV0dXJuIHsKICAgICAgc3VwYWJh
c2VBZG1pbiwKICAgICAgZXJyb3I6IE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdTZXUgcGVyZmlsIG7Do28gcG9zc3VpIGFjZXNzbyBh
byBDUk0uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKSwKICAgIH0KICB9CgogIHJldHVybiB7IHN1cGFiYXNlQWRtaW4sIHJlcXVlc3Rl
ciwgY29tcGFueUFjY2VzcyB9YCwKICAgICAgICBgY3JtIGFjY2VzcyBnYXRlICR7Y3JtUm91dGV9YCwKICAgICAgKTsKICAgIH0KCiAgICBjb250ZW50ID0g
Y29udGVudC5yZXBsYWNlKAogICAgICAiICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKSIsCiAgICAgICIgICAgY29uc3QgYm9keSA9IGF3
YWl0IHJlYWRKc29uQm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4ocmVxdWVzdCwgMjQgKiAxMDI0KSIsCiAgICApOwoKICAgIGNvbnRlbnQgPSBjb250
ZW50LnJlcGxhY2VBbGwoCiAgICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBtZXNzYWdlID1gLAogICAgICBgICB9IGNhdGNoIChlcnJvcikg
ewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJv
cgoKICAgIGNvbnN0IG1lc3NhZ2UgPWAsCiAgICApOwogICAgcmV0dXJuIGNvbnRlbnQ7CiAgfSk7Cn0KCnBhdGNoKCJhcHAvYXBpL2FpL29yY2FtZW50by9y
b3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICJpbXBvcnQgeyBnZXRDb21wYW55QWNjZXNzLCBnZXRS
ZXF1ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcyciLAogICAgImltcG9ydCB7IGFzc2luYXR1cmFFc3RhQXRp
dmEsIGdldENvbXBhbnlBY2Nlc3MsIGdldFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1pbiB9IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJyIsCiAgKTsK
ICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGFzc2luYXR1cmFFc3RhQXRpdmEsIGdldENvbXBhbnlBY2Nl
c3MsIGdldFJlcXVlc3RlciwgZ2V0U3VwYWJhc2VBZG1pbiB9IGZyb20gJ0AvbGliL2NvbXBhbnktYWNjZXNzJ1xuIiwKICAgICJpbXBvcnQgeyBub3JtYWxp
emVQbGFuS2V5IH0gZnJvbSAnQC9saWIvcGxhbnMvcGxhbi1jb25maWcnIiwKICAgICJvcmNhbWVudG8gQUkgcGxhbiBpbXBvcnQiLAogICk7CgogIGlmICgh
Y29udGVudC5pbmNsdWRlcygiaWYgKCFhc3NpbmF0dXJhRXN0YUF0aXZhKGFjY2Vzcy5jb21wYW55KSkiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNl
VGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgICBjb25zdCBhY2Nlc3MgPSBhd2FpdCBnZXRDb21wYW55QWNjZXNzKHN1cGFiYXNlQWRtaW4sIHJlcXVl
c3Rlci5pZCwgcmVxdWVzdGVyLmVtYWlsKQogICAgaWYgKCFhY2Nlc3MuY29tcGFueT8uaWQpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAn
RW1wcmVzYSBuw6NvIGVuY29udHJhZGEuJyB9LCB7IHN0YXR1czogNDA0IH0pCgogICAgY29uc3QgcGxhbiA9IFN0cmluZygKICAgICAgYWNjZXNzLmNvbXBh
bnkuYXNzaW5hdHVyYV9wbGFubyB8fAogICAgICAgIGFjY2Vzcy5jb21wYW55LnBsYW5vIHx8CiAgICAgICAgJ2Jhc2ljbycsCiAgICApLnRvTG93ZXJDYXNl
KClgLAogICAgICBgICAgIGNvbnN0IGFjY2VzcyA9IGF3YWl0IGdldENvbXBhbnlBY2Nlc3Moc3VwYWJhc2VBZG1pbiwgcmVxdWVzdGVyLmlkLCByZXF1ZXN0
ZXIuZW1haWwpCiAgICBpZiAoIWFjY2Vzcy5jb21wYW55Py5pZCkgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6ICdFbXByZXNhIG7Do28gZW5j
b250cmFkYS4nIH0sIHsgc3RhdHVzOiA0MDQgfSkKICAgIGlmICghYXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkpIHsKICAgICAgcmV0dXJu
IE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICdBc3NpbmF0dXJhIHNlbSBhY2Vzc28gYXRpdm8uJyB9LAogICAgICAgIHsgc3RhdHVzOiA0
MDMgfSwKICAgICAgKQogICAgfQoKICAgIGNvbnN0IHBsYW4gPSBub3JtYWxpemVQbGFuS2V5KAogICAgICBhY2Nlc3MuY29tcGFueS5hc3NpbmF0dXJhX3Bs
YW5vIHx8CiAgICAgICAgYWNjZXNzLmNvbXBhbnkucGxhbm8gfHwKICAgICAgICAnZXNzZW5jaWFsJywKICAgIClgLAogICAgICAib3JjYW1lbnRvIEFJIHN1
YnNjcmlwdGlvbiBwbGFuIiwKICAgICk7CiAgfQogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoImNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8
YW55PihyZXF1ZXN0LCAxNiAqIDEwMjQpIiwgImNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KHJlcXVl
c3QsIDE2ICogMTAyNCkiKTsKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9tYXJrZXRwbGFjZS9jb3Vwb24vcm91dGUudHMiLCAoY29u
dGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9k
eUVycm9yUmVzcG9uc2UgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yZXF1ZXN0J1xuIiwKICAgICJpbXBvcnQgeyBwYXJzZUNhbm9uaWNhbFB1YmxpY1NsdWcg
fSBmcm9tICdAL2xpYi9zbHVnJyIsCiAgICAiY291cG9uIHNsdWcgaW1wb3J0IiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiY29u
c3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxhbnk+KHJlcXVlc3QsIDY0ICogMTAyNCkiLAogICAgImNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJv
ZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KHJlcXVlc3QsIDY0ICogMTAyNCkiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIg
ICAgY29uc3Qgc2x1ZyA9IFN0cmluZyhib2R5LnNsdWcgfHwgJycpLnRyaW0oKSIsCiAgICAiICAgIGNvbnN0IHNsdWcgPSBwYXJzZUNhbm9uaWNhbFB1Ymxp
Y1NsdWcoYm9keS5zbHVnKSIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgovLyA4LjIpIE9BdXRoIE1lcmNhZG8gUGFnbzogY29uc3VtbyBhdG9taWNv
IGRlIHN0YXRlIGUgcHJvdGVjYW8gY29udHJhIHJlcGxheS4KcGF0Y2goImFwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvbWVyY2Fkby1wYWdvL2NhbGxi
YWNrL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImxldCB2YWxpZGF0ZWRDb21wYW55SWQ6IHN0cmluZyB8IG51
bGwgPSBudWxsOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVChyZXF1ZXN0OiBO
ZXh0UmVxdWVzdCkgewogIGNvbnN0IHN1cGFiYXNlQWRtaW4gPSBnZXRTdXBhYmFzZUFkbWluKCk7YCwKICAgICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBH
RVQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICBjb25zdCBzdXBhYmFzZUFkbWluID0gZ2V0U3VwYWJhc2VBZG1pbigpOwogIGxldCB2YWxpZGF0ZWRDb21w
YW55SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO2AsCiAgICApOwogIH0KCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCB7IGRhdGE6IGNsYWltZWRT
dGF0ZSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgIGlmICghb2F1dGhTdGF0ZT8uY29tcGFu
eV9pZCkgewogICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgIlN0YXRlIE9BdXRoIGludmFsaWRvLCBleHBpcmFkbyBvdSBqYSB1dGlsaXphZG8uIiwK
ICAgICAgKTsKICAgIH0KCiAgICBjb25zdCB0b2tlblBheWxvYWQgPSBhd2FpdCBleGNoYW5nZU1lcmNhZG9QYWdvQ29kZShgLAogICAgICBgICAgIGlmICgh
b2F1dGhTdGF0ZT8uY29tcGFueV9pZCkgewogICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgIlN0YXRlIE9BdXRoIGludmFsaWRvLCBleHBpcmFkbyBv
dSBqYSB1dGlsaXphZG8uIiwKICAgICAgKTsKICAgIH0KCiAgICBjb25zdCBjbGFpbWVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7CiAgICBjb25z
dCB7IGRhdGE6IGNsYWltZWRTdGF0ZSwgZXJyb3I6IGNsYWltRXJyb3IgfSA9CiAgICAgIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgICAuZnJvbSgibWFy
a2V0cGxhY2Vfb2F1dGhfc3RhdGVzIikKICAgICAgICAudXBkYXRlKHsgY29uc3VtZWRfYXQ6IGNsYWltZWRBdCB9KQogICAgICAgIC5lcSgiaWQiLCBvYXV0
aFN0YXRlLmlkKQogICAgICAgIC5pcygiY29uc3VtZWRfYXQiLCBudWxsKQogICAgICAgIC5ndCgiZXhwaXJlc19hdCIsIGNsYWltZWRBdCkKICAgICAgICAu
c2VsZWN0KCJpZCxjb21wYW55X2lkIikKICAgICAgICAubWF5YmVTaW5nbGUoKTsKCiAgICBpZiAoY2xhaW1FcnJvcikgdGhyb3cgY2xhaW1FcnJvcjsKICAg
IGlmICghY2xhaW1lZFN0YXRlPy5pZCB8fCAhY2xhaW1lZFN0YXRlLmNvbXBhbnlfaWQpIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgICJTdGF0
ZSBPQXV0aCBpbnZhbGlkbywgZXhwaXJhZG8gb3UgamEgdXRpbGl6YWRvLiIsCiAgICAgICk7CiAgICB9CgogICAgdmFsaWRhdGVkQ29tcGFueUlkID0gU3Ry
aW5nKGNsYWltZWRTdGF0ZS5jb21wYW55X2lkKTsKCiAgICBjb25zdCB0b2tlblBheWxvYWQgPSBhd2FpdCBleGNoYW5nZU1lcmNhZG9QYWdvQ29kZShgLAog
ICAgICAiYXRvbWljIG9hdXRoIHN0YXRlIGNsYWltIiwKICAgICk7CiAgfQoKICAvLyBVc2EgYXBlbmFzIGEgZW1wcmVzYSBkbyBzdGF0ZSBhdG9taWNhbGx5
IGNsYWltZWQuCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZUFsbCgib2F1dGhTdGF0ZS5jb21wYW55X2lkIiwgInZhbGlkYXRlZENvbXBhbnlJZCIpOwoK
ICAvLyBPIHN0YXRlIGphIGZvaSBjb25zdW1pZG8gYXRvbWljYW1lbnRlOyByZW1vdmUgbyB1cGRhdGUgdGFyZGlvLgogIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2UoCiAgICBgICAgIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgLmZyb20oIm1hcmtldHBsYWNlX29hdXRoX3N0YXRlcyIpCiAgICAgIC51cGRhdGUo
ewogICAgICAgIGNvbnN1bWVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBvYXV0aFN0YXRlLmlkKTsK
CmAsCiAgICAiIiwKICApOwoKICAvLyBDYXRjaCBudW5jYSBwZXNxdWlzYSB1bSBzdGF0ZSBhcmJpdHJhcmlvL3JldXRpbGl6YWRvLgogIGNvbnRlbnQgPSBy
ZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAgIC8gICAgaWYgXChzdGF0ZVwpIFx7W1xzXFNdKj8gICAgXH1cblxuICAgIHJldHVybiBOZXh0UmVz
cG9uc2VcLnJlZGlyZWN0XCgvLAogICAgYCAgICBpZiAodmFsaWRhdGVkQ29tcGFueUlkKSB7CiAgICAgIGF3YWl0IHN1cGFiYXNlQWRtaW4KICAgICAgICAu
ZnJvbSgibWFya2V0cGxhY2VfcGF5bWVudF9zZXR0aW5ncyIpCiAgICAgICAgLnVwc2VydCgKICAgICAgICAgIHsKICAgICAgICAgICAgY29tcGFueV9pZDog
dmFsaWRhdGVkQ29tcGFueUlkLAogICAgICAgICAgICBwcm92aWRlcjogIm1lcmNhZG9fcGFnbyIsCiAgICAgICAgICAgIG9uYm9hcmRpbmdfc3RhdHVzOiAi
ZXJyb3IiLAogICAgICAgICAgICBhY2NvdW50X3N0YXR1czogImVycm9yIiwKICAgICAgICAgICAgaXNfYWN0aXZlOiBmYWxzZSwKICAgICAgICAgICAgY2hh
cmdlc19lbmFibGVkOiBmYWxzZSwKICAgICAgICAgICAgcGl4X2VuYWJsZWQ6IGZhbHNlLAogICAgICAgICAgICBjYXJkX2VuYWJsZWQ6IGZhbHNlLAogICAg
ICAgICAgICBsYXN0X3N0YXR1c19jaGVja19hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgICAgICBsYXN0X2Vycm9yOiBtZXNzYWdlLnNs
aWNlKDAsIDUwMCksCiAgICAgICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICAgIH0sCiAgICAgICAgICB7IG9u
Q29uZmxpY3Q6ICJjb21wYW55X2lkLHByb3ZpZGVyIiB9LAogICAgICAgICk7CiAgICB9CgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5yZWRpcmVjdChgLAog
ICAgIm9hdXRoIGNhdGNoIG9ubHkgdmFsaWRhdGVkIHN0YXRlIiwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9tYXJrZXRw
bGFjZS9wYXltZW50cy9tZXJjYWRvLXBhZ28vY29ubmVjdC9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgK
ICAgIGAgIGdldENvbXBhbnlBY2Nlc3MsCiAgZ2V0UmVxdWVzdGVyLAogIGdldFN1cGFiYXNlQWRtaW4sYCwKICAgIGAgIGFzc2luYXR1cmFFc3RhQXRpdmEs
CiAgY29tcGFueVBsYW5BbGxvd3MsCiAgZ2V0Q29tcGFueUFjY2VzcywKICBnZXRSZXF1ZXN0ZXIsCiAgZ2V0U3VwYWJhc2VBZG1pbixgLAogICk7CiAgY29u
dGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICd9IGZyb20gIkAvbGliL2NvbXBhbnktYWNjZXNzIjtcbicsCiAgICAnaW1wb3J0IHsg
ZW5mb3JjZVJhdGVMaW1pdCB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQiOycsCiAgICAibXAgY29ubmVjdCByYXRlIGltcG9ydCIsCiAgKTsK
ICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImlmICghYXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkpIikpIHsKICAgIGNvbnRlbnQgPSByZXBs
YWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgaWYgKCFhY2Nlc3MuY29tcGFueT8uaWQpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25z
ZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICJFbXByZXNhIG5hbyBlbmNvbnRyYWRhLiIgfSwKICAgICAgICB7IHN0YXR1czogNDA0IH0sCiAgICAgICk7CiAg
ICB9CgogICAgaWYgKCFhY2Nlc3MuY2FuQ29uZmlnICYmICFhY2Nlc3MuY2FuRmluYW5jZSkge2AsCiAgICAgIGAgICAgaWYgKCFhY2Nlc3MuY29tcGFueT8u
aWQpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICAgIHsgZXJyb3I6ICJFbXByZXNhIG5hbyBlbmNvbnRyYWRhLiIgfSwKICAgICAg
ICB7IHN0YXR1czogNDA0IH0sCiAgICAgICk7CiAgICB9CgogICAgaWYgKAogICAgICAhYXNzaW5hdHVyYUVzdGFBdGl2YShhY2Nlc3MuY29tcGFueSkgfHwK
ICAgICAgIWNvbXBhbnlQbGFuQWxsb3dzKGFjY2Vzcy5jb21wYW55LCAicHJvZmlzc2lvbmFsIikKICAgICkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNl
Lmpzb24oCiAgICAgICAgeyBlcnJvcjogIlBhZ2FtZW50b3Mgb25saW5lIGV4aWdlbSBwbGFubyBQcm9maXNzaW9uYWwgb3UgUHJlbWl1bSBjb20gYXNzaW5h
dHVyYSBhdGl2YS4iIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMyB9LAogICAgICApOwogICAgfQoKICAgIGlmICghYWNjZXNzLmNhbkNvbmZpZyAmJiAhYWNj
ZXNzLmNhbkZpbmFuY2UpIHtgLAogICAgICAibXAgY29ubmVjdCBzdWJzY3JpcHRpb24gZ2F0ZSIsCiAgICApOwogIH0KICBpZiAoIWNvbnRlbnQuaW5jbHVk
ZXMoJ3Njb3BlOiAibWFya2V0cGxhY2UtbXAtY29ubmVjdCInKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAg
ICAgYCAgICBpZiAoIWFjY2Vzcy5jYW5Db25maWcgJiYgIWFjY2Vzcy5jYW5GaW5hbmNlKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAg
ICAgICB7CiAgICAgICAgICBlcnJvcjoKICAgICAgICAgICAgIlNlbSBwZXJtaXNzYW8gcGFyYSBjb25maWd1cmFyIHBhZ2FtZW50b3MuIiwKICAgICAgICB9
LAogICAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICAgKTsKICAgIH0KCiAgICBjb25zdCBvYXV0aCA9IGdlbmVyYXRlTWVyY2Fkb1BhZ29PYXV0aEZsb3co
KTtgLAogICAgICBgICAgIGlmICghYWNjZXNzLmNhbkNvbmZpZyAmJiAhYWNjZXNzLmNhbkZpbmFuY2UpIHsKICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5q
c29uKAogICAgICAgIHsKICAgICAgICAgIGVycm9yOgogICAgICAgICAgICAiU2VtIHBlcm1pc3NhbyBwYXJhIGNvbmZpZ3VyYXIgcGFnYW1lbnRvcy4iLAog
ICAgICAgIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMyB9LAogICAgICApOwogICAgfQoKICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxp
bWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICJtYXJrZXRwbGFjZS1tcC1jb25uZWN0IiwKICAgICAgaWRlbnRpdHk6IHJlcXVlc3Rlci5pZCwKICAgICAg
bGltaXQ6IDEwLAogICAgICB3aW5kb3dTZWNvbmRzOiAzNjAwLAogICAgfSk7CiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQ7CgogICAgY29uc3Qg
b2F1dGggPSBnZW5lcmF0ZU1lcmNhZG9QYWdvT2F1dGhGbG93KCk7YCwKICAgICAgIm1wIGNvbm5lY3QgcmF0ZSBsaW1pdCIsCiAgICApOwogIH0KICByZXR1
cm4gY29udGVudDsKfSk7CgovLyA5KSBTdG9yYWdlIGludGVybm86IFNWRyBuw6NvIHNhbml0aXphZG8gZGVpeGEgZGUgc2VyIGFjZWl0bwpwYXRjaCgibGli
L3BhbmVsLXN0b3JhZ2UudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgIG1pbWVUeXBlczogWydpbWFn
ZS9wbmcnLCAnaW1hZ2UvanBlZycsICdpbWFnZS9qcGcnLCAnaW1hZ2Uvd2VicCcsICdpbWFnZS9zdmcreG1sJ10sIiwKICAgICIgICAgbWltZVR5cGVzOiBb
J2ltYWdlL3BuZycsICdpbWFnZS9qcGVnJywgJ2ltYWdlL2pwZycsICdpbWFnZS93ZWJwJ10sIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2Uo
CiAgICAiICAgIGV4dGVuc2lvbnM6IFsncG5nJywgJ2pwZycsICdqcGVnJywgJ3dlYnAnLCAnc3ZnJ10sIiwKICAgICIgICAgZXh0ZW5zaW9uczogWydwbmcn
LCAnanBnJywgJ2pwZWcnLCAnd2VicCddLCIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgovLyAxMCkgTGltaXRlcyBkZSBjb3JwbyBjb21wYXJ0aWxo
YWRvcwpwYXRjaCgibGliL3NlY3VyaXR5L3JlcXVlc3QudHMiLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiZXhwb3J0IGFzeW5j
IGZ1bmN0aW9uIHJlYWRUZXh0Qm9keSIpKSB7CiAgICBjb25zdCBtYXJrZXIgPSAiXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZEpzb25Cb2R5IjsKICAg
IGNvbnN0IGhlbHBlciA9IGAKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRUZXh0Qm9keSgKICByZXF1ZXN0OiBOZXh0UmVxdWVzdCwKICBtYXhCeXRlczog
bnVtYmVyLAopOiBQcm9taXNlPHN0cmluZz4gewogIGNvbnN0IGRlY2xhcmVkID0gTnVtYmVyKHJlcXVlc3QuaGVhZGVycy5nZXQoJ2NvbnRlbnQtbGVuZ3Ro
JykgfHwgMCkKCiAgaWYgKGRlY2xhcmVkID4gbWF4Qnl0ZXMpIHsKICAgIHRocm93IG5ldyBSZXF1ZXN0Qm9keUVycm9yKCdSZXF1aXNpY2FvIG11aXRvIGdy
YW5kZS4nLCA0MTMpCiAgfQoKICBjb25zdCBidWZmZXIgPSBhd2FpdCByZXF1ZXN0LmFycmF5QnVmZmVyKCkKCiAgaWYgKGJ1ZmZlci5ieXRlTGVuZ3RoID4g
bWF4Qnl0ZXMpIHsKICAgIHRocm93IG5ldyBSZXF1ZXN0Qm9keUVycm9yKCdSZXF1aXNpY2FvIG11aXRvIGdyYW5kZS4nLCA0MTMpCiAgfQoKICByZXR1cm4g
bmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGJ1ZmZlcikKfQpgOwogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBtYXJrZXIsIGAke2hl
bHBlcn0ke21hcmtlcn1gLCAicmVhZFRleHRCb2R5Iik7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICBjb25zdCBkZWNsYXJlZCA9
IE51bWJlcihyZXF1ZXN0LmhlYWRlcnMuZ2V0KCdjb250ZW50LWxlbmd0aCcpIHx8IDApCgogIGlmIChkZWNsYXJlZCA+IG1heEJ5dGVzKSB7CiAgICB0aHJv
dyBuZXcgUmVxdWVzdEJvZHlFcnJvcignUmVxdWlzaWNhbyBtdWl0byBncmFuZGUuJywgNDEzKQogIH0KCiAgY29uc3QgYnVmZmVyID0gYXdhaXQgcmVxdWVz
dC5hcnJheUJ1ZmZlcigpCgogIGlmIChidWZmZXIuYnl0ZUxlbmd0aCA+IG1heEJ5dGVzKSB7CiAgICB0aHJvdyBuZXcgUmVxdWVzdEJvZHlFcnJvcignUmVx
dWlzaWNhbyBtdWl0byBncmFuZGUuJywgNDEzKQogIH0KCiAgdHJ5IHsKICAgIHJldHVybiBKU09OLnBhcnNlKG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShi
dWZmZXIpIHx8ICd7fScpIGFzIFRgLAogICAgICBgICBjb25zdCByYXcgPSBhd2FpdCByZWFkVGV4dEJvZHkocmVxdWVzdCwgbWF4Qnl0ZXMpCgogIHRyeSB7
CiAgICByZXR1cm4gSlNPTi5wYXJzZShyYXcgfHwgJ3t9JykgYXMgVGAsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgovLyBIb21lIEFJOiBz
ZSByYXRlIGxpbWl0IGNhaXIsIHVzYSByZXNwb3N0YSBndWlhZGEgc2VtIGdhc3RhciBtb2RlbG8uCnBhdGNoKCJhcHAvYXBpL3B1YmxpYy9ob21lLWNoYXQv
cm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0IHsgZW5mb3JjZVJh
dGVMaW1pdCB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQnXG4iLAogICAgImltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJv
clJlc3BvbnNlIH0gZnJvbSAnQC9saWIvc2VjdXJpdHkvcmVxdWVzdCciLAogICAgImhvbWUgQUkgYm9keSBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBy
ZXBsYWNlT25jZVJlZ2V4KAogICAgY29udGVudCwKICAgIC9leHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVFwocmVxdWVzdDogTmV4dFJlcXVlc3RcKSBce1tc
c1xTXSpcblx9XHMqJC8sCiAgICBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkgewogICAgY29uc3Qg
Ym9keSA9IGF3YWl0IHJlYWRKc29uQm9keTx7CiAgICAgIHF1ZXN0aW9uPzogdW5rbm93bgogICAgICBtZXNzYWdlcz86IHVua25vd24KICAgIH0+KHJlcXVl
c3QsIDIwICogMTAyNCkKICAgIGNvbnN0IHF1ZXN0aW9uID0gY2xlYW5UZXh0KGJvZHkucXVlc3Rpb24sIDcwMCkKICAgIGNvbnN0IG1lc3NhZ2VzID0gbm9y
bWFsaXplTWVzc2FnZXMoYm9keS5tZXNzYWdlcykKCiAgICBpZiAocXVlc3Rpb24ubGVuZ3RoIDwgMikgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpz
b24oCiAgICAgICAgeyBlcnJvcjogJ0RpZ2l0ZSB1bWEgcGVyZ3VudGEuJyB9LAogICAgICAgIHsgc3RhdHVzOiA0MDAgfSwKICAgICAgKQogICAgfQoKICAg
IGNvbnN0IGxpbWl0ZWQgPSBhd2FpdCBlbmZvcmNlUmF0ZUxpbWl0KHJlcXVlc3QsIHsKICAgICAgc2NvcGU6ICdwdWJsaWMtaG9tZS1haS1jaGF0LXYyJywK
ICAgICAgbGltaXQ6IDI0LAogICAgICB3aW5kb3dTZWNvbmRzOiA2MDAsCiAgICB9KQoKICAgIGlmIChsaW1pdGVkKSB7CiAgICAgIGlmIChsaW1pdGVkLnN0
YXR1cyA9PT0gNDI5KSByZXR1cm4gbGltaXRlZAoKICAgICAgY29uc3QgZmFsbGJhY2sgPSBndWlkZWRBbnN3ZXIocXVlc3Rpb24pCiAgICAgIHJldHVybiBO
ZXh0UmVzcG9uc2UuanNvbih7CiAgICAgICAgLi4uZmFsbGJhY2ssCiAgICAgICAgc291cmNlOiAnZ3VpZGVkLXByb3RlY3Rpb24nLAogICAgICB9KQogICAg
fQoKICAgIGNvbnN0IGFpUmVzdWx0ID0gYXdhaXQgZ2VuZXJhdGVBbnN3ZXIocXVlc3Rpb24sIG1lc3NhZ2VzKQoKICAgIGlmIChhaVJlc3VsdCkgewogICAg
ICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oewogICAgICAgIGFuc3dlcjogYWlSZXN1bHQuYW5zd2VyLAogICAgICAgIHN1Z2dlc3Rpb25zOiBhaVJlc3Vs
dC5zdWdnZXN0aW9ucywKICAgICAgICBhY3Rpb246IGFpUmVzdWx0LmFjdGlvbiwKICAgICAgICBzb3VyY2U6ICdhaScsCiAgICAgIH0pCiAgICB9CgogICAg
Y29uc3QgZmFsbGJhY2sgPSBndWlkZWRBbnN3ZXIocXVlc3Rpb24pCgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsKICAgICAgLi4uZmFsbGJhY2ss
CiAgICAgIHNvdXJjZTogJ2d1aWRlZCcsCiAgICB9KQogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9y
UmVzcG9uc2UoZXJyb3IpCiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yCgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICB7
IGVycm9yOiAnTsOjbyBmb2kgcG9zc8OtdmVsIHByb2Nlc3NhciBhIHBlcmd1bnRhLicgfSwKICAgICAgeyBzdGF0dXM6IDQwMCB9LAogICAgKQogIH0KfWAs
CiAgICAiaG9tZSBBSSBmYWlsIGNsb3NlZCB3aXRoIGd1aWRlZCBmYWxsYmFjayIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgovLyBJbnRlcm5hbCBB
STogcGxhbm8gbm9ybWFsaXphZG8gKyBhc3NpbmF0dXJhIGF0aXZhLgpwYXRjaCgiYXBwL2FwaS9haS9idXNpbmVzcy1hc3Npc3RhbnQvcm91dGUudHMiLCAo
Y29udGVudCkgPT4gewogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiaW1wb3J0IHsgZ2V0Q29tcGFueUFjY2VzcywgZ2V0UmVxdWVzdGVyLCBn
ZXRTdXBhYmFzZUFkbWluIH0gZnJvbSAnQC9saWIvY29tcGFueS1hY2Nlc3MnIiwKICAgICJpbXBvcnQgeyBhc3NpbmF0dXJhRXN0YUF0aXZhLCBnZXRDb21w
YW55QWNjZXNzLCBnZXRSZXF1ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcyciLAogICk7CiAgY29udGVudCA9
IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBhc3NpbmF0dXJhRXN0YUF0aXZhLCBnZXRDb21wYW55QWNjZXNzLCBnZXRSZXF1
ZXN0ZXIsIGdldFN1cGFiYXNlQWRtaW4gfSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcydcbiIsCiAgICAiaW1wb3J0IHsgbm9ybWFsaXplUGxhbktleSB9
IGZyb20gJ0AvbGliL3BsYW5zL3BsYW4tY29uZmlnJyIsCiAgICAiYnVzaW5lc3MgQUkgcGxhbiBpbXBvcnQiLAogICk7CiAgaWYgKCFjb250ZW50LmluY2x1
ZGVzKCJpZiAoIWFzc2luYXR1cmFFc3RhQXRpdmEoYWNjZXNzLmNvbXBhbnkpKSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBj
b250ZW50LAogICAgICBgICAgIGlmICghYWNjZXNzLmNvbXBhbnk/LmlkKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnRW1w
cmVzYSBuw6NvIGVuY29udHJhZGEuJyB9LCB7IHN0YXR1czogNDA0IH0pCiAgICB9CgogICAgY29uc3QgcGxhbiA9IFN0cmluZygKICAgICAgYWNjZXNzLmNv
bXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fAogICAgICAgIGFjY2Vzcy5jb21wYW55LnBsYW5vIHx8CiAgICAgICAgJ2Jhc2ljbycsCiAgICApLnRvTG93ZXJD
YXNlKClgLAogICAgICBgICAgIGlmICghYWNjZXNzLmNvbXBhbnk/LmlkKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiAnRW1w
cmVzYSBuw6NvIGVuY29udHJhZGEuJyB9LCB7IHN0YXR1czogNDA0IH0pCiAgICB9CgogICAgaWYgKCFhc3NpbmF0dXJhRXN0YUF0aXZhKGFjY2Vzcy5jb21w
YW55KSkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ0Fzc2luYXR1cmEgc2VtIGFjZXNzbyBhdGl2by4nIH0s
CiAgICAgICAgeyBzdGF0dXM6IDQwMyB9LAogICAgICApCiAgICB9CgogICAgY29uc3QgcGxhbiA9IG5vcm1hbGl6ZVBsYW5LZXkoCiAgICAgIGFjY2Vzcy5j
b21wYW55LmFzc2luYXR1cmFfcGxhbm8gfHwKICAgICAgICBhY2Nlc3MuY29tcGFueS5wbGFubyB8fAogICAgICAgICdlc3NlbmNpYWwnLAogICAgKWAsCiAg
ICAgICJidXNpbmVzcyBBSSBzdWJzY3JpcHRpb24gKyBwbGFuIiwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDExKSBXZWJob29rcyBj
b20gYnl0ZSBsaW1pdApwYXRjaCgiYXBwL2FwaS9tZXJjYWRvLXBhZ28vd2ViaG9vay9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFk
ZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAibmV4dC9zZXJ2ZXIiO1xu
JywKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiOycs
CiAgICAic3Vic2NyaXB0aW9uIHdlYmhvb2sgYm9keSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3Qg
Ym9keSA9IHJlY29yZCgKICAgICAgYXdhaXQgcmVxdWVzdC5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSksCiAgICApO2AsCiAgICBgICAgIGNvbnN0IGJvZHkg
PSByZWNvcmQoCiAgICAgIGF3YWl0IHJlYWRKc29uQm9keTxKc29uUmVjb3JkPihyZXF1ZXN0LCA2NCAqIDEwMjQpLAogICAgKTtgLAogICk7CiAgaWYgKCFj
b250ZW50LmluY2x1ZGVzKCJjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpOyIpKSB7CiAgICBjb250ZW50ID0gY29u
dGVudC5yZXBsYWNlKAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgbWVzc2FnZSA9YCwKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsK
ICAgIGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7CiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9y
OwoKICAgIGNvbnN0IG1lc3NhZ2UgPWAsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9hc3NpbmF0dXJhL2NoZWNr
b3V0L3dlYmhvb2svcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAiaW1wb3J0
IHsgZ2V0U3Vic2NyaXB0aW9uV2ViaG9va1NlY3JldCB9IGZyb20gJ0AvbGliL3BheW1lbnRzL3N1YnNjcmlwdGlvbi9tZXJjYWRvLXBhZ28nXG4iLAogICAg
ImltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAnQC9saWIvc2VjdXJpdHkvcmVxdWVzdCciLAogICAgImNo
ZWNrb3V0IHdlYmhvb2sgYm9keSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgICAgY29uc3QgYm9keSA9IChhd2Fp
dCByZXF1ZXN0CiAgICAgIC5qc29uKCkKICAgICAgLmNhdGNoKCgpID0+ICh7fSkpKSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPmAsCiAgICBgICAgIGNv
bnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICA2NCAqIDEwMjQsCiAg
ICApYCwKICApOwogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKSIpKSB7
CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc29sZS5lcnJvcihgLAogICAgICBgICB9
IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikg
cmV0dXJuIGJvZHlFcnJvcgoKICAgIGNvbnNvbGUuZXJyb3IoYCwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBpL21l
cmNhZG8tcGFnby93ZWJob29rLWxlYWRzL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50
LAogICAgJ2ltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2UgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9ydCB7IHJlYWRKc29u
Qm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7JywKICAgICJsZWFkIHdlYmhvb2sgYm9keSBp
bXBvcnQiLAogICk7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAgICBjb250ZW50LAogICAgL2V4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUXChy
ZXF1ZXN0OiBOZXh0UmVxdWVzdFwpIFx7W1xzXFNdKlxuXH1ccyokLywKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVx
dWVzdCkgewogIHRyeSB7CiAgICBsZXQgcGF5bWVudElkID0gZ2V0UGF5bWVudElkRnJvbVVybChyZXF1ZXN0KTsKCiAgICBpZiAoIXBheW1lbnRJZCkgewog
ICAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PHsKICAgICAgICBkYXRhPzogeyBpZD86IHVua25vd24gfTsKICAgICAgICBpZD86IHVua25v
d247CiAgICAgICAgcGF5bWVudF9pZD86IHVua25vd247CiAgICAgIH0+KHJlcXVlc3QsIDY0ICogMTAyNCk7CgogICAgICBwYXltZW50SWQgPSBTdHJpbmco
CiAgICAgICAgYm9keT8uZGF0YT8uaWQgfHwgYm9keT8uaWQgfHwgYm9keT8ucGF5bWVudF9pZCB8fCAiIiwKICAgICAgKTsKICAgIH0KCiAgICBjb25zdCB2
YWxpZCA9IHZlcmlmeU1lcmNhZG9QYWdvV2ViaG9va1NpZ25hdHVyZSh7CiAgICAgIHhTaWduYXR1cmU6IHJlcXVlc3QuaGVhZGVycy5nZXQoIngtc2lnbmF0
dXJlIiksCiAgICAgIHhSZXF1ZXN0SWQ6IHJlcXVlc3QuaGVhZGVycy5nZXQoIngtcmVxdWVzdC1pZCIpLAogICAgICBkYXRhSWQ6IFN0cmluZyhwYXltZW50
SWQgfHwgIiIpIHx8IG51bGwsCiAgICAgIHNlY3JldDogZ2V0U2lnbnVwV2ViaG9va1NlY3JldCgpLAogICAgfSk7CgogICAgaWYgKCF2YWxpZCkgewogICAg
ICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogIkFzc2luYXR1cmEgaW52w6FsaWRhLiIgfSwKICAgICAgICB7IHN0YXR1czog
NDAxIH0sCiAgICAgICk7CiAgICB9CgogICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKAogICAgICBhd2FpdCBwcm9jZXNzUGF5bWVudChTdHJpbmcocGF5
bWVudElkIHx8ICIiKSksCiAgICApOwogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2Uo
ZXJyb3IpOwogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcjsKCiAgICBjb25zb2xlLmVycm9yKAogICAgICAib3JjYWx5X3NpZ251cF93ZWJo
b29rX2Vycm9yIiwKICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciwKICAgICk7CiAgICByZXR1cm4gTmV4dFJl
c3BvbnNlLmpzb24oCiAgICAgIHsgZXJyb3I6ICJOw6NvIGZvaSBwb3Nzw612ZWwgcHJvY2Vzc2FyIG8gd2ViaG9vay4iIH0sCiAgICAgIHsgc3RhdHVzOiA1
MDAgfSwKICAgICk7CiAgfQp9YCwKICAgICJzaWdudXAgd2ViaG9vayBib3VuZGVkIGJvZHkiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2go
ImFwcC9hcGkvd2ViaG9va3MvYXNhYXMvcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQs
CiAgICAnaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gIm5leHQvc2VydmVyIjtcbicsCiAgICAnaW1wb3J0IHsgcmVhZFRleHRC
b2R5LCByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjsnLAogICAgImFzYWFzIGJvZHkgaW1wb3J0IiwK
ICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IHJhd1RleHQgPSBhd2FpdCByZXF1ZXN0LnRleHQoKTtgLAogICAgYCAg
ICBjb25zdCByYXdUZXh0ID0gYXdhaXQgcmVhZFRleHRCb2R5KHJlcXVlc3QsIDEyOCAqIDEwMjQpO2AsCiAgKTsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMo
ImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcik7IikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAg
ICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zb2xlLmVycm9yKCJbT3JjYWx5IGZpbmFuY2Vpcm9dIEZhbGhhIG5vIHdlYmhvb2s6IixgLAogICAg
ICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5
RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CgogICAgY29uc29sZS5lcnJvcigiW09yY2FseSBmaW5hbmNlaXJvXSBGYWxoYSBubyB3ZWJob29rOiIsYCwKICAg
ICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIE1hcmtldHBsYWNlIE1lcmNhZG8gUGFnbzogYXNzaW5hdHVyYSBvYnJpZ2F0w7NyaWEsIGJvZHkg
bGltaXRhZG8gZSBwYXlsb2FkIHNhbml0aXphZG8uCnBhdGNoKCJhcHAvYXBpL21hcmtldHBsYWNlL3BheW1lbnRzL3dlYmhvb2svbWVyY2Fkby1wYWdvL3Jv
dXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGdldFN1cGFiYXNl
QWRtaW4gfSBmcm9tICdAL2xpYi9jb21wYW55LWFjY2VzcydcbiIsCiAgICAiaW1wb3J0IHsgY2xlYW5TZW5zaXRpdmVQYXlsb2FkIH0gZnJvbSAnQC9saWIv
cGF5bWVudHMvc2VydmVyLWNvbnRleHQnIiwKICAgICJtYXJrZXRwbGFjZSB3ZWJob29rIHNhbml0aXplIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRk
SW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZCB9IGZyb20gJ0AvbGliL3BheW1lbnRzL3NlcnZl
ci1jb250ZXh0J1xuIiwKICAgICJpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gJ0AvbGliL3NlY3VyaXR5
L3JlcXVlc3QnIiwKICAgICJtYXJrZXRwbGFjZSB3ZWJob29rIGJvZHkgaW1wb3J0IiwKICApOwoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAg
Y29udGVudCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIGNvbnN0IHN1cGFiYXNlQWRtaW4gPSBn
ZXRTdXBhYmFzZUFkbWluKCkKICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJsKQogIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKS5j
YXRjaCgoKSA9PiAoe30pKQogIGNvbnN0IHBheW1lbnRJZCA9IGV4dHJhY3RQYXltZW50SWQoYm9keSwgdXJsKQogIGNvbnN0IG1hcmtldHBsYWNlUGF5bWVu
dElkRnJvbVVybCA9IFN0cmluZygKICAgIHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdtYXJrZXRwbGFjZV9wYXltZW50X2lkJykgfHwgJycsCiAgKQogIGNvbnN0
IGNvbXBhbnlJZEZyb21VcmwgPSBTdHJpbmcoCiAgICB1cmwuc2VhcmNoUGFyYW1zLmdldCgnY29tcGFueV9pZCcpIHx8ICcnLAogICkKCiAgdHJ5IHsKICAg
IGNvbnN0IHNlY3JldCA9IGdldE1hcmtldHBsYWNlV2ViaG9va1NlY3JldCgpYCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBO
ZXh0UmVxdWVzdCkgewogIGNvbnN0IHN1cGFiYXNlQWRtaW4gPSBnZXRTdXBhYmFzZUFkbWluKCkKICBjb25zdCB1cmwgPSBuZXcgVVJMKHJlcXVlc3QudXJs
KQogIGxldCBib2R5OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9CiAgY29uc3QgbWFya2V0cGxhY2VQYXltZW50SWRGcm9tVXJsID0gU3RyaW5nKAog
ICAgdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ21hcmtldHBsYWNlX3BheW1lbnRfaWQnKSB8fCAnJywKICApCiAgY29uc3QgY29tcGFueUlkRnJvbVVybCA9IFN0
cmluZygKICAgIHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdjb21wYW55X2lkJykgfHwgJycsCiAgKQoKICB0cnkgewogICAgYm9keSA9IGF3YWl0IHJlYWRKc29u
Qm9keTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oCiAgICAgIHJlcXVlc3QsCiAgICAgIDY0ICogMTAyNCwKICAgICkKICAgIGNvbnN0IHBheW1lbnRJZCA9
IGV4dHJhY3RQYXltZW50SWQoYm9keSwgdXJsKQogICAgY29uc3Qgc2VjcmV0ID0gZ2V0TWFya2V0cGxhY2VXZWJob29rU2VjcmV0KClgLAogICAgIm1hcmtl
dHBsYWNlIHdlYmhvb2sgYm91bmRlZCBib2R5IiwKICApOwoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgaWYg
KCF4U2lnbmF0dXJlIHx8ICF4UmVxdWVzdElkKSB7CiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7CiAgICAgICAgb2s6IHRydWUsCiAgICAgICAg
aWdub3JlZDogJ05vdGlmaWNhY2FvIGxlZ2FkYSBzZW0gYXNzaW5hdHVyYS4nLAogICAgICB9KQogICAgfWAsCiAgICBgICAgIGlmICgheFNpZ25hdHVyZSB8
fCAheFJlcXVlc3RJZCkgewogICAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgICAgeyBlcnJvcjogJ0Fzc2luYXR1cmEgb2JyaWdhdG9yaWEg
YXVzZW50ZS4nIH0sCiAgICAgICAgeyBzdGF0dXM6IDQwMSB9LAogICAgICApCiAgICB9YCwKICAgICJtYXJrZXRwbGFjZSB3ZWJob29rIHVuc2lnbmVkIHJl
amVjdGlvbiIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgICAgICAgcmF3X3BheWxvYWQ6IG1wUGF5bWVudCwiLAogICAg
IiAgICAgICAgICByYXdfcGF5bG9hZDogY2xlYW5TZW5zaXRpdmVQYXlsb2FkKG1wUGF5bWVudCksIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxh
Y2UoCiAgICAiICAgICAgICAgIHJhd19wYXlsb2FkOiBib2R5LCIsCiAgICAiICAgICAgICAgIHJhd19wYXlsb2FkOiBjbGVhblNlbnNpdGl2ZVBheWxvYWQo
Ym9keSksIiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvciki
KSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIGlmIChtYXJrZXRwbGFjZVBheW1lbnRJ
ZEZyb21VcmwgJiYgY29tcGFueUlkRnJvbVVybCkge2AsCiAgICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0
Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpCiAgICBpZiAoYm9keUVycm9yKSByZXR1cm4gYm9keUVycm9yCgogICAgaWYgKG1hcmtldHBsYWNlUGF5bWVudElk
RnJvbVVybCAmJiBjb21wYW55SWRGcm9tVXJsKSB7YCwKICAgICk7CiAgfQoKICByZXR1cm4gY29udGVudDsKfSk7CgovLyBDaGVja291dCBhdnVsc28gZGEg
YXNzaW5hdHVyYTogYm9keSBsaW1pdGFkbyBlIG51bmNhIHBlcnNpc3RlIHBheWxvYWQgZmluYW5jZWlybyBjcnUuCnBhdGNoKCJsaWIvc3Vic2NyaXB0aW9u
LWNoZWNrb3V0LXBheW1lbnQudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0
IHR5cGUgeyBOZXh0UmVxdWVzdCB9IGZyb20gIm5leHQvc2VydmVyIjtcbicsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5IH0gZnJvbSAiQC9saWIvc2Vj
dXJpdHkvcmVxdWVzdCI7JywKICAgICJzdWJzY3JpcHRpb24gY2hlY2tvdXQgYm9keSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVy
KAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyByZWFkSnNvbkJvZHkgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjtcbicsCiAgICAnaW1wb3J0
IHsgY2xlYW5TZW5zaXRpdmVQYXlsb2FkIH0gZnJvbSAiQC9saWIvcGF5bWVudHMvc2VydmVyLWNvbnRleHQiOycsCiAgICAic3Vic2NyaXB0aW9uIGNoZWNr
b3V0IHNhbml0aXplIGltcG9ydCIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAgIGNvbnN0IGJvZHkgPSAoYXdhaXQgcmVxdWVz
dC5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSkpIGFzIEpzb25SZWNvcmQ7YCwKICAgIGAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8SnNvblJl
Y29yZD4ocmVxdWVzdCwgMzIgKiAxMDI0KTtgLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICAiICAgICAgICByYXdfcGF5bWVu
dDogcGF5bWVudCwiLAogICAgIiAgICAgICAgcmF3X3BheW1lbnQ6IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChwYXltZW50KSwiLAogICk7CiAgY29udGVudCA9
IGNvbnRlbnQucmVwbGFjZUFsbCgKICAgICIgICAgICAgICAgICByYXdfcGF5bWVudDogcGF5bWVudCwiLAogICAgIiAgICAgICAgICAgIHJhd19wYXltZW50
OiBjbGVhblNlbnNpdGl2ZVBheWxvYWQocGF5bWVudCksIiwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCgovLyBJZGVtcG90w6puY2lhIGRlIHBhZ2Ft
ZW50byBhdnVsc28gZGUgYXNzaW5hdHVyYTogbyBjbGllbnRlIHJldXRpbGl6YSBhIGNoYXZlCi8vIGFww7NzIGZhbGhhIGRlIHJlZGUgZSBvIHNlcnZpZG9y
IGV4aWdlIFVVSUQgcGFyYSBpbXBlZGlyIGR1cGxpY2lkYWRlIGFjaWRlbnRhbC4KcGF0Y2goImNvbXBvbmVudHMvc3Vic2NyaXB0aW9uL01lcmNhZG9QYWdv
U3Vic2NyaXB0aW9uQ2hlY2tvdXQudHN4IiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoIm9uZVRpbWVJZGVtcG90ZW5jeVJlZiIp
KSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICBjb25zdCBicmlja0NvbnRyb2xsZXJSZWYgPSB1c2VS
ZWY8YW55PihudWxsKTsKICBjb25zdCBwcm9jZXNzaW5nUmVmID0gdXNlUmVmKGZhbHNlKTtgLAogICAgICBgICBjb25zdCBicmlja0NvbnRyb2xsZXJSZWYg
PSB1c2VSZWY8YW55PihudWxsKTsKICBjb25zdCBwcm9jZXNzaW5nUmVmID0gdXNlUmVmKGZhbHNlKTsKICBjb25zdCBvbmVUaW1lSWRlbXBvdGVuY3lSZWYg
PSB1c2VSZWYoIiIpO2AsCiAgICAgICJzdWJzY3JpcHRpb24gaWRlbXBvdGVuY3kgcmVmIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VU
ZXh0KAogICAgY29udGVudCwKICAgIGAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoUGF5bWVudFRpbWVvdXQoIi9hcGkvYXNzaW5h
dHVyYS9jaGVja291dCIsIHsKICAgICAgICAgIG1ldGhvZDogIlBPU1QiLAogICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICAiY29udGVudC10eXBl
IjogImFwcGxpY2F0aW9uL2pzb24iLAogICAgICAgICAgICBhdXRob3JpemF0aW9uOiBcYEJlYXJlciBcJHt0b2tlbn1cYCwKICAgICAgICAgICAgIngtb3Jj
YWx5LXNlc3Npb24iOiB0b2tlbiwKICAgICAgICAgICAgImlkZW1wb3RlbmN5LWtleSI6IGNyeXB0by5yYW5kb21VVUlEKCksCiAgICAgICAgICB9LAogICAg
ICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoewogICAgICAgICAgICBwbGFuOiBwbGFuS2V5LAogICAgICAgICAgICBmb3JtRGF0YSwKICAgICAgICAgIH0p
LAogICAgICAgIH0pOwogICAgICAgIGNvbnN0IHBheWxvYWQgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7CgogICAgICAgIGlm
ICghcmVzcG9uc2Uub2spIHsKICAgICAgICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgICAgICAgcGF5bG9hZC5lcnJvciB8fCAiTsOjbyBmb2kgcG9zc8Ot
dmVsIHByb2Nlc3NhciBvIHBhZ2FtZW50by4iLAogICAgICAgICAgKTsKICAgICAgICB9YCwKICAgIGAgICAgICAgIGNvbnN0IGlkZW1wb3RlbmN5S2V5ID0K
ICAgICAgICAgIG9uZVRpbWVJZGVtcG90ZW5jeVJlZi5jdXJyZW50IHx8IGNyeXB0by5yYW5kb21VVUlEKCk7CiAgICAgICAgb25lVGltZUlkZW1wb3RlbmN5
UmVmLmN1cnJlbnQgPSBpZGVtcG90ZW5jeUtleTsKCiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhQYXltZW50VGltZW91dCgiL2Fw
aS9hc3NpbmF0dXJhL2NoZWNrb3V0IiwgewogICAgICAgICAgbWV0aG9kOiAiUE9TVCIsCiAgICAgICAgICBoZWFkZXJzOiB7CiAgICAgICAgICAgICJjb250
ZW50LXR5cGUiOiAiYXBwbGljYXRpb24vanNvbiIsCiAgICAgICAgICAgIGF1dGhvcml6YXRpb246IFxgQmVhcmVyIFwke3Rva2VufVxgLAogICAgICAgICAg
ICAieC1vcmNhbHktc2Vzc2lvbiI6IHRva2VuLAogICAgICAgICAgICAiaWRlbXBvdGVuY3kta2V5IjogaWRlbXBvdGVuY3lLZXksCiAgICAgICAgICB9LAog
ICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoewogICAgICAgICAgICBwbGFuOiBwbGFuS2V5LAogICAgICAgICAgICBmb3JtRGF0YSwKICAgICAgICAg
IH0pLAogICAgICAgIH0pOwogICAgICAgIGNvbnN0IHBheWxvYWQgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7CgogICAgICAg
IGlmICghcmVzcG9uc2Uub2spIHsKICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPCA1MDApIHsKICAgICAgICAgICAgb25lVGltZUlkZW1wb3RlbmN5
UmVmLmN1cnJlbnQgPSAiIjsKICAgICAgICAgIH0KICAgICAgICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgICAgICAgcGF5bG9hZC5lcnJvciB8fCAiTsOj
byBmb2kgcG9zc8OtdmVsIHByb2Nlc3NhciBvIHBhZ2FtZW50by4iLAogICAgICAgICAgKTsKICAgICAgICB9CgogICAgICAgIG9uZVRpbWVJZGVtcG90ZW5j
eVJlZi5jdXJyZW50ID0gIiI7YCwKICAgICJzdWJzY3JpcHRpb24gY2hlY2tvdXQgcmV0cnkgaWRlbXBvdGVuY3kiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7
Cn0pOwoKcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tY2hlY2tvdXQtcGF5bWVudC50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVw
bGFjZSgKICAgICdpbXBvcnQgeyByYW5kb21VVUlEIH0gZnJvbSAibm9kZTpjcnlwdG8iO1xuJywKICAgICIiLAogICk7CgogIGlmICghY29udGVudC5pbmNs
dWRlcygiaWRlbXBvdGVuY3kta2V5IGludsOhbGlkYSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBg
ICBpZiAoIWNvbnRleHQuY2FuTWFuYWdlKSB7CiAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICBuZXcgRXJyb3IoIlZvY8OqIG7Do28gcG9zc3VpIHBl
cm1pc3PDo28gcGFyYSBwYWdhciBhIGFzc2luYXR1cmEuIiksCiAgICAgIHsgc3RhdHVzOiA0MDMgfSwKICAgICk7CiAgfQoKICBjb25zdCBib2R5ID0gYXdh
aXQgcmVhZEpzb25Cb2R5PEpzb25SZWNvcmQ+KHJlcXVlc3QsIDMyICogMTAyNCk7YCwKICAgICAgYCAgaWYgKCFjb250ZXh0LmNhbk1hbmFnZSkgewogICAg
dGhyb3cgT2JqZWN0LmFzc2lnbigKICAgICAgbmV3IEVycm9yKCJWb2PDqiBuw6NvIHBvc3N1aSBwZXJtaXNzw6NvIHBhcmEgcGFnYXIgYSBhc3NpbmF0dXJh
LiIpLAogICAgICB7IHN0YXR1czogNDAzIH0sCiAgICApOwogIH0KCiAgY29uc3QgaWRlbXBvdGVuY3lLZXkgPSB0ZXh0KAogICAgcmVxdWVzdC5oZWFkZXJz
LmdldCgiaWRlbXBvdGVuY3kta2V5IiksCiAgKTsKICBpZiAoCiAgICAhL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFi
XVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaS50ZXN0KAogICAgICBpZGVtcG90ZW5jeUtleSwKICAgICkKICApIHsKICAgIHRocm93IE9iamVjdC5hc3Np
Z24oCiAgICAgIG5ldyBFcnJvcigiQ2hhdmUgZGUgaWRlbXBvdMOqbmNpYSBkbyBwYWdhbWVudG8gaW52w6FsaWRhLiIpLAogICAgICB7IHN0YXR1czogNDAw
IH0sCiAgICApOwogIH0KCiAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRKc29uQm9keTxKc29uUmVjb3JkPihyZXF1ZXN0LCAzMiAqIDEwMjQpO2AsCiAgICAg
ICJzdWJzY3JpcHRpb24gcmVxdWlyZSBpZGVtcG90ZW5jeSBrZXkiLAogICAgKTsKICB9CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICBj
b25zdCBpZGVtcG90ZW5jeUtleSA9CiAgICB0ZXh0KHJlcXVlc3QuaGVhZGVycy5nZXQoImlkZW1wb3RlbmN5LWtleSIpKSB8fCByYW5kb21VVUlEKCk7YCwK
ICAgICIiLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygiZXhpc3RpbmdQYXltZW50Um93IikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRl
eHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIGNvbnN0IHsgZGF0YTogcGF5bWVudFJvdywgZXJyb3I6IHBheW1lbnRFcnJvciB9ID0KICAgIGF3YWl0IGNv
bnRleHQuYWRtaW4KICAgICAgLmZyb20oInBsYW5fcGF5bWVudHMiKQogICAgICAuaW5zZXJ0KHsKICAgICAgICBjb21wYW55X2lkOiBjb21wYW55SWQsCiAg
ICAgICAgcGxhbm86IHBsYW5LZXksCiAgICAgICAgdmFsb3I6IHBsYW4ucHJpY2UsCiAgICAgICAgc3RhdHVzOiAiY3JlYXRlZCIsCiAgICAgICAgdGlwbzog
a2luZCA9PT0gInBpeCIgPyAicGl4X2F2dWxzbyIgOiAiY2FyZF9hdnVsc28iLAogICAgICAgIHBheW1lbnRfbWV0aG9kOiBwYXltZW50TWV0aG9kSWQsCiAg
ICAgICAgZW1haWw6IHBheWVyRW1haWwsCiAgICAgICAgbm9tZV9lbXByZXNhOiB0ZXh0KGNvbXBhbnkubm9tZSkgfHwgIkVtcHJlc2EiLAogICAgICB9KQog
ICAgICAuc2VsZWN0KCJpZCIpCiAgICAgIC5zaW5nbGUoKTsKCiAgaWYgKHBheW1lbnRFcnJvciB8fCAhcGF5bWVudFJvdz8uaWQpIHsKICAgIHRocm93IE9i
amVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigKICAgICAgICBwYXltZW50RXJyb3I/Lm1lc3NhZ2UgfHwKICAgICAgICAgICJOw6NvIGZvaSBwb3Nzw612
ZWwgcHJlcGFyYXIgbyBwYWdhbWVudG8uIiwKICAgICAgKSwKICAgICAgeyBzdGF0dXM6IDUwMCB9LAogICAgKTsKICB9YCwKICAgICAgYCAgY29uc3QgeyBk
YXRhOiBleGlzdGluZ1BheW1lbnRSb3csIGVycm9yOiBleGlzdGluZ1BheW1lbnRFcnJvciB9ID0KICAgIGF3YWl0IGNvbnRleHQuYWRtaW4KICAgICAgLmZy
b20oInBsYW5fcGF5bWVudHMiKQogICAgICAuc2VsZWN0KCIqIikKICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgICAuZXEoImlkZW1w
b3RlbmN5X2tleSIsIGlkZW1wb3RlbmN5S2V5KQogICAgICAubWF5YmVTaW5nbGUoKTsKCiAgaWYgKGV4aXN0aW5nUGF5bWVudEVycm9yKSB0aHJvdyBleGlz
dGluZ1BheW1lbnRFcnJvcjsKCiAgbGV0IHBheW1lbnRSb3cgPSBleGlzdGluZ1BheW1lbnRSb3cgYXMgSnNvblJlY29yZCB8IG51bGw7CgogIGlmIChwYXlt
ZW50Um93Py5tZXJjYWRvX3BhZ29fcGF5bWVudF9pZCkgewogICAgY29uc3QgZXhpc3RpbmdQYXltZW50ID0gKGF3YWl0IGdldE1lcmNhZG9QYWdvUGF5bWVu
dCgKICAgICAgZ2V0UGxhdGZvcm1BY2Nlc3NUb2tlbigpLAogICAgICB0ZXh0KHBheW1lbnRSb3cubWVyY2Fkb19wYWdvX3BheW1lbnRfaWQpLAogICAgKSkg
YXMgSnNvblJlY29yZDsKCiAgICByZXR1cm4gcGVyc2lzdFJlbW90ZVN0YXR1cygKICAgICAgY29udGV4dC5hZG1pbiwKICAgICAgcGF5bWVudFJvdywKICAg
ICAgY29tcGFueSwKICAgICAgZXhpc3RpbmdQYXltZW50LAogICAgKTsKICB9CgogIGlmICghcGF5bWVudFJvdykgewogICAgY29uc3QgaW5zZXJ0ZWQgPSBh
d2FpdCBjb250ZXh0LmFkbWluCiAgICAgIC5mcm9tKCJwbGFuX3BheW1lbnRzIikKICAgICAgLmluc2VydCh7CiAgICAgICAgY29tcGFueV9pZDogY29tcGFu
eUlkLAogICAgICAgIHBsYW5vOiBwbGFuS2V5LAogICAgICAgIHZhbG9yOiBwbGFuLnByaWNlLAogICAgICAgIHN0YXR1czogImNyZWF0ZWQiLAogICAgICAg
IHRpcG86IGtpbmQgPT09ICJwaXgiID8gInBpeF9hdnVsc28iIDogImNhcmRfYXZ1bHNvIiwKICAgICAgICBwYXltZW50X21ldGhvZDogcGF5bWVudE1ldGhv
ZElkLAogICAgICAgIHByb3ZpZGVyOiAibWVyY2Fkb19wYWdvIiwKICAgICAgICBpZGVtcG90ZW5jeV9rZXk6IGlkZW1wb3RlbmN5S2V5LAogICAgICAgIGVt
YWlsOiBwYXllckVtYWlsLAogICAgICAgIG5vbWVfZW1wcmVzYTogdGV4dChjb21wYW55Lm5vbWUpIHx8ICJFbXByZXNhIiwKICAgICAgfSkKICAgICAgLnNl
bGVjdCgiKiIpCiAgICAgIC5zaW5nbGUoKTsKCiAgICBpZiAoaW5zZXJ0ZWQuZXJyb3IgfHwgIWluc2VydGVkLmRhdGE/LmlkKSB7CiAgICAgIHRocm93IE9i
amVjdC5hc3NpZ24oCiAgICAgICAgbmV3IEVycm9yKAogICAgICAgICAgaW5zZXJ0ZWQuZXJyb3I/Lm1lc3NhZ2UgfHwKICAgICAgICAgICAgIk7Do28gZm9p
IHBvc3PDrXZlbCBwcmVwYXJhciBvIHBhZ2FtZW50by4iLAogICAgICAgICksCiAgICAgICAgeyBzdGF0dXM6IDUwMCB9LAogICAgICApOwogICAgfQoKICAg
IHBheW1lbnRSb3cgPSBpbnNlcnRlZC5kYXRhIGFzIEpzb25SZWNvcmQ7CiAgfWAsCiAgICAgICJzdWJzY3JpcHRpb24gb25lLXRpbWUgaWRlbXBvdGVudCBy
b3cgcmV1c2UiLAogICAgKTsKCiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICBjb25zdCBwYXltZW50Um93SWQgPSB0ZXh0KHBheW1l
bnRSb3cuaWQpO2AsCiAgICAgIGAgIGNvbnN0IHBheW1lbnRSb3dJZCA9IHRleHQocGF5bWVudFJvdy5pZCk7YCwKICAgICk7CiAgfQoKICBjb250ZW50ID0g
cmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBhd2FpdCBjb250ZXh0LmFkbWluCiAgICAgIC5mcm9t
KCJwbGFuX3BheW1lbnRzIikKICAgICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOiAiZmFpbGVkIiwKICAgICAgICB1cGRhdGVkX2F0OiBuZXcgRGF0ZSgp
LnRvSVNPU3RyaW5nKCksCiAgICAgIH0pCiAgICAgIC5lcSgiaWQiLCBwYXltZW50Um93SWQpCiAgICAgIC5lcSgiY29tcGFueV9pZCIsIGNvbXBhbnlJZCk7
CgogICAgdGhyb3cgZXJyb3I7CiAgfWAsCiAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgcHJvdmlkZXJTdGF0dXMgPQogICAgICBlcnJvciAm
JiB0eXBlb2YgZXJyb3IgPT09ICJvYmplY3QiICYmICJzdGF0dXMiIGluIGVycm9yCiAgICAgICAgPyBOdW1iZXIoKGVycm9yIGFzIHsgc3RhdHVzPzogbnVt
YmVyIH0pLnN0YXR1cyB8fCAwKQogICAgICAgIDogMDsKCiAgICBhd2FpdCBjb250ZXh0LmFkbWluCiAgICAgIC5mcm9tKCJwbGFuX3BheW1lbnRzIikKICAg
ICAgLnVwZGF0ZSh7CiAgICAgICAgc3RhdHVzOgogICAgICAgICAgcHJvdmlkZXJTdGF0dXMgPj0gNDAwICYmIHByb3ZpZGVyU3RhdHVzIDwgNTAwCiAgICAg
ICAgICAgID8gImZhaWxlZCIKICAgICAgICAgICAgOiAiY3JlYXRpbmciLAogICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwK
ICAgICAgfSkKICAgICAgLmVxKCJpZCIsIHBheW1lbnRSb3dJZCkKICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKTsKCiAgICB0aHJvdyBlcnJv
cjsKICB9YCwKICAgICJzdWJzY3JpcHRpb24gb25lLXRpbWUgYW1iaWd1b3VzIHByb3ZpZGVyIHJlc3VsdCIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7
CgoKLy8gQXNzaW5hdHVyYSByZWNvcnJlbnRlIHRyYW5zcGFyZW50ZTogYm9keSBsaW1pdGFkbywgaWRlbXBvdMOqbmNpYSBlIHBheWxvYWQgc2FuaXRpemFk
by4KcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1w
b3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB0eXBlIHsgTmV4dFJlcXVlc3QgfSBmcm9tICJuZXh0L3NlcnZlciI7XG4nLAogICAgJ2ltcG9y
dCB7IHJlYWRKc29uQm9keSB9IGZyb20gIkAvbGliL3NlY3VyaXR5L3JlcXVlc3QiOycsCiAgICAidHJhbnNwYXJlbnQgc3Vic2NyaXB0aW9uIGJvZHkgaW1w
b3J0IiwKICApOwogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5IH0gZnJvbSAiQC9s
aWIvc2VjdXJpdHkvcmVxdWVzdCI7XG4nLAogICAgJ2ltcG9ydCB7IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZCB9IGZyb20gIkAvbGliL3BheW1lbnRzL3NlcnZl
ci1jb250ZXh0IjsnLAogICAgInRyYW5zcGFyZW50IHN1YnNjcmlwdGlvbiBzYW5pdGl6ZSBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2UoCiAgICBgICBjb25zdCBib2R5ID0gKGF3YWl0IHJlcXVlc3QKICAgIC5qc29uKCkKICAgIC5jYXRjaCgoKSA9PiAoe30pKSkgYXMgSnNvblJlY29y
ZDtgLAogICAgYCAgY29uc3QgaWRlbXBvdGVuY3lLZXkgPSB0ZXh0KAogICAgcmVxdWVzdC5oZWFkZXJzLmdldCgiaWRlbXBvdGVuY3kta2V5IiksCiAgKTsK
ICBpZiAoCiAgICAhL15bMC05YS1mXXs4fS1bMC05YS1mXXs0fS1bMS01XVswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfSQvaS50
ZXN0KAogICAgICBpZGVtcG90ZW5jeUtleSwKICAgICkKICApIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigiQ2hhdmUgZGUg
aWRlbXBvdMOqbmNpYSBkYSBhc3NpbmF0dXJhIGludsOhbGlkYS4iKSwKICAgICAgeyBzdGF0dXM6IDQwMCB9LAogICAgKTsKICB9CgogIGNvbnN0IGJvZHkg
PSBhd2FpdCByZWFkSnNvbkJvZHk8SnNvblJlY29yZD4oCiAgICByZXF1ZXN0LAogICAgMjQgKiAxMDI0LAogICk7YCwKICApOwoKICBjb250ZW50ID0gcmVw
bGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgICAgIHByb3ZpZGVyOiAibWVyY2Fkb19wYWdvIiwKICAgICAgICBlbWFpbDogcGF5ZXJFbWFp
bCxgLAogICAgYCAgICAgICAgcHJvdmlkZXI6ICJtZXJjYWRvX3BhZ28iLAogICAgICAgIGlkZW1wb3RlbmN5X2tleTogaWRlbXBvdGVuY3lLZXksCiAgICAg
ICAgZW1haWw6IHBheWVyRW1haWwsYCwKICAgICJ0cmFuc3BhcmVudCBzdWJzY3JpcHRpb24gaWRlbXBvdGVuY3kgcGVyc2lzdGVuY2UiLAogICk7CgogIGNv
bnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoCiAgICAiICAgICAgICByYXdfc3Vic2NyaXB0aW9uOiBzdWJzY3JpcHRpb24sIiwKICAgICIgICAgICAgIHJh
d19zdWJzY3JpcHRpb246IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChzdWJzY3JpcHRpb24pLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAog
ICAgIiAgICBhc3NpbmF0dXJhX21wX3BheWxvYWQ6IHN1YnNjcmlwdGlvbiwiLAogICAgIiAgICBhc3NpbmF0dXJhX21wX3BheWxvYWQ6IGNsZWFuU2Vuc2l0
aXZlUGF5bG9hZChzdWJzY3JpcHRpb24pLCIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiY29tcG9uZW50cy9zdWJzY3JpcHRpb24vTWVy
Y2Fkb1BhZ29TdWJzY3JpcHRpb25DaGVja291dC50c3giLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygicmVjdXJyaW5nSWRlbXBv
dGVuY3lSZWYiKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgY29uc3QgcHJvY2Vzc2luZ1JlZiA9
IHVzZVJlZihmYWxzZSk7CiAgY29uc3Qgb25lVGltZUlkZW1wb3RlbmN5UmVmID0gdXNlUmVmKCIiKTtgLAogICAgICBgICBjb25zdCBwcm9jZXNzaW5nUmVm
ID0gdXNlUmVmKGZhbHNlKTsKICBjb25zdCBvbmVUaW1lSWRlbXBvdGVuY3lSZWYgPSB1c2VSZWYoIiIpOwogIGNvbnN0IHJlY3VycmluZ0lkZW1wb3RlbmN5
UmVmID0gdXNlUmVmKCIiKTtgLAogICAgICAicmVjdXJyaW5nIGlkZW1wb3RlbmN5IHJlZiIsCiAgICApOwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNl
VGV4dCgKICAgIGNvbnRlbnQsCiAgICBgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2hXaXRoUGF5bWVudFRpbWVvdXQoCiAgICAgICAg
ICAgICIvYXBpL2Fzc2luYXR1cmEvbWVyY2Fkby1wYWdvIiwKICAgICAgICAgICAgewogICAgICAgICAgICAgIG1ldGhvZDogIlBPU1QiLAogICAgICAgICAg
ICAgIGhlYWRlcnM6IHsKICAgICAgICAgICAgICAgICJjb250ZW50LXR5cGUiOiAiYXBwbGljYXRpb24vanNvbiIsCiAgICAgICAgICAgICAgICBhdXRob3Jp
emF0aW9uOiBcYEJlYXJlciBcJHt0b2tlbn1cYCwKICAgICAgICAgICAgIngtb3JjYWx5LXNlc3Npb24iOiB0b2tlbiwKICAgICAgICAgICAgICB9LAogICAg
ICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsKICAgICAgICAgICAgICAgIHBsYW46IHBsYW5LZXksCiAgICAgICAgICAgICAgICBjYXJkVG9rZW5J
ZDogZm9ybURhdGEudG9rZW4sCiAgICAgICAgICAgICAgICBwYXllckVtYWlsOgogICAgICAgICAgICAgICAgICBwYXllci5lbWFpbCB8fAogICAgICAgICAg
ICAgICAgICBzbmFwc2hvdD8uY29tcGFueT8uZW1haWwgfHwKICAgICAgICAgICAgICAgICAgIiIsCiAgICAgICAgICAgICAgfSksCiAgICAgICAgICAgIH0s
CiAgICAgICAgICApOwogICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTsKCiAgICAgICAg
ICBpZiAoIXJlc3BvbnNlLm9rKSB7YCwKICAgIGAgICAgICAgICAgY29uc3QgaWRlbXBvdGVuY3lLZXkgPQogICAgICAgICAgICByZWN1cnJpbmdJZGVtcG90
ZW5jeVJlZi5jdXJyZW50IHx8IGNyeXB0by5yYW5kb21VVUlEKCk7CiAgICAgICAgICByZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gaWRlbXBv
dGVuY3lLZXk7CgogICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaFdpdGhQYXltZW50VGltZW91dCgKICAgICAgICAgICAgIi9hcGkvYXNz
aW5hdHVyYS9tZXJjYWRvLXBhZ28iLAogICAgICAgICAgICB7CiAgICAgICAgICAgICAgbWV0aG9kOiAiUE9TVCIsCiAgICAgICAgICAgICAgaGVhZGVyczog
ewogICAgICAgICAgICAgICAgImNvbnRlbnQtdHlwZSI6ICJhcHBsaWNhdGlvbi9qc29uIiwKICAgICAgICAgICAgICAgIGF1dGhvcml6YXRpb246IFxgQmVh
cmVyIFwke3Rva2VufVxgLAogICAgICAgICAgICAgICAgIngtb3JjYWx5LXNlc3Npb24iOiB0b2tlbiwKICAgICAgICAgICAgICAgICJpZGVtcG90ZW5jeS1r
ZXkiOiBpZGVtcG90ZW5jeUtleSwKICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsKICAgICAgICAgICAgICAg
IHBsYW46IHBsYW5LZXksCiAgICAgICAgICAgICAgICBjYXJkVG9rZW5JZDogZm9ybURhdGEudG9rZW4sCiAgICAgICAgICAgICAgICBwYXllckVtYWlsOgog
ICAgICAgICAgICAgICAgICBwYXllci5lbWFpbCB8fAogICAgICAgICAgICAgICAgICBzbmFwc2hvdD8uY29tcGFueT8uZW1haWwgfHwKICAgICAgICAgICAg
ICAgICAgIiIsCiAgICAgICAgICAgICAgfSksCiAgICAgICAgICAgIH0sCiAgICAgICAgICApOwogICAgICAgICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IHJl
c3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTsKCiAgICAgICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7CiAgICAgICAgICAgIGlmIChyZXNwb25zZS5z
dGF0dXMgPCA1MDApIHsKICAgICAgICAgICAgICByZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gIiI7CiAgICAgICAgICAgIH1gLAogICAgInJl
Y3VycmluZyBjaGVja291dCByZXRyeSBpZGVtcG90ZW5jeSIsCiAgKTsKICByZXR1cm4gY29udGVudDsKfSk7CgovLyBFbmRwb2ludCBkZSBnZXJlbmNpYW1l
bnRvIGRlIGFzc2luYXR1cmEgdGFtYsOpbSBwYXNzYSBwZWxvIGJ5dGUtbGltaXQgY29tcGFydGlsaGFkby4KcGF0Y2goImFwcC9hcGkvY29tcGFueS9zdWJz
Y3JpcHRpb24vcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnaW1wb3J0IHsg
TmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gIm5leHQvc2VydmVyIjtcbicsCiAgICAnaW1wb3J0IHsgcmVhZEpzb25Cb2R5LCByZXF1ZXN0Qm9k
eUVycm9yUmVzcG9uc2UgfSBmcm9tICJAL2xpYi9zZWN1cml0eS9yZXF1ZXN0IjsnLAogICAgImNvbXBhbnkgc3Vic2NyaXB0aW9uIGJvZHkgaW1wb3J0IiwK
ICApOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0Lmpzb24oKS5jYXRjaCgoKSA9PiAo
e30pKTtgLAogICAgYCAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEpzb25Cb2R5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwK
ICAgICAgMTYgKiAxMDI0LAogICAgKTtgLAogICk7CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9y
UmVzcG9uc2UoZXJyb3IpOyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3Qg
bWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogIkVycm8gYW8gZ2VyZW5jaWFyIGFzc2luYXR1cmEuIjtgLAogICAg
ICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKTsKICAgIGlmIChib2R5
RXJyb3IpIHJldHVybiBib2R5RXJyb3I7CgogICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogIkVy
cm8gYW8gZ2VyZW5jaWFyIGFzc2luYXR1cmEuIjtgLAogICAgKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8gUGF5bG9hZHMgZGUgYXNzaW5hdHVy
YSBndWFyZGFkb3Mgbm8gYmFuY28gZmljYW0gc2FuaXRpemFkb3MuCnBhdGNoKCJhcHAvYXBpL21lcmNhZG8tcGFnby93ZWJob29rL3JvdXRlLnRzIiwgKGNv
bnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJv
ZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7XG4nLAogICAgJ2ltcG9ydCB7IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZCB9
IGZyb20gIkAvbGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0IjsnLAogICAgInN1YnNjcmlwdGlvbiB3ZWJob29rIHNhbml0aXplIGltcG9ydCIsCiAgKTsK
ICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgIGFzc2luYXR1cmFfbXBfcGF5bG9hZDogc3Vic2NyaXB0aW9uLCIsCiAgICAiICAgICAg
YXNzaW5hdHVyYV9tcF9wYXlsb2FkOiBjbGVhblNlbnNpdGl2ZVBheWxvYWQoc3Vic2NyaXB0aW9uKSwiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVw
bGFjZSgKICAgICIgICAgICAgIHJhd193ZWJob29rOiBib2R5LCIsCiAgICAiICAgICAgICByYXdfd2ViaG9vazogY2xlYW5TZW5zaXRpdmVQYXlsb2FkKGJv
ZHkpLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgICAgcmF3X3BheW1lbnQ6IHBheW1lbnQsIiwKICAgICIgICAgICAg
IHJhd19wYXltZW50OiBjbGVhblNlbnNpdGl2ZVBheWxvYWQocGF5bWVudCksIiwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJhcHAvYXBp
L21lcmNhZG8tcGFnby93ZWJob29rLWxlYWRzL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250
ZW50LAogICAgJ2ltcG9ydCB7IHJlYWRKc29uQm9keSwgcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlIH0gZnJvbSAiQC9saWIvc2VjdXJpdHkvcmVxdWVzdCI7
XG4nLAogICAgJ2ltcG9ydCB7IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZCB9IGZyb20gIkAvbGliL3BheW1lbnRzL3NlcnZlci1jb250ZXh0IjsnLAogICAgInNp
Z251cCB3ZWJob29rIHNhbml0aXplIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgIG1lcmNhZG9fcGFnb19w
YXltZW50OiBwYXltZW50LCIsCiAgICAiICAgICAgbWVyY2Fkb19wYWdvX3BheW1lbnQ6IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChwYXltZW50KSwiLAogICk7
CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFk
ZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICdpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tICJAc3VwYWJhc2Uvc3VwYWJhc2UtanMiO1xuJywK
ICAgICdpbXBvcnQgeyBjbGVhblNlbnNpdGl2ZVBheWxvYWQgfSBmcm9tICJAL2xpYi9wYXltZW50cy9zZXJ2ZXItY29udGV4dCI7JywKICAgICJzdWJzY3Jp
cHRpb24gc2VydmljZSBzYW5pdGl6ZSBpbXBvcnQiLAogICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgICByYXdfc3Vic2NyaXB0
aW9uOiBzdWJzY3JpcHRpb24sIiwKICAgICIgICAgICByYXdfc3Vic2NyaXB0aW9uOiBjbGVhblNlbnNpdGl2ZVBheWxvYWQoc3Vic2NyaXB0aW9uKSwiLAog
ICk7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICIgICAgICBhc3NpbmF0dXJhX21wX3BheWxvYWQ6IHN1YnNjcmlwdGlvbiwiLAogICAgIiAg
ICAgIGFzc2luYXR1cmFfbXBfcGF5bG9hZDogY2xlYW5TZW5zaXRpdmVQYXlsb2FkKHN1YnNjcmlwdGlvbiksIiwKICApOwogIGNvbnRlbnQgPSBjb250ZW50
LnJlcGxhY2UoCiAgICAiICAgICAgcmF3X3ByZWZlcmVuY2U6IHByZWZlcmVuY2UsIiwKICAgICIgICAgICByYXdfcHJlZmVyZW5jZTogY2xlYW5TZW5zaXRp
dmVQYXlsb2FkKHByZWZlcmVuY2UpLCIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgIiAgICAgIGFzc2luYXR1cmFfbXBfcGF5bG9h
ZDogcmVtb3RlU3Vic2NyaXB0aW9uIHx8IGNvbXBhbnkuYXNzaW5hdHVyYV9tcF9wYXlsb2FkIHx8IG51bGwsIiwKICAgICIgICAgICBhc3NpbmF0dXJhX21w
X3BheWxvYWQ6IHJlbW90ZVN1YnNjcmlwdGlvbiA/IGNsZWFuU2Vuc2l0aXZlUGF5bG9hZChyZW1vdGVTdWJzY3JpcHRpb24pIDogY29tcGFueS5hc3NpbmF0
dXJhX21wX3BheWxvYWQgfHwgbnVsbCwiLAogICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKLy8gMTIpIFN1YnNjcmlwdGlvbiBzeW5jL2hpc3RvcnkgY29t
IHBlcm1pc3PDo28KcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFj
ZSgKICAgIGAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCBnZXRIaXN0b3J5KGNvbnRleHQuYWRtaW4sIGNvbnRleHQuY29tcGFueS5pZCk7CiAgcmV0dXJuIHsK
ICAgIGNvbXBhbnk6IHNhZmVDb21wYW55KGNvbnRleHQuY29tcGFueSksCiAgICByb2xlOiBjb250ZXh0LnJvbGUsCiAgICBjYW5fbWFuYWdlOiBjb250ZXh0
LmNhbk1hbmFnZSwKICAgIHBsYW5zOiBPUkNBTFlfUExBTlMsCiAgICBoaXN0b3J5LAogIH07YCwKICAgIGAgIGNvbnN0IGhpc3RvcnkgPSBjb250ZXh0LmNh
bk1hbmFnZQogICAgPyBhd2FpdCBnZXRIaXN0b3J5KGNvbnRleHQuYWRtaW4sIGNvbnRleHQuY29tcGFueS5pZCkKICAgIDogeyBldmVudHM6IFtdLCBwYXlt
ZW50czogW10gfTsKICByZXR1cm4gewogICAgY29tcGFueTogc2FmZUNvbXBhbnkoY29udGV4dC5jb21wYW55KSwKICAgIHJvbGU6IGNvbnRleHQucm9sZSwK
ICAgIGNhbl9tYW5hZ2U6IGNvbnRleHQuY2FuTWFuYWdlLAogICAgcGxhbnM6IE9SQ0FMWV9QTEFOUywKICAgIGhpc3RvcnksCiAgfTtgLAogICk7CiAgaWYg
KCFjb250ZW50LmluY2x1ZGVzKCdpZiAoIWNvbnRleHQuY2FuTWFuYWdlKSB0aHJvdyBuZXcgRXJyb3IoIlZvY8OqIG7Do28gcG9zc3VpIHBlcm1pc3PDo28g
cGFyYSBzaW5jcm9uaXphciBhIGFzc2luYXR1cmEuIik7JykpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAg
IGAgIGlmICghY29udGV4dC51c2VyKSB0aHJvdyBuZXcgRXJyb3IoIk7Do28gYXV0b3JpemFkby4iKTsKICBpZiAoIWNvbXBhbnk/LmlkKSB0aHJvdyBuZXcg
RXJyb3IoIkVtcHJlc2EgbsOjbyBlbmNvbnRyYWRhLiIpOwoKICBjb25zdCBwcmVhcHByb3ZhbElkID1gLAogICAgICBgICBpZiAoIWNvbnRleHQudXNlcikg
dGhyb3cgbmV3IEVycm9yKCJOw6NvIGF1dG9yaXphZG8uIik7CiAgaWYgKCFjb21wYW55Py5pZCkgdGhyb3cgbmV3IEVycm9yKCJFbXByZXNhIG7Do28gZW5j
b250cmFkYS4iKTsKICBpZiAoIWNvbnRleHQuY2FuTWFuYWdlKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoIlZvY8OqIG7Do28gcG9zc3VpIHBlcm1pc3PDo28g
cGFyYSBzaW5jcm9uaXphciBhIGFzc2luYXR1cmEuIik7CiAgfQoKICBjb25zdCBwcmVhcHByb3ZhbElkID1gLAogICAgICAic3Vic2NyaXB0aW9uIHN5bmMg
YXV0aG9yaXphdGlvbiIsCiAgICApOwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgovLyAxMykgQWRtaW4gc2Nhbm5lcjogY3JvbiBhdXRlbnRpY2FkbyBl
IHBlcm1pc3PDo28gcmVhbApwYXRjaCgibGliL3BsYXRmb3JtLWFkbWluLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoInwg
J3N5c3RlbS5zY2FuJyIpKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICAiICB8ICdzZXR0aW5ncy5tYW5hZ2UnXG4iLAogICAgICAi
ICB8ICdzZXR0aW5ncy5tYW5hZ2UnXG4gIHwgJ3N5c3RlbS5zY2FuJ1xuIiwKICAgICk7CiAgfQogIGlmICghY29udGVudC5pbmNsdWRlcygia2V5OiAnc3lz
dGVtLnNjYW4nIikpIHsKICAgIGNvbnN0IGFuY2hvciA9IGAgIHsKICAgIGtleTogJ3NldHRpbmdzLm1hbmFnZScsCiAgICBsYWJlbDogJ0FsdGVyYXIgY29u
ZmlndXJhw6fDtWVzJywKICAgIGRlc2NyaXB0aW9uOiAnTW9kaWZpY2FyIHJlZ3JhcyBjcsOtdGljYXMgZGEgcGxhdGFmb3JtYS4nLAogICAgc3VwcG9ydEFz
c2lnbmFibGU6IGZhbHNlLAogIH0sCl1gOwogICAgY29uc3QgcmVwbGFjZW1lbnQgPSBgICB7CiAgICBrZXk6ICdzZXR0aW5ncy5tYW5hZ2UnLAogICAgbGFi
ZWw6ICdBbHRlcmFyIGNvbmZpZ3VyYcOnw7VlcycsCiAgICBkZXNjcmlwdGlvbjogJ01vZGlmaWNhciByZWdyYXMgY3LDrXRpY2FzIGRhIHBsYXRhZm9ybWEu
JywKICAgIHN1cHBvcnRBc3NpZ25hYmxlOiBmYWxzZSwKICB9LAogIHsKICAgIGtleTogJ3N5c3RlbS5zY2FuJywKICAgIGxhYmVsOiAnRXhlY3V0YXIgc2Nh
bm5lcicsCiAgICBkZXNjcmlwdGlvbjogJ0V4ZWN1dGFyIHZhcnJlZHVyYXMgYWRtaW5pc3RyYXRpdmFzIGUgZGUgY29uc2lzdMOqbmNpYS4nLAogICAgc3Vw
cG9ydEFzc2lnbmFibGU6IGZhbHNlLAogIH0sCl1gOwogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dChjb250ZW50LCBhbmNob3IsIHJlcGxhY2VtZW50
LCAicGxhdGZvcm0gc3lzdGVtLnNjYW4gY2F0YWxvZyIpOwogIH0KICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoIiAgJ3N5c3RlbS5zY2FuJyxcbl0pIikpIHsK
ICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAgICIgICdzZXR0aW5ncy5tYW5hZ2UnLFxuXSkiLAogICAgICAiICAnc2V0dGluZ3MubWFuYWdl
JyxcbiAgJ3N5c3RlbS5zY2FuJyxcbl0pIiwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGFkbWluRmllbGRzID0iKSkgewog
ICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgY29uc3QgZW1haWwgPSByZXF1ZXN0ZXIuZW1haWwudG9Mb3dl
ckNhc2UoKQogIGNvbnN0IHsgZGF0YTogYWRtaW4sIGVycm9yIH0gPSBhd2FpdCBzdXBhYmFzZUFkbWluCiAgICAuZnJvbSgncGxhdGZvcm1fYWRtaW5zJykK
ICAgIC5zZWxlY3QoCiAgICAgICdpZCx1c2VyX2lkLGVtYWlsLHJvbGUsaXNfYWN0aXZlLG5vbWUscGVybWlzc2lvbnMsYXJlYSxvYnNlcnZhY29lcyxsYXN0
X2xvZ2luX2F0LG11c3RfY2hhbmdlX3Bhc3N3b3JkJywKICAgICkKICAgIC5vcigKICAgICAgXGB1c2VyX2lkLmVxLlwke3JlcXVlc3Rlci5pZH0sZW1haWwu
aWxpa2UuXCR7ZW1haWx9XGAsCiAgICApCiAgICAuZXEoJ2lzX2FjdGl2ZScsIHRydWUpCiAgICAubGltaXQoMSkKICAgIC5tYXliZVNpbmdsZSgpCgogIGlm
IChlcnJvciB8fCAhYWRtaW4pIHJldHVybiBudWxsYCwKICAgICAgYCAgY29uc3QgZW1haWwgPSByZXF1ZXN0ZXIuZW1haWwudG9Mb3dlckNhc2UoKQogIGNv
bnN0IGFkbWluRmllbGRzID0KICAgICdpZCx1c2VyX2lkLGVtYWlsLHJvbGUsaXNfYWN0aXZlLG5vbWUscGVybWlzc2lvbnMsYXJlYSxvYnNlcnZhY29lcyxs
YXN0X2xvZ2luX2F0LG11c3RfY2hhbmdlX3Bhc3N3b3JkJwoKICBjb25zdCBieVVzZXIgPSBhd2FpdCBzdXBhYmFzZUFkbWluCiAgICAuZnJvbSgncGxhdGZv
cm1fYWRtaW5zJykKICAgIC5zZWxlY3QoYWRtaW5GaWVsZHMpCiAgICAuZXEoJ3VzZXJfaWQnLCByZXF1ZXN0ZXIuaWQpCiAgICAuZXEoJ2lzX2FjdGl2ZScs
IHRydWUpCiAgICAubGltaXQoMSkKICAgIC5tYXliZVNpbmdsZSgpCgogIGxldCBhZG1pbiA9IGJ5VXNlci5kYXRhCiAgbGV0IGxvb2t1cEVycm9yID0gYnlV
c2VyLmVycm9yCgogIGlmICghYWRtaW4gJiYgIWxvb2t1cEVycm9yKSB7CiAgICBjb25zdCBieUVtYWlsID0gYXdhaXQgc3VwYWJhc2VBZG1pbgogICAgICAu
ZnJvbSgncGxhdGZvcm1fYWRtaW5zJykKICAgICAgLnNlbGVjdChhZG1pbkZpZWxkcykKICAgICAgLmlsaWtlKCdlbWFpbCcsIGVtYWlsKQogICAgICAuZXEo
J2lzX2FjdGl2ZScsIHRydWUpCiAgICAgIC5saW1pdCgxKQogICAgICAubWF5YmVTaW5nbGUoKQoKICAgIGFkbWluID0gYnlFbWFpbC5kYXRhCiAgICBsb29r
dXBFcnJvciA9IGJ5RW1haWwuZXJyb3IKICB9CgogIGlmIChsb29rdXBFcnJvciB8fCAhYWRtaW4pIHJldHVybiBudWxsYCwKICAgICAgInBsYXRmb3JtIGFk
bWluIGlkZW50aXR5IHdpdGhvdXQgaW50ZXJwb2xhdGVkIG9yIiwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IHNob3VsZFJl
ZnJlc2hMb2dpbiIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICBjb25zdCBwYXRjaDogUmVjb3Jk
PHN0cmluZywgdW5rbm93bj4gPSB7CiAgICBsYXN0X2xvZ2luX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICB1cGRhdGVkX2F0OiBuZXcgRGF0
ZSgpLnRvSVNPU3RyaW5nKCksCiAgfQoKICBpZiAoIWFkbWluLnVzZXJfaWQpIHsKICAgIHBhdGNoLnVzZXJfaWQgPSByZXF1ZXN0ZXIuaWQKICB9CgogIGF3
YWl0IHN1cGFiYXNlQWRtaW4KICAgIC5mcm9tKCdwbGF0Zm9ybV9hZG1pbnMnKQogICAgLnVwZGF0ZShwYXRjaCkKICAgIC5lcSgnaWQnLCBhZG1pbi5pZCkK
CiAgcmV0dXJuIHJlc29sdmVkYCwKICAgICAgYCAgY29uc3QgbGFzdExvZ2luQXQgPSBhZG1pbi5sYXN0X2xvZ2luX2F0CiAgICA/IG5ldyBEYXRlKFN0cmlu
ZyhhZG1pbi5sYXN0X2xvZ2luX2F0KSkuZ2V0VGltZSgpCiAgICA6IDAKICBjb25zdCBzaG91bGRSZWZyZXNoTG9naW4gPQogICAgIWxhc3RMb2dpbkF0IHx8
CiAgICBEYXRlLm5vdygpIC0gbGFzdExvZ2luQXQgPiA1ICogNjAgKiAxMDAwIHx8CiAgICAhYWRtaW4udXNlcl9pZAoKICBpZiAoc2hvdWxkUmVmcmVzaExv
Z2luKSB7CiAgICBjb25zdCBwYXRjaDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7CiAgICAgIGxhc3RfbG9naW5fYXQ6IG5ldyBEYXRlKCkudG9JU09T
dHJpbmcoKSwKICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgfQoKICAgIGlmICghYWRtaW4udXNlcl9pZCkgewogICAg
ICBwYXRjaC51c2VyX2lkID0gcmVxdWVzdGVyLmlkCiAgICB9CgogICAgYXdhaXQgc3VwYWJhc2VBZG1pbgogICAgICAuZnJvbSgncGxhdGZvcm1fYWRtaW5z
JykKICAgICAgLnVwZGF0ZShwYXRjaCkKICAgICAgLmVxKCdpZCcsIGFkbWluLmlkKQogIH0KCiAgcmV0dXJuIHJlc29sdmVkYCwKICAgICAgInBsYXRmb3Jt
IGFkbWluIGxvZ2luIHdyaXRlIHRocm90dGxlIiwKICAgICk7CiAgfQoKICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgiYXBwL2FwaS9hZG1pbi9zY2Fu
L3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuc3RhcnRzV2l0aCgiaW1wb3J0IHsgdGltaW5nU2FmZUVxdWFsIikpIHsKICAgIGNv
bnRlbnQgPSBgaW1wb3J0IHsgdGltaW5nU2FmZUVxdWFsIH0gZnJvbSAnbm9kZTpjcnlwdG8nXG4ke2NvbnRlbnR9YDsKICB9CiAgaWYgKCFjb250ZW50Lmlu
Y2x1ZGVzKCJmdW5jdGlvbiBpc0Nyb25SZXF1ZXN0KCIpKSB7CiAgICBjb25zdCBtYXJrZXIgPSAiXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVl
c3Q6IE5leHRSZXF1ZXN0KSI7CiAgICBjb25zdCBoZWxwZXIgPSBgCmZ1bmN0aW9uIGlzQ3JvblJlcXVlc3QocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICBj
b25zdCBzZWNyZXQgPSBTdHJpbmcocHJvY2Vzcy5lbnYuQ1JPTl9TRUNSRVQgfHwgJycpCiAgY29uc3QgaGVhZGVyID0gU3RyaW5nKHJlcXVlc3QuaGVhZGVy
cy5nZXQoJ2F1dGhvcml6YXRpb24nKSB8fCAnJykKICBjb25zdCBleHBlY3RlZCA9IFxgQmVhcmVyIFwke3NlY3JldH1cYAoKICBpZiAoIXNlY3JldCB8fCBo
ZWFkZXIubGVuZ3RoICE9PSBleHBlY3RlZC5sZW5ndGgpIHJldHVybiBmYWxzZQoKICByZXR1cm4gdGltaW5nU2FmZUVxdWFsKAogICAgQnVmZmVyLmZyb20o
aGVhZGVyKSwKICAgIEJ1ZmZlci5mcm9tKGV4cGVjdGVkKSwKICApCn0KYDsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoY29udGVudCwgbWFya2Vy
LCBgJHtoZWxwZXJ9JHttYXJrZXJ9YCwgImNyb24gYXV0aCBoZWxwZXIiKTsKICB9CiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJpZiAoaXNDcm9uUmVxdWVz
dChyZXF1ZXN0KSkgcmV0dXJuIFBPU1QocmVxdWVzdCkiKSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYGV4cG9ydCBhc3luYyBm
dW5jdGlvbiBHRVQocmVxdWVzdDogTmV4dFJlcXVlc3QpIHsKICB0cnkge2AsCiAgICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcXVlc3Q6IE5l
eHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGlmIChpc0Nyb25SZXF1ZXN0KHJlcXVlc3QpKSByZXR1cm4gUE9TVChyZXF1ZXN0KWAsCiAgICApOwogIH0KICBj
b250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgImlmICghY2FuKGFkbWluLCAnYnVncycpKSByZXR1cm4gZmFpbCgnU2VtIHBlcm1pc3PDo28gcGFyYSBz
Y2FubmVyLicsIDQwMykiLAogICAgImlmICghY2FuKGFkbWluLCAnYXVkaXQudmlldycpKSByZXR1cm4gZmFpbCgnU2VtIHBlcm1pc3PDo28gcGFyYSB2aXN1
YWxpemFyIG8gc2Nhbm5lci4nLCA0MDMpIiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGNyb25SZXF1ZXN0ID0gaXNDcm9uUmVxdWVz
dChyZXF1ZXN0KSIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICB0cnkgewogICAgY29uc3QgYWRt
aW4gPSBhd2FpdCBnZXRDdXJyZW50QWRtaW4ocmVxdWVzdCkKICAgIGlmICghYWRtaW4pIHJldHVybiBmYWlsKCdBY2Vzc28gbmVnYWRvLicsIDQwMykKICAg
IGlmICghY2FuKGFkbWluLCAnc2Nhbm5lcicpKSByZXR1cm4gZmFpbCgnU2VtIHBlcm1pc3PDo28gcGFyYSByb2RhciBzY2FubmVyLicsIDQwMykKCiAgICBj
b25zdCB7IGRhdGE6IHJ1biB9ID0gYXdhaXQgc3VwYWJhc2VBZG1pbmAsCiAgICAgIGAgIHRyeSB7CiAgICBjb25zdCBjcm9uUmVxdWVzdCA9IGlzQ3JvblJl
cXVlc3QocmVxdWVzdCkKICAgIGNvbnN0IGFkbWluID0gY3JvblJlcXVlc3QgPyBudWxsIDogYXdhaXQgZ2V0Q3VycmVudEFkbWluKHJlcXVlc3QpCgogICAg
aWYgKCFjcm9uUmVxdWVzdCAmJiAhYWRtaW4pIHJldHVybiBmYWlsKCdBY2Vzc28gbmVnYWRvLicsIDQwMykKICAgIGlmICghY3JvblJlcXVlc3QgJiYgYWRt
aW4gJiYgIWNhbihhZG1pbiwgJ3N5c3RlbS5zY2FuJykpIHsKICAgICAgcmV0dXJuIGZhaWwoJ1NlbSBwZXJtaXNzw6NvIHBhcmEgcm9kYXIgc2Nhbm5lci4n
LCA0MDMpCiAgICB9CgogICAgY29uc3QgYWN0b3JFbWFpbCA9IGNyb25SZXF1ZXN0CiAgICAgID8gJ2Nyb25Ab3JjYWx5LnN5c3RlbScKICAgICAgOiBhZG1p
bj8uZW1haWwgfHwgJ3N5c3RlbUBvcmNhbHkubG9jYWwnCgogICAgY29uc3QgeyBkYXRhOiBydW4gfSA9IGF3YWl0IHN1cGFiYXNlQWRtaW5gLAogICAgICAi
c2Nhbm5lciBjcm9uIGF1dGgiLAogICAgKTsKICB9CiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgiICAgICAgICBjcmVhdGVkX2J5OiBhZG1pbi5lbWFp
bCwiLCAiICAgICAgICBjcmVhdGVkX2J5OiBhY3RvckVtYWlsLCIpOwogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiICAgIGF3YWl0IGF1ZGl0
TG9nKGFkbWluLmVtYWlsLCAnc2Nhbm5lci5ydW5fZGV0YWlsZWQnLCIsCiAgICAiICAgIGF3YWl0IGF1ZGl0TG9nKGFjdG9yRW1haWwsICdzY2FubmVyLnJ1
bl9kZXRhaWxlZCcsIiwKICApOwogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDEzLjEpIEFkbWluaXN0cmHDp8OjbyBkZSBlcXVpcGUgY29tIGNvcnBvIGxp
bWl0YWRvIGUgcmF0ZSBsaW1pdC4KcGF0Y2goImFwcC9hcGkvYWRtaW4vdGVhbS9yb3V0ZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZElt
cG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInXG4iLAog
ICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0JyIsCiAgICAiYWRtaW4gdGVhbSByYXRlIGlt
cG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9t
ICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZy
b20gJ0AvbGliL3NlY3VyaXR5L3JlcXVlc3QnIiwKICAgICJhZG1pbiB0ZWFtIGJvZHkgaW1wb3J0IiwKICApOwoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMo
InNjb3BlOiAnYWRtaW4tdGVhbS13cml0ZSciKSkgewogICAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgICAgY29udGVudCwKICAgICAgYCAgaWYg
KCFzZXNzaW9uLm9rKSB7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oCiAgICAgIHsgZXJyb3I6IHNlc3Npb24uZXJyb3IgfSwKICAgICAgeyBzdGF0
dXM6IHNlc3Npb24uc3RhdHVzIH0sCiAgICApCiAgfQoKICB0cnkgewogICAgY29uc3QgYm9keSA9IGF3YWl0IHJlcXVlc3QKICAgICAgLmpzb24oKQogICAg
ICAuY2F0Y2goKCkgPT4gKHt9KSlgLAogICAgICBgICBpZiAoIXNlc3Npb24ub2spIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbigKICAgICAgeyBl
cnJvcjogc2Vzc2lvbi5lcnJvciB9LAogICAgICB7IHN0YXR1czogc2Vzc2lvbi5zdGF0dXMgfSwKICAgICkKICB9CgogIHRyeSB7CiAgICBjb25zdCBibG9j
a2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNjb3BlOiAnYWRtaW4tdGVhbS13cml0ZScsCiAgICAgIGlkZW50aXR5OiBz
ZXNzaW9uLmFkbWluLmlkLAogICAgICBsaW1pdDogMzAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSkKICAgIGlmIChibG9ja2VkKSByZXR1cm4g
YmxvY2tlZAoKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAg
ICAzMiAqIDEwMjQsCiAgICApYCwKICAgICAgImFkbWluIHRlYW0gYm91bmRlZCBib2R5IiwKICAgICk7CiAgfQoKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMo
ImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcikiKSkgewogICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAg
ICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgICBgICB9IGNhdGNoIChlcnJvcikgewogICAgY29u
c3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikgcmV0dXJuIGJvZHlFcnJvcgoKICAgIHJl
dHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKCi8vIDEzLjIpIEFkbWluIGRlIGFmaWxpYWRvcyBl
IHRyb2NhIGRlIHNlbmhhIGNvbSBsaW1pdGVzIGUgbWV0YWRhdGEgcHJlc2VydmFkYS4KcGF0Y2goImFwcC9hcGkvYWRtaW4vYWZmaWxpYXRlcy9yb3V0ZS50
cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IGFkZEltcG9ydEFmdGVyKAogICAgY29udGVudCwKICAgICJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4
dFJlc3BvbnNlIH0gZnJvbSAnbmV4dC9zZXJ2ZXInXG4iLAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9y
YXRlLWxpbWl0JyIsCiAgICAiYWRtaW4gYWZmaWxpYXRlcyByYXRlIGltcG9ydCIsCiAgKTsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250
ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyBy
ZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JlcXVlc3QnIiwKICAgICJhZG1pbiBhZmZpbGlh
dGVzIGJvZHkgaW1wb3J0IiwKICApOwoKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYGV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcXVl
c3Q6IE5leHRSZXF1ZXN0KSB7CiAgdHJ5IHsKICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXF1ZXN0CiAgICAgIC5qc29uKCkKICAgICAgLmNhdGNoKCgpID0+
ICh7fSkpYCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXF1ZXN0OiBOZXh0UmVxdWVzdCkgewogIHRyeSB7CiAgICBjb25zdCBibG9ja2Vk
ID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1ZXN0LCB7CiAgICAgIHNjb3BlOiAnYWRtaW4tYWZmaWxpYXRlLWFjdGlvbnMnLAogICAgICBsaW1pdDog
NjAsCiAgICAgIHdpbmRvd1NlY29uZHM6IDYwLAogICAgfSkKICAgIGlmIChibG9ja2VkKSByZXR1cm4gYmxvY2tlZAoKICAgIGNvbnN0IGJvZHkgPSBhd2Fp
dCByZWFkSnNvbkJvZHk8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KAogICAgICByZXF1ZXN0LAogICAgICAzMiAqIDEwMjQsCiAgICApYCwKICApOwoKICBp
ZiAoIWNvbnRlbnQuaW5jbHVkZXMoImNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcikiKSkgewogICAgY29udGVudCA9
IGNvbnRlbnQucmVwbGFjZSgKICAgICAgYCAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgICBgICB9IGNh
dGNoIChlcnJvcikgewogICAgY29uc3QgYm9keUVycm9yID0gcmVxdWVzdEJvZHlFcnJvclJlc3BvbnNlKGVycm9yKQogICAgaWYgKGJvZHlFcnJvcikgcmV0
dXJuIGJvZHlFcnJvcgoKICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihgLAogICAgKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFw
cC9hcGkvYWRtaW4vY2hhbmdlLXBhc3N3b3JkL3JvdXRlLnRzIiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250
ZW50LAogICAgImltcG9ydCB7IE5leHRSZXF1ZXN0LCBOZXh0UmVzcG9uc2UgfSBmcm9tICduZXh0L3NlcnZlcidcbiIsCiAgICAiaW1wb3J0IHsgZW5mb3Jj
ZVJhdGVMaW1pdCB9IGZyb20gJ0AvbGliL3NlY3VyaXR5L3JhdGUtbGltaXQnIiwKICAgICJhZG1pbiBwYXNzd29yZCByYXRlIGltcG9ydCIsCiAgKTsKICBj
b250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IGVuZm9yY2VSYXRlTGltaXQgfSBmcm9tICdAL2xpYi9zZWN1cml0
eS9yYXRlLWxpbWl0J1xuIiwKICAgICJpbXBvcnQgeyByZWFkSnNvbkJvZHksIHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZSB9IGZyb20gJ0AvbGliL3NlY3Vy
aXR5L3JlcXVlc3QnIiwKICAgICJhZG1pbiBwYXNzd29yZCBib2R5IGltcG9ydCIsCiAgKTsKCiAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgKICAgIGAg
IHRyeSB7CiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVxdWVzdAogICAgICAuanNvbigpCiAgICAgIC5jYXRjaCgoKSA9PiAoe30pKQogICAgY29uc3QgcGFz
c3dvcmQgPSB0ZXh0KGJvZHkucGFzc3dvcmQpYCwKICAgIGAgIHRyeSB7CiAgICBjb25zdCBibG9ja2VkID0gYXdhaXQgZW5mb3JjZVJhdGVMaW1pdChyZXF1
ZXN0LCB7CiAgICAgIHNjb3BlOiAnYWRtaW4tcGFzc3dvcmQtY2hhbmdlJywKICAgICAgaWRlbnRpdHk6IHNlc3Npb24uYWRtaW4uaWQsCiAgICAgIGxpbWl0
OiAxMCwKICAgICAgd2luZG93U2Vjb25kczogMzYwMCwKICAgIH0pCiAgICBpZiAoYmxvY2tlZCkgcmV0dXJuIGJsb2NrZWQKCiAgICBjb25zdCBib2R5ID0g
YXdhaXQgcmVhZEpzb25Cb2R5PFJlY29yZDxzdHJpbmcsIHVua25vd24+PigKICAgICAgcmVxdWVzdCwKICAgICAgOCAqIDEwMjQsCiAgICApCiAgICBjb25z
dCBwYXNzd29yZCA9IHRleHQoYm9keS5wYXNzd29yZClgLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3QgZXhpc3RpbmdBdXRoVXNlciA9
IikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgICAgY29uc3QgeyBlcnJvciB9ID0KICAgICAgYXdh
aXQgc2Vzc2lvbi5zdXBhYmFzZUFkbWluLmF1dGguYWRtaW4udXBkYXRlVXNlckJ5SWQoCiAgICAgICAgc2Vzc2lvbi5hZG1pbi51c2VyX2lkLAogICAgICAg
IHsKICAgICAgICAgIHBhc3N3b3JkLAogICAgICAgICAgdXNlcl9tZXRhZGF0YTogewogICAgICAgICAgICBtdXN0X2NoYW5nZV9wYXNzd29yZDogZmFsc2Us
CiAgICAgICAgICB9LAogICAgICAgIH0sCiAgICAgICkKCiAgICBpZiAoZXJyb3IpIHRocm93IGVycm9yYCwKICAgICAgYCAgICBjb25zdCBleGlzdGluZ0F1
dGhVc2VyID0KICAgICAgYXdhaXQgc2Vzc2lvbi5zdXBhYmFzZUFkbWluLmF1dGguYWRtaW4uZ2V0VXNlckJ5SWQoCiAgICAgICAgc2Vzc2lvbi5hZG1pbi51
c2VyX2lkLAogICAgICApCgogICAgaWYgKAogICAgICBleGlzdGluZ0F1dGhVc2VyLmVycm9yIHx8CiAgICAgICFleGlzdGluZ0F1dGhVc2VyLmRhdGEudXNl
cj8uaWQKICAgICkgewogICAgICB0aHJvdyAoCiAgICAgICAgZXhpc3RpbmdBdXRoVXNlci5lcnJvciB8fAogICAgICAgIG5ldyBFcnJvcignQ29udGEgYWRt
aW5pc3RyYXRpdmEgbsOjbyBlbmNvbnRyYWRhLicpCiAgICAgICkKICAgIH0KCiAgICBjb25zdCB7IGVycm9yIH0gPQogICAgICBhd2FpdCBzZXNzaW9uLnN1
cGFiYXNlQWRtaW4uYXV0aC5hZG1pbi51cGRhdGVVc2VyQnlJZCgKICAgICAgICBzZXNzaW9uLmFkbWluLnVzZXJfaWQsCiAgICAgICAgewogICAgICAgICAg
cGFzc3dvcmQsCiAgICAgICAgICB1c2VyX21ldGFkYXRhOiB7CiAgICAgICAgICAgIC4uLihleGlzdGluZ0F1dGhVc2VyLmRhdGEudXNlci51c2VyX21ldGFk
YXRhIHx8IHt9KSwKICAgICAgICAgICAgbXVzdF9jaGFuZ2VfcGFzc3dvcmQ6IGZhbHNlLAogICAgICAgICAgfSwKICAgICAgICB9LAogICAgICApCgogICAg
aWYgKGVycm9yKSB0aHJvdyBlcnJvcmAsCiAgICAgICJhZG1pbiBwYXNzd29yZCBtZXRhZGF0YSBtZXJnZSIsCiAgICApOwogIH0KCiAgaWYgKCFjb250ZW50
LmluY2x1ZGVzKCJjb25zdCBib2R5RXJyb3IgPSByZXF1ZXN0Qm9keUVycm9yUmVzcG9uc2UoZXJyb3IpIikpIHsKICAgIGNvbnRlbnQgPSBjb250ZW50LnJl
cGxhY2UoCiAgICAgIGAgIH0gY2F0Y2ggKGVycm9yKSB7CiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgICAgYCAgfSBjYXRjaCAoZXJyb3Ip
IHsKICAgIGNvbnN0IGJvZHlFcnJvciA9IHJlcXVlc3RCb2R5RXJyb3JSZXNwb25zZShlcnJvcikKICAgIGlmIChib2R5RXJyb3IpIHJldHVybiBib2R5RXJy
b3IKCiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oYCwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCgovLyAxNCkgSGVhbHRoIGNoZWNr
IGNvZXJlbnRlIGNvbSBkb2lzIGJhY2tlbmRzIGRlIElBICsgU3RvcmFnZSByZWFsCnBhdGNoKCJhcHAvYXBpL3N5c3RlbS9oZWFsdGgvcm91dGUudHMiLCAo
Y29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3QgeyBkYXRhOiBzdG9yYWdlQnVja2V0cyIpKSB7CiAgICBjb250ZW50ID0gcmVw
bGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgIGNvbnN0IGNvbXBhbnlJZCA9IGFjY2Vzcy5jb21wYW55LmlkCgogICAgY29uc3QgW2As
CiAgICAgIGAgICAgY29uc3QgY29tcGFueUlkID0gYWNjZXNzLmNvbXBhbnkuaWQKCiAgICBjb25zdCB7IGRhdGE6IHN0b3JhZ2VCdWNrZXRzLCBlcnJvcjog
c3RvcmFnZUVycm9yIH0gPQogICAgICBhd2FpdCBzdXBhYmFzZUFkbWluLnN0b3JhZ2UubGlzdEJ1Y2tldHMoKQogICAgY29uc3Qgc3RvcmFnZU5hbWVzID0g
bmV3IFNldCgKICAgICAgKHN0b3JhZ2VCdWNrZXRzIHx8IFtdKS5tYXAoKGJ1Y2tldCkgPT4gYnVja2V0Lm5hbWUpLAogICAgKQogICAgY29uc3QgcmVxdWly
ZWRTdG9yYWdlQnVja2V0cyA9IFsKICAgICAgJ3NpdGUtYXNzZXRzJywKICAgICAgJ3Byb2R1dG9zJywKICAgICAgJ2ZpbmFuY2Vpcm8nLAogICAgICAnYXJ0
ZXMnLAogICAgXQogICAgY29uc3QgbWlzc2luZ1N0b3JhZ2VCdWNrZXRzID0gcmVxdWlyZWRTdG9yYWdlQnVja2V0cy5maWx0ZXIoCiAgICAgIChidWNrZXQp
ID0+ICFzdG9yYWdlTmFtZXMuaGFzKGJ1Y2tldCksCiAgICApCgogICAgY29uc3QgW2AsCiAgICAgICJoZWFsdGggc3RvcmFnZSBjaGVjayIsCiAgICApOwog
IH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgIGNvbnRlbnQsCiAgICBgICAgICAgewogICAgICAgIGtleTogJ3N0b3JhZ2UnLAogICAgICAg
IHRpdGxlOiAnU3RvcmFnZSBkZSBpbWFnZW5zJywKICAgICAgICBvazogdHJ1ZSwKICAgICAgICBkZXNjcmlwdGlvbjogJ0J1Y2tldCBzaXRlLWFzc2V0cyBk
ZXZlIGV4aXN0aXIgbm8gU3VwYWJhc2UuJywKICAgICAgfSxgLAogICAgYCAgICAgIHsKICAgICAgICBrZXk6ICdzdG9yYWdlJywKICAgICAgICB0aXRsZTog
J1N1cGFiYXNlIFN0b3JhZ2UnLAogICAgICAgIG9rOiAhc3RvcmFnZUVycm9yICYmIG1pc3NpbmdTdG9yYWdlQnVja2V0cy5sZW5ndGggPT09IDAsCiAgICAg
ICAgZGVzY3JpcHRpb246IHN0b3JhZ2VFcnJvcgogICAgICAgICAgPyAnTsOjbyBmb2kgcG9zc8OtdmVsIGNvbnN1bHRhciBvcyBidWNrZXRzLicKICAgICAg
ICAgIDogbWlzc2luZ1N0b3JhZ2VCdWNrZXRzLmxlbmd0aAogICAgICAgICAgICA/IFxgQnVja2V0cyBhdXNlbnRlczogXCR7bWlzc2luZ1N0b3JhZ2VCdWNr
ZXRzLmpvaW4oJywgJyl9LlxgCiAgICAgICAgICAgIDogJ0J1Y2tldHMgZXNzZW5jaWFpcyBkaXNwb27DrXZlaXMuJywKICAgICAgfSxgLAogICAgImhlYWx0
aCBzdG9yYWdlIHRydXRoZnVsIiwKICApOwoKICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgY29udGVudCwKICAgIGAgICAgICB7CiAgICAgICAg
a2V5OiAnb3BlbmFpJywKICAgICAgICB0aXRsZTogJ09wZW5BSSAvIElBJywKICAgICAgICBvazogQm9vbGVhbihwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tF
WSksCiAgICAgICAgZGVzY3JpcHRpb246ICdDaGF2ZSB1c2FkYSBwZWxvIGFzc2lzdGVudGUgSUEuJywKICAgICAgfSxgLAogICAgYCAgICAgIHsKICAgICAg
ICBrZXk6ICdvcGVuYWlfZGlyZWN0JywKICAgICAgICB0aXRsZTogJ0lBIGludGVybmEgLyBPcGVuQUknLAogICAgICAgIG9rOiBCb29sZWFuKHByb2Nlc3Mu
ZW52Lk9QRU5BSV9BUElfS0VZKSwKICAgICAgICBkZXNjcmlwdGlvbjogJ0NyZWRlbmNpYWwgZG8gYXNzaXN0ZW50ZSBpbnRlcm5vIGNvbmZpZ3VyYWRhLics
CiAgICAgIH0sCiAgICAgIHsKICAgICAgICBrZXk6ICdhaV9nYXRld2F5JywKICAgICAgICB0aXRsZTogJ0lBIHDDumJsaWNhIC8gVmVyY2VsIEFJIEdhdGV3
YXknLAogICAgICAgIG9rOiBCb29sZWFuKAogICAgICAgICAgcHJvY2Vzcy5lbnYuQUlfR0FURVdBWV9BUElfS0VZIHx8CiAgICAgICAgICBwcm9jZXNzLmVu
di5WRVJDRUxfT0lEQ19UT0tFTgogICAgICAgICksCiAgICAgICAgZGVzY3JpcHRpb246ICdDcmVkZW5jaWFsIG91IGlkZW50aWRhZGUgZG8gQUkgR2F0ZXdh
eSBkaXNwb27DrXZlbC4nLAogICAgICB9LAogICAgICB7CiAgICAgICAga2V5OiAnY3JvbicsCiAgICAgICAgdGl0bGU6ICdDcm9uIGFkbWluaXN0cmF0aXZv
JywKICAgICAgICBvazogQm9vbGVhbihwcm9jZXNzLmVudi5DUk9OX1NFQ1JFVCksCiAgICAgICAgZGVzY3JpcHRpb246ICdDUk9OX1NFQ1JFVCBwcm90ZWdl
IGEgZXhlY3XDp8OjbyBhdXRvbcOhdGljYSBkbyBzY2FubmVyLicsCiAgICAgIH0sYCwKICAgICJoZWFsdGggQUkgYW5kIGNyb24iLAogICk7CiAgcmV0dXJu
IGNvbnRlbnQ7Cn0pOwoKCi8vIDE0LjEpIENvbmZpZ3VyYcOnw6NvIGRlY2xhcmFkYSBzZW0gcXVhbHF1ZXIgc2VncmVkbyByZWFsLgpwYXRjaCgiLmVudi5l
eGFtcGxlIiwgKGNvbnRlbnQpID0+IHsKICBjb25zdCBhZGRpdGlvbnMgPSBgCiMgSUEKT1BFTkFJX0FQSV9LRVk9Ck9SQ0FMWV9BSV9NT0RFTD0KQUlfR0FU
RVdBWV9BUElfS0VZPQoKIyBWZXJjZWwgQ3JvbgpDUk9OX1NFQ1JFVD0KCiMgQXNhYXMgLSByZXBhc3NlcyBlIGxlZ2FkbyBjb250cm9sYWRvIHBvciBmbGFn
cwpBU0FBU19FTlY9c2FuZGJveApBU0FBU19BUElfQkFTRV9VUkw9CkFTQUFTX01BU1RFUl9BUElfS0VZPQpBU0FBU19ST09UX1dBTExFVF9JRD0KQVNBQVNf
V0VCSE9PS19BVVRIX1RPS0VOPQpBU0FBU19QUk9EVUNUSU9OX0FQUFJPVkVEPWZhbHNlCkFTQUFTX0VOQUJMRUQ9ZmFsc2UKQVNBQVNfU1VCQUNDT1VOVFNf
RU5BQkxFRD1mYWxzZQpBU0FBU19NQVJLRVRQTEFDRV9FTkFCTEVEPWZhbHNlCkFTQUFTX1NVQlNDUklQVElPTlNfRU5BQkxFRD1mYWxzZQpBU0FBU19DQVJE
X1RPS0VOSVpBVElPTl9FTkFCTEVEPWZhbHNlClBBWU1FTlRfQ0hFQ0tPVVRfVjJfRU5BQkxFRD1mYWxzZQpQQVlNRU5UX1BST1ZJREVSX0RFRkFVTFQ9bWVy
Y2Fkb19wYWdvCk9SQ0FMWV9GT1JDRV9ORVdfUEFZTUVOVFM9ZmFsc2UKYDsKCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJDUk9OX1NFQ1JFVD0iKSkgewog
ICAgY29udGVudCA9IGAke2NvbnRlbnQudHJpbUVuZCgpfVxuJHthZGRpdGlvbnN9YDsKICB9CiAgcmV0dXJuIGAke2NvbnRlbnQudHJpbUVuZCgpfVxuYDsK
fSk7CgovLyAxNSkgR2l0aWdub3JlIGxpbXBvCmNyZWF0ZU9yUmVwbGFjZSgiLmdpdGlnbm9yZSIsIGAjIGRlcGVuZGVuY2llcwovbm9kZV9tb2R1bGVzCi8u
cG5wCi5wbnAuKgoueWFybi8qCiEueWFybi9wYXRjaGVzCiEueWFybi9wbHVnaW5zCiEueWFybi9yZWxlYXNlcwohLnlhcm4vdmVyc2lvbnMKCiMgdGVzdGlu
ZwovY292ZXJhZ2UKCiMgbmV4dC5qcwovLm5leHQvCi9vdXQvCgojIHByb2R1Y3Rpb24KL2J1aWxkCgojIG1pc2MKLkRTX1N0b3JlCioucGVtCioudHNidWls
ZGluZm8KbmV4dC1lbnYuZC50cwoKIyBkZWJ1ZyBhbmQgbG9jYWwgcmVwb3J0cwpucG0tZGVidWcubG9nKgp5YXJuLWRlYnVnLmxvZyoKeWFybi1lcnJvci5s
b2cqCi5wbnBtLWRlYnVnLmxvZyoKKi5sb2cKL3FhLW9yY2FseS0qLwovcWEtKi50eHQKL2F1ZGl0b3JpYS0qLnR4dAovcmVzdWx0YWRvLSoudHh0Ci9yZXN1
bHRhZG8tKi5qc29uCgojIGVudmlyb25tZW50IGFuZCBkZXBsb3ltZW50Ci5lbnYqCiEuZW52LmV4YW1wbGUKLnZlcmNlbC8KCiMgbG9jYWwgYmFja3VwcyBh
bmQgb25lLW9mZiByZXBhaXIgYXJ0aWZhY3RzCi8ub3JjYWx5LSovCi9vcmNhbHktcGF5bWVudC1mbG93cy1waGFzZTEvCi9vcmNhbHktcGF5bWVudC1mbG93
cy1waGFzZTEuemlwCi8qLnBzMQoKIyBsb2NhbCBoYXJkZW5pbmcgb3V0cHV0Ci8ub3JjYWx5LWhhcmRlbmluZy1sb2NhbC8KL2hhcmRlbmluZy1yZXBvcnQt
Ki5qc29uCi9oYXJkZW5pbmctcmVwb3J0LSoudHh0CmApOwoKLy8gMTYpIFNlY3VyaXR5IGNoZWNrZXIgcGVybWFuZW50ZSBlIGFicmFuZ2VudGUuCgovLyAx
OS44KSBJZGVtcG90w6puY2lhIHJlY29ycmVudGUgZGUgYXNzaW5hdHVyYSBlIGVzdG9ybm8gc2VndXJvIGRlIGFjZXNzby4KcGF0Y2goImxpYi9zdWJzY3Jp
cHRpb24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlVGV4dCgKICAgIGNvbnRlbnQsCiAgICBgZXhwb3J0IGFz
eW5jIGZ1bmN0aW9uIG1lcmNhZG9QYWdvUGxhdGZvcm1SZXF1ZXN0KAogIHBhdGg6IHN0cmluZywKICBvcHRpb25zOiBSZXF1ZXN0SW5pdCA9IHt9LAopIHsK
ICByZXR1cm4gc3Vic2NyaXB0aW9uTWVyY2Fkb1BhZ29SZXF1ZXN0KHBhdGgsIG9wdGlvbnMpOwp9YCwKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gbWVy
Y2Fkb1BhZ29QbGF0Zm9ybVJlcXVlc3QoCiAgcGF0aDogc3RyaW5nLAogIG9wdGlvbnM6IFJlcXVlc3RJbml0ID0ge30sCiAgaWRlbXBvdGVuY3lLZXk/OiBz
dHJpbmcsCikgewogIHJldHVybiBzdWJzY3JpcHRpb25NZXJjYWRvUGFnb1JlcXVlc3QoCiAgICBwYXRoLAogICAgb3B0aW9ucywKICAgIGlkZW1wb3RlbmN5
S2V5LAogICk7Cn1gLAogICAgInN1YnNjcmlwdGlvbiBwbGF0Zm9ybSByZXF1ZXN0IGlkZW1wb3RlbmN5IHBhc3N0aHJvdWdoIiwKICApOwoKICBpZiAoIWNv
bnRlbnQuaW5jbHVkZXMoImV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQiKSkgewogICAgY29uc3Qg
YW5jaG9yID0gYGV4cG9ydCBmdW5jdGlvbiBwYXJzZU9yY2FseVN1YnNjcmlwdGlvblJlZmVyZW5jZSh2YWx1ZTogdW5rbm93bikge2A7CiAgICBjb25zdCBo
ZWxwZXIgPSBgZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlY29uY2lsZVJldmVyc2VkU3Vic2NyaXB0aW9uUGF5bWVudCgKICBhZG1pbjogUmV0dXJuVHlwZTx0
eXBlb2YgZ2V0U3VwYWJhc2VBZG1pbj4sCiAgY29tcGFueTogYW55LAogIHByb3ZpZGVyUmVmZXJlbmNlOiBzdHJpbmcsCiAgcHJvdmlkZXJTdGF0dXM6IHN0
cmluZywKKSB7CiAgY29uc3QgY29tcGFueUlkID0gU3RyaW5nKGNvbXBhbnk/LmlkIHx8ICIiKS50cmltKCk7CiAgY29uc3QgcmVmZXJlbmNlID0gU3RyaW5n
KHByb3ZpZGVyUmVmZXJlbmNlIHx8ICIiKS50cmltKCk7CiAgY29uc3QgcmVtb3RlU3RhdHVzID0gU3RyaW5nKHByb3ZpZGVyU3RhdHVzIHx8ICJyZXZlcnNl
ZCIpCiAgICAudHJpbSgpCiAgICAudG9Mb3dlckNhc2UoKTsKCiAgaWYgKCFjb21wYW55SWQgfHwgIXJlZmVyZW5jZSkgewogICAgcmV0dXJuIHsgcm9sbGVk
QmFjazogZmFsc2UsIHJlYXNvbjogIm1pc3NpbmdfcmVmZXJlbmNlIiB9OwogIH0KCiAgY29uc3QgeyBkYXRhOiBhcHByb3ZhbEV2ZW50LCBlcnJvcjogZXZl
bnRFcnJvciB9ID0gYXdhaXQgYWRtaW4KICAgIC5mcm9tKCJzdWJzY3JpcHRpb25fZXZlbnRzIikKICAgIC5zZWxlY3QoIm1ldGFkYXRhLGNyZWF0ZWRfYXQi
KQogICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgLmVxKCJldmVudF90eXBlIiwgInBheW1lbnRfYXBwcm92ZWQiKQogICAgLmVxKCJwcm92
aWRlcl9yZWZlcmVuY2UiLCByZWZlcmVuY2UpCiAgICAub3JkZXIoImNyZWF0ZWRfYXQiLCB7IGFzY2VuZGluZzogZmFsc2UgfSkKICAgIC5saW1pdCgxKQog
ICAgLm1heWJlU2luZ2xlKCk7CgogIGlmIChldmVudEVycm9yKSB0aHJvdyBldmVudEVycm9yOwoKICBjb25zdCBtZXRhZGF0YSA9CiAgICBhcHByb3ZhbEV2
ZW50Py5tZXRhZGF0YSAmJgogICAgdHlwZW9mIGFwcHJvdmFsRXZlbnQubWV0YWRhdGEgPT09ICJvYmplY3QiICYmCiAgICAhQXJyYXkuaXNBcnJheShhcHBy
b3ZhbEV2ZW50Lm1ldGFkYXRhKQogICAgICA/IChhcHByb3ZhbEV2ZW50Lm1ldGFkYXRhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KQogICAgICA6IHt9
OwogIGNvbnN0IGdyYW50ZWRVbnRpbCA9IHZhbGlkRGF0ZShtZXRhZGF0YS5hY2Nlc3NfdW50aWwpOwogIGNvbnN0IHByZXZpb3VzVW50aWwgPSB2YWxpZERh
dGUobWV0YWRhdGEucHJldmlvdXNfYWNjZXNzX3VudGlsKTsKCiAgY29uc3QgeyBkYXRhOiBmcmVzaENvbXBhbnksIGVycm9yOiBjb21wYW55RXJyb3IgfSA9
IGF3YWl0IGFkbWluCiAgICAuZnJvbSgiY29tcGFuaWVzIikKICAgIC5zZWxlY3QoIioiKQogICAgLmVxKCJpZCIsIGNvbXBhbnlJZCkKICAgIC5tYXliZVNp
bmdsZSgpOwoKICBpZiAoY29tcGFueUVycm9yKSB0aHJvdyBjb21wYW55RXJyb3I7CiAgaWYgKCFmcmVzaENvbXBhbnk/LmlkKSB7CiAgICByZXR1cm4geyBy
b2xsZWRCYWNrOiBmYWxzZSwgcmVhc29uOiAiY29tcGFueV9ub3RfZm91bmQiIH07CiAgfQoKICBjb25zdCBjdXJyZW50VW50aWwgPSBtYXhEYXRlKAogICAg
ZnJlc2hDb21wYW55LmFjY2Vzc191bnRpbCwKICAgIGZyZXNoQ29tcGFueS5hc3NpbmF0dXJhX2V4cGlyYV9lbSwKICApOwogIGNvbnN0IHNhbWVHcmFudCA9
IEJvb2xlYW4oCiAgICBncmFudGVkVW50aWwgJiYKICAgICAgY3VycmVudFVudGlsICYmCiAgICAgIE1hdGguYWJzKGN1cnJlbnRVbnRpbC5nZXRUaW1lKCkg
LSBncmFudGVkVW50aWwuZ2V0VGltZSgpKSA8PSA1MDAwLAogICk7CiAgbGV0IHJvbGxlZEJhY2sgPSBmYWxzZTsKICBsZXQgbmV3U3RhdHVzID0gZnJlc2hD
b21wYW55LmFzc2luYXR1cmFfc3RhdHVzIHx8IG51bGw7CiAgbGV0IHJvbGxiYWNrVW50aWw6IERhdGUgfCBudWxsID0gY3VycmVudFVudGlsOwoKICBpZiAo
c2FtZUdyYW50KSB7CiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpOwogICAgcm9sbGJhY2tVbnRpbCA9IHByZXZpb3VzVW50aWwgJiYgcHJldmlvdXNVbnRp
bCA+IG5vdwogICAgICA/IHByZXZpb3VzVW50aWwKICAgICAgOiBub3c7CiAgICBuZXdTdGF0dXMgPSAicGFzdF9kdWUiOwoKICAgIGNvbnN0IHsgZXJyb3I6
IHJvbGxiYWNrRXJyb3IgfSA9IGF3YWl0IGFkbWluCiAgICAgIC5mcm9tKCJjb21wYW5pZXMiKQogICAgICAudXBkYXRlKHsKICAgICAgICBhc3NpbmF0dXJh
X3N0YXR1czogbmV3U3RhdHVzLAogICAgICAgIGFzc2luYXR1cmFfZXhwaXJhX2VtOiByb2xsYmFja1VudGlsLnRvSVNPU3RyaW5nKCksCiAgICAgICAgYWNj
ZXNzX3VudGlsOiByb2xsYmFja1VudGlsLnRvSVNPU3RyaW5nKCksCiAgICAgICAgYXNzaW5hdHVyYV9waXhfYXZ1bHNvX3N0YXR1czoKICAgICAgICAgIFN0
cmluZyhmcmVzaENvbXBhbnkuYXNzaW5hdHVyYV9mb3JtYV9wYWdhbWVudG9fcHJlZmVyaWRhIHx8ICIiKQogICAgICAgICAgICAudG9Mb3dlckNhc2UoKQog
ICAgICAgICAgICAuaW5jbHVkZXMoInBpeCIpCiAgICAgICAgICAgID8gcmVtb3RlU3RhdHVzCiAgICAgICAgICAgIDogZnJlc2hDb21wYW55LmFzc2luYXR1
cmFfcGl4X2F2dWxzb19zdGF0dXMgfHwgbnVsbCwKICAgICAgICB1cGRhdGVkX2F0OiBub3cudG9JU09TdHJpbmcoKSwKICAgICAgfSkKICAgICAgLmVxKCJp
ZCIsIGNvbXBhbnlJZCk7CgogICAgaWYgKHJvbGxiYWNrRXJyb3IpIHRocm93IHJvbGxiYWNrRXJyb3I7CiAgICByb2xsZWRCYWNrID0gdHJ1ZTsKICB9Cgog
IGF3YWl0IHJlY29yZFN1YnNjcmlwdGlvbkV2ZW50KGFkbWluLCB7CiAgICBjb21wYW55SWQsCiAgICBldmVudFR5cGU6ICJwYXltZW50X3JldmVyc2VkIiwK
ICAgIG9sZFN0YXR1czogZnJlc2hDb21wYW55LmFzc2luYXR1cmFfc3RhdHVzIHx8IG51bGwsCiAgICBuZXdTdGF0dXMsCiAgICBwcm92aWRlclJlZmVyZW5j
ZTogcmVmZXJlbmNlICsgIjoiICsgcmVtb3RlU3RhdHVzLAogICAgbWV0YWRhdGE6IHsKICAgICAgb3JpZ2luYWxfcHJvdmlkZXJfcmVmZXJlbmNlOiByZWZl
cmVuY2UsCiAgICAgIHByb3ZpZGVyX3N0YXR1czogcmVtb3RlU3RhdHVzLAogICAgICByb2xsZWRfYmFjazogcm9sbGVkQmFjaywKICAgICAgZ3JhbnRlZF9h
Y2Nlc3NfdW50aWw6IGdyYW50ZWRVbnRpbD8udG9JU09TdHJpbmcoKSB8fCBudWxsLAogICAgICBwcmV2aW91c19hY2Nlc3NfdW50aWw6IHByZXZpb3VzVW50
aWw/LnRvSVNPU3RyaW5nKCkgfHwgbnVsbCwKICAgICAgY3VycmVudF9hY2Nlc3NfdW50aWw6IGN1cnJlbnRVbnRpbD8udG9JU09TdHJpbmcoKSB8fCBudWxs
LAogICAgICByZXN1bHRpbmdfYWNjZXNzX3VudGlsOiByb2xsYmFja1VudGlsPy50b0lTT1N0cmluZygpIHx8IG51bGwsCiAgICB9LAogIH0pOwoKICByZXR1
cm4gewogICAgcm9sbGVkQmFjaywKICAgIGFjY2Vzc1VudGlsOiByb2xsYmFja1VudGlsPy50b0lTT1N0cmluZygpIHx8IG51bGwsCiAgfTsKfQoKYDsKICAg
IGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGFuY2hvciwKICAgICAgYCR7aGVscGVyfSR7YW5jaG9yfWAsCiAgICAg
ICJzdWJzY3JpcHRpb24gcmV2ZXJzYWwgaGVscGVyIiwKICAgICk7CiAgfQoKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgYCAgICAgIGFtb3Vu
dDogb3B0aW9ucy5hbW91bnQgfHwgbnVsbCwKICAgICAgYWNjZXNzX3VudGlsOiBuZXdBY2Nlc3NVbnRpbC50b0lTT1N0cmluZygpLGAsCiAgICBgICAgICAg
YW1vdW50OiBvcHRpb25zLmFtb3VudCB8fCBudWxsLAogICAgICBwcmV2aW91c19hY2Nlc3NfdW50aWw6IGN1cnJlbnRFbmQ/LnRvSVNPU3RyaW5nKCkgfHwg
bnVsbCwKICAgICAgYWNjZXNzX3VudGlsOiBuZXdBY2Nlc3NVbnRpbC50b0lTT1N0cmluZygpLGAsCiAgKTsKCiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0
Y2goImxpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMo
ImV4aXN0aW5nUGF5bWVudFJvdyIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VSZWdleCgKICAgICAgY29udGVudCwKICAgICAgLyAgY29uc3QgXHsg
ZGF0YTogcGF5bWVudFJvdywgZXJyb3I6IHBheW1lbnRFcnJvciBcfSA9W1xzXFNdKj8gIGNvbnN0IGV4dGVybmFsUmVmZXJlbmNlID0gYnVpbGRTdWJzY3Jp
cHRpb25SZWZlcmVuY2VcKFx7XG4gICAga2luZDogInJlY3VycmluZyIsXG4gICAgY29tcGFueUlkLFxuICAgIHBsYW46IHBsYW5LZXksXG4gICAgcGF5bWVu
dFJvd0lkOiBTdHJpbmdcKHBheW1lbnRSb3dcLmlkXCksXG4gIFx9XCk7LywKICAgICAgYCAgY29uc3QgeyBkYXRhOiBleGlzdGluZ1BheW1lbnRSb3csIGVy
cm9yOiBleGlzdGluZ1BheW1lbnRFcnJvciB9ID0KICAgIGF3YWl0IGNvbnRleHQuYWRtaW4KICAgICAgLmZyb20oInBsYW5fcGF5bWVudHMiKQogICAgICAu
c2VsZWN0KCIqIikKICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgICAuZXEoImlkZW1wb3RlbmN5X2tleSIsIGlkZW1wb3RlbmN5S2V5
KQogICAgICAubWF5YmVTaW5nbGUoKTsKCiAgaWYgKGV4aXN0aW5nUGF5bWVudEVycm9yKSB0aHJvdyBleGlzdGluZ1BheW1lbnRFcnJvcjsKCiAgbGV0IHBh
eW1lbnRSb3cgPSBleGlzdGluZ1BheW1lbnRSb3cgYXMgSnNvblJlY29yZCB8IG51bGw7CgogIGlmICgKICAgIHBheW1lbnRSb3cgJiYKICAgIG5vcm1hbGl6
ZVBsYW5LZXkocGF5bWVudFJvdy5wbGFubykgIT09IHBsYW5LZXkKICApIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigiQSBj
aGF2ZSBkZSBpZGVtcG90w6puY2lhIGrDoSBmb2kgdXNhZGEgZW0gb3V0cm8gcGxhbm8uIiksCiAgICAgIHsgc3RhdHVzOiA0MDkgfSwKICAgICk7CiAgfQoK
ICBpZiAoIXBheW1lbnRSb3cpIHsKICAgIGNvbnN0IGluc2VydGVkID0gYXdhaXQgY29udGV4dC5hZG1pbgogICAgICAuZnJvbSgicGxhbl9wYXltZW50cyIp
CiAgICAgIC5pbnNlcnQoewogICAgICAgIGNvbXBhbnlfaWQ6IGNvbXBhbnlJZCwKICAgICAgICBwbGFubzogcGxhbktleSwKICAgICAgICB2YWxvcjogcGxh
bi5wcmljZSwKICAgICAgICBzdGF0dXM6ICJjcmVhdGVkIiwKICAgICAgICB0aXBvOiAic3Vic2NyaXB0aW9uIiwKICAgICAgICBwYXltZW50X21ldGhvZDog
ImNhcmRfcmVjdXJyaW5nIiwKICAgICAgICBwcm92aWRlcjogIm1lcmNhZG9fcGFnbyIsCiAgICAgICAgaWRlbXBvdGVuY3lfa2V5OiBpZGVtcG90ZW5jeUtl
eSwKICAgICAgICBlbWFpbDogcGF5ZXJFbWFpbCwKICAgICAgICBub21lX2VtcHJlc2E6IHRleHQoY29tcGFueS5ub21lKSB8fCAiRW1wcmVzYSIsCiAgICAg
IH0pCiAgICAgIC5zZWxlY3QoIioiKQogICAgICAuc2luZ2xlKCk7CgogICAgaWYgKGluc2VydGVkLmVycm9yIHx8ICFpbnNlcnRlZC5kYXRhPy5pZCkgewog
ICAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICAgIG5ldyBFcnJvcigKICAgICAgICAgIGluc2VydGVkLmVycm9yPy5tZXNzYWdlIHx8CiAgICAgICAg
ICAgICJOYW8gZm9pIHBvc3NpdmVsIHByZXBhcmFyIGEgYXNzaW5hdHVyYS4iLAogICAgICAgICksCiAgICAgICAgeyBzdGF0dXM6IDUwMCB9LAogICAgICAp
OwogICAgfQoKICAgIHBheW1lbnRSb3cgPSBpbnNlcnRlZC5kYXRhIGFzIEpzb25SZWNvcmQ7CiAgfQoKICBjb25zdCBleHRlcm5hbFJlZmVyZW5jZSA9CiAg
ICB0ZXh0KHBheW1lbnRSb3cuZXh0ZXJuYWxfcmVmZXJlbmNlKSB8fAogICAgYnVpbGRTdWJzY3JpcHRpb25SZWZlcmVuY2UoewogICAgICBraW5kOiAicmVj
dXJyaW5nIiwKICAgICAgY29tcGFueUlkLAogICAgICBwbGFuOiBwbGFuS2V5LAogICAgICBwYXltZW50Um93SWQ6IFN0cmluZyhwYXltZW50Um93LmlkKSwK
ICAgIH0pOwoKICBpZiAoIXRleHQocGF5bWVudFJvdy5leHRlcm5hbF9yZWZlcmVuY2UpKSB7CiAgICBjb25zdCB7IGVycm9yOiByZWZlcmVuY2VFcnJvciB9
ID0gYXdhaXQgY29udGV4dC5hZG1pbgogICAgICAuZnJvbSgicGxhbl9wYXltZW50cyIpCiAgICAgIC51cGRhdGUoewogICAgICAgIGV4dGVybmFsX3JlZmVy
ZW5jZTogZXh0ZXJuYWxSZWZlcmVuY2UsCiAgICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICB9KQogICAgICAuZXEo
ImlkIiwgcGF5bWVudFJvdy5pZCkKICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKTsKCiAgICBpZiAocmVmZXJlbmNlRXJyb3IpIHRocm93IHJl
ZmVyZW5jZUVycm9yOwogICAgcGF5bWVudFJvdy5leHRlcm5hbF9yZWZlcmVuY2UgPSBleHRlcm5hbFJlZmVyZW5jZTsKICB9YCwKICAgICAgInRyYW5zcGFy
ZW50IHN1YnNjcmlwdGlvbiBpZGVtcG90ZW50IHJvdyByZXVzZSIsCiAgICApOwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAgICBjb250
ZW50LAogICAgLyAgbGV0IHN1YnNjcmlwdGlvbjogSnNvblJlY29yZDtcblxuICB0cnkgXHtbXHNcU10qP1xuICBcfVxuXG4gIGNvbnN0IHN1YnNjcmlwdGlv
bklkID0gdGV4dFwoc3Vic2NyaXB0aW9uXC5pZFwpOy8sCiAgICBgICBsZXQgc3Vic2NyaXB0aW9uOiBKc29uUmVjb3JkOwogIGNvbnN0IGV4aXN0aW5nU3Vi
c2NyaXB0aW9uSWQgPSB0ZXh0KAogICAgcGF5bWVudFJvdy5wcm92aWRlcl9zdWJzY3JpcHRpb25faWQgfHwKICAgICAgcGF5bWVudFJvdy5tZXJjYWRvX3Bh
Z29fcHJlYXBwcm92YWxfaWQsCiAgKTsKCiAgaWYgKGV4aXN0aW5nU3Vic2NyaXB0aW9uSWQpIHsKICAgIHN1YnNjcmlwdGlvbiA9IChhd2FpdCBtZXJjYWRv
UGFnb1BsYXRmb3JtUmVxdWVzdCgKICAgICAgXGAvcHJlYXBwcm92YWwvXCR7ZW5jb2RlVVJJQ29tcG9uZW50KGV4aXN0aW5nU3Vic2NyaXB0aW9uSWQpfVxg
LAogICAgKSkgYXMgSnNvblJlY29yZDsKICB9IGVsc2UgewogICAgdHJ5IHsKICAgICAgc3Vic2NyaXB0aW9uID0KICAgICAgICAoYXdhaXQgbWVyY2Fkb1Bh
Z29QbGF0Zm9ybVJlcXVlc3QoCiAgICAgICAgICAiL3ByZWFwcHJvdmFsIiwKICAgICAgICAgIHsKICAgICAgICAgICAgbWV0aG9kOiAiUE9TVCIsCiAgICAg
ICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsKICAgICAgICAgICAgICByZWFzb246IFxgUGxhbm8gXCR7cGxhbi5uYW1lfSAtIE9yY2FseVxgLAogICAg
ICAgICAgICAgIGV4dGVybmFsX3JlZmVyZW5jZTogZXh0ZXJuYWxSZWZlcmVuY2UsCiAgICAgICAgICAgICAgcGF5ZXJfZW1haWw6IHBheWVyRW1haWwsCiAg
ICAgICAgICAgICAgY2FyZF90b2tlbl9pZDogY2FyZFRva2VuSWQsCiAgICAgICAgICAgICAgYXV0b19yZWN1cnJpbmc6IGF1dG9SZWN1cnJpbmcsCiAgICAg
ICAgICAgICAgYmFja191cmw6IFxgXCR7Z2V0QXBwVXJsKCl9L3BhaW5lbC9hc3NpbmF0dXJhXGAsCiAgICAgICAgICAgICAgc3RhdHVzOiAiYXV0aG9yaXpl
ZCIsCiAgICAgICAgICAgIH0pLAogICAgICAgICAgfSwKICAgICAgICAgIGlkZW1wb3RlbmN5S2V5LAogICAgICAgICkpIGFzIEpzb25SZWNvcmQ7CiAgICB9
IGNhdGNoIChlcnJvcikgewogICAgICBjb25zdCBwcm92aWRlclN0YXR1cyA9CiAgICAgICAgZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAib2JqZWN0IiAm
JiAic3RhdHVzIiBpbiBlcnJvcgogICAgICAgICAgPyBOdW1iZXIoKGVycm9yIGFzIHsgc3RhdHVzPzogbnVtYmVyIH0pLnN0YXR1cyB8fCAwKQogICAgICAg
ICAgOiAwOwoKICAgICAgYXdhaXQgY29udGV4dC5hZG1pbgogICAgICAgIC5mcm9tKCJwbGFuX3BheW1lbnRzIikKICAgICAgICAudXBkYXRlKHsKICAgICAg
ICAgIHN0YXR1czoKICAgICAgICAgICAgcHJvdmlkZXJTdGF0dXMgPj0gNDAwICYmIHByb3ZpZGVyU3RhdHVzIDwgNTAwCiAgICAgICAgICAgICAgPyAiZmFp
bGVkIgogICAgICAgICAgICAgIDogImNyZWF0aW5nIiwKICAgICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICB9
KQogICAgICAgIC5lcSgiaWQiLCBwYXltZW50Um93LmlkKQogICAgICAgIC5lcSgiY29tcGFueV9pZCIsIGNvbXBhbnlJZCk7CgogICAgICB0aHJvdyBlcnJv
cjsKICAgIH0KICB9CgogIGNvbnN0IHN1YnNjcmlwdGlvbklkID0gdGV4dChzdWJzY3JpcHRpb24uaWQpO2AsCiAgICAidHJhbnNwYXJlbnQgc3Vic2NyaXB0
aW9uIHByb3ZpZGVyIGlkZW1wb3RlbmN5IiwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgoKcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1w
YWdvLXRyYW5zcGFyZW50LnRzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoIWNvbnRlbnQuaW5jbHVkZXMoInNhbWVJZGVtcG90ZW50U3Vic2NyaXB0aW9uIikp
IHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZVRleHQoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIGlmICgKICAgIGN1cnJlbnRTdWJzY3JpcHRpb25JZCAm
JgogICAgWyJhdXRob3JpemVkIiwgInBlbmRpbmciLCAicGF1c2VkIl0uaW5jbHVkZXMoCiAgICAgIGN1cnJlbnRQcm92aWRlclN0YXR1cywKICAgICkgJiYK
ICAgICFCb29sZWFuKGNvbXBhbnkuY2FuY2VsX2F0X3BlcmlvZF9lbmQpCiAgKSB7CiAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICBuZXcgRXJyb3Io
CiAgICAgICAgIkVzdGEgZW1wcmVzYSBqYSBwb3NzdWkgdW1hIGFzc2luYXR1cmEgcmVjb3JyZW50ZS4iLAogICAgICApLAogICAgICB7IHN0YXR1czogNDA5
IH0sCiAgICApOwogIH1gLAogICAgICBgICBjb25zdCB7IGRhdGE6IGN1cnJlbnRJZGVtcG90ZW50Um93LCBlcnJvcjogY3VycmVudElkZW1wb3RlbnRFcnJv
ciB9ID0KICAgIGF3YWl0IGNvbnRleHQuYWRtaW4KICAgICAgLmZyb20oInBsYW5fcGF5bWVudHMiKQogICAgICAuc2VsZWN0KCJwcm92aWRlcl9zdWJzY3Jp
cHRpb25faWQsbWVyY2Fkb19wYWdvX3ByZWFwcHJvdmFsX2lkIikKICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgICAuZXEoImlkZW1w
b3RlbmN5X2tleSIsIGlkZW1wb3RlbmN5S2V5KQogICAgICAubWF5YmVTaW5nbGUoKTsKCiAgaWYgKGN1cnJlbnRJZGVtcG90ZW50RXJyb3IpIHRocm93IGN1
cnJlbnRJZGVtcG90ZW50RXJyb3I7CgogIGNvbnN0IGlkZW1wb3RlbnRTdWJzY3JpcHRpb25JZCA9IHRleHQoCiAgICBjdXJyZW50SWRlbXBvdGVudFJvdz8u
cHJvdmlkZXJfc3Vic2NyaXB0aW9uX2lkIHx8CiAgICAgIGN1cnJlbnRJZGVtcG90ZW50Um93Py5tZXJjYWRvX3BhZ29fcHJlYXBwcm92YWxfaWQsCiAgKTsK
ICBjb25zdCBzYW1lSWRlbXBvdGVudFN1YnNjcmlwdGlvbiA9IEJvb2xlYW4oCiAgICBjdXJyZW50U3Vic2NyaXB0aW9uSWQgJiYKICAgICAgaWRlbXBvdGVu
dFN1YnNjcmlwdGlvbklkICYmCiAgICAgIGN1cnJlbnRTdWJzY3JpcHRpb25JZCA9PT0gaWRlbXBvdGVudFN1YnNjcmlwdGlvbklkLAogICk7CgogIGlmICgK
ICAgIGN1cnJlbnRTdWJzY3JpcHRpb25JZCAmJgogICAgWyJhdXRob3JpemVkIiwgInBlbmRpbmciLCAicGF1c2VkIl0uaW5jbHVkZXMoCiAgICAgIGN1cnJl
bnRQcm92aWRlclN0YXR1cywKICAgICkgJiYKICAgICFCb29sZWFuKGNvbXBhbnkuY2FuY2VsX2F0X3BlcmlvZF9lbmQpICYmCiAgICAhc2FtZUlkZW1wb3Rl
bnRTdWJzY3JpcHRpb24KICApIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigKICAgICAgICAiRXN0YSBlbXByZXNhIGphIHBv
c3N1aSB1bWEgYXNzaW5hdHVyYSByZWNvcnJlbnRlLiIsCiAgICAgICksCiAgICAgIHsgc3RhdHVzOiA0MDkgfSwKICAgICk7CiAgfWAsCiAgICAgICJ0cmFu
c3BhcmVudCBzdWJzY3JpcHRpb24gc2FtZSBpZGVtcG90ZW50IHJldHJ5IiwKICAgICk7CiAgfQogIHJldHVybiBjb250ZW50Owp9KTsKCnBhdGNoKCJjb21w
b25lbnRzL3N1YnNjcmlwdGlvbi9NZXJjYWRvUGFnb1N1YnNjcmlwdGlvbkNoZWNrb3V0LnRzeCIsIChjb250ZW50KSA9PiB7CiAgaWYgKCFjb250ZW50Lmlu
Y2x1ZGVzKCdyZWN1cnJpbmdJZGVtcG90ZW5jeVJlZi5jdXJyZW50ID0gIiI7XG4gICAgICAgICAgc2V0UGF5bWVudFN0YXR1cygicGFpZCIpOycpKSB7CiAg
ICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgICAgICAgIHNldFBheW1lbnRTdGF0dXMoInBhaWQiKTsKICAg
ICAgICAgIHNldE1lc3NhZ2UoIlJlbm92YcOnw6NvIGF1dG9tw6F0aWNhIGF0aXZhZGEuIik7YCwKICAgICAgYCAgICAgICAgICByZWN1cnJpbmdJZGVtcG90
ZW5jeVJlZi5jdXJyZW50ID0gIiI7CiAgICAgICAgICBzZXRQYXltZW50U3RhdHVzKCJwYWlkIik7CiAgICAgICAgICBzZXRNZXNzYWdlKCJSZW5vdmHDp8Oj
byBhdXRvbcOhdGljYSBhdGl2YWRhLiIpO2AsCiAgICAgICJyZWN1cnJpbmcgY2hlY2tvdXQgY2xlYXIgaWRlbXBvdGVuY3kgb24gc3VjY2VzcyIsCiAgICAp
OwogIH0KICByZXR1cm4gY29udGVudDsKfSk7CgpwYXRjaCgibGliL3N1YnNjcmlwdGlvbi1jaGVja291dC1wYXltZW50LnRzIiwgKGNvbnRlbnQpID0+IHsK
ICBjb250ZW50ID0gYWRkSW1wb3J0QWZ0ZXIoCiAgICBjb250ZW50LAogICAgJyAgYXBwbHlBcHByb3ZlZFN1YnNjcmlwdGlvblBheW1lbnQsXG4nLAogICAg
JyAgcmVjb25jaWxlUmV2ZXJzZWRTdWJzY3JpcHRpb25QYXltZW50LCcsCiAgICAic3Vic2NyaXB0aW9uIG9uZS10aW1lIHJldmVyc2FsIGltcG9ydCIsCiAg
KTsKCiAgaWYgKCFjb250ZW50LmluY2x1ZGVzKCJhd2FpdCByZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQoXG4gICAgICAgIGFkbWluLFxu
ICAgICAgICBjb21wYW55LCIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2VUZXh0KAogICAgICBjb250ZW50LAogICAgICBgICAgICAgYXdhaXQgcmV2
ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHBheW1lbnRJZCwKICAgICAgICBcYFBhZ2FtZW50byBc
JHtyZW1vdGVTdGF0dXN9IG5vIE1lcmNhZG8gUGFnby5cYCwKICAgICAgKS5jYXRjaCgoYWZmaWxpYXRlRXJyb3IpID0+IHsKICAgICAgICBjb25zb2xlLmVy
cm9yKAogICAgICAgICAgIm9yY2FseV9hZmZpbGlhdGVfcmV2ZXJzYWxfZXJyb3IiLAogICAgICAgICAgYWZmaWxpYXRlRXJyb3IgaW5zdGFuY2VvZiBFcnJv
cgogICAgICAgICAgICA/IGFmZmlsaWF0ZUVycm9yLm1lc3NhZ2UKICAgICAgICAgICAgOiBhZmZpbGlhdGVFcnJvciwKICAgICAgICApOwogICAgICB9KTtg
LAogICAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHBheW1lbnRJ
ZCwKICAgICAgICBcYFBhZ2FtZW50byBcJHtyZW1vdGVTdGF0dXN9IG5vIE1lcmNhZG8gUGFnby5cYCwKICAgICAgKS5jYXRjaCgoYWZmaWxpYXRlRXJyb3Ip
ID0+IHsKICAgICAgICBjb25zb2xlLmVycm9yKAogICAgICAgICAgIm9yY2FseV9hZmZpbGlhdGVfcmV2ZXJzYWxfZXJyb3IiLAogICAgICAgICAgYWZmaWxp
YXRlRXJyb3IgaW5zdGFuY2VvZiBFcnJvcgogICAgICAgICAgICA/IGFmZmlsaWF0ZUVycm9yLm1lc3NhZ2UKICAgICAgICAgICAgOiBhZmZpbGlhdGVFcnJv
ciwKICAgICAgICApOwogICAgICB9KTsKCiAgICAgIGF3YWl0IHJlY29uY2lsZVJldmVyc2VkU3Vic2NyaXB0aW9uUGF5bWVudCgKICAgICAgICBhZG1pbiwK
ICAgICAgICBjb21wYW55LAogICAgICAgIHBheW1lbnRJZCwKICAgICAgICByZW1vdGVTdGF0dXMsCiAgICAgICk7YCwKICAgICAgInN1YnNjcmlwdGlvbiBv
bmUtdGltZSBhY2Nlc3MgcmV2ZXJzYWwiLAogICAgKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKcGF0Y2goImFwcC9hcGkvbWVyY2Fkby1wYWdvL3dl
Ymhvb2svcm91dGUudHMiLCAoY29udGVudCkgPT4gewogIGNvbnRlbnQgPSBhZGRJbXBvcnRBZnRlcigKICAgIGNvbnRlbnQsCiAgICAnICByZWNvcmRTdWJz
Y3JpcHRpb25FdmVudCxcbicsCiAgICAnICByZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQsJywKICAgICJzdWJzY3JpcHRpb24gd2ViaG9v
ayByZXZlcnNhbCBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNv
bW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHByb3ZpZGVyUmVmZXJlbmNlLAogICAgICAgIFxgUGFnYW1lbnRvIHJlY29ycmVu
dGUgXCR7cGF5bWVudFN0YXR1c30uXGAsCiAgICAgICk7YCwKICAgIGAgICAgICBhd2FpdCByZXZlcnNlQWZmaWxpYXRlQ29tbWlzc2lvbkZvclBheW1lbnQo
CiAgICAgICAgYWRtaW4sCiAgICAgICAgcHJvdmlkZXJSZWZlcmVuY2UsCiAgICAgICAgXGBQYWdhbWVudG8gcmVjb3JyZW50ZSBcJHtwYXltZW50U3RhdHVz
fS5cYCwKICAgICAgKTsKICAgICAgYXdhaXQgcmVjb25jaWxlUmV2ZXJzZWRTdWJzY3JpcHRpb25QYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIGZv
dW5kLmNvbXBhbnksCiAgICAgICAgcHJvdmlkZXJSZWZlcmVuY2UsCiAgICAgICAgcGF5bWVudFN0YXR1cywKICAgICAgKTtgLAogICk7CgogIGNvbnRlbnQg
PSBjb250ZW50LnJlcGxhY2UoCiAgICBgICAgICAgYXdhaXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAog
ICAgICAgIHByb3ZpZGVyUmVmZXJlbmNlLAogICAgICAgIFxgUGFnYW1lbnRvIFBpeCBcJHtzdGF0dXN9LlxgLAogICAgICApO2AsCiAgICBgICAgICAgYXdh
aXQgcmV2ZXJzZUFmZmlsaWF0ZUNvbW1pc3Npb25Gb3JQYXltZW50KAogICAgICAgIGFkbWluLAogICAgICAgIHByb3ZpZGVyUmVmZXJlbmNlLAogICAgICAg
IFxgUGFnYW1lbnRvIFBpeCBcJHtzdGF0dXN9LlxgLAogICAgICApOwogICAgICBhd2FpdCByZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlwdGlvblBheW1lbnQo
CiAgICAgICAgYWRtaW4sCiAgICAgICAgZm91bmQuY29tcGFueSwKICAgICAgICBwcm92aWRlclJlZmVyZW5jZSwKICAgICAgICBzdGF0dXMsCiAgICAgICk7
YCwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgoKLy8gMTkuOSkgQXBsaWNhw6fDo28gZGUgcGFnYW1lbnRvIGFwcm92YWRhIGV4YXRhbWVudGUgdW1h
IHZleiwgbWVzbW8gY29tIHdlYmhvb2tzIHJlcGV0aWRvcy4KcGF0Y2goImxpYi9zdWJzY3JpcHRpb24tc2VydmljZS50cyIsIChjb250ZW50KSA9PiB7CiAg
Y29udGVudCA9IHJlcGxhY2VPbmNlUmVnZXgoCiAgICBjb250ZW50LAogICAgL2V4cG9ydCBhc3luYyBmdW5jdGlvbiBhcHBseUFwcHJvdmVkU3Vic2NyaXB0
aW9uUGF5bWVudFwoW1xzXFNdKlxuXH1ccyokLywKICAgIGBleHBvcnQgYXN5bmMgZnVuY3Rpb24gYXBwbHlBcHByb3ZlZFN1YnNjcmlwdGlvblBheW1lbnQo
CiAgYWRtaW46IFJldHVyblR5cGU8dHlwZW9mIGdldFN1cGFiYXNlQWRtaW4+LAogIGNvbXBhbnk6IGFueSwKICBvcHRpb25zOiB7CiAgICBwbGFuPzogdW5r
bm93bjsKICAgIHByb3ZpZGVyUmVmZXJlbmNlOiBzdHJpbmc7CiAgICBwcmVhcHByb3ZhbElkPzogc3RyaW5nIHwgbnVsbDsKICAgIG5leHRQYXltZW50RGF0
ZT86IHN0cmluZyB8IG51bGw7CiAgICBwYXltZW50VHlwZTogInBpeCIgfCAiY2FyZCIgfCAiY2FyZF9yZWN1cnJpbmciOwogICAgYW1vdW50PzogbnVtYmVy
IHwgbnVsbDsKICB9LAopIHsKICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpOwogIGNvbnN0IHBsYW5LZXkgPSBub3JtYWxpemVQbGFuKAogICAgb3B0aW9ucy5w
bGFuIHx8IGNvbXBhbnkuYXNzaW5hdHVyYV9wbGFubyB8fCBjb21wYW55LnBsYW5vLAogICk7CiAgY29uc3QgY3VycmVudEVuZCA9IG1heERhdGUoCiAgICBj
b21wYW55LmFjY2Vzc191bnRpbCwKICAgIGNvbXBhbnkuYXNzaW5hdHVyYV9leHBpcmFfZW0sCiAgKTsKICBjb25zdCBwcm92aWRlck5leHQgPSB2YWxpZERh
dGUob3B0aW9ucy5uZXh0UGF5bWVudERhdGUpOwogIGNvbnN0IG5ld0FjY2Vzc1VudGlsID0KICAgIHByb3ZpZGVyTmV4dCAmJiBwcm92aWRlck5leHQgPiBu
b3cKICAgICAgPyBwcm92aWRlck5leHQKICAgICAgOiBhZGRNb250aChjdXJyZW50RW5kICYmIGN1cnJlbnRFbmQgPiBub3cgPyBjdXJyZW50RW5kIDogbm93
KTsKICBjb25zdCBwcm92aWRlclJlZmVyZW5jZSA9IFN0cmluZyhvcHRpb25zLnByb3ZpZGVyUmVmZXJlbmNlIHx8ICIiKS50cmltKCk7CgogIGlmICghcHJv
dmlkZXJSZWZlcmVuY2UpIHsKICAgIHRocm93IG5ldyBFcnJvcigiUmVmZXLDqm5jaWEgZG8gcGFnYW1lbnRvIGFwcm92YWRhIGF1c2VudGUuIik7CiAgfQoK
ICBjb25zdCB7IGRhdGE6IGFwcGxpZWQsIGVycm9yOiBhcHBseUVycm9yIH0gPSBhd2FpdCBhZG1pbi5ycGMoCiAgICAib3JjYWx5X2FwcGx5X3N1YnNjcmlw
dGlvbl9wYXltZW50X29uY2UiLAogICAgewogICAgICBwX2NvbXBhbnlfaWQ6IGNvbXBhbnkuaWQsCiAgICAgIHBfcHJvdmlkZXJfcmVmZXJlbmNlOiBwcm92
aWRlclJlZmVyZW5jZSwKICAgICAgcF9wbGFuOiBwbGFuS2V5LAogICAgICBwX3BheW1lbnRfdHlwZTogb3B0aW9ucy5wYXltZW50VHlwZSwKICAgICAgcF9h
bW91bnQ6IG9wdGlvbnMuYW1vdW50IHx8IG51bGwsCiAgICAgIHBfcHJldmlvdXNfc3RhdHVzOiBjb21wYW55LmFzc2luYXR1cmFfc3RhdHVzIHx8IG51bGws
CiAgICAgIHBfcHJldmlvdXNfYWNjZXNzX3VudGlsOiBjdXJyZW50RW5kPy50b0lTT1N0cmluZygpIHx8IG51bGwsCiAgICAgIHBfbmV3X2FjY2Vzc191bnRp
bDogbmV3QWNjZXNzVW50aWwudG9JU09TdHJpbmcoKSwKICAgICAgcF9wcmVhcHByb3ZhbF9pZDogb3B0aW9ucy5wcmVhcHByb3ZhbElkIHx8IG51bGwsCiAg
ICAgIHBfbmV4dF9wYXltZW50X2RhdGU6IG9wdGlvbnMubmV4dFBheW1lbnREYXRlIHx8IG51bGwsCiAgICB9LAogICk7CgogIGlmIChhcHBseUVycm9yKSB0
aHJvdyBhcHBseUVycm9yOwoKICBjb25zdCB7IGRhdGE6IHVwZGF0ZWRDb21wYW55LCBlcnJvcjogY29tcGFueUVycm9yIH0gPSBhd2FpdCBhZG1pbgogICAg
LmZyb20oImNvbXBhbmllcyIpCiAgICAuc2VsZWN0KCIqIikKICAgIC5lcSgiaWQiLCBjb21wYW55LmlkKQogICAgLnNpbmdsZSgpOwoKICBpZiAoY29tcGFu
eUVycm9yIHx8ICF1cGRhdGVkQ29tcGFueT8uaWQpIHsKICAgIHRocm93IGNvbXBhbnlFcnJvciB8fCBuZXcgRXJyb3IoIkVtcHJlc2EgbsOjbyBlbmNvbnRy
YWRhIGFww7NzIHBhZ2FtZW50by4iKTsKICB9CgogIHRyeSB7CiAgICBhd2FpdCBjcmVhdGVBZmZpbGlhdGVDb21taXNzaW9uRm9yQXBwcm92ZWRQYXltZW50
KAogICAgICBhZG1pbiwKICAgICAgdXBkYXRlZENvbXBhbnksCiAgICAgIHsKICAgICAgICBwcm92aWRlclBheW1lbnRJZDogcHJvdmlkZXJSZWZlcmVuY2Us
CiAgICAgICAgcGxhbjogcGxhbktleSwKICAgICAgICBhbW91bnQ6IG9wdGlvbnMuYW1vdW50IHx8IG51bGwsCiAgICAgICAgcGFpZEF0OiBub3cudG9JU09T
dHJpbmcoKSwKICAgICAgfSwKICAgICk7CiAgfSBjYXRjaCAoYWZmaWxpYXRlRXJyb3IpIHsKICAgIGNvbnNvbGUuZXJyb3IoCiAgICAgICJvcmNhbHlfYWZm
aWxpYXRlX2NvbW1pc3Npb25fZXJyb3IiLAogICAgICBhZmZpbGlhdGVFcnJvciBpbnN0YW5jZW9mIEVycm9yCiAgICAgICAgPyBhZmZpbGlhdGVFcnJvci5t
ZXNzYWdlCiAgICAgICAgOiBhZmZpbGlhdGVFcnJvciwKICAgICk7CiAgfQoKICBpZiAoYXBwbGllZCAhPT0gdHJ1ZSkgewogICAgcmV0dXJuIHVwZGF0ZWRD
b21wYW55OwogIH0KCiAgcmV0dXJuIHVwZGF0ZWRDb21wYW55Owp9YCwKICAgICJzdWJzY3JpcHRpb24gcGF5bWVudCBhcHBseSBleGFjdGx5IG9uY2UiLAog
ICk7CiAgcmV0dXJuIGNvbnRlbnQ7Cn0pOwoKY3JlYXRlT3JSZXBsYWNlKCJzY3JpcHRzL3NlY3VyaXR5LWNoZWNrLm1qcyIsIGBpbXBvcnQgZnMgZnJvbSAn
bm9kZTpmcycKaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJwppbXBvcnQgeyBleGVjRmlsZVN5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnCgpj
b25zdCByb290ID0gcHJvY2Vzcy5jd2QoKQpjb25zdCBmYWlsdXJlcyA9IFtdCmNvbnN0IHdhcm5pbmdzID0gW10KCmZ1bmN0aW9uIHJlYWQoZmlsZSkgewog
IHJldHVybiBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJvb3QsIGZpbGUpLCAndXRmOCcpCn0KCmZ1bmN0aW9uIHJlcXVpcmVUZXh0KGZpbGUsIHRleHQs
IGxhYmVsKSB7CiAgaWYgKCFyZWFkKGZpbGUpLmluY2x1ZGVzKHRleHQpKSBmYWlsdXJlcy5wdXNoKFxgXCR7bGFiZWx9OiBcJHtmaWxlfVxgKQp9CgpmdW5j
dGlvbiBmb3JiaWRUZXh0KGZpbGUsIHRleHQsIGxhYmVsKSB7CiAgaWYgKHJlYWQoZmlsZSkuaW5jbHVkZXModGV4dCkpIGZhaWx1cmVzLnB1c2goXGBcJHts
YWJlbH06IFwke2ZpbGV9XGApCn0KCnJlcXVpcmVUZXh0KCdsaWIvb3JjYWx5LXNlY3VyaXR5LnRzJywgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JywgJ0NT
UCBvYnJpZ2F0b3JpYSBhdXNlbnRlJykKZm9yYmlkVGV4dCgnbGliL29yY2FseS1zZWN1cml0eS50cycsICdDb250ZW50LVNlY3VyaXR5LVBvbGljeS1SZXBv
cnQtT25seScsICdDU1AgYWluZGEgZXN0YSBhcGVuYXMgZW0gcmVwb3J0LW9ubHknKQpyZXF1aXJlVGV4dCgKICAnbGliL21lcmNhZG8tcGFnby50cycsCiAg
J2lmICghc2VjcmV0IHx8ICF4U2lnbmF0dXJlIHx8ICF4UmVxdWVzdElkIHx8ICFkYXRhSWQpIHJldHVybiBmYWxzZScsCiAgJ1dlYmhvb2sgYWluZGEgcGVy
bWl0ZSBzZWdyZWRvIGF1c2VudGUnLAopCmZvcmJpZFRleHQoJ2xpYi9hZG1pbi1hdXRoLnRzJywgJ2FyYXVqb3ZpbmljaXVzMjQ5QGdtYWlsLmNvbScsICdT
dXBlciBhZG1pbiBmaXhvIG5vIGNvZGlnbycpCmZvcmJpZFRleHQoJ2xpYi9jb21wYW55LWFjY2Vzcy50cycsICdhcmF1am92aW5pY2l1czI0OUBnbWFpbC5j
b20nLCAnU3VwZXIgYWRtaW4gZml4byBubyBhY2Vzc28gZGEgZW1wcmVzYScpCmZvcmJpZFRleHQoJ2xpYi9jb21wYW55LWFjY2Vzcy50cycsICIuZnJvbSgn
YWRtaW5fdXNlcnMnKSIsICdhZG1pbl91c2VycyBhaW5kYSBhdHVhIGNvbW8gYXV0b3JpZGFkZSBhZG1pbmlzdHJhdGl2YScpCmZvcmJpZFRleHQoJ2xpYi9j
b21wYW55LWFjY2Vzcy50cycsICdzaG91bGRBdHRhY2hPd25lcicsICdWaW5jdWxvIGF1dG9tYXRpY28gcG9yIGUtbWFpbCBhaW5kYSBhdGl2bycpCmZvcmJp
ZFRleHQoJ3Byb3h5LnRzJywgJ3ZpbmljaXVzYWRtQG9yY2FseS5jb20nLCAnT3duZXIgZGEgcGxhdGFmb3JtYSBhaW5kYSBlc3RhIGZpeG8gcG9yIGUtbWFp
bCBubyBwcm94eScpCmZvcmJpZFRleHQoJ2FwcC9hcGkvcHVibGljLXNpdGUvW3NsdWddL3JvdXRlLnRzJywgIi5zZWxlY3QoJyonKSIsICdBUEkgcHVibGlj
YSBhaW5kYSBzZWxlY2lvbmEgdG9kb3Mgb3MgY2FtcG9zJykKcmVxdWlyZVRleHQoJ2xpYi9hZmZpbGlhdGVzL3dvcmtzcGFjZS50cycsICdpc1ZhbGlkQ291
cnNlTGVzc29uJywgJ0FjYWRlbWlhIHNlbSB2YWxpZGFjYW8gc2VydmVyLXNpZGUnKQpmb3JiaWRUZXh0KCdsaWIvYWZmaWxpYXRlcy93b3Jrc3BhY2UudHMn
LCAndG90YWxTY29yZSA9IGNsZWFuTnVtYmVyKGJvZHkudG90YWxTY29yZScsICdUcmVpbmFtZW50byBhaW5kYSBjb25maWEgZW0gbm90YSBkbyBjbGllbnRl
JykKZm9yYmlkVGV4dCgnbGliL3BhbmVsLXN0b3JhZ2UudHMnLCAnaW1hZ2Uvc3ZnK3htbCcsICdMb2dvIGFpbmRhIGFjZWl0YSBTVkcgbmFvIHNhbml0aXph
ZG8nKQpmb3JiaWRUZXh0KCdhcHAvYXBpL3B1YmxpYy9ob21lLWNoYXQvcm91dGUudHMnLCAnZmFpbE9wZW46IHRydWUnLCAnQ2hhdCBwYWdvIGFpbmRhIGFi
cmUgbyByYXRlIGxpbWl0IGVtIGZhbGhhJykKcmVxdWlyZVRleHQoJ2FwcC9hcGkvYWRtaW4vc2Nhbi9yb3V0ZS50cycsICdDUk9OX1NFQ1JFVCcsICdTY2Fu
bmVyIGNyb24gc2VtIHNlZ3JlZG8nKQpyZXF1aXJlVGV4dCgnYXBwL2FwaS9jb21wYW55L2N1cnJlbnQvcm91dGUudHMnLCAnZ2V0Q29tcGFueVN1YnNjcmlw
dGlvbkFjY2VzcycsICdBY2Vzc28gZGEgZW1wcmVzYSBzZW0gcmVncmEgY2Fub25pY2EgZGUgYXNzaW5hdHVyYScpCmZvcmJpZFRleHQoCiAgJ2FwcC9hcGkv
bWFya2V0cGxhY2UvcGF5bWVudHMvd2ViaG9vay9tZXJjYWRvLXBhZ28vcm91dGUudHMnLAogICdOb3RpZmljYWNhbyBsZWdhZGEgc2VtIGFzc2luYXR1cmEn
LAogICdXZWJob29rIG1hcmtldHBsYWNlIGFpbmRhIGFjZWl0YSBub3RpZmljYWNhbyBzZW0gYXNzaW5hdHVyYScsCikKcmVxdWlyZVRleHQoCiAgJ2FwcC9h
cGkvbWFya2V0cGxhY2UvcGF5bWVudHMvd2ViaG9vay9tZXJjYWRvLXBhZ28vcm91dGUudHMnLAogICdjbGVhblNlbnNpdGl2ZVBheWxvYWQnLAogICdXZWJo
b29rIG1hcmtldHBsYWNlIGFpbmRhIHBlcnNpc3RlIHBheWxvYWQgZmluYW5jZWlybyBzZW0gc2FuaXRpemFjYW8nLAopCnJlcXVpcmVUZXh0KAogICdhcHAv
YXBpL2xlYWRzL2NvbXBsZXRlLWFjY291bnQvcm91dGUudHMnLAogICd2ZXJpZnlTaWdudXBDaGVja291dFRva2VuJywKICAnRmluYWxpemFjYW8gZGUgY29u
dGEgc2VtIHRva2VuIEhNQUMgZG8gY2hlY2tvdXQnLAopCnJlcXVpcmVUZXh0KAogICdsaWIvc3Vic2NyaXB0aW9uLWNoZWNrb3V0LXBheW1lbnQudHMnLAog
ICdDaGF2ZSBkZSBpZGVtcG90w6puY2lhIGRvIHBhZ2FtZW50byBpbnbDoWxpZGEuJywKICAnQ2hlY2tvdXQgYXZ1bHNvIGRlIGFzc2luYXR1cmEgc2VtIGlk
ZW1wb3RlbmNpYSBvYnJpZ2F0b3JpYScsCikKcmVxdWlyZVRleHQoCiAgJ2xpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzJywK
ICAnQ2hhdmUgZGUgaWRlbXBvdMOqbmNpYSBkYSBhc3NpbmF0dXJhIGludsOhbGlkYS4nLAogICdBc3NpbmF0dXJhIHJlY29ycmVudGUgc2VtIGlkZW1wb3Rl
bmNpYSBvYnJpZ2F0b3JpYScsCikKcmVxdWlyZVRleHQoCiAgJ2xpYi9zdWJzY3JpcHRpb24tbWVyY2Fkby1wYWdvLXRyYW5zcGFyZW50LnRzJywKICAnZXhp
c3RpbmdQYXltZW50Um93JywKICAnQXNzaW5hdHVyYSByZWNvcnJlbnRlIHNlbSByZXV0aWxpemFjYW8gZGEgbGluaGEgaWRlbXBvdGVudGUnLAopCnJlcXVp
cmVUZXh0KAogICdjb21wb25lbnRzL3N1YnNjcmlwdGlvbi9NZXJjYWRvUGFnb1N1YnNjcmlwdGlvbkNoZWNrb3V0LnRzeCcsCiAgJ3JlY3VycmluZ0lkZW1w
b3RlbmN5UmVmLmN1cnJlbnQgPSAiIjsnLAogICdDbGllbnRlIHJlY29ycmVudGUgbmFvIGxpbXBhIGNoYXZlIGlkZW1wb3RlbnRlIGFwb3Mgc3VjZXNzbycs
CikKcmVxdWlyZVRleHQoCiAgJ2xpYi9zdWJzY3JpcHRpb24tc2VydmljZS50cycsCiAgJ3JlY29uY2lsZVJldmVyc2VkU3Vic2NyaXB0aW9uUGF5bWVudCcs
CiAgJ0VzdG9ybm8gZGUgYXNzaW5hdHVyYSBuYW8gcmVjb25jaWxpYSBhY2Vzc28gY29uY2VkaWRvJywKKQpyZXF1aXJlVGV4dCgKICAnbGliL3N1YnNjcmlw
dGlvbi1zZXJ2aWNlLnRzJywKICAncHJldmlvdXNfYWNjZXNzX3VudGlsJywKICAnUGFnYW1lbnRvIGFwcm92YWRvIG5hbyByZWdpc3RyYSBhY2Vzc28gYW50
ZXJpb3IgcGFyYSByb2xsYmFjayBzZWd1cm8nLAopCnJlcXVpcmVUZXh0KAogICdsaWIvc3Vic2NyaXB0aW9uLXNlcnZpY2UudHMnLAogICdvcmNhbHlfYXBw
bHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZScsCiAgJ1BhZ2FtZW50byBhcHJvdmFkbyBhaW5kYSBwb2RlIHNlciBhcGxpY2FkbyBtYWlzIGRlIHVtYSB2
ZXonLAopCnJlcXVpcmVUZXh0KAogICdsaWIvc3Vic2NyaXB0aW9uLWNoZWNrb3V0LXBheW1lbnQudHMnLAogICdyZWNvbmNpbGVSZXZlcnNlZFN1YnNjcmlw
dGlvblBheW1lbnQnLAogICdDaGVja291dCBhdnVsc28gbmFvIHJldmVydGUgYWNlc3NvIGVtIGVzdG9ybm8nLAopCnJlcXVpcmVUZXh0KAogICdsaWIvYWZm
aWxpYXRlcy9zZXJ2ZXIudHMnLAogICdQYWdhbWVudG8gasOhIGVzdMOhIHNlbmRvIHByb2Nlc3NhZG8gb3UgbsOjbyBmb2kgYXByb3ZhZG8uJywKICAnUGF5
b3V0IHNlbSBjbGFpbSBhdG9taWNvIGFudGVzIGRhIHRyYW5zZmVyZW5jaWEnLAopCnJlcXVpcmVUZXh0KAogICdsaWIvYWZmaWxpYXRlcy9zZXJ2ZXIudHMn
LAogICdyZXR1cm4gImJhc2ljbyI7JywKICAnUGxhbm8gZGVzY29uaGVjaWRvIGRlIGFmaWxpYWRvIGFpbmRhIHBvZGUgY2FpciBlbSBwbGFubyBpbnRlcm1l
ZGlhcmlvJywKKQpyZXF1aXJlVGV4dCgKICAnbGliL2FmZmlsaWF0ZXMvc2VydmVyLnRzJywKICAnc2V0dGluZ3MucGF5b3V0c19lbmFibGVkJywKICAnU29s
aWNpdGFjYW8gZGUgcGF5b3V0IG5hbyByZXNwZWl0YSBmbGFnIGdsb2JhbCBkZSBwYWdhbWVudG9zJywKKQpyZXF1aXJlVGV4dCgKICAnbGliL2FmZmlsaWF0
ZXMvc2VydmVyLnRzJywKICAnUmVzdWx0YWRvIGluY2VydG8gbm8gcHJvdmVkb3IuIE7Do28gcmVlbnZpYXIgYXV0b21hdGljYW1lbnRlJywKICAnUGF5b3V0
IGFpbmRhIHBvZGUgc2VyIHJlZW52aWFkbyBhcG9zIHJlc3VsdGFkbyBpbmNlcnRvJywKKQpmb3JiaWRUZXh0KAogICdsaWIvY29tcGFueS1hY2Nlc3MudHMn
LAogICIuZXEoJ3NsdWcnLCAnZ3JhZmljYS1mbGFzaCcpIiwKICAnRmFsbGJhY2sgZGUgdGVuYW50IGZpeG8gcGFyYSBhZG1pbiBkYSBwbGF0YWZvcm1hIGFp
bmRhIGV4aXN0ZScsCikKcmVxdWlyZVRleHQoCiAgJ2FwcC9hcGkvY29tcGFueS9jdXJyZW50L3JvdXRlLnRzJywKICAnc2FuaXRpemVDb21wYW55Rm9yQ2xp
ZW50JywKICAnQVBJIGNvbXBhbnkvY3VycmVudCBhaW5kYSBkZXZvbHZlIGxpbmhhIGFkbWluaXN0cmF0aXZhIHNlbSBzYW5pdGl6YWNhbycsCikKcmVxdWly
ZVRleHQoCiAgJ2FwcC9hcGkvY3JtL2xlYWRzL3JvdXRlLnRzJywKICAiY29tcGFueVBsYW5BbGxvd3MoY29tcGFueUFjY2Vzcy5jb21wYW55LCAncHJvZmlz
c2lvbmFsJykiLAogICdDUk0gc2VtIGdhdGUgZGUgcGxhbm8gc2VydmVyLXNpZGUnLAopCgpjb25zdCBzb3VyY2VFeHRlbnNpb25zID0gbmV3IFNldChbCiAg
Jy50cycsICcudHN4JywgJy5qcycsICcubWpzJywgJy5janMnLCAnLnNxbCcsICcuY3NzJywgJy5tZCcsICcuanNvbicsCl0pCgpjb25zdCB0cmFja2VkID0g
ZXhlY0ZpbGVTeW5jKCdnaXQnLCBbJ2xzLWZpbGVzJywgJy16J10sIHsKICBjd2Q6IHJvb3QsCiAgZW5jb2Rpbmc6ICd1dGY4JywKfSkKICAuc3BsaXQoJ1xc
MCcpCiAgLmZpbHRlcihCb29sZWFuKQoKY29uc3QgbW9qaWJha2VNYXJrZXJzID0gWwogICfDg8KnJywgJ8ODwqMnLCAnw4PCtScsICfDg8KpJywgJ8ODwqon
LCAnw4PCoScsICfDg8OtJywgJ8ODwq0nLCAnw4PDsycsICfDg8KzJywKICAnw4PDuicsICfDg8K6JywgJ8OCwrcnLCAnw4LCuicsICfDgsKqJywgJ8OixZPi
gJwnLCAnw6LigKDigJknLCAnw6LigqzFkycsICfDouKCrCcsCl0KCmZvciAoY29uc3QgZmlsZSBvZiB0cmFja2VkKSB7CiAgY29uc3QgZXh0ZW5zaW9uID0g
cGF0aC5leHRuYW1lKGZpbGUpLnRvTG93ZXJDYXNlKCkKICBpZiAoIXNvdXJjZUV4dGVuc2lvbnMuaGFzKGV4dGVuc2lvbikpIGNvbnRpbnVlCgogIGxldCBj
b250ZW50ID0gJycKICB0cnkgewogICAgY29udGVudCA9IHJlYWQoZmlsZSkKICB9IGNhdGNoIHsKICAgIGNvbnRpbnVlCiAgfQoKICBjb25zdCBmaXJzdENo
dW5rID0gY29udGVudC5zbGljZSgwLCAzMDApCiAgY29uc3QgaXNDbGllbnQgPSAvWyciXXVzZSBjbGllbnRbJyJdLy50ZXN0KGZpcnN0Q2h1bmspCgogIGlm
IChpc0NsaWVudCAmJiBjb250ZW50LmluY2x1ZGVzKCdTVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZJykpIHsKICAgIGZhaWx1cmVzLnB1c2goXGBTZXJ2aWNl
IHJvbGUgcmVmZXJlbmNpYWRhIGVtIGFycXVpdm8gY2xpZW50OiBcJHtmaWxlfVxgKQogIH0KCiAgZm9yIChjb25zdCBtYXJrZXIgb2YgbW9qaWJha2VNYXJr
ZXJzKSB7CiAgICBpZiAoY29udGVudC5pbmNsdWRlcyhtYXJrZXIpKSB7CiAgICAgIGZhaWx1cmVzLnB1c2goXGBNb2ppYmFrZSAiXCR7bWFya2VyfSIgZW5j
b250cmFkbzogXCR7ZmlsZX1cYCkKICAgICAgYnJlYWsKICAgIH0KICB9CgogIGlmICgvXFxiZXZhbFxccypcXCgvLnRlc3QoY29udGVudCkgfHwgL25ld1xc
cytGdW5jdGlvblxccypcXCgvLnRlc3QoY29udGVudCkpIHsKICAgIGZhaWx1cmVzLnB1c2goXGBFeGVjdWNhbyBkaW5hbWljYSBwZXJpZ29zYSBlbmNvbnRy
YWRhOiBcJHtmaWxlfVxgKQogIH0KCiAgaWYgKAogICAgL0FQUF9VU1ItW0EtWmEtejAtOV8tXXsyMCx9Ly50ZXN0KGNvbnRlbnQpIHx8CiAgICAvc2tfKD86
bGl2ZXx0ZXN0KV9bQS1aYS16MC05XXsyMCx9Ly50ZXN0KGNvbnRlbnQpCiAgKSB7CiAgICBmYWlsdXJlcy5wdXNoKFxgU2VncmVkbyBjb20gZm9ybWF0byBj
b25oZWNpZG8gZW5jb250cmFkbyBubyBjb2RpZ286IFwke2ZpbGV9XGApCiAgfQoKICBpZiAoZmlsZS5zdGFydHNXaXRoKCdhcHAvYXBpLycpICYmIC9yZXF1
ZXN0XFwuanNvblxccypcXCgvLnRlc3QoY29udGVudCkgJiYgIWNvbnRlbnQuaW5jbHVkZXMoJ3JlYWRKc29uQm9keScpKSB7CiAgICB3YXJuaW5ncy5wdXNo
KFxgUm90YSB1c2EgcmVxdWVzdC5qc29uKCkgc2VtIGhlbHBlciBkZSBieXRlLWxpbWl0OiBcJHtmaWxlfVxgKQogIH0KCiAgaWYgKAogICAgZmlsZS5zdGFy
dHNXaXRoKCdhcHAvYXBpLycpICYmCiAgICAvcmVxdWVzdFxcLnRleHRcXHMqXFwoLy50ZXN0KGNvbnRlbnQpICYmCiAgICAhY29udGVudC5pbmNsdWRlcygn
cmVhZFRleHRCb2R5JykgJiYKICAgICFjb250ZW50LmluY2x1ZGVzKCdCdWZmZXIuYnl0ZUxlbmd0aCcpCiAgKSB7CiAgICB3YXJuaW5ncy5wdXNoKFxgUm90
YSB1c2EgcmVxdWVzdC50ZXh0KCkgc2VtIGJ5dGUtbGltaXQgY29tcGFydGlsaGFkbzogXCR7ZmlsZX1cYCkKICB9CgogIGlmICgvZGFuZ2Vyb3VzbHlTZXRJ
bm5lckhUTUwvLnRlc3QoY29udGVudCkpIHsKICAgIHdhcm5pbmdzLnB1c2goXGBSZXZpc2FyIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MOiBcJHtmaWxlfVxg
KQogIH0KCiAgaWYgKC9cXC5vclxccypcXChcXHMqXGAvLnRlc3QoY29udGVudCkgJiYgY29udGVudC5pbmNsdWRlcygnXCR7JykpIHsKICAgIHdhcm5pbmdz
LnB1c2goXGBSZXZpc2FyIGZpbHRybyBQb3N0Z1JFU1QgLm9yKCkgaW50ZXJwb2xhZG86IFwke2ZpbGV9XGApCiAgfQp9Cgpjb25zdCBtaWdyYXRpb25EaXIg
PSBwYXRoLmpvaW4ocm9vdCwgJ3N1cGFiYXNlJywgJ21pZ3JhdGlvbnMnKQpjb25zdCBwYXJ0bmVyQXV0aG9yaXR5TWlncmF0aW9uID0gZnMuZXhpc3RzU3lu
YyhtaWdyYXRpb25EaXIpCiAgPyBmcy5yZWFkZGlyU3luYyhtaWdyYXRpb25EaXIpLmZpbmQoKG5hbWUpID0+CiAgICAgIG5hbWUuZW5kc1dpdGgoJ19hZmZp
bGlhdGVfd29ya3NwYWNlX3NlcnZlcl9hdXRob3JpdHkuc3FsJyksCiAgICApCiAgOiBudWxsCgppZiAoIXBhcnRuZXJBdXRob3JpdHlNaWdyYXRpb24pIHsK
ICBmYWlsdXJlcy5wdXNoKCdNaWdyYXRpb24gYWZmaWxpYXRlX3dvcmtzcGFjZV9zZXJ2ZXJfYXV0aG9yaXR5IGF1c2VudGUnKQp9IGVsc2UgewogIGNvbnN0
IG1pZ3JhdGlvbiA9IHJlYWQocGF0aC5qb2luKCdzdXBhYmFzZScsICdtaWdyYXRpb25zJywgcGFydG5lckF1dGhvcml0eU1pZ3JhdGlvbikpCiAgaWYgKCFt
aWdyYXRpb24uaW5jbHVkZXMoJ3Jldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVsZXRlJykpIHsKICAgIGZhaWx1cmVzLnB1c2goJ01pZ3JhdGlvbiBkZSBwYXJj
ZWlyb3MgbmFvIHJldm9nYSBlc2NyaXRhIGRpcmV0YScpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdhZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRz
X3NvdXJjZV9rZXlfdXEnKSkgewogICAgZmFpbHVyZXMucHVzaCgnSW5kaWNlIGRlIGlkZW1wb3RlbmNpYSBkZSBYUCBhdXNlbnRlJykKICB9CiAgaWYgKCFt
aWdyYXRpb24uaW5jbHVkZXMoJ3BsYW5fcGF5bWVudHNfY29tcGFueV9pZGVtcG90ZW5jeV91cScpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdJbmRpY2UgZGUg
aWRlbXBvdGVuY2lhIGRlIGNvYnJhbmNhIGRlIGFzc2luYXR1cmEgYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdvcmNhbHlfYXBw
bHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZScpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdMZWRnZXIgaWRlbXBvdGVudGUgZGUgYXBsaWNhY2FvIGRlIGFz
c2luYXR1cmEgYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdvcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3MnKSkgewogICAg
ZmFpbHVyZXMucHVzaCgnRnVuY2FvIGNhbm9uaWNhIGRlIHBsYW5vL2Fzc2luYXR1cmEgbm8gYmFuY28gYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9u
LmluY2x1ZGVzKCdvcmNhbHlfY3VycmVudF91c2VyX2NhbicpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdGdW5jYW8gY2Fub25pY2EgZGUgY2FwYWNpZGFkZSBw
b3IgY2FyZ28gbm8gYmFuY28gYXVzZW50ZScpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCdhcyByZXN0cmljdGl2ZScpKSB7CiAgICBmYWlsdXJl
cy5wdXNoKCdQb2xpY2llcyByZXN0cml0aXZhcyBkZSBwbGFuby9jYXJnbyBhdXNlbnRlcycpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCInY3Jt
X2xlYWRzJyIpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdDUk0gYWluZGEgbmFvIGZvaSB0b3JuYWRvIHNlcnZlci1hdXRob3JpdGF0aXZlJykKICB9CiAgaWYg
KCFtaWdyYXRpb24uaW5jbHVkZXMoIigncHJvZHVjdHMnLCAnZXNzZW5jaWFsJywgJ3Byb2R1Y3RzJykiKSkgewogICAgZmFpbHVyZXMucHVzaCgnUHJvZHVj
dHMgYWluZGEgbmFvIGVzdGEgcHJvdGVnaWRvIHBvciBwbGFuby9jYXJnbyBubyBiYW5jbycpCiAgfQogIGlmICghbWlncmF0aW9uLmluY2x1ZGVzKCIoJ29y
ZGVycycsICdlc3NlbmNpYWwnLCAnb3JkZXJzJykiKSkgewogICAgZmFpbHVyZXMucHVzaCgnT3JkZXJzIGFpbmRhIG5hbyBlc3RhIHByb3RlZ2lkbyBwb3Ig
cGxhbm8vY2FyZ28gbm8gYmFuY28nKQogIH0KICBpZiAoIW1pZ3JhdGlvbi5pbmNsdWRlcygnb3JjYWx5X29yZGVyX2l0ZW1zX2NhcGFiaWxpdHknKSkgewog
ICAgZmFpbHVyZXMucHVzaCgnT3JkZXIgaXRlbXMgYWluZGEgbmFvIGhlcmRhIGF1dG9yaXphY2FvIGRvIHBlZGlkbycpCiAgfQogIGlmICghbWlncmF0aW9u
LmluY2x1ZGVzKCdvcmNhbHlfY29tcGFueV91cGRhdGVfY2FwYWJpbGl0eScpKSB7CiAgICBmYWlsdXJlcy5wdXNoKCdBdHVhbGl6YWNhbyBkaXJldGEgZGUg
Y29tcGFuaWVzIHNlbSBnYXRlIGRlIGNvbmZpZ3VyYWNhbycpCiAgfQp9Cgpjb25zb2xlLmxvZyhcYFNFQ1VSSVRZX1NDQU5fVFJBQ0tFRF9GSUxFUz1cJHt0
cmFja2VkLmxlbmd0aH1cYCkKY29uc29sZS5sb2coXGBTRUNVUklUWV9TQ0FOX1dBUk5JTkdTPVwke3dhcm5pbmdzLmxlbmd0aH1cYCkKZm9yIChjb25zdCB3
YXJuaW5nIG9mIHdhcm5pbmdzKSBjb25zb2xlLndhcm4oXGBbV0FSTl0gXCR7d2FybmluZ31cYCkKCmlmIChmYWlsdXJlcy5sZW5ndGgpIHsKICBjb25zb2xl
LmVycm9yKCdcXG5GQUxIQVMgREUgU0VHVVJBTkNBIEVOQ09OVFJBREFTOicpCiAgZm9yIChjb25zdCBmYWlsdXJlIG9mIGZhaWx1cmVzKSBjb25zb2xlLmVy
cm9yKFxgLSBcJHtmYWlsdXJlfVxgKQogIHByb2Nlc3MuZXhpdCgxKQp9Cgpjb25zb2xlLmxvZygnU0VDVVJJVFlfQ0hFQ0tfRVhJVF9DT0RFPTAnKQpgKTsK
Ci8vIFNRTCBzZXLDoSBjb3BpYWRvIHBhcmEgbWlncmF0aW9uIGNyaWFkYSBwZWxvIFN1cGFiYXNlIENMSSBubyBQb3dlclNoZWxsLgpjcmVhdGVPclJlcGxh
Y2UoIi5vcmNhbHktaGFyZGVuaW5nLWxvY2FsL2FmZmlsaWF0ZV93b3Jrc3BhY2Vfc2VydmVyX2F1dGhvcml0eS5zcWwiLCBgLS0gT1JDQUxZX0FGRklMSUFU
RV9XT1JLU1BBQ0VfU0VSVkVSX0FVVEhPUklUWV9WMQpiZWdpbjsKCi0tIE8gcGFyY2Vpcm8gY29uc3VsdGEgb3MgcHLDs3ByaW9zIGRhZG9zLCBtYXMgbXV0
YcOnw7VlcyBwYXNzYW0gcGVsbyBiYWNrZW5kLgpyZXZva2UgaW5zZXJ0LCB1cGRhdGUsIGRlbGV0ZSBvbiBwdWJsaWMuYWZmaWxpYXRlX2xlYWRzIGZyb20g
YXV0aGVudGljYXRlZDsKcmV2b2tlIGluc2VydCwgdXBkYXRlLCBkZWxldGUgb24gcHVibGljLmFmZmlsaWF0ZV90YXNrcyBmcm9tIGF1dGhlbnRpY2F0ZWQ7
CnJldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVsZXRlIG9uIHB1YmxpYy5hZmZpbGlhdGVfZ29hbHMgZnJvbSBhdXRoZW50aWNhdGVkOwpyZXZva2UgaW5zZXJ0
LCB1cGRhdGUsIGRlbGV0ZSBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjdGl2aXR5X2V2ZW50cyBmcm9tIGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBpbnNlcnQsIHVw
ZGF0ZSwgZGVsZXRlIG9uIHB1YmxpYy5hZmZpbGlhdGVfY291cnNlX3Byb2dyZXNzIGZyb20gYXV0aGVudGljYXRlZDsKcmV2b2tlIGluc2VydCwgdXBkYXRl
LCBkZWxldGUgb24gcHVibGljLmFmZmlsaWF0ZV9jZXJ0aWZpY2F0aW9ucyBmcm9tIGF1dGhlbnRpY2F0ZWQ7CnJldm9rZSBpbnNlcnQsIHVwZGF0ZSwgZGVs
ZXRlIG9uIHB1YmxpYy5hZmZpbGlhdGVfdHJhaW5pbmdfc2Vzc2lvbnMgZnJvbSBhdXRoZW50aWNhdGVkOwpyZXZva2UgaW5zZXJ0LCB1cGRhdGUsIGRlbGV0
ZSBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50cyBmcm9tIGF1dGhlbnRpY2F0ZWQ7Cgpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2xl
YWRzX2luc2VydF9vd24gb24gcHVibGljLmFmZmlsaWF0ZV9sZWFkczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9sZWFkc191cGRhdGVfb3du
IG9uIHB1YmxpYy5hZmZpbGlhdGVfbGVhZHM7CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfbGVhZHNfZGVsZXRlX293biBvbiBwdWJsaWMuYWZm
aWxpYXRlX2xlYWRzOwoKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV90YXNrc19pbnNlcnRfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfdGFza3M7
CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfdGFza3NfdXBkYXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX3Rhc2tzOwpkcm9wIHBvbGljeSBp
ZiBleGlzdHMgYWZmaWxpYXRlX3Rhc2tzX2RlbGV0ZV9vd24gb24gcHVibGljLmFmZmlsaWF0ZV90YXNrczsKCmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZp
bGlhdGVfZ29hbHNfaW5zZXJ0X293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2dvYWxzOwpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2dvYWxzX3Vw
ZGF0ZV9vd24gb24gcHVibGljLmFmZmlsaWF0ZV9nb2FsczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9nb2Fsc19kZWxldGVfb3duIG9uIHB1
YmxpYy5hZmZpbGlhdGVfZ29hbHM7Cgpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2V2ZW50c19pbnNlcnRfb3duIG9uIHB1YmxpYy5hZmZpbGlh
dGVfYWN0aXZpdHlfZXZlbnRzOwpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2V2ZW50c191cGRhdGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVf
YWN0aXZpdHlfZXZlbnRzOwpkcm9wIHBvbGljeSBpZiBleGlzdHMgYWZmaWxpYXRlX2V2ZW50c19kZWxldGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfYWN0
aXZpdHlfZXZlbnRzOwoKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9jb3Vyc2VfaW5zZXJ0X293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2NvdXJz
ZV9wcm9ncmVzczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9jb3Vyc2VfdXBkYXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2NvdXJzZV9w
cm9ncmVzczsKZHJvcCBwb2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9jb3Vyc2VfZGVsZXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2NvdXJzZV9wcm9n
cmVzczsKCmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfY2VydF9pbnNlcnRfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfY2VydGlmaWNhdGlvbnM7
CmRyb3AgcG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfY2VydF91cGRhdGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfY2VydGlmaWNhdGlvbnM7CmRyb3Ag
cG9saWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfY2VydF9kZWxldGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfY2VydGlmaWNhdGlvbnM7Cgpkcm9wIHBvbGlj
eSBpZiBleGlzdHMgYWZmaWxpYXRlX3RyYWluaW5nX2luc2VydF9vd24gb24gcHVibGljLmFmZmlsaWF0ZV90cmFpbmluZ19zZXNzaW9uczsKZHJvcCBwb2xp
Y3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV90cmFpbmluZ191cGRhdGVfb3duIG9uIHB1YmxpYy5hZmZpbGlhdGVfdHJhaW5pbmdfc2Vzc2lvbnM7CmRyb3AgcG9s
aWN5IGlmIGV4aXN0cyBhZmZpbGlhdGVfdHJhaW5pbmdfZGVsZXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX3RyYWluaW5nX3Nlc3Npb25zOwoKZHJvcCBw
b2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9hY2hpZXZlbWVudHNfaW5zZXJ0X293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50czsKZHJvcCBw
b2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9hY2hpZXZlbWVudHNfdXBkYXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50czsKZHJvcCBw
b2xpY3kgaWYgZXhpc3RzIGFmZmlsaWF0ZV9hY2hpZXZlbWVudHNfZGVsZXRlX293biBvbiBwdWJsaWMuYWZmaWxpYXRlX2FjaGlldmVtZW50czsKCi0tIEV2
aXRhIFhQIGR1cGxpY2FkbyBtZXNtbyBzb2IgZHVhcyByZXF1aXNpw6fDtWVzIGNvbmNvcnJlbnRlcy4KY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3QgZXhp
c3RzIGFmZmlsaWF0ZV9hY3Rpdml0eV9ldmVudHNfc291cmNlX2tleV91cQogIG9uIHB1YmxpYy5hZmZpbGlhdGVfYWN0aXZpdHlfZXZlbnRzICgKICAgIGFm
ZmlsaWF0ZV9pZCwKICAgIChtZXRhZGF0YS0+Pidzb3VyY2Vfa2V5JykKICApCiAgd2hlcmUgbWV0YWRhdGEgPyAnc291cmNlX2tleSc7CgotLSBBIG1lc21h
IHRlbnRhdGl2YSBkZSBjb2JyYW7Dp2EgYXZ1bHNhIG51bmNhIGNyaWEgZHVhcyBsaW5oYXMvY2hhcmdlcy4KY3JlYXRlIHVuaXF1ZSBpbmRleCBpZiBub3Qg
ZXhpc3RzIHBsYW5fcGF5bWVudHNfY29tcGFueV9pZGVtcG90ZW5jeV91cQogIG9uIHB1YmxpYy5wbGFuX3BheW1lbnRzIChjb21wYW55X2lkLCBpZGVtcG90
ZW5jeV9rZXkpCiAgd2hlcmUgaWRlbXBvdGVuY3lfa2V5IGlzIG5vdCBudWxsOwoKLS0gTGVkZ2VyIHByaXZhZG8gZ2FyYW50ZSBxdWUgbyBtZXNtbyBwYWdh
bWVudG8gYXByb3ZhZG8gc8OzIGVzdGVuZGEgYWNlc3NvIHVtYSB2ZXouCmNyZWF0ZSBzY2hlbWEgaWYgbm90IGV4aXN0cyBvcmNhbHlfcHJpdmF0ZTsKcmV2
b2tlIGFsbCBvbiBzY2hlbWEgb3JjYWx5X3ByaXZhdGUgZnJvbSBwdWJsaWMsIGFub24sIGF1dGhlbnRpY2F0ZWQ7CgpjcmVhdGUgdGFibGUgaWYgbm90IGV4
aXN0cyBvcmNhbHlfcHJpdmF0ZS5zdWJzY3JpcHRpb25fcGF5bWVudF9hcHBsaWNhdGlvbnMgKAogIGNvbXBhbnlfaWQgdXVpZCBub3QgbnVsbCByZWZlcmVu
Y2VzIHB1YmxpYy5jb21wYW5pZXMoaWQpIG9uIGRlbGV0ZSBjYXNjYWRlLAogIHByb3ZpZGVyX3JlZmVyZW5jZSB0ZXh0IG5vdCBudWxsLAogIGFwcGxpZWRf
YXQgdGltZXN0YW1wdHogbm90IG51bGwgZGVmYXVsdCBjbG9ja190aW1lc3RhbXAoKSwKICBwcmltYXJ5IGtleSAoY29tcGFueV9pZCwgcHJvdmlkZXJfcmVm
ZXJlbmNlKQopOwoKcmV2b2tlIGFsbCBvbiBvcmNhbHlfcHJpdmF0ZS5zdWJzY3JpcHRpb25fcGF5bWVudF9hcHBsaWNhdGlvbnMKICBmcm9tIHB1YmxpYywg
YW5vbiwgYXV0aGVudGljYXRlZDsKCmNyZWF0ZSBvciByZXBsYWNlIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfYXBwbHlfc3Vic2NyaXB0aW9uX3BheW1lbnRf
b25jZSgKICBwX2NvbXBhbnlfaWQgdXVpZCwKICBwX3Byb3ZpZGVyX3JlZmVyZW5jZSB0ZXh0LAogIHBfcGxhbiB0ZXh0LAogIHBfcGF5bWVudF90eXBlIHRl
eHQsCiAgcF9hbW91bnQgbnVtZXJpYywKICBwX3ByZXZpb3VzX3N0YXR1cyB0ZXh0LAogIHBfcHJldmlvdXNfYWNjZXNzX3VudGlsIHRpbWVzdGFtcHR6LAog
IHBfbmV3X2FjY2Vzc191bnRpbCB0aW1lc3RhbXB0eiwKICBwX3ByZWFwcHJvdmFsX2lkIHRleHQsCiAgcF9uZXh0X3BheW1lbnRfZGF0ZSB0aW1lc3RhbXB0
egopCnJldHVybnMgYm9vbGVhbgpsYW5ndWFnZSBwbHBnc3FsCnNlY3VyaXR5IGRlZmluZXIKc2V0IHNlYXJjaF9wYXRoID0gJycKYXMgJCQKZGVjbGFyZQog
IHZfaW5zZXJ0ZWQgaW50ZWdlciA6PSAwOwogIHZfbm93IHRpbWVzdGFtcHR6IDo9IGNsb2NrX3RpbWVzdGFtcCgpOwogIHZfcHJldmlvdXNfc3RhdHVzIHRl
eHQ7CiAgdl9wcmV2aW91c19hY2Nlc3NfdW50aWwgdGltZXN0YW1wdHo7CiAgdl9uZXdfYWNjZXNzX3VudGlsIHRpbWVzdGFtcHR6OwpiZWdpbgogIGlmIHBf
Y29tcGFueV9pZCBpcyBudWxsIG9yIGNvYWxlc2NlKGxlbmd0aCh0cmltKHBfcHJvdmlkZXJfcmVmZXJlbmNlKSksIDApIDwgMSB0aGVuCiAgICByYWlzZSBl
eGNlcHRpb24gJ2ludmFsaWQgc3Vic2NyaXB0aW9uIHBheW1lbnQgYXBwbGljYXRpb24nOwogIGVuZCBpZjsKCiAgc2VsZWN0CiAgICBjLmFzc2luYXR1cmFf
c3RhdHVzLAogICAgZ3JlYXRlc3QoCiAgICAgIGNvYWxlc2NlKGMuYWNjZXNzX3VudGlsLCAnLWluZmluaXR5Jzo6dGltZXN0YW1wdHopLAogICAgICBjb2Fs
ZXNjZShjLmFzc2luYXR1cmFfZXhwaXJhX2VtLCAnLWluZmluaXR5Jzo6dGltZXN0YW1wdHopCiAgICApCiAgaW50byB2X3ByZXZpb3VzX3N0YXR1cywgdl9w
cmV2aW91c19hY2Nlc3NfdW50aWwKICBmcm9tIHB1YmxpYy5jb21wYW5pZXMgYwogIHdoZXJlIGMuaWQgPSBwX2NvbXBhbnlfaWQKICBmb3IgdXBkYXRlOwoK
ICBpZiBub3QgZm91bmQgdGhlbgogICAgcmFpc2UgZXhjZXB0aW9uICdjb21wYW55IG5vdCBmb3VuZCc7CiAgZW5kIGlmOwoKICBpZiB2X3ByZXZpb3VzX2Fj
Y2Vzc191bnRpbCA9ICctaW5maW5pdHknOjp0aW1lc3RhbXB0eiB0aGVuCiAgICB2X3ByZXZpb3VzX2FjY2Vzc191bnRpbCA6PSBudWxsOwogIGVuZCBpZjsK
CiAgdl9uZXdfYWNjZXNzX3VudGlsIDo9IGNhc2UKICAgIHdoZW4gcF9uZXh0X3BheW1lbnRfZGF0ZSBpcyBub3QgbnVsbCBhbmQgcF9uZXh0X3BheW1lbnRf
ZGF0ZSA+IHZfbm93CiAgICAgIHRoZW4gcF9uZXh0X3BheW1lbnRfZGF0ZQogICAgZWxzZSBncmVhdGVzdChjb2FsZXNjZSh2X3ByZXZpb3VzX2FjY2Vzc191
bnRpbCwgdl9ub3cpLCB2X25vdykgKyBpbnRlcnZhbCAnMSBtb250aCcKICBlbmQ7CgogIGluc2VydCBpbnRvIG9yY2FseV9wcml2YXRlLnN1YnNjcmlwdGlv
bl9wYXltZW50X2FwcGxpY2F0aW9ucyAoCiAgICBjb21wYW55X2lkLAogICAgcHJvdmlkZXJfcmVmZXJlbmNlLAogICAgYXBwbGllZF9hdAogICkKICB2YWx1
ZXMgKAogICAgcF9jb21wYW55X2lkLAogICAgdHJpbShwX3Byb3ZpZGVyX3JlZmVyZW5jZSksCiAgICB2X25vdwogICkKICBvbiBjb25mbGljdCAoY29tcGFu
eV9pZCwgcHJvdmlkZXJfcmVmZXJlbmNlKSBkbyBub3RoaW5nOwoKICBnZXQgZGlhZ25vc3RpY3Mgdl9pbnNlcnRlZCA9IHJvd19jb3VudDsKICBpZiB2X2lu
c2VydGVkID0gMCB0aGVuCiAgICByZXR1cm4gZmFsc2U7CiAgZW5kIGlmOwoKICB1cGRhdGUgcHVibGljLmNvbXBhbmllcwogIHNldAogICAgYXRpdm8gPSB0
cnVlLAogICAgcGxhbm8gPSBwX3BsYW4sCiAgICBhc3NpbmF0dXJhX3BsYW5vID0gcF9wbGFuLAogICAgYXNzaW5hdHVyYV9zdGF0dXMgPSAnYXRpdmEnLAog
ICAgYXNzaW5hdHVyYV9pbmljaW8gPSBjb2FsZXNjZShhc3NpbmF0dXJhX2luaWNpbywgdl9ub3cpLAogICAgYXNzaW5hdHVyYV9leHBpcmFfZW0gPSB2X25l
d19hY2Nlc3NfdW50aWwsCiAgICBhY2Nlc3NfdW50aWwgPSB2X25ld19hY2Nlc3NfdW50aWwsCiAgICBhc3NpbmF0dXJhX3VsdGltb19wYWdhbWVudG8gPSB2
X25vdywKICAgIGFzc2luYXR1cmFfcHJveGltYV9jb2JyYW5jYSA9IHBfbmV4dF9wYXltZW50X2RhdGUsCiAgICBhc3NpbmF0dXJhX2F1dG9fcmVjb3JyZW50
ZSA9IChwX3BheW1lbnRfdHlwZSA9ICdjYXJkX3JlY3VycmluZycpLAogICAgYXNzaW5hdHVyYV9mb3JtYV9wYWdhbWVudG9fcHJlZmVyaWRhID0gY2FzZQog
ICAgICB3aGVuIHBfcGF5bWVudF90eXBlID0gJ2NhcmRfcmVjdXJyaW5nJyB0aGVuICdjYXJ0YW9fcmVjb3JyZW50ZScKICAgICAgd2hlbiBwX3BheW1lbnRf
dHlwZSA9ICdjYXJkJyB0aGVuICdjYXJ0YW9fYXZ1bHNvJwogICAgICBlbHNlICdwaXhfYXZ1bHNvJwogICAgZW5kLAogICAgYXNzaW5hdHVyYV9waXhfYXZ1
bHNvX3N0YXR1cyA9IGNhc2UKICAgICAgd2hlbiBwX3BheW1lbnRfdHlwZSA9ICdwaXgnIHRoZW4gJ3BhaWQnCiAgICAgIGVsc2UgYXNzaW5hdHVyYV9waXhf
YXZ1bHNvX3N0YXR1cwogICAgZW5kLAogICAgYXNzaW5hdHVyYV9waXhfYXZ1bHNvX3VsdGltb19wYWdhbWVudG8gPSBjYXNlCiAgICAgIHdoZW4gcF9wYXlt
ZW50X3R5cGUgPSAncGl4JyB0aGVuIHZfbm93CiAgICAgIGVsc2UgYXNzaW5hdHVyYV9waXhfYXZ1bHNvX3VsdGltb19wYWdhbWVudG8KICAgIGVuZCwKICAg
IG1lcmNhZG9fcGFnb19zdWJzY3JpcHRpb25faWQgPSBjb2FsZXNjZSgKICAgICAgbnVsbGlmKHBfcHJlYXBwcm92YWxfaWQsICcnKSwKICAgICAgbWVyY2Fk
b19wYWdvX3N1YnNjcmlwdGlvbl9pZAogICAgKSwKICAgIG1lcmNhZG9fcGFnb19zdWJzY3JpcHRpb25fc3RhdHVzID0gY2FzZQogICAgICB3aGVuIHBfcGF5
bWVudF90eXBlID0gJ2NhcmRfcmVjdXJyaW5nJyB0aGVuICdhdXRob3JpemVkJwogICAgICBlbHNlIG1lcmNhZG9fcGFnb19zdWJzY3JpcHRpb25fc3RhdHVz
CiAgICBlbmQsCiAgICBjYW5jZWxfYXRfcGVyaW9kX2VuZCA9IGZhbHNlLAogICAgdXBkYXRlZF9hdCA9IHZfbm93CiAgd2hlcmUgaWQgPSBwX2NvbXBhbnlf
aWQ7CgogIGlmIG5vdCBmb3VuZCB0aGVuCiAgICByYWlzZSBleGNlcHRpb24gJ2NvbXBhbnkgbm90IGZvdW5kJzsKICBlbmQgaWY7CgogIGluc2VydCBpbnRv
IHB1YmxpYy5zdWJzY3JpcHRpb25fZXZlbnRzICgKICAgIGNvbXBhbnlfaWQsCiAgICBldmVudF90eXBlLAogICAgb2xkX3N0YXR1cywKICAgIG5ld19zdGF0
dXMsCiAgICBwcm92aWRlciwKICAgIHByb3ZpZGVyX3JlZmVyZW5jZSwKICAgIG1ldGFkYXRhCiAgKQogIHZhbHVlcyAoCiAgICBwX2NvbXBhbnlfaWQsCiAg
ICAncGF5bWVudF9hcHByb3ZlZCcsCiAgICB2X3ByZXZpb3VzX3N0YXR1cywKICAgICdhdGl2YScsCiAgICAnbWVyY2Fkb19wYWdvJywKICAgIHRyaW0ocF9w
cm92aWRlcl9yZWZlcmVuY2UpLAogICAganNvbmJfYnVpbGRfb2JqZWN0KAogICAgICAncGxhbicsIHBfcGxhbiwKICAgICAgJ3BheW1lbnRfdHlwZScsIHBf
cGF5bWVudF90eXBlLAogICAgICAnYW1vdW50JywgcF9hbW91bnQsCiAgICAgICdwcmV2aW91c19hY2Nlc3NfdW50aWwnLCB2X3ByZXZpb3VzX2FjY2Vzc191
bnRpbCwKICAgICAgJ2FjY2Vzc191bnRpbCcsIHZfbmV3X2FjY2Vzc191bnRpbAogICAgKQogICkKICBvbiBjb25mbGljdCAoY29tcGFueV9pZCwgZXZlbnRf
dHlwZSwgcHJvdmlkZXJfcmVmZXJlbmNlKSBkbyBub3RoaW5nOwoKICByZXR1cm4gdHJ1ZTsKZXhjZXB0aW9uCiAgd2hlbiBvdGhlcnMgdGhlbgogICAgZGVs
ZXRlIGZyb20gb3JjYWx5X3ByaXZhdGUuc3Vic2NyaXB0aW9uX3BheW1lbnRfYXBwbGljYXRpb25zCiAgICB3aGVyZSBjb21wYW55X2lkID0gcF9jb21wYW55
X2lkCiAgICAgIGFuZCBwcm92aWRlcl9yZWZlcmVuY2UgPSB0cmltKHBfcHJvdmlkZXJfcmVmZXJlbmNlKTsKICAgIHJhaXNlOwplbmQ7CiQkOwoKcmV2b2tl
IGFsbCBvbiBmdW5jdGlvbiBwdWJsaWMub3JjYWx5X2FwcGx5X3N1YnNjcmlwdGlvbl9wYXltZW50X29uY2UoCiAgdXVpZCwgdGV4dCwgdGV4dCwgdGV4dCwg
bnVtZXJpYywgdGV4dCwgdGltZXN0YW1wdHosIHRpbWVzdGFtcHR6LCB0ZXh0LCB0aW1lc3RhbXB0egopIGZyb20gcHVibGljLCBhbm9uLCBhdXRoZW50aWNh
dGVkOwpncmFudCBleGVjdXRlIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfYXBwbHlfc3Vic2NyaXB0aW9uX3BheW1lbnRfb25jZSgKICB1dWlkLCB0ZXh0
LCB0ZXh0LCB0ZXh0LCBudW1lcmljLCB0ZXh0LCB0aW1lc3RhbXB0eiwgdGltZXN0YW1wdHosIHRleHQsIHRpbWVzdGFtcHR6CikgdG8gc2VydmljZV9yb2xl
OwoKLS0gUmVncmEgw7puaWNhIGRlIGFjZXNzbyBjb21lcmNpYWw6IGFzc2luYXR1cmEgdsOhbGlkYSArIG7DrXZlbCBkZSBwbGFuby4KY3JlYXRlIG9yIHJl
cGxhY2UgZnVuY3Rpb24gcHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2FjY2VzcygKICBwX2NvbXBhbnlfaWQgdXVpZCwKICBwX3JlcXVpcmVkX3Bs
YW4gdGV4dAopCnJldHVybnMgYm9vbGVhbgpsYW5ndWFnZSBzcWwKc3RhYmxlCnNlY3VyaXR5IGRlZmluZXIKc2V0IHNlYXJjaF9wYXRoID0gJycKYXMgJCQK
ICBzZWxlY3QgZXhpc3RzICgKICAgIHNlbGVjdCAxCiAgICBmcm9tIHB1YmxpYy5jb21wYW5pZXMgYwogICAgd2hlcmUgYy5pZCA9IHBfY29tcGFueV9pZAog
ICAgICBhbmQgY29hbGVzY2UoYy5hdGl2bywgdHJ1ZSkgPSB0cnVlCiAgICAgIGFuZCBncmVhdGVzdCgKICAgICAgICBjb2FsZXNjZShjLmFjY2Vzc191bnRp
bCwgJy1pbmZpbml0eSc6OnRpbWVzdGFtcHR6KSwKICAgICAgICBjb2FsZXNjZShjLmFzc2luYXR1cmFfZXhwaXJhX2VtLCAnLWluZmluaXR5Jzo6dGltZXN0
YW1wdHopLAogICAgICAgIGNhc2UKICAgICAgICAgIHdoZW4gbG93ZXIoY29hbGVzY2UoYy5hc3NpbmF0dXJhX3N0YXR1cywgJycpKSA9ICd0cmlhbGluZycK
ICAgICAgICAgICAgdGhlbiBjb2FsZXNjZShjLnRyaWFsX2VuZHNfYXQsICctaW5maW5pdHknOjp0aW1lc3RhbXB0eikKICAgICAgICAgIGVsc2UgJy1pbmZp
bml0eSc6OnRpbWVzdGFtcHR6CiAgICAgICAgZW5kCiAgICAgICkgPiBub3coKQogICAgICBhbmQgKAogICAgICAgIGNhc2UgbG93ZXIoY29hbGVzY2UoYy5h
c3NpbmF0dXJhX3BsYW5vLCBjLnBsYW5vLCAnZXNzZW5jaWFsJykpCiAgICAgICAgICB3aGVuICdwcmVtaXVtJyB0aGVuIDMKICAgICAgICAgIHdoZW4gJ3By
b2Zpc3Npb25hbCcgdGhlbiAyCiAgICAgICAgICB3aGVuICdpbnRlcm1lZGlhcmlvJyB0aGVuIDIKICAgICAgICAgIHdoZW4gJ2ludGVybWVkacOhcmlvJyB0
aGVuIDIKICAgICAgICAgIGVsc2UgMQogICAgICAgIGVuZAogICAgICApID49ICgKICAgICAgICBjYXNlIGxvd2VyKGNvYWxlc2NlKHBfcmVxdWlyZWRfcGxh
biwgJ2Vzc2VuY2lhbCcpKQogICAgICAgICAgd2hlbiAncHJlbWl1bScgdGhlbiAzCiAgICAgICAgICB3aGVuICdwcm9maXNzaW9uYWwnIHRoZW4gMgogICAg
ICAgICAgd2hlbiAnaW50ZXJtZWRpYXRlJyB0aGVuIDIKICAgICAgICAgIHdoZW4gJ2ludGVybWVkaWFyaW8nIHRoZW4gMgogICAgICAgICAgd2hlbiAnaW50
ZXJtZWRpw6FyaW8nIHRoZW4gMgogICAgICAgICAgZWxzZSAxCiAgICAgICAgZW5kCiAgICAgICkKICApOwokJDsKCnJldm9rZSBhbGwgb24gZnVuY3Rpb24g
cHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2FjY2Vzcyh1dWlkLCB0ZXh0KQogIGZyb20gcHVibGljLCBhbm9uOwpncmFudCBleGVjdXRlIG9uIGZ1
bmN0aW9uIHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3ModXVpZCwgdGV4dCkKICB0byBhdXRoZW50aWNhdGVkLCBzZXJ2aWNlX3JvbGU7
CgotLSBDYXBhY2lkYWRlIHBvciBjYXJnby4gQSBwb2xpY3kgZGUgcG9zc2UgZGEgZW1wcmVzYSBjb250aW51YSBzZW5kbyBuZWNlc3PDoXJpYTsKLS0gZXN0
YSBmdW7Dp8OjbyBhZGljaW9uYSBvIGxpbWl0ZSBmdW5jaW9uYWwgKGZpbmFuY2Vpcm8sIENSTSwgcHJvcG9zdGEsIGdlc3TDo28pLgpjcmVhdGUgb3IgcmVw
bGFjZSBmdW5jdGlvbiBwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oCiAgcF9jb21wYW55X2lkIHV1aWQsCiAgcF9jYXBhYmlsaXR5IHRleHQKKQpy
ZXR1cm5zIGJvb2xlYW4KbGFuZ3VhZ2Ugc3FsCnN0YWJsZQpzZWN1cml0eSBkZWZpbmVyCnNldCBzZWFyY2hfcGF0aCA9ICcnCmFzICQkCiAgc2VsZWN0CiAg
ICBleGlzdHMgKAogICAgICBzZWxlY3QgMQogICAgICBmcm9tIHB1YmxpYy5jb21wYW5pZXMgYwogICAgICB3aGVyZSBjLmlkID0gcF9jb21wYW55X2lkCiAg
ICAgICAgYW5kICgKICAgICAgICAgIGMub3duZXJfaWQgPSAoc2VsZWN0IGF1dGgudWlkKCkpCiAgICAgICAgICBvciBjLnRlc3Rlcl9pZCA9IChzZWxlY3Qg
YXV0aC51aWQoKSkKICAgICAgICApCiAgICApCiAgICBvciBleGlzdHMgKAogICAgICBzZWxlY3QgMQogICAgICBmcm9tIHB1YmxpYy5jb21wYW55X21lbWJl
cnMgbQogICAgICB3aGVyZSBtLmNvbXBhbnlfaWQgPSBwX2NvbXBhbnlfaWQKICAgICAgICBhbmQgbS51c2VyX2lkID0gKHNlbGVjdCBhdXRoLnVpZCgpKQog
ICAgICAgIGFuZCBsb3dlcihjb2FsZXNjZShtLnN0YXR1cywgJycpKSA9ICdhdGl2bycKICAgICAgICBhbmQgKAogICAgICAgICAgY2FzZSBsb3dlcihjb2Fs
ZXNjZShwX2NhcGFiaWxpdHksICcnKSkKICAgICAgICAgICAgd2hlbiAnZmluYW5jZScgdGhlbgogICAgICAgICAgICAgIGxvd2VyKGNvYWxlc2NlKG0uY2Fy
Z28sICcnKSkgaW4gKCdkb25vJywgJ293bmVyJywgJ2dlcmVudGUnLCAnYWRtaW4nKQogICAgICAgICAgICB3aGVuICdwcm9wb3NhbCcgdGhlbgogICAgICAg
ICAgICAgIGxvd2VyKGNvYWxlc2NlKG0uY2FyZ28sICcnKSkgaW4gKCdkb25vJywgJ293bmVyJywgJ2dlcmVudGUnLCAnYWRtaW4nLCAnYXRlbmRlbnRlJykK
ICAgICAgICAgICAgd2hlbiAnY3JtJyB0aGVuCiAgICAgICAgICAgICAgbG93ZXIoY29hbGVzY2UobS5jYXJnbywgJycpKSBpbiAoJ2Rvbm8nLCAnb3duZXIn
LCAnZ2VyZW50ZScsICdhZG1pbicsICdhdGVuZGVudGUnKQogICAgICAgICAgICB3aGVuICdtYW5hZ2UnIHRoZW4KICAgICAgICAgICAgICBsb3dlcihjb2Fs
ZXNjZShtLmNhcmdvLCAnJykpIGluICgnZG9ubycsICdvd25lcicsICdnZXJlbnRlJywgJ2FkbWluJykKICAgICAgICAgICAgd2hlbiAncHJvZHVjdHMnIHRo
ZW4KICAgICAgICAgICAgICBsb3dlcihjb2FsZXNjZShtLmNhcmdvLCAnJykpIGluICgnZG9ubycsICdvd25lcicsICdnZXJlbnRlJywgJ2FkbWluJywgJ3By
b2R1Y2FvJykKICAgICAgICAgICAgd2hlbiAnb3JkZXJzJyB0aGVuCiAgICAgICAgICAgICAgbG93ZXIoY29hbGVzY2UobS5jYXJnbywgJycpKSBpbiAoJ2Rv
bm8nLCAnb3duZXInLCAnZ2VyZW50ZScsICdhZG1pbicsICdhdGVuZGVudGUnLCAncHJvZHVjYW8nKQogICAgICAgICAgICB3aGVuICdwcm9kdWN0aW9uJyB0
aGVuCiAgICAgICAgICAgICAgbG93ZXIoY29hbGVzY2UobS5jYXJnbywgJycpKSBpbiAoJ2Rvbm8nLCAnb3duZXInLCAnZ2VyZW50ZScsICdhZG1pbicsICdw
cm9kdWNhbycpCiAgICAgICAgICAgIHdoZW4gJ2NvbmZpZycgdGhlbgogICAgICAgICAgICAgIGxvd2VyKGNvYWxlc2NlKG0uY2FyZ28sICcnKSkgaW4gKCdk
b25vJywgJ293bmVyJywgJ2FkbWluJykKICAgICAgICAgICAgZWxzZSBmYWxzZQogICAgICAgICAgZW5kCiAgICAgICAgKQogICAgKTsKJCQ7CgpyZXZva2Ug
YWxsIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2Nhbih1dWlkLCB0ZXh0KQogIGZyb20gcHVibGljLCBhbm9uOwpncmFudCBleGVj
dXRlIG9uIGZ1bmN0aW9uIHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2Nhbih1dWlkLCB0ZXh0KQogIHRvIGF1dGhlbnRpY2F0ZWQsIHNlcnZpY2Vfcm9s
ZTsKCi0tIFRhYmVsYXMgcXVlIGNvbnRpbnVhbSBhY2Vzc2FkYXMgZGlyZXRhbWVudGUgcGVsbyBjbGllbnRlIHJlY2ViZW0gZHVhcyBjYW1hZGFzOgotLSB1
bWEgcG9saWN5IHBlcm1pc3NpdmEgZGUgY2FyZ28vZW1wcmVzYSBlIG91dHJhIFJFU1RSSUNUSVZFIGRlIHBsYW5vL2Fzc2luYXR1cmEuCmRvICQkCmRlY2xh
cmUKICBpdGVtIHJlY29yZDsKICBtZW1iZXJfcG9saWN5IHRleHQ7CiAgY2FwYWJpbGl0eV9wb2xpY3kgdGV4dDsKICBwbGFuX3BvbGljeSB0ZXh0OwpiZWdp
bgogIGZvciBpdGVtIGluCiAgICBzZWxlY3QgKgogICAgZnJvbSAoCiAgICAgIHZhbHVlcwogICAgICAgICgncHJvZHVjdHMnLCAnZXNzZW5jaWFsJywgJ3By
b2R1Y3RzJyksCiAgICAgICAgKCdvcmRlcnMnLCAnZXNzZW5jaWFsJywgJ29yZGVycycpLAogICAgICAgICgnZmluYW5jaWFsX3RyYW5zYWN0aW9ucycsICdw
cm9maXNzaW9uYWwnLCAnZmluYW5jZScpLAogICAgICAgICgnZmluYW5jaWFsX21hdGVyaWFsX2VudHJpZXMnLCAncHJvZmlzc2lvbmFsJywgJ2ZpbmFuY2Un
KSwKICAgICAgICAoJ21hcmtldHBsYWNlX2NvdXBvbnMnLCAncHJvZmlzc2lvbmFsJywgJ21hbmFnZScpLAogICAgICAgICgncHJvcG9zYWxzJywgJ3ByZW1p
dW0nLCAncHJvcG9zYWwnKSwKICAgICAgICAoJ3Byb3Bvc2FsX2V2ZW50cycsICdwcmVtaXVtJywgJ3Byb3Bvc2FsJykKICAgICkgYXMgZmVhdHVyZV90YWJs
ZSh0YWJsZV9uYW1lLCByZXF1aXJlZF9wbGFuLCBjYXBhYmlsaXR5KQogIGxvb3AKICAgIGlmIHRvX3JlZ2NsYXNzKGZvcm1hdCgncHVibGljLiVJJywgaXRl
bS50YWJsZV9uYW1lKSkgaXMgbnVsbCB0aGVuCiAgICAgIGNvbnRpbnVlOwogICAgZW5kIGlmOwoKICAgIGV4ZWN1dGUgZm9ybWF0KCdhbHRlciB0YWJsZSBw
dWJsaWMuJUkgZW5hYmxlIHJvdyBsZXZlbCBzZWN1cml0eScsIGl0ZW0udGFibGVfbmFtZSk7CgogICAgbWVtYmVyX3BvbGljeSA6PSBmb3JtYXQoJ29yY2Fs
eV9mZWF0dXJlX21lbWJlcl8lcycsIGl0ZW0udGFibGVfbmFtZSk7CiAgICBjYXBhYmlsaXR5X3BvbGljeSA6PSBmb3JtYXQoJ29yY2FseV9mZWF0dXJlX2Nh
cGFiaWxpdHlfJXMnLCBpdGVtLnRhYmxlX25hbWUpOwogICAgcGxhbl9wb2xpY3kgOj0gZm9ybWF0KCdvcmNhbHlfZmVhdHVyZV9wbGFuXyVzJywgaXRlbS50
YWJsZV9uYW1lKTsKCiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2Ryb3AgcG9saWN5IGlmIGV4aXN0cyAlSSBvbiBwdWJsaWMuJUknLAogICAgICBtZW1i
ZXJfcG9saWN5LAogICAgICBpdGVtLnRhYmxlX25hbWUKICAgICk7CiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2Ryb3AgcG9saWN5IGlmIGV4aXN0cyAl
SSBvbiBwdWJsaWMuJUknLAogICAgICBjYXBhYmlsaXR5X3BvbGljeSwKICAgICAgaXRlbS50YWJsZV9uYW1lCiAgICApOwogICAgZXhlY3V0ZSBmb3JtYXQo
CiAgICAgICdkcm9wIHBvbGljeSBpZiBleGlzdHMgJUkgb24gcHVibGljLiVJJywKICAgICAgcGxhbl9wb2xpY3ksCiAgICAgIGl0ZW0udGFibGVfbmFtZQog
ICAgKTsKCiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2NyZWF0ZSBwb2xpY3kgJUkgb24gcHVibGljLiVJIGFzIHBlcm1pc3NpdmUgZm9yIGFsbCB0byBh
dXRoZW50aWNhdGVkIHVzaW5nIChwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oY29tcGFueV9pZCwgJUwpKSB3aXRoIGNoZWNrIChwdWJsaWMub3Jj
YWx5X2N1cnJlbnRfdXNlcl9jYW4oY29tcGFueV9pZCwgJUwpKScsCiAgICAgIG1lbWJlcl9wb2xpY3ksCiAgICAgIGl0ZW0udGFibGVfbmFtZSwKICAgICAg
aXRlbS5jYXBhYmlsaXR5LAogICAgICBpdGVtLmNhcGFiaWxpdHkKICAgICk7CgogICAgLS0gUkVTVFJJQ1RJVkUgaW1wZWRlIHF1ZSB1bWEgcG9saWN5IHBl
cm1pc3NpdmEgYW50aWdhL2Jyb2FkIGNvbnRvcm5lIG8gY2FyZ28uCiAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgJ2NyZWF0ZSBwb2xpY3kgJUkgb24gcHVi
bGljLiVJIGFzIHJlc3RyaWN0aXZlIGZvciBhbGwgdG8gYXV0aGVudGljYXRlZCB1c2luZyAocHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKGNvbXBh
bnlfaWQsICVMKSkgd2l0aCBjaGVjayAocHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKGNvbXBhbnlfaWQsICVMKSknLAogICAgICBjYXBhYmlsaXR5
X3BvbGljeSwKICAgICAgaXRlbS50YWJsZV9uYW1lLAogICAgICBpdGVtLmNhcGFiaWxpdHksCiAgICAgIGl0ZW0uY2FwYWJpbGl0eQogICAgKTsKCiAgICBl
eGVjdXRlIGZvcm1hdCgKICAgICAgJ2NyZWF0ZSBwb2xpY3kgJUkgb24gcHVibGljLiVJIGFzIHJlc3RyaWN0aXZlIGZvciBhbGwgdG8gYXV0aGVudGljYXRl
ZCB1c2luZyAocHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2FjY2Vzcyhjb21wYW55X2lkLCAlTCkpIHdpdGggY2hlY2sgKHB1YmxpYy5vcmNhbHlf
Y29tcGFueV9oYXNfcGxhbl9hY2Nlc3MoY29tcGFueV9pZCwgJUwpKScsCiAgICAgIHBsYW5fcG9saWN5LAogICAgICBpdGVtLnRhYmxlX25hbWUsCiAgICAg
IGl0ZW0ucmVxdWlyZWRfcGxhbiwKICAgICAgaXRlbS5yZXF1aXJlZF9wbGFuCiAgICApOwogIGVuZCBsb29wOwplbmQ7CiQkOwoKLS0gSXRlbnMgZGUgcGVk
aWRvIGhlcmRhbSBlbXByZXNhL3BsYW5vL2NhcmdvIGF0cmF2w6lzIGRvIHBlZGlkbyBwYWkuCmRvICQkCmJlZ2luCiAgaWYgdG9fcmVnY2xhc3MoJ3B1Ymxp
Yy5vcmRlcl9pdGVtcycpIGlzIG5vdCBudWxsIHRoZW4KICAgIGFsdGVyIHRhYmxlIHB1YmxpYy5vcmRlcl9pdGVtcyBlbmFibGUgcm93IGxldmVsIHNlY3Vy
aXR5OwoKICAgIGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfb3JkZXJfaXRlbXNfbWVtYmVyCiAgICAgIG9uIHB1YmxpYy5vcmRlcl9pdGVtczsKICAg
IGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfb3JkZXJfaXRlbXNfY2FwYWJpbGl0eQogICAgICBvbiBwdWJsaWMub3JkZXJfaXRlbXM7CiAgICBkcm9w
IHBvbGljeSBpZiBleGlzdHMgb3JjYWx5X29yZGVyX2l0ZW1zX3BsYW4KICAgICAgb24gcHVibGljLm9yZGVyX2l0ZW1zOwoKICAgIGNyZWF0ZSBwb2xpY3kg
b3JjYWx5X29yZGVyX2l0ZW1zX21lbWJlcgogICAgICBvbiBwdWJsaWMub3JkZXJfaXRlbXMKICAgICAgYXMgcGVybWlzc2l2ZQogICAgICBmb3IgYWxsCiAg
ICAgIHRvIGF1dGhlbnRpY2F0ZWQKICAgICAgdXNpbmcgKAogICAgICAgIGV4aXN0cyAoCiAgICAgICAgICBzZWxlY3QgMQogICAgICAgICAgZnJvbSBwdWJs
aWMub3JkZXJzIG8KICAgICAgICAgIHdoZXJlIG8uaWQgPSBvcmRlcl9pdGVtcy5vcmRlcl9pZAogICAgICAgICAgICBhbmQgcHVibGljLm9yY2FseV9jdXJy
ZW50X3VzZXJfY2FuKG8uY29tcGFueV9pZCwgJ29yZGVycycpCiAgICAgICAgKQogICAgICApCiAgICAgIHdpdGggY2hlY2sgKAogICAgICAgIGV4aXN0cyAo
CiAgICAgICAgICBzZWxlY3QgMQogICAgICAgICAgZnJvbSBwdWJsaWMub3JkZXJzIG8KICAgICAgICAgIHdoZXJlIG8uaWQgPSBvcmRlcl9pdGVtcy5vcmRl
cl9pZAogICAgICAgICAgICBhbmQgcHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKG8uY29tcGFueV9pZCwgJ29yZGVycycpCiAgICAgICAgKQogICAg
ICApOwoKICAgIGNyZWF0ZSBwb2xpY3kgb3JjYWx5X29yZGVyX2l0ZW1zX2NhcGFiaWxpdHkKICAgICAgb24gcHVibGljLm9yZGVyX2l0ZW1zCiAgICAgIGFz
IHJlc3RyaWN0aXZlCiAgICAgIGZvciBhbGwKICAgICAgdG8gYXV0aGVudGljYXRlZAogICAgICB1c2luZyAoCiAgICAgICAgZXhpc3RzICgKICAgICAgICAg
IHNlbGVjdCAxCiAgICAgICAgICBmcm9tIHB1YmxpYy5vcmRlcnMgbwogICAgICAgICAgd2hlcmUgby5pZCA9IG9yZGVyX2l0ZW1zLm9yZGVyX2lkCiAgICAg
ICAgICAgIGFuZCBwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oby5jb21wYW55X2lkLCAnb3JkZXJzJykKICAgICAgICApCiAgICAgICkKICAgICAg
d2l0aCBjaGVjayAoCiAgICAgICAgZXhpc3RzICgKICAgICAgICAgIHNlbGVjdCAxCiAgICAgICAgICBmcm9tIHB1YmxpYy5vcmRlcnMgbwogICAgICAgICAg
d2hlcmUgby5pZCA9IG9yZGVyX2l0ZW1zLm9yZGVyX2lkCiAgICAgICAgICAgIGFuZCBwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oby5jb21wYW55
X2lkLCAnb3JkZXJzJykKICAgICAgICApCiAgICAgICk7CgogICAgY3JlYXRlIHBvbGljeSBvcmNhbHlfb3JkZXJfaXRlbXNfcGxhbgogICAgICBvbiBwdWJs
aWMub3JkZXJfaXRlbXMKICAgICAgYXMgcmVzdHJpY3RpdmUKICAgICAgZm9yIGFsbAogICAgICB0byBhdXRoZW50aWNhdGVkCiAgICAgIHVzaW5nICgKICAg
ICAgICBleGlzdHMgKAogICAgICAgICAgc2VsZWN0IDEKICAgICAgICAgIGZyb20gcHVibGljLm9yZGVycyBvCiAgICAgICAgICB3aGVyZSBvLmlkID0gb3Jk
ZXJfaXRlbXMub3JkZXJfaWQKICAgICAgICAgICAgYW5kIHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3Moby5jb21wYW55X2lkLCAnZXNz
ZW5jaWFsJykKICAgICAgICApCiAgICAgICkKICAgICAgd2l0aCBjaGVjayAoCiAgICAgICAgZXhpc3RzICgKICAgICAgICAgIHNlbGVjdCAxCiAgICAgICAg
ICBmcm9tIHB1YmxpYy5vcmRlcnMgbwogICAgICAgICAgd2hlcmUgby5pZCA9IG9yZGVyX2l0ZW1zLm9yZGVyX2lkCiAgICAgICAgICAgIGFuZCBwdWJsaWMu
b3JjYWx5X2NvbXBhbnlfaGFzX3BsYW5fYWNjZXNzKG8uY29tcGFueV9pZCwgJ2Vzc2VuY2lhbCcpCiAgICAgICAgKQogICAgICApOwogIGVuZCBpZjsKZW5k
OwokJDsKCi0tIEEgZW1wcmVzYSBwb2RlIHNlciBsaWRhIHBlbGFzIHBvbGljaWVzIGV4aXN0ZW50ZXMsIG1hcyBjb25maWd1cmHDp8OjbyBkaXJldGEKLS0g
c8OzIHBvZGUgc2VyIGFsdGVyYWRhIHBlbG8gZG9uby9hZG1pbiBlIGVucXVhbnRvIGhvdXZlciBhY2Vzc28gYXRpdm8uCmRvICQkCmJlZ2luCiAgaWYgdG9f
cmVnY2xhc3MoJ3B1YmxpYy5jb21wYW5pZXMnKSBpcyBub3QgbnVsbCB0aGVuCiAgICBhbHRlciB0YWJsZSBwdWJsaWMuY29tcGFuaWVzIGVuYWJsZSByb3cg
bGV2ZWwgc2VjdXJpdHk7CgogICAgZHJvcCBwb2xpY3kgaWYgZXhpc3RzIG9yY2FseV9jb21wYW55X3VwZGF0ZV9tZW1iZXIKICAgICAgb24gcHVibGljLmNv
bXBhbmllczsKICAgIGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfY29tcGFueV91cGRhdGVfY2FwYWJpbGl0eQogICAgICBvbiBwdWJsaWMuY29tcGFu
aWVzOwogICAgZHJvcCBwb2xpY3kgaWYgZXhpc3RzIG9yY2FseV9jb21wYW55X3VwZGF0ZV9wbGFuCiAgICAgIG9uIHB1YmxpYy5jb21wYW5pZXM7CgogICAg
Y3JlYXRlIHBvbGljeSBvcmNhbHlfY29tcGFueV91cGRhdGVfbWVtYmVyCiAgICAgIG9uIHB1YmxpYy5jb21wYW5pZXMKICAgICAgYXMgcGVybWlzc2l2ZQog
ICAgICBmb3IgdXBkYXRlCiAgICAgIHRvIGF1dGhlbnRpY2F0ZWQKICAgICAgdXNpbmcgKHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2NhbihpZCwgJ2Nv
bmZpZycpKQogICAgICB3aXRoIGNoZWNrIChwdWJsaWMub3JjYWx5X2N1cnJlbnRfdXNlcl9jYW4oaWQsICdjb25maWcnKSk7CgogICAgY3JlYXRlIHBvbGlj
eSBvcmNhbHlfY29tcGFueV91cGRhdGVfY2FwYWJpbGl0eQogICAgICBvbiBwdWJsaWMuY29tcGFuaWVzCiAgICAgIGFzIHJlc3RyaWN0aXZlCiAgICAgIGZv
ciB1cGRhdGUKICAgICAgdG8gYXV0aGVudGljYXRlZAogICAgICB1c2luZyAocHVibGljLm9yY2FseV9jdXJyZW50X3VzZXJfY2FuKGlkLCAnY29uZmlnJykp
CiAgICAgIHdpdGggY2hlY2sgKHB1YmxpYy5vcmNhbHlfY3VycmVudF91c2VyX2NhbihpZCwgJ2NvbmZpZycpKTsKCiAgICBjcmVhdGUgcG9saWN5IG9yY2Fs
eV9jb21wYW55X3VwZGF0ZV9wbGFuCiAgICAgIG9uIHB1YmxpYy5jb21wYW5pZXMKICAgICAgYXMgcmVzdHJpY3RpdmUKICAgICAgZm9yIHVwZGF0ZQogICAg
ICB0byBhdXRoZW50aWNhdGVkCiAgICAgIHVzaW5nIChwdWJsaWMub3JjYWx5X2NvbXBhbnlfaGFzX3BsYW5fYWNjZXNzKGlkLCAnZXNzZW5jaWFsJykpCiAg
ICAgIHdpdGggY2hlY2sgKHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3MoaWQsICdlc3NlbmNpYWwnKSk7CiAgZW5kIGlmOwplbmQ7CiQk
OwoKLS0gTm90YXMgZmlzY2FpcyBzw6NvIFByZW1pdW0gZW1ib3JhIGNvbXBhcnRpbGhlbSBmaW5hbmNpYWxfdHJhbnNhY3Rpb25zLgpkbyAkJApiZWdpbgog
IGlmCiAgICB0b19yZWdjbGFzcygncHVibGljLmZpbmFuY2lhbF90cmFuc2FjdGlvbnMnKSBpcyBub3QgbnVsbAogICAgYW5kIGV4aXN0cyAoCiAgICAgIHNl
bGVjdCAxCiAgICAgIGZyb20gaW5mb3JtYXRpb25fc2NoZW1hLmNvbHVtbnMKICAgICAgd2hlcmUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYycKICAgICAgICBh
bmQgdGFibGVfbmFtZSA9ICdmaW5hbmNpYWxfdHJhbnNhY3Rpb25zJwogICAgICAgIGFuZCBjb2x1bW5fbmFtZSA9ICdvcmlnZW0nCiAgICApCiAgICBhbmQg
ZXhpc3RzICgKICAgICAgc2VsZWN0IDEKICAgICAgZnJvbSBpbmZvcm1hdGlvbl9zY2hlbWEuY29sdW1ucwogICAgICB3aGVyZSB0YWJsZV9zY2hlbWEgPSAn
cHVibGljJwogICAgICAgIGFuZCB0YWJsZV9uYW1lID0gJ2ZpbmFuY2lhbF90cmFuc2FjdGlvbnMnCiAgICAgICAgYW5kIGNvbHVtbl9uYW1lID0gJ25vdGFf
bnVtZXJvJwogICAgKQogICAgYW5kIGV4aXN0cyAoCiAgICAgIHNlbGVjdCAxCiAgICAgIGZyb20gaW5mb3JtYXRpb25fc2NoZW1hLmNvbHVtbnMKICAgICAg
d2hlcmUgdGFibGVfc2NoZW1hID0gJ3B1YmxpYycKICAgICAgICBhbmQgdGFibGVfbmFtZSA9ICdmaW5hbmNpYWxfdHJhbnNhY3Rpb25zJwogICAgICAgIGFu
ZCBjb2x1bW5fbmFtZSA9ICdkb2N1bWVudG9fdXJsJwogICAgKQogIHRoZW4KICAgIGRyb3AgcG9saWN5IGlmIGV4aXN0cyBvcmNhbHlfZmluYW5jaWFsX25v
dGVzX3ByZW1pdW0KICAgICAgb24gcHVibGljLmZpbmFuY2lhbF90cmFuc2FjdGlvbnM7CgogICAgY3JlYXRlIHBvbGljeSBvcmNhbHlfZmluYW5jaWFsX25v
dGVzX3ByZW1pdW0KICAgICAgb24gcHVibGljLmZpbmFuY2lhbF90cmFuc2FjdGlvbnMKICAgICAgYXMgcmVzdHJpY3RpdmUKICAgICAgZm9yIGFsbAogICAg
ICB0byBhdXRoZW50aWNhdGVkCiAgICAgIHVzaW5nICgKICAgICAgICAoCiAgICAgICAgICBsb3dlcihjb2FsZXNjZShvcmlnZW0sICcnKSkgPD4gJ25vdGFf
ZmlzY2FsJwogICAgICAgICAgYW5kIGNvYWxlc2NlKG5vdGFfbnVtZXJvLCAnJykgPSAnJwogICAgICAgICAgYW5kIGNvYWxlc2NlKGRvY3VtZW50b191cmws
ICcnKSA9ICcnCiAgICAgICAgKQogICAgICAgIG9yIHB1YmxpYy5vcmNhbHlfY29tcGFueV9oYXNfcGxhbl9hY2Nlc3MoY29tcGFueV9pZCwgJ3ByZW1pdW0n
KQogICAgICApCiAgICAgIHdpdGggY2hlY2sgKAogICAgICAgICgKICAgICAgICAgIGxvd2VyKGNvYWxlc2NlKG9yaWdlbSwgJycpKSA8PiAnbm90YV9maXNj
YWwnCiAgICAgICAgICBhbmQgY29hbGVzY2Uobm90YV9udW1lcm8sICcnKSA9ICcnCiAgICAgICAgICBhbmQgY29hbGVzY2UoZG9jdW1lbnRvX3VybCwgJycp
ID0gJycKICAgICAgICApCiAgICAgICAgb3IgcHVibGljLm9yY2FseV9jb21wYW55X2hhc19wbGFuX2FjY2Vzcyhjb21wYW55X2lkLCAncHJlbWl1bScpCiAg
ICAgICk7CiAgZW5kIGlmOwplbmQ7CiQkOwoKLS0gQ1JNIGUgZGFkb3MgZmluYW5jZWlyb3MgYXV0b3JpdGF0aXZvcyBwYXNzYW0gc29tZW50ZSBwZWxhcyBB
UElzIHNlcnZpY2Utcm9sZS4KZG8gJCQKZGVjbGFyZQogIHRhYmxlX25hbWUgdGV4dDsKYmVnaW4KICBmb3JlYWNoIHRhYmxlX25hbWUgaW4gYXJyYXkgYXJy
YXlbCiAgICAnY3JtX2xlYWRzJywKICAgICdtYXJrZXRwbGFjZV9wYXltZW50X3NldHRpbmdzJywKICAgICdtYXJrZXRwbGFjZV9wYXltZW50cycsCiAgICAn
bWFya2V0cGxhY2VfY29tbWlzc2lvbnMnLAogICAgJ21hcmtldHBsYWNlX2NvbW1pc3Npb25fcnVsZXMnLAogICAgJ21hcmtldHBsYWNlX29hdXRoX3N0YXRl
cycsCiAgICAncGF5bWVudF93ZWJob29rX2V2ZW50cycsCiAgICAncGxhbl9wYXltZW50cycKICBdCiAgbG9vcAogICAgaWYgdG9fcmVnY2xhc3MoZm9ybWF0
KCdwdWJsaWMuJUknLCB0YWJsZV9uYW1lKSkgaXMgbm90IG51bGwgdGhlbgogICAgICBleGVjdXRlIGZvcm1hdCgKICAgICAgICAncmV2b2tlIGFsbCBwcml2
aWxlZ2VzIG9uIHRhYmxlIHB1YmxpYy4lSSBmcm9tIGF1dGhlbnRpY2F0ZWQnLAogICAgICAgIHRhYmxlX25hbWUKICAgICAgKTsKICAgIGVuZCBpZjsKICBl
bmQgbG9vcDsKZW5kOwokJDsKCi0tIFZpZXdzIGRlIHByb3Bvc3RhIHBhc3NhbSBhIG9iZWRlY2VyIFJMUyBkYXMgdGFiZWxhcy1iYXNlLgpkbyAkJApiZWdp
bgogIGlmIHRvX3JlZ2NsYXNzKCdwdWJsaWMucHJvcG9zYWxzX2Rhc2hib2FyZCcpIGlzIG5vdCBudWxsIHRoZW4KICAgIGV4ZWN1dGUgJ2FsdGVyIHZpZXcg
cHVibGljLnByb3Bvc2Fsc19kYXNoYm9hcmQgc2V0IChzZWN1cml0eV9pbnZva2VyID0gdHJ1ZSknOwogIGVuZCBpZjsKZW5kOwokJDsKCmNvbW1pdDsKYCk7
Cgpjb25zb2xlLmxvZyhgUEFUQ0hfQ0hBTkdFRD0ke2NoYW5nZWQubGVuZ3RofWApOwpjb25zb2xlLmxvZyhgUEFUQ0hfQ1JFQVRFRD0ke2NyZWF0ZWQubGVu
Z3RofWApOwpjb25zb2xlLmxvZygiT1JDQUxZX1BBVENIRVJfT0s9MSIpOwo=
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
