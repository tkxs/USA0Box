import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSub2APIAuthorizeUrl,
  createSub2APIOAuthTransaction,
  parseSub2APIOAuthCallback,
  SUB2API_MOBILE_REDIRECT_URI,
} from './sub2api-oauth'

describe('SUB2API OAuth client', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', globalThis.crypto)
  })

  it('creates an S256 PKCE transaction and authorization URL', async () => {
    const { transaction, codeChallenge } = await createSub2APIOAuthTransaction({
      clientId: 'zerobox-android',
      redirectUri: SUB2API_MOBILE_REDIRECT_URI,
    })
    const url = new URL(
      buildSub2APIAuthorizeUrl({ transaction, codeChallenge, deviceName: 'Pixel', platform: 'android' })
    )

    expect(transaction.codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(transaction.state.length).toBeGreaterThanOrEqual(32)
    expect(url.origin + url.pathname).toBe('https://usa0.top/oauth/authorize')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe(codeChallenge)
    expect(url.searchParams.get('state')).toBe(transaction.state)
    expect(url.searchParams.get('redirect_uri')).toBe('zerobox://oauth/callback')
  })

  it('accepts only the claimed HTTPS callback and explicit fallback scheme', () => {
    expect(parseSub2APIOAuthCallback('https://usa0.top/app/zerobox/callback?code=code-1&state=state-1')).toMatchObject({
      code: 'code-1',
      state: 'state-1',
    })
    expect(parseSub2APIOAuthCallback('zerobox://oauth/callback?error=access_denied')).toMatchObject({
      error: 'access_denied',
    })
    expect(() => parseSub2APIOAuthCallback('https://evil.example/app/zerobox/callback?code=stolen')).toThrow(
      '无效的 ZeroBox 授权回调地址'
    )
    expect(() => parseSub2APIOAuthCallback('https://usa0.top:444/app/zerobox/callback?code=stolen')).toThrow()
    expect(() => parseSub2APIOAuthCallback('https://user@usa0.top/app/zerobox/callback?code=stolen')).toThrow()
  })
})
