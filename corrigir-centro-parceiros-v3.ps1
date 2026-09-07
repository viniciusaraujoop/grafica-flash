param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

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

$branch = (& $Git branch --show-current).Trim()
if (-not $branch) {
    throw "Não foi possível identificar a branch atual."
}

$PanelRelative = "app/parceiros/painel/page.tsx"
$PanelPath = Join-Path $Root $PanelRelative

$Targets = @(
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Step "Conferindo arquivos"

foreach ($relative in $Targets) {
    $full = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $full)) {
        throw "Arquivo ausente: $relative"
    }
    Write-Host "[OK] $relative" -ForegroundColor Green
}

$content = [System.IO.File]::ReadAllText($PanelPath)

Step "Normalizando integração do painel"

# ------------------------------------------------------------------
# Imports: garante exatamente os imports necessários.
# ------------------------------------------------------------------

if ($content -notmatch 'import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";') {
    $anchor = 'import { supabase } from "@/lib/supabase";'
    $index = $content.IndexOf($anchor)

    if ($index -lt 0) {
        throw "Não encontrei o import do Supabase no painel."
    }

    $insertAt = $index + $anchor.Length
    $addition = @'

import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";
import PartnerPromotionTab from "@/components/parceiros/PartnerPromotionTab";
'@

    $content = $content.Insert($insertAt, $addition)
}

# Remove imports duplicados caso uma tentativa anterior os tenha inserido duas vezes.
$courseImport = 'import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";'
$promoImport = 'import PartnerPromotionTab from "@/components/parceiros/PartnerPromotionTab";'

foreach ($importLine in @($courseImport, $promoImport)) {
    $first = $content.IndexOf($importLine)
    if ($first -ge 0) {
        $second = $content.IndexOf($importLine, $first + $importLine.Length)
        while ($second -ge 0) {
            $content = $content.Remove($second, $importLine.Length)
            $second = $content.IndexOf($importLine, $first + $importLine.Length)
        }
    }
}

# ------------------------------------------------------------------
# Tipo da aba: substitui estruturalmente o trecho useState<...>("overview")
# próximo de const [tab, setTab].
# ------------------------------------------------------------------

$tabAnchor = "const [tab, setTab] = useState<"
$tabStart = $content.IndexOf($tabAnchor)

if ($tabStart -lt 0) {
    throw "Não encontrei a declaração de tab/setTab."
}

$tabEndMarker = '>("overview");'
$tabEnd = $content.IndexOf($tabEndMarker, $tabStart)

if ($tabEnd -lt 0) {
    throw "Não encontrei o final da declaração de tab/setTab."
}

$tabEnd += $tabEndMarker.Length

$newTabBlock = @'
const [tab, setTab] = useState<
    | "overview"
    | "referrals"
    | "courses"
    | "promotion"
    | "payments"
    | "ranking"
  >("overview");
'@

$content = $content.Substring(0, $tabStart) + $newTabBlock + $content.Substring($tabEnd)

# ------------------------------------------------------------------
# Navegação: não depende de labels nem de quebra de linha.
# ------------------------------------------------------------------

$navAnchor = "const nav = ["
$navStart = $content.IndexOf($navAnchor)

if ($navStart -lt 0) {
    throw "Não encontrei 'const nav = [' no painel."
}

$navEnd = $content.IndexOf("];", $navStart)

if ($navEnd -lt 0) {
    throw "Não encontrei o fechamento do bloco nav."
}

$navEnd += 2

$newNav = @'
const nav = [
    ["overview", "Visão geral"],
    ["referrals", "Indicações"],
    ["courses", "Cursos"],
    ["promotion", "Divulgação"],
    ["payments", "Pagamentos e Pix"],
    ["ranking", "Ranking"],
  ];
'@

$content = $content.Substring(0, $navStart) + $newNav + $content.Substring($navEnd)

# ------------------------------------------------------------------
# Render das abas: remove bloco parcialmente inserido e recria.
# ------------------------------------------------------------------

$coursesMarker = '{tab === "courses" ? ('
$paymentsMarker = '{tab === "payments" ? ('

$paymentsIndex = $content.IndexOf($paymentsMarker)

if ($paymentsIndex -lt 0) {
    throw "Não encontrei a aba payments para usar como âncora."
}

$coursesIndex = $content.IndexOf($coursesMarker)

if ($coursesIndex -ge 0 -and $coursesIndex -lt $paymentsIndex) {
    # Remove qualquer bloco parcial de courses/promotion até payments.
    $content = $content.Substring(0, $coursesIndex) + $content.Substring($paymentsIndex)
    $paymentsIndex = $content.IndexOf($paymentsMarker)
}

$newTabs = @'
{tab === "courses" ? (
            <PartnerCoursesTab />
          ) : null}

          {tab === "promotion" ? (
            <PartnerPromotionTab
              referralLink={dashboard.profile.referralLink}
              partnerName={dashboard.profile.name}
            />
          ) : null}


'@

$content = $content.Insert($paymentsIndex, $newTabs)

# ------------------------------------------------------------------
# useEffect seguro para React 19/Next 16.
# ------------------------------------------------------------------

$oldEffectVariants = @(
@'
useEffect(() => {
    void load();
  }, [load]);
'@,
@'
useEffect(() => {
    void load();
}, [load]);
'@
)

foreach ($oldEffect in $oldEffectVariants) {
    if ($content.Contains($oldEffect)) {
        $safeEffect = @'
useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);
'@
        $content = $content.Replace($oldEffect, $safeEffect)
    }
}

Write-Utf8 $PanelPath $content

# Corrige classe Tailwind inválida caso tenha vindo do script anterior.
$CoursesPath = Join-Path $Root "components/parceiros/PartnerCoursesTab.tsx"
$coursesContent = [System.IO.File]::ReadAllText($CoursesPath)
$coursesContent = $coursesContent.Replace("text-slate-650", "text-slate-600")
Write-Utf8 $CoursesPath $coursesContent

Step "Validação estrutural"

$final = [System.IO.File]::ReadAllText($PanelPath)

$required = @(
    'PartnerCoursesTab',
    'PartnerPromotionTab',
    '["courses", "Cursos"]',
    '["promotion", "Divulgação"]',
    '{tab === "courses" ? (',
    '{tab === "promotion" ? (',
    '{tab === "payments" ? ('
)

foreach ($item in $required) {
    if (-not $final.Contains($item)) {
        throw "Faltou após correção: $item"
    }
    Write-Host "[OK] $item" -ForegroundColor Green
}

Step "ESLint"
Run $Npx (@("eslint") + $Targets)

Step "Build completo"
Run $Npm @("run", "build")

Step "Validando diff"
Run $Git (@("diff", "--check", "--") + $Targets)

Write-Host ""
& $Git --no-pager diff --stat -- $Targets

Step "Preparando commit"
Run $Git (@("add", "--") + $Targets)
Run $Git (@("diff", "--cached", "--check", "--") + $Targets)

Write-Host ""
Write-Host "Arquivos no commit:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --name-status -- $Targets

& $Git diff --cached --quiet -- $Targets
if ($LASTEXITCODE -eq 0) {
    throw "Não há alterações para commit."
}

Step "Commit"
Run $Git @(
    "commit",
    "-m",
    "Adiciona cursos divulgacao e demo aos parceiros",
    "--",
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

if ($Push) {
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_PARTNER_CENTER_V3_OK=1" -ForegroundColor Green
Write-Host "Cursos: OK" -ForegroundColor Cyan
Write-Host "Divulgacao: OK" -ForegroundColor Cyan
Write-Host "Demo read-only: /parceiros/demo" -ForegroundColor Cyan
