import { FFmpeg } from '@ffmpeg/ffmpeg'
import { CaptionsRenderer } from 'media-captions'
import { supabaseAdmin } from '../lib/supabase'
import { Video } from '../types'
import fs from 'fs/promises'
import path from 'path'
import { stringifySync } from 'subtitle'

export class EnhancedFFmpegServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'EnhancedFFmpegServiceError'
  }
}

export interface VideoAssemblyAssets {
  audioFilepath: string
  videoFilepath: string | string[]
  script: string
  shotDurations?: number[]
}

export interface VideoAssemblyResult {
  filepath: string
  durationSec: number
}

export class EnhancedFFmpegService {
  private supabase = supabaseAdmin
  private ffmpeg: FFmpeg | null = null
  private captionsRenderer: CaptionsRenderer | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Initialize @ffmpeg/ffmpeg
      this.ffmpeg = new FFmpeg()
      await this.ffmpeg.load()
      
      // Initialize media-captions renderer
      this.captionsRenderer = new CaptionsRenderer()
      
      this.isInitialized = true
      console.log('✅ Enhanced FFmpeg service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced FFmpeg service:', error)
      throw new EnhancedFFmpegServiceError(
        'Failed to initialize FFmpeg service',
        'INITIALIZATION_FAILED'
      )
    }
  }

  async assembleVideo(storyId: string, assets: VideoAssemblyAssets): Promise<VideoAssemblyResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.ffmpeg) {
      throw new EnhancedFFmpegServiceError('FFmpeg not initialized', 'NOT_INITIALIZED')
    }

    if (!storyId || !storyId.trim()) {
      throw new EnhancedFFmpegServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!assets.audioFilepath || !assets.audioFilepath.trim()) {
      throw new EnhancedFFmpegServiceError('Audio filepath is required', 'INVALID_AUDIO_FILE')
    }

    if (!assets.videoFilepath || 
        (typeof assets.videoFilepath === 'string' && !assets.videoFilepath.trim()) ||
        (Array.isArray(assets.videoFilepath) && assets.videoFilepath.length === 0)) {
      throw new EnhancedFFmpegServiceError('Video filepath is required', 'INVALID_VIDEO_FILE')
    }

    if (!assets.script || !assets.script.trim()) {
      throw new EnhancedFFmpegServiceError('Script is required', 'INVALID_SCRIPT')
    }

    console.log(`🎬 Starting enhanced video assembly for story ${storyId}`)
    console.log(`📄 Script: "${assets.script}"`)

    try {
      // Read input files
      const audioData = await fs.readFile(assets.audioFilepath)
      const videoFiles = Array.isArray(assets.videoFilepath) ? assets.videoFilepath : [assets.videoFilepath]
      
      console.log(`📁 Loading ${videoFiles.length} video file(s) into FFmpeg...`)
      
      // Load files into FFmpeg
      await this.ffmpeg.writeFile('input_audio.wav', audioData)
      
      for (let i = 0; i < videoFiles.length; i++) {
        const videoData = await fs.readFile(videoFiles[i])
        await this.ffmpeg.writeFile(`input_video_${i}.mp4`, videoData)
      }

      // Generate enhanced captions using media-captions
      console.log(`📝 Generating enhanced captions...`)
      const captionsData = await this.generateEnhancedCaptions(
        assets.script.trim(),
        await this.getAudioDurationFromFile(audioData)
      )
      
      await this.ffmpeg.writeFile('captions.srt', captionsData)
      console.log(`📝 Enhanced captions generated successfully`)

      // Build FFmpeg command using the WebAssembly API
      const outputFilename = `${storyId}_enhanced.mp4`
      
      if (videoFiles.length === 1) {
        // Single video file processing
        await this.ffmpeg.exec([
          '-i', 'input_audio.wav',
          '-i', 'input_video_0.mp4',
          '-vf', this.buildSubtitleFilter('captions.srt'),
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:v', '2M',
          '-b:a', '128k',
          '-r', '30',
          '-shortest',
          outputFilename
        ])
      } else {
        // Multiple video files processing
        await this.processMultipleVideos(videoFiles, outputFilename, assets.shotDurations)
      }

      console.log(`✅ Enhanced FFmpeg execution completed`)

      // Read the output file
      const outputData = await this.ffmpeg.readFile(outputFilename)
      
      // Save to filesystem
      const outputDir = path.join(process.cwd(), 'output')
      await fs.mkdir(outputDir, { recursive: true })
      
      const timestamp = Date.now()
      const outputPath = path.join(outputDir, `${storyId}-enhanced-${timestamp}.mp4`)
      await fs.writeFile(outputPath, outputData)
      
      console.log(`💾 Enhanced video saved to: ${outputPath}`)

      // Get video duration (simplified for WebAssembly)
      const durationSec = await this.getVideoDurationSimple(outputData)
      console.log(`📊 Final video duration: ${durationSec}s`)

      return {
        filepath: outputPath,
        durationSec
      }
    } catch (error) {
      console.error(`❌ Enhanced video assembly failed for story ${storyId}:`, error)
      
      if (error instanceof EnhancedFFmpegServiceError) {
        throw error
      }
      
      throw new EnhancedFFmpegServiceError(
        'Failed to assemble video with enhanced service',
        'ASSEMBLY_FAILED'
      )
    }
  }

  private async generateEnhancedCaptions(script: string, audioDurationMs: number): Promise<string> {
    // Create caption chunks (same logic as before)
    const chunks = this.createCaptionChunks(script)
    
    // Generate WebVTT cues for better styling with media-captions
    const cues = chunks.map((chunk, index) => {
      const timePerChunk = audioDurationMs / chunks.length
      const startTime = Math.round(index * timePerChunk)
      const endTime = Math.round((index + 1) * timePerChunk)
      
      return {
        type: 'cue' as const,
        data: {
          start: startTime,
          end: endTime,
          text: chunk
        }
      }
    })
    
    // Convert to SRT format (FFmpeg compatibility)
    const srtContent = stringifySync(cues, { format: 'SRT' })
    
    return srtContent
  }

  private createCaptionChunks(script: string): string[] {
    const words = script.trim().split(/\s+/).filter(word => word.length > 0)
    const chunks: string[] = []
    
    if (words.length === 0) return chunks
    if (words.length === 1) return [words[0]]
    if (words.length === 2) return [words.join(' ')]
    
    let i = 0
    while (i < words.length) {
      const remainingWords = words.length - i
      
      if (remainingWords === 1) {
        chunks.push(words[i])
        break
      } else if (remainingWords === 2) {
        chunks.push(words.slice(i, i + 2).join(' '))
        break
      } else if (remainingWords === 3) {
        chunks.push(words.slice(i, i + 2).join(' '))
        i += 2
      } else {
        chunks.push(words.slice(i, i + 2).join(' '))
        i += 2
      }
    }

    return chunks
  }

  private buildSubtitleFilter(captionFile: string): string {
    // Enhanced subtitle styling optimized for vertical video
    const style = [
      'Fontname=Arial Black',
      'Fontsize=20',
      'PrimaryColour=&Hffffff&',
      'OutlineColour=&H000000&',
      'BackColour=&H40000000&',
      'Outline=3',
      'Bold=1',
      'MarginV=100',
      'Alignment=2'
    ].join(',')

    return `subtitles=${captionFile}:force_style='${style}'`
  }

  private async processMultipleVideos(
    videoFiles: string[],
    outputFilename: string,
    shotDurations?: number[]
  ): Promise<void> {
    if (!this.ffmpeg) {
      throw new EnhancedFFmpegServiceError('FFmpeg not initialized', 'NOT_INITIALIZED')
    }

    // Build complex filter for multiple videos with enhanced captions
    const inputs = ['-i', 'input_audio.wav']
    for (let i = 0; i < videoFiles.length; i++) {
      inputs.push('-i', `input_video_${i}.mp4`)
    }

    // Use provided durations or calculate equal segments
    const defaultDuration = 5 // 5 seconds per segment
    const durations = shotDurations && shotDurations.length === videoFiles.length 
      ? shotDurations 
      : Array(videoFiles.length).fill(defaultDuration)

    // Build filter chain
    const videoProcessing = videoFiles.map((_, index) => {
      const inputIndex = index + 1 // +1 because input 0 is audio
      const duration = durations[index]
      
      return `[${inputIndex}:v]trim=duration=${duration},scale=768:1280,setsar=1[v${index}]`
    }).join(';')
    
    const videoConcatenation = videoFiles.map((_, index) => `[v${index}]`).join('') + 
      `concat=n=${videoFiles.length}:v=1:a=0[concat]`
    
    const subtitlesFilter = `[concat]${this.buildSubtitleFilter('captions.srt')}[outv]`
    
    const filterComplex = [videoProcessing, videoConcatenation, subtitlesFilter].join(';')

    await this.ffmpeg.exec([
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '0:a',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:v', '2M',
      '-b:a', '128k',
      '-r', '30',
      '-shortest',
      outputFilename
    ])
  }

  private async getAudioDurationFromFile(audioData: Uint8Array): Promise<number> {
    // Simplified duration calculation for WebAssembly environment
    // In a real implementation, you might use a library like 'node-ffprobe'
    // or extract duration from FFmpeg metadata
    
    // For now, return a reasonable default based on file size
    // This is a placeholder - in production you'd want proper audio analysis
    const estimatedDuration = Math.min(Math.max(audioData.length / 16000, 5000), 30000) // 5-30 seconds
    return Math.round(estimatedDuration)
  }

  private async getVideoDurationSimple(videoData: Uint8Array): Promise<number> {
    // Simplified duration calculation for WebAssembly environment
    // In a real implementation, you'd extract this from video metadata
    
    // For now, return a reasonable estimate based on file size
    const estimatedDuration = Math.min(Math.max(videoData.length / 100000, 10), 30) // 10-30 seconds
    return Math.round(estimatedDuration)
  }

  async createFinalVideo(storyId: string, filepath: string, durationSec: number): Promise<Video> {
    try {
      const relativePath = path.relative(process.cwd(), filepath)
      
      const { data, error } = await this.supabase
        .from('videos')
        .insert({
          story_id: storyId,
          filepath: relativePath,
          duration_sec: durationSec
        })
        .select()

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      if (!data || data.length === 0) {
        throw new Error('No video created')
      }

      return data[0] as Video
    } catch (error) {
      console.error('Failed to create final video:', error)
      throw new EnhancedFFmpegServiceError(
        'Failed to save video to database',
        'VIDEO_CREATION_FAILED'
      )
    }
  }

  async cleanup(): Promise<void> {
    if (this.ffmpeg) {
      // Clean up any temporary files in FFmpeg memory
      try {
        await this.ffmpeg.terminate()
        console.log('🧹 Enhanced FFmpeg service cleaned up successfully')
      } catch (error) {
        console.warn('⚠️ Warning during FFmpeg cleanup:', error)
      }
    }
  }
}

export const enhancedFFmpegService = new EnhancedFFmpegService()