param(
    [switch]$SkipBuild,
    [switch]$Commit,
    [switch]$Push
)

$ErrorActionPreference = "Stop"

$patcher = Join-Path $PSScriptRoot "orcaly-payment-flows-phase1.mjs"

if (-not (Test-Path -LiteralPath $patcher -PathType Leaf)) {
    throw "Patcher não encontrado: $patcher"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js não encontrado no PATH."
}

$arguments = @($patcher)

if ($SkipBuild) {
    $arguments += "--skip-build"
}

if ($Commit) {
    $arguments += "--commit"
}

if ($Push) {
    $arguments += "--push"
}

& node @arguments
exit $LASTEXITCODE
