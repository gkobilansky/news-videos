'use server'

import { videoOrchestrationService } from '@/services/video-orchestration-service'
import { videoService } from '@/services/video-service'
import { ffmpegService } from '@/services/ffmpeg-service'
import { storyService } from '@/services/story-service'
import { scriptService } from '@/services/script-service'
import { Video } from '@/types'
import fs from 'fs/promises'
import path from 'path'

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

export async function generateVideoFromStoryboardAction(storyId: string): Promise<
  | { success: true; video: Video }
  | { success: false; error: string }
> {
  try {
    const video = await videoOrchestrationService.generateVideoForStory(storyId)
    return { success: true, video }
  } catch (error) {
    console.error('Storyboard video generation action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate video from storyboard'
    }
  }
}

export async function generateAdditionalVideoAction(storyId: string, model: string = 'gen3a_turbo'): Promise<
  | { success: true; video: Video }
  | { success: false; error: string }
> {
  try {
    const video = await videoOrchestrationService.generateAdditionalVideoForStory(storyId, model as 'gen3a_turbo' | 'gen4_turbo')
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

export async function reassembleVideoAction(storyId: string): Promise<
  | { success: true; video: Video }
  | { success: false; error: string }
> {
  try {
    console.log(`🎬 Starting ENHANCED video reassembly for story: ${storyId}`)
    
    // Get the story and script
    const story = await storyService.getStory(storyId)
    if (!story) {
      return { success: false, error: 'Story not found' }
    }
    
    const script = await scriptService.getScript(storyId)
    if (!script) {
      return { success: false, error: 'Script not found' }
    }
    
    // Find existing assets
    const assetsPath = path.join(process.cwd(), 'assets')
    const audioPath = path.join(assetsPath, 'audio', `${storyId}.wav`)
    const videoPath = path.join(assetsPath, 'video')
    
    // Check if audio exists
    try {
      await fs.access(audioPath)
    } catch {
      return { success: false, error: 'Audio file not found. Please generate video normally first.' }
    }
    
    // Find video files
    let videoFiles: string[] = []
    try {
      const allVideoFiles = await fs.readdir(videoPath)
      
      // Look for storyboard shots first (newer format)
      const storyboardShots = allVideoFiles
        .filter(file => file.startsWith(`${storyId}-storyboard-shot`) && file.endsWith('.mp4'))
        .sort()
        .map(file => path.join(videoPath, file))
      
      if (storyboardShots.length > 0) {
        videoFiles = storyboardShots
      } else {
        // Look for legacy single video files
        const singleVideoFiles = allVideoFiles
          .filter(file => file.startsWith(storyId) && file.endsWith('.mp4') && !file.includes('-storyboard-'))
          .map(file => path.join(videoPath, file))
        
        if (singleVideoFiles.length > 0) {
          videoFiles = [singleVideoFiles[0]] // Use first one
        }
      }
    } catch (error) {
      return { success: false, error: 'Error reading video directory' }
    }
    
    if (videoFiles.length === 0) {
      return { success: false, error: 'No video files found. Please generate video normally first.' }
    }
    
    console.log(`📦 Found ${videoFiles.length} video files and audio file`)
    
    // Prepare assets for FFmpeg service
    const videoAssemblyAssets = {
      audioFilepath: audioPath,
      videoFilepath: videoFiles.length === 1 ? videoFiles[0] : videoFiles,
      script: script.text
    }
    
    // Reassemble video using FFmpeg service with OpenAI Whisper integration
    const result = await ffmpegService.assembleVideo(storyId, videoAssemblyAssets)
    
    // Create video record in database
    const video = await ffmpegService.createFinalVideo(storyId, result.filepath, result.durationSec)
    
    console.log(`✅ ENHANCED video reassembly completed: ${result.filepath}`)
    console.log(`💡 Enhanced features used:`)
    console.log(`   - Smart timing based on word density`)
    console.log(`   - Enhanced styling for vertical videos`)
    console.log(`   - Better text formatting and readability`)
    
    return { success: true, video }
  } catch (error) {
    console.error('Video reassembly action failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reassemble video with enhanced service'
    }
  }
}