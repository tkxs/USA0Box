import { useCallback, useMemo } from 'react'
import { logoutFromSub2API } from '@/packages/sub2api'
import { authInfoStore, useAuthInfoStore } from '@/stores/authInfoStore'
import queryClient from '@/stores/queryClient'
import type { AuthTokens } from './types'

export function useAuthTokens() {
  const accessToken = useAuthInfoStore((state) => state.accessToken)
  const refreshToken = useAuthInfoStore((state) => state.refreshToken)

  const isLoggedIn = useMemo(() => {
    return !!accessToken && !!refreshToken
  }, [accessToken, refreshToken])

  const saveAuthTokens = useCallback(async (tokens: AuthTokens) => {
    try {
      await authInfoStore.getState().setTokens(tokens)
    } catch (error) {
      console.error('❌ Failed to save tokens:', error)
      throw error
    }
  }, [])

  const clearAuthTokens = useCallback(async () => {
    try {
      await logoutFromSub2API()
      authInfoStore.getState().clearTokens()
      queryClient.removeQueries({ queryKey: ['sub2apiAccountConfig'] })
    } catch (error) {
      console.error('Failed to clear auth tokens:', error)
    }
  }, [])

  return {
    isLoggedIn,
    clearAuthTokens,
    saveAuthTokens,
  }
}
