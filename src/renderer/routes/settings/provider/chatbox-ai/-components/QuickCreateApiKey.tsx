import {
  ActionIcon,
  Alert,
  Button,
  CopyButton,
  Flex,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconCheck, IconCopy, IconKey, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Modal } from '@/components/layout/Overlay'
import { createSub2APIKey, getSub2APIAvailableGroups, type Sub2APIGroup, type Sub2APIKey } from '@/packages/sub2api'
import queryClient from '@/stores/queryClient'

interface QuickCreateApiKeyProps {
  onCreated: () => void
}

function getPlatformLabel(platform: Sub2APIGroup['platform']) {
  const labels: Record<Sub2APIGroup['platform'], string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    gemini: 'Gemini',
    antigravity: 'Antigravity',
    grok: 'Grok',
  }
  return labels[platform]
}

export function QuickCreateApiKey({ onCreated }: QuickCreateApiKeyProps) {
  const [opened, setOpened] = useState(false)
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [createdKey, setCreatedKey] = useState<Sub2APIKey | null>(null)

  const groupsQuery = useQuery({
    queryKey: ['sub2apiAvailableGroups'],
    queryFn: getSub2APIAvailableGroups,
    enabled: opened,
    staleTime: 30_000,
  })
  const groups = groupsQuery.data || []
  const selectedGroup = useMemo(() => groups.find((group) => String(group.id) === groupId), [groupId, groups])
  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        value: String(group.id),
        label: `${group.name} / ${getPlatformLabel(group.platform)}`,
      })),
    [groups]
  )

  const reset = () => {
    setName('')
    setGroupId(null)
    setError('')
    setCreatedKey(null)
  }

  const close = () => {
    if (submitting) return
    setOpened(false)
    reset()
  }

  const createKey = async () => {
    const normalizedName = name.trim()
    if (!normalizedName) {
      setError('请输入 API Key 名称')
      return
    }
    if (!groupId) {
      setError('请选择分组')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const result = await createSub2APIKey({ name: normalizedName, groupId: Number(groupId) })
      setCreatedKey(result)
      await queryClient.invalidateQueries({ queryKey: ['sub2apiApiKeys'] })
      onCreated()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建 API Key 失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button size="xs" leftSection={<IconPlus size={15} />} onClick={() => setOpened(true)}>
        快速创建
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        centered
        size="md"
        title="快速创建 API Key"
        closeOnClickOutside={!submitting}
      >
        {createdKey ? (
          <Stack gap="md">
            <Alert color="green" variant="light" title="API Key 创建成功">
              请立即保存该 Key。
            </Alert>
            <Paper p="sm" withBorder>
              <Flex gap="sm" align="center" justify="space-between">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600}>
                    {createdKey.name}
                  </Text>
                  <Text size="sm" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
                    {createdKey.key}
                  </Text>
                </Stack>
                <CopyButton value={createdKey.key} timeout={1800}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? '已复制' : '复制 API Key'}>
                      <ActionIcon
                        variant="light"
                        color={copied ? 'green' : 'blue'}
                        onClick={copy}
                        aria-label="复制 API Key"
                      >
                        {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Flex>
            </Paper>
            <Button onClick={close}>完成</Button>
          </Stack>
        ) : (
          <Stack gap="md">
            <TextInput
              label="API Key 名称"
              placeholder="例如：ZeroBox"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              disabled={submitting}
              required
            />
            <Select
              label="分组"
              placeholder={groupsQuery.isLoading ? '正在加载分组...' : '请选择分组'}
              data={groupOptions}
              value={groupId}
              onChange={setGroupId}
              searchable
              disabled={submitting || groupsQuery.isLoading || groups.length === 0}
              required
            />
            {selectedGroup && (
              <Paper p="sm" withBorder>
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
                    {selectedGroup.name}
                  </Text>
                  <Text size="xs" c="chatbox-tertiary">
                    平台：{getPlatformLabel(selectedGroup.platform)} / 类型：
                    {selectedGroup.subscription_type === 'subscription' ? '订阅' : '标准'} / 费率：
                    {selectedGroup.rate_multiplier}x
                  </Text>
                  {selectedGroup.description && (
                    <Text size="xs" c="chatbox-tertiary">
                      {selectedGroup.description}
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
                当前账号没有可用于创建 API Key 的分组。
              </Alert>
            )}
            {error && (
              <Alert color="red" variant="light" title="创建失败">
                {error}
              </Alert>
            )}
            <Button
              leftSection={<IconKey size={17} />}
              onClick={() => void createKey()}
              loading={submitting}
              disabled={groupsQuery.isLoading || groups.length === 0}
            >
              创建 API Key
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  )
}
