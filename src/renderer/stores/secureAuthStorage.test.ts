import { beforeEach, describe, expect, it, vi } from 'vitest'
import { secureAuthStorage } from './secureAuthStorage'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe('secure auth storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('sessionStorage', memoryStorage())
  })

  it('migrates and removes the previous plaintext auth entry', async () => {
    localStorage.setItem('sub2api-auth-info', 'legacy-value')

    await expect(secureAuthStorage.getItem('sub2api-auth-info')).resolves.toBe('legacy-value')
    expect(localStorage.getItem('sub2api-auth-info')).toBeNull()
    expect(sessionStorage.getItem('sub2api-auth-info')).toBe('legacy-value')
  })

  it('stores web sessions only until the browser session ends', async () => {
    await secureAuthStorage.setItem('sub2api-auth-info', 'session-value')
    expect(sessionStorage.getItem('sub2api-auth-info')).toBe('session-value')
    expect(localStorage.getItem('sub2api-auth-info')).toBeNull()

    await secureAuthStorage.removeItem('sub2api-auth-info')
    expect(sessionStorage.getItem('sub2api-auth-info')).toBeNull()
  })
})
