export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'

export function criarSubdominioSeguro(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 42)
}

export function montarDominioEmpresa(slugOuSubdominio: string) {
  const subdomain = criarSubdominioSeguro(slugOuSubdominio)

  if (!subdomain) return ROOT_DOMAIN

  return `${subdomain}.${ROOT_DOMAIN}`
}

export function montarUrlEmpresa(slugOuSubdominio: string, path = '/') {
  const dominio = montarDominioEmpresa(slugOuSubdominio)
  const pathname = path.startsWith('/') ? path : `/${path}`

  return `https://${dominio}${pathname}`
}
