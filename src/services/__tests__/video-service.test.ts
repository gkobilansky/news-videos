import { VideoService, VideoServiceError } from '../video-service'
import { createMockVideo } from '../../lib/test-utils'
import { Video } from '../../types'

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
        single: jest.fn(),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}))

describe('VideoService', () => {
  let videoService: VideoService
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = require('../../lib/supabase').supabaseAdmin
    videoService = new VideoService()
  })

  describe('getVideosForStory', () => {
    it('should return all videos for a story', async () => {
      const mockVideos = [
        createMockVideo({
          id: 'video-1',
          story_id: 'story-123',
          filepath: 'output/story-123-1.mp4',
          duration_sec: 15,
        }),
        createMockVideo({
          id: 'video-2',
          story_id: 'story-123',
          filepath: 'output/story-123-2.mp4',
          duration_sec: 12,
        }),
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockVideos,
              error: null,
            }),
          }),
        }),
      })

      const result = await videoService.getVideosForStory('story-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('videos')
      expect(result).toEqual(mockVideos)
    })

    it('should return empty array when no videos found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      })

      const result = await videoService.getVideosForStory('story-123')

      expect(result).toEqual([])
    })

    it('should throw error when story ID is invalid', async () => {
      await expect(
        videoService.getVideosForStory('')
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.getVideosForStory('   ')
      ).rejects.toThrow(VideoServiceError)
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          }),
        }),
      })

      await expect(
        videoService.getVideosForStory('story-123')
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.getVideosForStory('story-123')
      ).rejects.toThrow('Database error')
    })
  })

  describe('getVideo', () => {
    it('should return a video by ID', async () => {
      const mockVideo = createMockVideo({
        id: 'video-123',
        story_id: 'story-123',
        filepath: 'output/story-123.mp4',
      })

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockVideo,
              error: null,
            }),
          }),
        }),
      })

      const result = await videoService.getVideo('video-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('videos')
      expect(result).toEqual(mockVideo)
    })

    it('should return null when video not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // Not found error code
            }),
          }),
        }),
      })

      const result = await videoService.getVideo('nonexistent-video')

      expect(result).toBeNull()
    })

    it('should throw error when video ID is invalid', async () => {
      await expect(
        videoService.getVideo('')
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.getVideo('   ')
      ).rejects.toThrow(VideoServiceError)
    })
  })

  describe('createVideo', () => {
    it('should create a new video record', async () => {
      const videoInput = {
        story_id: 'story-123',
        filepath: 'output/story-123-new.mp4',
        duration_sec: 20,
      }

      const mockCreatedVideo = createMockVideo(videoInput)

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedVideo,
              error: null,
            }),
          }),
        }),
      })

      const result = await videoService.createVideo(videoInput)

      expect(mockSupabase.from).toHaveBeenCalledWith('videos')
      expect(result).toEqual(mockCreatedVideo)
    })

    it('should validate required fields', async () => {
      await expect(
        videoService.createVideo({
          story_id: '',
          filepath: 'output/test.mp4',
        })
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.createVideo({
          story_id: 'story-123',
          filepath: '',
        })
      ).rejects.toThrow(VideoServiceError)
    })

    it('should handle database errors during creation', async () => {
      const videoInput = {
        story_id: 'story-123',
        filepath: 'output/story-123.mp4',
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Foreign key constraint violation' },
            }),
          }),
        }),
      })

      await expect(
        videoService.createVideo(videoInput)
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.createVideo(videoInput)
      ).rejects.toThrow('Database error')
    })
  })

  describe('deleteVideo', () => {
    it('should delete a video by ID', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      })

      await videoService.deleteVideo('video-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('videos')
    })

    it('should throw error when video ID is invalid', async () => {
      await expect(
        videoService.deleteVideo('')
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.deleteVideo('   ')
      ).rejects.toThrow(VideoServiceError)
    })

    it('should handle database errors during deletion', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Permission denied' },
          }),
        }),
      })

      await expect(
        videoService.deleteVideo('video-123')
      ).rejects.toThrow(VideoServiceError)

      await expect(
        videoService.deleteVideo('video-123')
      ).rejects.toThrow('Database error')
    })
  })

  describe('countVideosForStory', () => {
    it('should return the count of videos for a story', async () => {
      const mockVideos = [
        createMockVideo({ id: 'video-1', story_id: 'story-123' }),
        createMockVideo({ id: 'video-2', story_id: 'story-123' }),
        createMockVideo({ id: 'video-3', story_id: 'story-123' }),
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockVideos,
            error: null,
          }),
        }),
      })

      const result = await videoService.countVideosForStory('story-123')

      expect(result).toBe(3)
    })

    it('should return 0 when no videos found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })

      const result = await videoService.countVideosForStory('story-123')

      expect(result).toBe(0)
    })

    it('should throw error when story ID is invalid', async () => {
      await expect(
        videoService.countVideosForStory('')
      ).rejects.toThrow(VideoServiceError)
    })
  })
}) 