import { Alert, Paper, Select, Stack, Text } from '@mantine/core'
import type { ModelProviderType, ProviderSettings } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import { getSub2APIKeys } from '@/packages/sub2api'
import { getCompatibleSub2APIPlatforms, getSub2APIProviderEndpoint } from '@/packages/sub2api-provider'
import { useAuthInfoStore } from '@/stores/authInfoStore'

interface Sub2APIKeySelectorProps {
  providerType: ModelProviderType
  groupId?: number
  providerSettings?: ProviderSettings
  disabled?: boolean
  onChange: (settings: Partial<ProviderSettings>) => void
}

const platformLabels = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  grok: 'Grok',
} as const

export function Sub2APIKeySelector({
  providerType,
  groupId,
  providerSettings,
  disabled,
  onChange,
}: Sub2APIKeySelectorProps) {
  const siteName = useSub2APISiteName()
  const isLoggedIn = useAuthInfoStore((state) => !!state.accessToken && !!state.refreshToken)
  const keysQuery = useQuery({
    queryKey: ['sub2apiApiKeys'],
    queryFn: getSub2APIKeys,
    enabled: isLoggedIn,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  const compatiblePlatforms = useMemo(() => new Set(getCompatibleSub2APIPlatforms(providerType)), [providerType])
  const keys = useMemo(
    () =>
      (keysQuery.data || []).filter(
        (key) =>
          key.status === 'active' &&
          !!key.key &&
          !!key.group &&
          compatiblePlatforms.has(key.group.platform) &&
          (groupId === undefined || key.group_id === groupId)
      ),
    [compatiblePlatforms, groupId, keysQuery.data]
  )
  const selectedKey = keys.find(
    (key) => key.id === providerSettings?.sub2apiKeyId || key.key === providerSettings?.apiKey
  )

  if (!isLoggedIn) {
    return (
      <Alert color="yellow" variant="light">
        {siteName ? `请先登录 ${siteName}，再选择分组密钥。` : '请先登录账号，再选择分组密钥。'}
      </Alert>
    )
  }

  return (
    <Stack gap="xs" flex={1}>
      <Select
        placeholder={keysQuery.isLoading ? '正在加载分组密钥...' : '请选择分组密钥'}
        data={keys.map((key) => ({
          value: String(key.id),
          label: `${key.group?.name} / ${key.name} / ${key.group ? platformLabels[key.group.platform] : ''}`,
        }))}
        value={selectedKey ? String(selectedKey.id) : null}
        onChange={(value) => {
          const key = keys.find((item) => String(item.id) === value)
          if (!key?.group) {
            onChange({
              apiKey: '',
              apiHost: undefined,
              apiPath: undefined,
              sub2apiKeyId: undefined,
              sub2apiGroupId: undefined,
              sub2apiGroupPlatform: undefined,
            })
            return
          }
          onChange({
            apiKey: key.key,
            ...getSub2APIProviderEndpoint(providerType, key.group.platform),
            sub2apiKeyId: key.id,
            sub2apiGroupId: key.group.id,
            sub2apiGroupPlatform: key.group.platform,
          })
        }}
        searchable
        clearable
        disabled={disabled || keysQuery.isLoading}
        nothingFoundMessage="没有匹配的分组密钥"
      />
      {selectedKey?.group && (
        <Paper p="xs" withBorder>
          <Text size="xs" c="chatbox-secondary">
            分组：{selectedKey.group.name} / 平台：{platformLabels[selectedKey.group.platform]} / 密钥：
            {selectedKey.name}
          </Text>
          <Text size="xs" c="chatbox-tertiary">
            模型获取、连接检查和对话请求均使用此密钥。
          </Text>
        </Paper>
      )}
      {keysQuery.error && (
        <Alert color="red" variant="light">
          {keysQuery.error instanceof Error ? keysQuery.error.message : '无法加载分组密钥'}
        </Alert>
      )}
      {!keysQuery.isLoading && !keysQuery.error && keys.length === 0 && (
        <Alert color="yellow" variant="light">
          当前账号没有兼容此协议的可用分组密钥，请先在账号页面创建。
        </Alert>
      )}
    </Stack>
  )
}
