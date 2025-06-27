import { TTSService, TTSServiceError } from '../tts-service'
import { createMockAsset, createTestDirectories, cleanupTestDirectories } from '../../lib/test-utils'
import fs from 'fs/promises'
import path from 'path'

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: jest.fn()
      }
    }
  }))
})

// Mock fs operations
jest.mock('fs/promises')

describe('TTSService', () => {
  let ttsService: TTSService
  let mockOpenAI: any
  let mockFs: jest.Mocked<typeof fs>

  beforeEach(() => {
    jest.clearAllMocks()
    mockFs = fs as jest.Mocked<typeof fs>
    
    const OpenAI = require('openai')
    mockOpenAI = new OpenAI()
    
    // Mock the environment variable for the constructor
    process.env.OPENAI_API_KEY = 'test-key'
    ttsService = new TTSService(mockOpenAI)
    
    createTestDirectories()
  })

  afterEach(async () => {
    await cleanupTestDirectories()
  })

  describe('generateSpeech', () => {
    it('should generate TTS audio file with correct parameters', async () => {
      const mockAudioBuffer = Buffer.from('mock-audio-data')
      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer.buffer)
      }
      
      mockOpenAI.audio.speech.create.mockResolvedValue(mockResponse)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.mkdir.mockResolvedValue(undefined)

      const result = await ttsService.generateSpeech('story-123', 'Hello world, this is a test script.')

      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-1',
        voice: 'alloy',
        input: 'Hello world, this is a test script.',
        response_format: 'wav'
      })

      expect(mockResponse.arrayBuffer).toHaveBeenCalled()

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(/assets\/audio$/),
        { recursive: true }
      )

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/assets\/audio\/story-123\.wav$/),
        expect.any(Buffer)
      )

      expect(result).toEqual({
        filepath: expect.stringMatching(/assets\/audio\/story-123\.wav$/),
        durationMs: expect.any(Number)
      })
    })

    it('should handle OpenAI API errors gracefully', async () => {
      const apiError = new Error('OpenAI API rate limit exceeded')
      mockOpenAI.audio.speech.create.mockRejectedValue(apiError)

      await expect(
        ttsService.generateSpeech('story-123', 'Test script')
      ).rejects.toThrow(TTSServiceError)

      await expect(
        ttsService.generateSpeech('story-123', 'Test script')
      ).rejects.toThrow('Failed to generate TTS audio')
    })

    it('should handle file system errors gracefully', async () => {
      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('audio').buffer)
      }
      mockOpenAI.audio.speech.create.mockResolvedValue(mockResponse)
      
      const fsError = new Error('Permission denied')
      mockFs.writeFile.mockRejectedValue(fsError)

      await expect(
        ttsService.generateSpeech('story-123', 'Test script')
      ).rejects.toThrow(TTSServiceError)
    })

    it('should validate input parameters', async () => {
      await expect(
        ttsService.generateSpeech('', 'Valid script')
      ).rejects.toThrow(TTSServiceError)

      await expect(
        ttsService.generateSpeech('story-123', '')
      ).rejects.toThrow(TTSServiceError)

      await expect(
        ttsService.generateSpeech('story-123', '   ')
      ).rejects.toThrow(TTSServiceError)
    })

    it('should estimate duration based on script length', async () => {
      const mockResponse = {
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('audio').buffer)
      }
      mockOpenAI.audio.speech.create.mockResolvedValue(mockResponse)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.mkdir.mockResolvedValue(undefined)

      // Test short script (should be around 3600ms for 15 words at 150 WPM)
      const shortScript = 'This is a short script with exactly fifteen words to test duration estimation functionality.'
      const shortResult = await ttsService.generateSpeech('story-123', shortScript)
      
      // Assuming 150 words per minute (2.5 words per second)
      expect(shortResult.durationMs).toBeGreaterThan(4000)
      expect(shortResult.durationMs).toBeLessThan(8000)

      // Test longer script
      const longScript = 'This is a much longer script that contains many more words than the previous example and should result in a longer estimated duration for the generated audio file.'
      const longResult = await ttsService.generateSpeech('story-456', longScript)
      
      expect(longResult.durationMs).toBeGreaterThan(shortResult.durationMs)
    })
  })

  describe('createAudioAsset', () => {
    it('should create audio asset record in database', async () => {
      // Mock Supabase operations
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockResolvedValue({
        data: [createMockAsset({
          id: 'asset-123',
          story_id: 'story-123',
          kind: 'audio',
          provider: 'openai',
          filepath: 'assets/audio/story-123.wav',
          metadata: { durationMs: 3000 }
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
      ;(ttsService as any).supabase = mockSupabase

      const asset = await ttsService.createAudioAsset(
        'story-123',
        'assets/audio/story-123.wav',
        3000
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('assets')
      expect(mockInsert).toHaveBeenCalledWith({
        story_id: 'story-123',
        kind: 'audio',
        provider: 'openai',
        filepath: 'assets/audio/story-123.wav',
        metadata: { durationMs: 3000 }
      })

      expect(asset.kind).toBe('audio')
      expect(asset.provider).toBe('openai')
      expect(asset.metadata).toEqual({ durationMs: 3000 })
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

      ;(ttsService as any).supabase = mockSupabase

      await expect(
        ttsService.createAudioAsset('story-123', 'test.wav', 1000)
      ).rejects.toThrow(TTSServiceError)
    })
  })

  describe('generateTTSForStory', () => {
    it('should orchestrate complete TTS generation process', async () => {
      // Mock generateSpeech
      const mockGenerateSpeech = jest.spyOn(ttsService, 'generateSpeech')
        .mockResolvedValue({
          filepath: 'assets/audio/story-123.wav',
          durationMs: 3000
        })

      // Mock createAudioAsset
      const mockCreateAsset = jest.spyOn(ttsService, 'createAudioAsset')
        .mockResolvedValue(createMockAsset({
          id: 'asset-123',
          story_id: 'story-123',
          kind: 'audio',
          provider: 'openai',
          filepath: 'assets/audio/story-123.wav',
          metadata: { durationMs: 3000 }
        }))

      const result = await ttsService.generateTTSForStory('story-123', 'Test script content')

      expect(mockGenerateSpeech).toHaveBeenCalledWith('story-123', 'Test script content')
      expect(mockCreateAsset).toHaveBeenCalledWith(
        'story-123',
        'assets/audio/story-123.wav',
        3000
      )

      expect(result.kind).toBe('audio')
      expect(result.provider).toBe('openai')
      expect(result.filepath).toBe('assets/audio/story-123.wav')
    })

    it('should clean up files if asset creation fails', async () => {
      const mockGenerateSpeech = jest.spyOn(ttsService, 'generateSpeech')
        .mockResolvedValue({
          filepath: 'assets/audio/story-123.wav',
          durationMs: 3000
        })

      const mockCreateAsset = jest.spyOn(ttsService, 'createAudioAsset')
        .mockRejectedValue(new Error('Database error'))

      mockFs.unlink = jest.fn().mockResolvedValue(undefined)

      await expect(
        ttsService.generateTTSForStory('story-123', 'Test script')
      ).rejects.toThrow(TTSServiceError)

      expect(mockFs.unlink).toHaveBeenCalledWith('assets/audio/story-123.wav')
    })
  })
})