import { Alert, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useCallback } from 'react'
import { Modal } from '@/components/layout/Overlay'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { useLogin } from './useLogin'

interface EmailCodeLoginModalProps {
  opened: boolean
  onClose: () => void
  language: string
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

export function EmailCodeLoginModal({ opened, onClose, onLoginSuccess }: EmailCodeLoginModalProps) {
  const login = useLogin({ onLoginSuccess })
  const siteName = useSub2APISiteName()
  const submitting = login.loginState === 'submitting'

  const handleClose = useCallback(() => {
    login.reset()
    onClose()
  }, [login, onClose])

  const handleSubmit = useCallback(async () => {
    const success = login.requiresTwoFactor ? await login.verifyTwoFactor() : await login.submit()
    if (success) handleClose()
  }, [handleClose, login])

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="md"
      title={siteName ? `登录 ${siteName}` : '登录'}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md">
        <Text size="sm" c="chatbox-secondary">
          {login.requiresTwoFactor
            ? `请输入 6 位身份验证器验证码${login.maskedEmail ? `（账号 ${login.maskedEmail}）` : ''}。`
            : siteName
              ? `请输入你在 ${siteName} 服务中使用的账号和密码。`
              : '请输入服务账号和密码。'}
        </Text>

        {!login.requiresTwoFactor ? (
          <>
            <TextInput
              label="邮箱"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              value={login.email}
              onChange={(event) => login.setEmail(event.currentTarget.value)}
              disabled={submitting}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && login.canSubmit) void handleSubmit()
              }}
            />
            <PasswordInput
              label="密码"
              autoComplete="current-password"
              value={login.password}
              onChange={(event) => login.setPassword(event.currentTarget.value)}
              disabled={submitting}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && login.canSubmit) void handleSubmit()
              }}
            />
          </>
        ) : (
          <TextInput
            label="身份验证器验证码"
            value={login.totpCode}
            onChange={(event) => login.setTotpCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            disabled={submitting}
          />
        )}

        {login.loginError && (
          <Alert color="red" variant="light" title="登录失败">
            {login.loginError}
          </Alert>
        )}

        <Button
          fullWidth
          onClick={() => void handleSubmit()}
          loading={submitting}
          disabled={login.requiresTwoFactor ? !login.canVerifyTwoFactor : !login.canSubmit}
        >
          {login.requiresTwoFactor ? '验证并登录' : '登录'}
        </Button>
      </Stack>
    </Modal>
  )
}
