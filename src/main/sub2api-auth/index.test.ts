import { Sub2APIAuthIpcChannels } from '@shared/sub2api-auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (...args: unknown[]) => Promise<string> | string

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  login: vi.fn(),
  openExternal: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Handler) => mocks.handlers.set(channel, handler)),
  },
  shell: { openExternal: mocks.openExternal },
}))

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}))

vi.mock('./oauth-client', () => ({ loginToSub2API: mocks.login }))

import { registerSub2APIAuthHandlers } from './index'

describe('SUB2API auth IPC handlers', () => {
  beforeEach(() => {
    mocks.handlers.clear()
    mocks.login.mockReset()
    registerSub2APIAuthHandlers()
  })

  it('returns credentials from a successful browser login', async () => {
    mocks.login.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' })
    const result = JSON.parse(String(await mocks.handlers.get(Sub2APIAuthIpcChannels.LOGIN)?.()))
    expect(result).toEqual({ success: true, accessToken: 'access', refreshToken: 'refresh' })
  })

  it('aborts an active login through the cancel channel', async () => {
    let receivedSignal: AbortSignal | undefined
    mocks.login.mockImplementation((_openUrl: unknown, signal: AbortSignal) => {
      receivedSignal = signal
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    })

    const loginPromise = mocks.handlers.get(Sub2APIAuthIpcChannels.LOGIN)?.()
    const cancelResult = JSON.parse(String(await mocks.handlers.get(Sub2APIAuthIpcChannels.CANCEL)?.()))
    const loginResult = JSON.parse(String(await loginPromise))

    expect(receivedSignal?.aborted).toBe(true)
    expect(cancelResult).toEqual({ success: true })
    expect(loginResult).toEqual({ success: false, error: 'SUB2API authorization cancelled' })
  })
})
