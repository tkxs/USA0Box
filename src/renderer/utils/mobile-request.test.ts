import { CapacitorHttp } from '@capacitor/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMobileRequest } from './mobile-request'

vi.mock('@capacitor/core', () => ({
  CapacitorHttp: {
    request: vi.fn(),
  },
}))

vi.mock('@/native/stream-http', () => ({
  createNativeReadableStream: vi.fn(),
}))

const requestMock = vi.mocked(CapacitorHttp.request)

describe('handleMobileRequest', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestMock.mockResolvedValue({
      data: '{"access_token":"access-1"}',
      headers: { 'content-type': 'application/json' },
      status: 200,
      url: 'https://usa0.top/api/v1/app-auth/token',
    })
  })

  it('passes form-encoded OAuth bodies to Capacitor without parsing them as JSON', async () => {
    const body = 'grant_type=authorization_code&client_id=zerobox-android'

    const response = await handleMobileRequest(
      'https://usa0.top/api/v1/app-auth/token',
      'POST',
      new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body
    )

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: body,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      })
    )
    await expect(response.json()).resolves.toEqual({ access_token: 'access-1' })
  })
})
