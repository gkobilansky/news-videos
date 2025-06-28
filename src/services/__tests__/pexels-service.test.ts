import { PexelsService, PexelsServiceError } from '../pexels-service'
import { createMockAsset } from '../../lib/test-utils'
import fs from 'fs/promises'
import path from 'path'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('../../lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          data: [createMockAsset({ provider: 'pexels', story_id: 'story-123' })],
          error: null
        }))
      }))
    }))
  }
}))

// Mock fetch for API calls and video downloads
const mockFetch = jest.fn()
global.fetch = mockFetch

const mockFs = fs as jest.Mocked<typeof fs>

describe('PexelsService', () => {
  let pexelsService: PexelsService

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variable
    process.env.PEXELS_API_KEY = 'test-pexels-key'
    
    pexelsService = new PexelsService()
  })

  afterEach(() => {
    delete process.env.PEXELS_API_KEY
  })

  describe('constructor', () => {
    it('should require PEXELS_API_KEY', () => {
      delete process.env.PEXELS_API_KEY
      expect(() => new PexelsService()).toThrow('Pexels API key is required')
    })

    it('should initialize successfully with valid API key', () => {
      expect(() => new PexelsService()).not.toThrow()
    })
  })

  describe('searchVideos', () => {
    it('should search for videos using query term', async () => {
      const mockPexelsResponse = {
        videos: [
          {
            id: 123456,
            width: 1280,
            height: 720,
            duration: 15,
            video_files: [
              {
                id: 1,
                quality: 'hd',
                file_type: 'video/mp4',
                link: 'https://videos.pexels.com/test-video-hd.mp4',
                width: 1280,
                height: 720
              },
              {
                id: 2,
                quality: 'sd',
                file_type: 'video/mp4',
                link: 'https://videos.pexels.com/test-video-sd.mp4',
                width: 854,
                height: 480
              }
            ]
          }
        ],
        page: 1,
        per_page: 15,
        total_results: 1
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPexelsResponse)
      } as Response)

      const result = await pexelsService.searchVideos('technology news')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.pexels.com/videos/search?query=technology+news&per_page=15&page=1&orientation=portrait',
        {
          headers: {
            'Authorization': 'test-pexels-key'
          }
        }
      )

      expect(result).toEqual({
        videos: [
          {
            id: 123456,
            width: 1280,
            height: 720,
            duration: 15,
            video_files: [
              {
                id: 1,
                quality: 'hd',
                file_type: 'video/mp4',
                link: 'https://videos.pexels.com/test-video-hd.mp4',
                width: 1280,
                height: 720
              },
              {
                id: 2,
                quality: 'sd',
                file_type: 'video/mp4',
                link: 'https://videos.pexels.com/test-video-sd.mp4',
                width: 854,
                height: 480
              }
            ]
          }
        ],
        page: 1,
        per_page: 15,
        total_results: 1
      })
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response)

      await expect(
        pexelsService.searchVideos('test query')
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.searchVideos('test query')
      ).rejects.toThrow('Failed to search videos: 429 Too Many Requests')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        pexelsService.searchVideos('test query')
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.searchVideos('test query')
      ).rejects.toThrow('Failed to search videos')
    })

    it('should validate query parameter', async () => {
      await expect(
        pexelsService.searchVideos('')
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.searchVideos('')
      ).rejects.toThrow('Search query is required')
    })
  })

  describe('getBestVideoUrl', () => {
    it('should select highest quality portrait video', () => {
      const video = {
        id: 123456,
        width: 1280,
        height: 720,
        duration: 15,
        video_files: [
          {
            id: 1,
            quality: 'sd',
            file_type: 'video/mp4',
            link: 'https://videos.pexels.com/test-video-sd.mp4',
            width: 854,
            height: 480
          },
          {
            id: 2,
            quality: 'hd',
            file_type: 'video/mp4',
            link: 'https://videos.pexels.com/test-video-hd.mp4',
            width: 720,  // Portrait format
            height: 1280
          },
          {
            id: 3,
            quality: 'hd',
            file_type: 'video/mp4',
            link: 'https://videos.pexels.com/test-video-hd2.mp4',
            width: 1280,  // Landscape format
            height: 720
          }
        ]
      }

      const result = pexelsService.getBestVideoUrl(video)
      
      // Should prefer portrait format
      expect(result).toBe('https://videos.pexels.com/test-video-hd.mp4')
    })

    it('should fallback to highest quality video if no portrait available', () => {
      const video = {
        id: 123456,
        width: 1280,
        height: 720,
        duration: 15,
        video_files: [
          {
            id: 1,
            quality: 'sd',
            file_type: 'video/mp4',
            link: 'https://videos.pexels.com/test-video-sd.mp4',
            width: 854,
            height: 480
          },
          {
            id: 2,
            quality: 'hd',
            file_type: 'video/mp4',
            link: 'https://videos.pexels.com/test-video-hd.mp4',
            width: 1280,
            height: 720
          }
        ]
      }

      const result = pexelsService.getBestVideoUrl(video)
      
      // Should select highest quality available
      expect(result).toBe('https://videos.pexels.com/test-video-hd.mp4')
    })

    it('should return first video file if no quality info available', () => {
      const video = {
        id: 123456,
        width: 1280,
        height: 720,
        duration: 15,
        video_files: [
          {
            id: 1,
            quality: 'unknown',
            file_type: 'video/mp4',
            link: 'https://videos.pexels.com/test-video.mp4',
            width: 854,
            height: 480
          }
        ]
      }

      const result = pexelsService.getBestVideoUrl(video)
      
      expect(result).toBe('https://videos.pexels.com/test-video.mp4')
    })
  })

  describe('downloadAndCreateAsset', () => {
    it('should download video and create asset record', async () => {
      const videoData = new ArrayBuffer(1024)
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(videoData)
      } as Response)

      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const result = await pexelsService.downloadAndCreateAsset(
        'story-123',
        'https://videos.pexels.com/test-video.mp4',
        15
      )

      expect(mockFetch).toHaveBeenCalledWith('https://videos.pexels.com/test-video.mp4')
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/assets\/video$/),
        { recursive: true }
      )
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/assets\/video\/story-123-pexels\.mp4$/),
        Buffer.from(videoData)
      )

      expect(result.kind).toBe('video')
      expect(result.provider).toBe('pexels')
    })

    it('should handle download failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response)

      await expect(
        pexelsService.downloadAndCreateAsset(
          'story-123',
          'https://videos.pexels.com/invalid-video.mp4',
          15
        )
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.downloadAndCreateAsset(
          'story-123',
          'https://videos.pexels.com/invalid-video.mp4',
          15
        )
      ).rejects.toThrow('Failed to download video: 404 Not Found')
    })

    it('should validate input parameters', async () => {
      await expect(
        pexelsService.downloadAndCreateAsset('', 'https://example.com/video.mp4', 15)
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.downloadAndCreateAsset('story-123', '', 15)
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.downloadAndCreateAsset('story-123', 'https://example.com/video.mp4', 0)
      ).rejects.toThrow(PexelsServiceError)
    })

    it('should cleanup file if database save fails', async () => {
      const videoData = new ArrayBuffer(1024)
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(videoData)
      } as Response)

      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.unlink.mockResolvedValue(undefined)

      // Mock database error
      const { supabaseAdmin } = require('../../lib/supabase')
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            data: null,
            error: { message: 'Database error' }
          }))
        }))
      })

      await expect(
        pexelsService.downloadAndCreateAsset(
          'story-123',
          'https://videos.pexels.com/test-video.mp4',
          15
        )
      ).rejects.toThrow(PexelsServiceError)

      expect(mockFs.unlink).toHaveBeenCalled()
    })
  })

  describe('generateVideoForStory', () => {
    it('should search, select, and download video for story', async () => {
      const mockPexelsResponse = {
        videos: [
          {
            id: 123456,
            width: 720,
            height: 1280,
            duration: 15,
            video_files: [
              {
                id: 1,
                quality: 'hd',
                file_type: 'video/mp4',
                link: 'https://videos.pexels.com/test-video.mp4',
                width: 720,
                height: 1280
              }
            ]
          }
        ],
        page: 1,
        per_page: 15,
        total_results: 1
      }

      const videoData = new ArrayBuffer(1024)

      // Mock search API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPexelsResponse)
      } as Response)

      // Mock video download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(videoData)
      } as Response)

      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      const result = await pexelsService.generateVideoForStory(
        'story-123',
        'technology business news'
      )

      expect(result.kind).toBe('video')
      expect(result.provider).toBe('pexels')
      expect(result.story_id).toBe('story-123')
    })

    it('should handle no videos found', async () => {
      // Reset the mock behavior for this test
      mockFetch.mockReset()
      
      const mockPexelsResponse = {
        videos: [],
        page: 1,
        per_page: 15,
        total_results: 0
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPexelsResponse)
      } as Response)

      await expect(
        pexelsService.generateVideoForStory('story-123', 'very specific search that has no results')
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.generateVideoForStory('story-123', 'very specific search that has no results')
      ).rejects.toThrow('No videos found for query')
    })

    it('should validate input parameters', async () => {
      await expect(
        pexelsService.generateVideoForStory('', 'test query')
      ).rejects.toThrow(PexelsServiceError)

      await expect(
        pexelsService.generateVideoForStory('story-123', '')
      ).rejects.toThrow(PexelsServiceError)
    })

    it('should use provider-specific filename to prevent conflicts', async () => {
      const mockPexelsResponse = {
        videos: [
          {
            id: 123456,
            width: 720,
            height: 1280,
            duration: 15,
            video_files: [
              {
                id: 1,
                quality: 'hd',
                file_type: 'video/mp4',
                link: 'https://videos.pexels.com/test-video.mp4',
                width: 720,
                height: 1280
              }
            ]
          }
        ],
        page: 1,
        per_page: 15,
        total_results: 1
      }

      const videoData = new ArrayBuffer(1024)

      // Mock search API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPexelsResponse)
      } as Response)

      // Mock video download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(videoData)
      } as Response)

      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)

      // Mock the Supabase response to return the correct filepath
      const { supabaseAdmin } = require('../../lib/supabase')
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            data: [createMockAsset({ 
              provider: 'pexels', 
              story_id: 'story-123',
              filepath: 'assets/video/story-123-pexels.mp4'
            })],
            error: null
          }))
        }))
      })

      const result = await pexelsService.generateVideoForStory(
        'story-123',
        'technology business news'
      )

      // Verify the filename includes the provider suffix
      expect(result.filepath).toContain('-pexels.mp4')
      expect(result.filepath).not.toContain('-runway.mp4')
      
      expect(result.kind).toBe('video')
      expect(result.provider).toBe('pexels')
      expect(result.story_id).toBe('story-123')
    })
  })

  describe('error handling', () => {
    it('should create proper error instances', () => {
      const error = new PexelsServiceError('Test error', 'TEST_CODE')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(PexelsServiceError)
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_CODE')
      expect(error.name).toBe('PexelsServiceError')
    })
  })
}) 