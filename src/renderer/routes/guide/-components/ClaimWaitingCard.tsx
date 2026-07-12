/**
 * ClaimWaitingCard — legacy waiting UI, now redirected to SUB2API group-key settings.
 *
 * Owns the polling lifecycle (via useClaimPolling), renders a minimal waiting indicator,
 * and surfaces two escape hatches: re-open the page and skip.
 */

import { Anchor, Flex, Group, Loader, Stack, Text } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/Settings'
import type { UserLicense } from '@/packages/remote'
import { useSettingsStore } from '@/stores/settingsStore'
import { useClaimPolling } from '../-hooks/useClaimPolling'

interface ClaimWaitingCardProps {
  onClaimDetected: (license: UserLicense) => void
}

export function ClaimWaitingCard({ onClaimDetected }: ClaimWaitingCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const hasLicense = useSettingsStore((s) => Boolean(s.licenseKey))
  const [timedOut, setTimedOut] = useState(false)

  useClaimPolling({
    enabled: !hasLicense && !timedOut,
    onClaimed: onClaimDetected,
    onTimeout: () => setTimedOut(true),
  })

  const handleSkip = () => {
    void navigate({ to: '/' })
  }

  const handleReopenPage = () => {
    navigateToSettings('/provider')
  }

  if (timedOut) {
    return (
      <Stack gap="xs" mt="md">
        <Text size="sm" c="chatbox-text-secondary">
          {t("Looks like it's taking a while. You can open Settings to log in again, or close and reopen the app.")}
        </Text>
        <Group gap="md">
          <Anchor size="sm" component="button" type="button" onClick={handleSkip}>
            {t('Skip for now')}
          </Anchor>
        </Group>
      </Stack>
    )
  }

  return (
    <Stack gap="sm" mt="md">
      <Flex align="center" gap="xs">
        <Loader size="xs" type="dots" />
        <Text size="sm" c="chatbox-text-secondary">
          {t('Please select a group and create or choose a key in Settings.')}
        </Text>
      </Flex>
      <Group gap="md">
        <Anchor size="sm" component="button" type="button" onClick={handleReopenPage}>
          {t('Open Settings')}
        </Anchor>
        <Anchor size="sm" component="button" type="button" onClick={handleSkip}>
          {t('Skip for now')}
        </Anchor>
      </Group>
    </Stack>
  )
}
