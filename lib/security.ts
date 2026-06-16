export const RESERVED_SLUGS = [
  'admin',
  'administrador',
  'orcaly',
  'suporte',
  'support',
  'api',
  'painel',
  'dashboard',
  'login',
  'cadastro',
  'checkout',
  'assinatura',
  'proposta',
  'propostas',
  'root',
  'system',
  'sistema',
  'mercado-pago',
  'mercadopago',
  'www',
  'app',
  'assets',
  'static',
  'public',
  'private',
  'config',
  'settings',
  'security',
  'auth',
  'null',
  'undefined',
]

const RESERVED_NAME_PARTS = [
  'orcaly',
  'orçaly',
  'admin',
  'administrador',
  'suporte',
  'support',
  'sistema',
  'system',
  'root',
]

export function criarSlugSeguro(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 42)
}

export function validarSlugEmpresa(slug: string) {
  const erros: string[] = []
  const limpo = criarSlugSeguro(slug)

  if (limpo.length < 3) {
    erros.push('O endereço público precisa ter pelo menos 3 caracteres.')
  }

  if (limpo.length > 42) {
    erros.push('O endereço público precisa ter no máximo 42 caracteres.')
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(limpo)) {
    erros.push('Use apenas letras, números e hífen no endereço público.')
  }

  if (RESERVED_SLUGS.includes(limpo)) {
    erros.push('Esse nome público é reservado. Escolha outro.')
  }

  return {
    slug: limpo,
    valido: erros.length === 0,
    erros,
  }
}

export function validarNomeEmpresa(nome: string) {
  const erros: string[] = []
  const texto = nome.trim()
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (texto.length < 2) {
    erros.push('Informe um nome de empresa válido.')
  }

  if (texto.length > 80) {
    erros.push('O nome da empresa precisa ter no máximo 80 caracteres.')
  }

  if (RESERVED_NAME_PARTS.some((parte) => normalizado.includes(parte.replace('ç', 'c')))) {
    erros.push('Esse nome usa uma palavra reservada. Escolha outro nome para a empresa.')
  }

  if (/https?:\/\//i.test(texto) || texto.includes('@')) {
    erros.push('O nome da empresa não deve conter link ou e-mail.')
  }

  return {
    valido: erros.length === 0,
    erros,
  }
}

export function validarTextoCurto(valor: string, campo: string, max = 140) {
  const texto = valor.trim()
  const erros: string[] = []

  if (texto.length > max) {
    erros.push(`${campo} precisa ter no máximo ${max} caracteres.`)
  }

  if (/<script|javascript:|onerror=|onload=/i.test(texto)) {
    erros.push(`${campo} contém conteúdo não permitido.`)
  }

  return {
    valido: erros.length === 0,
    erros,
    texto,
  }
}

export function validarSenhaForte(senha: string) {
  return senha.length >= 8 && /[A-Z]/.test(senha) && /[a-zA-Z]/.test(senha) && /[^a-zA-Z0-9]/.test(senha)
}
