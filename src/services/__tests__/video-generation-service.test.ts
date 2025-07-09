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
        ratio: '720:1280'
      })

      expect(mockRunway.imageToVideo.create).toHaveBeenCalledWith({
        model: 'gen3a_turbo',
        promptText: 'A futuristic cityscape with flying cars and neon lights',
        promptImage: 'https://runway.ai/image/output-123.jpg',
        duration: 10,
        ratio: '768:1280'
      })

      expect(result).toEqual({
        videoPath: expect.stringMatching(/assets\/video\/story-123-runway\.mp4$/),
        allClips: [expect.stringMatching(/assets\/video\/story-123-runway\.mp4$/)],
        duration: 10
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
      // Mock timeout error from waitForTaskOutput
      const timeoutError = new Error('Request timeout after 300000ms')
      const mockWaitForTaskOutput = jest.fn().mockRejectedValue(timeoutError)
      
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
          filepath: 'assets/video/story-123-runway.mp4',
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
        'assets/video/story-123-runway.mp4',
        10
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('assets')
      expect(mockInsert).toHaveBeenCalledWith({
        story_id: 'story-123',
        kind: 'video',
        provider: 'runway',
        filepath: 'assets/video/story-123-runway.mp4',
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
          videoPath: 'assets/video/story-123.mp4',
          allClips: ['assets/video/story-123.mp4'],
          duration: 10
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
          videoPath: 'assets/video/story-123.mp4',
          allClips: ['assets/video/story-123.mp4'],
          duration: 10
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
          videoPath: 'assets/video/story-123-take2.mp4',
          allClips: ['assets/video/story-123-take2.mp4'],
          duration: 10
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
          videoPath: 'assets/video/story-123.mp4',
          allClips: ['assets/video/story-123.mp4'],
          duration: 10
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

  describe('generateVideoFromStoryboard', () => {
    it('should generate individual video clips using existing reference images', async () => {
      const mockStoryboard = {
        model: 'gen4_turbo',
        ratio: '768:1280',
        shots: [
          {
            promptText: 'Wide establishing shot of tech conference, cinematic lighting',
            duration: 5,
            camera: { movement: 'static', angle: 'eye-level' }
          },
          {
            promptText: 'Close-up handheld shot of excited scientist, dramatic',
            duration: 5,
            camera: { movement: 'handheld', angle: 'low-angle' }
          },
          {
            promptText: 'Dolly-in final shot showing breakthrough technology, warm tones',
            duration: 5,
            camera: { movement: 'dolly-in', angle: 'low-angle' }
          }
        ]
      }

      // Mock existing image assets from database
      const mockExistingImages = [
        createMockAsset({
          id: 'asset-1',
          story_id: 'story123',
          kind: 'image',
          provider: 'runway',
          filepath: 'assets/images/story123-shot1.jpg',
          metadata: { shotIndex: 1 }
        }),
        createMockAsset({
          id: 'asset-2',
          story_id: 'story123',
          kind: 'image',
          provider: 'runway',
          filepath: 'assets/images/story123-shot2.jpg',
          metadata: { shotIndex: 2 }
        }),
        createMockAsset({
          id: 'asset-3',
          story_id: 'story123',
          kind: 'image',
          provider: 'runway',
          filepath: 'assets/images/story123-shot3.jpg',
          metadata: { shotIndex: 3 }
        })
      ]

      // Mock getExistingImageAssets to return the existing images
      ;(videoService as any).getExistingImageAssets = jest.fn().mockResolvedValue(mockExistingImages)

      // Mock the createVideoFromImageTask to return different videos for each shot
      const mockVideoOutputs = [
        ['https://example.com/shot1-video.mp4'],
        ['https://example.com/shot2-video.mp4'],
        ['https://example.com/shot3-video.mp4']
      ]
      
      let videoCallCount = 0
      ;(videoService as any).createVideoFromImageTask = jest.fn().mockImplementation(() => {
        const output = mockVideoOutputs[videoCallCount]
        videoCallCount++
        return Promise.resolve({
          id: `video-task-${videoCallCount}`,
          status: 'completed',
          output
        })
      })

      // Mock the downloadVideo method to return local file paths
      const mockDownloadedPaths = [
        '/path/to/story123-storyboard-shot1.mp4',
        '/path/to/story123-storyboard-shot2.mp4',
        '/path/to/story123-storyboard-shot3.mp4'
      ]
      
      let downloadCallCount = 0
      ;(videoService as any).downloadVideo = jest.fn().mockImplementation(() => {
        const path = mockDownloadedPaths[downloadCallCount]
        downloadCallCount++
        return Promise.resolve(path)
      })

      const result = await videoService.generateVideoFromStoryboard('story123', mockStoryboard)

      expect(result).toEqual({
        videoPath: '/path/to/story123-storyboard-shot1.mp4', // First clip as main
        allClips: [
          '/path/to/story123-storyboard-shot1.mp4',
          '/path/to/story123-storyboard-shot2.mp4',
          '/path/to/story123-storyboard-shot3.mp4'
        ],
        duration: 15 // 5 + 5 + 5 seconds
      })

      // Verify existing images were retrieved
      expect((videoService as any).getExistingImageAssets).toHaveBeenCalledWith('story123')
      
      // Verify videos were generated from existing images (no new image generation)
      expect((videoService as any).createVideoFromImageTask).toHaveBeenCalledTimes(3) // 3 shots
      expect((videoService as any).downloadVideo).toHaveBeenCalledTimes(3) // 3 clips
      
      // Verify each shot was processed with existing local image paths
      expect((videoService as any).createVideoFromImageTask).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('story123-shot1.jpg'), // Uses existing local path
        'Wide establishing shot of tech conference, cinematic lighting',
        'gen3a_turbo'
      )
      expect((videoService as any).createVideoFromImageTask).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('story123-shot2.jpg'),
        'Close-up handheld shot of excited scientist, dramatic',
        'gen3a_turbo'
      )
      expect((videoService as any).createVideoFromImageTask).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('story123-shot3.jpg'),
        'Dolly-in final shot showing breakthrough technology, warm tones',
        'gen3a_turbo'
      )
    })

    it('should throw error when no reference images exist', async () => {
      const mockStoryboard = {
        model: 'gen4_turbo',
        ratio: '768:1280',
        shots: [
          {
            promptText: 'Single shot test',
            duration: 5
          }
        ]
      }

      // Mock getExistingImageAssets to return empty array (no existing images)
      ;(videoService as any).getExistingImageAssets = jest.fn().mockResolvedValue([])

      await expect(
        videoService.generateVideoFromStoryboard('story123', mockStoryboard)
      ).rejects.toThrow('No reference images found for story. Please generate storyboard images first.')

      // Should check for existing images first
      expect((videoService as any).getExistingImageAssets).toHaveBeenCalledWith('story123')
    })

    it('should throw error for invalid storyboard', async () => {
      await expect(
        videoService.generateVideoFromStoryboard('story123', null)
      ).rejects.toThrow('Valid storyboard is required')

      await expect(
        videoService.generateVideoFromStoryboard('story123', { shots: [] })
      ).rejects.toThrow('Valid storyboard is required')
    })

    it('should throw error for missing story ID', async () => {
      const mockStoryboard = {
        shots: [{ promptText: 'Test shot', duration: 5 }]
      }

      await expect(
        videoService.generateVideoFromStoryboard('', mockStoryboard)
      ).rejects.toThrow('Story ID is required')
    })
  })
})