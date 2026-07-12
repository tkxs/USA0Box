import { Alert, Button, Flex, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import type { ModelProviderType, ProviderSettings } from '@shared/types'
import { IconKey, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { Modal } from '@/components/layout/Overlay'
import { useSub2APISiteName } from '@/hooks/useSub2APISiteName'
import {
  createSub2APIKey,
  getSub2APIAvailableGroups,
  getSub2APIGroupRateMultiplier,
  getSub2APIKeys,
} from '@/packages/sub2api'
import { getCompatibleSub2APIPlatforms, getSub2APIProviderEndpoint } from '@/packages/sub2api-provider'
import { useAuthInfoStore } from '@/stores/authInfoStore'
import queryClient from '@/stores/queryClient'

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
  const [createOpened, setCreateOpened] = useState(false)
  const [newKeyName, setNewKeyName] = useState('ZeroBox')
  const [newKeyGroupId, setNewKeyGroupId] = useState<string | null>(groupId === undefined ? null : String(groupId))
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const compatiblePlatforms = useMemo(() => new Set(getCompatibleSub2APIPlatforms(providerType)), [providerType])
  const keysQuery = useQuery({
    queryKey: ['sub2apiApiKeys'],
    queryFn: getSub2APIKeys,
    enabled: isLoggedIn,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
  const groupsQuery = useQuery({
    queryKey: ['sub2apiAvailableGroups'],
    queryFn: getSub2APIAvailableGroups,
    enabled: isLoggedIn && createOpened,
    staleTime: 30_000,
  })

  const groups = useMemo(
    () =>
      (groupsQuery.data || []).filter(
        (group) => compatiblePlatforms.has(group.platform) && (groupId === undefined || group.id === groupId)
      ),
    [compatiblePlatforms, groupId, groupsQuery.data]
  )
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
  const selectedNewKeyGroup = groups.find((group) => String(group.id) === newKeyGroupId)

  const selectKey = (value: string | null) => {
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
  }

  const openCreateModal = () => {
    setNewKeyName('ZeroBox')
    setNewKeyGroupId(groupId === undefined ? null : String(groupId))
    setCreateError('')
    setCreateOpened(true)
  }

  const createAndSelectKey = async () => {
    const name = newKeyName.trim()
    const targetGroup = groups.find((group) => String(group.id) === newKeyGroupId)
    if (!name) {
      setCreateError('请输入密钥名称')
      return
    }
    if (!targetGroup) {
      setCreateError('请选择分组')
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      const key = await createSub2APIKey({ name, groupId: targetGroup.id })
      const createdGroup = key.group || targetGroup
      onChange({
        apiKey: key.key,
        ...getSub2APIProviderEndpoint(providerType, createdGroup.platform),
        sub2apiKeyId: key.id,
        sub2apiGroupId: createdGroup.id,
        sub2apiGroupPlatform: createdGroup.platform,
      })
      await queryClient.invalidateQueries({ queryKey: ['sub2apiApiKeys'] })
      setCreateOpened(false)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '创建密钥失败')
    } finally {
      setCreating(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <Alert color="yellow" variant="light">
        {siteName ? `请先登录 ${siteName}，再选择分组密钥。` : '请先登录账号，再选择分组密钥。'}
      </Alert>
    )
  }

  return (
    <Stack gap="xs" flex={1}>
      <Flex gap="xs" align="flex-start">
        <Select
          flex={1}
          placeholder={keysQuery.isLoading ? '正在加载分组密钥...' : '请选择分组密钥'}
          data={keys.map((key) => ({
            value: String(key.id),
            label: `${key.group?.name} / ${key.name} / ${key.group ? platformLabels[key.group.platform] : ''}`,
          }))}
          value={selectedKey ? String(selectedKey.id) : null}
          onChange={selectKey}
          searchable
          clearable
          disabled={disabled || keysQuery.isLoading}
          nothingFoundMessage="没有匹配的分组密钥"
        />
        <Button
          leftSection={<ScalableIcon icon={IconPlus} size={15} />}
          variant="light"
          disabled={disabled}
          onClick={openCreateModal}
        >
          创建密钥
        </Button>
      </Flex>

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
          当前账号没有兼容此协议的可用分组密钥，请点击“创建密钥”。
        </Alert>
      )}

      <Modal
        opened={createOpened}
        onClose={() => !creating && setCreateOpened(false)}
        centered
        size="md"
        title="创建分组密钥"
      >
        <Stack gap="md">
          <TextInput
            label="密钥名称"
            placeholder="例如：ZeroBox"
            value={newKeyName}
            onChange={(event) => setNewKeyName(event.currentTarget.value)}
            disabled={creating}
            required
          />
          <Select
            label="分组"
            placeholder={groupsQuery.isLoading ? '正在加载分组...' : '请选择分组'}
            data={groups.map((group) => ({
              value: String(group.id),
              label: `${group.name} / ${platformLabels[group.platform]}`,
            }))}
            value={newKeyGroupId}
            onChange={setNewKeyGroupId}
            disabled={creating || groupsQuery.isLoading || groupId !== undefined || groups.length === 0}
            searchable
            required
          />
          {selectedNewKeyGroup && (
            <Paper p="sm" withBorder>
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {selectedNewKeyGroup.name}
                </Text>
                <Text size="xs" c="chatbox-tertiary">
                  平台：{platformLabels[selectedNewKeyGroup.platform]} / 类型：
                  {selectedNewKeyGroup.subscription_type === 'subscription' ? '订阅' : '标准'} / 费率：
                  {getSub2APIGroupRateMultiplier(selectedNewKeyGroup)}x
                </Text>
                {selectedNewKeyGroup.description && (
                  <Text size="xs" c="chatbox-tertiary">
                    {selectedNewKeyGroup.description}
                  </Text>
                )}
              </Stack>
            </Paper>
          )}
          {groupsQuery.error && (
            <Alert color="red" variant="light" title="无法加载可用分组">
              {groupsQuery.error instanceof Error ? groupsQuery.error.message : '未知请求错误'}
            </Alert>
          )}
          {!groupsQuery.isLoading && !groupsQuery.error && groups.length === 0 && (
            <Alert color="yellow" variant="light">
              当前账号没有可用于创建密钥的兼容分组。
            </Alert>
          )}
          {createError && (
            <Alert color="red" variant="light" title="创建失败">
              {createError}
            </Alert>
          )}
          <Button
            leftSection={<ScalableIcon icon={IconKey} size={17} />}
            onClick={() => void createAndSelectKey()}
            loading={creating}
            disabled={groupsQuery.isLoading || groups.length === 0}
          >
            创建并选中密钥
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
