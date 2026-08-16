$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " ORCALY - INFORMACAO MERCADO PAGO NA HOME" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$Path = Join-Path (Get-Location) "app\page.tsx"

if (-not (Test-Path $Path)) {
    Write-Host "ERRO: app\page.tsx nao encontrado." -ForegroundColor Red
    Write-Host "Execute este script na raiz do projeto Orçaly." -ForegroundColor Yellow
    exit 1
}

$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Content = [System.IO.File]::ReadAllText($Path, $Utf8)

# Evita inserir novamente caso o script seja executado duas vezes
if ($Content.Contains("Recebimento exclusivo pelo Mercado Pago")) {
    Write-Host "A informacao do Mercado Pago ja existe na pagina inicial." -ForegroundColor Yellow
    exit 0
}

$OldBlock = @'
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-black text-[#607895] lg:justify-start">
              {['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços'].map((item) => (
                <span key={item} className="rounded-full border border-blue-100 bg-white px-3 py-2 shadow-sm">
                  Orçaly {item}
                </span>
              ))}
            </div>
'@

$NewBlock = @'
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-black text-[#607895] lg:justify-start">
              {['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços'].map((item) => (
                <span key={item} className="rounded-full border border-blue-100 bg-white px-3 py-2 shadow-sm">
                  Orçaly {item}
                </span>
              ))}
            </div>

            <p className="mx-auto mt-4 max-w-2xl text-center text-xs font-bold leading-5 text-[#607895] lg:mx-0 lg:text-left">
              🔒 Recebimento exclusivo pelo Mercado Pago. Todos os pagamentos realizados através do Orçaly são processados pelo Mercado Pago, utilizando sua infraestrutura para oferecer mais segurança e confiabilidade nas transações.
            </p>
'@

if (-not $Content.Contains($OldBlock)) {
    Write-Host ""
    Write-Host "ERRO: Nao encontrei o ponto exato de insercao." -ForegroundColor Red
    Write-Host "O arquivo app\page.tsx pode ter sido alterado desde a ultima versao." -ForegroundColor Yellow
    Write-Host "Nenhuma modificacao foi realizada." -ForegroundColor Yellow
    exit 1
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = "$Path.backup-$Timestamp"

Copy-Item $Path $Backup

Write-Host "Backup criado:" -ForegroundColor DarkGray
Write-Host $Backup -ForegroundColor DarkGray
Write-Host ""

$Content = $Content.Replace($OldBlock, $NewBlock)

[System.IO.File]::WriteAllText(
    $Path,
    $Content,
    $Utf8
)

Write-Host "Informacao adicionada com sucesso." -ForegroundColor Green
Write-Host ""

Write-Host "Texto inserido:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Recebimento exclusivo pelo Mercado Pago." -ForegroundColor White
Write-Host "Todos os pagamentos realizados através do Orçaly são processados pelo Mercado Pago," -ForegroundColor Gray
Write-Host "utilizando sua infraestrutura para oferecer mais segurança e confiabilidade nas transações." -ForegroundColor Gray
Write-Host ""

Write-Host "Verificando Git..." -ForegroundColor Cyan
Write-Host ""

git diff --check

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ATENCAO: git diff --check encontrou algum problema." -ForegroundColor Yellow
} else {
    Write-Host "git diff --check: OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "Arquivo alterado:" -ForegroundColor Cyan
git status --short -- app/page.tsx

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " ALTERACAO CONCLUIDA" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para visualizar a diferenca:" -ForegroundColor Yellow
Write-Host "git diff -- app/page.tsx" -ForegroundColor White
Write-Host ""
