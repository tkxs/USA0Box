import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startDownload: vi.fn(),
  getDownloadStatus: vi.fn(),
  install: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => mocks,
}))

import {
  ANDROID_UPDATE_ASSET_NAME,
  ANDROID_UPDATE_URL,
  downloadAndInstallAndroidUpdate,
  getAndroidUpdateFileName,
} from './mobile-update'

describe('Android mobile update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses a stable GitHub Release asset for in-app updates', () => {
    expect(ANDROID_UPDATE_ASSET_NAME).toBe('ZeroBox-android-update.apk')
    expect(ANDROID_UPDATE_URL).toBe(
      'https://github.com/tkxs/USA0Box/releases/latest/download/ZeroBox-android-update.apk'
    )
    expect(getAndroidUpdateFileName('0.2.0')).toBe('ZeroBox-0.2.0-android-update.apk')
  })

  it('downloads the package before opening the Android installer', async () => {
    mocks.startDownload.mockResolvedValue({ downloadId: '42' })
    mocks.getDownloadStatus
      .mockResolvedValueOnce({
        status: 'running',
        downloaded: 25,
        total: 100,
        reason: 0,
      })
      .mockResolvedValue({
        status: 'successful',
        downloaded: 100,
        total: 100,
        reason: 0,
      })
    mocks.install.mockResolvedValue({ permissionRequired: false })
    const progress = vi.fn()

    await expect(downloadAndInstallAndroidUpdate('0.2.0', progress)).resolves.toEqual({
      permissionRequired: false,
      fileName: 'ZeroBox-0.2.0-android-update.apk',
    })
    expect(mocks.startDownload).toHaveBeenCalledWith({
      url: ANDROID_UPDATE_URL,
      fileName: 'ZeroBox-0.2.0-android-update.apk',
    })
    expect(mocks.getDownloadStatus).toHaveBeenCalledWith({ downloadId: '42' })
    expect(progress).toHaveBeenCalledWith(25)
    expect(progress).toHaveBeenLastCalledWith(100)
    expect(mocks.install).toHaveBeenCalledWith({ fileName: 'ZeroBox-0.2.0-android-update.apk' })
  })
})
