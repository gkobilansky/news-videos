import { ScriptService, ScriptServiceError } from '../script-service'
import { createMockStory, createMockScript, createMockStoryboard } from '../../lib/test-utils'

// Mock AI SDK completely
jest.mock('ai', () => ({
  generateText: jest.fn(),
  tool: jest.fn()
}))

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }))
  }
}))

// Mock global fetch for source content fetching
global.fetch = jest.fn()

describe('ScriptService', () => {
  let scriptService: ScriptService
  const mockStory = createMockStory()
  const mockScript = createMockScript()
  const mockStoryboard = createMockStoryboard()

  beforeEach(() => {
    scriptService = new ScriptService()
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should be instantiated correctly', () => {
      expect(scriptService).toBeInstanceOf(ScriptService)
    })

    it('should have all required methods', () => {
      expect(typeof scriptService.generateScript).toBe('function')
      expect(typeof scriptService.generateStoryboard).toBe('function')
      expect(typeof scriptService.getScript).toBe('function')
      expect(typeof scriptService.getStoryboard).toBe('function')
      expect(typeof scriptService.updateStoryboard).toBe('function')
    })
  })

  describe('input validation', () => {
    it('should validate story ID format for getScript', async () => {
      await expect(scriptService.getScript('')).rejects.toThrow(ScriptServiceError)
      await expect(scriptService.getScript('   ')).rejects.toThrow(ScriptServiceError)
    })

    it('should validate story ID format for getStoryboard', async () => {
      await expect(scriptService.getStoryboard('')).rejects.toThrow(ScriptServiceError)
      await expect(scriptService.getStoryboard('   ')).rejects.toThrow(ScriptServiceError)
    })

    it('should validate story ID format for updateStoryboard', async () => {
      const mockShots = [
        {
          promptText: 'Test shot',
          duration: 5 as const,
          camera: { movement: 'static' as const, angle: 'eye-level' as const }
        }
      ]
      
      await expect(scriptService.updateStoryboard('', mockShots)).rejects.toThrow(ScriptServiceError)
      await expect(scriptService.updateStoryboard('   ', mockShots)).rejects.toThrow(ScriptServiceError)
    })
  })

  describe('storyboard validation', () => {
    it('should validate shot structure', () => {
      const validateMethod = (scriptService as any).validateStoryboardShots.bind(scriptService)
      
      // Should reject non-array
      expect(() => validateMethod({})).toThrow(ScriptServiceError)
      
      // Should reject wrong number of shots
      expect(() => validateMethod([])).toThrow(ScriptServiceError)
      expect(() => validateMethod([{}, {}, {}, {}])).toThrow(ScriptServiceError)
      
      // Should reject shots missing promptText
      expect(() => validateMethod([{}, {}, {}])).toThrow(ScriptServiceError)
      
      // Should reject shots with invalid duration
      expect(() => validateMethod([
        { promptText: 'test', duration: 3 },
        { promptText: 'test', duration: 5 },
        { promptText: 'test', duration: 10 }
      ])).toThrow(ScriptServiceError)
    })

    it('should accept valid shot structure', () => {
      const validateMethod = (scriptService as any).validateStoryboardShots.bind(scriptService)
      
      const validShots = [
        { promptText: 'Shot 1', duration: 5 },
        { promptText: 'Shot 2', duration: 10 },
        { promptText: 'Shot 3', duration: 16 }
      ]
      
      expect(() => validateMethod(validShots)).not.toThrow()
    })
  })

  describe('source content extraction', () => {
    it('should extract title from HTML', () => {
      const extractMethod = (scriptService as any).extractTitleFromHTML.bind(scriptService)
      
      const html = '<html><head><title>Test Title</title></head><body></body></html>'
      expect(extractMethod(html)).toBe('Test Title')
    })

    it('should extract content from HTML', () => {
      const extractMethod = (scriptService as any).extractContentFromHTML.bind(scriptService)
      
      const html = '<html><body><p>Test content</p><script>alert("test")</script></body></html>'
      const result = extractMethod(html)
      
      expect(result).toContain('Test content')
      expect(result).not.toContain('alert')
    })
  })

  describe('prompt building', () => {
    it('should build script prompt with story context', () => {
      const buildMethod = (scriptService as any).buildScriptPrompt.bind(scriptService)
      
      const prompt = buildMethod(mockStory)
      
      expect(prompt).toContain('Test Headline')
      expect(prompt).toContain('Test hot take')
      expect(prompt).toContain('https://example.com/source1')
      expect(prompt).toContain('45 words')
      expect(prompt).toContain('Engaging')
      expect(prompt).toContain('script')
    })
  })
})