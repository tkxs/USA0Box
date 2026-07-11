import { Alert, Badge, Button, Divider, Flex, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { IconExternalLink, IconKey, IconLogout, IconRefresh, IconServer, IconUser } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { forwardRef } from 'react'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { getSub2APIAccountConfig, getSub2APIGatewayUrl, getSub2APIWebUrl, type Sub2APIKey } from '@/packages/sub2api'
import platform from '@/platform'
import { QuickCreateApiKey } from './QuickCreateApiKey'

interface LoggedInViewProps {
  onLogout: () => void
  onSwitchToLicenseKey: () => void
  language: string
  onShowLicenseSelectionModal?: unknown
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`
}

function maskKey(apiKey: Sub2APIKey) {
  if (!apiKey.key) return '服务端已隐藏'
  if (apiKey.key.length <= 12) return `${apiKey.key.slice(0, 4)}...`
  return `${apiKey.key.slice(0, 8)}...${apiKey.key.slice(-4)}`
}

const roleLabels = { admin: '管理员', user: '用户' } as const
const userStatusLabels = { active: '正常', disabled: '已禁用' } as const
const apiKeyStatusLabels = {
  active: '正常',
  inactive: '已停用',
  disabled: '已停用',
  quota_exhausted: '额度已用完',
  expired: '已过期',
} as const
const subscriptionStatusLabels = {
  active: '正常',
  expired: '已过期',
  revoked: '已撤销',
  suspended: '已暂停',
} as const

export const LoggedInView = forwardRef<HTMLDivElement, LoggedInViewProps>(({ onLogout, onSwitchToLicenseKey }, ref) => {
  const siteName = useSub2APISiteName()
  const accountQuery = useQuery({
    queryKey: ['sub2apiAccountConfig'],
    queryFn: getSub2APIAccountConfig,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const config = accountQuery.data
  return (
    <Stack gap="xl" ref={ref}>
      <Flex justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap="xs">
          <Flex gap="sm" align="center">
            <ScalableIcon icon={IconServer} size={28} className="text-chatbox-tint-brand" />
            <Title order={3}>{siteName ? `${siteName} 账号` : '账号'}</Title>
          </Flex>
          <Text c="chatbox-tertiary">{config?.user.email || '正在加载账号...'}</Text>
        </Stack>
        <Group gap="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconRefresh size={16} />}
            loading={accountQuery.isFetching}
            onClick={() => void accountQuery.refetch()}
          >
            刷新
          </Button>
          <Button variant="subtle" color="red" size="xs" leftSection={<IconLogout size={16} />} onClick={onLogout}>
            退出登录
          </Button>
        </Group>
      </Flex>

      {accountQuery.error && (
        <Alert color="red" title={siteName ? `无法加载 ${siteName} 配置` : '无法加载配置'}>
          {accountQuery.error instanceof Error ? accountQuery.error.message : '未知请求错误'}
        </Alert>
      )}

      {config && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Paper p="sm" withBorder>
              <Text size="xs" c="chatbox-tertiary">
                余额
              </Text>
              <Text fw={600}>{formatMoney(config.user.balance)}</Text>
            </Paper>
            <Paper p="sm" withBorder>
              <Text size="xs" c="chatbox-tertiary">
                并发数
              </Text>
              <Text fw={600}>{config.user.concurrency}</Text>
            </Paper>
            <Paper p="sm" withBorder>
              <Text size="xs" c="chatbox-tertiary">
                角色
              </Text>
              <Text fw={600}>{roleLabels[config.user.role]}</Text>
            </Paper>
            <Paper p="sm" withBorder>
              <Text size="xs" c="chatbox-tertiary">
                状态
              </Text>
              <Badge color={config.user.status === 'active' ? 'green' : 'red'} variant="light">
                {userStatusLabels[config.user.status]}
              </Badge>
            </Paper>
          </SimpleGrid>

          <Stack gap="sm">
            <Flex justify="space-between" align="center">
              <Flex gap="xs" align="center">
                <IconKey size={18} />
                <Text fw={600}>API Key</Text>
              </Flex>
              <Group gap="xs">
                <Badge variant="light">{config.apiKeys.length}</Badge>
                <QuickCreateApiKey onCreated={() => void accountQuery.refetch()} />
              </Group>
            </Flex>
            {config.apiKeys.length === 0 ? (
              <Alert color="yellow" variant="light">
                当前账号尚未配置 API Key。
              </Alert>
            ) : (
              <Stack gap="xs">
                {config.apiKeys.map((apiKey) => (
                  <Paper key={apiKey.id} p="sm" withBorder>
                    <Flex justify="space-between" gap="md" align="center" wrap="wrap">
                      <Stack gap={2}>
                        <Text fw={500}>{apiKey.name}</Text>
                        <Text size="xs" ff="monospace" c="chatbox-tertiary">
                          {maskKey(apiKey)}
                        </Text>
                      </Stack>
                      <Group gap="md">
                        <Text size="xs" c="chatbox-tertiary">
                          {apiKey.quota > 0
                            ? `${formatMoney(apiKey.quota_used)} / ${formatMoney(apiKey.quota)}`
                            : 'API Key 额度不限'}
                        </Text>
                        <Badge color={apiKey.status === 'active' ? 'green' : 'gray'} variant="light">
                          {apiKeyStatusLabels[apiKey.status]}
                        </Badge>
                      </Group>
                    </Flex>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>

          <Divider />

          <Stack gap="sm">
            <Flex justify="space-between" align="center">
              <Flex gap="xs" align="center">
                <IconUser size={18} />
                <Text fw={600}>订阅</Text>
              </Flex>
              <Badge variant="light">{config.subscriptions.length}</Badge>
            </Flex>
            {config.subscriptions.length === 0 ? (
              <Text size="sm" c="chatbox-tertiary">
                当前账号暂无订阅。
              </Text>
            ) : (
              config.subscriptions.map((subscription) => (
                <Paper key={subscription.id} p="sm" withBorder>
                  <Flex justify="space-between" gap="md" align="center">
                    <Stack gap={2}>
                      <Text fw={500}>{subscription.group?.name || `分组 ${subscription.group_id}`}</Text>
                      <Text size="xs" c="chatbox-tertiary">
                        今日用量 {formatMoney(subscription.daily_usage_usd)} / 本月用量{' '}
                        {formatMoney(subscription.monthly_usage_usd)}
                      </Text>
                    </Stack>
                    <Badge color={subscription.status === 'active' ? 'green' : 'gray'} variant="light">
                      {subscriptionStatusLabels[subscription.status]}
                    </Badge>
                  </Flex>
                </Paper>
              ))
            )}
          </Stack>
        </>
      )}

      <Paper p="sm" withBorder>
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            连接配置
          </Text>
          <Text size="sm" c="chatbox-secondary">
            OpenAI 兼容接口地址：{getSub2APIGatewayUrl()}/v1
          </Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconExternalLink size={16} />}
            onClick={() => void platform.openLink(`${getSub2APIWebUrl()}/keys`)}
          >
            {siteName ? `在 ${siteName} 中管理 API Key` : '管理 API Key'}
          </Button>
        </Stack>
      </Paper>

      <Button variant="subtle" size="xs" onClick={onSwitchToLicenseKey}>
        改用 Chatbox 许可证密钥
      </Button>
    </Stack>
  )
})

LoggedInView.displayName = 'LoggedInView'
