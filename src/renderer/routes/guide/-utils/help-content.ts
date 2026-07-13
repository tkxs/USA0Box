export const ZEROBOX_OFFICIAL_SITE_URL = 'https://usa0.top'
export const ZEROBOX_HELP_CENTER_URL = `${ZEROBOX_OFFICIAL_SITE_URL}/help-center`
export const ZEROBOX_RELEASES_URL = 'https://github.com/tkxs/USA0Box/releases'
export const ZEROBOX_ISSUES_URL = 'https://github.com/tkxs/USA0Box/issues'
export const ZEROBOX_REPOSITORY_URL = 'https://github.com/tkxs/USA0Box'

export function getZeroBoxHelpIntroduction(language: string) {
  if (language === 'zh-Hant') {
    return `## ZeroBox 幫助

ZeroBox 是一款多模型 AI 助手，支援 ZeroBox AI、自訂模型提供方、知識庫、圖片生成與擴充工具。對話資料預設保存在你的裝置上。

### 快速開始
- **使用 ZeroBox AI**：登入後，在「設定 > 模型提供方」選擇模型分組並建立或選擇金鑰。
- **使用自己的 API**：在模型提供方中填寫 API Key、服務地址和模型，儲存後即可切換使用。

### 常用功能
- 在「對話設定」修改名稱、系統提示、模型與生成參數。
- 上傳文件到知識庫，或在對話輸入框中附加圖片、文件與連結。
- 從側邊欄建立圖片對話；在「關於」頁檢查和安裝更新。

### 官方支援
- [ZeroBox 官網](${ZEROBOX_OFFICIAL_SITE_URL})
- [幫助中心](${ZEROBOX_HELP_CENTER_URL})
- [版本更新](${ZEROBOX_RELEASES_URL})
- [問題回報](${ZEROBOX_ISSUES_URL})

選擇下方適合你的方式繼續，或直接輸入 ZeroBox 的使用問題。`
  }

  if (language.startsWith('zh')) {
    return `## ZeroBox 帮助

ZeroBox 是一款多模型 AI 助手，支持 ZeroBox AI、自定义模型提供方、知识库、图片生成与扩展工具。对话数据默认保存在你的设备上。

### 快速开始
- **使用 ZeroBox AI**：登录后，在“设置 > 模型提供方”选择模型分组并创建或选择密钥。
- **使用自己的 API**：在模型提供方中填写 API Key、服务地址和模型，保存后即可切换使用。

### 常用功能
- 在“对话设置”修改名称、系统提示、模型与生成参数。
- 上传文件到知识库，或在对话输入框中附加图片、文件与链接。
- 从侧边栏创建图片对话；在“关于”页检查和安装更新。

### 官方支持
- [ZeroBox 官网](${ZEROBOX_OFFICIAL_SITE_URL})
- [帮助中心](${ZEROBOX_HELP_CENTER_URL})
- [版本更新](${ZEROBOX_RELEASES_URL})
- [问题反馈](${ZEROBOX_ISSUES_URL})

选择下方适合你的方式继续，或直接输入 ZeroBox 的使用问题。`
  }

  return `## ZeroBox Help

ZeroBox is a multi-model AI assistant with ZeroBox AI, custom model providers, knowledge bases, image generation, and extensible tools. Conversation data is stored on your device by default.

### Quick start
- **Use ZeroBox AI**: Sign in, then choose a model group and create or select a key under Settings > Model Providers.
- **Use your own API**: Add the API key, endpoint, and models under Model Providers, then save and select the model.

### Common tasks
- Change the name, system prompt, model, and generation options in Conversation Settings.
- Add documents to a knowledge base, or attach images, files, and links directly to a conversation.
- Start image generation from the sidebar, and check for application updates on the About page.

### Official support
- [ZeroBox website](${ZEROBOX_OFFICIAL_SITE_URL})
- [Help center](${ZEROBOX_HELP_CENTER_URL})
- [Release notes](${ZEROBOX_RELEASES_URL})
- [Report an issue](${ZEROBOX_ISSUES_URL})

Choose the option below that fits you, or ask a question about using ZeroBox.`
}

export function getZeroBoxSuggestedQuestions(language: string) {
  if (language === 'zh-Hant') {
    return [
      '如何登入 ZeroBox AI 並選擇分組金鑰？',
      '如何新增自己的 API 和模型提供方？',
      '如何切換模型並修改系統提示？',
      '如何使用知識庫和對話附件？',
      '如何生成圖片和更新 ZeroBox？',
    ]
  }
  if (language.startsWith('zh')) {
    return [
      '如何登录 ZeroBox AI 并选择分组密钥？',
      '如何添加自己的 API 和模型提供方？',
      '如何切换模型并修改系统提示？',
      '如何使用知识库和对话附件？',
      '如何生成图片和更新 ZeroBox？',
    ]
  }
  return [
    'How do I sign in to ZeroBox AI and select a group key?',
    'How do I add my own API and model provider?',
    'How do I switch models and change the system prompt?',
    'How do I use knowledge bases and conversation attachments?',
    'How do I generate images and update ZeroBox?',
  ]
}
