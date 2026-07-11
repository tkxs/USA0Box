import { Alert, Button, Group, Loader, Modal, Progress, ScrollArea, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconDownload } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import Markdown from '@/components/Markdown'
import type useVersion from '@/hooks/useVersion'
import * as remote from '@/packages/remote'
import platform from '@/platform'
import { requestUpdateInstall, useUpdateStore } from '@/stores/updateStore'

const RELEASE_URL = 'https://github.com/tkxs/USA0Box/releases/latest'
const DISMISSED_KEY_PREFIX = 'sub0box:update-announcement-dismissed:'

type VersionState = Pick<ReturnType<typeof useVersion>, 'latestVersion' | 'needCheckUpdate'>

export default function UpdateAnnouncementModal({ latestVersion, needCheckUpdate }: VersionState) {
  const status = useUpdateStore((state) => state.status)
  const updaterVersion = useUpdateStore((state) => state.version)
  const progress = useUpdateStore((state) => state.progress)
  const error = useUpdateStore((state) => state.error)
  const installOnDownload = useUpdateStore((state) => state.installOnDownload)
  const [opened, setOpened] = useState(false)
  const [notes, setNotes] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)

  const version = updaterVersion || latestVersion
  const desktopUpdateDetected = ['available', 'downloading', 'downloaded'].includes(status)
  const updateDetected = needCheckUpdate || (platform.type === 'desktop' && desktopUpdateDetected)
  const dismissedKey = useMemo(() => (version ? `${DISMISSED_KEY_PREFIX}${version}` : ''), [version])

  useEffect(() => {
    if (!updateDetected || !version || localStorage.getItem(dismissedKey)) return

    setOpened(true)
    setLoadingNotes(true)
    remote
      .getLatestSub0BoxReleaseNotes()
      .then(setNotes)
      .catch(() => setNotes('本次更新包含功能改进和问题修复。'))
      .finally(() => setLoadingNotes(false))
  }, [dismissedKey, updateDetected, version])

  const dismiss = () => {
    if (dismissedKey) localStorage.setItem(dismissedKey, 'true')
    setOpened(false)
  }

  const update = async () => {
    if (platform.type === 'desktop') {
      await requestUpdateInstall()
      return
    }
    await platform.openLink(RELEASE_URL)
  }

  const waitingForInstall = installOnDownload && status !== 'error'
  const buttonLabel =
    platform.type !== 'desktop'
      ? '前往下载'
      : status === 'downloaded'
        ? '重启并安装'
        : installOnDownload
          ? '下载完成后自动安装'
          : status === 'error'
            ? '重试更新'
            : '立即更新'

  return (
    <Modal opened={opened} onClose={dismiss} title={`发现新版本 Sub0Box ${version}`} centered size="lg">
      <Stack gap="md">
        <ScrollArea.Autosize mah="50vh" type="auto">
          {loadingNotes ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                正在读取更新内容...
              </Text>
            </Group>
          ) : (
            <Markdown enableLaTeXRendering={false} enableMermaidRendering={false} hiddenCodeCopyButton>
              {notes}
            </Markdown>
          )}
        </ScrollArea.Autosize>

        {platform.type === 'desktop' && status === 'downloading' && (
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="sm">正在下载安装包</Text>
              <Text size="sm" c="dimmed">
                {progress}%
              </Text>
            </Group>
            <Progress value={progress} animated />
          </Stack>
        )}

        {platform.type === 'desktop' && status === 'error' && (
          <Alert icon={<IconAlertCircle size={18} />} color="red" title="自动更新失败">
            {error || '请检查网络后重试，或前往 GitHub Releases 手动下载。'}
          </Alert>
        )}

        <Group justify="flex-end">
          {platform.type === 'desktop' && status === 'error' && (
            <Button variant="subtle" onClick={() => platform.openLink(RELEASE_URL)}>
              手动下载
            </Button>
          )}
          <Button variant="default" onClick={dismiss} disabled={waitingForInstall}>
            暂不更新
          </Button>
          <Button
            leftSection={<IconDownload size={18} />}
            onClick={update}
            loading={waitingForInstall}
            disabled={waitingForInstall}
          >
            {buttonLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
