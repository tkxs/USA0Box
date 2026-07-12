import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import ChatboxAI from './models/chatboxai'

export const chatboxAIProvider = defineProvider({
  id: ModelProviderEnum.ChatboxAI,
  name: 'ZeroBox AI',
  type: ModelProviderType.ChatboxAI,
  urls: {
    website: 'https://usa0.top',
    docs: 'https://usa0.top/help-center',
  },
  createModel: (config) => {
    return new ChatboxAI(
      {
        licenseKey: config.globalSettings.licenseKey,
        model: config.model,
        licenseInstances: config.globalSettings.licenseInstances,
        licenseDetail: config.globalSettings.licenseDetail,
        language: config.globalSettings.language,
        dalleStyle: config.settings.dalleStyle || 'vivid',
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        stream: config.settings.stream,
      },
      config.config,
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings, sessionType) => {
    if (sessionType === 'picture') {
      return 'ZeroBox AI'
    }
    return `ZeroBox AI (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
