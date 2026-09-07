param(
    [string]$ProductionDomain = "https://orcaly.com.br"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Text) {
    Write-Host ""
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
}

function Write-Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Invoke-OrcalyRequest(
    [string]$Url,
    [bool]$AllowRedirect
) {
    Add-Type `
        -AssemblyName System.Net.Http `
        -ErrorAction SilentlyContinue

    $Handler = New-Object System.Net.Http.HttpClientHandler
    $Handler.AllowAutoRedirect = $AllowRedirect

    $Client = New-Object System.Net.Http.HttpClient($Handler)
    $Client.Timeout = [TimeSpan]::FromSeconds(40)
    $Client.DefaultRequestHeaders.UserAgent.ParseAdd(
        "Orcaly-Production-Validator/2.0"
    )

    try {
        $Response = $Client.GetAsync(
            $Url
        ).GetAwaiter().GetResult()

        $Body = $Response.Content.ReadAsStringAsync(
        ).GetAwaiter().GetResult()

        $ResponseHeaders = @{}

        foreach ($HeaderItem in $Response.Headers) {
            $ResponseHeaders[$HeaderItem.Key] = (
                @($HeaderItem.Value) -join ", "
            )
        }

        foreach ($HeaderItem in $Response.Content.Headers) {
            $ResponseHeaders[$HeaderItem.Key] = (
                @($HeaderItem.Value) -join ", "
            )
        }

        $LocationValue = ""

        if ($null -ne $Response.Headers.Location) {
            $LocationValue = [string]$Response.Headers.Location
        }

        return @{
            Status = [int]$Response.StatusCode
            Body = [string]$Body
            Headers = $ResponseHeaders
            Location = $LocationValue
        }
    }
    finally {
        $Client.Dispose()
        $Handler.Dispose()
    }
}

function Get-HeaderValue(
    [hashtable]$Headers,
    [string]$Name
) {
    foreach ($Key in $Headers.Keys) {
        if (
            [string]::Equals(
                [string]$Key,
                $Name,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        ) {
            return [string]$Headers[$Key]
        }
    }

    return ""
}

Write-Section "ORCALY - VALIDAÇÃO DA PRODUÇÃO"

$BaseUrl = $ProductionDomain.TrimEnd("/")

$HomeResponse = Invoke-OrcalyRequest `
    -Url ($BaseUrl + "/") `
    -AllowRedirect $true

$PartnersResponse = Invoke-OrcalyRequest `
    -Url ($BaseUrl + "/parceiros") `
    -AllowRedirect $true

$AdminLoginResponse = Invoke-OrcalyRequest `
    -Url ($BaseUrl + "/admin/login") `
    -AllowRedirect $true

$AdminProtectedResponse = Invoke-OrcalyRequest `
    -Url ($BaseUrl + "/admin") `
    -AllowRedirect $false

$AdminApiResponse = Invoke-OrcalyRequest `
    -Url ($BaseUrl + "/api/admin/session") `
    -AllowRedirect $false

$HomeOk =
    $HomeResponse.Status -eq 200 -and
    $HomeResponse.Body.Contains("Orçaly")

$PartnersOk =
    $PartnersResponse.Status -eq 200 -and
    (
        $PartnersResponse.Body.Contains(
            "Programa Orçaly Parceiros"
        ) -or
        $PartnersResponse.Body.Contains(
            "Orçaly Parceiros"
        )
    )

$AdminLoginOk =
    $AdminLoginResponse.Status -eq 200 -and
    (
        $AdminLoginResponse.Body.Contains(
            "Login administrativo"
        ) -or
        $AdminLoginResponse.Body.Contains(
            "Centro de controle"
        )
    )

$RedirectStatuses = @(
    301,
    302,
    303,
    307,
    308
)

$AdminRedirectOk =
    $RedirectStatuses -contains
        $AdminProtectedResponse.Status

$AdminRedirectTargetOk =
    [string]::IsNullOrWhiteSpace(
        $AdminProtectedResponse.Location
    ) -or
    $AdminProtectedResponse.Location.Contains(
        "/admin/login"
    )

$AdminApiBlocked =
    @(
        401,
        403
    ) -contains $AdminApiResponse.Status

$AdminCache = Get-HeaderValue `
    -Headers $AdminProtectedResponse.Headers `
    -Name "Cache-Control"

$AdminRobots = Get-HeaderValue `
    -Headers $AdminProtectedResponse.Headers `
    -Name "X-Robots-Tag"

$ApiCache = Get-HeaderValue `
    -Headers $AdminApiResponse.Headers `
    -Name "Cache-Control"

$ApiRobots = Get-HeaderValue `
    -Headers $AdminApiResponse.Headers `
    -Name "X-Robots-Tag"

$AdminHeadersOk =
    $AdminCache.Contains("no-store") -and
    $AdminRobots.Contains("noindex")

$ApiHeadersOk =
    $ApiCache.Contains("no-store") -and
    $ApiRobots.Contains("noindex")

if (-not $HomeOk) {
    throw "A Home não respondeu corretamente. HTTP $($HomeResponse.Status)"
}

if (-not $PartnersOk) {
    throw "O Portal de Parceiros não respondeu corretamente. HTTP $($PartnersResponse.Status)"
}

if (-not $AdminLoginOk) {
    throw "O login administrativo não respondeu corretamente. HTTP $($AdminLoginResponse.Status)"
}

if (-not $AdminRedirectOk) {
    throw "/admin não redirecionou o acesso sem sessão. HTTP $($AdminProtectedResponse.Status)"
}

if (-not $AdminRedirectTargetOk) {
    throw "/admin redirecionou para um destino inesperado: $($AdminProtectedResponse.Location)"
}

if (-not $AdminApiBlocked) {
    throw "A API administrativa não recusou o acesso anônimo. HTTP $($AdminApiResponse.Status)"
}

if (-not $AdminHeadersOk) {
    throw "Os cabeçalhos privados não foram encontrados na resposta de /admin."
}

if (-not $ApiHeadersOk) {
    throw "Os cabeçalhos privados não foram encontrados na API administrativa."
}

Write-Ok "HOME_HTTP_200"
Write-Ok "PARCEIROS_HTTP_200"
Write-Ok "ADMIN_LOGIN_HTTP_200"
Write-Ok "ADMIN_ANONIMO_REDIRECIONADO"
Write-Ok "ADMIN_API_ANONIMA_BLOQUEADA"
Write-Ok "ADMIN_CACHE_NO_STORE"
Write-Ok "ADMIN_NOINDEX"
Write-Ok "PRODUCAO_VALIDADA=1"

Write-Host ""
Write-Host "Home: $BaseUrl/"
Write-Host "Parceiros: $BaseUrl/parceiros"
Write-Host "Login DONO: $BaseUrl/admin/login"
Write-Host "Redirecionamento anônimo: $($AdminProtectedResponse.Location)"
Write-Host "API administrativa sem sessão: HTTP $($AdminApiResponse.Status)"
