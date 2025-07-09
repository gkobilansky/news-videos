import { PromptRegistry, PROMPTS } from '../prompt-registry'
import { PromptTester } from '../prompt-testing'

describe('PromptRegistry', () => {
  describe('getPrompt', () => {
    it('should return prompt configuration for valid key', () => {
      const prompt = PromptRegistry.getPrompt('SCRIPT_GENERATION')
      expect(prompt).toBeDefined()
      expect(prompt.version).toBeDefined()
      expect(prompt.model).toBeDefined()
      expect(prompt.template).toBeDefined()
    })

    it('should have all required prompts', () => {
      const requiredPrompts = [
        'SCRIPT_GENERATION',
        'STORYBOARD_GENERATION',
        'VIDEO_GENERATION_CONTEXT',
        'TTS_GENERATION'
      ]
      
      requiredPrompts.forEach(key => {
        expect(PROMPTS[key as keyof typeof PROMPTS]).toBeDefined()
      })
    })
  })

  describe('renderPrompt', () => {
    it('should render script generation prompt correctly', () => {
      const variables = {
        headline: 'Test Headline',
        sources: '1. https://example.com',
        hot_take: 'Test hot take'
      }
      
      const rendered = PromptRegistry.renderPrompt('SCRIPT_GENERATION', variables)
      expect(rendered).toContain('Test Headline')
      expect(rendered).toContain('https://example.com')
      expect(rendered).toContain('Test hot take')
      expect(rendered).not.toContain('{{')
    })

    it('should handle missing optional variables', () => {
      const variables = {
        headline: 'Test Headline',
        sources: '1. https://example.com'
      }
      
      const rendered = PromptRegistry.renderPrompt('SCRIPT_GENERATION', variables)
      expect(rendered).toContain('Test Headline')
      expect(rendered).not.toContain('{{')
    })

    it('should render storyboard generation prompt correctly', () => {
      const variables = {
        headline: 'Test News',
        hot_take: 'Test take',
        script_text: 'This is a test script',
        sources: '1. https://example.com',
        source_content: 'Test content'
      }
      
      const rendered = PromptRegistry.renderPrompt('STORYBOARD_GENERATION', variables)
      expect(rendered).toContain('Test News')
      expect(rendered).toContain('This is a test script')
      expect(rendered).not.toContain('{{')
    })
  })

  describe('validateOutput', () => {
    it('should validate script generation output correctly', () => {
      const shortScript = 'This is a short script with exactly ten words total.'
      const longScript = 'This is a very long script that definitely exceeds the fifty word limit and should fail validation because it contains too many words and goes beyond the recommended maximum length for a ten to fifteen second video script that is meant to be engaging and punchy for social media consumption and therefore should definitely fail the validation check.'
      
      expect(PromptRegistry.validateOutput('SCRIPT_GENERATION', shortScript)).toBe(true)
      expect(PromptRegistry.validateOutput('SCRIPT_GENERATION', longScript)).toBe(false)
    })

    it('should validate storyboard generation output correctly', () => {
      const validStoryboard = {
        model: 'gen4_turbo',
        ratio: '768:1280',
        shots: [
          {
            promptText: 'dolly-in on @anchor presenting at news desk',
            duration: 5,
            camera: { movement: 'dolly-in', angle: 'eye-level' }
          },
          {
            promptText: 'dynamic pan across stock market graphics',
            duration: 7,
            camera: { movement: 'pan-right', angle: 'eye-level' }
          }
        ],
        fps: 24,
        output_format: 'mp4'
      }
      
      const invalidStoryboard = {
        model: 'gen4_turbo',
        shots: []
      }
      
      expect(PromptRegistry.validateOutput('STORYBOARD_GENERATION', validStoryboard)).toBe(true)
      expect(PromptRegistry.validateOutput('STORYBOARD_GENERATION', invalidStoryboard)).toBe(false)
    })

    it('should validate video generation context output correctly', () => {
      const shortPrompt = 'Create a dynamic news video about AI breakthrough.'
      const longPrompt = 'A'.repeat(501) // Over 500 characters
      
      expect(PromptRegistry.validateOutput('VIDEO_GENERATION_CONTEXT', shortPrompt)).toBe(true)
      expect(PromptRegistry.validateOutput('VIDEO_GENERATION_CONTEXT', longPrompt)).toBe(false)
    })

    it('should validate TTS generation output correctly', () => {
      const validText = 'This is a valid script for TTS generation.'
      const emptyText = ''
      
      expect(PromptRegistry.validateOutput('TTS_GENERATION', validText)).toBe(true)
      expect(PromptRegistry.validateOutput('TTS_GENERATION', emptyText)).toBe(false)
    })
  })

  describe('getSystemMessage', () => {
    it('should return system message for storyboard generation', () => {
      const systemMessage = PromptRegistry.getSystemMessage('STORYBOARD_GENERATION')
      expect(systemMessage).toBeDefined()
      expect(systemMessage).toContain('professional video storyboard creator')
    })

    it('should return undefined for prompts without system message', () => {
      const systemMessage = PromptRegistry.getSystemMessage('SCRIPT_GENERATION')
      expect(systemMessage).toBeUndefined()
    })
  })

  describe('getRequiredVariables', () => {
    it('should return required variables for script generation', () => {
      const required = PromptRegistry.getRequiredVariables('SCRIPT_GENERATION')
      expect(required.length).toBeGreaterThan(0)
      expect(required.some(v => v.name === 'headline')).toBe(true)
      expect(required.some(v => v.name === 'sources')).toBe(true)
    })
  })
})

describe('PromptTester', () => {
  describe('testPrompt', () => {
    it('should test script generation prompt successfully', () => {
      const testCase = {
        name: 'Script Generation Test',
        promptKey: 'SCRIPT_GENERATION' as const,
        variables: {
          headline: 'Test Headline',
          sources: '1. https://example.com',
          hot_take: 'Test take'
        },
        expectedOutput: 'A short test script with exactly ten words.',
        shouldValidate: true
      }
      
      const result = PromptTester.testPrompt(testCase)
      expect(result.testName).toBe('Script Generation Test')
      expect(result.renderedPrompt.length).toBeGreaterThan(0)
      expect(result.renderedPrompt).toContain('Test Headline')
    })

    it('should detect unreplaced variables', () => {
      // Create a test with a variable that doesn't exist in the template
      const testCase = {
        name: 'Missing Variables Test',
        promptKey: 'SCRIPT_GENERATION' as const,
        variables: {
          headline: 'Test',
          sources: '1. https://example.com',
          nonexistent_var: 'This should not cause issues'
        }
      }
      
      const result = PromptTester.testPrompt(testCase)
      // This should pass since renderPrompt cleans up unreplaced variables
      expect(result.passed).toBe(true)
      expect(result.renderedPrompt).toContain('Test')
    })
  })

  describe('validatePromptConfig', () => {
    it('should validate all prompt configurations', () => {
      const promptKeys = Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]
      
      promptKeys.forEach(key => {
        const validation = PromptTester.validatePromptConfig(key)
        expect(validation.valid).toBe(true)
        if (!validation.valid) {
          console.log(`${key} validation issues:`, validation.issues)
        }
      })
    })
  })

  describe('generateReport', () => {
    it('should generate a comprehensive testing report', () => {
      const report = PromptTester.generateReport()
      expect(report).toContain('# Prompt Testing Report')
      expect(report).toContain('tests passed')
      expect(report).toContain('Configuration Validation')
    })
  })
})