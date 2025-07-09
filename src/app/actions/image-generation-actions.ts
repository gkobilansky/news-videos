'use server'

import { imageGenerationService } from '@/services/image-generation-service'
import { scriptService } from '@/services/script-service'
import { storyService } from '@/services/story-service'
import { Asset } from '@/types'

export async function generateStoryboardImagesAction(storyId: string): Promise<
  | { success: true; images: Asset[]; totalGenerated: number }
  | { success: false; error: string }
> {
  try {
    // Check if script exists first
    const script = await scriptService.getScript(storyId)
    if (!script) {
      return { success: false, error: 'Script must be generated before creating storyboard images. Please generate a script first.' }
    }

    // Get the storyboard for this story
    const storyboard = await scriptService.getStoryboard(storyId)
    if (!storyboard) {
      return { success: false, error: 'Storyboard not found. Please generate a storyboard first.' }
    }

    // Get story details for character consistency
    const story = await storyService.getStory(storyId)
    const headline = story?.headline

    // Generate images for all shots in the storyboard with character consistency
    const result = await imageGenerationService.generateStoryboardImages(storyId, storyboard, headline)
    
    // Extract asset objects from the result
    const images = result.images.map(img => img.asset)
    
    return { 
      success: true, 
      images, 
      totalGenerated: result.totalGenerated 
    }
  } catch (error) {
    console.error('Generate storyboard images action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate storyboard images'
    }
  }
}

export async function regenerateStoryboardImagesAction(storyId: string): Promise<
  | { success: true; images: Asset[]; totalGenerated: number }
  | { success: false; error: string }
> {
  try {
    // Check if script exists first
    const script = await scriptService.getScript(storyId)
    if (!script) {
      return { success: false, error: 'Script must be generated before creating storyboard images. Please generate a script first.' }
    }

    // Get the storyboard for this story
    const storyboard = await scriptService.getStoryboard(storyId)
    if (!storyboard) {
      return { success: false, error: 'Storyboard not found. Please generate a storyboard first.' }
    }

    // Get story details for character consistency
    const story = await storyService.getStory(storyId)
    const headline = story?.headline

    // Regenerate images for all shots in the storyboard with character consistency
    const result = await imageGenerationService.regenerateStoryboardImages(storyId, storyboard, headline)
    
    // Extract asset objects from the result
    const images = result.images.map(img => img.asset)
    
    return { 
      success: true, 
      images, 
      totalGenerated: result.totalGenerated 
    }
  } catch (error) {
    console.error('Regenerate storyboard images action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate storyboard images'
    }
  }
}

export async function generateImageForShotAction(
  storyId: string, 
  shotIndex: number, 
  promptText: string
): Promise<
  | { success: true; image: Asset }
  | { success: false; error: string }
> {
  try {
    // Create a basic shot object for the image generation
    const shot = {
      promptText,
      duration: 5 as const,
      camera: { movement: 'static' as const, angle: 'eye-level' as const }
    }

    // Generate image for the specific shot
    const result = await imageGenerationService.generateImageForShot(storyId, shot, shotIndex)
    
    return { 
      success: true, 
      image: result.asset
    }
  } catch (error) {
    console.error('Generate image for shot action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image for shot'
    }
  }
}

export async function getStoryImageAssetsAction(storyId: string): Promise<
  | { success: true; images: Asset[] }
  | { success: false; error: string }
> {
  try {
    const images = await imageGenerationService.getStoryImageAssets(storyId)
    
    return { 
      success: true, 
      images 
    }
  } catch (error) {
    console.error('Get story image assets action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get story image assets'
    }
  }
}

export async function generateStandaloneImageAction(
  storyId: string, 
  prompt: string, 
  prefix: string = 'image'
): Promise<
  | { success: true; image: Asset }
  | { success: false; error: string }
> {
  try {
    // Generate standalone image
    const result = await imageGenerationService.generateImage(storyId, prompt, prefix)
    
    return { 
      success: true, 
      image: result.asset
    }
  } catch (error) {
    console.error('Generate standalone image action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate standalone image'
    }
  }
}