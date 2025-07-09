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
  videoPath: string
  allClips: string[]
  duration: number
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

  async generateVideoFromStoryboard(storyId: string, storyboard: any, takeNumber?: number, model: 'gen3a_turbo' | 'gen4_turbo' = 'gen3a_turbo'): Promise<VideoGenerationResult> {
    if (!storyId || !storyId.trim()) {
      throw new VideoGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!storyboard || !storyboard.shots || storyboard.shots.length === 0) {
      throw new VideoGenerationServiceError('Valid storyboard is required', 'INVALID_STORYBOARD')
    }

    try {
      console.log(`🎬 Starting storyboard video generation with ${storyboard.shots.length} shots...`)
      
      // Get existing reference images for this story instead of generating new ones
      console.log('📸 Retrieving existing reference images from database...')
      const existingImages = await this.getExistingImageAssets(storyId)
      
      if (existingImages.length === 0) {
        throw new VideoGenerationServiceError(
          'No reference images found for story. Please generate storyboard images first.',
          'NO_REFERENCE_IMAGES'
        )
      }
      
      console.log(`✅ Found ${existingImages.length} existing reference images`)

      // Build the storyboard request with optimized prompts
      const selectedModel = model || 'gen3a_turbo'
      const storyboardRequest = {
        model: selectedModel,
        ratio: storyboard.ratio || this.getPortraitRatioForModel(selectedModel),
        shots: storyboard.shots.map((shot: any, index: number) => ({
          promptText: shot.promptText,
          duration: shot.duration || 5,
          ...(shot.camera ? { camera: shot.camera } : {}),
          ...(shot.seed ? { seed: shot.seed } : {})
        })),
        fps: storyboard.fps || 24,
        outputFormat: 'mp4'
      }

      console.log('🚀 Creating storyboard video with individual clips using existing images...')
      console.log('📋 Storyboard config:', {
        model: storyboardRequest.model,
        ratio: storyboardRequest.ratio,
        totalDuration: storyboardRequest.shots.reduce((sum: number, shot: any) => sum + shot.duration, 0),
        existingImagesCount: existingImages.length,
        shotCount: storyboardRequest.shots.length
      })

      // Generate individual video clips for each shot using existing images
      const task = await this.createStoryboardVideoTaskFromExistingImages(storyboardRequest, storyId, existingImages, takeNumber)
      
      if (!task.output || task.output.length === 0) {
        throw new VideoGenerationServiceError('No video clips generated from storyboard', 'NO_VIDEO_OUTPUT')
      }

      // Download all video clips 
      const videoFilepaths: string[] = []
      for (let i = 0; i < task.output.length; i++) {
        const videoUrl = task.output[i]
        const clipPrefix = `storyboard-shot${i + 1}`
        const filepath = await this.downloadVideo(storyId, videoUrl, takeNumber, clipPrefix)
        videoFilepaths.push(filepath)
        console.log(`📥 Downloaded clip ${i + 1}: ${path.basename(filepath)}`)
      }

      // If we have multiple clips, we could concatenate them here using FFmpeg
      // For now, return the first clip as the main result
      const mainVideoPath = videoFilepaths[0]
      
      console.log('🎉 Storyboard video generation completed successfully!')
      console.log(`📁 Generated ${videoFilepaths.length} video clips`)
      console.log(`📄 Main video: ${path.basename(mainVideoPath)}`)

      return {
        videoPath: mainVideoPath,
        allClips: videoFilepaths, // Return all clips for potential concatenation
        duration: storyboardRequest.shots.reduce((sum: number, shot: any) => sum + shot.duration, 0)
      }

    } catch (error: any) {
      if (error instanceof VideoGenerationServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Storyboard video generation failed:', error)
      }
      
      // Log the full error for debugging
      if (process.env.NODE_ENV !== 'test') {
        console.error('Full storyboard error details:', {
          message: error.message,
          status: error.status,
          error: error.error,
          headers: error.headers
        })
      }
      
      throw new VideoGenerationServiceError(
        `Failed to generate storyboard video: ${error.message || String(error)}`,
        'STORYBOARD_GENERATION_FAILED'
      )
    }
  }

  // Legacy method for backward compatibility
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
        videoPath: filepath,
        allClips: [filepath], // Single clip for legacy method
        duration: 10 // Default duration for single clip
      }
    } catch (error) {
      if (error instanceof VideoGenerationServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error('Video generation failed:', error)
      }
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
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to create video asset:', error)
      }
      throw new VideoGenerationServiceError(
        'Failed to save video asset to database',
        'ASSET_CREATION_FAILED'
      )
    }
  }

  async generateVideoForStory(storyId: string, prompt: string): Promise<Asset> {
    let generatedFilepath: string | null = null

    try {
      const { videoPath, duration } = await this.generateVideo(storyId, prompt)
      generatedFilepath = videoPath

      const asset = await this.createVideoAsset(storyId, videoPath, duration)
      
      return asset
    } catch (error) {
      if (generatedFilepath) {
        try {
          await fs.unlink(generatedFilepath)
        } catch (cleanupError) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to cleanup video file:', cleanupError)
          }
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
      const { videoPath, duration } = await this.generateVideo(storyId, prompt, takeNumber)
      generatedFilepath = videoPath

      const asset = await this.createVideoAsset(storyId, videoPath, duration)
      
      return asset
    } catch (error) {
      if (generatedFilepath) {
        try {
          await fs.unlink(generatedFilepath)
        } catch (cleanupError) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to cleanup video file:', cleanupError)
          }
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
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to fetch existing video assets:', error)
        }
        return // Don't fail regeneration if cleanup fails
      }

      if (existingAssets && existingAssets.length > 0) {
        // Delete files from filesystem
        for (const asset of existingAssets) {
          try {
            const fullPath = path.resolve(process.cwd(), asset.filepath)
            await fs.unlink(fullPath)
          } catch (fileError) {
            if (process.env.NODE_ENV !== 'test') {
              console.error(`Failed to delete video file ${asset.filepath}:`, fileError)
            }
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
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to delete existing video asset records:', deleteError)
          }
          // Don't fail regeneration if cleanup fails
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to cleanup existing video assets:', error)
      }
      // Don't fail regeneration if cleanup fails
    }
  }

  private async createImageGenerationTask(prompt: string): Promise<RunwayTask> {
    try {
      console.log(`📸 Creating image generation task with prompt: ${prompt.substring(0, 50)}...`)
      
      const task = await this.runway.textToImage
        .create({
          model: 'gen4_image',
          promptText: prompt,
          ratio: '720:1280' // Portrait format - using valid Gen-4 ratio
        })
        .waitForTaskOutput({
          timeout: this.POLLING_TIMEOUT_MS
        })

      console.log(`✅ Image generation task completed: ${task.id}`)
      return {
        id: task.id,
        status: 'completed' as 'pending' | 'processing' | 'completed' | 'failed',
        output: task.output
      }
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Image generation task failed:`, error)
      }
      
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
      
      // Log the full error for debugging
      if (process.env.NODE_ENV !== 'test') {
        console.error('Full error details:', {
          message: error.message,
          status: error.status,
          error: error.error,
          headers: error.headers
        })
      }
      
      throw new VideoGenerationServiceError(
        `Failed to create image generation task: ${error.message}`,
        'API_ERROR'
      )
    }
  }

  private async createVideoFromImageTask(imagePathOrUrl: string, prompt: string, model: 'gen3a_turbo' | 'gen4_turbo' = 'gen3a_turbo', retryCount: number = 0): Promise<RunwayTask> {
    const maxRetries = 3
    
    try {
      console.log(`🎬 Creating video from image task with prompt: ${prompt.substring(0, 50)}...`)
      
      // Convert local file path to data URI if it's a local path
      let promptImage: string
      if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        // Already a URL, use as-is
        promptImage = imagePathOrUrl
      } else if (imagePathOrUrl.startsWith('data:')) {
        // Already a data URI, use as-is
        promptImage = imagePathOrUrl
      } else {
        // Local file path, convert to data URI
        promptImage = await this.imageToDataUri(imagePathOrUrl)
      }

      const task = await this.runway.imageToVideo
        .create({
          model: model,
          promptText: prompt,
          promptImage: promptImage,
          duration: 10,
          ratio: this.getPortraitRatioForModel(model)
        })
        .waitForTaskOutput({
          timeout: this.POLLING_TIMEOUT_MS
        })

      console.log(`✅ Video generation task completed: ${task.id}`)
      return {
        id: task.id,
        status: 'completed' as 'pending' | 'processing' | 'completed' | 'failed',
        output: task.output // Use the output array directly
      }
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Video generation task failed (attempt ${retryCount + 1}/${maxRetries + 1}):`, error)
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
          statusText: error.statusText,
          stack: error.stack
        })
      }
      
      if (error instanceof TaskFailedError) {
        // Handle Runway ML API errors with retry
        if (error.message.includes('An unexpected error occurred') && retryCount < maxRetries) {
          console.log(`🔄 Retrying video generation in 5 seconds... (attempt ${retryCount + 2}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
          return this.createVideoFromImageTask(imagePathOrUrl, prompt, model, retryCount + 1)
        }
        
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
      
      // Log the full error for debugging
      if (process.env.NODE_ENV !== 'test') {
        console.error('Full error details:', {
          message: error.message,
          status: error.status,
          error: error.error,
          headers: error.headers
        })
      }
      
      throw new VideoGenerationServiceError(
        `Failed to create video generation task: ${error.message}`,
        'API_ERROR'
      )
    }
  }

  private async createStoryboardVideoTaskFromExistingImages(storyboardRequest: any, storyId: string, existingImages: Asset[], takeNumber?: number): Promise<RunwayTask> {
    try {
      console.log(`🎬 Generating ${storyboardRequest.shots.length} individual video clips from existing images...`)
      
      const videoClips: string[] = []
      let totalDuration = 0
      
      // Generate each shot as a separate video clip using existing images
      for (let i = 0; i < storyboardRequest.shots.length; i++) {
        const shot = storyboardRequest.shots[i]
        const shotIndex = i + 1
        console.log(`📹 Creating clip ${shotIndex}/${storyboardRequest.shots.length}: ${shot.promptText.substring(0, 50)}...`)
        
        try {
          // Find existing image for this shot
          const existingImage = existingImages.find(img => 
            img.metadata?.shotIndex === shotIndex
          )
          
          if (!existingImage) {
            throw new VideoGenerationServiceError(
              `No existing image found for shot ${shotIndex}`,
              'NO_EXISTING_IMAGE'
            )
          }
          
          // Get the full path to the existing image
          const localImagePath = path.resolve(process.cwd(), existingImage.filepath)
          
          console.log(`📸 Using existing image for shot ${shotIndex}: ${path.basename(localImagePath)}`)
          
          // Generate video from the existing local image
          console.log(`🎬 Generating video from existing image for shot ${shotIndex}...`)
          const videoTask = await this.createVideoFromImageTask(localImagePath, shot.promptText, storyboardRequest.model)
          
          if (!videoTask.output || videoTask.output.length === 0) {
            throw new VideoGenerationServiceError(`No video generated for shot ${shotIndex}`, 'NO_VIDEO_OUTPUT')
          }
          
          videoClips.push(videoTask.output[0])
          totalDuration += shot.duration
          
          console.log(`✅ Clip ${shotIndex} completed (${shot.duration}s)`)
          
        } catch (error: any) {
          if (process.env.NODE_ENV !== 'test') {
            console.error(`❌ Failed to generate clip ${shotIndex}:`, error)
          }
          
          // Log the full error for debugging
          if (process.env.NODE_ENV !== 'test') {
            console.error(`Full shot ${shotIndex} error details:`, {
              message: error.message,
              status: error.status,
              error: error.error,
              headers: error.headers,
              shot: shot
            })
          }
          
          throw new VideoGenerationServiceError(
            `Failed to generate clip ${shotIndex}: ${error.message || String(error)}`,
            'SHOT_GENERATION_FAILED'
          )
        }
      }
      
      console.log(`🎉 All ${videoClips.length} clips generated successfully from existing images`)
      console.log(`📊 Total duration: ${totalDuration}s`)
      
      // For now, return the first clip URL - we'll handle concatenation in FFmpeg service
      // In a full implementation, we'd concatenate the clips here or return all URLs
      return {
        id: 'storyboard-' + Date.now(),
        status: 'completed' as 'pending' | 'processing' | 'completed' | 'failed',
        output: videoClips // Return all clip URLs for potential concatenation
      }
    } catch (error: any) {
      if (error instanceof VideoGenerationServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Storyboard video generation failed:', error)
      }
      
      // Log the full error for debugging
      if (process.env.NODE_ENV !== 'test') {
        console.error('Full storyboard task error details:', {
          message: error.message,
          status: error.status,
          error: error.error,
          headers: error.headers,
          storyboardRequest: {
            model: storyboardRequest.model,
            ratio: storyboardRequest.ratio,
            shotCount: storyboardRequest.shots.length
          }
        })
      }
      
      throw new VideoGenerationServiceError(
        `Failed to create storyboard video clips: ${error.message || String(error)}`,
        'STORYBOARD_CLIPS_FAILED'
      )
    }
  }

  private async downloadVideo(storyId: string, videoUrl: string, takeNumber?: number, prefix?: string): Promise<string> {
    const response = await fetch(videoUrl)

    if (!response.ok) {
      throw new VideoGenerationServiceError(
        `Failed to download video: ${response.status} ${response.statusText}`,
        'DOWNLOAD_FAILED'
      )
    }

    const videoBuffer = Buffer.from(await response.arrayBuffer())
    
    const videoDir = path.join(process.cwd(), 'assets', 'video')
    
    // Generate filename with optional prefix and take number
    let filename: string
    if (prefix) {
      filename = takeNumber ? `${storyId}-${prefix}-take${takeNumber}.mp4` : `${storyId}-${prefix}.mp4`
    } else {
      filename = takeNumber ? `${storyId}-runway-take${takeNumber}.mp4` : `${storyId}-runway.mp4`
    }
    
    const filepath = path.join(videoDir, filename)
    
    // Ensure directory exists
    await fs.mkdir(videoDir, { recursive: true })
    
    // Write video file
    await fs.writeFile(filepath, videoBuffer)
    
    return filepath
  }

  private async getExistingImageAssets(storyId: string): Promise<Asset[]> {
    try {
      const { data, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('story_id', storyId)
        .eq('kind', 'image')
        .eq('provider', 'runway')
        .order('created_at', { ascending: true })

      if (error) {
        throw new VideoGenerationServiceError(
          `Failed to retrieve existing images: ${error.message}`,
          'DATABASE_ERROR'
        )
      }

      return data || []
    } catch (error: any) {
      if (error instanceof VideoGenerationServiceError) {
        throw error
      }
      
      throw new VideoGenerationServiceError(
        `Failed to get existing image assets: ${error.message || String(error)}`,
        'GET_IMAGES_FAILED'
      )
    }
  }

  private async downloadImage(storyId: string, imageUrl: string, prefix: string = 'image', takeNumber?: number): Promise<string> {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw new VideoGenerationServiceError(
        `Failed to download image: ${response.status} ${response.statusText}`,
        'DOWNLOAD_FAILED'
      )
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer())
    
    const imageDir = path.join(process.cwd(), 'assets', 'images')
    
    // Generate filename with prefix and optional take number
    const filename = takeNumber 
      ? `${storyId}-${prefix}-take${takeNumber}.jpg` 
      : `${storyId}-${prefix}.jpg`
    
    const filepath = path.join(imageDir, filename)
    
    // Ensure directory exists
    await fs.mkdir(imageDir, { recursive: true })
    
    // Write image file
    await fs.writeFile(filepath, imageBuffer)
    
    console.log(`📷 Downloaded image: ${path.basename(filepath)}`)
    
    return filepath
  }

  private async imageToDataUri(imagePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')
      // Assume JPEG format for now - could be enhanced to detect format
      return `data:image/jpeg;base64,${base64Image}`
    } catch (error) {
      throw new VideoGenerationServiceError(
        `Failed to convert image to data URI: ${error instanceof Error ? error.message : String(error)}`,
        'IMAGE_CONVERSION_FAILED'
      )
    }
  }

  private getPortraitRatioForModel(model: 'gen3a_turbo' | 'gen4_turbo'): string {
    // Gen-3 Alpha Turbo: 768:1280 (portrait) or 1280:768 (landscape)
    // Gen-4 Turbo: 720:1280, 832:1104 (portrait) or 1280:720, 1584:672, 1104:832 (landscape) or 960:960 (square)
    switch (model) {
      case 'gen3a_turbo':
        return '768:1280' // Portrait format for Gen-3
      case 'gen4_turbo':
        return '720:1280' // Portrait format for Gen-4
      default:
        return '768:1280' // Default to Gen-3 format
    }
  }
}

export const videoGenerationService = new VideoGenerationService()