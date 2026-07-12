/**
 * Type definitions for Guide Session
 */

/** Tool part types that can be rendered in the UI */
export type GuideToolName =
  | 'show_login_button'
  | 'show_group_key_settings_button'
  | 'show_provider_settings_button'
  | 'show_user_type_cards'
  | 'show_new_chat_button'
  | 'show_new_chat_tip'
  | 'show_view_license_button'
  | 'show_suggested_questions'
  | 'show_free_trial_link'
  | 'show_claim_waiting'
  | 'mark_completed'
  | 'activate_license'

/** A tool part in the message */
export interface GuideToolPart {
  type: `tool-${GuideToolName}`
  toolCallId: string
  toolName: GuideToolName
  state: 'pending' | 'result'
  args?: Record<string, unknown>
  result?: Record<string, unknown>
}

/** A text part in the message */
export interface GuideTextPart {
  type: 'text'
  text: string
}

/** Union type for all message parts */
export type GuideMessagePart = GuideTextPart | GuideToolPart

/** Extended message type for Guide Session */
export interface GuideUIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  parts: GuideMessagePart[]
  isStreaming?: boolean
}

/** User type selection */
export type UserType = 'novice' | 'expert'

/** Onboarding step for backend communication */
export type OnboardingStep = 'greeting' | 'selection' | 'login_flow' | 'completed'

/** Return type for useGuideSession hook */
export interface UseGuideSessionReturn {
  // State
  messages: GuideUIMessage[]
  isLoading: boolean
  error: string | null
  onboardingStep: OnboardingStep

  // Actions
  sendMessage: (content: string) => Promise<void>
  stopGeneration: () => void
  selectUserType: (type: UserType) => void
  markGuideCompleted: () => Promise<void>
  /** Called after account login; guides the user to select or create a group key. */
  handleLoginSuccess: () => Promise<void>
  /** Compatibility path for older guide tool responses; points users to group-key setup. */
  onClaimStart: () => Promise<void>
  /** Called by useClaimPolling when a license is detected; activates locally and renders the celebration. */
  onClaimDetected: (license: import('@/packages/remote').UserLicense) => Promise<void>
  handleConfigComplete: () => void
  clearSession: () => void
  debugResetGuide: () => void
  debugSkipToLoginSuccess: () => void
  debugTriggerRoundLimit: () => void

  // Computed
  canSendMessage: boolean
  hasValidConfig: boolean
  userMessageCount: number
  isGuideInProgress: boolean
}
