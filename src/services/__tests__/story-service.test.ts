import { StoryInput, Story } from '@/types'
import { StoryService, StoryServiceError } from '../story-service'
import { createMockStory } from '@/lib/test-utils'

// Mock functions for Supabase chain - will be set in each test
let mockSingle: jest.Mock
let mockSelect: jest.Mock  
let mockInsert: jest.Mock
let mockUpdate: jest.Mock
let mockDelete: jest.Mock
let mockEq: jest.Mock
let mockOrder: jest.Mock
let mockLimit: jest.Mock
let mockRange: jest.Mock

// Mock supabase
jest.mock('@/lib/supabase', () => {
  const mockSingle = jest.fn()
  const mockSelect = jest.fn()
  const mockInsert = jest.fn()
  const mockUpdate = jest.fn()
  const mockDelete = jest.fn()
  const mockEq = jest.fn()
  const mockOrder = jest.fn()
  const mockLimit = jest.fn()
  const mockRange = jest.fn()
  
  const mockChain = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    single: mockSingle,
  }
  
  // Make all methods return the chain
  mockSelect.mockReturnValue(mockChain)
  mockInsert.mockReturnValue(mockChain)
  mockUpdate.mockReturnValue(mockChain)
  mockDelete.mockReturnValue(mockChain)
  mockEq.mockReturnValue(mockChain)
  mockOrder.mockReturnValue(mockChain)
  mockLimit.mockReturnValue(mockChain)
  mockRange.mockReturnValue(mockChain)
  
  return {
    supabaseAdmin: {
      from: jest.fn().mockReturnValue(mockChain),
    },
    // Export the mocks so we can access them in tests
    __mocks: {
      mockSingle,
      mockSelect,
      mockInsert,
      mockUpdate,
      mockDelete,
      mockEq, 
      mockOrder,
      mockLimit,
      mockRange,
      mockChain,
    },
  }
})

// Get the mocked module
const mockSupabase = require('@/lib/supabase')

describe('Story Service', () => {
  let storyService: StoryService

  beforeEach(() => {
    storyService = new StoryService()
    jest.clearAllMocks()
    
    // Get references to the mocks
    const mocks = mockSupabase.__mocks
    mockSingle = mocks.mockSingle
    mockSelect = mocks.mockSelect
    mockInsert = mocks.mockInsert
    mockUpdate = mocks.mockUpdate
    mockDelete = mocks.mockDelete
    mockEq = mocks.mockEq
    mockOrder = mocks.mockOrder
    mockLimit = mocks.mockLimit
    mockRange = mocks.mockRange
    
    // Reset all mocks to return the chain
    mockSelect.mockReturnValue(mocks.mockChain)
    mockInsert.mockReturnValue(mocks.mockChain)
    mockUpdate.mockReturnValue(mocks.mockChain)
    mockDelete.mockReturnValue(mocks.mockChain)
    mockEq.mockReturnValue(mocks.mockChain)
    mockOrder.mockReturnValue(mocks.mockChain)
    mockLimit.mockReturnValue(mocks.mockChain)
    mockRange.mockReturnValue(mocks.mockChain)
    
    // Make sure the chain methods are properly reset each time
    mocks.mockChain.select.mockReturnValue(mocks.mockChain)
    mocks.mockChain.insert.mockReturnValue(mocks.mockChain)
    mocks.mockChain.update.mockReturnValue(mocks.mockChain)
    mocks.mockChain.delete.mockReturnValue(mocks.mockChain)
    mocks.mockChain.eq.mockReturnValue(mocks.mockChain)
    mocks.mockChain.order.mockReturnValue(mocks.mockChain)
    mocks.mockChain.limit.mockReturnValue(mocks.mockChain)
    mocks.mockChain.range.mockReturnValue(mocks.mockChain)
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

      mockSingle.mockResolvedValue({
        data: expectedStory,
        error: null,
      })

      const result = await storyService.createStory(storyInput)

      expect(result).toEqual(expectedStory)
      expect(mockInsert).toHaveBeenCalledWith([{
        headline: storyInput.headline,
        hot_take: storyInput.hot_take,
        sources: storyInput.sources,
        status: 'draft',
      }])
    })

    it('should create a story without hot_take', async () => {
      const storyInput: StoryInput = {
        headline: 'Breaking News: Something Important Happened',
        sources: ['https://example.com/news'],
      }

      const expectedStory = createMockStory({
        headline: storyInput.headline,
        hot_take: null,
        sources: storyInput.sources,
        status: 'draft',
      })

      mockSingle.mockResolvedValue({
        data: expectedStory,
        error: null,
      })

      const result = await storyService.createStory(storyInput)

      expect(result).toEqual(expectedStory)
      expect(mockInsert).toHaveBeenCalledWith([{
        headline: storyInput.headline,
        hot_take: null,
        sources: storyInput.sources,
        status: 'draft',
      }])
    })

    it('should handle database connection errors', async () => {
      const storyInput: StoryInput = {
        headline: 'Test Story',
        sources: ['https://example.com'],
      }

      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      })

      await expect(storyService.createStory(storyInput))
        .rejects.toThrow(StoryServiceError)

      await expect(storyService.createStory(storyInput))
        .rejects.toThrow('Database error: Database connection failed')
    })

    it('should sanitize input data before creation', async () => {
      const storyInput: StoryInput = {
        headline: '  Breaking News  ',
        hot_take: '  Important take  ',
        sources: ['https://example.com/news'],
      }

      const sanitizedStory = createMockStory({
        headline: 'Breaking News',
        hot_take: 'Important take',
        sources: storyInput.sources,
        status: 'draft',
      })

      mockSingle.mockResolvedValue({
        data: sanitizedStory,
        error: null,
      })

      const result = await storyService.createStory(storyInput)

      expect(result).toEqual(sanitizedStory)
      expect(mockInsert).toHaveBeenCalledWith([{
        headline: 'Breaking News',
        hot_take: 'Important take',
        sources: storyInput.sources,
        status: 'draft',
      }])
    })
  })

  describe('getStory', () => {
    it('should retrieve an existing story by ID', async () => {
      const storyId = 'test-story-id'
      const expectedStory = createMockStory({ id: storyId })

      mockSingle.mockResolvedValue({
        data: expectedStory,
        error: null,
      })

      const result = await storyService.getStory(storyId)

      expect(result).toEqual(expectedStory)
      expect(mockEq).toHaveBeenCalledWith('id', storyId)
    })

    it('should return null for non-existent story', async () => {
      const nonExistentId = 'non-existent-id'

      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const result = await storyService.getStory(nonExistentId)

      expect(result).toBeNull()
      expect(mockEq).toHaveBeenCalledWith('id', nonExistentId)
    })
  })

  describe('updateStoryStatus', () => {
    it('should update story status successfully', async () => {
      const storyId = 'test-story-id'
      const currentStory = createMockStory({ id: storyId, status: 'draft' })
      const newStatus = 'editing'

      // Mock getting current story first, then updating
      mockSingle
        .mockResolvedValueOnce({
          data: currentStory,
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...currentStory, status: newStatus },
          error: null,
        })

      const result = await storyService.updateStoryStatus(storyId, newStatus)

      expect(result.status).toBe(newStatus)
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: newStatus,
        updated_at: expect.any(String),
      }))
    })

    it('should validate story status transitions', async () => {
      const storyId = 'test-story-id'
      const currentStory = createMockStory({ id: storyId, status: 'done' })
      const invalidStatus = 'draft' // Can't go from done back to draft

      mockSingle.mockResolvedValue({
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

      mockSingle.mockResolvedValue({
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
    it.skip('should delete an existing story', async () => {
      const storyId = 'test-story-id'
      const existingStory = createMockStory({ id: storyId, status: 'draft' })

      // Mock getting current story first (getStory calls single())
      mockSingle.mockResolvedValueOnce({
        data: existingStory,
        error: null,
      })

      // Mock successful deletion - eq() returns promise on second call
      mockEq.mockResolvedValueOnce({
        error: null,
      })

      await expect(storyService.deleteStory(storyId)).resolves.not.toThrow()
    })

    it.skip('should handle deletion of non-existent story', async () => {
      const nonExistentId = 'non-existent-id'

      mockSingle.mockResolvedValue({
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

      mockSingle.mockResolvedValue({
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

      // Mock the final awaited result
      mockOrder.mockResolvedValue({
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

      // Mock the final awaited result
      mockEq.mockResolvedValue({
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

      mockLimit.mockResolvedValue({
        data: limitedStories,
        error: null,
      })

      const result = await storyService.listStories({ limit: 2 })

      expect(result).toHaveLength(2)
    })

    it('should return empty array when no stories match criteria', async () => {
      mockEq.mockResolvedValue({
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

      mockSelect.mockResolvedValue({
        data: mockStories,
        error: null,
      })

      const result = await storyService.countStoriesByStatus()

      expect(result).toEqual({
        draft: 2,
        done: 1,
        failed: 1,
        editing: 1,
        generating: 0,
      })
    })

    it('should handle empty database', async () => {
      mockSelect.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await storyService.countStoriesByStatus()

      expect(result).toEqual({
        draft: 0,
        done: 0,
        failed: 0,
        editing: 0,
        generating: 0,
      })
    })
  })
})