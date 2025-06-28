import { supabaseAdmin } from '../lib/supabase'
import { Asset } from '../types'
import fs from 'fs/promises'
import path from 'path'

export class PexelsServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'PexelsServiceError'
  }
}

export interface PexelsVideo {
  id: number
  width: number
  height: number
  duration: number
  video_files: PexelsVideoFile[]
}

export interface PexelsVideoFile {
  id: number
  quality: string
  file_type: string
  link: string
  width: number
  height: number
}

export interface PexelsSearchResponse {
  videos: PexelsVideo[]
  page: number
  per_page: number
  total_results: number
}

export class PexelsService {
  private apiKey: string
  private supabase = supabaseAdmin
  private readonly BASE_URL = 'https://api.pexels.com/videos'

  constructor() {
    if (!process.env.PEXELS_API_KEY) {
      throw new PexelsServiceError('Pexels API key is required', 'MISSING_API_KEY')
    }
    this.apiKey = process.env.PEXELS_API_KEY
  }

  async searchVideos(query: string, perPage: number = 15, page: number = 1): Promise<PexelsSearchResponse> {
    if (!query || !query.trim()) {
      throw new PexelsServiceError('Search query is required', 'INVALID_QUERY')
    }

    try {
      const searchUrl = new URL(`${this.BASE_URL}/search`)
      searchUrl.searchParams.set('query', query.trim())
      searchUrl.searchParams.set('per_page', perPage.toString())
      searchUrl.searchParams.set('page', page.toString())
      searchUrl.searchParams.set('orientation', 'portrait')

      const response = await fetch(searchUrl.toString(), {
        headers: {
          'Authorization': this.apiKey
        }
      })

      if (!response.ok) {
        throw new PexelsServiceError(
          `Failed to search videos: ${response.status} ${response.statusText}`,
          'API_ERROR'
        )
      }

      return await response.json() as PexelsSearchResponse
    } catch (error) {
      if (error instanceof PexelsServiceError) {
        throw error
      }

      throw new PexelsServiceError(
        `Failed to search videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_FAILED'
      )
    }
  }

  getBestVideoUrl(video: PexelsVideo): string {
    const { video_files } = video

    // Prefer portrait format videos (height > width)
    const portraitVideos = video_files.filter(file => file.height > file.width)
    
    if (portraitVideos.length > 0) {
      // Sort by quality (hd > sd) and resolution
      const sorted = portraitVideos.sort((a, b) => {
        if (a.quality === 'hd' && b.quality !== 'hd') return -1
        if (b.quality === 'hd' && a.quality !== 'hd') return 1
        return (b.width * b.height) - (a.width * a.height)
      })
      return sorted[0].link
    }

    // Fallback to highest quality available
    const sorted = video_files.sort((a, b) => {
      if (a.quality === 'hd' && b.quality !== 'hd') return -1
      if (b.quality === 'hd' && a.quality !== 'hd') return 1
      return (b.width * b.height) - (a.width * a.height)
    })

    return sorted[0].link
  }

  async downloadAndCreateAsset(storyId: string, videoUrl: string, durationSec: number): Promise<Asset> {
    if (!storyId || !storyId.trim()) {
      throw new PexelsServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!videoUrl || !videoUrl.trim()) {
      throw new PexelsServiceError('Video URL is required', 'INVALID_VIDEO_URL')
    }

    if (!durationSec || durationSec <= 0) {
      throw new PexelsServiceError('Duration must be greater than 0', 'INVALID_DURATION')
    }

    let filepath: string | null = null

    try {
      // Download video
      const response = await fetch(videoUrl)
      
      if (!response.ok) {
        throw new PexelsServiceError(
          `Failed to download video: ${response.status} ${response.statusText}`,
          'DOWNLOAD_FAILED'
        )
      }

      const videoBuffer = Buffer.from(await response.arrayBuffer())
      
      // Save to filesystem
      const videoDir = path.join(process.cwd(), 'assets', 'video')
      const filename = `${storyId}-pexels.mp4`
      filepath = path.join(videoDir, filename)

      await fs.mkdir(videoDir, { recursive: true })
      await fs.writeFile(filepath, videoBuffer)

      // Create asset record
      const relativePath = path.relative(process.cwd(), filepath)
      
      const { data, error } = await this.supabase
        .from('assets')
        .insert({
          story_id: storyId,
          kind: 'video',
          provider: 'pexels',
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
      // Cleanup file if database save failed
      if (filepath) {
        try {
          await fs.unlink(filepath)
        } catch (cleanupError) {
          console.error('Failed to cleanup video file:', cleanupError)
        }
      }

      if (error instanceof PexelsServiceError) {
        throw error
      }

      throw new PexelsServiceError(
        `Failed to download and save video asset: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ASSET_CREATION_FAILED'
      )
    }
  }

  async generateVideoForStory(storyId: string, searchQuery: string): Promise<Asset> {
    if (!storyId || !storyId.trim()) {
      throw new PexelsServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!searchQuery || !searchQuery.trim()) {
      throw new PexelsServiceError('Search query is required', 'INVALID_QUERY')
    }

    try {
      // Search for videos
      const searchResult = await this.searchVideos(searchQuery)
      
      if (!searchResult.videos || searchResult.videos.length === 0) {
        throw new PexelsServiceError(
          'No videos found for query',
          'NO_VIDEOS_FOUND'
        )
      }

      // Select the best video
      const selectedVideo = searchResult.videos[0]
      const videoUrl = this.getBestVideoUrl(selectedVideo)

      // Download and create asset
      return await this.downloadAndCreateAsset(storyId, videoUrl, selectedVideo.duration)

    } catch (error) {
      if (error instanceof PexelsServiceError) {
        throw error
      }

      throw new PexelsServiceError(
        'Failed to generate video for story',
        'STORY_VIDEO_FAILED'
      )
    }
  }
}

export const pexelsService = new PexelsService() 