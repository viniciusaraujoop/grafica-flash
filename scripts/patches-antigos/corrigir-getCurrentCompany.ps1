$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"

if (!(Test-Path -LiteralPath $project)) {
  Write-Host "Projeto nao encontrado em $project" -ForegroundColor Red
  exit 1
}

Set-Location -LiteralPath $project

$target = Join-Path $project "lib\current-company-client.ts"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (Test-Path -LiteralPath $target) {
  $backup = $target + ".backup-getCurrentCompany-" + (Get-Date -Format "yyyyMMddHHmmss")
  Copy-Item -LiteralPath $target -Destination $backup -Force
  Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow
}

$content = @"
import { supabase } from '@/lib/supabase'

export type CurrentCompanyClientPayload = {
  user?: {
    id: string
    email?: string | null
  }
  company: any | null
  role: 'dono' | 'gerente' | 'atendente' | 'producao' | 'super_admin' | 'funcionario' | null
  assinatura_ativa: boolean
  is_admin_master: boolean
  permissions: {
    is_owner: boolean
    can_manage: boolean
    can_finance: boolean
    can_config: boolean
    can_products: boolean
    can_proposal: boolean
    can_subscription: boolean
    can_production?: boolean
  }
}

export async function getCurrentCompanyClient(): Promise<CurrentCompanyClientPayload> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    throw new Error('Você precisa estar logado.')
  }

  const response = await fetch('/api/company/current', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error || 'Erro ao carregar empresa atual.')
  }

  if (!payload.company?.id) {
    throw new Error('Empresa não encontrada.')
  }

  return payload as CurrentCompanyClientPayload
}

export async function getAccessTokenClient() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    throw new Error('Você precisa estar logado.')
  }

  return token
}

// Compatibilidade com páginas antigas/patches anteriores.
// Algumas páginas importavam getCurrentCompany. Mantemos o nome antigo
// apontando para a função nova para não quebrar build.
export async function getCurrentCompany(): Promise<CurrentCompanyClientPayload> {
  return getCurrentCompanyClient()
}

"@

[System.IO.File]::WriteAllText($target, $content, $utf8NoBom)

Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Compatibilidade getCurrentCompany corrigida." -ForegroundColor Green
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
