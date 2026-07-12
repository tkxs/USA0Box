import http from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loginToSub2API } from './oauth-client'

function sendCallback(redirectUri: string, code: string, state: string): Promise<void> {
  const url = new URL(redirectUri)
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
        headers: { Host: url.host },
      },
      (response) => {
        response.resume()
        response.on('end', resolve)
      }
    )
    request.on('error', reject)
  })
}

describe('SUB2API OAuth client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens the configured authorization endpoint and exchanges the code with PKCE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await loginToSub2API(async (authorizationUrl) => {
      const url = new URL(authorizationUrl)
      expect(url.origin + url.pathname).toBe('https://usa0.top/oauth/authorize')
      expect(url.searchParams.get('client_id')).toBe('zerobox-desktop')
      expect(url.searchParams.get('scope')).toBe(
        'openid profile:read groups:read keys:read keys:write subscriptions:read offline_access'
      )
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
      await sendCallback(
        url.searchParams.get('redirect_uri') || '',
        'authorization-code',
        url.searchParams.get('state') || ''
      )
    })

    expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [tokenUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(tokenUrl).toBe('https://usa0.top/api/v1/app-auth/token')
    expect(init.method).toBe('POST')
    const body = init.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('client_id')).toBe('zerobox-desktop')
    expect(body.get('code')).toBe('authorization-code')
    expect(body.get('code_verifier')).toBeTruthy()
    expect(body.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/)
  })

  it('rejects a token response without both credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'access' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    await expect(
      loginToSub2API(async (authorizationUrl) => {
        const url = new URL(authorizationUrl)
        await sendCallback(url.searchParams.get('redirect_uri') || '', 'code', url.searchParams.get('state') || '')
      })
    ).rejects.toThrow('missing credentials')
  })
})
