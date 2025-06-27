import { VideoOrchestrationService, VideoOrchestrationServiceError } from '../video-orchestration-service'
import { createMockStory, createMockScript, createMockAsset, createMockVideo } from '../../lib/test-utils'
import { Story, Script } from '../../types'

// Mock all dependent services before importing orchestration service
jest.mock('../tts-service', () => ({
  ttsService: {
    generateTTSForStory: jest.fn()
  }
}))

jest.mock('../video-generation-service', () => ({
  videoGenerationService: {
    generateVideoForStory: jest.fn()
  }
}))

jest.mock('../ffmpeg-service', () => ({
  ffmpegService: {
    assembleVideoForStory: jest.fn()
  }
}))

jest.mock('../story-service', () => ({
  storyService: {
    getStory: jest.fn(),
    updateStoryStatus: jest.fn()
  }
}))

jest.mock('../script-service', () => ({
  scriptService: {
    getScript: jest.fn()
  }
}))

describe('VideoOrchestrationService', () => {
  let orchestrationService: VideoOrchestrationService
  let mockTTSService: any
  let mockVideoGenerationService: any
  let mockFFmpegService: any
  let mockStoryService: any
  let mockScriptService: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Get mocked services
    mockTTSService = require('../tts-service').ttsService
    mockVideoGenerationService = require('../video-generation-service').videoGenerationService
    mockFFmpegService = require('../ffmpeg-service').ffmpegService
    mockStoryService = require('../story-service').storyService
    mockScriptService = require('../script-service').scriptService

    orchestrationService = new VideoOrchestrationService()
  })

  describe('generateVideoForStory', () => {
    it('should orchestrate complete video generation pipeline', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        headline: 'Breaking: Major tech breakthrough announced',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Major tech breakthrough announced today. This could revolutionize the industry. Scientists are excited about the possibilities.'
      })

      const mockAudioAsset = createMockAsset({
        id: 'audio-123',
        story_id: 'story-123',
        kind: 'audio',
        provider: 'openai',
        filepath: 'assets/audio/story-123.wav'
      })

      const mockVideoAsset = createMockAsset({
        id: 'video-123', 
        story_id: 'story-123',
        kind: 'video',
        provider: 'runway',
        filepath: 'assets/video/story-123.mp4'
      })

      const mockFinalVideo = createMockVideo({
        id: 'final-123',
        story_id: 'story-123',
        filepath: 'output/story-123.mp4',
        duration_sec: 15
      })

      const mockUpdatedStory = createMockStory({
        ...mockStory,
        status: 'done'
      })

      // Mock service calls
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockUpdatedStory)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockResolvedValue(mockVideoAsset)
      
      mockFFmpegService.assembleVideoForStory.mockResolvedValue(mockFinalVideo)

      const result = await orchestrationService.generateVideoForStory('story-123')

      // Verify the complete pipeline was executed
      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
      expect(mockScriptService.getScript).toHaveBeenCalledWith('story-123')
      
      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'generating')
      
      expect(mockTTSService.generateTTSForStory).toHaveBeenCalledWith(
        'story-123',
        mockScript.text
      )
      
      expect(mockVideoGenerationService.generateVideoForStory).toHaveBeenCalledWith(
        'story-123',
        expect.stringContaining('tech breakthrough')
      )
      
      expect(mockFFmpegService.assembleVideoForStory).toHaveBeenCalledWith(
        'story-123',
        {
          audioFilepath: mockAudioAsset.filepath,
          videoFilepath: mockVideoAsset.filepath,
          script: mockScript.text
        }
      )
      
      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'done')

      expect(result).toEqual(mockFinalVideo)
    })

    it('should handle story not found', async () => {
      mockStoryService.getStory.mockResolvedValue(null)

      await expect(
        orchestrationService.generateVideoForStory('nonexistent-story')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      await expect(
        orchestrationService.generateVideoForStory('nonexistent-story')
      ).rejects.toThrow('Story not found')
    })

    it('should handle missing script', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'editing'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(null)

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow('Script not found')
    })

    it('should handle invalid story status', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'draft' // Not ready for video generation
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow('Story must be in editing status')
    })

    it('should mark story as failed on TTS error and cleanup', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Test script'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockStory)
      
      mockTTSService.generateTTSForStory.mockRejectedValue(new Error('TTS failed'))

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'generating')
      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'failed')
    })

    it('should mark story as failed on video generation error and cleanup', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Test script'
      })

      const mockAudioAsset = createMockAsset({
        id: 'audio-123',
        story_id: 'story-123',
        kind: 'audio',
        filepath: 'assets/audio/story-123.wav'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockStory)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockRejectedValue(new Error('Video generation failed'))

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'failed')
    })

    it('should mark story as failed on ffmpeg assembly error and cleanup', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Test script'
      })

      const mockAudioAsset = createMockAsset({
        kind: 'audio',
        filepath: 'assets/audio/story-123.wav'
      })

      const mockVideoAsset = createMockAsset({
        kind: 'video',
        filepath: 'assets/video/story-123.mp4'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockStory)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockResolvedValue(mockVideoAsset)
      mockFFmpegService.assembleVideoForStory.mockRejectedValue(new Error('FFmpeg failed'))

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'failed')
    })

    it('should validate input parameters', async () => {
      await expect(
        orchestrationService.generateVideoForStory('')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      await expect(
        orchestrationService.generateVideoForStory('   ')
      ).rejects.toThrow(VideoOrchestrationServiceError)
    })
  })

  describe('generateVideoPrompt', () => {
    it('should generate video prompt from story headline', () => {
      const story: Story = createMockStory({
        headline: 'Scientists discover new species in deep ocean',
        hot_take: 'This could change our understanding of marine life'
      })

      const prompt = (orchestrationService as any).generateVideoPrompt(story)

      expect(prompt).toContain('Scientists discover new species in deep ocean')
      expect(prompt).toContain('marine life')
      expect(prompt).toMatch(/news|breaking|scientific|discovery/i)
    })

    it('should generate prompt without hot take if not provided', () => {
      const story: Story = createMockStory({
        headline: 'Market reaches new highs',
        hot_take: ''
      })

      const prompt = (orchestrationService as any).generateVideoPrompt(story)

      expect(prompt).toContain('Market reaches new highs')
      expect(prompt).toMatch(/news|market|financial/i)
    })
  })

  describe('getStatusMessage', () => {
    it('should provide appropriate status messages', () => {
      const service = orchestrationService as any

      expect(service.getStatusMessage('tts')).toContain('Generating audio')
      expect(service.getStatusMessage('video')).toContain('Creating video')
      expect(service.getStatusMessage('assembly')).toContain('Assembling final')
      expect(service.getStatusMessage('unknown')).toContain('Processing')
    })
  })
})