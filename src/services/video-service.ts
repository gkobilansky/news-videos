import { Video } from '@/types'
import { supabaseAdmin } from '@/lib/supabase'

export class VideoServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'VideoServiceError'
  }
}

export interface VideoInput {
  story_id: string
  filepath: string
  duration_sec?: number
}

export class VideoService {
  /**
   * Get all videos for a story
   */
  async getVideosForStory(storyId: string): Promise<Video[]> {
    if (!storyId || !storyId.trim()) {
      throw new VideoServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('videos')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new VideoServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return (data || []) as Video[]
    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error
      }
      throw new VideoServiceError(`Failed to get videos for story: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Get a single video by ID
   */
  async getVideo(videoId: string): Promise<Video | null> {
    if (!videoId || !videoId.trim()) {
      throw new VideoServiceError('Video ID is required', 'INVALID_VIDEO_ID')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single()

      if (error) {
        // Handle not found vs other errors
        if (error.code === 'PGRST116') {
          return null
        }
        throw new VideoServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Video
    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error
      }
      throw new VideoServiceError(`Failed to get video: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Create a new video record
   */
  async createVideo(input: VideoInput): Promise<Video> {
    // Validate input
    if (!input.story_id || !input.story_id.trim()) {
      throw new VideoServiceError('Story ID is required', 'VALIDATION_ERROR')
    }

    if (!input.filepath || !input.filepath.trim()) {
      throw new VideoServiceError('Filepath is required', 'VALIDATION_ERROR')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('videos')
        .insert([{
          story_id: input.story_id,
          filepath: input.filepath,
          duration_sec: input.duration_sec || null,
        }])
        .select()
        .single()

      if (error) {
        throw new VideoServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Video
    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error
      }
      throw new VideoServiceError(`Failed to create video: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Delete a video by ID
   */
  async deleteVideo(videoId: string): Promise<void> {
    if (!videoId || !videoId.trim()) {
      throw new VideoServiceError('Video ID is required', 'INVALID_VIDEO_ID')
    }

    try {
      const { error } = await supabaseAdmin
        .from('videos')
        .delete()
        .eq('id', videoId)

      if (error) {
        throw new VideoServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }
    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error
      }
      throw new VideoServiceError(`Failed to delete video: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Count videos for a story
   */
  async countVideosForStory(storyId: string): Promise<number> {
    if (!storyId || !storyId.trim()) {
      throw new VideoServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('videos')
        .select('id')
        .eq('story_id', storyId)

      if (error) {
        throw new VideoServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data ? data.length : 0
    } catch (error) {
      if (error instanceof VideoServiceError) {
        throw error
      }
      throw new VideoServiceError(`Failed to count videos for story: ${error}`, 'UNKNOWN_ERROR')
    }
  }
}

// Export a singleton instance
export const videoService = new VideoService() 