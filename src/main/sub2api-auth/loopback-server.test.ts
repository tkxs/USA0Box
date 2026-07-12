import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createLoopbackServer, type LoopbackServer } from './loopback-server'

interface ResponseData {
  status: number
  headers: http.IncomingHttpHeaders
}

function request(
  redirectUri: string,
  path: string,
  options: { method?: string; host?: string } = {}
): Promise<ResponseData> {
  const base = new URL(redirectUri)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port,
        path,
        method: options.method || 'GET',
        headers: { Host: options.host || base.host },
      },
      (response) => {
        response.resume()
        response.on('end', () => resolve({ status: response.statusCode || 0, headers: response.headers }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

describe('SUB2API loopback callback server', () => {
  let server: LoopbackServer | undefined

  afterEach(() => server?.close())

  it('uses a random 127.0.0.1 port and ignores a callback with the wrong state', async () => {
    server = await createLoopbackServer('expected-state', undefined, 2_000)
    expect(server.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/)

    const invalid = await request(server.redirectUri, '/oauth/callback?code=bad&state=wrong')
    expect(invalid.status).toBe(400)

    const validRequest = request(server.redirectUri, '/oauth/callback?code=valid-code&state=expected-state')
    await expect(server.waitForCallback).resolves.toEqual({ code: 'valid-code' })
    const valid = await validRequest
    expect(valid.status).toBe(200)
    expect(valid.headers['cache-control']).toBe('no-store')
    expect(valid.headers['content-security-policy']).toContain("default-src 'none'")
    expect(valid.headers['x-content-type-options']).toBe('nosniff')
  })

  it('strictly checks method, Host, callback path, and URL length without consuming the callback', async () => {
    server = await createLoopbackServer('state', undefined, 2_000)

    expect((await request(server.redirectUri, '/oauth/callback?code=x&state=state', { method: 'POST' })).status).toBe(
      405
    )
    expect(
      (await request(server.redirectUri, '/oauth/callback?code=x&state=state', { host: 'localhost' })).status
    ).toBe(400)
    expect((await request(server.redirectUri, '/callback?code=x&state=state')).status).toBe(404)
    expect((await request(server.redirectUri, `/oauth/callback?value=${'x'.repeat(4096)}`)).status).toBe(414)

    const validRequest = request(server.redirectUri, '/oauth/callback?code=final&state=state')
    await expect(server.waitForCallback).resolves.toEqual({ code: 'final' })
    await validRequest
  })
})
