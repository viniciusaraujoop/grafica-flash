param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Command([string[]]$Candidates) {
    foreach ($Candidate in $Candidates) {
        $Found = Get-Command $Candidate -ErrorAction SilentlyContinue
        if ($Found) { return $Found.Source }
    }
    throw "Comando nao encontrado: $($Candidates -join ', ')"
}

function Run-Capture(
    [string]$Name,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$OutputPath
) {
    Write-Host ""
    Write-Host "--- $Name ---" -ForegroundColor Yellow

    & $FilePath @Arguments 2>&1 | Tee-Object -FilePath $OutputPath
    $Code = $LASTEXITCODE

    Write-Host "$Name EXIT_CODE=$Code" -ForegroundColor $(if ($Code -eq 0) { "Green" } else { "Yellow" })
    return $Code
}

$Git = Command @("git.exe", "git")
$Node = Command @("node.exe", "node")
$Npm = Command @("npm.cmd", "npm")
$Npx = Command @("npx.cmd", "npx")

$Root = (& $Git rev-parse --show-toplevel).Trim()
if (-not $Root) { throw "Repositorio Git nao encontrado." }
Set-Location $Root

$Branch = (& $Git branch --show-current).Trim()
if ($Branch -ne "agent/hardening-orcaly-2026-08-08") {
    throw "Execute na branch agent/hardening-orcaly-2026-08-08. Atual: $Branch"
}

$ReportDir = Join-Path $Root ".orcaly-hardening-local"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunDir = Join-Path $ReportDir "v7-$Stamp"
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

Step "Backup dos arquivos tocados pela V7"
$Touch = @(
    "eslint.config.mjs",
    "app/proposta/[token]/page.tsx",
    "components/admin/OwnerControlCenter.tsx",
    "components/checkout/CheckoutClient.tsx",
    "components/financeiro/FinancialAreaClient.tsx",
    "components/home/HomeAiChat.tsx",
    "components/subscription/SubscriptionManager.tsx"
)

foreach ($Rel in $Touch) {
    $Full = Join-Path $Root $Rel
    if (-not (Test-Path -LiteralPath $Full)) {
        throw "Arquivo esperado nao existe: $Rel"
    }
    $Backup = Join-Path $RunDir ("backup\" + $Rel)
    New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
    Copy-Item -LiteralPath $Full -Destination $Backup -Force
}

Step "Aplicando primeiro lote de correcoes reais de React e lint"
$Patcher = Join-Path $RunDir "v7-patcher.mjs"
[System.IO.File]::WriteAllBytes(
    $Patcher,
    [Convert]::FromBase64String("aW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwoKY29uc3Qgcm9vdCA9IHByb2Nlc3MuY3dkKCk7CmxldCBjaGFuZ2VkID0gMDsKCmZ1bmN0aW9uIHJlYWQocmVsKSB7CiAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocm9vdCwgcmVsKSwgInV0ZjgiKS5yZXBsYWNlKC9cclxuL2csICJcbiIpOwp9CgpmdW5jdGlvbiB3cml0ZShyZWwsIGNvbnRlbnQpIHsKICBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyb290LCByZWwpLCBjb250ZW50LCAidXRmOCIpOwogIGNoYW5nZWQgKz0gMTsKICBjb25zb2xlLmxvZyhgW1BBVENIXSAke3JlbH1gKTsKfQoKZnVuY3Rpb24gcGF0Y2gocmVsLCB0cmFuc2Zvcm0pIHsKICBjb25zdCBvcmlnaW5hbCA9IHJlYWQocmVsKTsKICBjb25zdCB1cGRhdGVkID0gdHJhbnNmb3JtKG9yaWdpbmFsKTsKICBpZiAodXBkYXRlZCA9PT0gb3JpZ2luYWwpIHsKICAgIGNvbnNvbGUubG9nKGBbU0tJUF0gJHtyZWx9YCk7CiAgICByZXR1cm47CiAgfQogIHdyaXRlKHJlbCwgdXBkYXRlZCk7Cn0KCmZ1bmN0aW9uIHJlcGxhY2VPbmNlKGNvbnRlbnQsIG9sZFRleHQsIG5ld1RleHQsIGxhYmVsKSB7CiAgaWYgKGNvbnRlbnQuaW5jbHVkZXMobmV3VGV4dCkpIHJldHVybiBjb250ZW50OwogIGNvbnN0IGZpcnN0ID0gY29udGVudC5pbmRleE9mKG9sZFRleHQpOwogIGlmIChmaXJzdCA8IDApIHRocm93IG5ldyBFcnJvcihgUGFkcmFvIG5hbyBlbmNvbnRyYWRvOiAke2xhYmVsfWApOwogIGlmIChjb250ZW50LmluZGV4T2Yob2xkVGV4dCwgZmlyc3QgKyBvbGRUZXh0Lmxlbmd0aCkgPj0gMCkgewogICAgdGhyb3cgbmV3IEVycm9yKGBQYWRyYW8gYW1iaWd1bzogJHtsYWJlbH1gKTsKICB9CiAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZShvbGRUZXh0LCBuZXdUZXh0KTsKfQoKZnVuY3Rpb24gcmVwbGFjZVJlZ2V4T25jZShjb250ZW50LCByZWdleCwgcmVwbGFjZW1lbnQsIGxhYmVsKSB7CiAgY29uc3QgbWF0Y2hlcyA9IFsuLi5jb250ZW50Lm1hdGNoQWxsKHJlZ2V4KV07CiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSB7CiAgICBpZiAodHlwZW9mIHJlcGxhY2VtZW50ID09PSAic3RyaW5nIiAmJiBjb250ZW50LmluY2x1ZGVzKHJlcGxhY2VtZW50KSkgcmV0dXJuIGNvbnRlbnQ7CiAgICB0aHJvdyBuZXcgRXJyb3IoYFJlZ2V4IG5hbyBlbmNvbnRyYWRvOiAke2xhYmVsfWApOwogIH0KICBpZiAobWF0Y2hlcy5sZW5ndGggIT09IDEpIHRocm93IG5ldyBFcnJvcihgUmVnZXggYW1iaWd1byAoJHttYXRjaGVzLmxlbmd0aH0pOiAke2xhYmVsfWApOwogIHJldHVybiBjb250ZW50LnJlcGxhY2UocmVnZXgsIHJlcGxhY2VtZW50KTsKfQoKLy8gMSkgRVNMaW50OiBpZ25vcmUgb25seSBnZW5lcmF0ZWQvbG9jYWwgYXJ0aWZhY3RzLiBQcm9kdWN0aW9uIHNvdXJjZSByZW1haW5zIHN0cmljdC4KcGF0Y2goImVzbGludC5jb25maWcubWpzIiwgKGNvbnRlbnQpID0+IHsKICBpZiAoY29udGVudC5pbmNsdWRlcygnInBhY290ZS0qLyoqIicpKSByZXR1cm4gY29udGVudDsKICByZXR1cm4gcmVwbGFjZU9uY2UoCiAgICBjb250ZW50LAogICAgJyAgICAiLm9yY2FseS1iYWNrdXBzLyoqIixcbicsCiAgICAnICAgICIub3JjYWx5LWJhY2t1cHMvKioiLFxuJyArCiAgICAgICcgICAgIi5vcmNhbHktKi8qKiIsXG4nICsKICAgICAgJyAgICAicGFjb3RlLSovKioiLFxuJyArCiAgICAgICcgICAgIm9yY2FseS1wYXltZW50LWZsb3dzLXBoYXNlMS8qKiIsXG4nICsKICAgICAgJyAgICAib3JjYWx5LXBheW1lbnQtZmxvd3MtcGhhc2UxLm1qcyIsXG4nICsKICAgICAgJyAgICAib3JjYWx5LXBheW1lbnQtZmxvd3MtcGhhc2UxLnppcCIsXG4nLAogICAgImVzbGludCBsb2NhbCBhcnRpZmFjdHMiLAogICk7Cn0pOwoKLy8gMikgUHVibGljIHByb3Bvc2FsIHBhZ2U6IHR5cGUgdGhlIGxvb3NlIHN0cnVjdHVyZXMgYW5kIHNjaGVkdWxlIGluaXRpYWwgbG9hZC4KcGF0Y2goImFwcC9wcm9wb3N0YS9bdG9rZW5dL3BhZ2UudHN4IiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gcmVwbGFjZU9uY2UoCiAgICBjb250ZW50LAogICAgImltcG9ydCB7IHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCciLAogICAgImltcG9ydCB7IHVzZUNhbGxiYWNrLCB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnIiwKICAgICJwcm9wb3NhbCB1c2VDYWxsYmFjayBpbXBvcnQiLAogICk7CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAicmVzcG9zdGFzPzogUmVjb3JkPHN0cmluZywgYW55PiIsCiAgICAicmVzcG9zdGFzPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4iLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygidHlwZSBQcm9wb3NhbEV2ZW50ID0geyIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2UoCiAgICAgIGNvbnRlbnQsCiAgICAgICJ0eXBlIEVtcHJlc2EgPSB7XG4iLAogICAgICAidHlwZSBQcm9wb3NhbEV2ZW50ID0ge1xuIiArCiAgICAgICAgIiAgaWQ6IHN0cmluZ1xuIiArCiAgICAgICAgIiAgZXZlbnRfdHlwZTogc3RyaW5nXG4iICsKICAgICAgICAiICBjcmVhdGVkX2F0OiBzdHJpbmdcbiIgKwogICAgICAgICIgIG5vdGU/OiBzdHJpbmcgfCBudWxsXG4iICsKICAgICAgICAifVxuXG4iICsKICAgICAgICAidHlwZSBFbXByZXNhID0ge1xuIiwKICAgICAgInByb3Bvc2FsIGV2ZW50IHR5cGUiLAogICAgKTsKICB9CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAiY29uc3QgW2NvbmZpZywgc2V0Q29uZmlnXSA9IHVzZVN0YXRlPGFueT4oe30pIiwKICAgICJjb25zdCBbY29uZmlnLCBzZXRDb25maWddID0gdXNlU3RhdGU8UmVjb3JkPHN0cmluZywgdW5rbm93bj4+KHt9KSIsCiAgKTsKICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgImNvbnN0IFtldmVudHMsIHNldEV2ZW50c10gPSB1c2VTdGF0ZTxhbnlbXT4oW10pIiwKICAgICJjb25zdCBbZXZlbnRzLCBzZXRFdmVudHNdID0gdXNlU3RhdGU8UHJvcG9zYWxFdmVudFtdPihbXSkiLAogICk7CgogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3QgY2FycmVnYXIgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7IikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZSgKICAgICAgY29udGVudCwKICAgICAgIiAgYXN5bmMgZnVuY3Rpb24gY2FycmVnYXIoKSB7XG4gICAgc2V0Q2FycmVnYW5kbyh0cnVlKVxuIiwKICAgICAgIiAgY29uc3QgY2FycmVnYXIgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4iICsKICAgICAgICAiICAgIGlmICghdG9rZW4pIHJldHVyblxuIiArCiAgICAgICAgIiAgICBzZXRDYXJyZWdhbmRvKHRydWUpXG4iLAogICAgICAicHJvcG9zYWwgbG9hZCBjYWxsYmFjayBzdGFydCIsCiAgICApOwoKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZSgKICAgICAgY29udGVudCwKICAgICAgIiAgICBzZXRDYXJyZWdhbmRvKGZhbHNlKVxuICB9XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAodG9rZW4pIGNhcnJlZ2FyKClcbiAgfSwgW3Rva2VuXSkiLAogICAgICAiICAgIHNldENhcnJlZ2FuZG8oZmFsc2UpXG4iICsKICAgICAgICAiICB9LCBbdG9rZW5dKVxuXG4iICsKICAgICAgICAiICB1c2VFZmZlY3QoKCkgPT4ge1xuIiArCiAgICAgICAgIiAgICBpZiAoIXRva2VuKSByZXR1cm5cblxuIiArCiAgICAgICAgIiAgICBjb25zdCB0aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiIgKwogICAgICAgICIgICAgICB2b2lkIGNhcnJlZ2FyKClcbiIgKwogICAgICAgICIgICAgfSwgMClcblxuIiArCiAgICAgICAgIiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dCh0aW1lcilcbiIgKwogICAgICAgICIgIH0sIFtjYXJyZWdhciwgdG9rZW5dKSIsCiAgICAgICJwcm9wb3NhbCBsb2FkIGNhbGxiYWNrIGVuZC9lZmZlY3QiLAogICAgKTsKICB9CgogIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoCiAgICAic2V0QWJhKGlkIGFzIGFueSkiLAogICAgInNldEFiYShpZCBhcyAnYXByb3ZhcicgfCAnYWx0ZXJhY2FvJyB8ICdyZWN1c2FyJykiLAogICk7CgogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDMpIE93bmVyIGNvbnRyb2wgY2VudGVyOiBpbml0aWFsIGFzeW5jIGxvYWQgc2hvdWxkIG5vdCBzeW5jaHJvbm91c2x5IGNhc2NhZGUgZnJvbSBlZmZlY3QuCnBhdGNoKCJjb21wb25lbnRzL2FkbWluL093bmVyQ29udHJvbENlbnRlci50c3giLCAoY29udGVudCkgPT4gewogIGNvbnN0IG9sZEJsb2NrID0KYCAgdXNlRWZmZWN0KCgpID0+IHsKICAgIHZvaWQgbG9hZCgpOwogIH0sIFtsb2FkXSk7YDsKICBjb25zdCBuZXdCbG9jayA9CmAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBjb25zdCB0aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHsKICAgICAgdm9pZCBsb2FkKCk7CiAgICB9LCAwKTsKCiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dCh0aW1lcik7CiAgfSwgW2xvYWRdKTtgOwogIHJldHVybiByZXBsYWNlT25jZShjb250ZW50LCBvbGRCbG9jaywgbmV3QmxvY2ssICJvd25lciBpbml0aWFsIGxvYWQgZWZmZWN0Iik7Cn0pOwoKLy8gNCkgQ2hlY2tvdXQ6IGRlZmVyIHNlc3Npb24gcmVzdG9yZSBzZXR0ZXJzIGFuZCBudWxsLXRvdGFsIHJlc2V0LgpwYXRjaCgiY29tcG9uZW50cy9jaGVja291dC9DaGVja291dENsaWVudC50c3giLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3QgcmVzdG9yZVRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4geyIpKSB7CiAgICBjb250ZW50ID0gcmVwbGFjZU9uY2UoCiAgICAgIGNvbnRlbnQsCiAgICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBpZiAoIWRhdGEpIHJldHVybjsKCiAgICBjb25zdCBrZXkgPSBcYG9yY2FseS1jaGVja291dDpcJHtzbHVnfVxgO2AsCiAgICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBpZiAoIWRhdGEpIHJldHVybjsKCiAgICBjb25zdCByZXN0b3JlVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7CiAgICBjb25zdCBrZXkgPSBcYG9yY2FseS1jaGVja291dDpcJHtzbHVnfVxgO2AsCiAgICAgICJjaGVja291dCByZXN0b3JlIGVmZmVjdCBzdGFydCIsCiAgICApOwoKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZSgKICAgICAgY29udGVudCwKICAgICAgYCAgICB9IGNhdGNoIHsKICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTsKICAgIH0KICB9LCBbZGF0YSwgc2x1Z10pO2AsCiAgICAgIGAgICAgfSBjYXRjaCB7CiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7CiAgICB9CiAgICB9LCAwKTsKCiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dChyZXN0b3JlVGltZXIpOwogIH0sIFtkYXRhLCBzbHVnXSk7YCwKICAgICAgImNoZWNrb3V0IHJlc3RvcmUgZWZmZWN0IGVuZCIsCiAgICApOwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlKAogICAgY29udGVudCwKICAgIGAgICAgaWYgKCFkYXRhIHx8IGNhcnQubGVuZ3RoID09PSAwKSB7CiAgICAgIHNldFByZXBhcmVkVG90YWwobnVsbCk7CiAgICAgIHJldHVybjsKICAgIH1gLAogICAgYCAgICBpZiAoIWRhdGEgfHwgY2FydC5sZW5ndGggPT09IDApIHsKICAgICAgY29uc3QgcmVzZXRUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHsKICAgICAgICBzZXRQcmVwYXJlZFRvdGFsKG51bGwpOwogICAgICB9LCAwKTsKCiAgICAgIHJldHVybiAoKSA9PiB3aW5kb3cuY2xlYXJUaW1lb3V0KHJlc2V0VGltZXIpOwogICAgfWAsCiAgICAiY2hlY2tvdXQgcHJlcGFyZWQgdG90YWwgcmVzZXQiLAogICk7CgogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDUpIEZpbmFuY2U6IHNjaGVkdWxlIGluaXRpYWwgbG9hZCBhbmQgbW9kZS1yZXNldCB1cGRhdGVzLgpwYXRjaCgiY29tcG9uZW50cy9maW5hbmNlaXJvL0ZpbmFuY2lhbEFyZWFDbGllbnQudHN4IiwgKGNvbnRlbnQpID0+IHsKICBjb250ZW50ID0gcmVwbGFjZU9uY2UoCiAgICBjb250ZW50LAogICAgYCAgdXNlRWZmZWN0KCgpID0+IHsKICAgIHZvaWQgbG9hZERhdGEoKQogIH0sIFtdKWAsCiAgICBgICB1c2VFZmZlY3QoKCkgPT4gewogICAgY29uc3QgdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7CiAgICAgIHZvaWQgbG9hZERhdGEoKQogICAgfSwgMCkKCiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dCh0aW1lcikKICB9LCBbXSlgLAogICAgImZpbmFuY2UgaW5pdGlhbCBsb2FkIGVmZmVjdCIsCiAgKTsKCiAgY29udGVudCA9IHJlcGxhY2VPbmNlKAogICAgY29udGVudCwKICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBzZXRGb3JtKGRlZmF1bHRGb3JtKG1vZGUpKQogICAgc2V0RG9jdW1lbnRGaWxlKG51bGwpCiAgICBzZXRTaG93Rm9ybShmYWxzZSkKICAgIHNldFF1ZXJ5KCcnKQogICAgc2V0U3RhdHVzRmlsdGVyKCd0b2RvcycpCiAgfSwgW21vZGVdKWAsCiAgICBgICB1c2VFZmZlY3QoKCkgPT4gewogICAgY29uc3QgdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7CiAgICAgIHNldEZvcm0oZGVmYXVsdEZvcm0obW9kZSkpCiAgICAgIHNldERvY3VtZW50RmlsZShudWxsKQogICAgICBzZXRTaG93Rm9ybShmYWxzZSkKICAgICAgc2V0UXVlcnkoJycpCiAgICAgIHNldFN0YXR1c0ZpbHRlcigndG9kb3MnKQogICAgfSwgMCkKCiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dCh0aW1lcikKICB9LCBbbW9kZV0pYCwKICAgICJmaW5hbmNlIG1vZGUgcmVzZXQgZWZmZWN0IiwKICApOwoKICByZXR1cm4gY29udGVudDsKfSk7CgovLyA2KSBIb21lIEFJIGNoYXQ6IHJlc3RvcmUvbG9jYWwgVUkgc3RhdGUgZnJvbSB0aW1lciBjYWxsYmFja3MsIG5vdCBlZmZlY3QgYm9keS4KcGF0Y2goImNvbXBvbmVudHMvaG9tZS9Ib21lQWlDaGF0LnRzeCIsIChjb250ZW50KSA9PiB7CiAgY29udGVudCA9IHJlcGxhY2VPbmNlKAogICAgY29udGVudCwKICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBzZXRNZXNzYWdlcyhyZXN0b3JlTWVzc2FnZXMoKSkKICAgIHNldEh5ZHJhdGVkKHRydWUpCiAgfSwgW10pYCwKICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBjb25zdCB0aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHsKICAgICAgc2V0TWVzc2FnZXMocmVzdG9yZU1lc3NhZ2VzKCkpCiAgICAgIHNldEh5ZHJhdGVkKHRydWUpCiAgICB9LCAwKQoKICAgIHJldHVybiAoKSA9PiB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVyKQogIH0sIFtdKWAsCiAgICAiaG9tZSBjaGF0IGh5ZHJhdGlvbiBlZmZlY3QiLAogICk7CgogIGNvbnRlbnQgPSByZXBsYWNlT25jZSgKICAgIGNvbnRlbnQsCiAgICBgICB1c2VFZmZlY3QoKCkgPT4gewogICAgaWYgKCFvcGVuKSByZXR1cm4KCiAgICBzZXRVbnJlYWQoZmFsc2UpCgogICAgY29uc3QgdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7CiAgICAgIGlucHV0UmVmLmN1cnJlbnQ/LmZvY3VzKCkKICAgIH0sIDE4MCkKCiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dCh0aW1lcikKICB9LCBbb3Blbl0pYCwKICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBpZiAoIW9wZW4pIHJldHVybgoKICAgIGNvbnN0IHRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4gewogICAgICBzZXRVbnJlYWQoZmFsc2UpCiAgICAgIGlucHV0UmVmLmN1cnJlbnQ/LmZvY3VzKCkKICAgIH0sIDE4MCkKCiAgICByZXR1cm4gKCkgPT4gd2luZG93LmNsZWFyVGltZW91dCh0aW1lcikKICB9LCBbb3Blbl0pYCwKICAgICJob21lIGNoYXQgb3BlbiBlZmZlY3QiLAogICk7CgogIHJldHVybiBjb250ZW50Owp9KTsKCi8vIDcpIFN1YnNjcmlwdGlvbiBtYW5hZ2VyOiBzdGFibGUgY2xvY2sgKyBkZWZlcnJlZCBsb2FkLgpwYXRjaCgiY29tcG9uZW50cy9zdWJzY3JpcHRpb24vU3Vic2NyaXB0aW9uTWFuYWdlci50c3giLCAoY29udGVudCkgPT4gewogIGlmICghY29udGVudC5pbmNsdWRlcygiY29uc3QgW2N1cnJlbnRUaW1lc3RhbXAsIHNldEN1cnJlbnRUaW1lc3RhbXBdID0gdXNlU3RhdGUoMCk7IikpIHsKICAgIGNvbnRlbnQgPSByZXBsYWNlT25jZSgKICAgICAgY29udGVudCwKICAgICAgYCAgY29uc3QgW2NhbmNlbE9wZW4sIHNldENhbmNlbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpOwogIGNvbnN0IFtjYW5jZWxSZWFzb24sIHNldENhbmNlbFJlYXNvbl0gPSB1c2VTdGF0ZSgiIik7YCwKICAgICAgYCAgY29uc3QgW2NhbmNlbE9wZW4sIHNldENhbmNlbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpOwogIGNvbnN0IFtjYW5jZWxSZWFzb24sIHNldENhbmNlbFJlYXNvbl0gPSB1c2VTdGF0ZSgiIik7CiAgY29uc3QgW2N1cnJlbnRUaW1lc3RhbXAsIHNldEN1cnJlbnRUaW1lc3RhbXBdID0gdXNlU3RhdGUoMCk7YCwKICAgICAgInN1YnNjcmlwdGlvbiBjbG9jayBzdGF0ZSIsCiAgICApOwogIH0KCiAgY29udGVudCA9IHJlcGxhY2VPbmNlKAogICAgY29udGVudCwKICAgIGAgIHVzZUVmZmVjdCgoKSA9PiB7CiAgICB2b2lkIGxvYWQoKTsKICB9LCBbbG9hZF0pO2AsCiAgICBgICB1c2VFZmZlY3QoKCkgPT4gewogICAgY29uc3QgbG9hZFRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4gewogICAgICB2b2lkIGxvYWQoKTsKICAgIH0sIDApOwoKICAgIGNvbnN0IHJlZnJlc2hDbG9jayA9ICgpID0+IHsKICAgICAgc2V0Q3VycmVudFRpbWVzdGFtcChuZXcgRGF0ZSgpLmdldFRpbWUoKSk7CiAgICB9OwoKICAgIGNvbnN0IGNsb2NrVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dChyZWZyZXNoQ2xvY2ssIDApOwogICAgY29uc3QgY2xvY2tJbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbChyZWZyZXNoQ2xvY2ssIDYwXzAwMCk7CgogICAgcmV0dXJuICgpID0+IHsKICAgICAgd2luZG93LmNsZWFyVGltZW91dChsb2FkVGltZXIpOwogICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KGNsb2NrVGltZXIpOwogICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbChjbG9ja0ludGVydmFsKTsKICAgIH07CiAgfSwgW2xvYWRdKTtgLAogICAgInN1YnNjcmlwdGlvbiBsb2FkIGFuZCBjbG9jayBlZmZlY3QiLAogICk7CgogIGNvbnRlbnQgPSByZXBsYWNlUmVnZXhPbmNlKAogICAgY29udGVudCwKICAgIC8gIGNvbnN0IHRyaWFsUHJvZ3Jlc3MgPSB1c2VNZW1vXChcKFwpID0+IFx7XG4gICAgaWYgXCghY29tcGFueVw/XC50cmlhbF9zdGFydGVkX2F0IFx8XHwgIWNvbXBhbnlcP1wudHJpYWxfZW5kc19hdFwpIHJldHVybiAwO1xuICAgIGNvbnN0IHN0YXJ0ID0gbmV3IERhdGVcKGNvbXBhbnlcLnRyaWFsX3N0YXJ0ZWRfYXRcKVwuZ2V0VGltZVwoXCk7XG4gICAgY29uc3QgZW5kID0gbmV3IERhdGVcKGNvbXBhbnlcLnRyaWFsX2VuZHNfYXRcKVwuZ2V0VGltZVwoXCk7XG4gICAgY29uc3QgdG90YWwgPSBNYXRoXC5tYXhcKDEsIGVuZCAtIHN0YXJ0XCk7XG4gICAgY29uc3QgZWxhcHNlZCA9IE1hdGhcLm1pblwodG90YWwsIE1hdGhcLm1heFwoMCwgRGF0ZVwubm93XChcKSAtIHN0YXJ0XClcKTtcbiAgICByZXR1cm4gTWF0aFwucm91bmRcKFwoZWxhcHNlZCBcLyB0b3RhbFwpIFwqIDEwMFwpO1xuICBcfSwgXFtjb21wYW55XD9cLnRyaWFsX2VuZHNfYXQsIGNvbXBhbnlcP1wudHJpYWxfc3RhcnRlZF9hdFxdXCk7LywKICAgIGAgIGNvbnN0IHRyaWFsUHJvZ3Jlc3MgPSAoKCkgPT4gewogICAgaWYgKAogICAgICAhY29tcGFueT8udHJpYWxfc3RhcnRlZF9hdCB8fAogICAgICAhY29tcGFueT8udHJpYWxfZW5kc19hdCB8fAogICAgICBjdXJyZW50VGltZXN0YW1wIDw9IDAKICAgICkgewogICAgICByZXR1cm4gMDsKICAgIH0KCiAgICBjb25zdCBzdGFydCA9IG5ldyBEYXRlKGNvbXBhbnkudHJpYWxfc3RhcnRlZF9hdCkuZ2V0VGltZSgpOwogICAgY29uc3QgZW5kID0gbmV3IERhdGUoY29tcGFueS50cmlhbF9lbmRzX2F0KS5nZXRUaW1lKCk7CiAgICBjb25zdCB0b3RhbCA9IE1hdGgubWF4KDEsIGVuZCAtIHN0YXJ0KTsKICAgIGNvbnN0IGVsYXBzZWQgPSBNYXRoLm1pbigKICAgICAgdG90YWwsCiAgICAgIE1hdGgubWF4KDAsIGN1cnJlbnRUaW1lc3RhbXAgLSBzdGFydCksCiAgICApOwoKICAgIHJldHVybiBNYXRoLnJvdW5kKChlbGFwc2VkIC8gdG90YWwpICogMTAwKTsKICB9KSgpO2AsCiAgICAic3Vic2NyaXB0aW9uIHRyaWFsIHByb2dyZXNzIHB1cml0eSIsCiAgKTsKCiAgLy8gUmVtb3ZlIHVzZU1lbW8gZnJvbSB0aGlzIGltcG9ydCBvbmx5IHdoZW4gbm8gb3RoZXIgdXNlTWVtbyBjYWxscyByZW1haW4uCiAgY29uc3QgcmVtYWluaW5nVXNlcyA9IChjb250ZW50Lm1hdGNoKC9cYnVzZU1lbW9ccypcKC9nKSB8fCBbXSkubGVuZ3RoOwogIGlmIChyZW1haW5pbmdVc2VzID09PSAwKSB7CiAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKAogICAgICAiaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjsiLAogICAgICAiaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjsiLAogICAgKTsKICB9CgogIHJldHVybiBjb250ZW50Owp9KTsKCmNvbnNvbGUubG9nKGBWN19QQVRDSF9DSEFOR0VEPSR7Y2hhbmdlZH1gKTsKY29uc29sZS5sb2coIk9SQ0FMWV9WN19QQVRDSF9PSz0xIik7Cg==")
)

& $Node --check $Patcher
if ($LASTEXITCODE -ne 0) {
    throw "Patcher V7 possui erro de sintaxe."
}

& $Node $Patcher
if ($LASTEXITCODE -ne 0) {
    throw "Patcher V7 falhou."
}

Step "Executando autofixes seguros do ESLint"
& $Npx eslint . --fix
$AutoFixCode = $LASTEXITCODE
Write-Host "ESLINT_AUTOFIX_EXIT_CODE=$AutoFixCode" -ForegroundColor Yellow

Step "Gerando relatorio JSON INTEGRAL do ESLint"
$LintJson = Join-Path $RunDir "eslint-v7.json"
& $Npx eslint . --format json --output-file $LintJson
$LintCode = $LASTEXITCODE

if (-not (Test-Path -LiteralPath $LintJson)) {
    throw "ESLint nao gerou o relatorio JSON."
}

$Summarizer = Join-Path $RunDir "summarize-eslint.mjs"
$SummarizerSource = @'
import fs from "node:fs";

const [input, output] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(input, "utf8"));

const files = [];
const rules = new Map();
let errors = 0;
let warnings = 0;

for (const row of report) {
  const messages = row.messages || [];
  if (!messages.length) continue;

  const fileErrors = messages.filter((item) => item.severity === 2).length;
  const fileWarnings = messages.filter((item) => item.severity === 1).length;
  errors += fileErrors;
  warnings += fileWarnings;

  files.push({
    path: row.filePath,
    errors: fileErrors,
    warnings: fileWarnings,
    messages: messages.map((item) => ({
      line: item.line || 0,
      column: item.column || 0,
      severity: item.severity === 2 ? "error" : "warning",
      rule: item.ruleId || "unknown",
      message: String(item.message || "").split("\n")[0],
    })),
  });

  for (const item of messages) {
    const key = `${item.severity === 2 ? "error" : "warning"} :: ${item.ruleId || "unknown"}`;
    rules.set(key, (rules.get(key) || 0) + 1);
  }
}

files.sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.path.localeCompare(b.path));

const ruleRows = [...rules.entries()].sort((a, b) => b[1] - a[1]);

const lines = [];
lines.push(`ESLINT_TOTAL_ERRORS=${errors}`);
lines.push(`ESLINT_TOTAL_WARNINGS=${warnings}`);
lines.push("");
lines.push("RULES:");
for (const [rule, count] of ruleRows) lines.push(`${count}\t${rule}`);

lines.push("");
lines.push("FILES:");
for (const file of files) {
  lines.push("");
  lines.push(`${file.path} :: errors=${file.errors} warnings=${file.warnings}`);
  for (const item of file.messages) {
    lines.push(`  ${item.severity}\t${item.line}:${item.column}\t${item.rule}\t${item.message}`);
  }
}

fs.writeFileSync(output, lines.join("\n") + "\n", "utf8");
console.log(`ESLINT_TOTAL_ERRORS=${errors}`);
console.log(`ESLINT_TOTAL_WARNINGS=${warnings}`);
console.log(`ESLINT_FILES_WITH_ISSUES=${files.length}`);
'@

[System.IO.File]::WriteAllText(
    $Summarizer,
    $SummarizerSource,
    (New-Object System.Text.UTF8Encoding($false))
)

$LintSummary = Join-Path $RunDir "eslint-v7-summary.txt"
& $Node $Summarizer $LintJson $LintSummary
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao resumir ESLint JSON."
}

Step "Executando todos os gates sem parar no primeiro erro"

$Results = [ordered]@{}

$Results.security = Run-Capture `
    "security-check" `
    $Npm `
    @("run", "security:check") `
    (Join-Path $RunDir "security-check.txt")

$Results.typescript = Run-Capture `
    "typescript" `
    $Npx `
    @("tsc", "--noEmit") `
    (Join-Path $RunDir "typescript.txt")

$Results.payments = Run-Capture `
    "verify-payments" `
    $Npm `
    @("run", "verify:payments") `
    (Join-Path $RunDir "verify-payments.txt")

$Results.credentials = Run-Capture `
    "verify-payment-credentials" `
    $Npm `
    @("run", "verify:payment-credentials") `
    (Join-Path $RunDir "verify-payment-credentials.txt")

$Results.audit = Run-Capture `
    "npm-audit" `
    $Npm `
    @("audit", "--omit=dev", "--audit-level=high") `
    (Join-Path $RunDir "npm-audit.txt")

$Results.build = Run-Capture `
    "build" `
    $Npm `
    @("run", "build") `
    (Join-Path $RunDir "build.txt")

Step "git diff --check"
& $Git diff --check 2>&1 | Tee-Object -FilePath (Join-Path $RunDir "diff-check.txt")
$Results.diff = $LASTEXITCODE
Write-Host "git-diff-check EXIT_CODE=$($Results.diff)"

Step "Supabase dry-run"
$SupabaseHelp = (& $Npx supabase db push --help 2>&1 | Out-String)
if ($LASTEXITCODE -eq 0 -and $SupabaseHelp -match "--dry-run") {
    & $Npx supabase db push --dry-run 2>&1 | Tee-Object -FilePath (Join-Path $RunDir "supabase-dry-run.txt")
    $Results.supabase = $LASTEXITCODE
} else {
    $Results.supabase = 99
    "Supabase CLI sem dry-run disponivel ou nao vinculado." |
        Set-Content -LiteralPath (Join-Path $RunDir "supabase-dry-run.txt")
}

$SummaryJson = Join-Path $RunDir "v7-gates.json"
[System.IO.File]::WriteAllText(
    $SummaryJson,
    ($Results | ConvertTo-Json -Depth 5),
    (New-Object System.Text.UTF8Encoding($false))
)

Step "Resumo final da V7"
Write-Host "ESLINT_EXIT_CODE=$LintCode"
Write-Host "SECURITY_EXIT_CODE=$($Results.security)"
Write-Host "TSC_EXIT_CODE=$($Results.typescript)"
Write-Host "VERIFY_PAYMENTS_EXIT_CODE=$($Results.payments)"
Write-Host "VERIFY_CREDENTIALS_EXIT_CODE=$($Results.credentials)"
Write-Host "NPM_AUDIT_EXIT_CODE=$($Results.audit)"
Write-Host "BUILD_EXIT_CODE=$($Results.build)"
Write-Host "DIFF_CHECK_EXIT_CODE=$($Results.diff)"
Write-Host "SUPABASE_DRY_RUN_EXIT_CODE=$($Results.supabase)"
Write-Host "V7_REPORT_DIR=$RunDir"
Write-Host "V7_LINT_SUMMARY=$LintSummary"

$Failed = @(
    $LintCode,
    $Results.security,
    $Results.typescript,
    $Results.payments,
    $Results.credentials,
    $Results.audit,
    $Results.build,
    $Results.diff
) | Where-Object { $_ -ne 0 }

if ($Failed.Count -eq 0) {
    Write-Host "ORCALY_V7_ALL_CODE_GATES_OK=1" -ForegroundColor Green
} else {
    Write-Host "ORCALY_V7_DIAGNOSTICS_COMPLETE=1" -ForegroundColor Yellow
    Write-Host "Nenhum commit, push ou migration foi aplicado." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para mostrar o resumo completo do lint:" -ForegroundColor Cyan
Write-Host "Get-Content `"$LintSummary`"" -ForegroundColor Cyan
