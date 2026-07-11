import type { ProviderModelInfo } from '@shared/types'
import { authInfoStore } from '@/stores/authInfoStore'

const DEFAULT_SUB2API_API_BASE_URL = 'http://localhost:18080/api/v1'
const DEFAULT_SUB2API_WEB_URL = 'http://localhost:3000'

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

export type Sub2APILoginResult =
  | { type: 'authenticated'; accessToken: string; refreshToken: string; user: Sub2APIUser }
  | { type: 'two-factor'; tempToken: string; userEmailMasked?: string }

interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
  error?: { message?: string; detail?: string }
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type: string
  user: Sub2APIUser
}

interface TwoFactorResponse {
  requires_2fa: true
  temp_token: string
  user_email_masked?: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
}

interface Sub2APIPublicSettings {
  site_name?: string
}

function isTwoFactorResponse(result: TokenResponse | TwoFactorResponse): result is TwoFactorResponse {
  return 'requires_2fa' in result && result.requires_2fa === true
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

export async function getSub2APIModels(apiKey: string): Promise<ProviderModelInfo[]> {
  const response = await fetch(`${getSub2APIGatewayUrl()}/v1/models`, {
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
    .map((model) => ({
      modelId: (model.id || model.name || '').replace(/^models\//, ''),
      nickname: model.display_name,
      type: 'chat' as const,
    }))
    .filter((model) => !!model.modelId)
}

export async function getSub2APISiteName(): Promise<string> {
  const settings = await publicRequest<Sub2APIPublicSettings>('/settings/public')
  return settings.site_name?.trim() || ''
}

async function parseResponse<T>(response: Response): Promise<T> {
  let envelope: ApiEnvelope<T> | undefined
  try {
    envelope = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new Error(`服务请求失败（${response.status}）`)
  }

  if (!response.ok || envelope.success === false) {
    const message = envelope.error?.detail || envelope.error?.message || envelope.message
    throw new Error(message || `服务请求失败（${response.status}）`)
  }
  return envelope.data
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getSub2APIApiBaseUrl()}${path}`, {
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

  const result = await publicRequest<Omit<TokenResponse, 'user'>>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  })
  if (!result.refresh_token) throw new Error('服务未返回刷新令牌')

  const nextTokens = { accessToken: result.access_token, refreshToken: result.refresh_token }
  authInfoStore.getState().setTokens(nextTokens)
  return nextTokens
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

  const response = await fetch(`${getSub2APIApiBaseUrl()}${path}`, {
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

export async function loginToSub2API(email: string, password: string): Promise<Sub2APILoginResult> {
  const result = await publicRequest<TokenResponse | TwoFactorResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (isTwoFactorResponse(result)) {
    return { type: 'two-factor', tempToken: result.temp_token, userEmailMasked: result.user_email_masked }
  }
  if (!result.refresh_token) throw new Error('服务未返回刷新令牌')
  return {
    type: 'authenticated',
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    user: result.user,
  }
}

export async function completeSub2APITwoFactorLogin(tempToken: string, totpCode: string) {
  const result = await publicRequest<TokenResponse>('/auth/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ temp_token: tempToken, totp_code: totpCode }),
  })
  if (!result.refresh_token) throw new Error('服务未返回刷新令牌')
  return { accessToken: result.access_token, refreshToken: result.refresh_token, user: result.user }
}

export async function logoutFromSub2API() {
  const tokens = authInfoStore.getState().getTokens()
  if (!tokens) return
  await publicRequest('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: tokens.refreshToken }),
  }).catch(() => undefined)
}

export async function getSub2APIAccountConfig(): Promise<Sub2APIAccountConfig> {
  const [user, keys, subscriptions] = await Promise.all([
    authenticatedRequest<Sub2APIUser>('/auth/me'),
    authenticatedRequest<PaginatedResponse<Sub2APIKey>>('/keys?page=1&page_size=100'),
    authenticatedRequest<Sub2APISubscription[]>('/subscriptions'),
  ])
  return { user, apiKeys: keys.items, subscriptions }
}

export async function getSub2APIKeys(): Promise<Sub2APIKey[]> {
  const keys = await authenticatedRequest<PaginatedResponse<Sub2APIKey>>('/keys?page=1&page_size=100')
  return keys.items
}

export function getSub2APIAvailableGroups(): Promise<Sub2APIGroup[]> {
  return authenticatedRequest<Sub2APIGroup[]>('/groups/available')
}

export function createSub2APIKey(params: { name: string; groupId: number }): Promise<Sub2APIKey> {
  return authenticatedRequest<Sub2APIKey>('/keys', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name.trim(),
      group_id: params.groupId,
    }),
  })
}
