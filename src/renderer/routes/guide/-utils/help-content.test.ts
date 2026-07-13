import { describe, expect, it } from 'vitest'
import {
  getZeroBoxHelpIntroduction,
  getZeroBoxSuggestedQuestions,
  ZEROBOX_HELP_CENTER_URL,
  ZEROBOX_OFFICIAL_SITE_URL,
} from './help-content'

describe('ZeroBox help content', () => {
  it('uses ZeroBox product content and official URLs', () => {
    const content = getZeroBoxHelpIntroduction('zh-Hans')

    expect(content).toContain('ZeroBox 帮助')
    expect(content).toContain('ZeroBox AI')
    expect(content).toContain('知识库')
    expect(content).toContain(ZEROBOX_OFFICIAL_SITE_URL)
    expect(content).toContain(ZEROBOX_HELP_CENTER_URL)
    expect(content).not.toContain('Chatbox')
    expect(content).not.toContain('Boxy')
    expect(content).not.toContain('小红书')
  })

  it('suggests questions about current ZeroBox workflows', () => {
    const questions = getZeroBoxSuggestedQuestions('zh-Hans')

    expect(questions).toHaveLength(5)
    expect(questions.join('\n')).toContain('分组密钥')
    expect(questions.join('\n')).toContain('系统提示')
    expect(questions.join('\n')).not.toContain('Chatbox')
  })
})
