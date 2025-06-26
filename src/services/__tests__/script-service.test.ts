import { ScriptService, ScriptServiceError } from '../script-service'
import { createMockStory, createMockScript } from '@/lib/test-utils'

// Mock OpenAI
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue({ model: 'gpt-4o-mini' }),
}))

// Mock AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
}))

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  },
}))

describe('ScriptService', () => {
  let scriptService: ScriptService
  let mockGenerateText: jest.Mock
  let mockSupabase: any

  beforeEach(() => {
    scriptService = new ScriptService()
    
    // Get mocked functions
    const { generateText } = require('ai')
    mockGenerateText = generateText as jest.Mock
    
    const { supabaseAdmin } = require('@/lib/supabase')
    mockSupabase = supabaseAdmin
    
    jest.clearAllMocks()
  })

  describe('generateScript', () => {
    const mockStory = createMockStory({
      headline: 'Breaking: New AI breakthrough changes everything',
      hot_take: 'This will revolutionize how we work',
      sources: ['https://example.com/news1', 'https://example.com/news2'],
    })

    it('should generate a script with valid OpenAI response', async () => {
      // Arrange
      const expectedScript = 'AI breakthrough transforms workplace efficiency across industries'
      mockGenerateText.mockResolvedValue({
        text: expectedScript,
      })
      
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: createMockScript({ text: expectedScript }),
              error: null,
            }),
          })),
        })),
      })

      // Act
      const result = await scriptService.generateScript(mockStory)

      // Assert
      expect(result.text).toBe(expectedScript)
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        prompt: expect.stringContaining(mockStory.headline),
        maxTokens: 100,
        temperature: 0.7,
      })
    })

    it('should include hot take in prompt when provided', async () => {
      // Arrange
      mockGenerateText.mockResolvedValue({ text: 'Generated script' })
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: createMockScript(),
              error: null,
            }),
          })),
        })),
      })

      // Act
      await scriptService.generateScript(mockStory)

      // Assert
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        prompt: expect.stringContaining(mockStory.hot_take!),
        maxTokens: 100,
        temperature: 0.7,
      })
    })

    it('should work without hot take', async () => {
      // Arrange
      const storyWithoutHotTake = createMockStory({
        hot_take: undefined,
      })
      mockGenerateText.mockResolvedValue({ text: 'Generated script' })
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: createMockScript(),
              error: null,
            }),
          })),
        })),
      })

      // Act
      await scriptService.generateScript(storyWithoutHotTake)

      // Assert
      expect(mockGenerateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        prompt: expect.not.stringContaining('hot take'),
        maxTokens: 100,
        temperature: 0.7,
      })
    })

    it('should validate script length (≤45 words)', async () => {
      // Arrange
      const longScript = 'This is a very long script that exceeds the maximum word limit of forty-five words by including many unnecessary words that would make the video too long for the target duration of ten to fifteen seconds which is the requirement for vertical newsbites and social media posts'
      mockGenerateText.mockResolvedValue({ text: longScript })

      // Act & Assert
      await expect(scriptService.generateScript(mockStory))
        .rejects
        .toThrow(ScriptServiceError)
      
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('should handle OpenAI API errors', async () => {
      // Arrange
      mockGenerateText.mockRejectedValue(new Error('OpenAI API rate limit'))

      // Act & Assert
      await expect(scriptService.generateScript(mockStory))
        .rejects
        .toThrow(ScriptServiceError)
    })

    it('should handle database errors when saving script', async () => {
      // Arrange
      mockGenerateText.mockResolvedValue({ text: 'Valid script under forty-five words' })
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          })),
        })),
      })

      // Act & Assert
      await expect(scriptService.generateScript(mockStory))
        .rejects
        .toThrow(ScriptServiceError)
    })

    it('should create proper prompt with RAG context', async () => {
      // Arrange
      mockGenerateText.mockResolvedValue({ text: 'Generated script' })
      mockSupabase.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: createMockScript(),
              error: null,
            }),
          })),
        })),
      })

      // Act
      await scriptService.generateScript(mockStory)

      // Assert
      const callArgs = mockGenerateText.mock.calls[0][0]
      expect(callArgs.prompt).toContain('Create a 10-15 second video script')
      expect(callArgs.prompt).toContain('45 words maximum')
      expect(callArgs.prompt).toContain('vertical newsbite')
      expect(callArgs.prompt).toContain(mockStory.headline)
      expect(callArgs.prompt).toContain('Sources:')
    })
  })

  describe('getScript', () => {
    it('should retrieve script by story ID', async () => {
      // Arrange
      const mockScript = createMockScript()
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockScript,
              error: null,
            }),
          })),
        })),
      })

      // Act
      const result = await scriptService.getScript('test-story-id')

      // Assert
      expect(result).toEqual(mockScript)
      expect(mockSupabase.from).toHaveBeenCalledWith('scripts')
    })

    it('should return null for non-existent script', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // Supabase not found error
            }),
          })),
        })),
      })

      // Act
      const result = await scriptService.getScript('non-existent-id')

      // Assert
      expect(result).toBeNull()
    })

    it('should throw error for invalid story ID', async () => {
      // Act & Assert
      await expect(scriptService.getScript(''))
        .rejects
        .toThrow(ScriptServiceError)
    })
  })

  describe('updateScript', () => {
    it('should update script text', async () => {
      // Arrange
      const updatedScript = createMockScript({ text: 'Updated script content' })
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: updatedScript,
                error: null,
              }),
            })),
          })),
        })),
      })

      // Act
      const result = await scriptService.updateScript('test-story-id', 'Updated script content')

      // Assert
      expect(result).toEqual(updatedScript)
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        text: 'Updated script content',
        edited_at: expect.any(String),
      })
    })

    it('should validate script length when updating', async () => {
      // Arrange
      const longScript = 'This is a very long script that exceeds the maximum word limit of forty-five words by including many unnecessary words that would make the video too long for the target duration of ten to fifteen seconds which is the requirement for vertical newsbites and social media posts'

      // Act & Assert
      await expect(scriptService.updateScript('test-story-id', longScript))
        .rejects
        .toThrow(ScriptServiceError)
    })

    it('should handle database errors when updating', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' },
              }),
            })),
          })),
        })),
      })

      // Act & Assert
      await expect(scriptService.updateScript('test-story-id', 'Valid script'))
        .rejects
        .toThrow(ScriptServiceError)
    })
  })
})