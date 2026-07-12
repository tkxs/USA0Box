export const Sub2APIAuthIpcChannels = {
  LOGIN: 'sub2api-auth:login',
  CANCEL: 'sub2api-auth:cancel',
} as const

export interface Sub2APIAuthResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  error?: string
}
