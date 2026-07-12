import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage'
import type { ElectronIPC } from '@shared/electron-types'
import type { StateStorage } from 'zustand/middleware'
import platform from '@/platform'

const SECURE_STORAGE_PREFIX = 'zerobox_'

function desktopIpc() {
  return (platform as typeof platform & { ipc: ElectronIPC }).ipc
}

function sessionValue(name: string) {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(name)
}

function setSessionValue(name: string, value: string) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(name, value)
}

function removeSessionValue(name: string) {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(name)
}

function readSecureValue(name: string) {
  if (platform.type === 'desktop') {
    return (desktopIpc().invoke('secure-storage:get', name) as Promise<string | null>).catch(() => sessionValue(name))
  }
  if (platform.type === 'mobile') {
    return SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX)
      .then(() => SecureStorage.getItem(name))
      .catch(() => sessionValue(name))
  }
  return sessionValue(name)
}

async function writeSecureValue(name: string, value: string) {
  if (platform.type === 'desktop') {
    await desktopIpc()
      .invoke('secure-storage:set', name, value)
      .catch(() => setSessionValue(name, value))
    return
  }
  if (platform.type === 'mobile') {
    await SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX)
      .then(() => SecureStorage.set(name, value, true, false, KeychainAccess.whenUnlockedThisDeviceOnly))
      .catch(() => setSessionValue(name, value))
    return
  }
  setSessionValue(name, value)
}

async function deleteSecureValue(name: string) {
  if (platform.type === 'desktop') {
    await desktopIpc()
      .invoke('secure-storage:delete', name)
      .catch(() => removeSessionValue(name))
    return
  }
  if (platform.type === 'mobile') {
    await SecureStorage.setKeyPrefix(SECURE_STORAGE_PREFIX)
      .then(() => SecureStorage.remove(name))
      .catch(() => removeSessionValue(name))
    return
  }
  removeSessionValue(name)
}

export const secureAuthStorage: StateStorage = {
  async getItem(name) {
    const secureValue = await readSecureValue(name)
    if (secureValue) return secureValue

    // Migrate the previous plaintext Zustand entry once, then remove it.
    const legacyValue = typeof localStorage === 'undefined' ? null : localStorage.getItem(name)
    if (!legacyValue) return null
    await writeSecureValue(name, legacyValue)
    localStorage.removeItem(name)
    return legacyValue
  },
  setItem: writeSecureValue,
  async removeItem(name) {
    await deleteSecureValue(name)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(name)
  },
}
