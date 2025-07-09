import { supabaseAdmin } from '../lib/supabase'
import { Video } from '../types'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { stringifySync } from 'subtitle'

export class FFmpegServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'FFmpegServiceError'
  }
}

export interface VideoAssemblyAssets {
  audioFilepath: string
  videoFilepath: string | string[] // Support single video or array of videos for cutting
  script: string
  shotDurations?: number[] // Individual shot durations for multiple video files
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

    if (!assets.videoFilepath || 
        (typeof assets.videoFilepath === 'string' && !assets.videoFilepath.trim()) ||
        (Array.isArray(assets.videoFilepath) && assets.videoFilepath.length === 0)) {
      throw new FFmpegServiceError('Video filepath is required', 'INVALID_VIDEO_FILE')
    }

    if (!assets.script || !assets.script.trim()) {
      throw new FFmpegServiceError('Script is required', 'INVALID_SCRIPT')
    }

    console.log(`🎬 Starting video assembly for story ${storyId}`)
    console.log(`📄 Script: "${assets.script}"`)

    try {
      // Verify input files exist
      const videoFiles = Array.isArray(assets.videoFilepath) ? assets.videoFilepath : [assets.videoFilepath]
      console.log(`🔍 Verifying input files:`)
      console.log(`  Audio: ${assets.audioFilepath}`)
      videoFiles.forEach((file, index) => {
        console.log(`  Video ${index + 1}: ${file}`)
      })
      
      await this.verifyInputFiles([assets.audioFilepath, ...videoFiles])
      console.log(`✅ All input files verified`)

      // Generate caption file
      console.log(`📝 Generating caption file...`)
      const audioDurationMs = await this.getAudioDuration(assets.audioFilepath)
      console.log(`🔊 Audio duration: ${audioDurationMs}ms (${(audioDurationMs / 1000).toFixed(2)}s)`)
      
      const captionFile = await this.generateCaptionFile(
        storyId,
        assets.script.trim(),
        assets.audioFilepath,
        audioDurationMs
      )
      console.log(`📝 Caption file generated: ${captionFile}`)

      // Verify caption file was created and log its content
      try {
        const captionContent = await fs.readFile(captionFile, 'utf-8')
        if (captionContent) {
          console.log(`📝 Caption file content (first 300 chars):`)
          console.log(captionContent.substring(0, 300) + '...')
          
          const chunks = this.createCaptionChunks(assets.script.trim())
          console.log(`📊 Caption chunks (${chunks.length}): ${chunks.slice(0, 5).join(' | ')}${chunks.length > 5 ? '...' : ''}`)
        }
      } catch (readError) {
        // Skip logging this error in tests as it's expected when mocking filesystem
        if (process.env.NODE_ENV !== 'test') {
          console.error(`❌ Failed to read caption file: ${readError}`)
        }
      }

      // Create output directory
      const outputDir = path.join(process.cwd(), 'output')
      await fs.mkdir(outputDir, { recursive: true })
      
      // Create unique filename with timestamp to avoid caching issues
      const timestamp = Date.now()
      const outputFile = path.join(outputDir, `${storyId}-${timestamp}.mp4`)
      console.log(`🎯 Output file: ${outputFile}`)

      // Build and execute ffmpeg command
      const ffmpegArgs = await this.buildFFmpegCommand({
        audioFile: assets.audioFilepath,
        videoFiles: videoFiles,
        captionFile,
        shotDurations: assets.shotDurations
      }, outputFile)

      console.log(`🚀 FFmpeg command:`)
      console.log(`ffmpeg ${ffmpegArgs.join(' ')}`)
      
      // Also log the subtitle filter specifically
      const vfIndex = ffmpegArgs.indexOf('-vf')
      const filterComplexIndex = ffmpegArgs.indexOf('-filter_complex')
      if (vfIndex !== -1) {
        console.log(`📝 Subtitle filter: ${ffmpegArgs[vfIndex + 1]}`)
      } else if (filterComplexIndex !== -1) {
        console.log(`📝 Complex filter: ${ffmpegArgs[filterComplexIndex + 1]}`)
      }

      await this.executeFFmpegCommand(ffmpegArgs)
      console.log(`✅ FFmpeg execution completed`)

      // Get final video duration
      const durationSec = await this.getVideoDuration(outputFile)
      console.log(`📊 Final video duration: ${durationSec}s`)

      // Also create a symlink with the original name for easy access
      const standardOutputFile = path.join(outputDir, `${storyId}.mp4`)
      try {
        // Remove existing symlink/file if it exists
        await fs.unlink(standardOutputFile).catch(() => {})
        // Create symlink to the timestamped file
        await fs.symlink(path.basename(outputFile), standardOutputFile)
        console.log(`🔗 Created symlink: ${standardOutputFile} -> ${path.basename(outputFile)}`)
      } catch (symlinkError: unknown) {
        const errorMessage = symlinkError instanceof Error ? symlinkError.message : String(symlinkError)
        console.warn(`⚠️ Could not create symlink: ${errorMessage}`)
      }

      return {
        filepath: outputFile, // Return the timestamped file path
        durationSec
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Video assembly failed for story ${storyId}:`, error)
      }
      
      if (error instanceof FFmpegServiceError) {
        throw error
      }
      
      if (process.env.NODE_ENV !== 'test') {
        console.error('Video assembly failed:', error)
      }
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
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to create final video:', error)
      }
      throw new FFmpegServiceError(
        'Failed to save video to database',
        'VIDEO_CREATION_FAILED'
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
    
    // Break script into synchronized chunks (2-word chunks for readability)
    const chunks = this.createCaptionChunks(script)
    
    // Create subtitle cues using the subtitle library
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
    
    // Generate SRT content using subtitle library (defaults to SRT format)
    const srtContent = stringifySync(cues, { format: 'SRT' })
    
    await fs.writeFile(captionFile, srtContent)
    
    return captionFile
  }

  private createCaptionChunks(script: string): string[] {
    const words = script.trim().split(/\s+/)
    const chunks: string[] = []
    
    if (words.length === 0) return chunks
    if (words.length === 1) return [words[0]]
    if (words.length === 2) return [words.join(' ')]
    
    // For scripts with 3+ words, create 2-word chunks primarily
    // Allow single-word chunks as final chunks if needed
    let i = 0
    while (i < words.length) {
      const remainingWords = words.length - i
      
      if (remainingWords === 1) {
        // Single word left - create a single-word chunk
        chunks.push(words[i])
        break
      } else if (remainingWords === 2) {
        // Two words left - keep together
        chunks.push(words.slice(i, i + 2).join(' '))
        break
      } else if (remainingWords === 3) {
        // Three words left - take 2 words, then handle the last one
        chunks.push(words.slice(i, i + 2).join(' '))
        i += 2
        // This will leave 1 word for the next iteration, which will be a single-word chunk
      } else {
        // 4+ words remaining - take 2 words
        chunks.push(words.slice(i, i + 2).join(' '))
        i += 2
      }
    }

    return chunks
  }


  private async buildFFmpegCommand(
    inputs: { audioFile: string; videoFiles: string[]; captionFile: string; shotDurations?: number[] },
    outputFile: string
  ): Promise<string[]> {
    // Enhanced subtitle styling optimized for vertical video format (768x1280)
    const subtitleStyle = [
      'Fontname=Arial Black',       // Bold, impactful font
      'Fontsize=18',               // Reduced font size to fit vertical format
      'PrimaryColour=&Hffffff&',   // Pure white text
      'SecondaryColour=&H00ffff&', // Cyan secondary color for effects
      'OutlineColour=&H000000&',   // Black outline
      'BackColour=&H40000000&',    // Semi-transparent black background (more opaque)
      'Outline=2',                 // Reduced outline thickness
      'Shadow=1',                  // Reduced drop shadow
      'Bold=1',                    // Bold text
      'ScaleX=100',                // Normal width scaling
      'ScaleY=100',                // Normal height scaling
      'Spacing=1',                 // Slightly spaced letters for clarity
      'MarginV=120',               // Bottom margin optimized for 1280px height
      'MarginL=40',                // Left margin optimized for 768px width
      'MarginR=40',                // Right margin optimized for 768px width
      'Alignment=2',               // Bottom center alignment
      'BorderStyle=3',             // Box background style
      'WrapStyle=0'                // No word wrapping (we control chunks)
    ].join(',')

    // Handle single video file (backward compatibility)
    if (inputs.videoFiles.length === 1) {
      return [
        '-i', inputs.audioFile,
        '-i', inputs.videoFiles[0],
        '-vf', `subtitles=${inputs.captionFile.replace(/\\/g, '/')}:force_style='${subtitleStyle}'`,
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

    // Handle multiple video files with cuts and transitions
    const args = ['-i', inputs.audioFile]
    
    // Add all video inputs
    inputs.videoFiles.forEach(videoFile => {
      args.push('-i', videoFile)
    })

    // Create a complex filter for video transitions INCLUDING subtitles
    // This creates seamless cuts between videos, using individual shot durations or equal segments
    
    // Calculate fallback duration for equal segments if no shot durations provided
    let fallbackDuration: number | null = null
    if (!inputs.shotDurations || inputs.shotDurations.length !== inputs.videoFiles.length) {
      const audioDuration = await this.getAudioDuration(inputs.audioFile)
      fallbackDuration = Math.floor(audioDuration / inputs.videoFiles.length)
    }
    
    const videoProcessing = inputs.videoFiles.map((_, index) => {
      const inputIndex = index + 1 // +1 because input 0 is audio
      
      // Use individual shot duration if available, otherwise use fallback equal segments
      const duration = inputs.shotDurations?.[index] || fallbackDuration || 5
      
      return `[${inputIndex}:v]trim=duration=${duration},scale=768:1280,setsar=1[v${index}]`
    }).join(';')
    
    const videoConcatenation = inputs.videoFiles.map((_, index) => `[v${index}]`).join('') + 
      `concat=n=${inputs.videoFiles.length}:v=1:a=0[concat]`
    
    const subtitlesFilter = `[concat]subtitles=${inputs.captionFile.replace(/\\/g, '/')}:force_style='${subtitleStyle}'[outv]`
    
    const filterComplex = videoProcessing + ';' + videoConcatenation + ';' + subtitlesFilter

    return [
      ...args,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '0:a', // Use audio from first input (TTS)
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
      console.log(`🚀 Executing FFmpeg with args: ${args.slice(0, 10).join(' ')}${args.length > 10 ? '...' : ''}`)
      
      const process = spawn('ffmpeg', args)
      let stderr = ''
      let stdout = ''

      const timeout = setTimeout(() => {
        console.error(`⏰ FFmpeg process timed out after ${this.PROCESS_TIMEOUT_MS}ms`)
        process.kill('SIGKILL')
        reject(new FFmpegServiceError('FFmpeg process timed out', 'TIMEOUT'))
      }, this.PROCESS_TIMEOUT_MS)

      process.stdout.on('data', (data: Buffer) => {
        const output = data.toString()
        stdout += output
        // Log significant stdout output (though FFmpeg usually uses stderr)
        if (output.length > 50) {
          console.log(`📤 FFmpeg stdout: ${output.substring(0, 200)}...`)
        }
      })

      process.stderr.on('data', (data: Buffer) => {
        const output = data.toString()
        stderr += output
        
        // Log progress and key information from FFmpeg stderr
        if (output.includes('frame=') || output.includes('time=')) {
          // Progress information - log sparingly
          const timeMatch = output.match(/time=(\S+)/)
          if (timeMatch) {
            console.log(`⏳ FFmpeg progress: ${timeMatch[1]}`)
          }
        } else if (output.includes('Stream mapping') || output.includes('Output #0')) {
          console.log(`📊 FFmpeg info: ${output.trim()}`)
        } else if (output.includes('error') || output.includes('Error') || output.includes('failed')) {
          console.error(`❌ FFmpeg error: ${output.trim()}`)
        } else if (output.includes('warning') || output.includes('Warning')) {
          console.warn(`⚠️ FFmpeg warning: ${output.trim()}`)
        }
      })

      process.on('close', (code: number) => {
        clearTimeout(timeout)
        
        console.log(`🏁 FFmpeg process finished with exit code: ${code}`)
        
        if (code === 0) {
          console.log(`✅ FFmpeg execution successful`)
          resolve()
        } else {
          console.error(`❌ FFmpeg failed with code ${code}`)
          console.error(`❌ FFmpeg stderr (last 1000 chars): ${stderr.slice(-1000)}`)
          
          // Try to extract more specific error information
          const errorLines = stderr.split('\n').filter(line => 
            line.toLowerCase().includes('error') || 
            line.toLowerCase().includes('failed') ||
            line.toLowerCase().includes('invalid')
          )
          
          if (errorLines.length > 0) {
            console.error(`❌ Specific FFmpeg errors:`)
            errorLines.forEach(line => console.error(`   ${line.trim()}`))
          }
          
          reject(new FFmpegServiceError(
            `FFmpeg process failed with exit code ${code}. Error: ${errorLines.join('; ') || stderr.slice(-500)}`,
            'FFMPEG_ERROR'
          ))
        }
      })

      process.on('error', (error: Error) => {
        clearTimeout(timeout)
        console.error(`❌ Failed to spawn FFmpeg process:`, error)
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
    // Round to ensure clean integer milliseconds
    const roundedMs = Math.round(milliseconds)
    const totalSeconds = Math.floor(roundedMs / 1000)
    const ms = roundedMs % 1000
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }
}

export const ffmpegService = new FFmpegService()