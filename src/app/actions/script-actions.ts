'use server'

import { Script } from '@/types'
import { scriptService } from '@/services/script-service'
import { storyService } from '@/services/story-service'

export async function generateScriptAction(storyId: string): Promise<{ success: true; script: Script } | { success: false; error: string }> {
  try {
    const story = await storyService.getStory(storyId)
    if (!story) {
      return { success: false, error: 'Story not found' }
    }

    const script = await scriptService.generateScript(story)
    
    // Only update status if not already editing
    if (story.status !== 'editing') {
      await storyService.updateStoryStatus(story.id, 'editing')
    }
    
    return { success: true, script }
  } catch (error) {
    console.error('Error generating script:', error)
    return { success: false, error: 'Failed to generate script. Please try again.' }
  }
}

export async function getScriptAction(storyId: string): Promise<{ success: true; script: Script | null } | { success: false; error: string }> {
  try {
    const script = await scriptService.getScript(storyId)
    return { success: true, script }
  } catch (error) {
    console.error('Error getting script:', error)
    return { success: false, error: 'Failed to load script' }
  }
}

export async function updateScriptAction(storyId: string, text: string): Promise<{ success: true; script: Script } | { success: false; error: string }> {
  try {
    const script = await scriptService.updateScript(storyId, text)
    return { success: true, script }
  } catch (error) {
    console.error('Error updating script:', error)
    return { success: false, error: 'Failed to save script. Please try again.' }
  }
}

export async function getStoryWithScriptAction(storyId: string): Promise<{ 
  success: true; 
  story: any; 
  script: Script | null 
} | { 
  success: false; 
  error: string 
}> {
  try {
    const [storyResult, scriptResult] = await Promise.all([
      storyService.getStory(storyId),
      scriptService.getScript(storyId)
    ])

    if (!storyResult) {
      return { success: false, error: 'Story not found' }
    }

    return { 
      success: true, 
      story: storyResult, 
      script: scriptResult 
    }
  } catch (error) {
    console.error('Error loading story and script:', error)
    return { success: false, error: 'Failed to load story data' }
  }
}