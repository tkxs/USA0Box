import { ModelProviderType } from '@shared/types'
import { getSub2APIGatewayUrl, type Sub2APIGroup } from './sub2api'

export const SUB2API_GROUP_PROVIDER_PREFIX = 'sub2api-group-'

export function getSub2APIGroupProviderId(groupId: number) {
  return `${SUB2API_GROUP_PROVIDER_PREFIX}${groupId}`
}

export function isSub2APIGroupProvider(providerId: string) {
  return providerId.startsWith(SUB2API_GROUP_PROVIDER_PREFIX)
}

export function getSub2APIGroupIdFromProviderId(providerId: string) {
  if (!isSub2APIGroupProvider(providerId)) return undefined
  const groupId = Number(providerId.slice(SUB2API_GROUP_PROVIDER_PREFIX.length))
  return Number.isInteger(groupId) && groupId > 0 ? groupId : undefined
}

export function getSub2APIGroupProviderType(platform: Sub2APIGroup['platform']): ModelProviderType {
  switch (platform) {
    case 'anthropic':
    case 'antigravity':
      return ModelProviderType.Claude
    case 'gemini':
      return ModelProviderType.Gemini
    case 'openai':
    case 'grok':
      return ModelProviderType.OpenAI
  }
}

export function getCompatibleSub2APIPlatforms(providerType: ModelProviderType): Sub2APIGroup['platform'][] {
  switch (providerType) {
    case ModelProviderType.Claude:
      return ['anthropic', 'antigravity']
    case ModelProviderType.Gemini:
      return ['gemini', 'antigravity']
    case ModelProviderType.OpenAI:
    case ModelProviderType.OpenAIResponses:
      return ['openai', 'grok']
    default:
      return []
  }
}

export function getSub2APIProviderEndpoint(
  providerType: ModelProviderType,
  platform: Sub2APIGroup['platform']
): { apiHost: string; apiPath?: string } {
  const gatewayUrl = getSub2APIGatewayUrl()

  switch (providerType) {
    case ModelProviderType.Claude:
      return { apiHost: platform === 'antigravity' ? `${gatewayUrl}/antigravity/v1` : `${gatewayUrl}/v1` }
    case ModelProviderType.Gemini:
      return { apiHost: platform === 'antigravity' ? `${gatewayUrl}/antigravity` : gatewayUrl }
    case ModelProviderType.OpenAIResponses:
      return { apiHost: gatewayUrl, apiPath: '/responses' }
    case ModelProviderType.OpenAI:
      return { apiHost: gatewayUrl, apiPath: '/chat/completions' }
    default:
      throw new Error('当前模型提供方不支持 SUB2API 分组密钥')
  }
}
