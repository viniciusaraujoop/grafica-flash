/** Only same-origin relative paths may be used after authentication. */
export function safeNextPath(rawNext?: string | null) {
  const fallback = '/painel/inicio'
  const next = String(rawNext || '').trim()
  let decoded = next
  try {
    for (let pass = 0; pass < 3; pass++) {
      const value = decodeURIComponent(decoded)
      if (value === decoded) break
      decoded = value
    }
  } catch { return fallback }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.includes('://')) return fallback
  if (['/login','/mfa','/cadastro'].some((path)=>decoded.startsWith(path))) return fallback
  const url = new URL(decoded, 'https://orcaly.invalid')
  if (url.origin !== 'https://orcaly.invalid') return fallback
  return next
}
