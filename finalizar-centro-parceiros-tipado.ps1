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

Step "Tipando dados do painel de parceiros"

$content = [System.IO.File]::ReadAllText($PanelPath)

$oldDashboard = 'type Dashboard = Record<string, any>;'

$newTypes = @'
type ReferralRow = {
  id: string;
  customer_name_masked: string;
  customer_email_masked: string;
  status: string;
  registered_at: string | null;
  trial_ends_at: string | null;
  plan: string;
  commission_expected: number;
};

type PayoutRow = {
  id: string;
  amount: number;
  requested_at: string | null;
  status: string;
};

type RankingRow = {
  id: string;
  position: number;
  name: string;
  conversions: number;
  score: number;
};

type PayoutAccount = {
  holderName: string;
  pixKeyType: string;
  pixKeyMasked: string;
  isVerified: boolean;
};

type Dashboard = {
  profile: {
    id: string;
    name: string;
    code: string;
    referralLink: string;
    debtBalance: number;
  };
  stats: {
    clicks: number;
    referrals: number;
    future: number;
    hold: number;
    available: number;
    paid: number;
  };
  program: {
    commissionRate: number;
    minimumPayout: number;
  };
  payoutAccount: PayoutAccount | null;
  referrals: ReferralRow[];
  payouts: PayoutRow[];
  ranking: {
    top: RankingRow[];
  };
};
'@

if ($content.Contains($oldDashboard)) {
    $content = $content.Replace($oldDashboard, $newTypes)
}
elseif ($content -notmatch 'type ReferralRow =') {
    throw "Não encontrei o tipo Dashboard original para substituir."
}

# Tipagem das indicações.
$content = $content.Replace(
    'dashboard.referrals.slice(0, 5).map((row: any) =>',
    'dashboard.referrals.slice(0, 5).map((row: ReferralRow) =>'
)

$content = $content.Replace(
    'dashboard.referrals.map((row: any) =>',
    'dashboard.referrals.map((row: ReferralRow) =>'
)

# Tipagem dos pagamentos.
$content = $content.Replace(
    'dashboard.payouts.map((row: any) =>',
    'dashboard.payouts.map((row: PayoutRow) =>'
)

# Tipagem do ranking.
$content = $content.Replace(
    'dashboard.ranking.top.map((row: any) =>',
    'dashboard.ranking.top.map((row: RankingRow) =>'
)

Write-Utf8 $PanelPath $content

Step "Confirmando remoção dos any"

$final = [System.IO.File]::ReadAllText($PanelPath)

if ($final -match '\bany\b') {
    Write-Host "Ocorrências de 'any' restantes:" -ForegroundColor Yellow
    Select-String -Path $PanelPath -Pattern '\bany\b'
    throw "Ainda existe 'any' no painel de parceiros."
}

Write-Host "[OK] Painel sem explicit any" -ForegroundColor Green

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
Write-Host "ORCALY_PARTNER_CENTER_TYPED_OK=1" -ForegroundColor Green
Write-Host "Cursos: OK" -ForegroundColor Cyan
Write-Host "Divulgacao: OK" -ForegroundColor Cyan
Write-Host "Demo: /parceiros/demo" -ForegroundColor Cyan
Write-Host "TypeScript do painel: sem explicit any" -ForegroundColor Cyan
