import os from 'node:os'
import type { Sub2APIAuthResult } from '@shared/sub2api-auth'
import { generatePKCE, generateState } from '../oauth/pkce'
import { createLoopbackServer } from './loopback-server'

const CLIENT_ID = 'zerobox-desktop'
const AUTHORIZE_URL = 'https://usa0.top/oauth/authorize'
const TOKEN_URL = 'https://usa0.top/api/v1/app-auth/token'
const SCOPE = 'openid profile:read groups:read keys:read keys:write subscriptions:read offline_access'

interface TokenResponse {
  access_token?: unknown
  refresh_token?: unknown
}

export async function loginToSub2API(
  openUrl: (url: string) => Promise<void>,
  signal?: AbortSignal
): Promise<Required<Pick<Sub2APIAuthResult, 'accessToken' | 'refreshToken'>>> {
  const { verifier, challenge } = generatePKCE()
  const state = generateState()
  const callbackServer = await createLoopbackServer(state, signal)

  try {
    const authorizeUrl = new URL(AUTHORIZE_URL)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('client_id', CLIENT_ID)
    authorizeUrl.searchParams.set('redirect_uri', callbackServer.redirectUri)
    authorizeUrl.searchParams.set('scope', SCOPE)
    authorizeUrl.searchParams.set('code_challenge', challenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('state', state)
    authorizeUrl.searchParams.set('device_name', os.hostname().slice(0, 100))
    authorizeUrl.searchParams.set('platform', process.platform)

    await openUrl(authorizeUrl.toString())
    const { code } = await callbackServer.waitForCallback

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code,
        code_verifier: verifier,
        redirect_uri: callbackServer.redirectUri,
      }),
      signal,
    })

    if (!response.ok) {
      throw new Error(`SUB2API token exchange failed (${response.status})`)
    }
    const tokens = (await response.json()) as TokenResponse
    if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string') {
      throw new Error('SUB2API token response is missing credentials')
    }

    return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token }
  } finally {
    callbackServer.close()
  }
}
