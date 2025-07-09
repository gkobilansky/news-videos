import { supabaseAdmin } from '../lib/supabase'
import { Asset, StoryboardShot, Storyboard } from '../types'
import fs from 'fs/promises'
import path from 'path'
import { RunwayML, TaskFailedError } from '@runwayml/sdk'

export class ImageGenerationServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'ImageGenerationServiceError'
  }
}

export interface ImageGenerationResult {
  imagePath: string
  imageUrl?: string
  asset: Asset
}

export interface StoryboardImageResult {
  storyId: string
  images: ImageGenerationResult[]
  totalGenerated: number
}

interface RunwayImageTask {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  output?: string[]
}

export class ImageGenerationService {
  private supabase = supabaseAdmin
  private runway: RunwayML
  private readonly POLLING_TIMEOUT_MS = 300000 // 5 minutes

  constructor() {
    if (!process.env.RUNWAY_API_KEY) {
      throw new ImageGenerationServiceError('Runway API key is required', 'MISSING_API_KEY')
    }
    this.runway = new RunwayML({
      apiKey: process.env.RUNWAY_API_KEY
    })
  }

  /**
   * Generate a base presenter image for character consistency
   */
  async generateBasePresenterImage(storyId: string, headline: string): Promise<ImageGenerationResult> {
    try {
      console.log(`👨‍💼 Generating base presenter image for story ${storyId}...`)
      
      const presenterPrompt = `Professional news presenter in business attire at modern news desk, clean background, studio lighting, portrait format, news anchor appearance, confident expression, looking at camera. Context: ${headline.substring(0, 100)}`
      
      const imageResult = await this.generateImageForShot(storyId, {
        promptText: presenterPrompt,
        duration: 5,
        camera: { movement: 'static', angle: 'eye-level' }
      }, 0, 'base_presenter')
      
      console.log(`✅ Base presenter image generated: ${path.basename(imageResult.imagePath)}`)
      return imageResult
      
    } catch (error) {
      console.error('Failed to generate base presenter image:', error)
      throw new ImageGenerationServiceError(
        'Failed to generate base presenter image for character consistency',
        'BASE_PRESENTER_GENERATION_FAILED'
      )
    }
  }

  /**
   * Get existing base presenter image or generate one if it doesn't exist
   */
  async getOrCreateBasePresenterImage(storyId: string, headline: string): Promise<ImageGenerationResult | null> {
    try {
      // Check if base presenter image already exists
      const { data: existingAssets, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('story_id', storyId)
        .eq('kind', 'image')
        .eq('provider', 'runway')
        .like('filepath', '%base_presenter%')
        .limit(1)

      if (!error && existingAssets && existingAssets.length > 0) {
        const asset = existingAssets[0] as Asset
        console.log(`♻️ Using existing base presenter image: ${path.basename(asset.filepath)}`)
        return {
          imagePath: asset.filepath,
          asset
        }
      }

      // Generate new base presenter image
      return await this.generateBasePresenterImage(storyId, headline)
      
    } catch (error) {
      console.error('Failed to get or create base presenter image:', error)
      return null // Return null to continue without presenter template
    }
  }

  /**
   * Generate reference images for all shots in a storyboard with character consistency
   */
  async generateStoryboardImages(storyId: string, storyboard: Storyboard, headline?: string): Promise<StoryboardImageResult> {
    if (!storyId || !storyId.trim()) {
      throw new ImageGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!storyboard || !storyboard.shots || storyboard.shots.length === 0) {
      throw new ImageGenerationServiceError('Valid storyboard with shots is required', 'INVALID_STORYBOARD')
    }

    try {
      console.log(`🎨 Starting image generation for ${storyboard.shots.length} shots...`)
      
      const imageResults: ImageGenerationResult[] = []
      
      // Get or create base presenter image for character consistency
      let basePresenterImage: ImageGenerationResult | null = null
      if (headline) {
        console.log(`👨‍💼 Setting up character consistency with base presenter image...`)
        basePresenterImage = await this.getOrCreateBasePresenterImage(storyId, headline)
        if (basePresenterImage) {
          imageResults.push(basePresenterImage)
          console.log(`✅ Base presenter image ready for character consistency`)
        }
      }

      // Generate image for each shot
      for (let i = 0; i < storyboard.shots.length; i++) {
        const shot = storyboard.shots[i]
        const shotIndex = i + 1
        
        console.log(`📸 Generating image for shot ${shotIndex}/${storyboard.shots.length}: ${shot.promptText.substring(0, 50)}...`)
        
        try {
          const imageResult = await this.generateImageForShot(storyId, shot, shotIndex)
          imageResults.push(imageResult)
          
          console.log(`✅ Image generated for shot ${shotIndex}: ${path.basename(imageResult.imagePath)}`)
          
        } catch (error: any) {
          if (process.env.NODE_ENV !== 'test') {
            console.error(`❌ Failed to generate image for shot ${shotIndex}:`, error)
          }
          
          // Continue with other shots even if one fails
          console.warn(`⚠️ Skipping shot ${shotIndex} due to error, continuing with remaining shots...`)
        }
      }

      if (imageResults.length === 0) {
        throw new ImageGenerationServiceError('No images were generated successfully', 'NO_IMAGES_GENERATED')
      }

      // Calculate actual shots generated (excluding base presenter image)
      const shotsGenerated = imageResults.length - (basePresenterImage ? 1 : 0)
      console.log(`🎉 Generated ${shotsGenerated}/${storyboard.shots.length} shot images successfully` + 
                  (basePresenterImage ? ' (plus base presenter template)' : ''))

      return {
        storyId,
        images: imageResults,
        totalGenerated: imageResults.length
      }

    } catch (error: any) {
      if (error instanceof ImageGenerationServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error('❌ Storyboard image generation failed:', error)
      }
      throw new ImageGenerationServiceError(
        `Failed to generate storyboard images: ${error.message || String(error)}`,
        'STORYBOARD_IMAGES_FAILED'
      )
    }
  }

  /**
   * Generate a single image for a storyboard shot
   */
  async generateImageForShot(storyId: string, shot: StoryboardShot, shotIndex: number, filenamePrefix?: string): Promise<ImageGenerationResult> {
    if (!storyId || !storyId.trim()) {
      throw new ImageGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!shot || !shot.promptText || !shot.promptText.trim()) {
      throw new ImageGenerationServiceError('Valid shot with promptText is required', 'INVALID_SHOT')
    }

    try {
      // Create image generation task
      const imageTask = await this.createImageGenerationTask(shot.promptText)
      
      if (!imageTask.output || imageTask.output.length === 0) {
        throw new ImageGenerationServiceError(`No image generated for shot ${shotIndex}`, 'NO_IMAGE_OUTPUT')
      }

      // Download and store the image locally
      const filename = filenamePrefix || `shot${shotIndex}`
      const localImagePath = await this.downloadImage(
        storyId, 
        imageTask.output[0], 
        filename,
        1 // Default take number
      )

      // Create asset record in database
      const asset = await this.createImageAsset(storyId, localImagePath, {
        shotIndex,
        promptText: shot.promptText,
        duration: shot.duration,
        camera: shot.camera
      })

      return {
        imagePath: localImagePath,
        imageUrl: imageTask.output[0],
        asset
      }

    } catch (error: any) {
      if (error instanceof ImageGenerationServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Failed to generate image for shot ${shotIndex}:`, error)
      }
      throw new ImageGenerationServiceError(
        `Failed to generate image for shot ${shotIndex}: ${error.message || String(error)}`,
        'SHOT_IMAGE_FAILED'
      )
    }
  }

  /**
   * Generate a single standalone image
   */
  async generateImage(storyId: string, prompt: string, prefix: string = 'image', takeNumber?: number): Promise<ImageGenerationResult> {
    if (!storyId || !storyId.trim()) {
      throw new ImageGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!prompt || !prompt.trim()) {
      throw new ImageGenerationServiceError('Image prompt is required', 'INVALID_PROMPT')
    }

    try {
      // Create image generation task
      const imageTask = await this.createImageGenerationTask(prompt.trim())
      
      if (!imageTask.output || imageTask.output.length === 0) {
        throw new ImageGenerationServiceError('No image generated from prompt', 'NO_IMAGE_OUTPUT')
      }

      // Download and store the image locally
      const localImagePath = await this.downloadImage(
        storyId, 
        imageTask.output[0], 
        prefix,
        takeNumber
      )

      // Create asset record in database
      const asset = await this.createImageAsset(storyId, localImagePath, {
        promptText: prompt,
        prefix,
        takeNumber
      })

      return {
        imagePath: localImagePath,
        imageUrl: imageTask.output[0],
        asset
      }

    } catch (error: any) {
      if (error instanceof ImageGenerationServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error('Image generation failed:', error)
      }
      throw new ImageGenerationServiceError(
        `Failed to generate image: ${error.message || String(error)}`,
        'IMAGE_GENERATION_FAILED'
      )
    }
  }

  /**
   * Regenerate images for a storyboard
   */
  async regenerateStoryboardImages(storyId: string, storyboard: Storyboard, headline?: string): Promise<StoryboardImageResult> {
    try {
      // Clean up existing image assets first
      await this.cleanupExistingImageAssets(storyId)

      // Generate new images with character consistency
      return await this.generateStoryboardImages(storyId, storyboard, headline)

    } catch (error: any) {
      if (error instanceof ImageGenerationServiceError) {
        throw error
      }
      
      throw new ImageGenerationServiceError(
        `Failed to regenerate storyboard images: ${error.message || String(error)}`,
        'STORYBOARD_REGENERATION_FAILED'
      )
    }
  }

  /**
   * Get existing image assets for a story
   */
  async getStoryImageAssets(storyId: string): Promise<Asset[]> {
    if (!storyId || !storyId.trim()) {
      throw new ImageGenerationServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    try {
      const { data, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('story_id', storyId)
        .eq('kind', 'image')
        .eq('provider', 'runway')
        .order('created_at', { ascending: true })

      if (error) {
        throw new ImageGenerationServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data || []

    } catch (error: any) {
      if (error instanceof ImageGenerationServiceError) {
        throw error
      }
      
      throw new ImageGenerationServiceError(
        `Failed to get story image assets: ${error.message || String(error)}`,
        'GET_ASSETS_FAILED'
      )
    }
  }

  /**
   * Create an image asset record in the database
   */
  async createImageAsset(storyId: string, filepath: string, metadata: any = {}): Promise<Asset> {
    try {
      const relativePath = path.relative(process.cwd(), filepath)
      
      const { data, error } = await this.supabase
        .from('assets')
        .insert({
          story_id: storyId,
          kind: 'image',
          provider: 'runway',
          filepath: relativePath,
          metadata
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
        console.error('Failed to create image asset:', error)
      }
      throw new ImageGenerationServiceError(
        'Failed to save image asset to database',
        'ASSET_CREATION_FAILED'
      )
    }
  }

  /**
   * Clean up existing image assets for a story
   */
  private async cleanupExistingImageAssets(storyId: string): Promise<void> {
    try {
      // Get existing image assets for this story
      const { data: existingAssets, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('story_id', storyId)
        .eq('kind', 'image')
        .eq('provider', 'runway')

      if (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to fetch existing image assets:', error)
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
              console.error(`Failed to delete image file ${asset.filepath}:`, fileError)
            }
            // Continue with other files
          }
        }

        // Delete database records
        const { error: deleteError } = await this.supabase
          .from('assets')
          .delete()
          .eq('story_id', storyId)
          .eq('kind', 'image')
          .eq('provider', 'runway')

        if (deleteError) {
          if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to delete existing image asset records:', deleteError)
          }
          // Don't fail regeneration if cleanup fails
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to cleanup existing image assets:', error)
      }
      // Don't fail regeneration if cleanup fails
    }
  }

  /**
   * Create image generation task using Runway ML
   */
  private async createImageGenerationTask(prompt: string): Promise<RunwayImageTask> {
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
        throw new ImageGenerationServiceError(
          `Image generation task failed: ${error.message}`,
          'TASK_FAILED'
        )
      }
      if (error.message && error.message.includes('timeout')) {
        throw new ImageGenerationServiceError(
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
      
      throw new ImageGenerationServiceError(
        `Failed to create image generation task: ${error.message}`,
        'API_ERROR'
      )
    }
  }

  /**
   * Download image from URL and store locally
   */
  private async downloadImage(storyId: string, imageUrl: string, prefix: string = 'image', takeNumber?: number): Promise<string> {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw new ImageGenerationServiceError(
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

  /**
   * Convert local image to data URI
   */
  async imageToDataUri(imagePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')
      // Assume JPEG format for now - could be enhanced to detect format
      return `data:image/jpeg;base64,${base64Image}`
    } catch (error) {
      throw new ImageGenerationServiceError(
        `Failed to convert image to data URI: ${error instanceof Error ? error.message : String(error)}`,
        'IMAGE_CONVERSION_FAILED'
      )
    }
  }
}

// Export a singleton instance
export const imageGenerationService = new ImageGenerationService()