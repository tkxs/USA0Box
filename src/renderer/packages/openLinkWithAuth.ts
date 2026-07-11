import platform from '@/platform'
import { getChatboxOrigin } from './remote'

function normalizeTargetUrl(url: string) {
  return new URL(url, getChatboxOrigin()).toString()
}

export async function openLinkWithAuth(url: string): Promise<void> {
  const targetUrl = normalizeTargetUrl(url)
  if (platform.type === 'mobile') {
    try {
      const { AppLauncher } = await import('@capacitor/app-launcher')
      await AppLauncher.openUrl({ url: targetUrl })
      return
    } catch (error) {
      console.warn('Failed to open link with AppLauncher, falling back to platform browser:', error)
    }
  }
  await platform.openLink(targetUrl)
}
