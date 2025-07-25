import { Story, Script, Video, Asset, Storyboard } from '../types'
import { storyService } from './story-service'
import { scriptService } from './script-service'
import { ttsService } from './tts-service'
import { videoGenerationService } from './video-generation-service'
import { ffmpegService } from './ffmpeg-service'
import { videoService } from './video-service'


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

    console.log(`🎬 Starting video generation for story: ${storyId}`)
    let story: Story | null = null

    try {
      // 1. Validate story exists and is ready for video generation
      console.log(`📋 Validating story ${storyId}...`)
      story = await storyService.getStory(storyId)
      if (!story) {
        throw new VideoOrchestrationServiceError('Story not found', 'STORY_NOT_FOUND')
      }

      console.log(`📄 Story found: "${story.headline}" (status: ${story.status})`)
      
      if (story.status !== 'editing') {
        throw new VideoOrchestrationServiceError(
          'Story must be in editing status to generate video',
          'INVALID_STATUS'
        )
      }

      // 2. Get the script
      console.log(`📝 Fetching script for story ${storyId}...`)
      const script = await scriptService.getScript(storyId)
      if (!script) {
        throw new VideoOrchestrationServiceError('Script not found for story', 'SCRIPT_NOT_FOUND')
      }

      console.log(`📝 Script found: ${script.text.length} characters`)

      // 3. Update story status to generating
      console.log(`📊 Updating story status to generating...`)
      await storyService.updateStoryStatus(storyId, 'generating')

      // 4. Generate TTS audio
      console.log(`${this.getStatusMessage('tts')} for story ${storyId}`)
      const audioAsset = await ttsService.generateTTSForStory(storyId, script.text)
      console.log(`🔊 Audio generated: ${audioAsset.filepath}`)

      // 5. Generate video b-roll with AI
      console.log(`${this.getStatusMessage('video')} for story ${storyId}`)
      const videoFilepaths = await this.generateVideoAssets(storyId, story)
      console.log(`🎥 Video assets generated: ${videoFilepaths.length} files`)

      // 6. Assemble final video with ffmpeg
      console.log(`${this.getStatusMessage('assembly')} for story ${storyId}`)
      const assemblyResult = await ffmpegService.assembleVideo(storyId, {
        audioFilepath: audioAsset.filepath,
        videoFilepath: videoFilepaths,
        script: script.text
      })
      console.log(`🎬 Final video assembled: ${assemblyResult.filepath}`)

      // 7. Create video record in database
      console.log(`💾 Creating video record in database...`)
      const finalVideo = await videoService.createVideo({
        story_id: storyId,
        filepath: assemblyResult.filepath,
        duration_sec: assemblyResult.durationSec
      })

      // 8. Update story status to done
      console.log(`📊 Updating story status to done...`)
      await storyService.updateStoryStatus(storyId, 'done')

      console.log(`✅ Video generation completed successfully for story ${storyId}`)
      return finalVideo

    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Video generation failed for story ${storyId}:`, error)
      }

      // Mark story as failed if we had started processing
      if (story) {
        try {
          console.log(`📊 Updating story status to failed...`)
          await storyService.updateStoryStatus(storyId, 'failed')
        } catch (statusError) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to update story status to failed:', statusError)
          }
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

  async generateAdditionalVideoForStory(storyId: string, model: 'gen3a_turbo' | 'gen4_turbo' = 'gen3a_turbo'): Promise<Video> {
    if (!storyId || !storyId.trim()) {
      throw new VideoOrchestrationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    console.log(`🎬 Starting additional video generation for story: ${storyId}`)

    try {
      // 1. Validate story exists and is ready for additional video generation
      console.log(`📋 Validating story ${storyId}...`)
      const story = await storyService.getStory(storyId)
      if (!story) {
        throw new VideoOrchestrationServiceError('Story not found', 'STORY_NOT_FOUND')
      }

      console.log(`📄 Story found: "${story.headline}" (status: ${story.status})`)

      // Additional videos can be generated for stories with editing, done, or failed status
      // Failed stories should be allowed to retry video generation
      if (story.status === 'generating') {
        throw new VideoOrchestrationServiceError(
          'Cannot generate additional videos while another video is generating',
          'INVALID_STATUS'
        )
      }

      // Draft stories need a script first
      if (story.status === 'draft') {
        throw new VideoOrchestrationServiceError(
          'Cannot generate videos for stories in draft status. Please complete the script first.',
          'INVALID_STATUS'
        )
      }

      // 2. Get the script
      console.log(`📝 Fetching script for story ${storyId}...`)
      const script = await scriptService.getScript(storyId)
      if (!script) {
        throw new VideoOrchestrationServiceError('Script not found for story', 'SCRIPT_NOT_FOUND')
      }

      console.log(`📝 Script found: ${script.text.length} characters`)

      // 3. Generate TTS audio (reuse existing or create new)
      console.log(`${this.getStatusMessage('tts')} for additional video of story ${storyId}`)
      const audioAsset = await ttsService.generateTTSForStory(storyId, script.text)
      console.log(`🔊 Audio generated/reused: ${audioAsset.filepath}`)

      // 4. Generate video b-roll with AI variation
      console.log(`${this.getStatusMessage('video')} for additional video of story ${storyId}`)
      const videoFilepaths = await this.generateVideoAssets(storyId, story, model)
      console.log(`🎥 Video assets generated: ${videoFilepaths.length} files`)

      // 5. Get storyboard for shot durations if available
      let shotDurations: number[] | undefined
      try {
        const storyboard = await scriptService.getStoryboard(storyId)
        if (storyboard && storyboard.shots && storyboard.shots.length > 0) {
          shotDurations = storyboard.shots.map(shot => shot.duration)
          console.log(`📊 Using storyboard shot durations: ${shotDurations.join(', ')} seconds`)
        }
      } catch (error) {
        console.log(`No storyboard found for shot durations, using equal segments`)
      }
      
      // 6. Assemble final video with ffmpeg
      console.log(`${this.getStatusMessage('assembly')} for additional video of story ${storyId}`)
      const assemblyResult = await ffmpegService.assembleVideo(storyId, {
        audioFilepath: audioAsset.filepath,
        videoFilepath: videoFilepaths,
        script: script.text,
        shotDurations: shotDurations
      })
      console.log(`🎬 Final video assembled: ${assemblyResult.filepath}`)

      // 7. Create video record in database
      console.log(`💾 Creating video record in database...`)
      const finalVideo = await videoService.createVideo({
        story_id: storyId,
        filepath: assemblyResult.filepath,
        duration_sec: assemblyResult.durationSec
      })

      console.log(`✅ Additional video generation completed successfully for story ${storyId}`)
      return finalVideo

    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Additional video generation failed for story ${storyId}:`, error)
      }

      if (error instanceof VideoOrchestrationServiceError) {
        throw error
      }

      throw new VideoOrchestrationServiceError(
        `Failed to generate additional video for story: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATION_FAILED'
      )
    }
  }



  private async generateVideoAssets(storyId: string, story: Story, model: 'gen3a_turbo' | 'gen4_turbo' = 'gen3a_turbo'): Promise<string[]> {
    // Get storyboard for this story - required for video generation
    let storyboard: Storyboard | null = null
    try {
      storyboard = await scriptService.getStoryboard(storyId)
    } catch (error) {
      throw new VideoOrchestrationServiceError(
        'No storyboard found for story. Please generate a storyboard first.',
        'STORYBOARD_REQUIRED'
      )
    }

    if (!storyboard) {
      throw new VideoOrchestrationServiceError(
        'No storyboard found for story. Please generate a storyboard first.',
        'STORYBOARD_REQUIRED'
      )
    }

    // Use storyboard-based video generation
    console.log('Using storyboard-based video generation with existing reference images...')
    const videoResult = await videoGenerationService.generateVideoFromStoryboard(storyId, storyboard, undefined, model)
    
    if (!videoResult) {
      throw new VideoOrchestrationServiceError(
        'Storyboard video generation failed',
        'VIDEO_GENERATION_FAILED'
      )
    }

    console.log('Storyboard video generation succeeded')
    console.log(`Successfully generated storyboard video for story ${storyId}`)
    
    if (videoResult.allClips && videoResult.allClips.length > 0) {
      console.log(`📹 Generated ${videoResult.allClips.length} clips for concatenation:`)
      videoResult.allClips.forEach((clip, index) => {
        console.log(`  📄 Clip ${index + 1}: ${clip}`)
      })
      
      // Return ALL clips for concatenation
      return videoResult.allClips
    } else {
      console.error('🚨 ERROR: videoResult.allClips is empty or undefined!')
      console.error('🚨 Falling back to single videoPath:', videoResult.videoPath)
      return [videoResult.videoPath]
    }
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