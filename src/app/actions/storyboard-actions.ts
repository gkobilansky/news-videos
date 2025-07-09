'use server'

import { scriptService } from '@/services/script-service'
import { Storyboard, StoryboardShot } from '@/types'
import { storyService } from '@/services/story-service'

export async function generateStoryboardAction(storyId: string): Promise<
  | { success: true; storyboard: Storyboard }
  | { success: false; error: string }
> {
  try {
    // Get the story first
    const story = await storyService.getStory(storyId)
    if (!story) {
      return { success: false, error: 'Story not found' }
    }

    // Generate the storyboard
    const storyboard = await scriptService.generateStoryboard(story)
    
    return { success: true, storyboard }
  } catch (error) {
    console.error('Storyboard generation action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate storyboard'
    }
  }
}

export async function updateStoryboardAction(
  storyId: string, 
  shots: StoryboardShot[]
): Promise<
  | { success: true; storyboard: Storyboard }
  | { success: false; error: string }
> {
  try {
    const storyboard = await scriptService.updateStoryboard(storyId, shots)
    return { success: true, storyboard }
  } catch (error) {
    console.error('Storyboard update action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update storyboard'
    }
  }
}

export async function getStoryboardAction(storyId: string): Promise<
  | { success: true; storyboard: Storyboard | null }
  | { success: false; error: string }
> {
  try {
    const storyboard = await scriptService.getStoryboard(storyId)
    return { success: true, storyboard }
  } catch (error) {
    console.error('Get storyboard action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get storyboard'
    }
  }
}

export async function getStoryWithStoryboardAction(storyId: string): Promise<
  | { success: true; story: any; storyboard: Storyboard | null }
  | { success: false; error: string }
> {
  try {
    const story = await storyService.getStory(storyId)
    if (!story) {
      return { success: false, error: 'Story not found' }
    }

    const storyboard = await scriptService.getStoryboard(storyId)
    
    return { success: true, story, storyboard }
  } catch (error) {
    console.error('Get story with storyboard action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get story and storyboard'
    }
  }
}

export async function addShotToStoryboardAction(
  storyId: string,
  newShot: StoryboardShot
): Promise<
  | { success: true; storyboard: Storyboard }
  | { success: false; error: string }
> {
  try {
    const storyboard = await scriptService.addShotToStoryboard(storyId, newShot)
    return { success: true, storyboard }
  } catch (error) {
    console.error('Add shot to storyboard action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add shot to storyboard'
    }
  }
}

export async function insertShotAtPositionAction(
  storyId: string,
  position: number,
  newShot: StoryboardShot
): Promise<
  | { success: true; storyboard: Storyboard }
  | { success: false; error: string }
> {
  try {
    const storyboard = await scriptService.insertShotAtPosition(storyId, position, newShot)
    return { success: true, storyboard }
  } catch (error) {
    console.error('Insert shot at position action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to insert shot at position'
    }
  }
}

export async function removeShotFromStoryboardAction(
  storyId: string,
  position: number
): Promise<
  | { success: true; storyboard: Storyboard }
  | { success: false; error: string }
> {
  try {
    const storyboard = await scriptService.removeShotFromStoryboard(storyId, position)
    return { success: true, storyboard }
  } catch (error) {
    console.error('Remove shot from storyboard action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove shot from storyboard'
    }
  }
} 