import { supabaseAdmin } from '../lib/supabase'
import { Asset } from '../types'
import fs from 'fs/promises'
import path from 'path'

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
  error?: string
}

export class VideoGenerationService {
  private supabase = supabaseAdmin
  private readonly RUNWAY_API_URL = 'https://api.runwayml.com/v1'
  private readonly POLLING_INTERVAL_MS = 5000
  private readonly POLLING_TIMEOUT_MS = 300000 // 5 minutes

  constructor() {
    if (!process.env.RUNWAY_API_KEY) {
      throw new VideoGenerationServiceError('Runway API key is required', 'MISSING_API_KEY')
    }
  }

  async generateVideo(storyId: string, prompt: string): Promise<VideoGenerationResult> {
    if (!storyId || !storyId.trim()) {
      throw new VideoGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!prompt || !prompt.trim()) {
      throw new VideoGenerationServiceError('Video prompt is required', 'INVALID_PROMPT')
    }

    try {
      // Step 1: Generate image from text
      const imageTask = await this.createImageGenerationTask(prompt.trim())
      const completedImageTask = await this.pollTaskStatus(imageTask.id)
      
      if (!completedImageTask.output || completedImageTask.output.length === 0) {
        throw new VideoGenerationServiceError('No image generated from text prompt', 'NO_IMAGE_OUTPUT')
      }

      // Step 2: Generate video from image
      const videoTask = await this.createVideoFromImageTask(completedImageTask.output[0], prompt.trim())
      
      // Poll for task completion
      const completedVideoTask = await this.pollTaskStatus(videoTask.id)
      
      // Download the generated video
      const videoUrl = completedVideoTask.output![0]
      const filepath = await this.downloadVideo(storyId, videoUrl)
      
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

  private async createImageGenerationTask(prompt: string): Promise<RunwayTask> {
    const response = await fetch(`${this.RUNWAY_API_URL}/text_to_image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'runway-ml/runway-stable-diffusion-v1-5',
        prompt: prompt,
        width: 768,
        height: 1344 // Portrait format for vertical videos
      }),
    })

    if (!response.ok) {
      throw new VideoGenerationServiceError(
        `Failed to create image generation task: ${response.status} ${response.statusText}`,
        'API_ERROR'
      )
    }

    return response.json()
  }

  private async createVideoFromImageTask(imageUrl: string, prompt: string): Promise<RunwayTask> {
    const response = await fetch(`${this.RUNWAY_API_URL}/image_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gen3a_turbo',
        prompt_text: prompt,
        image: imageUrl,
        duration: 10
      }),
    })

    if (!response.ok) {
      throw new VideoGenerationServiceError(
        `Failed to create video generation task: ${response.status} ${response.statusText}`,
        'API_ERROR'
      )
    }

    return response.json()
  }

  private async pollTaskStatus(taskId: string): Promise<RunwayTask> {
    const startTime = Date.now()

    while (Date.now() - startTime < this.POLLING_TIMEOUT_MS) {
      const response = await fetch(`${this.RUNWAY_API_URL}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
        },
      })

      if (!response.ok) {
        throw new VideoGenerationServiceError(
          `Failed to check task status: ${response.status} ${response.statusText}`,
          'API_ERROR'
        )
      }

      const task: RunwayTask = await response.json()

      if (task.status === 'completed' && task.output && task.output.length > 0) {
        return task
      }

      if (task.status === 'failed') {
        throw new VideoGenerationServiceError(
          `Video generation failed: ${task.error || 'Unknown error'}`,
          'GENERATION_FAILED'
        )
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.POLLING_INTERVAL_MS))
    }

    throw new VideoGenerationServiceError(
      'Video generation timed out',
      'TIMEOUT'
    )
  }

  private async downloadVideo(storyId: string, videoUrl: string): Promise<string> {
    const response = await fetch(videoUrl)

    if (!response.ok) {
      throw new VideoGenerationServiceError(
        `Failed to download video: ${response.status} ${response.statusText}`,
        'DOWNLOAD_FAILED'
      )
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer())
    
    const videoDir = path.join(process.cwd(), 'assets', 'video')
    const filepath = path.join(videoDir, `${storyId}.mp4`)

    await fs.mkdir(videoDir, { recursive: true })
    await fs.writeFile(filepath, videoBuffer)

    return filepath
  }
}

export const videoGenerationService = new VideoGenerationService()