import { PromptRegistry, PromptKey, PromptConfig } from './prompt-registry'

export interface PromptTestCase {
  name: string
  promptKey: PromptKey
  variables: Record<string, any>
  expectedOutput?: any
  shouldValidate?: boolean
  description?: string
}

export interface PromptTestResult {
  testName: string
  promptKey: PromptKey
  passed: boolean
  renderedPrompt: string
  error?: string
  validationResult?: boolean
  metadata?: any
}

export class PromptTester {
  /**
   * Test a specific prompt configuration
   */
  static testPrompt(testCase: PromptTestCase): PromptTestResult {
    const result: PromptTestResult = {
      testName: testCase.name,
      promptKey: testCase.promptKey,
      passed: false,
      renderedPrompt: ''
    }

    try {
      // Test prompt rendering
      const renderedPrompt = PromptRegistry.renderPrompt(testCase.promptKey, testCase.variables)
      result.renderedPrompt = renderedPrompt

      // Test validation if expected output is provided
      if (testCase.expectedOutput !== undefined) {
        const isValid = PromptRegistry.validateOutput(testCase.promptKey, testCase.expectedOutput)
        result.validationResult = isValid
        
        if (testCase.shouldValidate !== undefined) {
          result.passed = isValid === testCase.shouldValidate
        } else {
          result.passed = isValid
        }
      } else {
        // If no expected output, just test that rendering works
        result.passed = renderedPrompt.length > 0
      }

      // Check for unreplaced variables
      const unreplacedVars = renderedPrompt.match(/{{[^}]+}}/g)
      if (unreplacedVars) {
        result.error = `Unreplaced variables found: ${unreplacedVars.join(', ')}`
        result.passed = false
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      result.passed = false
    }

    return result
  }

  /**
   * Test all prompts with sample data
   */
  static testAllPrompts(): PromptTestResult[] {
    const testCases: PromptTestCase[] = [
      {
        name: 'Script Generation - Basic',
        promptKey: 'SCRIPT_GENERATION',
        variables: {
          headline: 'Breaking: New AI Technology Breakthrough',
          sources: '1. https://example.com/news\n2. https://example.com/source',
          hot_take: 'This could revolutionize the industry'
        },
        expectedOutput: 'A groundbreaking AI technology has been announced that could transform how we work.',
        shouldValidate: true
      },
      {
        name: 'Script Generation - Too Long',
        promptKey: 'SCRIPT_GENERATION',
        variables: {
          headline: 'Breaking: New AI Technology Breakthrough',
          sources: '1. https://example.com/news',
          hot_take: 'This is interesting'
        },
        expectedOutput: '',
        shouldValidate: false
      },
      {
        name: 'Storyboard Generation - Valid',
        promptKey: 'STORYBOARD_GENERATION',
        variables: {
          headline: 'Tech Stock Surge',
          hot_take: 'Market volatility ahead',
          script_text: 'Tech stocks are surging today as investors react to AI developments.',
          sources: '1. https://example.com/market',
          source_content: 'Market analysis shows significant growth...'
        },
        expectedOutput: {
          model: 'gen4_turbo',
          ratio: '768:1280',
          shots: [
            {
              promptText: 'dolly-in on professional news presenter in business attire presenting at news desk',
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
        },
        shouldValidate: true
      },
      {
        name: 'Storyboard Generation - Invalid (Missing Shots)',
        promptKey: 'STORYBOARD_GENERATION',
        variables: {
          headline: 'Test News',
          script_text: 'Test script',
          sources: '1. https://example.com'
        },
        expectedOutput: {
          model: 'gen4_turbo',
          ratio: '768:1280',
          shots: [],
          fps: 24
        },
        shouldValidate: false
      },
      {
        name: 'Video Generation Context',
        promptKey: 'VIDEO_GENERATION_CONTEXT',
        variables: {
          base_prompt: 'Create a dynamic vertical news video for: AI breakthrough',
          style_prompt: 'High-tech futuristic environment with digital graphics',
          hot_take_context: ' Key theme: Revolutionary technology'
        },
        expectedOutput: 'Create a dynamic vertical news video for: AI breakthrough. High-tech futuristic environment with digital graphics. Professional news broadcast quality, vibrant colors, dynamic camera movement. Key theme: Revolutionary technology',
        shouldValidate: true
      },
      {
        name: 'TTS Generation',
        promptKey: 'TTS_GENERATION',
        variables: {
          script_text: 'This is a test script for text-to-speech conversion.'
        },
        expectedOutput: 'This is a test script for text-to-speech conversion.',
        shouldValidate: true
      }
    ]

    return testCases.map(testCase => this.testPrompt(testCase))
  }

  /**
   * Validate prompt configuration
   */
  static validatePromptConfig(promptKey: PromptKey): { valid: boolean; issues: string[] } {
    const issues: string[] = []
    const prompt = PromptRegistry.getPrompt(promptKey)

    // Check required fields
    if (!prompt.version) issues.push('Missing version')
    if (!prompt.model) issues.push('Missing model')
    if (!prompt.template) issues.push('Missing template')

    // Check metadata
    if (prompt.metadata) {
      if (!prompt.metadata.variables) issues.push('Missing variables definition')
      if (!prompt.metadata.outputFormat) issues.push('Missing output format')
      
      // Check for template variables that aren't defined in metadata
      const templateVars = prompt.template.match(/{{([^}]+)}}/g)
      if (templateVars) {
        const definedVars = prompt.metadata.variables?.map(v => v.name) || []
        const undefinedVars = templateVars
          .map(v => v.replace(/[{}]/g, ''))
          .filter(v => !definedVars.includes(v))
        
        if (undefinedVars.length > 0) {
          issues.push(`Undefined template variables: ${undefinedVars.join(', ')}`)
        }
      }
    }

    return { valid: issues.length === 0, issues }
  }

  /**
   * Generate a prompt performance report
   */
  static generateReport(): string {
    const results = this.testAllPrompts()
    const passed = results.filter(r => r.passed).length
    const total = results.length

    let report = `# Prompt Testing Report\n\n`
    report += `**Status**: ${passed}/${total} tests passed\n\n`

    results.forEach(result => {
      const status = result.passed ? '✅' : '❌'
      report += `${status} **${result.testName}**\n`
      
      if (result.error) {
        report += `   Error: ${result.error}\n`
      }
      
      if (result.validationResult !== undefined) {
        report += `   Validation: ${result.validationResult ? 'PASSED' : 'FAILED'}\n`
      }
      
      report += `   Rendered: ${result.renderedPrompt.substring(0, 100)}...\n\n`
    })

    // Configuration validation
    report += `## Configuration Validation\n\n`
    const promptKeys = Object.keys(PromptRegistry.getAllPrompts()) as PromptKey[]
    
    promptKeys.forEach(key => {
      const validation = this.validatePromptConfig(key)
      const status = validation.valid ? '✅' : '❌'
      report += `${status} **${key}**\n`
      
      if (!validation.valid) {
        validation.issues.forEach(issue => {
          report += `   - ${issue}\n`
        })
      }
      report += '\n'
    })

    return report
  }
}

export default PromptTester