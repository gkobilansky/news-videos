import { supabaseAdmin } from '../lib/supabase'
import { Asset } from '../types'
import fs from 'fs/promises'
import path from 'path'
import { RunwayML, TaskFailedError } from '@runwayml/sdk'

export class VideoGenerationServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'VideoGenerationServiceError'
  }
}

export interface VideoGenerationResult {
  filepath: string
  durationSec: number
}

interface RunwayTask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  output?: string[]
}

export class VideoGenerationService {
  private supabase = supabaseAdmin
  private runway: RunwayML
  private readonly POLLING_TIMEOUT_MS = 300000 // 5 minutes

  constructor() {
    if (!process.env.RUNWAY_API_KEY) {
      throw new VideoGenerationServiceError('Runway API key is required', 'MISSING_API_KEY')
    }
    this.runway = new RunwayML({
      apiKey: process.env.RUNWAY_API_KEY
    })
  }

  async generateVideo(storyId: string, prompt: string, takeNumber?: number): Promise<VideoGenerationResult> {
    if (!storyId || !storyId.trim()) {
      throw new VideoGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!prompt || !prompt.trim()) {
      throw new VideoGenerationServiceError('Video prompt is required', 'INVALID_PROMPT')
    }

    try {
      // Step 1: Generate image from text (using waitForTaskOutput)
      const completedImageTask = await this.createImageGenerationTask(prompt.trim())
      
      if (!completedImageTask.output || completedImageTask.output.length === 0) {
        throw new VideoGenerationServiceError('No image generated from text prompt', 'NO_IMAGE_OUTPUT')
      }

      // Step 2: Generate video from image (using waitForTaskOutput)
      const completedVideoTask = await this.createVideoFromImageTask(completedImageTask.output[0], prompt.trim())
      
      if (!completedVideoTask.output || completedVideoTask.output.length === 0) {
        throw new VideoGenerationServiceError('No video generated from image', 'NO_VIDEO_OUTPUT')
      }
      
      // Download the generated video
      const videoUrl = completedVideoTask.output[0]
      const filepath = await this.downloadVideo(storyId, videoUrl, takeNumber)
      
      return {
        filepath,
        durationSec: 10 // Runway Gen-3 default duration
      }
    } catch (error) {
      if (error instanceof VideoGenerationServiceError) {
        throw error
      }
      
      console.error('Video generation failed:', error)
      throw new VideoGenerationServiceError(
        'Failed to generate video',
        'VIDEO_GENERATION_FAILED'
      )
    }
  }

  async createVideoAsset(storyId: string, filepath: string, durationSec: number): Promise<Asset> {
    try {
      const relativePath = path.relative(process.cwd(), filepath)
      
      const { data, error } = await this.supabase
        .from('assets')
        .insert({
          story_id: storyId,
          kind: 'video',
          provider: 'runway',
          filepath: relativePath,
          metadata: { durationSec }
        })
        .select()

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      if (!data || data.length === 0) {
        throw new Error('No asset created')
      }

      return data[0] as Asset
    } catch (error) {
      console.error('Failed to create video asset:', error)
      throw new VideoGenerationServiceError(
        'Failed to save video asset to database',
        'ASSET_CREATION_FAILED'
      )
    }
  }

  async generateVideoForStory(storyId: string, prompt: string): Promise<Asset> {
    let generatedFilepath: string | null = null

    try {
      const { filepath, durationSec } = await this.generateVideo(storyId, prompt)
      generatedFilepath = filepath

      const asset = await this.createVideoAsset(storyId, filepath, durationSec)
      
      return asset
    } catch (error) {
      if (generatedFilepath) {
        try {
          await fs.unlink(generatedFilepath)
        } catch (cleanupError) {
          console.error('Failed to cleanup video file:', cleanupError)
        }
      }

      if (error instanceof VideoGenerationServiceError) {
        throw error
      }

      throw new VideoGenerationServiceError(
        'Failed to generate video for story',
        'STORY_VIDEO_FAILED'
      )
    }
  }

  async regenerateVideoForStory(storyId: string, prompt: string, takeNumber?: number): Promise<Asset> {
    let generatedFilepath: string | null = null

    try {
      // Clean up any existing video assets for this story before regenerating
      await this.cleanupExistingVideoAssets(storyId)

      // Generate with take number suffix for multiple versions
      const { filepath, durationSec } = await this.generateVideo(storyId, prompt, takeNumber)
      generatedFilepath = filepath

      const asset = await this.createVideoAsset(storyId, filepath, durationSec)
      
      return asset
    } catch (error) {
      if (generatedFilepath) {
        try {
          await fs.unlink(generatedFilepath)
        } catch (cleanupError) {
          console.error('Failed to cleanup video file:', cleanupError)
        }
      }

      if (error instanceof VideoGenerationServiceError) {
        throw error
      }

      throw new VideoGenerationServiceError(
        'Failed to regenerate video for story',
        'STORY_VIDEO_REGENERATION_FAILED'
      )
    }
  }

  private async cleanupExistingVideoAssets(storyId: string): Promise<void> {
    try {
      // Get existing video assets for this story
      const { data: existingAssets, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('story_id', storyId)
        .eq('kind', 'video')
        .eq('provider', 'runway')

      if (error) {
        console.error('Failed to fetch existing video assets:', error)
        return // Don't fail regeneration if cleanup fails
      }

      if (existingAssets && existingAssets.length > 0) {
        // Delete files from filesystem
        for (const asset of existingAssets) {
          try {
            const fullPath = path.resolve(process.cwd(), asset.filepath)
            await fs.unlink(fullPath)
          } catch (fileError) {
            console.error(`Failed to delete video file ${asset.filepath}:`, fileError)
            // Continue with other files
          }
        }

        // Delete database records
        const { error: deleteError } = await this.supabase
          .from('assets')
          .delete()
          .eq('story_id', storyId)
          .eq('kind', 'video')
          .eq('provider', 'runway')

        if (deleteError) {
          console.error('Failed to delete existing video asset records:', deleteError)
          // Don't fail regeneration if cleanup fails
        }
      }
    } catch (error) {
      console.error('Failed to cleanup existing video assets:', error)
      // Don't fail regeneration if cleanup fails
    }
  }

  private async createImageGenerationTask(prompt: string): Promise<RunwayTask> {
    try {
      const task = await this.runway.textToImage
        .create({
          model: 'gen4_image',
          promptText: prompt,
          ratio: '720:1280' // Portrait format for vertical videos
        })
        .waitForTaskOutput({
          timeout: this.POLLING_TIMEOUT_MS
        })

      return {
        id: task.id,
        status: 'completed' as 'pending' | 'processing' | 'completed' | 'failed',
        output: task.output
      }
    } catch (error: any) {
      if (error instanceof TaskFailedError) {
        throw new VideoGenerationServiceError(
          `Image generation task failed: ${error.message}`,
          'TASK_FAILED'
        )
      }
      if (error.message && error.message.includes('timeout')) {
        throw new VideoGenerationServiceError(
          'Image generation timed out',
          'TIMEOUT'
        )
      }
      throw new VideoGenerationServiceError(
        `Failed to create image generation task: ${error.message}`,
        'API_ERROR'
      )
    }
  }

  private async createVideoFromImageTask(imageUrl: string, prompt: string): Promise<RunwayTask> {
    try {
      const task = await this.runway.imageToVideo
        .create({
          model: 'gen3a_turbo',
          promptText: prompt,
          promptImage: imageUrl,
          duration: 10,
          ratio: '768:1280' // Portrait format for vertical videos
        })
        .waitForTaskOutput({
          timeout: this.POLLING_TIMEOUT_MS
        })

      return {
        id: task.id,
        status: 'completed' as 'pending' | 'processing' | 'completed' | 'failed',
        output: task.output
      }
    } catch (error: any) {
      if (error instanceof TaskFailedError) {
        throw new VideoGenerationServiceError(
          `Video generation task failed: ${error.message}`,
          'TASK_FAILED'
        )
      }
      if (error.message && error.message.includes('timeout')) {
        throw new VideoGenerationServiceError(
          'Video generation timed out',
          'TIMEOUT'
        )
      }
      throw new VideoGenerationServiceError(
        `Failed to create video generation task: ${error.message}`,
        'API_ERROR'
      )
    }
  }



  private async downloadVideo(storyId: string, videoUrl: string, takeNumber?: number): Promise<string> {
    const response = await fetch(videoUrl)

    if (!response.ok) {
      throw new VideoGenerationServiceError(
        `Failed to download video: ${response.status} ${response.statusText}`,
        'DOWNLOAD_FAILED'
      )
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer())
    
    const videoDir = path.join(process.cwd(), 'assets', 'video')
    
    // Include take number in filename if provided
    const filename = takeNumber ? `${storyId}-take${takeNumber}.mp4` : `${storyId}.mp4`
    const filepath = path.join(videoDir, filename)

    await fs.mkdir(videoDir, { recursive: true })
    await fs.writeFile(filepath, videoBuffer)

    return filepath
  }
}

export const videoGenerationService = new VideoGenerationService()