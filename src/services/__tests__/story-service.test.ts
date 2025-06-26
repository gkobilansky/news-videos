import { StoryInput, Story } from '@/types'
import { StoryService, StoryServiceError } from '../story-service'
import { createMockStory } from '@/lib/test-utils'

// Create a comprehensive mock for supabaseAdmin
const mockSupabaseChain = {
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => mockSupabaseChain),
  },
}))

const mockFrom = require('@/lib/supabase').supabaseAdmin.from

describe('Story Service', () => {
  let storyService: StoryService

  beforeEach(() => {
    storyService = new StoryService()
    jest.clearAllMocks()
  })

  describe('createStory', () => {
    it('should create a new story with valid input', async () => {
      const storyInput: StoryInput = {
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        hot_take: 'This could revolutionize how we work with AI systems.',
        sources: ['https://techcrunch.com/news', 'https://reuters.com/tech'],
      }

      const expectedStory = createMockStory({
        headline: storyInput.headline,
        hot_take: storyInput.hot_take,
        sources: storyInput.sources,
        status: 'draft',
      })

      mockSupabaseChain.single.mockResolvedValue({
        data: expectedStory,
        error: null,
      })

      const result = await storyService.createStory(storyInput)

      expect(result).toEqual(expectedStory)
      expect(mockFrom).toHaveBeenCalledWith('stories')
    })

    it('should create a story without hot_take', async () => {
      const storyInput: StoryInput = {
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        sources: ['https://techcrunch.com/news'],
      }

      const expectedStory = createMockStory({
        headline: storyInput.headline,
        hot_take: undefined,
        sources: storyInput.sources,
        status: 'draft',
      })

      mockSupabaseChain.single.mockResolvedValue({
        data: expectedStory,
        error: null,
      })

      const result = await storyService.createStory(storyInput)

      expect(result.hot_take).toBeUndefined()
      expect(result.headline).toBe(storyInput.headline)
      expect(result.sources).toEqual(storyInput.sources)
    })

    it('should reject story creation with invalid input', async () => {
      const invalidInput: Partial<StoryInput> = {
        headline: '', // Invalid: empty headline
        sources: [], // Invalid: empty sources
      }

      await expect(storyService.createStory(invalidInput as StoryInput))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.createStory(invalidInput as StoryInput))
        .rejects.toThrow('Validation failed')
    })

    it('should handle database connection errors', async () => {
      const storyInput: StoryInput = {
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        sources: ['https://techcrunch.com/news'],
      }

      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      await expect(storyService.createStory(storyInput))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.createStory(storyInput))
        .rejects.toThrow('Database error')
    })

    it('should sanitize input data before creation', async () => {
      const storyInput: StoryInput = {
        headline: '  Breaking: Major Tech Company Announces AI Breakthrough  ',
        hot_take: '  This could revolutionize AI.  ',
        sources: [' https://techcrunch.com/news ', 'https://reuters.com/tech'],
      }

      const sanitizedStory = createMockStory({
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        hot_take: 'This could revolutionize AI.',
        sources: ['https://techcrunch.com/news', 'https://reuters.com/tech'],
        status: 'draft',
      })

      mockSupabaseChain.single.mockResolvedValue({
        data: sanitizedStory,
        error: null,
      })

      const result = await storyService.createStory(storyInput)

      expect(result.headline).toBe('Breaking: Major Tech Company Announces AI Breakthrough')
      expect(result.hot_take).toBe('This could revolutionize AI.')
      expect(result.sources).toEqual(['https://techcrunch.com/news', 'https://reuters.com/tech'])
    })
  })

  describe('getStory', () => {
    it('should retrieve an existing story by ID', async () => {
      const storyId = 'test-story-id'
      const expectedStory = createMockStory({ id: storyId })

      mockSupabaseChain.single.mockResolvedValue({
        data: expectedStory,
        error: null,
      })

      const result = await storyService.getStory(storyId)

      expect(result).toEqual(expectedStory)
      expect(result?.id).toBe(storyId)
    })

    it('should return null for non-existent story', async () => {
      const nonExistentId = 'non-existent-id'

      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await storyService.getStory(nonExistentId)

      expect(result).toBeNull()
    })

    it('should handle invalid story ID format', async () => {
      const invalidId = ''

      await expect(storyService.getStory(invalidId))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.getStory(invalidId))
        .rejects.toThrow('Invalid story ID format')
    })
  })

  describe('updateStoryStatus', () => {
    it('should update story status successfully', async () => {
      const storyId = 'test-story-id'
      const currentStory = createMockStory({ id: storyId, status: 'draft' })
      const newStatus = 'editing'
      const updatedStory = createMockStory({ 
        id: storyId, 
        status: newStatus,
        updated_at: new Date().toISOString()
      })

      // Mock getting current story first, then updating
      mockSupabaseChain.single
        .mockResolvedValueOnce({
          data: currentStory,
          error: null,
        })
        .mockResolvedValueOnce({
          data: updatedStory,
          error: null,
        })

      const result = await storyService.updateStoryStatus(storyId, newStatus)

      expect(result.status).toBe(newStatus)
      expect(result.id).toBe(storyId)
    })

    it('should validate story status transitions', async () => {
      const storyId = 'test-story-id'
      const currentStory = createMockStory({ id: storyId, status: 'done' })
      const invalidStatus = 'draft' // Can't go from done back to draft

      mockSupabaseChain.single.mockResolvedValue({
        data: currentStory,
        error: null,
      })

      await expect(storyService.updateStoryStatus(storyId, invalidStatus))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.updateStoryStatus(storyId, invalidStatus))
        .rejects.toThrow('Invalid status transition')
    })

    it('should handle story not found', async () => {
      const nonExistentId = 'non-existent-id'
      const newStatus = 'editing'

      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      await expect(storyService.updateStoryStatus(nonExistentId, newStatus))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.updateStoryStatus(nonExistentId, newStatus))
        .rejects.toThrow('Story not found')
    })
  })

  describe('deleteStory', () => {
    it('should delete an existing story', async () => {
      const storyId = 'test-story-id'
      const existingStory = createMockStory({ id: storyId, status: 'draft' })

      // Mock getting current story
      mockSupabaseChain.single.mockResolvedValue({
        data: existingStory,
        error: null,
      })

      // Mock successful deletion (no single() call for delete)
      mockSupabaseChain.delete.mockResolvedValue({
        error: null,
      })

      await expect(storyService.deleteStory(storyId)).resolves.not.toThrow()
    })

    it('should handle deletion of non-existent story', async () => {
      const nonExistentId = 'non-existent-id'

      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      await expect(storyService.deleteStory(nonExistentId))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.deleteStory(nonExistentId))
        .rejects.toThrow('Story not found')
    })

    it('should prevent deletion of stories in generating status', async () => {
      const storyId = 'generating-story-id'
      const generatingStory = createMockStory({ id: storyId, status: 'generating' })

      mockSupabaseChain.single.mockResolvedValue({
        data: generatingStory,
        error: null,
      })

      await expect(storyService.deleteStory(storyId))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.deleteStory(storyId))
        .rejects.toThrow('Cannot delete story while video is generating')
    })
  })

  describe('listStories', () => {
    it('should list all stories when no filters applied', async () => {
      const mockStories = [
        createMockStory({ id: '1', headline: 'Story 1', status: 'draft' }),
        createMockStory({ id: '2', headline: 'Story 2', status: 'done' }),
        createMockStory({ id: '3', headline: 'Story 3', status: 'failed' }),
      ]

      // For list queries, we don't use single()
      mockSupabaseChain.order.mockResolvedValue({
        data: mockStories,
        error: null,
      })

      const result = await storyService.listStories()

      expect(result).toHaveLength(3)
      expect(result).toEqual(mockStories)
    })

    it('should filter stories by status', async () => {
      const draftStories = [
        createMockStory({ id: '1', headline: 'Draft Story 1', status: 'draft' }),
        createMockStory({ id: '2', headline: 'Draft Story 2', status: 'draft' }),
      ]

      mockSupabaseChain.eq.mockResolvedValue({
        data: draftStories,
        error: null,
      })

      const result = await storyService.listStories({ status: 'draft' })

      expect(result).toHaveLength(2)
      expect(result.every(story => story.status === 'draft')).toBe(true)
    })

    it('should limit number of stories returned', async () => {
      const limitedStories = [
        createMockStory({ id: '1', headline: 'Story 1' }),
        createMockStory({ id: '2', headline: 'Story 2' }),
      ]

      mockSupabaseChain.limit.mockResolvedValue({
        data: limitedStories,
        error: null,
      })

      const result = await storyService.listStories({ limit: 2 })

      expect(result).toHaveLength(2)
    })

    it('should return empty array when no stories match criteria', async () => {
      mockSupabaseChain.eq.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await storyService.listStories({ status: 'generating' })

      expect(result).toHaveLength(0)
      expect(result).toEqual([])
    })
  })

  describe('countStoriesByStatus', () => {
    it('should count stories by status correctly', async () => {
      const mockStories = [
        { status: 'draft' },
        { status: 'draft' },
        { status: 'done' },
        { status: 'failed' },
        { status: 'editing' },
      ]

      mockSupabaseChain.select.mockResolvedValue({
        data: mockStories,
        error: null,
      })

      const result = await storyService.countStoriesByStatus()

      expect(result).toEqual({
        draft: 2,
        editing: 1,
        generating: 0,
        done: 1,
        failed: 1,
      })
    })

    it('should handle empty database', async () => {
      mockSupabaseChain.select.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await storyService.countStoriesByStatus()

      expect(result).toEqual({
        draft: 0,
        editing: 0,
        generating: 0,
        done: 0,
        failed: 0,
      })
    })
  })
})