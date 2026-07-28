param(
  [string]$ProductionBaseUrl = "https://orcaly.com.br",
  [switch]$SkipBuild,
  [switch]$SkipSmoke
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportDir = Join-Path $Root "qa-orcaly-$Stamp"
$ReportPath = Join-Path $ReportDir "relatorio-qa-orcaly.txt"
$JsonPath = Join-Path $ReportDir "resumo-qa-orcaly.json"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$Critical = New-Object System.Collections.Generic.List[string]
$High = New-Object System.Collections.Generic.List[string]
$Medium = New-Object System.Collections.Generic.List[string]
$Report = New-Object System.Text.StringBuilder

function Add-Section([string]$Title) {
  [void]$Report.AppendLine("")
  [void]$Report.AppendLine(("=" * 78))
  [void]$Report.AppendLine($Title)
  [void]$Report.AppendLine(("=" * 78))
}

function Add-Line([string]$Text = "") {
  [void]$Report.AppendLine($Text)
}

function Add-Issue(
  [ValidateSet("P0", "P1", "P2")]
  [string]$Priority,
  [string]$Message
) {
  switch ($Priority) {
    "P0" { $Critical.Add($Message) }
    "P1" { $High.Add($Message) }
    "P2" { $Medium.Add($Message) }
  }
}

function Run-Captured(
  [string]$Label,
  [scriptblock]$Command
) {
  Add-Section $Label
  $Output = & $Command 2>&1 | Out-String
  $Code = $LASTEXITCODE

  Add-Line $Output.TrimEnd()
  Add-Line ""
  Add-Line "EXIT_CODE=$Code"

  return @{
    Code = $Code
    Output = $Output
  }
}

function Get-SourceFiles {
  Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Extension -in @(".ts", ".tsx", ".js", ".jsx", ".sql", ".ps1") -and
      $_.FullName -notmatch "\\node_modules\\" -and
      $_.FullName -notmatch "\\\.next\\" -and
      $_.FullName -notmatch "\\\.git\\" -and
      $_.FullName -notmatch "\\\.orcaly-backups\\" -and
      $_.FullName -notmatch "\\qa-orcaly-" -and
      $_.FullName -notmatch "\\coverage\\"
    }
}

function Invoke-Smoke([string]$Url) {
  try {
    $Response = Invoke-WebRequest `
      -Uri $Url `
      -Method GET `
      -MaximumRedirection 0 `
      -TimeoutSec 25 `
      -UseBasicParsing `
      -ErrorAction Stop

    $Location = $null

    if (
      $Response -and
      $Response.PSObject.Properties["Headers"] -and
      $Response.Headers
    ) {
      try {
        $Location = $Response.Headers["Location"]
      } catch {
        $Location = $null
      }
    }

    return @{
      Url = $Url
      Status = [int]$Response.StatusCode
      Location = $Location
      Error = $null
    }
  } catch {
    $Exception = $_.Exception
    $Response = $null
    $Status = 0
    $Location = $null

    if (
      $Exception -and
      $Exception.PSObject.Properties["Response"]
    ) {
      $Response = $Exception.Response
    }

    if ($Response) {
      try {
        if ($Response.PSObject.Properties["StatusCode"]) {
          $Status = [int]$Response.StatusCode
        }
      } catch {
        $Status = 0
      }

      try {
        if (
          $Response.PSObject.Properties["Headers"] -and
          $Response.Headers
        ) {
          $Location = $Response.Headers["Location"]
        }
      } catch {
        $Location = $null
      }
    }

    $ErrorMessage = "Falha sem detalhes."

    if (
      $Exception -and
      $Exception.PSObject.Properties["Message"]
    ) {
      $ErrorMessage = [string]$Exception.Message
    }

    return @{
      Url = $Url
      Status = $Status
      Location = $Location
      Error = $ErrorMessage
    }
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

Add-Line "ORCALY - AUDITORIA QA PARA VALIDACAO MVP"
Add-Line "Raiz: $Root"
Add-Line "Data: $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")"
Add-Line "Producao: $ProductionBaseUrl"

Add-Section "GIT"

$Branch = (& git branch --show-current 2>&1 | Out-String).Trim()
$Commit = (& git rev-parse HEAD 2>&1 | Out-String).Trim()
$Status = (& git status --short 2>&1 | Out-String).Trim()

Add-Line "Branch: $Branch"
Add-Line "Commit: $Commit"
Add-Line "Alteracoes locais:"
Add-Line $(if ($Status) { $Status } else { "Nenhuma" })

if ($Branch -eq "main" -and $Status) {
  Add-Issue "P1" "Ha alteracoes locais diretamente na main."
}

Add-Section "ARQUIVOS ESSENCIAIS DO MVP"

$EssentialFiles = @(
  "app/page.tsx",
  "app/login/page.tsx",
  "app/painel/page.tsx",
  "app/painel/assinatura/page.tsx",
  "app/painel/produtos/page.tsx",
  "app/painel/pedidos/page.tsx",
  "app/painel/pagamentos/page.tsx",
  "app/checkout/[slug]/page.tsx",
  "components/checkout/CheckoutClient.tsx",
  "app/api/checkout/[slug]/route.ts",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/status/route.ts",
  "app/api/marketplace/payments/mercado-pago/connect/route.ts",
  "app/api/marketplace/payments/mercado-pago/callback/route.ts",
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
  "lib/payments/checkout-service.ts",
  "lib/mercado-pago.ts"
)

foreach ($Relative in $EssentialFiles) {
  $Exists = Test-Path -LiteralPath (Join-Path $Root ($Relative -replace "/", "\"))
  Add-Line ("{0,-85} {1}" -f $Relative, $Exists)

  if (-not $Exists) {
    Add-Issue "P0" "Arquivo essencial ausente: $Relative"
  }
}

Add-Section "VARIAVEIS DE AMBIENTE SEM EXIBIR SEGREDOS"

$EnvCheckPath = Join-Path $ReportDir "check-env.cjs"
$EnvOutputPath = Join-Path $ReportDir "env-output.json"

$EnvCheckCode = @'
const fs = require("node:fs");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), true);

const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
];

const rows = names.map((name) => {
  const value = String(process.env[name] || "").trim();

  return {
    name,
    configured: Boolean(value),
    length: value.length
  };
});

fs.writeFileSync(
  process.argv[2],
  JSON.stringify(rows, null, 2),
  "utf8"
);
'@

[IO.File]::WriteAllText($EnvCheckPath, $EnvCheckCode, $Utf8)

try {
  & node $EnvCheckPath $EnvOutputPath

  if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $EnvOutputPath)) {
    $EnvRows = Get-Content -LiteralPath $EnvOutputPath -Raw | ConvertFrom-Json

    foreach ($Row in $EnvRows) {
      Add-Line ("{0,-48} configurada={1,-5} tamanho={2}" -f $Row.name, $Row.configured, $Row.length)

      if (-not $Row.configured) {
        $Priority = if (
          $Row.name -in @(
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "NEXT_PUBLIC_APP_URL"
          )
        ) { "P0" } else { "P1" }

        Add-Issue $Priority "Variavel ausente: $($Row.name)"
      }
    }
  } else {
    Add-Line "Nao foi possivel carregar o .env.local."
    Add-Issue "P1" "O diagnostico de ambiente falhou."
  }
} finally {
  Remove-Item -LiteralPath $EnvCheckPath -Force -ErrorAction SilentlyContinue
}

$Package = Get-Content -LiteralPath (Join-Path $Root "package.json") -Raw | ConvertFrom-Json

Add-Section "SCRIPTS DO PACKAGE.JSON"

$ScriptNames = @($Package.scripts.PSObject.Properties.Name)

foreach ($Name in $ScriptNames) {
  Add-Line ("{0,-20} {1}" -f $Name, $Package.scripts.$Name)
}

if (-not ($ScriptNames -contains "build")) {
  Add-Issue "P0" "package.json nao possui script build."
}

if (-not ($ScriptNames -contains "lint")) {
  Add-Issue "P2" "package.json nao possui script lint."
}

if (-not ($ScriptNames -contains "test")) {
  Add-Issue "P2" "package.json nao possui testes automatizados."
}

if (-not $SkipBuild) {
  $Build = Run-Captured "BUILD NEXT.JS" {
    & npm.cmd run build
  }

  if ($Build.Code -ne 0) {
    Add-Issue "P0" "npm run build falhou."
  }
} else {
  Add-Section "BUILD NEXT.JS"
  Add-Line "Ignorado por -SkipBuild."
}

if ($ScriptNames -contains "lint") {
  $Lint = Run-Captured "LINT" {
    & npm.cmd run lint
  }

  if ($Lint.Code -ne 0) {
    Add-Issue "P1" "O lint encontrou erros."
  }
}

Add-Section "MARCADORES DE CODIGO INCOMPLETO OU DESATIVADO"

$Files = @(Get-SourceFiles)

$MarkerGroups = @(
  @{
    Name = "Fluxos desativados"
    Priority = "P1"
    Patterns = @(
      "LEGACY_PROVIDER_DISABLED",
      "LEGACY_CHECKOUT_DISABLED",
      "ASAAS_ACCOUNT_DISABLED",
      "status:\s*410",
      "fluxo antigo foi desativado",
      "integracao antiga foi desativada"
    )
  },
  @{
    Name = "Trabalho incompleto"
    Priority = "P1"
    Patterns = @(
      "\bTODO\b",
      "\bFIXME\b",
      "not implemented",
      "nao implementad",
      "não implementad",
      "placeholder"
    )
  },
  @{
    Name = "Dependencia antiga Asaas em fluxo ativo"
    Priority = "P1"
    Patterns = @(
      "AsaasProvider",
      "AsaasFinancialPanel",
      "AsaasSubscriptionPayment",
      "provider:\s*[`"']asaas[`"']",
      "api/assinatura/asaas"
    )
  },
  @{
    Name = "Riscos de depuracao em producao"
    Priority = "P2"
    Patterns = @(
      "console\.log\(",
      "console\.debug\(",
      "debugger;"
    )
  }
)

foreach ($Group in $MarkerGroups) {
  Add-Line ""
  Add-Line "### $($Group.Name)"

  $Matches = New-Object System.Collections.Generic.List[object]

  foreach ($Pattern in $Group.Patterns) {
    $Found = $Files |
      Select-String -Pattern $Pattern -CaseSensitive:$false -ErrorAction SilentlyContinue

    foreach ($Item in $Found) {
      $RelativePath = $Item.Path.Substring($Root.Length).TrimStart("\")
      $Matches.Add([pscustomobject]@{
        File = $RelativePath
        Line = $Item.LineNumber
        Text = $Item.Line.Trim()
      })
    }
  }

  $UniqueMatches = $Matches |
    Sort-Object File, Line, Text -Unique |
    Select-Object -First 150

  if (-not $UniqueMatches) {
    Add-Line "Nenhuma ocorrencia."
    continue
  }

  foreach ($Item in $UniqueMatches) {
    Add-Line ("{0}:{1}  {2}" -f $Item.File, $Item.Line, $Item.Text)
  }

  Add-Issue $Group.Priority "$($Group.Name): $(@($UniqueMatches).Count) ocorrencia(s)."
}

Add-Section "ROTAS ENCONTRADAS"

$AppRoot = Join-Path $Root "app"
$Pages = Get-ChildItem -Path $AppRoot -Recurse -File -Filter "page.tsx" -ErrorAction SilentlyContinue
$Routes = Get-ChildItem -Path $AppRoot -Recurse -File -Filter "route.ts" -ErrorAction SilentlyContinue

Add-Line "Paginas: $($Pages.Count)"
foreach ($Page in $Pages | Sort-Object FullName) {
  Add-Line ("PAGE  " + $Page.FullName.Substring($AppRoot.Length).Replace("\page.tsx", "").Replace("\", "/"))
}

Add-Line ""
Add-Line "APIs: $($Routes.Count)"
foreach ($Route in $Routes | Sort-Object FullName) {
  Add-Line ("API   " + $Route.FullName.Substring($AppRoot.Length).Replace("\route.ts", "").Replace("\", "/"))
}

Add-Section "POSSIVEIS DUPLICIDADES DE MODULOS"

$Names = $Pages |
  ForEach-Object {
    [pscustomobject]@{
      Name = $_.Directory.Name.ToLowerInvariant()
      Path = $_.FullName.Substring($Root.Length).TrimStart("\")
    }
  } |
  Group-Object Name |
  Where-Object { $_.Count -gt 1 } |
  Sort-Object Count -Descending

if (-not $Names) {
  Add-Line "Nenhuma duplicidade simples por nome de pasta."
} else {
  foreach ($Group in $Names) {
    Add-Line ""
    Add-Line "$($Group.Name) ($($Group.Count))"
    foreach ($Item in $Group.Group) {
      Add-Line "  $($Item.Path)"
    }
  }

  Add-Issue "P2" "Existem paginas com nomes de modulo repetidos."
}

if (-not $SkipSmoke) {
  Add-Section "SMOKE TEST DE PRODUCAO"

  $Base = $ProductionBaseUrl.TrimEnd("/")
  $SmokeUrls = @(
    "$Base/",
    "$Base/login",
    "$Base/painel",
    "$Base/painel/assinatura",
    "$Base/painel/pagamentos",
    "$Base/checkout/grafica-flash",
    "$Base/api/system/health",
    "$Base/api/mercado-pago/webhook",
    "$Base/api/marketplace/payments/webhook/mercado-pago"
  )

  foreach ($Url in $SmokeUrls) {
    $Result = Invoke-Smoke $Url
    $StatusText = if ($Result.Status) { [string]$Result.Status } else { "SEM_RESPOSTA" }

    Add-Line ("{0,-85} status={1} redirect={2} erro={3}" -f $Result.Url, $StatusText, $Result.Location, $Result.Error)

    if ($Result.Status -eq 0 -or $Result.Status -ge 500) {
      Add-Issue "P0" "Falha de producao em $Url. Status: $StatusText"
    } elseif ($Result.Status -eq 404) {
      Add-Issue "P1" "Rota esperada retornou 404: $Url"
    } elseif ($Result.Status -ge 400 -and $Result.Status -notin @(401, 403, 405)) {
      Add-Issue "P1" "Rota retornou HTTP $($Result.Status): $Url"
    }
  }
} else {
  Add-Section "SMOKE TEST DE PRODUCAO"
  Add-Line "Ignorado por -SkipSmoke."
}

Add-Section "PRIORIZACAO PARA VALIDACAO"

Add-Line "P0 - BLOQUEIA VALIDACAO"
if ($Critical.Count -eq 0) {
  Add-Line "Nenhum bloqueador automatico detectado."
} else {
  for ($Index = 0; $Index -lt $Critical.Count; $Index++) {
    Add-Line ("{0}. {1}" -f ($Index + 1), $Critical[$Index])
  }
}

Add-Line ""
Add-Line "P1 - CORRIGIR ANTES DE CONVIDAR USUARIOS"
if ($High.Count -eq 0) {
  Add-Line "Nenhum problema alto detectado."
} else {
  for ($Index = 0; $Index -lt $High.Count; $Index++) {
    Add-Line ("{0}. {1}" -f ($Index + 1), $High[$Index])
  }
}

Add-Line ""
Add-Line "P2 - PODE FICAR PARA DEPOIS DA VALIDACAO"
if ($Medium.Count -eq 0) {
  Add-Line "Nenhuma melhoria secundaria detectada."
} else {
  for ($Index = 0; $Index -lt $Medium.Count; $Index++) {
    Add-Line ("{0}. {1}" -f ($Index + 1), $Medium[$Index])
  }
}

Add-Section "ESCOPO MVP RECOMENDADO"

$MvpFlows = @(
  "1. Cadastro e login",
  "2. Criacao/configuracao basica da empresa",
  "3. Escolha de plano e assinatura",
  "4. Cadastro de produtos ou servicos",
  "5. Pagina publica da empresa",
  "6. Carrinho e checkout",
  "7. Pedido aparecendo no painel",
  "8. Pagamento Pix e cartao",
  "9. Alteracao de status e entrega",
  "10. Cancelamento da assinatura"
)

foreach ($Flow in $MvpFlows) {
  Add-Line $Flow
}

Add-Line ""
Add-Line "Modulos fora desse caminho devem ser corrigidos depois ou escondidos com uma mensagem honesta de 'Em breve'."

$Summary = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  root = $Root
  branch = $Branch
  commit = $Commit
  productionBaseUrl = $ProductionBaseUrl
  p0 = @($Critical)
  p1 = @($High)
  p2 = @($Medium)
  readyForValidation = ($Critical.Count -eq 0 -and $High.Count -eq 0)
  report = $ReportPath
}

[IO.File]::WriteAllText(
  $ReportPath,
  $Report.ToString(),
  $Utf8
)

[IO.File]::WriteAllText(
  $JsonPath,
  ($Summary | ConvertTo-Json -Depth 8),
  $Utf8
)

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "AUDITORIA QA CONCLUIDA" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "P0: $($Critical.Count)" -ForegroundColor $(if ($Critical.Count) { "Red" } else { "Green" })
Write-Host "P1: $($High.Count)" -ForegroundColor $(if ($High.Count) { "Yellow" } else { "Green" })
Write-Host "P2: $($Medium.Count)"
Write-Host ""
Write-Host "Relatorio: $ReportPath"
Write-Host "Resumo JSON: $JsonPath"
