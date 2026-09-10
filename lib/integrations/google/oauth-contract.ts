export const GOOGLE_OAUTH_PROVIDER_KEYS = [
  'google_calendar',
  'google_drive',
  'google_sheets',
  'gmail',
  'google_business',
] as const

const identityScopes = ['openid', 'email'] as const
const scopeMap: Record<(typeof GOOGLE_OAUTH_PROVIDER_KEYS)[number], readonly string[]> = {
  google_calendar: [...identityScopes, 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events'],
  google_drive: [...identityScopes, 'https://www.googleapis.com/auth/drive.file'],
  google_sheets: [...identityScopes, 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
  gmail: [...identityScopes, 'https://www.googleapis.com/auth/gmail.metadata', 'https://www.googleapis.com/auth/gmail.send'],
  google_business: [...identityScopes, 'https://www.googleapis.com/auth/business.manage'],
}

export function isGoogleOAuthProviderKey(provider: string): provider is (typeof GOOGLE_OAUTH_PROVIDER_KEYS)[number] {
  return (GOOGLE_OAUTH_PROVIDER_KEYS as readonly string[]).includes(provider)
}

export function googleScopesForProviderKey(provider: string) {
  if (!isGoogleOAuthProviderKey(provider)) return null
  return [...scopeMap[provider]]
}

export function buildGoogleAuthorizationUrl(input: {
  config: { clientId: string; redirectUri: string }
  state: string
  scopes: readonly string[]
  pkceChallenge: string
}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', input.config.clientId)
  url.searchParams.set('redirect_uri', input.config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', input.scopes.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.pkceChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}
