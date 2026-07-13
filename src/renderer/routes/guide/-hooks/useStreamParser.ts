/**
 * Stream parser hook for Guide Session API responses
 * Handles Vercel AI SDK Data Stream Protocol parsing
 */

import type { TFunction } from 'i18next'
import { activate as activateLicense } from '@/stores/premiumActions'
import type {
  GuideMessagePart,
  GuideTextPart,
  GuideToolName,
  GuideToolPart,
  GuideUIMessage,
  OnboardingStep,
} from './types'

export interface StreamParserCallbacks {
  setMessages: React.Dispatch<React.SetStateAction<GuideUIMessage[]>>
  setOnboardingStep: React.Dispatch<React.SetStateAction<OnboardingStep>>
  pendingUpdateRef: React.MutableRefObject<number | null>
  pendingTimeouts: Set<ReturnType<typeof setTimeout>>
  /** Shared "guide completed" handler from useGuideSession; renders success message + buttons + confetti */
  markGuideCompleted: () => Promise<void>
  t: TFunction
}

/**
 * Parse and process streaming response from Guide API
 */
export async function parseStreamResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamParserCallbacks
): Promise<void> {
  const { setMessages, pendingUpdateRef, markGuideCompleted, t } = callbacks

  const decoder = new TextDecoder()
  let accumulatedContent = ''
  const accumulatedParts: GuideMessagePart[] = []
  let buffer = ''
  let streamFinished = false
  // Track tool calls by ID for accumulating args
  const toolCallArgsBuffer: Record<string, string> = {}

  // Helper to append error message to accumulated content
  const appendErrorToMessage = (errorMessage: string) => {
    accumulatedContent += `\n\n${errorMessage}`
    const lastTextPart = accumulatedParts.findLast((p) => p.type === 'text') as GuideTextPart | undefined
    if (lastTextPart) {
      lastTextPart.text += `\n\n${errorMessage}`
    } else {
      accumulatedParts.push({ type: 'text', text: errorMessage })
    }
  }

  // Helper to update streaming message
  const updateStreamingMessage = () => {
    setMessages((prev) => {
      const lastIdx = prev.length - 1
      if (prev[lastIdx]?.isStreaming) {
        return [
          ...prev.slice(0, lastIdx),
          {
            ...prev[lastIdx],
            content: accumulatedContent,
            parts: [...accumulatedParts],
          },
        ]
      }
      return prev
    })
  }

  while (!streamFinished) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // Keep the last incomplete line in buffer
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      // Handle SSE format: "data: {...}"
      let jsonStr = trimmedLine
      if (trimmedLine.startsWith('data:')) {
        jsonStr = trimmedLine.slice(5).trim()
      }
      if (jsonStr === '[DONE]') {
        streamFinished = true
        break
      }

      try {
        const event = JSON.parse(jsonStr) as {
          type: string
          id?: string
          delta?: string
          toolCallId?: string
          toolName?: string
          args?: unknown
          input?: unknown
          result?: unknown
          output?: unknown
        }

        if (event.type === 'text-delta' && event.delta) {
          // Text content delta
          accumulatedContent += event.delta

          // Update or add text part
          const lastPart = accumulatedParts[accumulatedParts.length - 1]
          if (lastPart?.type === 'text') {
            lastPart.text += event.delta
          } else {
            accumulatedParts.push({ type: 'text', text: event.delta })
          }

          // Batch updates using requestAnimationFrame to reduce re-renders
          if (!pendingUpdateRef.current) {
            pendingUpdateRef.current = requestAnimationFrame(() => {
              pendingUpdateRef.current = null
              updateStreamingMessage()
            })
          }
        } else if (event.type === 'tool-input-start' && event.toolCallId && event.toolName) {
          // Tool call start - create the tool part
          toolCallArgsBuffer[event.toolCallId] = ''
          accumulatedParts.push({
            type: `tool-${event.toolName}` as GuideToolPart['type'],
            toolCallId: event.toolCallId,
            toolName: event.toolName as GuideToolName,
            state: 'pending',
            args: {},
          })
        } else if (event.type === 'tool-input-delta' && event.toolCallId && event.delta) {
          // Tool call args delta - accumulate
          toolCallArgsBuffer[event.toolCallId] = (toolCallArgsBuffer[event.toolCallId] || '') + event.delta
        } else if (event.type === 'tool-input-available' && event.toolCallId) {
          // Tool call args complete - use input directly or parse from buffer
          const toolPart = accumulatedParts.find(
            (p) => p.type.startsWith('tool-') && (p as GuideToolPart).toolCallId === event.toolCallId
          ) as GuideToolPart | undefined
          if (toolPart) {
            // Prefer direct input from event, fallback to parsing buffer
            if (event.input) {
              toolPart.args = event.input as Record<string, unknown>
            } else if (toolCallArgsBuffer[event.toolCallId]) {
              try {
                toolPart.args = JSON.parse(toolCallArgsBuffer[event.toolCallId])
              } catch {
                console.debug('Failed to parse tool args:', toolCallArgsBuffer[event.toolCallId])
              }
            }
          }
        } else if (event.type === 'tool-output-available' && event.toolCallId) {
          // Tool result available
          const toolPart = accumulatedParts.find(
            (p) => p.type.startsWith('tool-') && (p as GuideToolPart).toolCallId === event.toolCallId
          ) as GuideToolPart | undefined
          if (toolPart) {
            toolPart.state = 'result'
            toolPart.result = (event.output || event.result) as Record<string, unknown>

            // Handle mark_completed tool through the shared completion gate so users
            // without a selected key are still guided to create one first.
            if (toolPart.toolName === 'mark_completed') {
              await markGuideCompleted()
            }

            // Handle activate_license tool
            if (toolPart.toolName === 'activate_license') {
              await handleActivateLicense(toolPart, { markGuideCompleted, appendErrorToMessage, t })
            }

            // Update message with tool part
            updateStreamingMessage()
          }
        }
        // Ignore: text-start, text-end, start-step, finish-step, finish
      } catch {
        // Not valid JSON, skip
        console.debug('Skipping non-JSON line:', trimmedLine)
      }
    }
  }

  if (streamFinished) {
    await reader.cancel().catch(() => undefined)
  }

  // Mark streaming as complete
  setMessages((prev) => {
    const lastIdx = prev.length - 1
    if (prev[lastIdx]?.isStreaming) {
      return [
        ...prev.slice(0, lastIdx),
        {
          ...prev[lastIdx],
          isStreaming: false,
        },
      ]
    }
    return prev
  })
}

/**
 * Handle activate_license tool execution.
 *
 * On success, delegates to the shared markGuideCompleted handler so completion still passes
 * through the local config gate. On failure,
 * appends an inline error to the in-flight assistant message.
 */
async function handleActivateLicense(
  toolPart: GuideToolPart,
  callbacks: {
    markGuideCompleted: () => Promise<void>
    appendErrorToMessage: (msg: string) => void
    t: TFunction
  }
): Promise<void> {
  const { markGuideCompleted, appendErrorToMessage, t } = callbacks

  const licenseKey = (toolPart.args as { license_key?: string })?.license_key
  if (!licenseKey) return

  const failureMessage = t(
    'Failed to activate the license key. You can try activating manually in **Settings**, or log in to the [ZeroBox website](https://usa0.top) to view your account details.'
  )

  try {
    const result = await activateLicense(licenseKey, 'manual')
    if (result.valid) {
      await markGuideCompleted()
    } else {
      appendErrorToMessage(failureMessage)
    }
  } catch (err) {
    console.error('License activation error:', err)
    appendErrorToMessage(failureMessage)
  }
}
