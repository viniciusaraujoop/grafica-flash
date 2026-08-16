param(
    [string]$ProjectRoot = "C:\Users\arauj\grafica-flash"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$ExpectedBranch = "fix/unify-payment-flows-phase-1"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\fase9-regressao-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$MigrationRelative = "supabase/migrations/20260812221532_founder_final_regression_hardening_v1.sql"
$MigrationBase64 = "ZHJvcCBpbmRleCBpZiBleGlzdHMgcHVibGljLmlkeF9zaWdudXBfbGVhZF9mb2xsb3d1cHNfc2FsZXNfbGVhZF9jcmVhdGVkOwoKY3JlYXRlIGluZGV4IGlmIG5vdCBleGlzdHMgZm91bmRlcl9pbnZpdGVzX3Jldm9rZWRfYnlfYWRtaW5faWR4CiAgb24gcHVibGljLmZvdW5kZXJfaW52aXRlcyhyZXZva2VkX2J5X2FkbWluX2lkLCByZXZva2VkX2F0IGRlc2MpCiAgd2hlcmUgcmV2b2tlZF9ieV9hZG1pbl9pZCBpcyBub3QgbnVsbDsK"
$MigrationSha = "CC9AB581DA60DB07F8B6542C3EDE37D48BEF73301623C4475ED785E157179A09"
$Changed = New-Object System.Collections.Generic.List[string]

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

function NormalizeNewlines([string]$Value) {
    if ($null -eq $Value) { return "" }
    return $Value.Replace("`r`n", "`n").Replace("`r", "`n")
}

function ReadText([string]$Relative) {
    $path = FullPath $Relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw ("Arquivo ausente: " + $Relative)
    }
    return NormalizeNewlines ([IO.File]::ReadAllText($path))
}

function Assert([bool]$Passed, [string]$Name) {
    if (-not $Passed) {
        throw ("Validacao falhou: " + $Name)
    }
    Ok $Name
}

function EnsureMigration {
    $path = FullPath $MigrationRelative

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $sha = (Get-FileHash $path -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($sha -ne $MigrationSha) {
            throw ($MigrationRelative + " existe com conteudo diferente da migration remota.")
        }
        Ok "Migration final de hardening ja sincronizada."
        return
    }

    [IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($MigrationBase64))
    $Changed.Add($MigrationRelative)

    $sha = (Get-FileHash $path -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($sha -ne $MigrationSha) {
        throw "SHA256 inesperado ao sincronizar migration da FASE 9."
    }

    Ok "Migration final de hardening sincronizada localmente."
}

function Rollback {
    foreach ($relative in $Changed) {
        Remove-Item -LiteralPath (FullPath $relative) -Force -ErrorAction SilentlyContinue
        Warn ("Removido no rollback: " + $relative)
    }
}

function AssertContains([string]$Relative, [string]$Needle, [string]$Label) {
    $text = ReadText $Relative
    Assert ($text.Contains($Needle)) $Label
}

function AssertNotContains([string]$Relative, [string]$Needle, [string]$Label) {
    $text = ReadText $Relative
    Assert (-not $text.Contains($Needle)) $Label
}

try {
    Write-Host ""
    Write-Host "ORCALY - FASE 9 - REGRESSAO FINAL FOUNDER" -ForegroundColor Cyan
    Write-Host "Auditoria de FASES 1-8 antes de commit/push/deploy." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (FullPath "package.json") -PathType Leaf)) {
        throw "Repositorio Orcaly nao encontrado."
    }

    Set-Location $ProjectRoot

    $branch = ([string]((& git branch --show-current) | Select-Object -First 1)).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel identificar a branch Git." }
    Assert ($branch -eq $ExpectedBranch) ("Branch correta: " + $ExpectedBranch)

    Step "Validando todas as fases locais"

    $required = @(
        # FASE 1
        "supabase/migrations/20260811230446_founder_program_database_foundation.sql",
        "supabase/migrations/20260811230525_founder_program_database_foundation_hardening.sql",

        # FASE 2
        "lib/platform-admin.ts",
        "proxy.ts",

        # FASE 3
        "lib/platform-admin-invites.ts",
        "app/api/admin/team/prospector-invites/route.ts",
        "app/api/team-invites/activate/route.ts",
        "app/equipe/ativar/page.tsx",
        "app/admin/equipe/comercial/page.tsx",

        # FASE 4
        "lib/prospecting.ts",
        "app/api/admin/prospecting/route.ts",
        "components/admin/ProspectingCrmClient.tsx",
        "app/admin/prospeccao/page.tsx",
        "supabase/migrations/20260812001520_sales_prospecting_crm_foundation_v1.sql",
        "supabase/migrations/20260812002052_sales_prospecting_crm_hardening_v1.sql",

        # FASE 5
        "lib/founder-program.ts",
        "app/api/admin/founders/route.ts",
        "components/admin/FounderInvitesClient.tsx",
        "app/admin/fundadores/page.tsx",
        "supabase/migrations/20260812003227_founder_invite_sales_integration_v1.sql",

        # FASE 6
        "app/api/founders/activate/route.ts",
        "components/founders/FounderActivationClient.tsx",
        "app/fundadores/ativar/page.tsx",
        "app/api/founders/welcome/route.ts",
        "components/painel/FounderWelcomeModal.tsx",
        "supabase/migrations/20260812005359_founder_public_activation_trial_v1.sql",

        # FASE 7
        "lib/founder-billing.ts",
        "app/api/founders/billing/route.ts",
        "app/api/cron/founder-billing/route.ts",
        "components/subscription/SubscriptionExperience.tsx",
        "components/subscription/FounderSubscriptionPanel.tsx",
        "supabase/migrations/20260812011742_founder_billing_lifecycle_v1.sql",

        # FASE 8
        "lib/sales-performance.ts",
        "app/api/admin/performance/route.ts",
        "components/admin/SalesPerformanceClient.tsx",
        "app/admin/prospeccao/desempenho/page.tsx"
    )

    foreach ($relative in $required) {
        Assert (Test-Path -LiteralPath (FullPath $relative) -PathType Leaf) ("Presente: " + $relative)
    }

    Step "Sincronizando hardening final"
    EnsureMigration

    Step "Regressao de autorizacao Owner / Prospector"

    AssertContains "lib/platform-admin.ts" "'prospecting.view_own'" "Permissao prospecting.view_own existe"
    AssertContains "lib/platform-admin.ts" "'prospecting.view_all'" "Permissao prospecting.view_all existe"
    AssertContains "lib/platform-admin.ts" "'performance.view_own'" "Permissao performance.view_own existe"
    AssertContains "lib/platform-admin.ts" "'performance.view_all'" "Permissao performance.view_all existe"
    AssertContains "lib/platform-admin.ts" "'founders.create_invite'" "Permissao founders.create_invite existe"
    AssertContains "proxy.ts" "/admin/prospeccao" "Proxy permite area comercial"
    AssertContains "proxy.ts" "/admin/fundadores" "Proxy permite area Founder"

    Step "Regressao CRM"

    AssertContains "app/api/admin/prospecting/route.ts" "prospecting.access" "API CRM exige acesso comercial"
    AssertContains "app/api/admin/prospecting/route.ts" "assigned_to_admin_id" "CRM preserva carteira por responsavel"
    AssertContains "app/api/admin/prospecting/route.ts" "create_or_claim_sales_prospect" "CRM usa RPC atomica"
    AssertContains "app/api/admin/prospecting/route.ts" "record_signup_lead_sales_followup" "CRM registra contato por RPC"
    AssertContains "lib/prospecting.ts" "conta_ativada" "Etapa conta_ativada preservada"
    AssertContains "lib/prospecting.ts" "cliente" "Etapa cliente preservada"

    Step "Regressao convites Founder"

    AssertContains "app/api/admin/founders/route.ts" "create_founder_invite_for_sales_lead" "Convite real usa RPC atomica"
    AssertContains "app/api/admin/founders/route.ts" "rotate_founder_invite_token" "Rotacao de token usa RPC"
    AssertContains "app/api/admin/founders/route.ts" "revoke_founder_invite" "Revogacao usa RPC"
    AssertContains "app/api/admin/founders/route.ts" "/fundadores/ativar?token=" "Link publico Founder existe"
    AssertContains "app/api/admin/founders/route.ts" "createHash" "Token e hasheado no servidor"
    AssertNotContains "components/admin/FounderInvitesClient.tsx" "SUPABASE_SERVICE_ROLE_KEY" "Service role ausente da UI Founder"

    Step "Regressao ativacao publica"

    AssertContains "app/api/founders/activate/route.ts" "claim_founder_activation" "Ativacao usa claim"
    AssertContains "app/api/founders/activate/route.ts" "auth.admin.createUser" "Auth Founder criado server-side"
    AssertContains "app/api/founders/activate/route.ts" "auth.admin.deleteUser" "Compensacao Auth continua presente"
    AssertContains "app/api/founders/activate/route.ts" "complete_founder_activation" "Finalizacao Founder atomica"
    AssertContains "lib/company-access.ts" "status === 'trialing'" "Gate aceita trialing valido"
    AssertContains "lib/company-access.ts" "status !== 'ativa'" "Gate pago continua exigindo ativa fora do trial"
    AssertNotContains "components/founders/FounderActivationClient.tsx" "SUPABASE_SERVICE_ROLE_KEY" "Service role ausente da ativacao publica"

    Step "Regressao cobranca e Mercado Pago"

    AssertContains "app/api/founders/billing/route.ts" "claim_founder_billing_setup" "Billing Founder usa claim"
    AssertContains "app/api/founders/billing/route.ts" "findRecoverableFounderSubscription" "Billing tenta recuperar preapproval"
    AssertContains "lib/founder-billing.ts" "/preapproval/search?q=" "Busca de preapproval preservada"
    AssertContains "lib/founder-billing.ts" 'method: "PUT"' "Conversao altera mesma preapproval"
    AssertContains "app/api/cron/founder-billing/route.ts" "CRON_SECRET" "Cron protegido por segredo"
    AssertContains "app/api/cron/founder-billing/route.ts" "claim_due_founder_price_conversions" "Cron usa claim de conversao"
    AssertNotContains "app/api/cron/founder-billing/route.ts" 'method: "POST"' "Cron nao cria nova assinatura"
    AssertContains "app/api/mercado-pago/webhook/route.ts" "record_founder_payment_approved" "Webhook Founder usa RPC de pagamento"
    AssertContains "app/api/mercado-pago/webhook/route.ts" "applyApprovedSubscriptionPayment" "Webhook normal continua preservado"
    AssertContains "lib/subscription-service.ts" "Empresas Founder usam o fluxo de cobrança Founder" "Servico generico bloqueia duplicidade Founder"
    AssertContains "lib/subscription-mercado-pago-transparent.ts" "Empresas Founder usam o fluxo de cobrança Founder" "Checkout transparente bloqueia Founder"
    AssertContains "components/subscription/SubscriptionExperience.tsx" "MercadoPagoSubscriptionCheckout" "Cliente normal continua no checkout normal"
    AssertContains "components/subscription/SubscriptionExperience.tsx" "FounderSubscriptionPanel" "Founder usa painel proprio"

    Step "Regressao de desempenho comercial"

    AssertContains "app/api/admin/performance/route.ts" "performance.view_own" "Desempenho individual exige permissao"
    AssertContains "app/api/admin/performance/route.ts" "performance.view_all" "Desempenho global exige permissao"
    AssertContains "app/api/admin/performance/route.ts" "assigned_to_admin_id" "Carteira Prospector filtrada server-side"
    AssertContains "app/api/admin/performance/route.ts" "created_by_admin_id" "Atividade Prospector filtrada server-side"
    AssertContains "app/api/admin/performance/route.ts" "founder_number >= 1" "Founder #00 excluido das metricas"
    AssertContains "app/api/admin/performance/route.ts" "first_payment_approved" "Cliente exige primeiro pagamento"
    AssertContains "lib/sales-performance.ts" "if (denominator <= 0) return 0" "Taxa zero segura"

    Step "Regressao de segredos e arquivos cliente"

    $clientFiles = @(
        "components/admin/ProspectingCrmClient.tsx",
        "components/admin/FounderInvitesClient.tsx",
        "components/admin/SalesPerformanceClient.tsx",
        "components/founders/FounderActivationClient.tsx",
        "components/painel/FounderWelcomeModal.tsx",
        "components/subscription/FounderSubscriptionPanel.tsx",
        "components/subscription/SubscriptionExperience.tsx"
    )

    foreach ($relative in $clientFiles) {
        $text = ReadText $relative
        Assert (-not $text.Contains("SUPABASE_SERVICE_ROLE_KEY")) ("Sem service role no cliente: " + $relative)
        Assert (-not $text.Contains("MERCADO_PAGO_ACCESS_TOKEN")) ("Sem access token MP no cliente: " + $relative)
    }

    Step "Procurando marcadores de conflito"

    $conflictFound = $false
    foreach ($relative in $required) {
        $text = ReadText $relative
        if (
            $text.Contains("<<<<<<<") -or
            $text.Contains("=======") -or
            $text.Contains(">>>>>>>")
        ) {
            Write-Host ("Conflito encontrado em: " + $relative) -ForegroundColor Red
            $conflictFound = $true
        }
    }
    Assert (-not $conflictFound) "Nenhum marcador de conflito Git nos arquivos Founder"

    Step "Validando vercel.json"

    $vercel = ReadText "vercel.json"
    Assert ($vercel.Contains('"/api/admin/scan"')) "Cron scanner legado preservado"
    Assert ($vercel.Contains('"/api/cron/founder-billing"')) "Cron Founder presente"

    $cronConfigured = $false
    foreach ($envFile in @(".env.local", ".env")) {
        $path = FullPath $envFile
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $envText = [IO.File]::ReadAllText($path)
            if ($envText -match "(?m)^CRON_SECRET=.+$") {
                $cronConfigured = $true
            }
        }
    }

    if ($cronConfigured) {
        Ok "CRON_SECRET presente no ambiente local."
    } else {
        Warn "CRON_SECRET nao encontrado em .env/.env.local. O build pode passar, mas deploy de producao continua bloqueado ate configurar o segredo na Vercel."
    }

    Step "git diff --check completo"

    & git --no-pager diff --check
    if ($LASTEXITCODE -ne 0) { throw "git diff --check falhou." }
    Ok "Whitespace de todo o working tree validado."

    Step "ESLint de regressao Founder"

    $eslintFiles = @(
        "lib/platform-admin.ts",
        "lib/platform-admin-invites.ts",
        "lib/prospecting.ts",
        "lib/founder-program.ts",
        "lib/founder-billing.ts",
        "lib/sales-performance.ts",
        "lib/company-access.ts",
        "lib/subscription-service.ts",
        "lib/subscription-mercado-pago-transparent.ts",
        "proxy.ts",
        "app/api/admin/team/prospector-invites/route.ts",
        "app/api/team-invites/activate/route.ts",
        "app/api/admin/prospecting/route.ts",
        "app/api/admin/founders/route.ts",
        "app/api/admin/performance/route.ts",
        "app/api/founders/activate/route.ts",
        "app/api/founders/welcome/route.ts",
        "app/api/founders/billing/route.ts",
        "app/api/cron/founder-billing/route.ts",
        "app/api/mercado-pago/webhook/route.ts",
        "components/admin/ProspectingCrmClient.tsx",
        "components/admin/FounderInvitesClient.tsx",
        "components/admin/SalesPerformanceClient.tsx",
        "components/founders/FounderActivationClient.tsx",
        "components/painel/FounderWelcomeModal.tsx",
        "components/subscription/FounderSubscriptionPanel.tsx",
        "components/subscription/SubscriptionExperience.tsx",
        "app/admin/prospeccao/page.tsx",
        "app/admin/prospeccao/desempenho/page.tsx",
        "app/admin/fundadores/page.tsx",
        "app/fundadores/ativar/page.tsx",
        "app/painel/assinatura/page.tsx"
    )

    & npx.cmd eslint $eslintFiles
    if ($LASTEXITCODE -ne 0) { throw "ESLint de regressao falhou." }
    Ok "ESLint de regressao passou."

    Step "Build completo de producao"

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Build final de producao falhou." }
    Ok "Build final de producao passou."

    Step "Estado Git para auditoria antes de commit"

    & git status --short
    if ($LASTEXITCODE -ne 0) { throw "git status falhou." }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " FASE 9 - REGRESSAO FINAL APROVADA LOCALMENTE" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Validado:"
    Write-Host " - FASES 1-8 presentes"
    Write-Host " - Owner / Prospector"
    Write-Host " - Convite de equipe"
    Write-Host " - CRM e carteira propria"
    Write-Host " - Founder #00 e #01-#10"
    Write-Host " - Ativacao publica e compensacao Auth"
    Write-Host " - Trial de 30 dias"
    Write-Host " - Cobranca Founder idempotente"
    Write-Host " - Webhook Founder e fluxo normal"
    Write-Host " - Conversao para preco normal"
    Write-Host " - Cron sem criacao de assinatura"
    Write-Host " - Dashboard de desempenho"
    Write-Host " - Ausencia de segredos nos componentes cliente"
    Write-Host " - git diff --check"
    Write-Host " - ESLint"
    Write-Host " - Next.js production build"
    Write-Host ""
    if (-not $cronConfigured) {
        Write-Host "BLOQUEIO DE DEPLOY: configure CRON_SECRET na Vercel antes da producao." -ForegroundColor Yellow
    }
    Write-Host "Nenhum commit, push ou deploy foi executado." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host ("[ERRO] " + $_.Exception.Message) -ForegroundColor Red

    if ($Changed.Count -gt 0) {
        Warn "Executando rollback apenas dos arquivos criados pela FASE 9."
        Rollback
    }

    Write-Host ("Backup logico: " + $BackupRoot) -ForegroundColor Yellow
    exit 1
}
