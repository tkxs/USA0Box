import { Alert, Badge, Flex, Loader, ScrollArea, Stack, Text } from '@mantine/core'
import { IconChevronRight, IconLayersLinked } from '@tabler/icons-react'
import { Link, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { useMemo } from 'react'
import Divider from '@/components/common/Divider'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import type { Sub2APIGroup } from '@/packages/sub2api'
import { getSub2APIGroupProviderId } from '@/packages/sub2api-provider'
import { useSettingsStore } from '@/stores/settingsStore'

const platformLabels = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  grok: 'Grok',
} as const

interface Sub2APIGroupListProps {
  groups: Sub2APIGroup[]
  loading: boolean
  error?: Error | null
}

export function Sub2APIGroupList({ groups, loading, error }: Sub2APIGroupListProps) {
  const isSmallScreen = useIsSmallScreen()
  const routerState = useRouterState()
  const providers = useSettingsStore((state) => state.providers)
  const selectedProviderId = useMemo(() => {
    const segments = routerState.location.pathname.split('/').filter(Boolean)
    return segments[segments.indexOf('provider') + 1]
  }, [routerState.location.pathname])

  return (
    <Stack
      maw={isSmallScreen ? undefined : 256}
      className={clsx(
        'border-solid border-0 border-r border-chatbox-border-primary',
        isSmallScreen ? 'w-full border-r-0' : 'flex-[1_0_auto]'
      )}
      gap={0}
    >
      <ScrollArea flex={1} type={isSmallScreen ? 'never' : 'hover'} scrollHideDelay={100}>
        <Stack p={isSmallScreen ? 0 : 'xs'} gap={isSmallScreen ? 0 : 'xs'}>
          {loading && (
            <Flex justify="center" p="xl">
              <Loader size="sm" />
            </Flex>
          )}
          {error && <Alert color="red">{error.message}</Alert>}
          {!loading && !error && groups.length === 0 && <Alert color="yellow">当前账号暂无可用模型分组。</Alert>}
          {groups.map((group) => {
            const providerId = getSub2APIGroupProviderId(group.id)
            const activated = !!providers?.[providerId]?.sub2apiKeyId
            return (
              <Link
                key={group.id}
                to="/settings/provider/$providerId"
                params={{ providerId }}
                className="block no-underline"
              >
                <Flex
                  component="span"
                  align="center"
                  gap="xs"
                  p="md"
                  pr="xl"
                  py={isSmallScreen ? 'sm' : undefined}
                  c={providerId === selectedProviderId ? 'chatbox-brand' : 'chatbox-secondary'}
                  bg={providerId === selectedProviderId ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
                  className={clsx(
                    'cursor-pointer select-none rounded-md',
                    providerId === selectedProviderId ? '' : 'hover:!bg-chatbox-background-gray-secondary'
                  )}
                >
                  <ScalableIcon icon={IconLayersLinked} size={28} />
                  <Stack gap={2} flex={1} style={{ minWidth: 0 }}>
                    <Text size="sm" className="!text-inherit" truncate>
                      {group.name}
                    </Text>
                    <Flex gap={4} wrap="wrap">
                      <Badge size="xs" variant="light">
                        {platformLabels[group.platform]}
                      </Badge>
                      <Badge size="xs" variant="outline" color="gray">
                        倍率 {group.rate_multiplier}x
                      </Badge>
                    </Flex>
                  </Stack>
                  {activated && <span className="w-2 h-2 rounded-full bg-chatbox-success shrink-0" />}
                  {isSmallScreen && <ScalableIcon icon={IconChevronRight} size={20} />}
                </Flex>
                {isSmallScreen && <Divider />}
              </Link>
            )
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}
