'use server'

import { videoOrchestrationService } from '@/services/video-orchestration-service'
import { videoService } from '@/services/video-service'
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

export async function generateAdditionalVideoAction(storyId: string): Promise<
  | { success: true; video: Video }
  | { success: false; error: string }
> {
  try {
    const video = await videoOrchestrationService.generateAdditionalVideoForStory(storyId)
    return { success: true, video }
  } catch (error) {
    console.error('Additional video generation action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate additional video'
    }
  }
}

export async function getVideosForStoryAction(storyId: string): Promise<
  | { success: true; videos: Video[] }
  | { success: false; error: string }
> {
  try {
    const videos = await videoService.getVideosForStory(storyId)
    return { success: true, videos }
  } catch (error) {
    console.error('Get videos for story action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get videos for story'
    }
  }
}