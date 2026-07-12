import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage'
import type { ElectronIPC } from '@shared/electron-types'
import { Sub2APIAuthIpcChannels, type Sub2APIAuthResult } from '@shared/sub2api-auth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { exchangeSub2APIAuthorizationCode } from '@/packages/sub2api'
import {
  buildSub2APIAuthorizeUrl,
  createSub2APIOAuthTransaction,
  parseSub2APIOAuthCallback,
  SUB2API_MOBILE_REDIRECT_URI,
  type Sub2APIOAuthTransaction,
} from '@/packages/sub2api-oauth'
import platform from '@/platform'

interface UseSub2APIOAuthParams {
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

type OAuthLoginState = 'idle' | 'starting' | 'waiting' | 'success' | 'error'

const TRANSACTION_STORAGE_KEY = 'sub2api-oauth-transaction'
const SECURE_STORAGE_PREFIX = 'zerobox_'

async function saveMobileTransaction(transaction: Sub2APIOAuthTransaction) {
  await SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX)
  await SecureStorage.set(
    TRANSACTION_STORAGE_KEY,
    { ...transaction },
    true,
    false,
    KeychainAccess.whenUnlockedThisDeviceOnly
  )
}

async function loadMobileTransaction() {
  await SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX)
  return (await SecureStorage.get(TRANSACTION_STORAGE_KEY)) as unknown as Sub2APIOAuthTransaction | null
}

async function clearMobileTransaction() {
  await SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX)
  await SecureStorage.remove(TRANSACTION_STORAGE_KEY)
}

export function useSub2APIOAuth({ onLoginSuccess }: UseSub2APIOAuthParams) {
  const [loginState, setLoginState] = useState<OAuthLoginState>('idle')
  const [loginError, setLoginError] = useState('')
  const abortControllerRef = useRef<AbortController>()
  const transactionRef = useRef<Sub2APIOAuthTransaction>()
  const transactionTimeoutRef = useRef<number>()

  const completeMobileCallback = useCallback(
    async (callbackUrl: string) => {
      if (platform.type !== 'mobile') return
      const controller = abortControllerRef.current || new AbortController()
      abortControllerRef.current = controller

      try {
        const callback = parseSub2APIOAuthCallback(callbackUrl)
        const transaction = transactionRef.current || (await loadMobileTransaction())
        if (!transaction) return
        if (transaction.expiresAt <= Date.now()) throw new Error('授权请求已过期，请重新登录。')
        if (!callback.state || callback.state !== transaction.state) {
          setLoginError('已忽略一个授权状态不匹配的回调。')
          setLoginState('waiting')
          return
        }
        if (callback.error) throw new Error(callback.errorDescription || `授权失败：${callback.error}`)
        if (!callback.code) throw new Error('授权回调缺少一次性授权码。')

        const tokens = await exchangeSub2APIAuthorizationCode({
          clientId: transaction.clientId,
          code: callback.code,
          redirectUri: transaction.redirectUri,
          codeVerifier: transaction.codeVerifier,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        await clearMobileTransaction()
        if (transactionTimeoutRef.current) window.clearTimeout(transactionTimeoutRef.current)
        transactionTimeoutRef.current = undefined
        transactionRef.current = undefined
        await onLoginSuccess({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
        setLoginState('success')
      } catch (error) {
        if (controller.signal.aborted) return
        await clearMobileTransaction().catch(() => undefined)
        if (transactionTimeoutRef.current) window.clearTimeout(transactionTimeoutRef.current)
        transactionTimeoutRef.current = undefined
        transactionRef.current = undefined
        setLoginError(error instanceof Error ? error.message : '无法完成网站授权')
        setLoginState('error')
      }
    },
    [onLoginSuccess]
  )

  useEffect(() => {
    return platform.onSub2APIOAuthCallback?.((url) => {
      void completeMobileCallback(url)
    })
  }, [completeMobileCallback])

  const cancel = useCallback(async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = undefined
    transactionRef.current = undefined
    if (transactionTimeoutRef.current) window.clearTimeout(transactionTimeoutRef.current)
    transactionTimeoutRef.current = undefined
    if (platform.type === 'desktop') {
      await (platform as typeof platform & { ipc: ElectronIPC }).ipc
        .invoke(Sub2APIAuthIpcChannels.CANCEL)
        .catch(() => undefined)
    } else if (platform.type === 'mobile') {
      await clearMobileTransaction().catch(() => undefined)
    }
    setLoginState('idle')
    setLoginError('')
  }, [])

  const start = useCallback(async () => {
    await cancel()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoginState('starting')
    setLoginError('')

    try {
      if (platform.type === 'desktop') {
        setLoginState('waiting')
        const rawResult = await (platform as typeof platform & { ipc: ElectronIPC }).ipc.invoke(
          Sub2APIAuthIpcChannels.LOGIN
        )
        const result = (typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult) as Sub2APIAuthResult
        if (!result.success || !result.accessToken || !result.refreshToken) {
          throw new Error(result.error || '桌面授权未返回完整的登录令牌')
        }
        if (controller.signal.aborted) return
        await onLoginSuccess({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        })
        setLoginState('success')
        return
      }

      if (platform.type !== 'mobile') throw new Error('当前平台暂不支持浏览器授权，请使用设备验证码登录。')

      const platformName = await platform.getPlatform()
      const clientId = platformName === 'ios' ? 'zerobox-ios' : 'zerobox-android'
      const { transaction, codeChallenge } = await createSub2APIOAuthTransaction({
        clientId,
        redirectUri: SUB2API_MOBILE_REDIRECT_URI,
      })
      transactionRef.current = transaction
      await saveMobileTransaction(transaction)
      transactionTimeoutRef.current = window.setTimeout(
        () => {
          if (transactionRef.current?.state !== transaction.state) return
          transactionRef.current = undefined
          void clearMobileTransaction()
          setLoginError('授权请求已过期，请重新登录。')
          setLoginState('error')
        },
        Math.max(transaction.expiresAt - Date.now(), 0)
      )
      const authorizeUrl = buildSub2APIAuthorizeUrl({
        transaction,
        codeChallenge,
        deviceName: await platform.getDeviceName(),
        platform: platformName,
      })
      setLoginState('waiting')
      await platform.openLink(authorizeUrl)
    } catch (error) {
      if (controller.signal.aborted) return
      setLoginError(error instanceof Error ? error.message : '无法发起网站授权')
      setLoginState('error')
    }
  }, [cancel, onLoginSuccess])

  const reset = useCallback(() => {
    void cancel()
    setLoginState('idle')
    setLoginError('')
  }, [cancel])

  return { loginState, loginError, start, cancel, reset }
}
