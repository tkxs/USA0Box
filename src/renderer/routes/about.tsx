import { Anchor, Box, Button, Container, Divider, Flex, Image, Progress, Stack, Text, Title } from '@mantine/core'
import {
  IconChevronRight,
  IconClipboard,
  IconFileText,
  IconHome,
  IconMail,
  IconMessage2,
  IconPencil,
  IconRefresh,
} from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import platform from '@/platform'
import iconPNG from '@/static/icon.png'
import { installUpdate, requestMobileUpdateInstall, useUpdateStore } from '@/stores/updateStore'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

const OFFICIAL_SITE_URL = 'https://usa0.top'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const version = useVersion()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page title={t('About')}>
      <Container size="md" p={0}>
        <Stack gap="xxl" px={isSmallScreen ? 'sm' : 'md'} py={isSmallScreen ? 'xl' : 'md'}>
          <Flex gap="xxl" p="md" className="rounded-lg bg-chatbox-background-secondary">
            <Image h={100} w={100} mah={'20vw'} maw={'20vw'} src={iconPNG} />
            <Stack flex={1} gap="xxs">
              <Flex justify="space-between" align="center" wrap="wrap" gap={isSmallScreen ? 'xs' : 'sm'} rowGap="xs">
                <Title order={5} lh={1.5} lineClamp={1} title={`ZeroBox v${version.version}`}>
                  ZeroBox {/\d/.test(version.version) ? `(v${version.version})` : ''}
                </Title>

                <UpdateSection versionState={version} />
              </Flex>
              <Text>{t('about-slogan')}</Text>
              <Text c="chatbox-tertiary">{t('about-introduction')}</Text>

              <Flex gap="sm">
                <Anchor
                  size="sm"
                  href="https://github.com/tkxs/USA0Box"
                  target="_blank"
                  underline="hover"
                  c="chatbox-tertiary"
                >
                  {t('Privacy Policy')}
                </Anchor>
                <Anchor
                  size="sm"
                  href="https://github.com/tkxs/USA0Box/blob/main/LICENSE"
                  target="_blank"
                  underline="hover"
                  c="chatbox-tertiary"
                >
                  {t('User Terms')}
                </Anchor>
              </Flex>
            </Stack>
          </Flex>

          <List>
            <ListItem
              icon={<IconHome className="w-full h-full" />}
              title={t('Official Site')}
              link={OFFICIAL_SITE_URL}
            />
            <ListItem icon={<IconClipboard className="w-full h-full" />} title={t('Survey')} link={OFFICIAL_SITE_URL} />
            <ListItem icon={<IconPencil className="w-full h-full" />} title={t('Feedback')} link={OFFICIAL_SITE_URL} />
            <ListItem
              icon={<IconFileText className="w-full h-full" />}
              title={t('Changelog')}
              link={OFFICIAL_SITE_URL}
            />
            <ListItem icon={<IconMail className="w-full h-full" />} title={t('E-mail')} link={OFFICIAL_SITE_URL} />
            <ListItem icon={<IconMessage2 className="w-full h-full" />} title={t('FAQs')} link={OFFICIAL_SITE_URL} />
          </List>
        </Stack>
      </Container>
    </Page>
  )
}

/**
 * Update section in the About page hero.
 * Desktop: check button, progress bar, error/retry, restart & install.
 * Mobile: check status feedback and in-app Android update installation.
 */
function UpdateSection({ versionState }: { versionState: ReturnType<typeof useVersion> }) {
  const isDesktop = platform.type === 'desktop'

  if (isDesktop) {
    return <DesktopUpdateSection />
  }

  // Mobile and Web both use external link
  return <MobileUpdateHint versionState={versionState} />
}

function MobileUpdateHint({ versionState }: { versionState: ReturnType<typeof useVersion> }) {
  const { t } = useTranslation()
  const status = useUpdateStore((state) => state.status)
  const progress = useUpdateStore((state) => state.progress)
  const storedUpdateVersion = useUpdateStore((state) => state.version)
  const isAndroid = platform.type === 'mobile' && CHATBOX_BUILD_PLATFORM === 'android'
  const updateAvailable = versionState.needCheckUpdate || status === 'available'
  const updateVersion = versionState.latestVersion || storedUpdateVersion || ''

  const handleClick = async () => {
    if (isAndroid && updateAvailable && updateVersion) {
      void requestMobileUpdateInstall(updateVersion)
      return
    }
    if (updateAvailable) {
      void platform.openLink(OFFICIAL_SITE_URL)
      return
    }

    useUpdateStore.setState({ status: 'checking', error: null })
    try {
      const result = await versionState.checkForUpdate()
      useUpdateStore.setState({
        status: result.needUpdate ? 'available' : 'up-to-date',
        version: result.latestVersion || null,
        error: null,
      })
    } catch (error) {
      useUpdateStore.setState({
        status: 'error',
        error: error instanceof Error ? error.message : t('Failed to check for updates'),
      })
    }
  }

  if (status === 'checking' || versionState.isCheckingUpdate) {
    return (
      <Button size="xs" variant="default" radius="xl" className="flex-shrink-0" loading>
        {t('Checking...')}
      </Button>
    )
  }

  if (status === 'error') {
    return (
      <Button size="xs" variant="default" radius="xl" className="flex-shrink-0" onClick={handleClick}>
        {t('Update failed')}
      </Button>
    )
  }

  if (status === 'up-to-date') {
    return (
      <Text size="xs" c="chatbox-tertiary" className="flex-shrink-0">
        {t('Already up to date')}
      </Text>
    )
  }

  if (updateAvailable) {
    return (
      <Button
        size="xs"
        variant="light"
        color="chatbox-brand"
        radius="xl"
        className="flex-shrink-0"
        loading={isAndroid && status === 'downloading'}
        onClick={handleClick}
      >
        {isAndroid && status === 'downloading' ? `${t('Downloading...')} ${progress}%` : t('New version available')}
      </Button>
    )
  }

  return (
    <Button size="xs" variant="default" radius="xl" className="flex-shrink-0" onClick={() => void handleClick()}>
      {t('Check Update')}
    </Button>
  )
}

function DesktopUpdateSection() {
  const { t } = useTranslation()
  const status = useUpdateStore((s) => s.status)
  const progress = useUpdateStore((s) => s.progress)
  const updateVersion = useUpdateStore((s) => s.version)

  const handleCheck = async () => {
    useUpdateStore.setState({ status: 'checking', error: null })
    try {
      const result = await platform.checkForUpdate?.()
      // If check was skipped (another check already in progress), reset UI
      if (result && !result.started) {
        const { status: currentStatus } = useUpdateStore.getState()
        if (currentStatus === 'checking') {
          useUpdateStore.setState({ status: 'idle' })
        }
      }
    } catch {
      useUpdateStore.setState({ status: 'idle' })
    }
    // Safety timeout: if still stuck at 'checking' after 30s, reset
    setTimeout(() => {
      if (useUpdateStore.getState().status === 'checking') {
        useUpdateStore.setState({ status: 'idle' })
      }
    }, 30_000)
  }

  const handleInstall = installUpdate

  switch (status) {
    case 'checking':
      return (
        <Button size="xs" variant="default" radius="xl" className="flex-shrink-0" loading>
          {t('Checking...')}
        </Button>
      )

    case 'available':
    case 'downloading':
      return (
        <Stack gap={4} flex={1} maw={200}>
          <Text size="xs" c="chatbox-brand" ta="right">
            {status === 'downloading'
              ? `${t('Downloading...')} ${progress}%`
              : `${t('New version available')}${updateVersion ? ` v${updateVersion}` : ''}`}
          </Text>
          {status === 'downloading' && <Progress value={progress} size="xs" color="chatbox-brand" animated />}
        </Stack>
      )

    case 'downloaded':
      return (
        <Button
          size="xs"
          variant="filled"
          color="chatbox-brand"
          radius="xl"
          className="flex-shrink-0"
          leftSection={<ScalableIcon icon={IconRefresh} size={14} />}
          onClick={handleInstall}
        >
          {t('Restart & Update')}
          {updateVersion ? ` (v${updateVersion})` : ''}
        </Button>
      )

    case 'error':
      return (
        <Stack gap={2} align="flex-end" className="flex-shrink-0">
          <Flex gap="xs" align="center">
            <Text size="xs" c="chatbox-error">
              {t('Update failed')}
            </Text>
            <Button size="xs" variant="default" radius="xl" onClick={handleCheck}>
              {t('Retry')}
            </Button>
          </Flex>
          <Anchor
            size="xs"
            c="chatbox-tertiary"
            onClick={() => platform.openLink('https://github.com/tkxs/USA0Box/releases/latest')}
          >
            {t('Download from official site')}
          </Anchor>
        </Stack>
      )

    case 'up-to-date':
      return (
        <Text size="xs" c="chatbox-tertiary" className="flex-shrink-0">
          {t('Already up to date')}
        </Text>
      )

    default:
      return (
        <Button size="xs" variant="default" radius="xl" className="flex-shrink-0" onClick={handleCheck}>
          {t('Check Update')}
        </Button>
      )
  }
}

function List(props: { children: ReactElement[] }) {
  return (
    <Stack gap={0} className="rounded-lg bg-chatbox-background-secondary">
      {props.children.map((child, index) => (
        <Fragment key={`child-${index}`}>
          {child}
          {index !== props.children.length - 1 && <Divider />}
        </Fragment>
      ))}
    </Stack>
  )
}

function ListItem({
  icon,
  title,
  link,
  value,
  right,
}: {
  icon: ReactElement
  title: string
  link?: string
  value?: string
  right?: ReactElement
}) {
  return (
    <Flex
      px="md"
      py="sm"
      gap="xs"
      align="center"
      className={link ? 'cursor-pointer' : ''}
      onClick={() => link && platform.openLink(link)}
      c="chatbox-tertiary"
    >
      <Box w={20} h={20} className="flex-shrink-0 " c="chatbox-primary">
        {icon}
      </Box>
      <Text flex={1} size="md">
        {title}
      </Text>

      {right ? (
        right
      ) : (
        <>
          {value && (
            <Text size="md" c="chatbox-tertiary">
              {value}
            </Text>
          )}
          {link && <ScalableIcon icon={IconChevronRight} size={20} className="!text-inherit" />}
        </>
      )}
    </Flex>
  )
}
