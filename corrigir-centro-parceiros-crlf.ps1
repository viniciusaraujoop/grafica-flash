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

$PanelPath = Join-Path $Root "app/parceiros/painel/page.tsx"

$Targets = @(
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Step "Conferindo arquivos criados na tentativa anterior"

foreach ($relative in $Targets) {
    $full = Join-Path $Root $relative

    if (-not (Test-Path -LiteralPath $full)) {
        throw "Arquivo esperado não encontrado: $relative. Rode primeiro o script anterior até a etapa que cria os arquivos."
    }

    Write-Host "[OK] $relative" -ForegroundColor Green
}

Step "Corrigindo integração das abas no painel"

$content = [System.IO.File]::ReadAllText($PanelPath)

# Imports idempotentes.
if ($content -notmatch 'PartnerCoursesTab') {
    $pattern = 'import\s+\{\s*supabase\s*\}\s+from\s+"@/lib/supabase";'
    $replacement = @'
import { supabase } from "@/lib/supabase";
import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";
import PartnerPromotionTab from "@/components/parceiros/PartnerPromotionTab";
'@

    $updated = [regex]::Replace(
        $content,
        $pattern,
        $replacement,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($updated -eq $content) {
        throw "Não foi possível adicionar os imports do Centro do Parceiro."
    }

    $content = $updated
}

# Tipo das abas, caso ainda esteja no formato antigo.
if ($content -notmatch '"courses"\s*\|\s*"promotion"') {
    $pattern = 'const\s+\[tab,\s*setTab\]\s*=\s*useState<\s*"overview"\s*\|\s*"referrals"\s*\|\s*"payments"\s*\|\s*"ranking"\s*>\("overview"\);'
    $replacement = @'
const [tab, setTab] = useState<
    | "overview"
    | "referrals"
    | "courses"
    | "promotion"
    | "payments"
    | "ranking"
  >("overview");
'@

    $updated = [regex]::Replace(
        $content,
        $pattern,
        $replacement,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($updated -eq $content) {
        throw "Não foi possível ampliar o tipo das abas."
    }

    $content = $updated
}

# Navegação. Regex ignora CRLF/LF e espaçamento.
if ($content -notmatch '\["courses",\s*"Cursos"\]') {
    $pattern = 'const\s+nav\s*=\s*\[\s*\["overview",\s*"Visão geral"\],\s*\["referrals",\s*"Indicações"\],\s*\["payments",\s*"Pagamentos e Pix"\],\s*\["ranking",\s*"Ranking"\],\s*\];'
    $replacement = @'
const nav = [
    ["overview", "Visão geral"],
    ["referrals", "Indicações"],
    ["courses", "Cursos"],
    ["promotion", "Divulgação"],
    ["payments", "Pagamentos e Pix"],
    ["ranking", "Ranking"],
  ];
'@

    $updated = [regex]::Replace(
        $content,
        $pattern,
        $replacement,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($updated -eq $content) {
        throw "Não foi possível localizar e atualizar a navegação do painel."
    }

    $content = $updated
}

# Renderização das duas novas abas.
if ($content -notmatch '<PartnerCoursesTab\s*/>') {
    $pattern = '\{tab\s*===\s*"payments"\s*\?\s*\('
    $replacement = @'
{tab === "courses" ? (
            <PartnerCoursesTab />
          ) : null}

          {tab === "promotion" ? (
            <PartnerPromotionTab
              referralLink={dashboard.profile.referralLink}
              partnerName={dashboard.profile.name}
            />
          ) : null}

          {tab === "payments" ? (
'@

    $updated = [regex]::Replace(
        $content,
        $pattern,
        $replacement,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($updated -eq $content) {
        throw "Não foi possível inserir as novas abas antes de Pagamentos."
    }

    $content = $updated
}

# Evita a regra react-hooks/set-state-in-effect no lint do React 19/Next 16.
$effectPattern = 'useEffect\(\(\)\s*=>\s*\{\s*void\s+load\(\);\s*\},\s*\[load\]\s*\);'
if ([regex]::IsMatch(
    $content,
    $effectPattern,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)) {
    $effectReplacement = @'
useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);
'@

    $content = [regex]::Replace(
        $content,
        $effectPattern,
        $effectReplacement,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
}

# Pequena correção de classe gerada no arquivo de cursos.
$CoursesPath = Join-Path $Root "components/parceiros/PartnerCoursesTab.tsx"
$coursesContent = [System.IO.File]::ReadAllText($CoursesPath)
$coursesContent = $coursesContent.Replace("text-slate-650", "text-slate-600")
Write-Utf8 $CoursesPath $coursesContent

Write-Utf8 $PanelPath $content

Step "Validando presença das novas áreas"

$final = [System.IO.File]::ReadAllText($PanelPath)

$checks = @(
    'PartnerCoursesTab',
    'PartnerPromotionTab',
    '["courses", "Cursos"]',
    '["promotion", "Divulgação"]',
    'tab === "courses"',
    'tab === "promotion"'
)

foreach ($check in $checks) {
    if (-not $final.Contains($check)) {
        throw "Validação falhou: $check"
    }
}

Step "ESLint"
Run $Npx (@("eslint") + $Targets)

Step "Build completo"
Run $Npm @("run", "build")

Step "Diff"
Run $Git (@("diff", "--check", "--") + $Targets)

& $Git --no-pager diff --stat -- $Targets

Step "Commit"

Run $Git (@("add", "--") + $Targets)
Run $Git (@("diff", "--cached", "--check", "--") + $Targets)

Write-Host ""
Write-Host "Arquivos preparados:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --name-status -- $Targets

& $Git diff --cached --quiet -- $Targets
if ($LASTEXITCODE -eq 0) {
    throw "Não há alterações do Centro do Parceiro para commit."
}

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
Write-Host "ORCALY_PARTNER_ACADEMY_FIX_OK=1" -ForegroundColor Green
Write-Host "Cursos: integrado" -ForegroundColor Cyan
Write-Host "Divulgação: integrada" -ForegroundColor Cyan
Write-Host "Demo: /parceiros/demo" -ForegroundColor Cyan
