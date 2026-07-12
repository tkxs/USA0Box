import { Sub2APIAuthIpcChannels, type Sub2APIAuthResult } from '@shared/sub2api-auth'
import { ipcMain, shell } from 'electron'
import log from 'electron-log/main'
import { loginToSub2API } from './oauth-client'

let activeFlow: AbortController | undefined

function cancelActiveFlow(): void {
  activeFlow?.abort()
  activeFlow = undefined
}

export function registerSub2APIAuthHandlers(): void {
  ipcMain.handle(Sub2APIAuthIpcChannels.LOGIN, async (): Promise<string> => {
    cancelActiveFlow()
    const controller = new AbortController()
    activeFlow = controller

    try {
      log.info('[SUB2API Auth] Starting browser authorization')
      const tokens = await loginToSub2API((url) => shell.openExternal(url), controller.signal)
      log.info('[SUB2API Auth] Browser authorization succeeded')
      return JSON.stringify({ success: true, ...tokens } satisfies Sub2APIAuthResult)
    } catch (error) {
      const message = controller.signal.aborted
        ? 'SUB2API authorization cancelled'
        : error instanceof Error
          ? error.message
          : String(error)
      if (controller.signal.aborted) log.info('[SUB2API Auth] Browser authorization cancelled')
      else log.error('[SUB2API Auth] Browser authorization failed', error)
      return JSON.stringify({ success: false, error: message } satisfies Sub2APIAuthResult)
    } finally {
      if (activeFlow === controller) activeFlow = undefined
    }
  })

  ipcMain.handle(Sub2APIAuthIpcChannels.CANCEL, (): string => {
    cancelActiveFlow()
    return JSON.stringify({ success: true } satisfies Sub2APIAuthResult)
  })
}
