import { describe, expect, it, vi } from 'vitest'
import type { ModelDependencies } from '../../../types/adapters'
import type { SentryScope } from '../../../utils/sentry_adapter'
import CustomGemini from './custom-gemini'

const mockScope: SentryScope = {
  setTag: vi.fn(),
  setExtra: vi.fn(),
}

function createDependencies(apiRequest: ModelDependencies['request']['apiRequest']): ModelDependencies {
  return {
    request: {
      fetchWithOptions: vi.fn(),
      apiRequest,
    },
    storage: {
      saveImage: vi.fn(),
      getImage: vi.fn(),
    },
    sentry: {
      captureException: vi.fn(),
      withScope: vi.fn((callback: (scope: SentryScope) => void) => callback(mockScope)),
    },
    getRemoteConfig: vi.fn(),
    platformType: 'desktop',
  }
}

describe('CustomGemini listModels', () => {
  it('sends the API key in a header instead of the URL', async () => {
    const apiRequest = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-test',
              displayName: 'Gemini Test',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 1000,
              outputTokenLimit: 100,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    const gemini = new CustomGemini(
      {
        apiKey: 'sk-group-key',
        apiHost: 'http://localhost:18080',
        model: { modelId: 'gemini-test' },
      },
      createDependencies(apiRequest)
    )

    await expect(gemini.listModels()).resolves.toMatchObject([{ modelId: 'gemini-test' }])
    expect(apiRequest).toHaveBeenCalledWith({
      url: 'http://localhost:18080/v1beta/models',
      method: 'GET',
      headers: { 'x-goog-api-key': 'sk-group-key' },
    })
  })
})
