import { Button, Flex, Paper, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { IconArrowRight, IconServer } from '@tabler/icons-react'
import { forwardRef, useState } from 'react'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { getSub2APIGatewayUrl, getSub2APIWebUrl } from '@/packages/sub2api'
import { EmailCodeLoginModal } from './EmailCodeLoginModal'
import type { AuthTokens } from './types'

interface LoginViewProps {
  language: string
  saveAuthTokens: (tokens: AuthTokens) => Promise<void>
  onSwitchToLicenseKey: () => void
}

export const LoginView = forwardRef<HTMLDivElement, LoginViewProps>(
  ({ language, saveAuthTokens, onSwitchToLicenseKey }, ref) => {
    const [loginModalOpened, setLoginModalOpened] = useState(false)
    const siteName = useSub2APISiteName()

    return (
      <Stack gap="xl" ref={ref}>
        <Flex align="flex-start" justify="space-between" gap="md" wrap="wrap">
          <Stack gap="xs">
            <Flex gap="sm" align="center">
              <ScalableIcon icon={IconServer} size={28} className="text-chatbox-tint-brand" />
              <Title order={3} c="chatbox-primary">
                {siteName ? `${siteName} 账号` : '账号'}
              </Title>
            </Flex>
            <Text c="chatbox-tertiary">登录后加载账号、额度、订阅和 API Key 配置。</Text>
          </Stack>
          <UnstyledButton onClick={onSwitchToLicenseKey}>
            <Flex gap="xxs" align="center">
              <Text size="sm" c="chatbox-tertiary">
                使用 Chatbox 许可证密钥
              </Text>
              <ScalableIcon icon={IconArrowRight} size={16} className="text-chatbox-tint-brand" />
            </Flex>
          </UnstyledButton>
        </Flex>

        <Button fullWidth onClick={() => setLoginModalOpened(true)}>
          {siteName ? `登录 ${siteName}` : '登录'}
        </Button>

        <Paper p="sm" withBorder>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              服务连接
            </Text>
            <Text size="sm" c="chatbox-secondary">
              管理后台：{getSub2APIWebUrl()}
            </Text>
            <Text size="sm" c="chatbox-secondary">
              网关地址：{getSub2APIGatewayUrl()}
            </Text>
          </Stack>
        </Paper>

        <EmailCodeLoginModal
          opened={loginModalOpened}
          onClose={() => setLoginModalOpened(false)}
          language={language}
          onLoginSuccess={saveAuthTokens}
        />
      </Stack>
    )
  }
)

LoginView.displayName = 'LoginView'
