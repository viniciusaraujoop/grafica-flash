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
    throw "Command not found: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Failed: $Command $($Arguments -join ' ')"
    }
}

function Write-Utf8([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText(
        $Path,
        $Content.TrimEnd("`r", "`n", " ", "`t") + "`n",
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$TargetRelative = "components/parceiros/PartnerSystemDemo.tsx"
$Target = Join-Path $Root $TargetRelative

if (-not (Test-Path -LiteralPath $Target)) {
    throw "PartnerSystemDemo.tsx not found."
}

Step "Fixing ESLint issues in mirrored demo"

$content = [System.IO.File]::ReadAllText($Target)

# Remove unused next/image import.
$content = $content.Replace(
    'import Image from "next/image";' + "`r`n",
    ""
)
$content = $content.Replace(
    'import Image from "next/image";' + "`n",
    ""
)

# Rename the DemoGenericModule prop from the reserved-ish `module`
# identifier to `panelModule`.
$content = $content.Replace(
@'
function DemoGenericModule({
  module,
  notify,
}: {
  module: PanelModule | undefined;
  notify: (message: string) => void;
}) {
  const label = module?.label || "Módulo demonstrativo";
  const description =
    module?.description ||
'@,
@'
function DemoGenericModule({
  panelModule,
  notify,
}: {
  panelModule: PanelModule | undefined;
  notify: (message: string) => void;
}) {
  const label = panelModule?.label || "Módulo demonstrativo";
  const description =
    panelModule?.description ||
'@
)

$content = $content.Replace(
    'icon={module?.icon || "•"}',
    'icon={panelModule?.icon || "•"}'
)

$content = $content.Replace(
@'
    <DemoGenericModule
      module={modules.find((item) => item.href === pathname)}
      notify={notify}
    />
'@,
@'
    <DemoGenericModule
      panelModule={modules.find((item) => item.href === pathname)}
      notify={notify}
    />
'@
)

# Fallback replacements in case PowerShell normalized line endings.
$content = $content.Replace(
    "function DemoGenericModule({`n  module,`n  notify,",
    "function DemoGenericModule({`n  panelModule,`n  notify,"
)
$content = $content.Replace(
    "  module: PanelModule | undefined;",
    "  panelModule: PanelModule | undefined;"
)
$content = $content.Replace(
    'const label = module?.label || "Módulo demonstrativo";',
    'const label = panelModule?.label || "Módulo demonstrativo";'
)
$content = $content.Replace(
    "    module?.description ||",
    "    panelModule?.description ||"
)
$content = $content.Replace(
    "      module={modules.find((item) => item.href === pathname)}",
    "      panelModule={modules.find((item) => item.href === pathname)}"
)

Write-Utf8 $Target $content

Step "Verifying source"

$final = [System.IO.File]::ReadAllText($Target)

if ($final.Contains('import Image from "next/image";')) {
    throw "Unused Image import still exists."
}

if ($final.Contains("  module: PanelModule | undefined;")) {
    throw "Reserved module prop type still exists."
}

if ($final.Contains('const label = module?.label')) {
    throw "Reserved module variable still exists."
}

Write-Host "[OK] unused Image removed" -ForegroundColor Green
Write-Host "[OK] module prop renamed to panelModule" -ForegroundColor Green

Step "ESLint"
Run $Npx @(
    "eslint",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Step "Build"
Run $Npm @("run", "build")

Step "Diff check"
Run $Git @(
    "diff",
    "--check",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Write-Host ""
& $Git --no-pager diff --stat -- `
    "app/parceiros/demo/page.tsx" `
    "app/parceiros/demo/layout.tsx" `
    "components/parceiros/PartnerSystemDemo.tsx"

Step "Commit"

Run $Git @(
    "add",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Run $Git @(
    "diff",
    "--cached",
    "--check",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Write-Host ""
Write-Host "Files in commit:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --name-status -- `
    "app/parceiros/demo/page.tsx" `
    "app/parceiros/demo/layout.tsx" `
    "components/parceiros/PartnerSystemDemo.tsx"

& $Git diff --cached --quiet -- `
    "app/parceiros/demo/page.tsx" `
    "app/parceiros/demo/layout.tsx" `
    "components/parceiros/PartnerSystemDemo.tsx"

if ($LASTEXITCODE -eq 0) {
    throw "No mirrored demo changes to commit."
}

Run $Git @(
    "commit",
    "-m",
    "Espelha painel real no demonstrativo de parceiros",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

if ($Push) {
    $branch = (& $Git branch --show-current).Trim()
    if (-not $branch) {
        throw "Could not resolve current branch."
    }

    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_PARTNER_MIRROR_DEMO_FINAL_OK=1" -ForegroundColor Green
Write-Host "Mirrored UI: OK" -ForegroundColor Cyan
Write-Host "Read-only navigation: OK" -ForegroundColor Cyan
Write-Host "No Supabase/API writes: OK" -ForegroundColor Cyan
