import { useCallback, useMemo, useState } from 'react'
import { completeSub2APITwoFactorLogin, loginToSub2API } from '@/packages/sub2api'

interface UseLoginParams {
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

export function useLogin({ onLoginSuccess }: UseLoginParams) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [tempToken, setTempToken] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [loginState, setLoginState] = useState<'idle' | 'submitting' | 'two-factor' | 'success' | 'error'>('idle')
  const [loginError, setLoginError] = useState('')

  const submit = useCallback(async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setLoginError('请输入邮箱和密码')
      setLoginState('error')
      return false
    }

    setLoginState('submitting')
    setLoginError('')
    try {
      const result = await loginToSub2API(normalizedEmail, password)
      if (result.type === 'two-factor') {
        setTempToken(result.tempToken)
        setMaskedEmail(result.userEmailMasked || '')
        setLoginState('two-factor')
        return false
      }
      await onLoginSuccess({ accessToken: result.accessToken, refreshToken: result.refreshToken })
      setLoginState('success')
      return true
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '登录失败')
      setLoginState('error')
      return false
    }
  }, [email, onLoginSuccess, password])

  const verifyTwoFactor = useCallback(async () => {
    if (!tempToken || totpCode.trim().length !== 6) return false

    setLoginState('submitting')
    setLoginError('')
    try {
      const result = await completeSub2APITwoFactorLogin(tempToken, totpCode.trim())
      await onLoginSuccess({ accessToken: result.accessToken, refreshToken: result.refreshToken })
      setLoginState('success')
      return true
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '两步验证失败')
      setLoginState('two-factor')
      return false
    }
  }, [onLoginSuccess, tempToken, totpCode])

  const reset = useCallback(() => {
    setEmail('')
    setPassword('')
    setTotpCode('')
    setTempToken('')
    setMaskedEmail('')
    setLoginState('idle')
    setLoginError('')
  }, [])

  return {
    email,
    setEmail,
    password,
    setPassword,
    totpCode,
    setTotpCode,
    maskedEmail,
    loginState,
    loginError,
    requiresTwoFactor: Boolean(tempToken),
    canSubmit: useMemo(
      () => Boolean(email.trim() && password && loginState !== 'submitting'),
      [email, password, loginState]
    ),
    canVerifyTwoFactor: totpCode.trim().length === 6 && loginState !== 'submitting',
    submit,
    verifyTwoFactor,
    reset,
  }
}
