import { registerPlugin } from '@capacitor/core'

export const ANDROID_UPDATE_ASSET_NAME = 'ZeroBox-android-update.apk'
export const ANDROID_UPDATE_URL = 'https://github.com/tkxs/USA0Box/releases/latest/download/ZeroBox-android-update.apk'

interface MobileUpdaterPlugin {
  startDownload(options: { url: string; fileName: string }): Promise<{ downloadId: string }>
  getDownloadStatus(options: { downloadId: string }): Promise<{
    status: 'pending' | 'running' | 'paused' | 'successful' | 'failed' | 'unknown'
    downloaded: number
    total: number
    reason: number
  }>
  install(options: { fileName: string }): Promise<{ permissionRequired: boolean }>
}

const MobileUpdater = registerPlugin<MobileUpdaterPlugin>('MobileUpdater')

export function getAndroidUpdateFileName(version: string) {
  const safeVersion = version.replace(/[^0-9A-Za-z._-]/g, '')
  if (!safeVersion) throw new Error('无效的更新版本号')
  return `ZeroBox-${safeVersion}-android-update.apk`
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

export async function downloadAndInstallAndroidUpdate(
  version: string,
  onProgress: (percent: number) => void,
  existingFileName?: string
) {
  const fileName = existingFileName || getAndroidUpdateFileName(version)
  if (!existingFileName) {
    const { downloadId } = await MobileUpdater.startDownload({ url: ANDROID_UPDATE_URL, fileName })
    const deadline = Date.now() + 30 * 60 * 1000

    while (Date.now() < deadline) {
      const result = await MobileUpdater.getDownloadStatus({ downloadId })
      if (result.total > 0) {
        onProgress(Math.min(100, Math.max(0, Math.round((result.downloaded / result.total) * 100))))
      }
      if (result.status === 'successful') break
      if (result.status === 'failed') throw new Error(`安装包下载失败（${result.reason}）`)
      await wait(750)
    }

    const finalStatus = await MobileUpdater.getDownloadStatus({ downloadId })
    if (finalStatus.status !== 'successful') throw new Error('安装包下载超时，请重试')
    onProgress(100)
  }

  const installResult = await MobileUpdater.install({ fileName })
  return { ...installResult, fileName }
}
