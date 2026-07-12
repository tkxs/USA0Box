import { useCallback, useRef, useState } from 'react'
import {
  pollSub2APIDeviceAuthorization,
  type Sub2APIDeviceAuthorization,
  startSub2APIDeviceAuthorization,
} from '@/packages/sub2api'
import platform from '@/platform'

interface UseDeviceLoginParams {
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

type DeviceLoginState = 'idle' | 'starting' | 'waiting' | 'success' | 'error'

function waitForNextPoll(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timeout = window.setTimeout(finish, milliseconds)
    signal.addEventListener('abort', finish, { once: true })
  })
}

export function useDeviceLogin({ onLoginSuccess }: UseDeviceLoginParams) {
  const [loginState, setLoginState] = useState<DeviceLoginState>('idle')
  const [loginError, setLoginError] = useState('')
  const [authorization, setAuthorization] = useState<Sub2APIDeviceAuthorization>()
  const abortControllerRef = useRef<AbortController>()

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = undefined
  }, [])

  const pollUntilComplete = useCallback(
    async (current: Sub2APIDeviceAuthorization, controller: AbortController) => {
      let intervalSeconds = current.interval
      const expiresAt = Date.now() + current.expiresIn * 1000

      while (!controller.signal.aborted && Date.now() < expiresAt) {
        await waitForNextPoll(intervalSeconds * 1000, controller.signal)
        if (controller.signal.aborted) return

        try {
          const result = await pollSub2APIDeviceAuthorization(current.deviceCode, controller.signal)
          if (result.type === 'pending') continue
          if (result.type === 'slow-down') {
            intervalSeconds += 5
            continue
          }
          if (result.type === 'denied') {
            setLoginError('你已拒绝本次设备授权，请重新发起登录。')
            setLoginState('error')
            return
          }
          if (result.type === 'expired') {
            setLoginError('设备验证码已过期，请重新发起登录。')
            setLoginState('error')
            return
          }

          await onLoginSuccess({ accessToken: result.accessToken, refreshToken: result.refreshToken })
          setLoginState('success')
          return
        } catch (error) {
          if (controller.signal.aborted) return
          setLoginError(error instanceof Error ? error.message : '检查设备授权状态失败')
          setLoginState('error')
          return
        }
      }

      if (!controller.signal.aborted) {
        setLoginError('设备验证码已过期，请重新发起登录。')
        setLoginState('error')
      }
    },
    [onLoginSuccess]
  )

  const openVerificationPage = useCallback(async () => {
    if (!authorization) return
    await platform.openLink(authorization.verificationUriComplete)
  }, [authorization])

  const start = useCallback(async () => {
    cancel()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoginState('starting')
    setLoginError('')
    setAuthorization(undefined)

    try {
      const result = await startSub2APIDeviceAuthorization(controller.signal)
      if (controller.signal.aborted) return
      setAuthorization(result)
      setLoginState('waiting')
      void platform.openLink(result.verificationUriComplete).catch(() => {
        if (!controller.signal.aborted) setLoginError('无法自动打开浏览器，请点击下方按钮重试。')
      })
      void pollUntilComplete(result, controller)
    } catch (error) {
      if (controller.signal.aborted) return
      setLoginError(error instanceof Error ? error.message : '无法发起设备授权')
      setLoginState('error')
    }
  }, [cancel, pollUntilComplete])

  const reset = useCallback(() => {
    cancel()
    setLoginState('idle')
    setLoginError('')
    setAuthorization(undefined)
  }, [cancel])

  return {
    loginState,
    loginError,
    authorization,
    start,
    openVerificationPage,
    reset,
  }
}
