$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location $project

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Base64File($relativePath, $base64Content) {
  $target = Join-Path $project $relativePath
  $directory = Split-Path $target -Parent

  New-Item -ItemType Directory -Force $directory | Out-Null

  $bytes = [System.Convert]::FromBase64String($base64Content.Trim())
  $content = [System.Text.Encoding]::UTF8.GetString($bytes)

  [System.IO.File]::WriteAllText($target, $content, $utf8NoBom)
}

Write-Base64File "app\painel\admin\page.tsx" @"
aW1wb3J0IHsgcmVkaXJlY3QgfSBmcm9tICduZXh0L25hdmlnYXRpb24nCgpleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBQYWluZWxBZG1pbkF0YWxob1BhZ2UoKSB7CiAgcmVkaXJlY3QoJy9hZG1pbicpCn0K
"@

# Tenta adicionar um atalho visual no painel se encontrar pontos comuns.
$painel = Join-Path $project "app\painel\page.tsx"

if (Test-Path $painel) {
  $content = [System.IO.File]::ReadAllText($painel)

  if ($content -notmatch "/admin") {
    $atalho = @'

      <a
        href="/admin"
        className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c] transition hover:bg-blue-100"
      >
        Admin master
      </a>
'@

    if ($content -match "</header>") {
      $content = $content.Replace("</header>", "$atalho`n</header>")
      [System.IO.File]::WriteAllText($painel, $content, $utf8NoBom)
      Write-Host "Atalho Admin master adicionado perto do header do painel." -ForegroundColor Green
    } else {
      Write-Host "Nao encontrei header para inserir atalho visual. Rota /painel/admin foi criada." -ForegroundColor Yellow
    }
  } else {
    Write-Host "O painel ja parece ter algum link para /admin." -ForegroundColor Yellow
  }
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Atalho /painel/admin criado. Ele redireciona para /admin." -ForegroundColor Cyan
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
