import { ModelProviderType } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  getCompatibleSub2APIPlatforms,
  getSub2APIGroupIdFromProviderId,
  getSub2APIGroupProviderId,
  getSub2APIGroupProviderType,
  getSub2APIProviderEndpoint,
} from './sub2api-provider'

describe('SUB2API provider mapping', () => {
  it('filters group platforms by provider protocol', () => {
    expect(getCompatibleSub2APIPlatforms(ModelProviderType.Claude)).toEqual(['anthropic', 'antigravity'])
    expect(getCompatibleSub2APIPlatforms(ModelProviderType.Gemini)).toEqual(['gemini', 'antigravity'])
    expect(getCompatibleSub2APIPlatforms(ModelProviderType.OpenAI)).toEqual(['openai', 'grok'])
  })

  it('maps group platforms to the matching gateway endpoint', () => {
    expect(getSub2APIProviderEndpoint(ModelProviderType.Claude, 'anthropic')).toEqual({
      apiHost: 'http://localhost:18080/v1',
    })
    expect(getSub2APIProviderEndpoint(ModelProviderType.Claude, 'antigravity')).toEqual({
      apiHost: 'http://localhost:18080/antigravity/v1',
    })
    expect(getSub2APIProviderEndpoint(ModelProviderType.Gemini, 'gemini')).toEqual({
      apiHost: 'http://localhost:18080',
    })
    expect(getSub2APIProviderEndpoint(ModelProviderType.OpenAIResponses, 'openai')).toEqual({
      apiHost: 'http://localhost:18080',
      apiPath: '/responses',
    })
  })

  it('maps SUB2API groups to stable Chatbox provider identities', () => {
    expect(getSub2APIGroupProviderId(12)).toBe('sub2api-group-12')
    expect(getSub2APIGroupIdFromProviderId('sub2api-group-12')).toBe(12)
    expect(getSub2APIGroupIdFromProviderId('openai')).toBeUndefined()
    expect(getSub2APIGroupProviderType('anthropic')).toBe(ModelProviderType.Claude)
    expect(getSub2APIGroupProviderType('gemini')).toBe(ModelProviderType.Gemini)
    expect(getSub2APIGroupProviderType('grok')).toBe(ModelProviderType.OpenAI)
  })
})
