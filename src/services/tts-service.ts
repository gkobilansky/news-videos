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
    // First, check if we already have an audio asset for this story
    const existingAsset = await this.getExistingAudioAsset(storyId, script)
    if (existingAsset) {
      console.log(`Reusing existing audio asset for story ${storyId}`)
      return existingAsset
    }

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

  private async getExistingAudioAsset(storyId: string, script: string): Promise<Asset | null> {
    try {
      // Get existing audio assets for this story
      const { data: assets, error } = await this.supabase
        .from('assets')
        .select('*')
        .eq('story_id', storyId)
        .eq('kind', 'audio')
        .eq('provider', 'openai')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Failed to fetch existing audio assets:', error)
        return null
      }

      if (!assets || assets.length === 0) {
        return null
      }

      const asset = assets[0] as Asset
      
      // Check if the file still exists on disk
      const fullPath = path.resolve(process.cwd(), asset.filepath)
      try {
        await fs.access(fullPath)
        return asset
      } catch (fileError) {
        // File doesn't exist, remove the asset record and return null
        console.log(`Audio file ${asset.filepath} no longer exists, removing asset record`)
        await this.supabase
          .from('assets')
          .delete()
          .eq('id', asset.id)
        return null
      }
    } catch (error) {
      console.error('Error checking for existing audio asset:', error)
      return null
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