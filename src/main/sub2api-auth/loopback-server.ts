import http from 'node:http'

const CALLBACK_HOST = '127.0.0.1'
const CALLBACK_PATH = '/oauth/callback'
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000
const MAX_URL_LENGTH = 4096

export interface LoopbackCallback {
  code: string
}

export interface LoopbackServer {
  redirectUri: string
  waitForCallback: Promise<LoopbackCallback>
  close: () => void
}

const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

function page(title: string, message: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${message}</p></body></html>`
}

export async function createLoopbackServer(
  expectedState: string,
  signal?: AbortSignal,
  timeoutMs = CALLBACK_TIMEOUT_MS
): Promise<LoopbackServer> {
  if (signal?.aborted) throw new Error('SUB2API authorization cancelled')

  let settled = false
  const resources: { timeout?: ReturnType<typeof setTimeout> } = {}
  let resolveCallback!: (callback: LoopbackCallback) => void
  let rejectCallback!: (error: Error) => void

  const waitForCallback = new Promise<LoopbackCallback>((resolve, reject) => {
    resolveCallback = resolve
    rejectCallback = reject
  })

  const settleError = (error: Error) => {
    if (settled) return
    settled = true
    rejectCallback(error)
  }

  let expectedHost = ''
  const server = http.createServer((request, response) => {
    const requestUrl = request.url || '/'

    if (request.method !== 'GET') {
      response.writeHead(405, { ...responseHeaders, Allow: 'GET' })
      response.end(page('请求无效', '此回调只接受 GET 请求。'))
      return
    }
    if (requestUrl.length > MAX_URL_LENGTH) {
      response.writeHead(414, responseHeaders)
      response.end(page('请求无效', '回调地址过长。'))
      return
    }
    if (request.headers.host !== expectedHost) {
      response.writeHead(400, responseHeaders)
      response.end(page('请求无效', '回调 Host 不匹配。'))
      return
    }

    const url = new URL(requestUrl, `http://${expectedHost}`)
    if (url.pathname !== CALLBACK_PATH) {
      response.writeHead(404, responseHeaders)
      response.end(page('页面不存在', '未找到此回调地址。'))
      return
    }

    // A stray or malicious localhost request must not consume the real callback.
    if (url.searchParams.get('state') !== expectedState) {
      response.writeHead(400, responseHeaders)
      response.end(page('授权验证失败', '授权状态不匹配，请返回 ZeroBox 重试。'))
      return
    }

    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')
    if (error) {
      response.writeHead(200, responseHeaders)
      response.end(page('授权失败', '你可以关闭此页面并返回 ZeroBox。'))
      settleError(
        new Error(`SUB2API authorization failed: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`)
      )
      return
    }

    const code = url.searchParams.get('code')
    if (!code) {
      response.writeHead(400, responseHeaders)
      response.end(page('授权失败', '回调中缺少授权码。'))
      settleError(new Error('SUB2API callback is missing the authorization code'))
      return
    }

    response.writeHead(200, responseHeaders)
    response.end(page('授权成功', '你可以关闭此页面并返回 ZeroBox。'))
    if (!settled) {
      settled = true
      resolveCallback({ code })
    }
  })

  const close = () => {
    if (resources.timeout) clearTimeout(resources.timeout)
    signal?.removeEventListener('abort', onAbort)
    server.close()
  }
  const onAbort = () => {
    settleError(new Error('SUB2API authorization cancelled'))
    close()
  }

  await new Promise<void>((resolve, reject) => {
    const onStartupError = (error: Error) => reject(error)
    server.once('error', onStartupError)
    server.listen(0, CALLBACK_HOST, () => {
      server.off('error', onStartupError)
      resolve()
    })
  })
  server.on('error', (error) => {
    settleError(error)
    close()
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    close()
    throw new Error('Unable to determine SUB2API callback port')
  }
  expectedHost = `${CALLBACK_HOST}:${address.port}`

  resources.timeout = setTimeout(() => {
    settleError(new Error('SUB2API authorization timed out'))
    close()
  }, timeoutMs)
  if (signal?.aborted) onAbort()
  else signal?.addEventListener('abort', onAbort, { once: true })

  return {
    redirectUri: `http://${expectedHost}${CALLBACK_PATH}`,
    waitForCallback: waitForCallback.finally(close),
    close,
  }
}
