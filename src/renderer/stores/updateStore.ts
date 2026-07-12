import { t } from 'i18next'
import { create } from 'zustand'
import platform from '@/platform'

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error'

interface UpdateState {
  status: UpdateStatus
  progress: number
  version: string | null
  error: string | null
  dismissedVersion: string | null
  installOnDownload: boolean
}

interface UpdateActions {
  dismiss(): void
}

export const useUpdateStore = create<UpdateState & UpdateActions>((set, get) => ({
  status: 'idle',
  progress: 0,
  version: null,
  error: null,
  dismissedVersion: null,
  installOnDownload: false,

  dismiss() {
    set({ dismissedVersion: get().version })
  },
}))

export function installUpdate() {
  platform.installUpdate().catch(() => {
    useUpdateStore.setState({ status: 'error', error: t('Update failed') })
  })
}

export function completeUpdateDownload(data: { version: string }) {
  const { dismissedVersion, installOnDownload } = useUpdateStore.getState()
  useUpdateStore.setState({
    status: 'downloaded',
    version: data.version,
    progress: 100,
    dismissedVersion: dismissedVersion === data.version ? dismissedVersion : null,
    installOnDownload: false,
  })
  if (installOnDownload) installUpdate()
}

export async function requestUpdateInstall() {
  const { status } = useUpdateStore.getState()
  if (status === 'downloaded') {
    installUpdate()
    return
  }

  useUpdateStore.setState({ installOnDownload: true })
  if ((status === 'idle' || status === 'error' || status === 'up-to-date') && platform.checkForUpdate) {
    try {
      await platform.checkForUpdate()
    } catch {
      useUpdateStore.setState({ status: 'error', error: t('Update failed') })
    }
  }
}

export async function requestMobileUpdateInstall(version: string) {
  if (!platform.installMobileUpdate) {
    useUpdateStore.setState({ status: 'error', error: '当前平台不支持应用内更新' })
    return
  }

  useUpdateStore.setState({
    status: 'downloading',
    version,
    progress: 0,
    error: null,
    installOnDownload: false,
  })
  try {
    const result = await platform.installMobileUpdate(version, (progress) => {
      useUpdateStore.setState({ status: 'downloading', progress })
    })
    if (result.permissionRequired) {
      useUpdateStore.setState({
        status: 'available',
        progress: 100,
        error: '安装包已下载。请在系统设置中允许 ZeroBox 安装未知应用，然后返回并再次点击安装。',
      })
      return
    }
    useUpdateStore.setState({ status: 'downloaded', progress: 100, error: null })
  } catch (error) {
    useUpdateStore.setState({
      status: 'error',
      progress: 0,
      error: error instanceof Error ? error.message : '移动端更新失败',
    })
  }
}

let initialized = false

/**
 * Initialize update event listeners (desktop only).
 * Idempotent — safe to call multiple times (e.g., during hot reload).
 */
export function initUpdateListeners() {
  if (initialized) return
  initialized = true

  if (platform.onUpdaterChecking) {
    platform.onUpdaterChecking(() => {
      useUpdateStore.setState({ status: 'checking', error: null })
    })
  }

  if (platform.onUpdaterAvailable) {
    platform.onUpdaterAvailable((data) => {
      const { dismissedVersion } = useUpdateStore.getState()
      useUpdateStore.setState({
        status: 'available',
        version: data.version,
        dismissedVersion: dismissedVersion === data.version ? dismissedVersion : null,
      })
    })
  }

  if (platform.onUpdaterNotAvailable) {
    platform.onUpdaterNotAvailable(() => {
      const { status } = useUpdateStore.getState()
      if (status === 'checking') {
        useUpdateStore.setState({ status: 'up-to-date', installOnDownload: false })
        setTimeout(() => {
          if (useUpdateStore.getState().status === 'up-to-date') {
            useUpdateStore.setState({ status: 'idle' })
          }
        }, 3_000)
      } else if (status !== 'idle') {
        useUpdateStore.setState({ status: 'idle', installOnDownload: false })
      }
    })
  }

  if (platform.onUpdaterProgress) {
    platform.onUpdaterProgress((data) => {
      const { progress, status } = useUpdateStore.getState()
      if (status === 'downloading' && progress === data.percent) return
      useUpdateStore.setState({ status: 'downloading', progress: data.percent })
    })
  }

  if (platform.onUpdaterDownloaded) {
    platform.onUpdaterDownloaded(completeUpdateDownload)
  }

  if (platform.onUpdaterError) {
    platform.onUpdaterError((data) => {
      useUpdateStore.setState({ status: 'error', error: data.message, progress: 0 })
    })
  }
}
