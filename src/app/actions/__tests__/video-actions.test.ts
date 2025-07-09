import { generateVideoAction, generateAdditionalVideoAction, getVideosForStoryAction } from '../video-actions'
import { createMockVideo } from '../../../lib/test-utils'

// Mock the video orchestration service
jest.mock('../../../services/video-orchestration-service', () => ({
  videoOrchestrationService: {
    generateVideoForStory: jest.fn(),
    generateAdditionalVideoForStory: jest.fn(),
  }
}))

// Mock the video service
jest.mock('../../../services/video-service', () => ({
  videoService: {
    getVideosForStory: jest.fn(),
  }
}))

describe('Video Actions', () => {
  let mockVideoOrchestrationService: any
  let mockVideoService: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockVideoOrchestrationService = require('../../../services/video-orchestration-service').videoOrchestrationService
    mockVideoService = require('../../../services/video-service').videoService
  })

  describe('generateVideoAction', () => {
    it('should successfully generate a video', async () => {
      const mockVideo = createMockVideo({
        id: 'video-123',
        story_id: 'story-123',
        filepath: 'output/story-123.mp4'
      })

      mockVideoOrchestrationService.generateVideoForStory.mockResolvedValue(mockVideo)

      const result = await generateVideoAction('story-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.video).toEqual(mockVideo)
      }
      expect(mockVideoOrchestrationService.generateVideoForStory).toHaveBeenCalledWith('story-123')
    })

    it('should handle video generation errors', async () => {
      const errorMessage = 'Video generation failed'
      mockVideoOrchestrationService.generateVideoForStory.mockRejectedValue(new Error(errorMessage))

      const result = await generateVideoAction('story-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(errorMessage)
      }
    })

    it('should handle unknown errors', async () => {
      mockVideoOrchestrationService.generateVideoForStory.mockRejectedValue('Unknown error')

      const result = await generateVideoAction('story-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Failed to generate video')
      }
    })
  })

  describe('generateAdditionalVideoAction', () => {
    it('should successfully generate an additional video', async () => {
      const mockVideo = createMockVideo({
        id: 'video-124',
        story_id: 'story-123',
        filepath: 'output/story-123-2.mp4'
      })

      mockVideoOrchestrationService.generateAdditionalVideoForStory.mockResolvedValue(mockVideo)

      const result = await generateAdditionalVideoAction('story-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.video).toEqual(mockVideo)
      }
      expect(mockVideoOrchestrationService.generateAdditionalVideoForStory).toHaveBeenCalledWith('story-123', 'gen3a_turbo')
    })

    it('should handle additional video generation errors', async () => {
      const errorMessage = 'Additional video generation failed'
      mockVideoOrchestrationService.generateAdditionalVideoForStory.mockRejectedValue(new Error(errorMessage))

      const result = await generateAdditionalVideoAction('story-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(errorMessage)
      }
    })

    it('should handle unknown errors for additional video generation', async () => {
      mockVideoOrchestrationService.generateAdditionalVideoForStory.mockRejectedValue('Unknown error')

      const result = await generateAdditionalVideoAction('story-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Failed to generate additional video')
      }
    })
  })

  describe('getVideosForStoryAction', () => {
    it('should successfully get videos for a story', async () => {
      const mockVideos = [
        createMockVideo({
          id: 'video-1',
          story_id: 'story-123',
          filepath: 'output/story-123-1.mp4',
          duration_sec: 15
        }),
        createMockVideo({
          id: 'video-2',
          story_id: 'story-123',
          filepath: 'output/story-123-2.mp4',
          duration_sec: 12
        })
      ]

      mockVideoService.getVideosForStory.mockResolvedValue(mockVideos)

      const result = await getVideosForStoryAction('story-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.videos).toEqual(mockVideos)
        expect(result.videos).toHaveLength(2)
      }
      expect(mockVideoService.getVideosForStory).toHaveBeenCalledWith('story-123')
    })

    it('should return empty array when no videos found', async () => {
      mockVideoService.getVideosForStory.mockResolvedValue([])

      const result = await getVideosForStoryAction('story-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.videos).toEqual([])
        expect(result.videos).toHaveLength(0)
      }
    })

    it('should handle errors when getting videos', async () => {
      const errorMessage = 'Database connection failed'
      mockVideoService.getVideosForStory.mockRejectedValue(new Error(errorMessage))

      const result = await getVideosForStoryAction('story-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(errorMessage)
      }
    })

    it('should handle unknown errors when getting videos', async () => {
      mockVideoService.getVideosForStory.mockRejectedValue('Unknown error')

      const result = await getVideosForStoryAction('story-123')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Failed to get videos for story')
      }
    })
  })
}) 