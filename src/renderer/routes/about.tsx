import {
  Anchor,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Image,
  Popover,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
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
import BrandGithub from '@/components/icons/BrandGithub'
import BrandRedNote from '@/components/icons/BrandRedNote'
import BrandWechat from '@/components/icons/BrandWechat'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import platform from '@/platform'
import iconPNG from '@/static/icon.png'
import IMG_WECHAT_QRCODE from '@/static/wechat_qrcode.png'
import { installUpdate, requestMobileUpdateInstall, useUpdateStore } from '@/stores/updateStore'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t, i18n: _i18n } = useTranslation()
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

                <UpdateSection needCheckUpdate={version.needCheckUpdate} latestVersion={version.latestVersion} />
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
              icon={<BrandGithub className="w-full h-full" />}
              title={t('Github')}
              link="https://github.com/tkxs/USA0Box"
              value="USA0Box"
            />
            {/* <ListItem
              icon={<BrandX className="w-full h-full" />}
              title={t('X(Twitter)')}
              link="https://x.com/ChatboxAI_HQ"
              value="@ChatboxAI_HQ"
            /> */}
            <ListItem
              icon={<BrandRedNote className="w-full h-full" />}
              title={t('RedNote')}
              link="https://www.xiaohongshu.com/user/profile/67b581b6000000000e01d11f"
              value="@63844903136"
            />
            <ListItem icon={<BrandWechat className="w-full h-full" />} title={t('WeChat')} right={<WechatQRCode />} />
          </List>

          <List>
            <ListItem
              icon={<IconHome className="w-full h-full" />}
              title={t('Official Site')}
              link="https://github.com/tkxs/USA0Box"
            />
            <ListItem
              icon={<IconClipboard className="w-full h-full" />}
              title={t('Survey')}
              link={_i18n.language === 'zh-Hans' ? 'https://jsj.top/f/fcMYEa' : 'https://jsj.top/f/RUMbvY'}
            />
            <ListItem
              icon={<IconPencil className="w-full h-full" />}
              title={t('Feedback')}
              link="https://github.com/tkxs/USA0Box/issues"
            />
            <ListItem
              icon={<IconFileText className="w-full h-full" />}
              title={t('Changelog')}
              link="https://github.com/tkxs/USA0Box/releases"
            />
            <ListItem
              icon={<IconMail className="w-full h-full" />}
              title={t('E-mail')}
              link="https://github.com/tkxs/USA0Box/issues"
              value="GitHub Issues"
            />
            <ListItem
              icon={<IconMessage2 className="w-full h-full" />}
              title={t('FAQs')}
              link="https://github.com/tkxs/USA0Box/issues"
            />
          </List>
        </Stack>
      </Container>
    </Page>
  )
}

/**
 * Update section in the About page hero.
 * Desktop: check button, progress bar, error/retry, restart & install.
 * Mobile: "New version available" hint linking to GitHub Releases.
 */
function UpdateSection({ needCheckUpdate, latestVersion }: { needCheckUpdate: boolean; latestVersion: string }) {
  const isDesktop = platform.type === 'desktop'

  if (isDesktop) {
    return <DesktopUpdateSection />
  }

  // Mobile and Web both use external link
  return <MobileUpdateHint needCheckUpdate={needCheckUpdate} latestVersion={latestVersion} />
}

function MobileUpdateHint({ needCheckUpdate, latestVersion }: { needCheckUpdate: boolean; latestVersion: string }) {
  const { t } = useTranslation()
  const status = useUpdateStore((state) => state.status)
  const progress = useUpdateStore((state) => state.progress)
  const isAndroid = platform.type === 'mobile' && CHATBOX_BUILD_PLATFORM === 'android'

  const handleClick = () => {
    if (isAndroid && needCheckUpdate && latestVersion) {
      void requestMobileUpdateInstall(latestVersion)
      return
    }
    if (isAndroid) {
      useUpdateStore.setState({ status: 'up-to-date', error: null })
      return
    }
    void platform.openLink('https://github.com/tkxs/USA0Box/releases/latest')
  }

  if (needCheckUpdate) {
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
    <Button size="xs" variant="default" radius="xl" className="flex-shrink-0" onClick={handleClick}>
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

function WechatQRCode() {
  const { t } = useTranslation()
  const [opened, { close, open }] = useDisclosure(false)
  return (
    <Popover position="top" withArrow shadow="md" opened={opened}>
      <Popover.Target>
        <Text onMouseEnter={open} onMouseLeave={close} c="chatbox-brand" className="cursor-pointer">
          {t('QR Code')}
        </Text>
      </Popover.Target>
      <Popover.Dropdown style={{ pointerEvents: 'none' }}>
        <Image src={IMG_WECHAT_QRCODE} alt="wechat qrcode" w={160} h={160} />
      </Popover.Dropdown>
    </Popover>
  )
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
