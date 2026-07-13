import { describe, expect, it } from 'vitest'
import { createGuideNavigationBlockerOptions, type GuideNavigationState } from './navigation-blocker'

describe('guide navigation blocker', () => {
  it('uses the resolver API and follows the current guide state', () => {
    let state: GuideNavigationState = {
      isGuideInProgress: true,
      hasValidConfig: false,
      onboardingCompleted: false,
      allowNavigation: false,
    }
    const options = createGuideNavigationBlockerOptions(() => state)

    expect(options.withResolver).toBe(true)
    expect(options.shouldBlockFn()).toBe(true)

    state = { ...state, allowNavigation: true }
    expect(options.shouldBlockFn()).toBe(false)
  })

  it('does not block a completed or configured guide', () => {
    const state: GuideNavigationState = {
      isGuideInProgress: true,
      hasValidConfig: true,
      onboardingCompleted: false,
      allowNavigation: false,
    }
    const options = createGuideNavigationBlockerOptions(() => state)

    expect(options.shouldBlockFn()).toBe(false)
  })
})
