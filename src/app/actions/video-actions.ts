'use server'

import { videoOrchestrationService } from '@/services/video-orchestration-service'
import { Video } from '@/types'

export async function generateVideoAction(storyId: string): Promise<
  | { success: true; video: Video }
  | { success: false; error: string }
> {
  try {
    const video = await videoOrchestrationService.generateVideoForStory(storyId)
    return { success: true, video }
  } catch (error) {
    console.error('Video generation action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate video'
    }
  }
}