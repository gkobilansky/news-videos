import { EnhancedFFmpegService, EnhancedFFmpegServiceError } from '../enhanced-ffmpeg-service'
import { createMockVideo, createTestDirectories, cleanupTestDirectories } from '../../lib/test-utils'
import fs from 'fs/promises'
import path from 'path'

// Mock @ffmpeg/ffmpeg
jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    exec: jest.fn().mockResolvedValue(undefined),
    terminate: jest.fn().mockResolvedValue(undefined)
  }))
}))

// Mock media-captions
jest.mock('media-captions', () => ({
  CaptionsRenderer: jest.fn().mockImplementation(() => ({
    // Mock renderer methods as needed
  }))
}))

// Mock fs operations
jest.mock('fs/promises')

describe('EnhancedFFmpegService', () => {
  let enhancedFFmpegService: EnhancedFFmpegService
  let mockFs: jest.Mocked<typeof fs>

  beforeEach(() => {
    jest.clearAllMocks()
    mockFs = fs as jest.Mocked<typeof fs>
    
    enhancedFFmpegService = new EnhancedFFmpegService()
    
    createTestDirectories()
  })

  afterEach(async () => {
    await cleanupTestDirectories()
    await enhancedFFmpegService.cleanup()
  })

  describe('initialize', () => {
    it('should initialize FFmpeg and media-captions successfully', async () => {
      await enhancedFFmpegService.initialize()
      
      // Should not throw and should be callable multiple times
      await enhancedFFmpegService.initialize()
      
      expect(true).toBe(true) // Test passes if no error thrown
    })

    it('should handle initialization errors gracefully', async () => {
      // Create a new service instance and mock FFmpeg constructor to throw
      const { FFmpeg } = require('@ffmpeg/ffmpeg')
      
      // Mock FFmpeg constructor to throw an error
      FFmpeg.mockImplementationOnce(() => {
        throw new Error('Failed to load FFmpeg')
      })
      
      const newService = new EnhancedFFmpegService()
      await expect(newService.initialize()).rejects.toThrow(
        EnhancedFFmpegServiceError
      )
    })
  })

  describe('assembleVideo', () => {
    it('should assemble video with enhanced captions using single video file', async () => {
      // Mock file system operations
      mockFs.readFile.mockResolvedValue(Buffer.from('mock file data'))
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'This is a test news script for enhanced video assembly.'
      }

      const result = await enhancedFFmpegService.assembleVideo('story-123', assets)

      expect(result.filepath).toContain('story-123-enhanced-')
      expect(result.filepath).toContain('.mp4')
      expect(result.durationSec).toBeGreaterThan(0)
      expect(mockFs.writeFile).toHaveBeenCalled()
    })

    it('should assemble video with multiple video files', async () => {
      // Mock file system operations
      mockFs.readFile.mockResolvedValue(Buffer.from('mock file data'))
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: ['assets/video/story-123-1.mp4', 'assets/video/story-123-2.mp4'],
        script: 'This is a test news script for enhanced video assembly.',
        shotDurations: [5, 7]
      }

      const result = await enhancedFFmpegService.assembleVideo('story-123', assets)

      expect(result.filepath).toContain('story-123-enhanced-')
      expect(result.durationSec).toBeGreaterThan(0)
      
      // Verify FFmpeg was called with proper multiple video processing
      const { FFmpeg } = require('@ffmpeg/ffmpeg')
      const mockFFmpeg = FFmpeg.mock.results[0].value
      expect(mockFFmpeg.exec).toHaveBeenCalledWith(
        expect.arrayContaining([
          '-filter_complex',
          expect.stringContaining('concat=n=2:v=1:a=0')
        ])
      )
    })

    it('should validate input parameters', async () => {
      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test script'
      }

      // Test missing story ID
      await expect(enhancedFFmpegService.assembleVideo('', assets)).rejects.toThrow(
        EnhancedFFmpegServiceError
      )

      // Test missing audio file
      await expect(enhancedFFmpegService.assembleVideo('story-123', {
        ...assets,
        audioFilepath: ''
      })).rejects.toThrow(EnhancedFFmpegServiceError)

      // Test missing video file
      await expect(enhancedFFmpegService.assembleVideo('story-123', {
        ...assets,
        videoFilepath: ''
      })).rejects.toThrow(EnhancedFFmpegServiceError)

      // Test missing script
      await expect(enhancedFFmpegService.assembleVideo('story-123', {
        ...assets,
        script: ''
      })).rejects.toThrow(EnhancedFFmpegServiceError)
    })

    it('should handle FFmpeg execution errors', async () => {
      // Mock file system operations
      mockFs.readFile.mockResolvedValue(Buffer.from('mock file data'))
      mockFs.mkdir.mockResolvedValue(undefined)

      // Mock FFmpeg exec to throw error
      const { FFmpeg } = require('@ffmpeg/ffmpeg')
      const mockFFmpegInstance = new FFmpeg()
      mockFFmpegInstance.exec.mockRejectedValue(new Error('FFmpeg execution failed'))
      
      const newService = new EnhancedFFmpegService()
      // Replace the internal ffmpeg instance
      ;(newService as any).ffmpeg = mockFFmpegInstance
      ;(newService as any).isInitialized = true

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test script'
      }

      await expect(newService.assembleVideo('story-123', assets)).rejects.toThrow(
        EnhancedFFmpegServiceError
      )
    })

    it('should handle file read errors', async () => {
      // Mock file system read to fail
      mockFs.readFile.mockRejectedValue(new Error('File not found'))

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test script'
      }

      await expect(enhancedFFmpegService.assembleVideo('story-123', assets)).rejects.toThrow(
        EnhancedFFmpegServiceError
      )
    })
  })

  describe('createFinalVideo', () => {
    it('should create final video record in database', async () => {
      // Mock successful database response
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ 
          data: [createMockVideo({
            story_id: 'story-123',
            filepath: 'enhanced-video.mp4',
            duration_sec: 25
          })], 
          error: null 
        })
      }

      // Replace supabase instance
      const originalSupabase = (enhancedFFmpegService as any).supabase
      ;(enhancedFFmpegService as any).supabase = mockSupabase

      const video = await enhancedFFmpegService.createFinalVideo(
        'story-123',
        '/path/to/enhanced-video.mp4',
        25
      )

      expect(video).toEqual(createMockVideo({
        story_id: 'story-123',
        filepath: 'enhanced-video.mp4',
        duration_sec: 25
      }))

      // Restore original
      ;(enhancedFFmpegService as any).supabase = originalSupabase
    })

    it('should handle database insertion errors', async () => {
      // Mock database to return error
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' } 
        })
      }

      // Replace supabase instance
      const originalSupabase = (enhancedFFmpegService as any).supabase
      ;(enhancedFFmpegService as any).supabase = mockSupabase

      await expect(enhancedFFmpegService.createFinalVideo(
        'story-123',
        '/path/to/video.mp4',
        25
      )).rejects.toThrow(EnhancedFFmpegServiceError)

      // Restore original
      ;(enhancedFFmpegService as any).supabase = originalSupabase
    })
  })

  describe('generateEnhancedCaptions', () => {
    it('should generate enhanced captions with proper timing', async () => {
      // Access private method for testing
      const generateEnhancedCaptions = (enhancedFFmpegService as any).generateEnhancedCaptions.bind(enhancedFFmpegService)
      
      const script = 'This is a test script for caption generation'
      const audioDurationMs = 10000 // 10 seconds
      
      const captions = await generateEnhancedCaptions(script, audioDurationMs)
      
      expect(captions).toBeDefined()
      expect(captions).toContain('This is') // Should contain chunked text
      expect(captions).toContain('00:00:00,000') // Should contain SRT timestamps
    })
  })

  describe('createCaptionChunks', () => {
    it('should break script into appropriate chunks', () => {
      // Access private method for testing
      const createCaptionChunks = (enhancedFFmpegService as any).createCaptionChunks.bind(enhancedFFmpegService)
      
      const script = 'This is a test news script for enhanced video assembly'
      const chunks = createCaptionChunks(script)
      
      expect(chunks).toEqual([
        'This is',
        'a test',
        'news script',
        'for enhanced',
        'video assembly'
      ])
    })

    it('should handle edge cases for caption chunks', () => {
      const createCaptionChunks = (enhancedFFmpegService as any).createCaptionChunks.bind(enhancedFFmpegService)
      
      // Single word
      expect(createCaptionChunks('Hello')).toEqual(['Hello'])
      
      // Two words
      expect(createCaptionChunks('Hello world')).toEqual(['Hello world'])
      
      // Empty script
      expect(createCaptionChunks('')).toEqual([])
      
      // Three words
      expect(createCaptionChunks('Hello world test')).toEqual(['Hello world', 'test'])
    })
  })

  describe('buildSubtitleFilter', () => {
    it('should build correct subtitle filter with enhanced styling', () => {
      // Access private method for testing
      const buildSubtitleFilter = (enhancedFFmpegService as any).buildSubtitleFilter.bind(enhancedFFmpegService)
      
      const filter = buildSubtitleFilter('captions.srt')
      
      expect(filter).toContain('subtitles=captions.srt')
      expect(filter).toContain('force_style=')
      expect(filter).toContain('Fontname=Arial Black')
      expect(filter).toContain('Fontsize=20')
      expect(filter).toContain('PrimaryColour=&Hffffff&')
      expect(filter).toContain('Bold=1')
    })
  })

  describe('cleanup', () => {
    it('should cleanup FFmpeg resources', async () => {
      await enhancedFFmpegService.initialize()
      
      const { FFmpeg } = require('@ffmpeg/ffmpeg')
      const mockFFmpeg = FFmpeg.mock.results[0].value
      
      await enhancedFFmpegService.cleanup()
      
      expect(mockFFmpeg.terminate).toHaveBeenCalled()
    })

    it('should handle cleanup errors gracefully', async () => {
      await enhancedFFmpegService.initialize()
      
      const { FFmpeg } = require('@ffmpeg/ffmpeg')
      const mockFFmpeg = FFmpeg.mock.results[0].value
      mockFFmpeg.terminate.mockRejectedValue(new Error('Cleanup failed'))
      
      // Should not throw
      await enhancedFFmpegService.cleanup()
    })
  })
})