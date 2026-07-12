import { Alert, Button, Code, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import { IconExternalLink, IconShieldLock } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { Modal } from '@/components/layout/Overlay'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { useDeviceLogin } from './useDeviceLogin'
import { useSub2APIOAuth } from './useSub2APIOAuth'

interface EmailCodeLoginModalProps {
  opened: boolean
  onClose: () => void
  language: string
  onLoginSuccess: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>
}

export function EmailCodeLoginModal({ opened, onClose, onLoginSuccess }: EmailCodeLoginModalProps) {
  const [mode, setMode] = useState<'oauth' | 'device'>('oauth')
  const oauth = useSub2APIOAuth({ onLoginSuccess })
  const device = useDeviceLogin({ onLoginSuccess })
  const siteName = useSub2APISiteName()

  const handleClose = useCallback(() => {
    oauth.reset()
    device.reset()
    setMode('oauth')
    onClose()
  }, [device, oauth, onClose])

  useEffect(() => {
    if (oauth.loginState === 'success' || device.loginState === 'success') handleClose()
  }, [device.loginState, handleClose, oauth.loginState])

  const oauthWaiting = oauth.loginState === 'waiting'
  const oauthStarting = oauth.loginState === 'starting'
  const deviceWaiting = device.loginState === 'waiting'
  const deviceStarting = device.loginState === 'starting'

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      size="md"
      title={siteName ? `登录 ${siteName}` : '登录'}
      closeOnClickOutside={false}
    >
      {mode === 'oauth' ? (
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

          <Button
            fullWidth
            variant="subtle"
            color="gray"
            disabled={oauthStarting || oauthWaiting}
            onClick={() => {
              oauth.reset()
              setMode('device')
            }}
          >
            使用设备验证码登录
          </Button>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="chatbox-secondary">
            设备验证码适用于系统浏览器无法自动返回 ZeroBox 的情况。请在网站完成登录后确认授权。
          </Text>

          {device.authorization && (
            <Paper withBorder p="md">
              <Stack gap="sm" align="center">
                <Text size="sm" c="dimmed">
                  设备验证码
                </Text>
                <Code fz="xl" fw={700} p="sm">
                  {device.authorization.userCode}
                </Code>
                {deviceWaiting && (
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm">等待你在网站确认授权...</Text>
                  </Group>
                )}
              </Stack>
            </Paper>
          )}

          {device.loginError && (
            <Alert color="red" variant="light" title="设备授权失败">
              {device.loginError}
            </Alert>
          )}

          {deviceWaiting ? (
            <Button
              fullWidth
              variant="light"
              leftSection={<ScalableIcon icon={IconExternalLink} size={16} />}
              onClick={() => void device.openVerificationPage()}
            >
              重新打开授权页面
            </Button>
          ) : (
            <Button
              fullWidth
              loading={deviceStarting}
              disabled={deviceStarting}
              leftSection={!deviceStarting && <ScalableIcon icon={IconExternalLink} size={16} />}
              onClick={() => void device.start()}
            >
              获取设备验证码
            </Button>
          )}

          <Button
            fullWidth
            variant="subtle"
            color="gray"
            disabled={deviceStarting || deviceWaiting}
            onClick={() => {
              device.reset()
              setMode('oauth')
            }}
          >
            返回安全登录
          </Button>
        </Stack>
      )}
    </Modal>
  )
}
