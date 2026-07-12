const SUB2API_AUTHORIZE_URL = 'https://usa0.top/oauth/authorize'
export const SUB2API_MOBILE_REDIRECT_URI = 'https://usa0.top/app/zerobox/callback'
export const SUB2API_OAUTH_SCOPE =
  'openid profile:read groups:read keys:read keys:write subscriptions:read offline_access'

export interface Sub2APIOAuthTransaction {
  clientId: string
  redirectUri: string
  state: string
  codeVerifier: string
  expiresAt: number
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export async function createSub2APIOAuthTransaction(params: {
  clientId: string
  redirectUri: string
}): Promise<{ transaction: Sub2APIOAuthTransaction; codeChallenge: string }> {
  const codeVerifier = randomBase64Url(32)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return {
    transaction: {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      state: randomBase64Url(24),
      codeVerifier,
      expiresAt: Date.now() + 5 * 60 * 1000,
    },
    codeChallenge: base64UrlEncode(new Uint8Array(digest)),
  }
}

export function buildSub2APIAuthorizeUrl(params: {
  transaction: Sub2APIOAuthTransaction
  codeChallenge: string
  deviceName: string
  platform: string
}) {
  const url = new URL(SUB2API_AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.transaction.clientId)
  url.searchParams.set('redirect_uri', params.transaction.redirectUri)
  url.searchParams.set('scope', SUB2API_OAUTH_SCOPE)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', params.transaction.state)
  url.searchParams.set('device_name', params.deviceName.slice(0, 100))
  url.searchParams.set('platform', params.platform.slice(0, 32))
  return url.toString()
}

export function parseSub2APIOAuthCallback(callbackUrl: string) {
  if (callbackUrl.length > 4096) throw new Error('无效的 ZeroBox 授权回调地址')
  const url = new URL(callbackUrl)
  const isClaimedHttpsCallback =
    url.origin === 'https://usa0.top' &&
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/app/zerobox/callback' &&
    url.hash === ''
  const isFallbackCallback =
    url.protocol === 'zerobox:' &&
    url.hostname === 'oauth' &&
    url.username === '' &&
    url.password === '' &&
    url.pathname === '/callback' &&
    url.hash === ''
  if (!isClaimedHttpsCallback && !isFallbackCallback) throw new Error('无效的 ZeroBox 授权回调地址')

  return {
    code: url.searchParams.get('code') || '',
    state: url.searchParams.get('state') || '',
    error: url.searchParams.get('error') || '',
    errorDescription: url.searchParams.get('error_description') || '',
  }
}
