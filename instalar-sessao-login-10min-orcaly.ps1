$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
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

Write-Base64File "components\AuthSessionKeeper.tsx" @"
J3VzZSBjbGllbnQnCgppbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVJlZiB9IGZyb20gJ3JlYWN0JwppbXBvcnQgeyB1c2VQYXRobmFtZSwgdXNlUm91dGVyIH0gZnJvbSAnbmV4dC9uYXZpZ2F0aW9uJwppbXBvcnQgeyBzdXBhYmFzZSB9IGZyb20gJ0AvbGliL3N1cGFiYXNlJwoKY29uc3QgU0VTU0lPTl9USU1FT1VUX01TID0gMTAgKiA2MCAqIDEwMDAKY29uc3QgTEFTVF9BQ1RJVklUWV9LRVkgPSAnb3JjYWx5Omxhc3RfYWN0aXZpdHlfYXQnCgpmdW5jdGlvbiBub3coKSB7CiAgcmV0dXJuIERhdGUubm93KCkKfQoKZnVuY3Rpb24gZ2V0TGFzdEFjdGl2aXR5KCkgewogIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIDAKICBjb25zdCB2YWx1ZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShMQVNUX0FDVElWSVRZX0tFWSkKICByZXR1cm4gdmFsdWUgPyBOdW1iZXIodmFsdWUpIDogMAp9CgpmdW5jdGlvbiBzZXRMYXN0QWN0aXZpdHkoKSB7CiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4KICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oTEFTVF9BQ1RJVklUWV9LRVksIFN0cmluZyhub3coKSkpCn0KCmZ1bmN0aW9uIGNsZWFyTGFzdEFjdGl2aXR5KCkgewogIGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuCiAgd2luZG93LmxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKExBU1RfQUNUSVZJVFlfS0VZKQp9CgpmdW5jdGlvbiBpc0V4cGlyZWQoKSB7CiAgY29uc3QgbGFzdEFjdGl2aXR5ID0gZ2V0TGFzdEFjdGl2aXR5KCkKICBpZiAoIWxhc3RBY3Rpdml0eSkgcmV0dXJuIGZhbHNlCiAgcmV0dXJuIG5vdygpIC0gbGFzdEFjdGl2aXR5ID4gU0VTU0lPTl9USU1FT1VUX01TCn0KCmZ1bmN0aW9uIGlzTG9naW5QYXRoKHBhdGhuYW1lOiBzdHJpbmcpIHsKICByZXR1cm4gcGF0aG5hbWUgPT09ICcvbG9naW4nIHx8IHBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9sb2dpbi8nKQp9CgpmdW5jdGlvbiBpc1Byb3RlY3RlZFBhdGgocGF0aG5hbWU6IHN0cmluZykgewogIHJldHVybiBwYXRobmFtZSA9PT0gJy9wYWluZWwnIHx8CiAgICBwYXRobmFtZS5zdGFydHNXaXRoKCcvcGFpbmVsLycpIHx8CiAgICBwYXRobmFtZSA9PT0gJy9hZG1pbicgfHwKICAgIHBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9hZG1pbi8nKQp9CgpleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBBdXRoU2Vzc2lvbktlZXBlcigpIHsKICBjb25zdCByb3V0ZXIgPSB1c2VSb3V0ZXIoKQogIGNvbnN0IHBhdGhuYW1lID0gdXNlUGF0aG5hbWUoKSB8fCAnLycKICBjb25zdCBsYXN0VG91Y2hSZWYgPSB1c2VSZWYoMCkKICBjb25zdCB2YWxpZGF0aW5nUmVmID0gdXNlUmVmKGZhbHNlKQoKICB1c2VFZmZlY3QoKCkgPT4gewogICAgbGV0IGFjdGl2ZSA9IHRydWUKCiAgICBhc3luYyBmdW5jdGlvbiB2YWxpZGF0ZVNlc3Npb24oKSB7CiAgICAgIGlmICh2YWxpZGF0aW5nUmVmLmN1cnJlbnQpIHJldHVybgogICAgICB2YWxpZGF0aW5nUmVmLmN1cnJlbnQgPSB0cnVlCgogICAgICB0cnkgewogICAgICAgIGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgc3VwYWJhc2UuYXV0aC5nZXRTZXNzaW9uKCkKICAgICAgICBjb25zdCBzZXNzaW9uID0gZGF0YS5zZXNzaW9uCgogICAgICAgIGlmICghYWN0aXZlKSByZXR1cm4KCiAgICAgICAgaWYgKCFzZXNzaW9uKSB7CiAgICAgICAgICBjbGVhckxhc3RBY3Rpdml0eSgpCgogICAgICAgICAgaWYgKGlzUHJvdGVjdGVkUGF0aChwYXRobmFtZSkpIHsKICAgICAgICAgICAgcm91dGVyLnJlcGxhY2UoJy9sb2dpbicpCiAgICAgICAgICB9CgogICAgICAgICAgcmV0dXJuCiAgICAgICAgfQoKICAgICAgICBjb25zdCBsYXN0QWN0aXZpdHkgPSBnZXRMYXN0QWN0aXZpdHkoKQoKICAgICAgICBpZiAoIWxhc3RBY3Rpdml0eSkgewogICAgICAgICAgc2V0TGFzdEFjdGl2aXR5KCkKICAgICAgICB9CgogICAgICAgIGlmIChpc0V4cGlyZWQoKSkgewogICAgICAgICAgY2xlYXJMYXN0QWN0aXZpdHkoKQogICAgICAgICAgYXdhaXQgc3VwYWJhc2UuYXV0aC5zaWduT3V0KCkKCiAgICAgICAgICBpZiAoaXNQcm90ZWN0ZWRQYXRoKHBhdGhuYW1lKSB8fCBpc0xvZ2luUGF0aChwYXRobmFtZSkpIHsKICAgICAgICAgICAgcm91dGVyLnJlcGxhY2UoJy9sb2dpbj9leHBpcmVkPTEnKQogICAgICAgICAgfQoKICAgICAgICAgIHJldHVybgogICAgICAgIH0KCiAgICAgICAgaWYgKGlzTG9naW5QYXRoKHBhdGhuYW1lKSkgewogICAgICAgICAgcm91dGVyLnJlcGxhY2UoJy9wYWluZWwnKQogICAgICAgIH0KICAgICAgfSBmaW5hbGx5IHsKICAgICAgICB2YWxpZGF0aW5nUmVmLmN1cnJlbnQgPSBmYWxzZQogICAgICB9CiAgICB9CgogICAgZnVuY3Rpb24gdG91Y2hBY3Rpdml0eSgpIHsKICAgICAgY29uc3QgY3VycmVudCA9IG5vdygpCgogICAgICBpZiAoY3VycmVudCAtIGxhc3RUb3VjaFJlZi5jdXJyZW50IDwgNTAwMCkgewogICAgICAgIHJldHVybgogICAgICB9CgogICAgICBsYXN0VG91Y2hSZWYuY3VycmVudCA9IGN1cnJlbnQKICAgICAgc2V0TGFzdEFjdGl2aXR5KCkKICAgIH0KCiAgICBjb25zdCBldmVudHM6IEFycmF5PGtleW9mIFdpbmRvd0V2ZW50TWFwPiA9IFsKICAgICAgJ2NsaWNrJywKICAgICAgJ2tleWRvd24nLAogICAgICAnbW91c2Vtb3ZlJywKICAgICAgJ3Njcm9sbCcsCiAgICAgICd0b3VjaHN0YXJ0JywKICAgIF0KCiAgICBldmVudHMuZm9yRWFjaCgoZXZlbnQpID0+IHsKICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIHRvdWNoQWN0aXZpdHksIHsgcGFzc2l2ZTogdHJ1ZSB9KQogICAgfSkKCiAgICBjb25zdCBpbnRlcnZhbCA9IHdpbmRvdy5zZXRJbnRlcnZhbCh2YWxpZGF0ZVNlc3Npb24sIDIwMDAwKQoKICAgIGZ1bmN0aW9uIG9uVmlzaWJpbGl0eUNoYW5nZSgpIHsKICAgICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PT0gJ3Zpc2libGUnKSB7CiAgICAgICAgdmFsaWRhdGVTZXNzaW9uKCkKICAgICAgfQogICAgfQoKICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvblZpc2liaWxpdHlDaGFuZ2UpCgogICAgdmFsaWRhdGVTZXNzaW9uKCkKCiAgICBjb25zdCB7IGRhdGE6IGxpc3RlbmVyIH0gPSBzdXBhYmFzZS5hdXRoLm9uQXV0aFN0YXRlQ2hhbmdlKChldmVudCwgc2Vzc2lvbikgPT4gewogICAgICBpZiAoZXZlbnQgPT09ICdTSUdORURfSU4nICYmIHNlc3Npb24pIHsKICAgICAgICBzZXRMYXN0QWN0aXZpdHkoKQogICAgICAgIGlmIChpc0xvZ2luUGF0aChwYXRobmFtZSkpIHsKICAgICAgICAgIHJvdXRlci5yZXBsYWNlKCcvcGFpbmVsJykKICAgICAgICB9CiAgICAgIH0KCiAgICAgIGlmIChldmVudCA9PT0gJ1NJR05FRF9PVVQnKSB7CiAgICAgICAgY2xlYXJMYXN0QWN0aXZpdHkoKQogICAgICAgIGlmIChpc1Byb3RlY3RlZFBhdGgocGF0aG5hbWUpKSB7CiAgICAgICAgICByb3V0ZXIucmVwbGFjZSgnL2xvZ2luJykKICAgICAgICB9CiAgICAgIH0KICAgIH0pCgogICAgcmV0dXJuICgpID0+IHsKICAgICAgYWN0aXZlID0gZmFsc2UKICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpCiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvblZpc2liaWxpdHlDaGFuZ2UpCiAgICAgIGV2ZW50cy5mb3JFYWNoKChldmVudCkgPT4gewogICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCB0b3VjaEFjdGl2aXR5KQogICAgICB9KQogICAgICBsaXN0ZW5lci5zdWJzY3JpcHRpb24udW5zdWJzY3JpYmUoKQogICAgfQogIH0sIFtwYXRobmFtZSwgcm91dGVyXSkKCiAgcmV0dXJuIG51bGwKfQo=
"@

$layout = Join-Path $project "app\layout.tsx"

if (!(Test-Path -LiteralPath $layout)) {
  Write-Host "Arquivo app\layout.tsx nao encontrado." -ForegroundColor Red
  exit 1
}

$content = [System.IO.File]::ReadAllText($layout)

if ($content -notmatch "AuthSessionKeeper") {
  $lines = $content -split "`r?`n"
  $lastImportIndex = -1

  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "^import\s") {
      $lastImportIndex = $i
    }
  }

  if ($lastImportIndex -ge 0) {
    $before = $lines[0..$lastImportIndex]
    $after = $lines[($lastImportIndex + 1)..($lines.Length - 1)]
    $lines = @($before + "import AuthSessionKeeper from '@/components/AuthSessionKeeper'" + $after)
    $content = $lines -join "`n"
  } else {
    $content = "import AuthSessionKeeper from '@/components/AuthSessionKeeper'`n" + $content
  }
}

if ($content -notmatch "<AuthSessionKeeper\s*/>") {
  if ($content -match "\{children\}") {
    $content = $content -replace "\{children\}", "<AuthSessionKeeper />`n        {children}"
  } else {
    Write-Host "Nao encontrei {children} no app\layout.tsx para inserir o guardiao de sessao." -ForegroundColor Yellow
  }
}

[System.IO.File]::WriteAllText($layout, $content, $utf8NoBom)

# Ajuste opcional da pagina de login para exibir mensagem quando a sessao expira.
$loginPage = Join-Path $project "app\login\page.tsx"

if (Test-Path -LiteralPath $loginPage) {
  $loginContent = [System.IO.File]::ReadAllText($loginPage)

  # Nao força alteracao visual pesada para nao quebrar layout atual.
  # O AuthSessionKeeper ja faz o principal: se houver sessao ativa, /login volta para /painel.
  [System.IO.File]::WriteAllText($loginPage, $loginContent, $utf8NoBom)
}

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Sessao persistente instalada." -ForegroundColor Green
Write-Host "Se estiver logado e voltar para /login, o sistema retorna para /painel." -ForegroundColor Cyan
Write-Host "Sessao expira depois de 10 minutos sem atividade." -ForegroundColor Cyan
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
