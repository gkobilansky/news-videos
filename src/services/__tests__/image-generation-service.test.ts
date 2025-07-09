import { ImageGenerationService, ImageGenerationServiceError } from '../image-generation-service'
import { createMockStoryboard, createMockStory } from '../../lib/test-utils'

// Mock RunwayML SDK
jest.mock('@runwayml/sdk', () => ({
  RunwayML: jest.fn().mockImplementation(() => ({
    textToImage: {
      create: jest.fn(() => ({
        waitForTaskOutput: jest.fn()
      }))
    }
  })),
  TaskFailedError: class TaskFailedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'TaskFailedError'
    }
  }
}))

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({ data: [{ id: 'test-asset-id' }], error: null }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}))

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn()
}))

// Mock global fetch
global.fetch = jest.fn()

describe('ImageGenerationService', () => {
  let imageGenerationService: ImageGenerationService
  const mockStoryboard = createMockStoryboard()
  const mockStory = createMockStory()
  let mockRunwayInstance: any

  beforeEach(() => {
    // Set up environment variable
    process.env.RUNWAY_API_KEY = 'test-api-key'
    
    // Setup mock runway instance
    const mockRunwayML = require('@runwayml/sdk').RunwayML
    mockRunwayInstance = {
      textToImage: {
        create: jest.fn(() => ({
          waitForTaskOutput: jest.fn()
        }))
      }
    }
    mockRunwayML.mockImplementation(() => mockRunwayInstance)
    
    imageGenerationService = new ImageGenerationService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.RUNWAY_API_KEY
  })

  describe('constructor', () => {
    it('should throw error if no API key is provided', () => {
      delete process.env.RUNWAY_API_KEY
      expect(() => new ImageGenerationService()).toThrow('Runway API key is required')
    })

    it('should initialize with valid API key', () => {
      expect(imageGenerationService).toBeInstanceOf(ImageGenerationService)
    })
  })

  describe('generateStoryboardImages', () => {
    it('should generate images for all shots in storyboard', async () => {
      // Mock successful image generation
      mockRunwayInstance.textToImage.create.mockReturnValue({
        waitForTaskOutput: jest.fn().mockResolvedValue({
          id: 'test-task-id',
          output: ['https://example.com/image1.jpg']
        })
      })

      // Mock successful fetch
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })

      const result = await imageGenerationService.generateStoryboardImages(mockStory.id, mockStoryboard)

      expect(result).toBeDefined()
      expect(result.storyId).toBe(mockStory.id)
      expect(result.totalGenerated).toBe(mockStoryboard.shots.length)
      expect(result.images).toHaveLength(mockStoryboard.shots.length)
    })

    it('should handle empty storyboard', async () => {
      const emptyStoryboard = { ...mockStoryboard, shots: [] }

      await expect(imageGenerationService.generateStoryboardImages(mockStory.id, emptyStoryboard))
        .rejects
        .toThrow('Valid storyboard with shots is required')
    })

    it('should handle invalid story ID', async () => {
      await expect(imageGenerationService.generateStoryboardImages('', mockStoryboard))
        .rejects
        .toThrow('Story ID is required')
    })
  })

  describe('generateImageForShot', () => {
    it('should generate image for a single shot', async () => {
      // Mock successful image generation
      mockRunwayInstance.textToImage.create.mockReturnValue({
        waitForTaskOutput: jest.fn().mockResolvedValue({
          id: 'test-task-id',
          output: ['https://example.com/image1.jpg']
        })
      })

      // Mock successful fetch
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })

      const shot = mockStoryboard.shots[0]
      const result = await imageGenerationService.generateImageForShot(mockStory.id, shot, 1)

      expect(result).toBeDefined()
      expect(result.imagePath).toBeDefined()
      expect(result.asset).toBeDefined()
    })

    it('should handle shot without prompt text', async () => {
      const invalidShot = {
        promptText: '',
        duration: 5 as const,
        camera: { movement: 'static' as const, angle: 'eye-level' as const }
      }

      await expect(imageGenerationService.generateImageForShot(mockStory.id, invalidShot, 1))
        .rejects
        .toThrow('Valid shot with promptText is required')
    })
  })

  describe('generateImage', () => {
    it('should generate standalone image', async () => {
      // Mock successful image generation
      mockRunwayInstance.textToImage.create.mockReturnValue({
        waitForTaskOutput: jest.fn().mockResolvedValue({
          id: 'test-task-id',
          output: ['https://example.com/image1.jpg']
        })
      })

      // Mock successful fetch
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
      })

      const result = await imageGenerationService.generateImage(mockStory.id, 'test prompt', 'test-image')

      expect(result).toBeDefined()
      expect(result.imagePath).toBeDefined()
      expect(result.asset).toBeDefined()
    })

    it('should handle empty prompt', async () => {
      await expect(imageGenerationService.generateImage(mockStory.id, '', 'test-image'))
        .rejects
        .toThrow('Image prompt is required')
    })
  })

  describe('getStoryImageAssets', () => {
    it('should retrieve image assets for a story', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      const mockAssets = [
        { id: 'asset1', story_id: mockStory.id, kind: 'image' },
        { id: 'asset2', story_id: mockStory.id, kind: 'image' }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue(
                  Promise.resolve({ data: mockAssets, error: null })
                )
              })
            })
          })
        })
      })

      const result = await imageGenerationService.getStoryImageAssets(mockStory.id)

      expect(result).toEqual(mockAssets)
    })

    it('should handle database error', async () => {
      const mockSupabase = require('../../lib/supabase').supabaseAdmin
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue(
                  Promise.resolve({ data: null, error: { message: 'Database error' } })
                )
              })
            })
          })
        })
      })

      await expect(imageGenerationService.getStoryImageAssets(mockStory.id))
        .rejects
        .toThrow('Database error')
    })
  })

  describe('error handling', () => {
    it('should handle Runway API errors', async () => {
      // Mock API error
      mockRunwayInstance.textToImage.create.mockReturnValue({
        waitForTaskOutput: jest.fn().mockRejectedValue(new Error('API Error'))
      })

      const shot = mockStoryboard.shots[0]
      await expect(imageGenerationService.generateImageForShot(mockStory.id, shot, 1))
        .rejects
        .toThrow('Failed to create image generation task: API Error')
    })

    it('should handle download errors', async () => {
      // Mock successful image generation
      mockRunwayInstance.textToImage.create.mockReturnValue({
        waitForTaskOutput: jest.fn().mockResolvedValue({
          id: 'test-task-id',
          output: ['https://example.com/image1.jpg']
        })
      })

      // Mock failed fetch
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      const shot = mockStoryboard.shots[0]
      await expect(imageGenerationService.generateImageForShot(mockStory.id, shot, 1))
        .rejects
        .toThrow('Failed to download image: 404 Not Found')
    })
  })
})