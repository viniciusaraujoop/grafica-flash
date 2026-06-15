$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "app\cadastro\page.tsx"

if (!(Test-Path $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

if (!(Test-Path $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

Set-Location $project

$content = Get-Content $file -Raw

$content = $content -replace "import \{ useEffect, useMemo, useState, type FormEvent \} from 'react'", "import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'"
$content = $content -replace "export default function CadastroPage\(\)", "function CadastroPageContent()"

if ($content -notmatch "function CadastroPageContent\(\)") {
  Write-Host "Nao consegui localizar a funcao CadastroPage para corrigir." -ForegroundColor Red
  exit 1
}

if ($content -notmatch "export default function CadastroPage\(\)") {
  $content = $content.TrimEnd() + @'

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#07142f] px-4 text-white">
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-100">
              Orçaly
            </p>
            <h1 className="mt-3 text-3xl font-black">
              Carregando cadastro...
            </h1>
          </div>
        </main>
      }
    >
      <CadastroPageContent />
    </Suspense>
  )
}
'@
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host "Cadastro corrigido com Suspense para useSearchParams." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
