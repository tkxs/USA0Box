import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authInfoStore } from '@/stores/authInfoStore'
import {
  createSub2APIKey,
  exchangeSub2APIAuthorizationCode,
  getSub2APIAccountConfig,
  getSub2APIAvailableGroups,
  getSub2APIKeys,
  getSub2APIModels,
  getSub2APISiteName,
  pollSub2APIDeviceAuthorization,
  startSub2APIDeviceAuthorization,
} from './sub2api'

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('SUB2API client', () => {
  beforeEach(() => {
    authInfoStore.getState().clearTokens()
    vi.restoreAllMocks()
  })

  it('starts a device authorization and maps its browser verification details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          device_code: 'private-device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://usa0.top/device',
          verification_uri_complete: 'https://usa0.top/device?code=ABCD-EFGH',
          expires_in: 600,
          interval: 3,
        },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(startSub2APIDeviceAuthorization()).resolves.toEqual({
      deviceCode: 'private-device-code',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://usa0.top/device',
      verificationUriComplete: 'https://usa0.top/device?code=ABCD-EFGH',
      expiresIn: 600,
      interval: 3,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://usa0.top/api/v1/auth/device/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ client_name: 'ZeroBox' }),
      })
    )
  })

  it('keeps polling while the device authorization is pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { status: 'authorization_pending' } }, 202))
    )

    await expect(pollSub2APIDeviceAuthorization('private-device-code')).resolves.toEqual({ type: 'pending' })
  })

  it('maps an approved device authorization to the existing token pair', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          data: {
            status: 'approved',
            access_token: 'access-1',
            refresh_token: 'refresh-1',
            token_type: 'Bearer',
            user: { id: 1, email: 'admin@example.com', role: 'admin' },
          },
        })
      )
    )

    await expect(pollSub2APIDeviceAuthorization('private-device-code')).resolves.toMatchObject({
      type: 'authenticated',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { email: 'admin@example.com' },
    })
  })

  it('exchanges a PKCE authorization code using an OAuth form request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        token_type: 'Bearer',
        expires_in: 600,
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      exchangeSub2APIAuthorizationCode({
        clientId: 'zerobox-android',
        code: 'one-time-code',
        redirectUri: 'https://usa0.top/app/zerobox/callback',
        codeVerifier: 'verifier',
      })
    ).resolves.toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://usa0.top/api/v1/app-auth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: expect.stringContaining('grant_type=authorization_code'),
      })
    )
  })

  it('loads the configured site name from public settings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { site_name: ' USA-零 ' } })))

    await expect(getSub2APISiteName()).resolves.toBe('USA-零')
  })

  it('uses an empty site name when public settings do not provide one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} })))

    await expect(getSub2APISiteName()).resolves.toBe('')
  })

  it('loads profile, API keys, and subscriptions for the signed-in user', async () => {
    authInfoStore.getState().setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 1, email: 'admin@example.com' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { items: [{ id: 7, name: 'Desktop' }], total: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [{ id: 9, group_id: 2, status: 'active' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const config = await getSub2APIAccountConfig()
    expect(config.user.email).toBe('admin@example.com')
    expect(config.apiKeys).toHaveLength(1)
    expect(config.subscriptions).toHaveLength(1)
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe('Bearer access-1')
    }
  })

  it('loads the groups available to the signed-in user', async () => {
    authInfoStore.getState().setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    const groups = [
      {
        id: 1,
        name: 'default',
        description: null,
        platform: 'anthropic',
        rate_multiplier: 1,
        status: 'active',
        subscription_type: 'standard',
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: groups }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSub2APIAvailableGroups()).resolves.toEqual(groups)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://usa0.top/api/v1/app/groups',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
      })
    )
  })

  it('loads group-bound API keys for provider selection', async () => {
    authInfoStore.getState().setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    const keys = [
      {
        id: 7,
        key: 'sk-group-key',
        name: 'Desktop',
        group_id: 1,
        status: 'active',
        group: { id: 1, name: 'default', platform: 'anthropic' },
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { items: keys, total: 1 } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSub2APIKeys()).resolves.toEqual(keys)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://usa0.top/api/v1/app/keys?page=1&page_size=100',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
      })
    )
  })

  it('syncs models through the selected group API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
          { id: 'models/gemini-2.5-pro', display_name: 'Gemini 2.5 Pro' },
        ],
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSub2APIModels('sk-group-key')).resolves.toEqual([
      { modelId: 'claude-sonnet-4-6', nickname: 'Claude Sonnet 4.6', type: 'chat' },
      { modelId: 'gemini-2.5-pro', nickname: 'Gemini 2.5 Pro', type: 'chat' },
    ])
    expect(fetchMock).toHaveBeenCalledWith('https://usa0.top/v1/models', {
      method: 'GET',
      headers: { Authorization: 'Bearer sk-group-key' },
    })
  })

  it('creates an API key with the same minimal payload used by SUB2API', async () => {
    authInfoStore.getState().setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    const createdKey = {
      id: 12,
      key: 'sk-created',
      name: 'Chatbox',
      group_id: 1,
      status: 'active',
      quota: 0,
      quota_used: 0,
      expires_at: null,
      current_concurrency: 0,
      last_used_at: null,
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: createdKey }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createSub2APIKey({ name: ' Chatbox ', groupId: 1 })).resolves.toEqual(createdKey)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://usa0.top/api/v1/app/groups/1/keys',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
        body: JSON.stringify({ name: 'Chatbox' }),
      })
    )
  })

  it('refreshes an expired access token and retries the account request', async () => {
    authInfoStore.getState().setTokens({ accessToken: 'expired', refreshToken: 'refresh-1' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, message: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600, token_type: 'Bearer' })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 1, email: 'admin@example.com' } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { items: [], total: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSub2APIAccountConfig()).resolves.toMatchObject({ user: { email: 'admin@example.com' } })
    expect(authInfoStore.getState().getTokens()).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' })
  })
})
