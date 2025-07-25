import { VideoOrchestrationService, VideoOrchestrationServiceError } from '../video-orchestration-service'
import { createMockStory, createMockScript, createMockAsset, createMockVideo, createMockStoryboard } from '../../lib/test-utils'
import { Story, Script } from '../../types'

// Mock all dependent services before importing orchestration service
jest.mock('../tts-service', () => ({
  ttsService: {
    generateTTSForStory: jest.fn()
  }
}))

jest.mock('../video-generation-service', () => ({
  videoGenerationService: {
    generateVideoForStory: jest.fn(),
    generateVideoFromStoryboard: jest.fn()
  }
}))

jest.mock('../ffmpeg-service', () => ({
  ffmpegService: {
    assembleVideo: jest.fn(),
  }
}))

jest.mock('../enhanced-ffmpeg-service', () => ({
  enhancedFFmpegService: {
    assembleVideo: jest.fn(),
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
    getScript: jest.fn(),
    getStoryboard: jest.fn()
  }
}))

jest.mock('../video-service', () => ({
  videoService: {
    createVideo: jest.fn()
  }
}))

describe('VideoOrchestrationService', () => {
  let orchestrationService: VideoOrchestrationService
  let mockTTSService: any
  let mockVideoGenerationService: any
  let mockFFmpegService: any
  let mockEnhancedFFmpegService: any
  let mockStoryService: any
  let mockScriptService: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Get mocked services
    mockTTSService = require('../tts-service').ttsService
    mockVideoGenerationService = require('../video-generation-service').videoGenerationService
    mockFFmpegService = require('../ffmpeg-service').ffmpegService
    mockEnhancedFFmpegService = require('../enhanced-ffmpeg-service').enhancedFFmpegService
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

      const mockAssemblyResult = {
        filepath: 'output/story-123.mp4',
        durationSec: 15
      }

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
      
      mockFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo = jest.fn().mockResolvedValue(mockFinalVideo)

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
      
      expect(mockFFmpegService.assembleVideo).toHaveBeenCalledWith(
        'story-123',
        {
          audioFilepath: mockAudioAsset.filepath,
          videoFilepath: [mockVideoAsset.filepath],
          script: mockScript.text
        }
      )
      
      expect(mockVideoService.createVideo).toHaveBeenCalledWith({
        story_id: 'story-123',
        filepath: mockAssemblyResult.filepath,
        duration_sec: mockAssemblyResult.durationSec
      })
      
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
      mockFFmpegService.assembleVideo.mockRejectedValue(new Error('FFmpeg failed'))

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

  describe('generateAdditionalVideoForStory', () => {
    it('should generate additional video without changing story status', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        headline: 'Breaking: Major tech breakthrough announced',
        status: 'done' // Story already completed
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
        id: 'video-124', 
        story_id: 'story-123',
        kind: 'video',
        provider: 'runway',
        filepath: 'assets/video/story-123-2.mp4'
      })

      const mockAssemblyResult = {
        filepath: 'output/story-123-2.mp4',
        durationSec: 15
      }

      const mockFinalVideo = createMockVideo({
        id: 'final-124',
        story_id: 'story-123',
        filepath: 'output/story-123-2.mp4',
        duration_sec: 15
      })

      // Mock service calls
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockResolvedValue(mockVideoAsset)
      
      mockFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo.mockResolvedValue(mockFinalVideo)

      const result = await orchestrationService.generateAdditionalVideoForStory('story-123')

      // Verify the pipeline was executed but story status was NOT changed
      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
      expect(mockScriptService.getScript).toHaveBeenCalledWith('story-123')
      
      // Should NOT call updateStoryStatus for additional videos
      expect(mockStoryService.updateStoryStatus).not.toHaveBeenCalled()
      
      expect(mockTTSService.generateTTSForStory).toHaveBeenCalledWith(
        'story-123',
        mockScript.text
      )
      
      expect(mockVideoGenerationService.generateVideoForStory).toHaveBeenCalledWith(
        'story-123',
        expect.stringContaining('tech breakthrough')
      )
      
      expect(mockFFmpegService.assembleVideo).toHaveBeenCalledWith(
        'story-123',
        {
          audioFilepath: mockAudioAsset.filepath,
          videoFilepath: [mockVideoAsset.filepath],
          script: mockScript.text
        }
      )

      expect(mockVideoService.createVideo).toHaveBeenCalledWith({
        story_id: 'story-123',
        filepath: mockAssemblyResult.filepath,
        duration_sec: mockAssemblyResult.durationSec
      })

      expect(result).toEqual(mockFinalVideo)
    })

    it('should allow generating additional videos for stories with done status', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'done'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Test script'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)

      // Should not throw for done status
      expect(async () => {
        await orchestrationService.generateAdditionalVideoForStory('story-123')
      }).not.toThrow()

      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
    })

    it('should allow generating additional videos for stories with editing status', async () => {
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

      // Should not throw for editing status
      expect(async () => {
        await orchestrationService.generateAdditionalVideoForStory('story-123')
      }).not.toThrow()

      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
    })

    it('should allow generating additional videos for stories with failed status', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'failed'
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

      const mockAssemblyResult = {
        filepath: 'output/story-123-retry.mp4',
        durationSec: 15
      }

      const mockFinalVideo = createMockVideo({
        id: 'final-retry',
        story_id: 'story-123',
        filepath: 'output/story-123-retry.mp4',
        duration_sec: 15
      })

      // Mock service calls
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockResolvedValue(mockVideoAsset)
      
      mockFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo.mockResolvedValue(mockFinalVideo)

      const result = await orchestrationService.generateAdditionalVideoForStory('story-123')

      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
      expect(result).toEqual(mockFinalVideo)
    })

    it('should reject generating additional videos for stories with draft status', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'draft'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)

      await expect(
        orchestrationService.generateAdditionalVideoForStory('story-123')
      ).rejects.toThrow('Cannot generate videos for stories in draft status')
    })

    it('should reject generating additional videos while another video is generating', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'generating'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)

      await expect(
        orchestrationService.generateAdditionalVideoForStory('story-123')
      ).rejects.toThrow('Cannot generate additional videos while another video is generating')
    })

    it('should handle story not found', async () => {
      mockStoryService.getStory.mockResolvedValue(null)

      await expect(
        orchestrationService.generateAdditionalVideoForStory('nonexistent-story')
      ).rejects.toThrow('Story not found')
    })

    it('should handle missing script', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'done'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(null)

      await expect(
        orchestrationService.generateAdditionalVideoForStory('story-123')
      ).rejects.toThrow('Script not found')
    })

    it('should validate input parameters', async () => {
      await expect(
        orchestrationService.generateAdditionalVideoForStory('')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      await expect(
        orchestrationService.generateAdditionalVideoForStory('   ')
      ).rejects.toThrow(VideoOrchestrationServiceError)
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

  describe('generateVideoForStoryWithStoryboard', () => {
    it('should orchestrate video generation using storyboard with generated images', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        headline: 'Breaking: Major tech breakthrough announced',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Major tech breakthrough announced today. This could revolutionize the industry. Scientists are excited about the possibilities.'
      })

      const mockStoryboard = createMockStoryboard({
        id: 'storyboard-123',
        story_id: 'story-123',
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
            camera: { movement: 'dolly-in', angle: 'eye-level' }
          }
        ]
      })

      const mockAudioAsset = createMockAsset({
        id: 'audio-123',
        story_id: 'story-123',
        kind: 'audio',
        provider: 'openai',
        filepath: 'assets/audio/story-123.wav'
      })

      const mockVideoResult = {
        videoPath: 'assets/video/story-123-storyboard.mp4',
        allClips: [
          'assets/video/story-123-storyboard-shot1.mp4',
          'assets/video/story-123-storyboard-shot2.mp4',
          'assets/video/story-123-storyboard-shot3.mp4'
        ],
        duration: 15
      }

      const mockAssemblyResult = {
        filepath: 'output/story-123.mp4',
        durationSec: 15
      }

      const mockFinalVideo = createMockVideo({
        id: 'final-123',
        story_id: 'story-123',
        filepath: 'output/story-123.mp4',
        duration_sec: 15
      })

      // Mock service calls
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockScriptService.getStoryboard.mockResolvedValue(mockStoryboard)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockStory)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoFromStoryboard.mockResolvedValue(mockVideoResult)
      
      mockFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo.mockResolvedValue(mockFinalVideo)

      const result = await orchestrationService.generateVideoForStory('story-123')

      // Verify the complete storyboard pipeline was executed
      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
      expect(mockScriptService.getScript).toHaveBeenCalledWith('story-123')
      expect(mockScriptService.getStoryboard).toHaveBeenCalledWith('story-123')
      
      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'generating')
      
      expect(mockTTSService.generateTTSForStory).toHaveBeenCalledWith(
        'story-123',
        mockScript.text
      )
      
      expect(mockVideoGenerationService.generateVideoFromStoryboard).toHaveBeenCalledWith(
        'story-123',
        mockStoryboard
      )
      
      expect(mockFFmpegService.assembleVideo).toHaveBeenCalledWith(
        'story-123',
        {
          audioFilepath: mockAudioAsset.filepath,
          videoFilepath: mockVideoResult.allClips,
          script: mockScript.text
        }
      )
      
      expect(mockVideoService.createVideo).toHaveBeenCalledWith({
        story_id: 'story-123',
        filepath: mockAssemblyResult.filepath,
        duration_sec: mockAssemblyResult.durationSec
      })
      
      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'done')

      expect(result).toEqual(mockFinalVideo)
    })

    it('should fall back to legacy video generation if no storyboard exists', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        headline: 'Breaking: Major tech breakthrough announced',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Major tech breakthrough announced today.'
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

      const mockAssemblyResult = {
        filepath: 'output/story-123.mp4',
        durationSec: 15
      }

      const mockFinalVideo = createMockVideo({
        id: 'final-123',
        story_id: 'story-123',
        filepath: 'output/story-123.mp4',
        duration_sec: 15
      })

      // Mock service calls - no storyboard available
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockScriptService.getStoryboard.mockResolvedValue(null)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockStory)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockResolvedValue(mockVideoAsset)
      
      mockFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo.mockResolvedValue(mockFinalVideo)

      const result = await orchestrationService.generateVideoForStory('story-123')

      // Verify it falls back to legacy approach
      expect(mockScriptService.getStoryboard).toHaveBeenCalledWith('story-123')
      expect(mockVideoGenerationService.generateVideoFromStoryboard).not.toHaveBeenCalled()
      expect(mockVideoGenerationService.generateVideoForStory).toHaveBeenCalledWith(
        'story-123',
        expect.stringContaining('tech breakthrough')
      )
      
      expect(result).toEqual(mockFinalVideo)
    })

    it('should handle storyboard video generation errors gracefully', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'editing'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Test script'
      })

      const mockStoryboard = createMockStoryboard({
        story_id: 'story-123'
      })

      const mockAudioAsset = createMockAsset({
        kind: 'audio',
        filepath: 'assets/audio/story-123.wav'
      })

      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockScriptService.getStoryboard.mockResolvedValue(mockStoryboard)
      mockStoryService.updateStoryStatus.mockResolvedValue(mockStory)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoFromStoryboard.mockRejectedValue(new Error('Storyboard video generation failed'))

      await expect(
        orchestrationService.generateVideoForStory('story-123')
      ).rejects.toThrow(VideoOrchestrationServiceError)

      expect(mockStoryService.updateStoryStatus).toHaveBeenCalledWith('story-123', 'failed')
    })
  })

  describe('generateAdditionalVideoForStoryWithStoryboard', () => {
    it('should generate additional video using storyboard without changing story status', async () => {
      const mockStory = createMockStory({
        id: 'story-123',
        headline: 'Breaking: Major tech breakthrough announced',
        status: 'done'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Major tech breakthrough announced today.'
      })

      const mockStoryboard = createMockStoryboard({
        story_id: 'story-123'
      })

      const mockAudioAsset = createMockAsset({
        id: 'audio-123',
        story_id: 'story-123',
        kind: 'audio',
        provider: 'openai',
        filepath: 'assets/audio/story-123.wav'
      })

      const mockVideoResult = {
        videoPath: 'assets/video/story-123-storyboard-2.mp4',
        allClips: [
          'assets/video/story-123-storyboard-2-shot1.mp4',
          'assets/video/story-123-storyboard-2-shot2.mp4',
          'assets/video/story-123-storyboard-2-shot3.mp4'
        ],
        duration: 15
      }

      const mockAssemblyResult = {
        filepath: 'output/story-123-2.mp4',
        durationSec: 15
      }

      const mockFinalVideo = createMockVideo({
        id: 'final-124',
        story_id: 'story-123',
        filepath: 'output/story-123-2.mp4',
        duration_sec: 15
      })

      // Mock service calls
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockScriptService.getStoryboard.mockResolvedValue(mockStoryboard)
      
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoFromStoryboard.mockResolvedValue(mockVideoResult)
      
      mockFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo.mockResolvedValue(mockFinalVideo)

      const result = await orchestrationService.generateAdditionalVideoForStory('story-123')

      // Verify the pipeline was executed but story status was NOT changed
      expect(mockStoryService.getStory).toHaveBeenCalledWith('story-123')
      expect(mockScriptService.getScript).toHaveBeenCalledWith('story-123')
      expect(mockScriptService.getStoryboard).toHaveBeenCalledWith('story-123')
      
      // Should NOT call updateStoryStatus for additional videos
      expect(mockStoryService.updateStoryStatus).not.toHaveBeenCalled()
      
      expect(mockVideoGenerationService.generateVideoFromStoryboard).toHaveBeenCalledWith(
        'story-123',
        mockStoryboard
      )

      expect(result).toEqual(mockFinalVideo)
    })
  })

  describe('Enhanced FFmpeg Integration', () => {
    it('should use enhanced FFmpeg service when configured', async () => {
      const enhancedService = new VideoOrchestrationService()
      
      const mockStory = createMockStory({
        id: 'story-123',
        status: 'editing',
        headline: 'Test Enhanced Headline'
      })

      const mockScript = createMockScript({
        story_id: 'story-123',
        text: 'Test enhanced script content.'
      })

      const mockAudioAsset = createMockAsset({
        kind: 'audio',
        filepath: 'assets/audio/story-123-enhanced.wav'
      })

      const mockAssemblyResult = {
        filepath: 'output/story-123-enhanced.mp4',
        durationSec: 15
      }

      const mockFinalVideo = createMockVideo({
        id: 'final-enhanced',
        story_id: 'story-123',
        filepath: 'output/story-123-enhanced.mp4',
        duration_sec: 15
      })

      // Mock service calls
      mockStoryService.getStory.mockResolvedValue(mockStory)
      mockScriptService.getScript.mockResolvedValue(mockScript)
      mockTTSService.generateTTSForStory.mockResolvedValue(mockAudioAsset)
      mockVideoGenerationService.generateVideoForStory.mockResolvedValue(createMockAsset({
        kind: 'video',
        filepath: 'assets/video/story-123-enhanced.mp4'
      }))
      
      // Mock enhanced FFmpeg service
      mockEnhancedFFmpegService.assembleVideo.mockResolvedValue(mockAssemblyResult)

      // Mock video service
      const mockVideoService = require('../video-service').videoService
      mockVideoService.createVideo.mockResolvedValue(mockFinalVideo)

      const result = await enhancedService.generateVideoForStory('story-123')

      // Verify enhanced FFmpeg was called instead of regular FFmpeg
      expect(mockEnhancedFFmpegService.assembleVideo).toHaveBeenCalledWith('story-123', {
        audioFilepath: 'assets/audio/story-123-enhanced.wav',
        videoFilepath: ['assets/video/story-123-enhanced.mp4'],
        script: 'Test enhanced script content.'
      })
      
      // Verify regular FFmpeg was NOT called
      expect(mockFFmpegService.assembleVideo).not.toHaveBeenCalled()

      expect(result).toEqual(mockFinalVideo)
    })
  })
})