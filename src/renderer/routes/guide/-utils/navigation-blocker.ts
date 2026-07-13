export interface GuideNavigationState {
  isGuideInProgress: boolean
  hasValidConfig: boolean
  onboardingCompleted: boolean
  allowNavigation: boolean
}

export function createGuideNavigationBlockerOptions(getState: () => GuideNavigationState) {
  const shouldBlockFn = () => {
    const state = getState()
    return state.isGuideInProgress && !state.hasValidConfig && !state.onboardingCompleted && !state.allowNavigation
  }

  return {
    shouldBlockFn,
    enableBeforeUnload: shouldBlockFn,
    withResolver: true as const,
  }
}
