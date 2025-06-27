import OpenAI from 'openai'
import { supabaseAdmin } from '../lib/supabase'
import { Asset } from '../types'
import fs from 'fs/promises'
import path from 'path'

export class TTSServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'TTSServiceError'
  }
}

export interface TTSGenerationResult {
  filepath: string
  durationMs: number
}

export class TTSService {
  private openai: OpenAI
  private supabase = supabaseAdmin

  constructor(openaiClient?: OpenAI) {
    if (openaiClient) {
      this.openai = openaiClient
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new TTSServiceError('OpenAI API key is required', 'MISSING_API_KEY')
      }
      
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }
  }

  async generateSpeech(storyId: string, script: string): Promise<TTSGenerationResult> {
    if (!storyId || !storyId.trim()) {
      throw new TTSServiceError('Story ID is required', 'INVALID_STORY_ID')
    }

    if (!script || !script.trim()) {
      throw new TTSServiceError('Script text is required', 'INVALID_SCRIPT')
    }

    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: script.trim(),
        response_format: 'wav'
      })

      const audioBuffer = Buffer.from(await response.arrayBuffer())
      
      const audioDir = path.join(process.cwd(), 'assets', 'audio')
      const filepath = path.join(audioDir, `${storyId}.wav`)

      await fs.mkdir(audioDir, { recursive: true })
      await fs.writeFile(filepath, audioBuffer)

      const durationMs = this.estimateDuration(script)

      return {
        filepath,
        durationMs
      }
    } catch (error) {
      if (error instanceof TTSServiceError) {
        throw error
      }
      
      console.error('TTS generation failed:', error)
      throw new TTSServiceError(
        'Failed to generate TTS audio',
        'TTS_GENERATION_FAILED'
      )
    }
  }

  async createAudioAsset(storyId: string, filepath: string, durationMs: number): Promise<Asset> {
    try {
      const relativePath = path.relative(process.cwd(), filepath)
      
      const { data, error } = await this.supabase
        .from('assets')
        .insert({
          story_id: storyId,
          kind: 'audio',
          provider: 'openai',
          filepath: relativePath,
          metadata: { durationMs }
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
      console.error('Failed to create audio asset:', error)
      throw new TTSServiceError(
        'Failed to save audio asset to database',
        'ASSET_CREATION_FAILED'
      )
    }
  }

  async generateTTSForStory(storyId: string, script: string): Promise<Asset> {
    let generatedFilepath: string | null = null

    try {
      const { filepath, durationMs } = await this.generateSpeech(storyId, script)
      generatedFilepath = filepath

      const asset = await this.createAudioAsset(storyId, filepath, durationMs)
      
      return asset
    } catch (error) {
      if (generatedFilepath) {
        try {
          await fs.unlink(generatedFilepath)
        } catch (cleanupError) {
          console.error('Failed to cleanup audio file:', cleanupError)
        }
      }

      if (error instanceof TTSServiceError) {
        throw error
      }

      throw new TTSServiceError(
        'Failed to generate TTS for story',
        'STORY_TTS_FAILED'
      )
    }
  }

  private estimateDuration(script: string): number {
    const words = script.trim().split(/\s+/).length
    const averageWordsPerMinute = 150
    const wordsPerSecond = averageWordsPerMinute / 60
    const durationSeconds = words / wordsPerSecond
    
    return Math.round(durationSeconds * 1000)
  }
}

export const ttsService = new TTSService()