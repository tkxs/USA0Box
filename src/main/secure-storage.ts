import { ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'

const ALLOWED_KEYS = new Set(['sub2api-auth-info'])

interface SecureStoreSchema {
  values: Record<string, string>
}

const encryptedStore = new Store<SecureStoreSchema>({
  name: 'secure-auth',
  defaults: { values: {} },
})

function assertAllowedKey(key: string) {
  if (!ALLOWED_KEYS.has(key)) throw new Error('Secure storage key is not allowed')
}

function ensureStrongEncryption() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Operating system credential encryption is unavailable')
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    throw new Error('A secure Linux credential backend is unavailable')
  }
}

export function registerSecureStorageHandlers() {
  ipcMain.handle('secure-storage:get', (_event, key: string): string | null => {
    assertAllowedKey(key)
    ensureStrongEncryption()
    const encrypted = encryptedStore.get('values')[key]
    if (!encrypted) return null
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  })

  ipcMain.handle('secure-storage:set', (_event, key: string, value: string): void => {
    assertAllowedKey(key)
    ensureStrongEncryption()
    if (typeof value !== 'string') throw new Error('Secure storage value must be a string')
    const values = encryptedStore.get('values')
    encryptedStore.set('values', {
      ...values,
      [key]: safeStorage.encryptString(value).toString('base64'),
    })
  })

  ipcMain.handle('secure-storage:delete', (_event, key: string): void => {
    assertAllowedKey(key)
    const values = { ...encryptedStore.get('values') }
    delete values[key]
    encryptedStore.set('values', values)
  })
}
