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
      expect(prompt).toContain('50 words')
      expect(prompt).toContain('Engaging')
      expect(prompt).toContain('script')
    })
  })

  describe('manual shot creation', () => {
    it('should add a new shot to existing storyboard', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      const newShot = {
        promptText: 'New manually created shot',
        duration: 10 as const,
        camera: { movement: 'pan-left' as const, angle: 'high-angle' as const }
      }
      
      // Mock successful database response for getting storyboard
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStoryboard,
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockStoryboard,
                  shots: [...mockStoryboard.shots, newShot]
                },
                error: null
              })
            })
          })
        })
      })

      const result = await scriptService.addShotToStoryboard(mockStory.id, newShot)
      
      expect(result).toBeDefined()
      expect(result.shots).toHaveLength(4)
      expect(result.shots[3]).toEqual(newShot)
    })

    it('should insert a shot at specific position', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      const newShot = {
        promptText: 'Inserted shot',
        duration: 16 as const,
        camera: { movement: 'dolly-out' as const, angle: 'bird-eye' as const }
      }
      
      const expectedShots = [
        mockStoryboard.shots[0],
        newShot,
        mockStoryboard.shots[1],
        mockStoryboard.shots[2]
      ]
      
      // Mock successful database response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStoryboard,
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockStoryboard,
                  shots: expectedShots
                },
                error: null
              })
            })
          })
        })
      })

      const result = await scriptService.insertShotAtPosition(mockStory.id, 1, newShot)
      
      expect(result).toBeDefined()
      expect(result.shots).toHaveLength(4)
      expect(result.shots[1]).toEqual(newShot)
    })

    it('should remove a shot from storyboard', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      
      const expectedShots = [
        mockStoryboard.shots[0],
        mockStoryboard.shots[2]
      ]
      
      // Mock successful database response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStoryboard,
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockStoryboard,
                  shots: expectedShots
                },
                error: null
              })
            })
          })
        })
      })

      const result = await scriptService.removeShotFromStoryboard(mockStory.id, 1)
      
      expect(result).toBeDefined()
      expect(result.shots).toHaveLength(2)
      expect(result.shots[0]).toEqual(mockStoryboard.shots[0])
      expect(result.shots[1]).toEqual(mockStoryboard.shots[2])
    })

    it('should validate shot data before adding', async () => {
      const invalidShot = {
        promptText: '',
        duration: 7 as any, // Invalid duration
        camera: { movement: 'invalid' as any, angle: 'eye-level' as const }
      }

      await expect(scriptService.addShotToStoryboard(mockStory.id, invalidShot))
        .rejects
        .toThrow('Invalid shot data')
    })

    it('should handle errors when storyboard not found', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      })

      const newShot = {
        promptText: 'New shot',
        duration: 5 as const,
        camera: { movement: 'static' as const, angle: 'eye-level' as const }
      }

      await expect(scriptService.addShotToStoryboard(mockStory.id, newShot))
        .rejects
        .toThrow('Storyboard not found')
    })

    it('should validate position bounds when inserting', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStoryboard,
              error: null
            })
          })
        })
      })

      const newShot = {
        promptText: 'New shot',
        duration: 5 as const,
        camera: { movement: 'static' as const, angle: 'eye-level' as const }
      }

      await expect(scriptService.insertShotAtPosition(mockStory.id, -1, newShot))
        .rejects
        .toThrow('Invalid position')

      await expect(scriptService.insertShotAtPosition(mockStory.id, 10, newShot))
        .rejects
        .toThrow('Invalid position')
    })

    it('should validate position bounds when removing', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockStoryboard,
              error: null
            })
          })
        })
      })

      await expect(scriptService.removeShotFromStoryboard(mockStory.id, -1))
        .rejects
        .toThrow('Invalid position')

      await expect(scriptService.removeShotFromStoryboard(mockStory.id, 10))
        .rejects
        .toThrow('Invalid position')
    })
  })
})