'use server'

import { storyService } from '@/services/story-service'
import { StoryInput } from '@/types'
import { redirect } from 'next/navigation'

export async function createStoryAction(formData: FormData) {
  const storyInput: StoryInput = {
    headline: formData.get('headline') as string,
    hot_take: (formData.get('hot_take') as string) || '',
    sources: (formData.get('sources') as string)
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0),
  }

  try {
    const story = await storyService.createStory(storyInput)
    redirect(`/stories/${story.id}/script`)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to create story')
  }
}

export async function createStoryRaw(storyInput: StoryInput): Promise<
  | { success: true; story: Awaited<ReturnType<typeof storyService.createStory>> }
  | { success: false; error: string }
> {
  try {
    const story = await storyService.createStory(storyInput)
    return { success: true, story }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create story' 
    }
  }
}