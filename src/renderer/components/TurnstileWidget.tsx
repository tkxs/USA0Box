import { Alert, Box } from '@mantine/core'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  theme: 'auto'
  size: 'flexible'
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<void> | undefined

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-zerobox-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile 加载失败')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.zeroboxTurnstile = 'true'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile 加载失败')), { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    scriptPromise = undefined
    throw error
  })

  return scriptPromise
}

export interface TurnstileWidgetHandle {
  reset: () => void
}

interface TurnstileWidgetProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire: () => void
  onError: () => void
}

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ siteKey, onVerify, onExpire, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string>()
    const [loadError, setLoadError] = useState('')

    useImperativeHandle(ref, () => ({
      reset: () => window.turnstile?.reset(widgetIdRef.current),
    }))

    useEffect(() => {
      let disposed = false

      void loadTurnstileScript()
        .then(() => {
          if (disposed || !window.turnstile || !containerRef.current || !siteKey) return
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: onVerify,
            'expired-callback': onExpire,
            'error-callback': onError,
            theme: 'auto',
            size: 'flexible',
          })
        })
        .catch((error) => {
          if (disposed) return
          setLoadError(error instanceof Error ? error.message : 'Turnstile 加载失败')
          onError()
        })

      return () => {
        disposed = true
        if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current)
        widgetIdRef.current = undefined
      }
    }, [onError, onExpire, onVerify, siteKey])

    if (loadError) return <Alert color="red">{loadError}</Alert>

    return <Box ref={containerRef} w="100%" mih={65} />
  }
)

TurnstileWidget.displayName = 'TurnstileWidget'
