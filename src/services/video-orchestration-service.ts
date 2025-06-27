import { Story, Script, Video, Asset } from '../types'
import { storyService } from './story-service'
import { scriptService } from './script-service'
import { ttsService } from './tts-service'
import { videoGenerationService } from './video-generation-service'
import { ffmpegService } from './ffmpeg-service'

export class VideoOrchestrationServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'VideoOrchestrationServiceError'
  }
}

export class VideoOrchestrationService {
  async generateVideoForStory(storyId: string): Promise<Video> {
    if (!storyId || !storyId.trim()) {
      throw new VideoOrchestrationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    let story: Story | null = null

    try {
      // 1. Validate story exists and is ready for video generation
      story = await storyService.getStory(storyId)
      if (!story) {
        throw new VideoOrchestrationServiceError('Story not found', 'STORY_NOT_FOUND')
      }

      if (story.status !== 'editing') {
        throw new VideoOrchestrationServiceError(
          'Story must be in editing status to generate video',
          'INVALID_STATUS'
        )
      }

      // 2. Get the script
      const script = await scriptService.getScript(storyId)
      if (!script) {
        throw new VideoOrchestrationServiceError('Script not found for story', 'SCRIPT_NOT_FOUND')
      }

      // 3. Update story status to generating
      await storyService.updateStoryStatus(storyId, 'generating')

      // 4. Generate TTS audio
      console.log(`${this.getStatusMessage('tts')} for story ${storyId}`)
      const audioAsset = await ttsService.generateTTSForStory(storyId, script.text)

      // 5. Generate video b-roll
      console.log(`${this.getStatusMessage('video')} for story ${storyId}`)
      const videoPrompt = this.generateVideoPrompt(story)
      const videoAsset = await videoGenerationService.generateVideoForStory(storyId, videoPrompt)

      // 6. Assemble final video with ffmpeg
      console.log(`${this.getStatusMessage('assembly')} for story ${storyId}`)
      const finalVideo = await ffmpegService.assembleVideoForStory(storyId, {
        audioFilepath: audioAsset.filepath,
        videoFilepath: videoAsset.filepath,
        script: script.text
      })

      // 7. Update story status to done
      await storyService.updateStoryStatus(storyId, 'done')

      console.log(`Video generation completed successfully for story ${storyId}`)
      return finalVideo

    } catch (error) {
      console.error(`Video generation failed for story ${storyId}:`, error)

      // Mark story as failed if we had started processing
      if (story) {
        try {
          await storyService.updateStoryStatus(storyId, 'failed')
        } catch (statusError) {
          console.error('Failed to update story status to failed:', statusError)
        }
      }

      if (error instanceof VideoOrchestrationServiceError) {
        throw error
      }

      throw new VideoOrchestrationServiceError(
        `Failed to generate video for story: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATION_FAILED'
      )
    }
  }

  private generateVideoPrompt(story: Story): string {
    const basePrompt = `Create a dynamic vertical news video for: ${story.headline}`
    
    // Add visual style based on content
    let stylePrompt = ''
    const headline = story.headline.toLowerCase()
    
    if (headline.includes('tech') || headline.includes('ai') || headline.includes('digital')) {
      stylePrompt = 'High-tech futuristic environment with digital graphics and modern cityscape'
    } else if (headline.includes('market') || headline.includes('financial') || headline.includes('economic')) {
      stylePrompt = 'Professional financial district with charts, graphs, and business imagery'
    } else if (headline.includes('science') || headline.includes('research') || headline.includes('discovery')) {
      stylePrompt = 'Scientific laboratory or research facility with modern equipment'
    } else if (headline.includes('politics') || headline.includes('government') || headline.includes('election')) {
      stylePrompt = 'Government buildings, official settings, or press conference environment'
    } else if (headline.includes('climate') || headline.includes('environment') || headline.includes('green')) {
      stylePrompt = 'Natural environment with focus on sustainability and environmental themes'
    } else {
      stylePrompt = 'Professional news studio with dynamic graphics and modern broadcast setting'
    }

    let fullPrompt = `${basePrompt}. ${stylePrompt}. Professional news broadcast quality, vibrant colors, dynamic camera movement.`

    // Incorporate hot take if available
    if (story.hot_take && story.hot_take.trim()) {
      fullPrompt += ` Key theme: ${story.hot_take}`
    }

    // Ensure prompt is concise for Runway API
    if (fullPrompt.length > 500) {
      fullPrompt = fullPrompt.substring(0, 497) + '...'
    }

    return fullPrompt
  }

  private getStatusMessage(phase: string): string {
    switch (phase) {
      case 'tts':
        return 'Generating audio narration with AI voice synthesis'
      case 'video':
        return 'Creating video b-roll with AI video generation'
      case 'assembly':
        return 'Assembling final video with captions and audio sync'
      default:
        return 'Processing video generation request'
    }
  }
}

export const videoOrchestrationService = new VideoOrchestrationService()