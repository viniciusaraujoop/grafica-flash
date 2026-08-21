$ErrorActionPreference = "Stop"

$Repo = "C:\Users\arauj\grafica-flash"
$Branch = "fix/assistant-v2-runtime-and-conversation"
$ProjectId = "prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O"
$TeamId = "team_c5p2Uiz9b1SqKxOhmnmxUWZH"
$Scope = "vinicius-araujos-projects"
$Project = "orcaly"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$keyFile = Join-Path $env:TEMP "orcaly-ai-key-$stamp.json"
$envFile = Join-Path $env:TEMP "orcaly-ai-env-$stamp.json"
$newKey = $null

function Step([string]$message) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host $message -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Utf8NoBom([string]$path, [string]$content) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $content, $utf8)
}

try {
    Step "1/7 - Validando repositorio e branch do Assistente"
    Set-Location $Repo

    if (-not (Test-Path ".git")) {
        throw "Repositorio Git nao encontrado em $Repo"
    }

    $dirty = git status --porcelain
    if ($dirty) {
        git status --short
        throw "Existem alteracoes locais. Nada foi sobrescrito."
    }

    git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git fetch falhou." }

    git show-ref --verify --quiet "refs/heads/$Branch"
    if ($LASTEXITCODE -eq 0) {
        git switch $Branch
    }
    else {
        git switch -c $Branch --track "origin/$Branch"
    }
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel acessar $Branch." }

    git pull --ff-only origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel atualizar $Branch." }

    Step "2/7 - Vinculando ao projeto Orçaly na Vercel"
    npx vercel@latest link --yes --project $Project --scope $Scope
    if ($LASTEXITCODE -ne 0) { throw "Falha ao vincular o projeto na Vercel." }

    Step "3/7 - Criando nova chave do AI Gateway"
    $keyBody = @{
        purpose = "ai-gateway"
        name = "orcaly-assistant-v2-$stamp"
        projectId = $ProjectId
    } | ConvertTo-Json -Depth 6
    Write-Utf8NoBom $keyFile $keyBody

    $keyRaw = & npx vercel@latest api "/v1/api-keys?teamId=$TeamId" -X POST --input $keyFile --raw
    if ($LASTEXITCODE -ne 0) { throw "A Vercel nao conseguiu criar uma nova chave do AI Gateway." }

    $keyResponse = $keyRaw | ConvertFrom-Json
    $newKey = [string]$keyResponse.apiKeyString
    if ([string]::IsNullOrWhiteSpace($newKey)) {
        throw "A Vercel criou a resposta, mas nao retornou apiKeyString. Nenhuma env foi alterada."
    }

    Write-Host "Nova chave criada e mantida somente em memoria. O valor nao sera exibido." -ForegroundColor Green

    Step "4/7 - Atualizando AI_GATEWAY_API_KEY em Preview e Production"
    $envBody = @(
        @{
            key = "AI_GATEWAY_API_KEY"
            value = $newKey
            type = "encrypted"
            target = @("preview", "production")
            comment = "Assistente Orçaly 2.0 - chave rotacionada em $stamp"
        }
    ) | ConvertTo-Json -Depth 8
    Write-Utf8NoBom $envFile $envBody

    $envRaw = & npx vercel@latest api "/v10/projects/$ProjectId/env?upsert=true&teamId=$TeamId" -X POST --input $envFile --raw
    if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar AI_GATEWAY_API_KEY no projeto." }

    $envResponse = $envRaw | ConvertFrom-Json
    if ($envResponse.failed -and @($envResponse.failed).Count -gt 0) {
        throw "A Vercel informou falha ao atualizar a variavel de ambiente."
    }

    $newKey = $null
    Remove-Item $keyFile -Force -ErrorAction SilentlyContinue
    Remove-Item $envFile -Force -ErrorAction SilentlyContinue
    Write-Host "Preview e Production receberam a nova credencial server-side." -ForegroundColor Green

    Step "5/7 - Disparando um Preview novo pela integracao Git"
    git commit --allow-empty -m "chore(assistant): redeploy after AI Gateway key rotation"
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel criar o commit de redeploy." }

    git push origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel enviar o redeploy ao GitHub." }

    $commit = (git rev-parse HEAD).Trim()
    Write-Host "Commit de QA: $commit" -ForegroundColor Yellow

    Step "6/7 - Aguardando o Preview correspondente ficar READY"
    $deployment = $null
    for ($attempt = 1; $attempt -le 48; $attempt++) {
        Start-Sleep -Seconds 5

        $listRaw = & npx vercel@latest api "/v6/deployments?projectId=$ProjectId&teamId=$TeamId&limit=20" --raw
        if ($LASTEXITCODE -ne 0) { continue }

        try {
            $list = $listRaw | ConvertFrom-Json
            $deployment = @($list.deployments) |
                Where-Object { $_.meta.githubCommitSha -eq $commit } |
                Select-Object -First 1
        }
        catch {
            $deployment = $null
        }

        if ($null -eq $deployment) {
            Write-Host "Preview ainda nao apareceu ($attempt/48)..." -ForegroundColor DarkGray
            continue
        }

        $state = [string]$deployment.state
        Write-Host "Preview: $state - $($deployment.url)" -ForegroundColor DarkGray

        if ($state -eq "READY") { break }
        if ($state -in @("ERROR", "CANCELED")) {
            throw "O Preview terminou em $state. Abra os logs antes de qualquer Production deploy."
        }
    }

    if ($null -eq $deployment -or [string]$deployment.state -ne "READY") {
        throw "O Preview nao chegou a READY dentro da janela de validacao."
    }

    Step "7/7 - Testando o provider REAL no Preview"
    $previewUrl = [string]$deployment.url
    $qaRaw = & npx vercel@latest curl "/api/public/home-chat/qa?probe=assistant-runtime-v2" --deployment $previewUrl
    if ($LASTEXITCODE -ne 0) { throw "Falha ao chamar o endpoint de QA do Assistente." }

    try {
        $qa = $qaRaw | ConvertFrom-Json
    }
    catch {
        throw "O endpoint de QA nao retornou JSON valido. Resposta: $qaRaw"
    }

    if (-not $qa.ok -or -not $qa.hasConversationalText) {
        throw "Provider ainda nao aprovado. errorType=$($qa.errorType) providerStatus=$($qa.providerStatus)"
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " ASSISTENTE ORÇALY - PROVIDER REAL APROVADO" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "Provider: $($qa.provider)" -ForegroundColor Green
    Write-Host "Auth: $($qa.authMode)" -ForegroundColor Green
    Write-Host "Model: $($qa.model)" -ForegroundColor Green
    Write-Host "Preview: https://$previewUrl" -ForegroundColor Green
    Write-Host "Resposta de QA: $($qa.answerPreview)" -ForegroundColor Green
    Write-Host ""
    Write-Host "A Production ainda NAO foi promovida por este script." -ForegroundColor Yellow
}
catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " VALIDACAO INTERROMPIDA - PRODUCAO NAO FOI ALTERADA" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host "O terminal permanece aberto." -ForegroundColor Green
}
finally {
    $newKey = $null
    Remove-Item $keyFile -Force -ErrorAction SilentlyContinue
    Remove-Item $envFile -Force -ErrorAction SilentlyContinue
}
