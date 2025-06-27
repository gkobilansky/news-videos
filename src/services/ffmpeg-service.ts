import { supabaseAdmin } from '../lib/supabase'
import { Video } from '../types'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export class FFmpegServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'FFmpegServiceError'
  }
}

export interface VideoAssemblyAssets {
  audioFilepath: string
  videoFilepath: string
  script: string
}

export interface VideoAssemblyResult {
  filepath: string
  durationSec: number
}

export class FFmpegService {
  private supabase = supabaseAdmin
  private readonly PROCESS_TIMEOUT_MS = 300000 // 5 minutes

  async assembleVideo(storyId: string, assets: VideoAssemblyAssets): Promise<VideoAssemblyResult> {
    if (!storyId || !storyId.trim()) {
      throw new FFmpegServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!assets.audioFilepath || !assets.audioFilepath.trim()) {
      throw new FFmpegServiceError('Audio filepath is required', 'INVALID_AUDIO_FILE')
    }

    if (!assets.videoFilepath || !assets.videoFilepath.trim()) {
      throw new FFmpegServiceError('Video filepath is required', 'INVALID_VIDEO_FILE')
    }

    if (!assets.script || !assets.script.trim()) {
      throw new FFmpegServiceError('Script is required', 'INVALID_SCRIPT')
    }

    try {
      // Verify input files exist
      await this.verifyInputFiles([assets.audioFilepath, assets.videoFilepath])

      // Generate caption file
      const audioDurationMs = await this.getAudioDuration(assets.audioFilepath)
      const captionFile = await this.generateCaptionFile(
        storyId,
        assets.script.trim(),
        assets.audioFilepath,
        audioDurationMs
      )

      // Create output directory
      const outputDir = path.join(process.cwd(), 'output')
      await fs.mkdir(outputDir, { recursive: true })
      
      const outputFile = path.join(outputDir, `${storyId}.mp4`)

      // Build and execute ffmpeg command
      const ffmpegArgs = this.buildFFmpegCommand({
        audioFile: assets.audioFilepath,
        videoFile: assets.videoFilepath,
        captionFile
      }, outputFile)

      await this.executeFFmpegCommand(ffmpegArgs)

      // Get final video duration
      const durationSec = await this.getVideoDuration(outputFile)

      return {
        filepath: outputFile,
        durationSec
      }
    } catch (error) {
      if (error instanceof FFmpegServiceError) {
        throw error
      }
      
      console.error('Video assembly failed:', error)
      throw new FFmpegServiceError(
        'Failed to assemble video',
        'ASSEMBLY_FAILED'
      )
    }
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
      throw new FFmpegServiceError(
        'Failed to save video to database',
        'VIDEO_CREATION_FAILED'
      )
    }
  }

  async assembleVideoForStory(storyId: string, assets: VideoAssemblyAssets): Promise<Video> {
    let assembledFilepath: string | null = null

    try {
      const { filepath, durationSec } = await this.assembleVideo(storyId, assets)
      assembledFilepath = filepath

      const video = await this.createFinalVideo(storyId, filepath, durationSec)
      
      return video
    } catch (error) {
      if (assembledFilepath) {
        try {
          await fs.unlink(assembledFilepath)
        } catch (cleanupError) {
          console.error('Failed to cleanup video file:', cleanupError)
        }
      }

      if (error instanceof FFmpegServiceError) {
        throw error
      }

      throw new FFmpegServiceError(
        'Failed to assemble video for story',
        'STORY_ASSEMBLY_FAILED'
      )
    }
  }

  private async verifyInputFiles(filepaths: string[]): Promise<void> {
    try {
      await Promise.all(filepaths.map(filepath => fs.access(filepath)))
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FFmpegServiceError('Input file not found', 'FILE_NOT_FOUND')
      }
      throw error
    }
  }

  private async generateCaptionFile(
    storyId: string,
    script: string,
    audioFilepath: string,
    audioDurationMs: number
  ): Promise<string> {
    const captionDir = path.join(process.cwd(), 'assets', 'captions')
    await fs.mkdir(captionDir, { recursive: true })
    
    const captionFile = path.join(captionDir, `${storyId}.srt`)
    
    // Simple SRT format with single subtitle spanning the entire audio
    const startTime = '00:00:00,000'
    const endTime = this.formatSRTTimestamp(audioDurationMs)
    
    const srtContent = `1\n${startTime} --> ${endTime}\n${script}\n\n`
    
    await fs.writeFile(captionFile, srtContent)
    
    return captionFile
  }

  private buildFFmpegCommand(
    inputs: { audioFile: string; videoFile: string; captionFile: string },
    outputFile: string
  ): string[] {
    return [
      '-i', inputs.audioFile,
      '-i', inputs.videoFile,
      '-vf', `subtitles=${inputs.captionFile.replace(/\\/g, '/')}:force_style='Fontsize=24,PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=2'`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:v', '2M',
      '-b:a', '128k',
      '-r', '30',
      '-shortest',
      '-y', // Overwrite output file
      outputFile
    ]
  }

  private async executeFFmpegCommand(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('ffmpeg', args)
      let stderr = ''

      const timeout = setTimeout(() => {
        process.kill('SIGKILL')
        reject(new FFmpegServiceError('FFmpeg process timed out', 'TIMEOUT'))
      }, this.PROCESS_TIMEOUT_MS)

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      process.on('close', (code: number) => {
        clearTimeout(timeout)
        
        if (code === 0) {
          resolve()
        } else {
          reject(new FFmpegServiceError(
            `FFmpeg process failed with exit code ${code}: ${stderr}`,
            'FFMPEG_ERROR'
          ))
        }
      })

      process.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(new FFmpegServiceError(
          `Failed to spawn FFmpeg process: ${error.message}`,
          'SPAWN_ERROR'
        ))
      })
    })
  }

  private async getVideoDuration(videoFilepath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const process = spawn('ffmpeg', ['-i', videoFilepath, '-f', 'null', '-'])
      let stderr = ''

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      process.on('close', () => {
        // Extract duration from ffmpeg output
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        
        if (durationMatch) {
          const hours = parseInt(durationMatch[1])
          const minutes = parseInt(durationMatch[2])
          const seconds = parseFloat(durationMatch[3])
          
          const totalSeconds = hours * 3600 + minutes * 60 + seconds
          resolve(Math.round(totalSeconds))
        } else {
          reject(new FFmpegServiceError('Could not determine video duration', 'DURATION_ERROR'))
        }
      })

      process.on('error', (error: Error) => {
        reject(new FFmpegServiceError(
          `Failed to get video duration: ${error.message}`,
          'DURATION_QUERY_ERROR'
        ))
      })
    })
  }

  private async getAudioDuration(audioFilepath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const process = spawn('ffmpeg', ['-i', audioFilepath, '-f', 'null', '-'])
      let stderr = ''

      process.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      process.on('close', () => {
        // Extract duration from ffmpeg output
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        
        if (durationMatch) {
          const hours = parseInt(durationMatch[1])
          const minutes = parseInt(durationMatch[2])
          const seconds = parseFloat(durationMatch[3])
          
          const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000
          resolve(Math.round(totalMs))
        } else {
          reject(new FFmpegServiceError('Could not determine audio duration', 'DURATION_ERROR'))
        }
      })

      process.on('error', (error: Error) => {
        reject(new FFmpegServiceError(
          `Failed to get audio duration: ${error.message}`,
          'DURATION_QUERY_ERROR'
        ))
      })
    })
  }

  private formatSRTTimestamp(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000)
    const ms = milliseconds % 1000
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }
}

export const ffmpegService = new FFmpegService()