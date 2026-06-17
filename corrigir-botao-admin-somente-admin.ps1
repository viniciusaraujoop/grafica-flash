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

Write-Base64File "components\AdminMasterButton.tsx" @"
J3VzZSBjbGllbnQnCgppbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnCmltcG9ydCBMaW5rIGZyb20gJ25leHQvbGluaycKaW1wb3J0IHsgc3VwYWJhc2UgfSBmcm9tICdAL2xpYi9zdXBhYmFzZScKCmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEFkbWluTWFzdGVyQnV0dG9uKCkgewogIGNvbnN0IFtpc0FkbWluLCBzZXRJc0FkbWluXSA9IHVzZVN0YXRlKGZhbHNlKQogIGNvbnN0IFtjaGVja2VkLCBzZXRDaGVja2VkXSA9IHVzZVN0YXRlKGZhbHNlKQoKICB1c2VFZmZlY3QoKCkgPT4gewogICAgYXN5bmMgZnVuY3Rpb24gdmVyaWZpY2FyQWRtaW4oKSB7CiAgICAgIHRyeSB7CiAgICAgICAgY29uc3QgeyBkYXRhOiBzZXNzaW9uRGF0YSB9ID0gYXdhaXQgc3VwYWJhc2UuYXV0aC5nZXRTZXNzaW9uKCkKICAgICAgICBjb25zdCBlbWFpbCA9IHNlc3Npb25EYXRhLnNlc3Npb24/LnVzZXI/LmVtYWlsCgogICAgICAgIGlmICghZW1haWwpIHsKICAgICAgICAgIHNldElzQWRtaW4oZmFsc2UpCiAgICAgICAgICBzZXRDaGVja2VkKHRydWUpCiAgICAgICAgICByZXR1cm4KICAgICAgICB9CgogICAgICAgIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlCiAgICAgICAgICAuZnJvbSgnYWRtaW5fdXNlcnMnKQogICAgICAgICAgLnNlbGVjdCgnZW1haWwsIGF0aXZvJykKICAgICAgICAgIC5lcSgnZW1haWwnLCBlbWFpbC50b0xvd2VyQ2FzZSgpKQogICAgICAgICAgLmVxKCdhdGl2bycsIHRydWUpCiAgICAgICAgICAubWF5YmVTaW5nbGUoKQoKICAgICAgICBpZiAoZXJyb3IgfHwgIWRhdGEpIHsKICAgICAgICAgIHNldElzQWRtaW4oZmFsc2UpCiAgICAgICAgICBzZXRDaGVja2VkKHRydWUpCiAgICAgICAgICByZXR1cm4KICAgICAgICB9CgogICAgICAgIHNldElzQWRtaW4odHJ1ZSkKICAgICAgfSBjYXRjaCB7CiAgICAgICAgc2V0SXNBZG1pbihmYWxzZSkKICAgICAgfSBmaW5hbGx5IHsKICAgICAgICBzZXRDaGVja2VkKHRydWUpCiAgICAgIH0KICAgIH0KCiAgICB2ZXJpZmljYXJBZG1pbigpCiAgfSwgW10pCgogIGlmICghY2hlY2tlZCB8fCAhaXNBZG1pbikgcmV0dXJuIG51bGwKCiAgcmV0dXJuICgKICAgIDxMaW5rCiAgICAgIGhyZWY9Ii9hZG1pbiIKICAgICAgY2xhc3NOYW1lPSJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1ibHVlLTEwMCBiZy1ibHVlLTUwIHB4LTQgcHktMyB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC1bIzA1MjQ1Y10gdHJhbnNpdGlvbiBob3ZlcjpiZy1ibHVlLTEwMCIKICAgID4KICAgICAgQWRtaW4gbWFzdGVyCiAgICA8L0xpbms+CiAgKQp9Cg==
"@

$painel = Join-Path $project "app\painel\page.tsx"

if (!(Test-Path $painel)) {
  Write-Host "Nao encontrei app\painel\page.tsx" -ForegroundColor Red
  exit 1
}

$content = [System.IO.File]::ReadAllText($painel)

# Remove botao antigo hardcoded para /admin, se o script anterior colocou.
$pattern1 = '(?s)\s*<a\s+href="/admin"\s+className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-\[#05245c\] transition hover:bg-blue-100"\s*>\s*Admin master\s*</a>'
$content = [regex]::Replace($content, $pattern1, "")

$pattern2 = '(?s)\s*<a\s+[^>]*href="/admin"[^>]*>\s*Admin master\s*</a>'
$content = [regex]::Replace($content, $pattern2, "")

# Remove duplicatas do componente, se houver.
$content = $content.Replace("<AdminMasterButton />", "")

# Adiciona import do componente.
if ($content -notmatch "AdminMasterButton") {
  if ($content -match "import ") {
    $lastImport = [regex]::Matches($content, "(?m)^import .+$") | Select-Object -Last 1
    if ($lastImport) {
      $insertAt = $lastImport.Index + $lastImport.Length
      $content = $content.Insert($insertAt, "`nimport AdminMasterButton from '@/components/AdminMasterButton'")
    }
  } else {
    $content = "import AdminMasterButton from '@/components/AdminMasterButton'`n" + $content
  }
}

# Insere botao seguro perto do primeiro header. Se nao tiver header, tenta antes do primeiro section/main.
if ($content -notmatch "<AdminMasterButton />") {
  if ($content -match "</header>") {
    $content = $content.Replace("</header>", "        <AdminMasterButton />`n</header>")
  } elseif ($content -match "</main>") {
    $content = $content.Replace("</main>", "      <AdminMasterButton />`n</main>")
  } else {
    Write-Host "Nao encontrei local claro para inserir o botao. O componente foi criado, mas precisa adicionar <AdminMasterButton /> manualmente." -ForegroundColor Yellow
  }
}

[System.IO.File]::WriteAllText($painel, $content, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Botao Admin master agora aparece somente para usuarios cadastrados em admin_users." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
