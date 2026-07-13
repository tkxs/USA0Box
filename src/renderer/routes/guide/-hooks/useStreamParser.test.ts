import { vi } from 'vitest'
import type { GuideUIMessage } from './types'

vi.mock('@/stores/premiumActions', () => ({
  activate: vi.fn(),
}))

import { parseStreamResponse, type StreamParserCallbacks } from './useStreamParser'

function createCallbacks(messages: GuideUIMessage[]): StreamParserCallbacks {
  return {
    setMessages: (updater) => {
      const next = typeof updater === 'function' ? updater(messages) : updater
      messages.splice(0, messages.length, ...next)
    },
    setOnboardingStep: vi.fn(),
    pendingUpdateRef: { current: null },
    pendingTimeouts: new Set(),
    markGuideCompleted: vi.fn(async () => undefined),
    t: vi.fn((key: string) => key) as StreamParserCallbacks['t'],
  }
}

describe('parseStreamResponse', () => {
  it('finishes when an SSE done marker arrives without waiting for the connection to close', async () => {
    const messages: GuideUIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'complete answer',
        parts: [{ type: 'text', text: 'complete answer' }],
        isStreaming: true,
      },
    ]
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      },
      cancel() {
        cancelled = true
      },
    })
    const reader = stream.getReader()
    const parsing = parseStreamResponse(reader, createCallbacks(messages))

    const result = await Promise.race([
      parsing.then(() => 'resolved'),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 50)),
    ])
    if (result === 'timed-out') {
      await reader.cancel()
      await parsing
    }

    expect(result).toBe('resolved')
    expect(cancelled).toBe(true)
    expect(messages[0].isStreaming).toBe(false)
  })
})
