$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\business-types.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-site-defaults-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

if ($content -match "site_cta_text:") {
  Write-Host "site_cta_text ja existe em getDefaultSetupForBusiness. Nenhuma alteracao principal necessaria." -ForegroundColor Yellow
} else {
  $needle = "    site_template: config.id,"
  $insert = @"
    site_template: config.id,
    site_layout: config.id === 'food' ? 'food-menu' : config.id === 'graphic' ? 'budget-showcase' : 'premium',
    site_cta_text: config.cta,
    site_marketplace_title: config.id === 'food' ? 'Cardápio' : config.id === 'beauty' || config.id === 'barber' ? 'Serviços' : 'Catálogo',
    site_marketplace_subtitle: config.id === 'food'
      ? 'Escolha os itens, monte seu pedido e envie pelo WhatsApp.'
      : 'Escolha produtos ou serviços e envie tudo organizado para atendimento.',
    site_cart_button_text: config.id === 'food' ? 'Adicionar ao pedido' : 'Adicionar',
    site_checkout_button_text: config.id === 'food' ? 'Enviar pedido' : 'Finalizar pedido',
    site_empty_catalog_text: config.id === 'food'
      ? 'O cardápio ainda está sendo preparado.'
      : 'A empresa ainda está preparando o catálogo.',
    site_payment_methods: config.id === 'food' ? ['Pix', 'Dinheiro', 'Cartão na entrega'] : ['Pix', 'Cartão', 'A combinar'],
    site_delivery_options: config.id === 'food' ? ['Retirada', 'Entrega'] : ['Retirada', 'Entrega', 'A combinar'],
"@

  if (!$content.Contains($needle)) {
    Write-Host "Nao encontrei o ponto esperado: $needle" -ForegroundColor Red
    exit 1
  }

  $content = $content.Replace($needle, $insert.TrimEnd())
}

# Garante também aliases compatíveis caso alguma área use nomes antigos.
if ($content -notmatch "site_cart_button_text:") {
  Write-Host "Falha: site_cart_button_text nao ficou presente apos patch." -ForegroundColor Red
  exit 1
}

if ($content -ne $original) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Defaults do site corrigidos em lib\business-types.ts" -ForegroundColor Green
} else {
  Write-Host "Arquivo mantido sem alteracoes." -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
