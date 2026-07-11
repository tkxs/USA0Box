import { useQuery } from '@tanstack/react-query'
import { getSub2APISiteName } from '@/packages/sub2api'

export const SUB2API_SITE_NAME_QUERY_KEY = ['sub2apiPublicSettings', 'siteName'] as const

export function useSub2APISiteName() {
  const query = useQuery({
    queryKey: SUB2API_SITE_NAME_QUERY_KEY,
    queryFn: getSub2APISiteName,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  return query.data || ''
}
