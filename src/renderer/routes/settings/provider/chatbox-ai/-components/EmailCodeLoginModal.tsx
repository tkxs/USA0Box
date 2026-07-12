import { Alert, Button, Code, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { useCallback, useEffect } from 'react'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { Modal } from '@/components/layout/Overlay'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { useDeviceLogin } from './useDeviceLogin'

interface EmailCodeLoginModalProps {
  opened: boolean
  onClose: () => void
  language: string
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

export function EmailCodeLoginModal({ opened, onClose, onLoginSuccess }: EmailCodeLoginModalProps) {
  const login = useDeviceLogin({ onLoginSuccess })
  const siteName = useSub2APISiteName()

  const handleClose = useCallback(() => {
    login.reset()
    onClose()
  }, [login, onClose])

  useEffect(() => {
    if (login.loginState === 'success') handleClose()
  }, [handleClose, login.loginState])

  const waiting = login.loginState === 'waiting'
  const starting = login.loginState === 'starting'

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
          ZeroBox 将在浏览器中打开{siteName || '服务网站'}。请在网站完成登录和安全验证，然后确认授权此设备。
        </Text>

        {login.authorization && (
          <Paper withBorder p="md">
            <Stack gap="sm" align="center">
              <Text size="sm" c="dimmed">
                设备验证码
              </Text>
              <Code fz="xl" fw={700} p="sm">
                {login.authorization.userCode}
              </Code>
              {waiting && (
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="sm">等待你在网站确认授权...</Text>
                </Group>
              )}
            </Stack>
          </Paper>
        )}

        {login.loginError && (
          <Alert color="red" variant="light" title="设备授权失败">
            {login.loginError}
          </Alert>
        )}

        {waiting ? (
          <Button
            fullWidth
            variant="light"
            leftSection={<ScalableIcon icon={IconExternalLink} size={16} />}
            onClick={() => void login.openVerificationPage()}
          >
            重新打开授权页面
          </Button>
        ) : (
          <Button
            fullWidth
            loading={starting}
            disabled={starting}
            leftSection={!starting && <ScalableIcon icon={IconExternalLink} size={16} />}
            onClick={() => void login.start()}
          >
            打开{siteName ? ` ${siteName}` : '网站'}登录
          </Button>
        )}
      </Stack>
    </Modal>
  )
}
