import { usesOpenAIResponsesTransport } from '@shared/providers/utils'
import type { ProviderModelInfo } from '@shared/types'
import platform from '@/platform'
import { authInfoStore } from '@/stores/authInfoStore'
import { fetchCrossPlatform } from '@/utils/request'

const DEFAULT_SUB2API_API_BASE_URL = 'https://usa0.top/api/v1'
const DEFAULT_SUB2API_WEB_URL = 'https://usa0.top'

export interface Sub2APIUser {
  id: number
  email: string
  username: string
  role: 'admin' | 'user'
  balance: number
  frozen_balance?: number
  concurrency: number
  rpm_limit?: number
  status: 'active' | 'disabled'
  allowed_groups: number[] | null
  created_at: string
  last_active_at?: string | null
  run_mode?: 'standard' | 'simple'
}

export interface Sub2APIKey {
  id: number
  key: string
  name: string
  group_id: number | null
  status: 'active' | 'inactive' | 'disabled' | 'quota_exhausted' | 'expired'
  quota: number
  quota_used: number
  expires_at: string | null
  current_concurrency: number
  last_used_at: string | null
  group?: Sub2APIGroup
}

export interface Sub2APIGroup {
  id: number
  name: string
  description: string | null
  platform: 'anthropic' | 'openai' | 'gemini' | 'antigravity' | 'grok'
  rate_multiplier: number
  user_rate_multiplier?: number
  effective_rate_multiplier?: number
  status: 'active' | 'inactive'
  subscription_type: 'standard' | 'subscription'
}

export interface Sub2APISubscription {
  id: number
  group_id: number
  status: 'active' | 'expired' | 'revoked' | 'suspended'
  starts_at: string
  expires_at: string | null
  daily_usage_usd: number
  weekly_usage_usd: number
  monthly_usage_usd: number
  group?: { id: number; name: string }
}

export interface Sub2APIAccountConfig {
  user: Sub2APIUser
  apiKeys: Sub2APIKey[]
  subscriptions: Sub2APISubscription[]
}

export interface Sub2APIDeviceAuthorization {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string
  expiresIn: number
  interval: number
}

export type Sub2APIDeviceTokenResult =
  | { type: 'pending' }
  | { type: 'slow-down' }
  | { type: 'denied' }
  | { type: 'expired' }
  | { type: 'authenticated'; accessToken: string; refreshToken: string; user: Sub2APIUser }

export interface Sub2APIOAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn?: number
  scope?: string
  tokenType?: 'Bearer' | 'DPoP'
}

interface ApiEnvelope<T> {
  success?: boolean
  code?: number
  data: T
  message?: string
  error?: { code?: string; message?: string; detail?: string }
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type: string
  user: Sub2APIUser
}

interface DeviceAuthorizationResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

interface DeviceTokenResponse extends Partial<TokenResponse> {
  status?: 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token' | 'approved'
}

interface OAuthTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: 'Bearer' | 'DPoP'
  error?: string
  error_description?: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
}

export interface Sub2APIPublicSettings {
  site_name?: string
  turnstile_enabled?: boolean
  turnstile_site_key?: string
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/\/+$/, '')
}

export function getSub2APIApiBaseUrl() {
  return normalizeBaseUrl(import.meta.env.VITE_SUB2API_API_BASE_URL, DEFAULT_SUB2API_API_BASE_URL)
}

export function getSub2APIWebUrl() {
  return normalizeBaseUrl(import.meta.env.VITE_SUB2API_WEB_URL, DEFAULT_SUB2API_WEB_URL)
}

export function getSub2APIGatewayUrl() {
  return getSub2APIApiBaseUrl().replace(/\/api\/v1$/, '')
}

export function inferSub2APIModelApiStyle(modelId: string): 'openai-responses' | undefined {
  return usesOpenAIResponsesTransport({ modelId }) ? 'openai-responses' : undefined
}

export async function getSub2APIModels(apiKey: string): Promise<ProviderModelInfo[]> {
  const response = await fetchCrossPlatform(`${getSub2APIGatewayUrl()}/v1/models`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const payload = (await response.json().catch(() => undefined)) as
    | {
        data?: Array<{ id?: string; name?: string; display_name?: string }>
        error?: { message?: string }
        message?: string
      }
    | undefined
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `模型同步失败（${response.status}）`)
  }
  return (payload?.data || [])
    .map((model) => {
      const modelId = (model.id || model.name || '').replace(/^models\//, '')
      return {
        modelId,
        nickname: model.display_name,
        type: 'chat' as const,
        apiStyle: inferSub2APIModelApiStyle(modelId),
      }
    })
    .filter((model) => !!model.modelId)
}

export function getSub2APIPublicSettings(): Promise<Sub2APIPublicSettings> {
  return publicRequest<Sub2APIPublicSettings>('/settings/public')
}

export async function getSub2APISiteName(): Promise<string> {
  const settings = await getSub2APIPublicSettings()
  return settings.site_name?.trim() || ''
}

async function parseResponse<T>(response: Response): Promise<T> {
  let envelope: ApiEnvelope<T> | undefined
  try {
    envelope = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new Error(`服务请求失败（${response.status}）`)
  }

  if (!response.ok || envelope.success === false || (typeof envelope.code === 'number' && envelope.code !== 0)) {
    const message = envelope.error?.detail || envelope.error?.message || envelope.message
    throw new Error(message || `服务请求失败（${response.status}）`)
  }
  return envelope.data
}

export function getSub2APIGroupRateMultiplier(group: Sub2APIGroup): number {
  return group.effective_rate_multiplier ?? group.user_rate_multiplier ?? group.rate_multiplier
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchCrossPlatform(`${getSub2APIApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  return parseResponse<T>(response)
}

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null

async function refreshTokens() {
  const tokens = authInfoStore.getState().getTokens()
  if (!tokens) throw new Error('登录会话不存在')

  const response = await fetchCrossPlatform(`${getSub2APIApiBaseUrl()}/app-auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: await getSub2APIOAuthClientId(),
      refresh_token: tokens.refreshToken,
    }).toString(),
  })
  const result = (await response.json().catch(() => undefined)) as OAuthTokenResponse | undefined
  if (!response.ok || !result || result.error) {
    throw new Error(result?.error_description || result?.error || `登录会话刷新失败（${response.status}）`)
  }
  if (!result.refresh_token) throw new Error('服务未返回刷新令牌')
  if (!result.access_token) throw new Error('服务未返回访问令牌')

  const nextTokens = { accessToken: result.access_token, refreshToken: result.refresh_token }
  authInfoStore.getState().setTokens(nextTokens)
  return nextTokens
}

async function getSub2APIOAuthClientId() {
  if (platform.type === 'desktop') return 'zerobox-desktop'
  if (platform.type === 'mobile') return (await platform.getPlatform()) === 'ios' ? 'zerobox-ios' : 'zerobox-android'
  return 'zerobox-web'
}

function refreshTokensOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshTokens().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function authenticatedRequest<T>(path: string, init?: RequestInit, canRetry = true): Promise<T> {
  const tokens = authInfoStore.getState().getTokens()
  if (!tokens) throw new Error('请先登录')

  const response = await fetchCrossPlatform(`${getSub2APIApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
      ...init?.headers,
    },
  })

  if (response.status === 401 && canRetry) {
    try {
      await refreshTokensOnce()
      return authenticatedRequest<T>(path, init, false)
    } catch (error) {
      authInfoStore.getState().clearTokens()
      throw error
    }
  }
  return parseResponse<T>(response)
}

export async function startSub2APIDeviceAuthorization(signal?: AbortSignal): Promise<Sub2APIDeviceAuthorization> {
  const result = await publicRequest<DeviceAuthorizationResponse>('/auth/device/start', {
    method: 'POST',
    body: JSON.stringify({ client_name: 'ZeroBox' }),
    signal,
  })

  return {
    deviceCode: result.device_code,
    userCode: result.user_code,
    verificationUri: result.verification_uri,
    verificationUriComplete: result.verification_uri_complete || result.verification_uri,
    expiresIn: result.expires_in,
    interval: Math.max(result.interval || 3, 1),
  }
}

function deviceStatusFromCode(code?: string): Sub2APIDeviceTokenResult | undefined {
  switch (code) {
    case 'authorization_pending':
      return { type: 'pending' }
    case 'slow_down':
      return { type: 'slow-down' }
    case 'access_denied':
      return { type: 'denied' }
    case 'expired_token':
      return { type: 'expired' }
    default:
      return undefined
  }
}

export async function pollSub2APIDeviceAuthorization(
  deviceCode: string,
  signal?: AbortSignal
): Promise<Sub2APIDeviceTokenResult> {
  const response = await fetchCrossPlatform(`${getSub2APIApiBaseUrl()}/auth/device/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
    signal,
  })

  let envelope: ApiEnvelope<DeviceTokenResponse> | undefined
  try {
    envelope = (await response.json()) as ApiEnvelope<DeviceTokenResponse>
  } catch {
    throw new Error(`设备授权请求失败（${response.status}）`)
  }

  const statusResult = deviceStatusFromCode(envelope.data?.status || envelope.error?.code)
  if (statusResult) return statusResult

  if (!response.ok || envelope.success === false) {
    throw new Error(envelope.error?.detail || envelope.error?.message || envelope.message || '设备授权请求失败')
  }

  const result = envelope.data
  if (!result?.access_token || !result.refresh_token || !result.user) {
    throw new Error('设备授权服务未返回完整的登录令牌')
  }
  return {
    type: 'authenticated',
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    user: result.user,
  }
}

export async function exchangeSub2APIAuthorizationCode(params: {
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
  signal?: AbortSignal
}): Promise<Sub2APIOAuthTokens> {
  const response = await fetchCrossPlatform(`${getSub2APIApiBaseUrl()}/app-auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }).toString(),
    signal: params.signal,
  })
  const result = (await response.json().catch(() => undefined)) as OAuthTokenResponse | undefined
  if (!response.ok || result?.error) {
    throw new Error(result?.error_description || result?.error || `授权令牌交换失败（${response.status}）`)
  }
  if (!result?.access_token || !result.refresh_token) {
    throw new Error('授权服务未返回完整的登录令牌')
  }
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires_in,
    scope: result.scope,
    tokenType: result.token_type,
  }
}

export async function logoutFromSub2API() {
  const tokens = authInfoStore.getState().getTokens()
  if (!tokens) return
  await fetchCrossPlatform(`${getSub2APIApiBaseUrl()}/app-auth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: tokens.refreshToken, token_type_hint: 'refresh_token' }).toString(),
  }).catch(() => undefined)
}

export async function getSub2APIAccountConfig(): Promise<Sub2APIAccountConfig> {
  const [user, keys, subscriptions] = await Promise.all([
    authenticatedRequest<Sub2APIUser>('/app/me'),
    authenticatedRequest<PaginatedResponse<Sub2APIKey>>('/app/keys?page=1&page_size=100'),
    authenticatedRequest<Sub2APISubscription[]>('/app/subscriptions'),
  ])
  return { user, apiKeys: keys.items, subscriptions }
}

export async function getSub2APIKeys(): Promise<Sub2APIKey[]> {
  const keys = await authenticatedRequest<PaginatedResponse<Sub2APIKey>>('/app/keys?page=1&page_size=100')
  return keys.items
}

export function getSub2APIAvailableGroups(): Promise<Sub2APIGroup[]> {
  return authenticatedRequest<Sub2APIGroup[]>('/app/groups')
}

export function createSub2APIKey(params: { name: string; groupId: number }): Promise<Sub2APIKey> {
  return authenticatedRequest<Sub2APIKey>(`/app/groups/${params.groupId}/keys`, {
    method: 'POST',
    body: JSON.stringify({
      name: params.name.trim(),
    }),
  })
}
