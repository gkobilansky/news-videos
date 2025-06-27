import { VideoGenerationService, VideoGenerationServiceError } from '../video-generation-service'
import { createMockAsset, createTestDirectories, cleanupTestDirectories } from '../../lib/test-utils'
import fs from 'fs/promises'
import path from 'path'

// Mock HTTP fetch for video downloads
global.fetch = jest.fn()

// Mock fs operations
jest.mock('fs/promises')

// Mock Runway SDK
jest.mock('@runwayml/sdk', () => {
  return {
    RunwayML: jest.fn().mockImplementation(() => ({
      imageGeneration: {
        create: jest.fn()
      },
      videoGeneration: {
        create: jest.fn()
      },
      tasks: {
        retrieve: jest.fn()
      }
    }))
  }
})

describe('VideoGenerationService', () => {
  let videoService: VideoGenerationService
  let mockFs: jest.Mocked<typeof fs>
  let mockFetch: jest.MockedFunction<typeof fetch>
  let mockRunway: {
    imageGeneration: { create: jest.MockedFunction<any> }
    videoGeneration: { create: jest.MockedFunction<any> }
    tasks: { retrieve: jest.MockedFunction<any> }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFs = fs as jest.Mocked<typeof fs>
    mockFetch = fetch as jest.MockedFunction<typeof fetch>
    
    // Mock environment variable
    process.env.RUNWAY_API_KEY = 'test-runway-key'
    videoService = new VideoGenerationService()
    
    // Get mock instance
    mockRunway = (videoService as any).runway
    
    createTestDirectories()
  })

  afterEach(async () => {
    await cleanupTestDirectories()
  })

  describe('generateVideo', () => {
    it('should generate video with text prompt using two-step approach', async () => {
      // Mock Runway SDK responses for image generation task
      const mockImageTaskResponse = {
        id: 'image-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      const mockCompletedImageTaskResponse = {
        id: 'image-task-123',
        status: 'completed',
        output: ['https://runway.ai/image/output-123.jpg'],
        failure_reason: null
      }
      
      // Mock Runway SDK responses for video generation task
      const mockVideoTaskResponse = {
        id: 'video-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      const mockCompletedVideoTaskResponse = {
        id: 'video-task-123',
        status: 'completed',
        output: ['https://runway.ai/video/output-123.mp4'],
        failure_reason: null
      }
      
      // Mock video file content
      const mockVideoData = new ArrayBuffer(1024)
      
      // Mock SDK calls
      mockRunway.imageGeneration.create.mockResolvedValue(mockImageTaskResponse)
      mockRunway.videoGeneration.create.mockResolvedValue(mockVideoTaskResponse)
      mockRunway.tasks.retrieve
        .mockResolvedValueOnce(mockCompletedImageTaskResponse) // Image task completion
        .mockResolvedValueOnce(mockCompletedVideoTaskResponse) // Video task completion
      
      // Mock video download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockVideoData)
      } as Response)

      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.mkdir.mockResolvedValue(undefined)

      const result = await videoService.generateVideo(
        'story-123',
        'A futuristic cityscape with flying cars and neon lights'
      )

      // Verify SDK calls
      expect(mockRunway.imageGeneration.create).toHaveBeenCalledWith({
        model: 'runway-ml/runway-stable-diffusion-v1-5',
        prompt: 'A futuristic cityscape with flying cars and neon lights',
        width: 768,
        height: 1344
      })

      expect(mockRunway.videoGeneration.create).toHaveBeenCalledWith({
        model: 'gen3a_turbo',
        promptText: 'A futuristic cityscape with flying cars and neon lights',
        promptImage: 'https://runway.ai/image/output-123.jpg',
        duration: 10
      })

      expect(result).toEqual({
        filepath: expect.stringMatching(/assets\/video\/story-123\.mp4$/),
        durationSec: 10
      })
    })

    it('should handle API errors gracefully', async () => {
      // Test error at image generation step
      mockRunway.imageGeneration.create.mockRejectedValue(
        new Error('Rate Limit Exceeded')
      )

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow('Failed to create image generation task')
    })

    it('should handle API errors at video generation step', async () => {
      // Mock successful image generation
      const mockImageTaskResponse = {
        id: 'image-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      const mockCompletedImageTaskResponse = {
        id: 'image-task-123',
        status: 'completed',
        output: ['https://runway.ai/image/output-123.jpg'],
        failure_reason: null
      }
      
      // Clear any previous mocks
      jest.clearAllMocks()
      
      mockRunway.imageGeneration.create.mockResolvedValue(mockImageTaskResponse)
      mockRunway.tasks.retrieve.mockResolvedValue(mockCompletedImageTaskResponse)
      mockRunway.videoGeneration.create.mockRejectedValue(
        new Error('Bad Request')
      )

      const promise = videoService.generateVideo('story-123', 'Test prompt')
      
      await expect(promise).rejects.toThrow(VideoGenerationServiceError)
      await expect(promise).rejects.toThrow('Failed to create video generation task')
    })

    it('should handle task polling timeout at image generation step', async () => {
      const mockImageTaskResponse = {
        id: 'image-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      mockRunway.imageGeneration.create.mockResolvedValue(mockImageTaskResponse)
      // Keep returning pending status to trigger timeout
      mockRunway.tasks.retrieve.mockResolvedValue(mockImageTaskResponse)

      // Mock short timeout for testing
      const originalTimeout = (videoService as any).POLLING_TIMEOUT_MS
      const originalInterval = (videoService as any).POLLING_INTERVAL_MS
      ;(videoService as any).POLLING_TIMEOUT_MS = 200
      ;(videoService as any).POLLING_INTERVAL_MS = 50

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow('Video generation timed out')

      // Restore original values
      ;(videoService as any).POLLING_TIMEOUT_MS = originalTimeout
      ;(videoService as any).POLLING_INTERVAL_MS = originalInterval
    }, 15000)

    it('should validate input parameters', async () => {
      await expect(
        videoService.generateVideo('', 'Valid prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      await expect(
        videoService.generateVideo('story-123', '')
      ).rejects.toThrow(VideoGenerationServiceError)

      await expect(
        videoService.generateVideo('story-123', '   ')
      ).rejects.toThrow(VideoGenerationServiceError)
    })

    it('should handle file download errors', async () => {
      const mockImageTaskResponse = {
        id: 'image-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      const mockCompletedImageTaskResponse = {
        id: 'image-task-123',
        status: 'completed',
        output: ['https://runway.ai/image/output-123.jpg'],
        failure_reason: null
      }
      
      const mockVideoTaskResponse = {
        id: 'video-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      const mockCompletedVideoTaskResponse = {
        id: 'video-task-123',
        status: 'completed',
        output: ['https://runway.ai/video/output-123.mp4'],
        failure_reason: null
      }
      
      mockRunway.imageGeneration.create.mockResolvedValue(mockImageTaskResponse)
      mockRunway.videoGeneration.create.mockResolvedValue(mockVideoTaskResponse)
      mockRunway.tasks.retrieve
        .mockResolvedValueOnce(mockCompletedImageTaskResponse)
        .mockResolvedValueOnce(mockCompletedVideoTaskResponse)
      
      // Error downloading video file
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)
    })

    it('should handle missing image output', async () => {
      const mockImageTaskResponse = {
        id: 'image-task-123',
        status: 'pending',
        output: null,
        failure_reason: null
      }
      
      const mockCompletedImageTaskResponse = {
        id: 'image-task-123',
        status: 'completed',
        output: [], // No image output
        failure_reason: null
      }

      // Clear any previous mocks
      jest.clearAllMocks()

      mockRunway.imageGeneration.create.mockResolvedValue(mockImageTaskResponse)
      mockRunway.tasks.retrieve.mockResolvedValue(mockCompletedImageTaskResponse)

      const promise = videoService.generateVideo('story-123', 'Test prompt')
      
      await expect(promise).rejects.toThrow(VideoGenerationServiceError)
      await expect(promise).rejects.toThrow('No image generated from text prompt')
    }, 15000)
  })

  describe('createVideoAsset', () => {
    it('should create video asset record in database', async () => {
      // Mock Supabase operations
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockResolvedValue({
        data: [createMockAsset({
          id: 'asset-123',
          story_id: 'story-123',
          kind: 'video',
          provider: 'runway',
          filepath: 'assets/video/story-123.mp4',
          metadata: { durationSec: 10 }
        })],
        error: null
      })

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: mockInsert.mockReturnValue({
            select: mockSelect
          })
        })
      }

      // Inject mock into service
      ;(videoService as any).supabase = mockSupabase

      const asset = await videoService.createVideoAsset(
        'story-123',
        'assets/video/story-123.mp4',
        10
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('assets')
      expect(mockInsert).toHaveBeenCalledWith({
        story_id: 'story-123',
        kind: 'video',
        provider: 'runway',
        filepath: 'assets/video/story-123.mp4',
        metadata: { durationSec: 10 }
      })

      expect(asset.kind).toBe('video')
      expect(asset.provider).toBe('runway')
      expect(asset.metadata).toEqual({ durationSec: 10 })
    })

    it('should handle database insertion errors', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      }

      ;(videoService as any).supabase = mockSupabase

      await expect(
        videoService.createVideoAsset('story-123', 'test.mp4', 10)
      ).rejects.toThrow(VideoGenerationServiceError)
    })
  })

  describe('generateVideoForStory', () => {
    it('should orchestrate complete video generation process', async () => {
      // Mock generateVideo
      const mockGenerateVideo = jest.spyOn(videoService, 'generateVideo')
        .mockResolvedValue({
          filepath: 'assets/video/story-123.mp4',
          durationSec: 10
        })

      // Mock createVideoAsset
      const mockCreateAsset = jest.spyOn(videoService, 'createVideoAsset')
        .mockResolvedValue(createMockAsset({
          id: 'asset-123',
          story_id: 'story-123',
          kind: 'video',
          provider: 'runway',
          filepath: 'assets/video/story-123.mp4',
          metadata: { durationSec: 10 }
        }))

      const result = await videoService.generateVideoForStory(
        'story-123', 
        'A dynamic news scene with breaking news graphics'
      )

      expect(mockGenerateVideo).toHaveBeenCalledWith(
        'story-123', 
        'A dynamic news scene with breaking news graphics'
      )
      expect(mockCreateAsset).toHaveBeenCalledWith(
        'story-123',
        'assets/video/story-123.mp4',
        10
      )

      expect(result.kind).toBe('video')
      expect(result.provider).toBe('runway')
      expect(result.filepath).toBe('assets/video/story-123.mp4')
    })

    it('should clean up files if asset creation fails', async () => {
      const mockGenerateVideo = jest.spyOn(videoService, 'generateVideo')
        .mockResolvedValue({
          filepath: 'assets/video/story-123.mp4',
          durationSec: 10
        })

      const mockCreateAsset = jest.spyOn(videoService, 'createVideoAsset')
        .mockRejectedValue(new Error('Database error'))

      mockFs.unlink = jest.fn().mockResolvedValue(undefined)

      await expect(
        videoService.generateVideoForStory('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      expect(mockFs.unlink).toHaveBeenCalledWith('assets/video/story-123.mp4')
    })
  })

  describe('regenerateVideoForStory', () => {
    it('should clean up existing assets and regenerate video', async () => {
      // Mock cleanup method
      const mockCleanup = jest.spyOn(videoService as any, 'cleanupExistingVideoAssets')
        .mockResolvedValue(undefined)

      // Mock generateVideo
      const mockGenerateVideo = jest.spyOn(videoService, 'generateVideo')
        .mockResolvedValue({
          filepath: 'assets/video/story-123-take2.mp4',
          durationSec: 10
        })

      // Mock createVideoAsset
      const mockCreateAsset = jest.spyOn(videoService, 'createVideoAsset')
        .mockResolvedValue(createMockAsset({
          id: 'asset-456',
          story_id: 'story-123',
          kind: 'video',
          provider: 'runway',
          filepath: 'assets/video/story-123-take2.mp4',
          metadata: { durationSec: 10 }
        }))

      const result = await videoService.regenerateVideoForStory(
        'story-123', 
        'A dynamic news scene with breaking news graphics',
        2
      )

      expect(mockCleanup).toHaveBeenCalledWith('story-123')
      expect(mockGenerateVideo).toHaveBeenCalledWith(
        'story-123', 
        'A dynamic news scene with breaking news graphics',
        2
      )
      expect(mockCreateAsset).toHaveBeenCalledWith(
        'story-123',
        'assets/video/story-123-take2.mp4',
        10
      )

      expect(result.kind).toBe('video')
      expect(result.provider).toBe('runway')
      expect(result.filepath).toBe('assets/video/story-123-take2.mp4')
    })

    it('should handle errors during regeneration and cleanup generated files', async () => {
      // Mock cleanup method
      const mockCleanup = jest.spyOn(videoService as any, 'cleanupExistingVideoAssets')
        .mockResolvedValue(undefined)

      // Mock generateVideo
      const mockGenerateVideo = jest.spyOn(videoService, 'generateVideo')
        .mockResolvedValue({
          filepath: 'assets/video/story-123.mp4',
          durationSec: 10
        })

      // Mock createVideoAsset to fail
      const mockCreateAsset = jest.spyOn(videoService, 'createVideoAsset')
        .mockRejectedValue(new Error('Database error'))

      mockFs.unlink = jest.fn().mockResolvedValue(undefined)

      await expect(
        videoService.regenerateVideoForStory('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      expect(mockCleanup).toHaveBeenCalledWith('story-123')
      expect(mockFs.unlink).toHaveBeenCalledWith('assets/video/story-123.mp4')
    })
  })

  describe('pollTaskStatus', () => {
    it('should poll until task completion', async () => {
      const taskId = 'task-123'
      
      // Reduce polling interval for testing
      const originalInterval = (videoService as any).POLLING_INTERVAL_MS
      ;(videoService as any).POLLING_INTERVAL_MS = 10
      
      // Mock polling sequence: pending -> pending -> completed
      mockRunway.tasks.retrieve
        .mockResolvedValueOnce({ 
          id: taskId, 
          status: 'pending',
          output: null,
          failure_reason: null
        })
        .mockResolvedValueOnce({ 
          id: taskId, 
          status: 'pending',
          output: null,
          failure_reason: null
        })
        .mockResolvedValueOnce({ 
          id: taskId, 
          status: 'completed',
          output: ['https://runway.ai/video/output.mp4'],
          failure_reason: null
        })

      const result = await (videoService as any).pollTaskStatus(taskId)

      expect(result).toEqual({
        id: taskId,
        status: 'completed',
        output: ['https://runway.ai/video/output.mp4'],
        error: null
      })

      expect(mockRunway.tasks.retrieve).toHaveBeenCalledTimes(3)
      
      // Restore original interval
      ;(videoService as any).POLLING_INTERVAL_MS = originalInterval
    }, 15000)

    it('should handle failed tasks', async () => {
      const taskId = 'task-123'
      
      mockRunway.tasks.retrieve.mockResolvedValue({ 
        id: taskId, 
        status: 'failed',
        output: null,
        failure_reason: 'Invalid prompt'
      })

      await expect(
        (videoService as any).pollTaskStatus(taskId)
      ).rejects.toThrow(VideoGenerationServiceError)
    })
  })
})