import { VideoGenerationService, VideoGenerationServiceError } from '../video-generation-service'
import { createMockAsset, createTestDirectories, cleanupTestDirectories } from '../../lib/test-utils'
import fs from 'fs/promises'
import path from 'path'

// Mock HTTP fetch for video downloads
global.fetch = jest.fn()

// Mock fs operations
jest.mock('fs/promises')

// Mock Runway SDK with waitForTaskOutput support
jest.mock('@runwayml/sdk', () => {
  return {
    RunwayML: jest.fn().mockImplementation(() => ({
      textToImage: {
        create: jest.fn()
      },
      imageToVideo: {
        create: jest.fn()
      },
      tasks: {
        retrieve: jest.fn()
      }
    })),
    TaskFailedError: class TaskFailedError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'TaskFailedError'
      }
    },
    TaskTimedOutError: class TaskTimedOutError extends Error {
      constructor(message: string) {
        super(message)
        this.name = 'TaskTimedOutError'
      }
    }
  }
})

describe('VideoGenerationService', () => {
  let videoService: VideoGenerationService
  let mockFs: jest.Mocked<typeof fs>
  let mockFetch: jest.MockedFunction<typeof fetch>
  let mockRunway: {
    textToImage: { create: jest.MockedFunction<any> }
    imageToVideo: { create: jest.MockedFunction<any> }
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
      // Mock waitForTaskOutput chains
      const mockImageTaskOutput = {
        id: 'image-task-123',
        status: 'completed',
        output: ['https://runway.ai/image/output-123.jpg']
      }
      
      const mockVideoTaskOutput = {
        id: 'video-task-123',
        status: 'completed',
        output: ['https://runway.ai/video/output-123.mp4']
      }
      
      // Mock video file content
      const mockVideoData = new ArrayBuffer(1024)
      
      // Mock SDK calls with waitForTaskOutput chaining
      const mockWaitForTaskOutputImage = jest.fn().mockResolvedValue(mockImageTaskOutput)
      const mockWaitForTaskOutputVideo = jest.fn().mockResolvedValue(mockVideoTaskOutput)
      
      mockRunway.textToImage.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutputImage
      })
      
      mockRunway.imageToVideo.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutputVideo
      })
      
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
      expect(mockRunway.textToImage.create).toHaveBeenCalledWith({
        model: 'gen4_image',
        promptText: 'A futuristic cityscape with flying cars and neon lights',
        ratio: '1080:1920'
      })

      expect(mockRunway.imageToVideo.create).toHaveBeenCalledWith({
        model: 'gen3a_turbo',
        promptText: 'A futuristic cityscape with flying cars and neon lights',
        promptImage: 'https://runway.ai/image/output-123.jpg',
        duration: 10,
        ratio: '720:1280'
      })

      expect(result).toEqual({
        filepath: expect.stringMatching(/assets\/video\/story-123\.mp4$/),
        durationSec: 10
      })
    })

    it('should handle API errors gracefully', async () => {
      // Test error at image generation step - make waitForTaskOutput reject
      const mockWaitForTaskOutput = jest.fn().mockRejectedValue(
        new Error('Rate Limit Exceeded')
      )
      
      mockRunway.textToImage.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutput
      })

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow('Failed to create image generation task')
    })

    it('should handle API errors at video generation step', async () => {
      // Mock successful image generation
      const mockImageTaskOutput = {
        id: 'image-task-123',
        status: 'completed',
        output: ['https://runway.ai/image/output-123.jpg']
      }
      
      // Mock image generation succeeding but video generation failing
      const mockWaitForTaskOutputImage = jest.fn().mockResolvedValue(mockImageTaskOutput)
      const mockWaitForTaskOutputVideo = jest.fn().mockRejectedValue(
        new Error('Bad Request')
      )
      
      mockRunway.textToImage.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutputImage
      })
      
      mockRunway.imageToVideo.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutputVideo
      })

      const promise = videoService.generateVideo('story-123', 'Test prompt')
      
      await expect(promise).rejects.toThrow(VideoGenerationServiceError)
      await expect(promise).rejects.toThrow('Failed to create video generation task')
    })

    it('should handle task polling timeout at image generation step', async () => {
      // Import the mocked error class
      const { TaskTimedOutError } = require('@runwayml/sdk')
      
      // Mock timeout error from waitForTaskOutput
      const mockWaitForTaskOutput = jest.fn().mockRejectedValue(
        new TaskTimedOutError('Timeout')
      )
      
      mockRunway.textToImage.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutput
      })

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow(VideoGenerationServiceError)

      await expect(
        videoService.generateVideo('story-123', 'Test prompt')
      ).rejects.toThrow('Image generation timed out')
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
      // Mock successful task outputs
      const mockImageTaskOutput = {
        id: 'image-task-123',
        status: 'completed',
        output: ['https://runway.ai/image/output-123.jpg']
      }
      
      const mockVideoTaskOutput = {
        id: 'video-task-123',
        status: 'completed',
        output: ['https://runway.ai/video/output-123.mp4']
      }
      
      // Mock successful waitForTaskOutput calls
      const mockWaitForTaskOutputImage = jest.fn().mockResolvedValue(mockImageTaskOutput)
      const mockWaitForTaskOutputVideo = jest.fn().mockResolvedValue(mockVideoTaskOutput)
      
      mockRunway.textToImage.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutputImage
      })
      
      mockRunway.imageToVideo.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutputVideo
      })
      
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
      // Mock empty output from waitForTaskOutput
      const mockImageTaskOutput = {
        id: 'image-task-123',
        status: 'completed',
        output: [] // No image output
      }
      
      const mockWaitForTaskOutput = jest.fn().mockResolvedValue(mockImageTaskOutput)
      
      mockRunway.textToImage.create.mockReturnValue({
        waitForTaskOutput: mockWaitForTaskOutput
      })

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

  // Note: pollTaskStatus tests removed since we now use waitForTaskOutput() from Runway SDK
})