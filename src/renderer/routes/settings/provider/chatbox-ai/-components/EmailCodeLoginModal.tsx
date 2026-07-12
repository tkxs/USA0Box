import { Alert, Button, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import { IconShieldLock } from '@tabler/icons-react'
import { useCallback, useEffect } from 'react'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { Modal } from '@/components/layout/Overlay'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { useSub2APIOAuth } from './useSub2APIOAuth'

interface EmailCodeLoginModalProps {
  opened: boolean
  onClose: () => void
  language: string
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

export function EmailCodeLoginModal({ opened, onClose, onLoginSuccess }: EmailCodeLoginModalProps) {
  const oauth = useSub2APIOAuth({ onLoginSuccess })
  const siteName = useSub2APISiteName()

  const handleClose = useCallback(() => {
    oauth.reset()
    onClose()
  }, [oauth, onClose])

  useEffect(() => {
    if (oauth.loginState === 'success') handleClose()
  }, [handleClose, oauth.loginState])

  const oauthWaiting = oauth.loginState === 'waiting'
  const oauthStarting = oauth.loginState === 'starting'
  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="md"
      title={siteName ? `登录 ${siteName}` : '登录'}
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        <Text size="sm" c="chatbox-secondary">
          ZeroBox 将打开{siteName || '服务网站'}的安全授权页面。密码、Turnstile 和身份验证码只会提交给网站。
        </Text>

        {oauthWaiting && (
          <Paper withBorder p="md">
            <Group gap="sm" justify="center">
              <Loader size="sm" />
              <Text size="sm">等待你在浏览器中确认授权...</Text>
            </Group>
          </Paper>
        )}

        {oauth.loginError && (
          <Alert color="red" variant="light" title="网站授权失败">
            {oauth.loginError}
          </Alert>
        )}

        {oauthWaiting ? (
          <Button fullWidth variant="light" onClick={() => void oauth.cancel()}>
            取消授权
          </Button>
        ) : (
          <Button
            fullWidth
            loading={oauthStarting}
            disabled={oauthStarting}
            leftSection={!oauthStarting && <ScalableIcon icon={IconShieldLock} size={17} />}
            onClick={() => void oauth.start()}
          >
            打开{siteName ? ` ${siteName}` : '网站'}安全登录
          </Button>
        )}
      </Stack>
    </Modal>
  )
}
