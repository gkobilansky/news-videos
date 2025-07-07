import { Story, Script, Storyboard, StoryboardShot, SourceContent } from '@/types'
import { supabaseAdmin } from '@/lib/supabase'
import { openai } from '@ai-sdk/openai'
import { generateText, tool } from 'ai'
import { z } from 'zod'

export class ScriptServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'ScriptServiceError'
  }
}

export class ScriptService {
  /**
   * Generates a script for a story using OpenAI
   */
  async generateScript(story: Story): Promise<Script> {
    try {
      // Create RAG prompt
      const prompt = this.buildScriptPrompt(story)
      
      // Generate script using OpenAI
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        maxTokens: 100,
        temperature: 0.7,
      })

      // Validate script length (≤45 words)
      const wordCount = text.trim().split(/\s+/).length
      if (wordCount > 45) {
        throw new ScriptServiceError(
          `Generated script too long: ${wordCount} words (max 45)`,
          'SCRIPT_TOO_LONG'
        )
      }

      // Save script to database
      const { data, error } = await supabaseAdmin
        .from('scripts')
        .insert([{
          story_id: story.id,
          text: text.trim(),
          edited_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (error) {
        throw new ScriptServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Script
    } catch (error) {
      if (error instanceof ScriptServiceError) {
        throw error
      }
      throw new ScriptServiceError(`Failed to generate script: ${error}`, 'OPENAI_ERROR')
    }
  }

  /**
   * Generates a 3-shot storyboard for a story using OpenAI with source content
   */
  async generateStoryboard(story: Story): Promise<Storyboard> {
    try {
      // Fetch source content for better context
      let sourceContent: SourceContent[] = []
      try {
        sourceContent = await this.fetchSourcesContent(story.sources)
      } catch (error) {
        console.warn('Failed to fetch source content, proceeding without:', error)
      }

      // Create enhanced prompt with source content
      const prompt = this.buildStoryboardPrompt(story, sourceContent)
      
      // Generate storyboard using OpenAI - structured for JSON output
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        maxTokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent JSON structure
        // Remove tools for now to ensure cleaner JSON response
      })

      // Log the raw response for debugging
      console.log('🤖 Raw OpenAI response:', text)
      console.log('🤖 Response length:', text.length)
      console.log('🤖 First 200 chars:', text.substring(0, 200))

      // Parse and validate the storyboard JSON
      let storyboardData
      try {
        let jsonText = text.trim()
        
        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        
        // Extract JSON object from the response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonText = jsonMatch[0]
        }
        
        // Clean up any trailing text after the JSON
        const lastBraceIndex = jsonText.lastIndexOf('}')
        if (lastBraceIndex !== -1) {
          jsonText = jsonText.substring(0, lastBraceIndex + 1)
        }
        
        console.log('🤖 Cleaned JSON text:', jsonText.substring(0, 300) + '...')
        storyboardData = JSON.parse(jsonText)
        
        // Verify it has the expected structure
        if (!storyboardData.shots || !Array.isArray(storyboardData.shots)) {
          throw new Error('Response missing shots array')
        }
        
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError)
        console.error('❌ Failed to parse text:', text)
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
        throw new ScriptServiceError(`Invalid JSON response from AI: ${errorMessage}`, 'INVALID_JSON')
      }

      // Validate storyboard structure
      const validatedShots = this.validateStoryboardShots(storyboardData.shots)

      // Create storyboard object
      const storyboard: Omit<Storyboard, 'id' | 'created_at' | 'updated_at'> = {
        story_id: story.id,
        model: 'gen4_turbo',
        ratio: '720:1280', // Portrait format for vertical videos
        shots: validatedShots,
        fps: 24,
        output_format: 'mp4'
      }

      // Save storyboard to database
      const { data, error } = await supabaseAdmin
        .from('storyboards')
        .insert([{
          ...storyboard,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (error) {
        throw new ScriptServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Storyboard
    } catch (error) {
      if (error instanceof ScriptServiceError) {
        throw error
      }
      throw new ScriptServiceError(`Failed to generate storyboard: ${error}`, 'STORYBOARD_ERROR')
    }
  }

  /**
   * Updates an existing storyboard's shots
   */
  async updateStoryboard(storyId: string, shots: StoryboardShot[]): Promise<Storyboard> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    // Validate shot structure
    const validatedShots = this.validateStoryboardShots(shots)

    try {
      const { data, error } = await supabaseAdmin
        .from('storyboards')
        .update({
          shots: validatedShots,
          updated_at: new Date().toISOString(),
        })
        .eq('story_id', storyId)
        .select()
        .single()

      if (error) {
        throw new ScriptServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Storyboard
    } catch (error) {
      if (error instanceof ScriptServiceError) {
        throw error
      }
      throw new ScriptServiceError(`Failed to update storyboard: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Retrieves a storyboard by story ID
   */
  async getStoryboard(storyId: string): Promise<Storyboard | null> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('storyboards')
        .select('*')
        .eq('story_id', storyId)
        .single()

      if (error) {
        // Handle not found vs other errors
        if (error.code === 'PGRST116') {
          return null
        }
        throw new ScriptServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Storyboard
    } catch (error) {
      if (error instanceof ScriptServiceError) {
        throw error
      }
      throw new ScriptServiceError(`Failed to get storyboard: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Fetches content from source URLs
   */
  private async fetchSourcesContent(sources: string[]): Promise<SourceContent[]> {
    const contentPromises = sources.map(async (url): Promise<SourceContent | null> => {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsVideoBot/1.0)',
          },
        })

        if (!response.ok) {
          console.warn(`Failed to fetch ${url}: ${response.status}`)
          return null
        }

        const html = await response.text()
        const content = this.extractContentFromHTML(html)
        const title = this.extractTitleFromHTML(html)

        return {
          url,
          title,
          content,
          extractedAt: new Date().toISOString()
        }
      } catch (error) {
        console.warn(`Error fetching ${url}:`, error)
        return null
      }
    })

    const results = await Promise.all(contentPromises)
    return results.filter((content): content is SourceContent => content !== null)
  }

  /**
   * Extracts main content from HTML
   */
  private extractContentFromHTML(html: string): string {
    // Simple HTML content extraction (in production, consider using a proper library like cheerio)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Return first 1000 characters to avoid overwhelming the AI
    return textContent.substring(0, 1000)
  }

  /**
   * Extracts title from HTML
   */
  private extractTitleFromHTML(html: string): string | undefined {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return titleMatch ? titleMatch[1].trim() : undefined
  }

  /**
   * Validates storyboard shot structure
   */
  private validateStoryboardShots(shots: any[]): StoryboardShot[] {
    if (!Array.isArray(shots) || shots.length !== 3) {
      throw new ScriptServiceError('Storyboard must have exactly 3 shots', 'INVALID_SHOTS')
    }

    return shots.map((shot, index) => {
      if (!shot.promptText || typeof shot.promptText !== 'string') {
        throw new ScriptServiceError(`Shot ${index + 1} missing promptText`, 'INVALID_SHOT')
      }

      if (!shot.duration || ![5, 10, 16].includes(shot.duration)) {
        throw new ScriptServiceError(`Shot ${index + 1} must have duration of 5, 10, or 16`, 'INVALID_DURATION')
      }

      return {
        promptText: shot.promptText,
        duration: shot.duration,
        camera: shot.camera || { movement: 'static', angle: 'eye-level' },
        seed: shot.seed,
        promptImage: shot.promptImage,
        referenceImages: shot.referenceImages
      }
    })
  }

  /**
   * Builds enhanced storyboard prompt with source content
   */
  private buildStoryboardPrompt(story: Story, sourceContent: SourceContent[]): string {
    const sourcesText = story.sources.map((url, i) => `${i + 1}. ${url}`).join('\n')
    
    let prompt = `You are a professional video producer creating a storyboard for news content. Your task is to generate a JSON object for a 3-shot storyboard.

CRITICAL: Your response must be ONLY valid JSON. No explanation, no markdown, no additional text.

Requirements:
- Exactly 3 shots, each 5 seconds duration
- Portrait format (720:1280) for vertical video
- Each shot should have compelling visual narrative
- Include camera movements for dynamic footage
- Focus on news storytelling best practices

Expected JSON structure (respond with ONLY this JSON):
{
  "shots": [
    {
      "promptText": "Shot 1: Wide establishing shot description with specific visual details",
      "duration": 5,
      "camera": {
        "movement": "static",
        "angle": "eye-level"
      }
    },
    {
      "promptText": "Shot 2: Medium or close-up shot description focusing on key elements",
      "duration": 5,
      "camera": {
        "movement": "dolly-in",
        "angle": "low-angle"
      }
    },
    {
      "promptText": "Shot 3: Concluding shot description that provides resolution or context",
      "duration": 5,
      "camera": {
        "movement": "static",
        "angle": "eye-level"
      }
    }
  ]
}

Valid camera movements: static, dolly-in, dolly-out, pan-left, pan-right, tilt-up, tilt-down, handheld, zoom-in, zoom-out
Valid camera angles: eye-level, low-angle, high-angle, bird-eye, worm-eye

Story Details:
Headline: ${story.headline}

Sources:
${sourcesText}`

    if (story.hot_take) {
      prompt += `\n\nHot Take: ${story.hot_take}`
    }

    if (sourceContent.length > 0) {
      prompt += `\n\nSource Content Context:`
      sourceContent.forEach((content, i) => {
        prompt += `\n\n${i + 1}. ${content.title || 'Source'}: ${content.content.substring(0, 300)}...`
      })
    }

    prompt += `\n\nIMPORTANT: Respond with ONLY the JSON object. No other text. Start with { and end with }.`

    return prompt
  }

  /**
   * Retrieves a script by story ID
   */
  async getScript(storyId: string): Promise<Script | null> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('scripts')
        .select('*')
        .eq('story_id', storyId)
        .single()

      if (error) {
        // Handle not found vs other errors
        if (error.code === 'PGRST116') {
          return null
        }
        throw new ScriptServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Script
    } catch (error) {
      if (error instanceof ScriptServiceError) {
        throw error
      }
      throw new ScriptServiceError(`Failed to get script: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Updates a script's text content
   */
  async updateScript(storyId: string, text: string): Promise<Script> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    // Validate script length (≤45 words)
    const wordCount = text.trim().split(/\s+/).length
    if (wordCount > 45) {
      throw new ScriptServiceError(
        `Script too long: ${wordCount} words (max 45)`,
        'SCRIPT_TOO_LONG'
      )
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('scripts')
        .update({
          text: text.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq('story_id', storyId)
        .select()
        .single()

      if (error) {
        throw new ScriptServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Script
    } catch (error) {
      if (error instanceof ScriptServiceError) {
        throw error
      }
      throw new ScriptServiceError(`Failed to update script: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Builds the RAG prompt for script generation
   */
  private buildScriptPrompt(story: Story): string {
    const sourcesText = story.sources.map((url, i) => `${i + 1}. ${url}`).join('\n')
    
    let prompt = `Create a 10-15 second video script for a vertical newsbite format.

Requirements:
- 45 words maximum
- Engaging, punchy delivery for social media
- Focus on the key impact or significance
- Written for voice-over narration

Headline: ${story.headline}

Sources:
${sourcesText}`

    if (story.hot_take) {
      prompt += `\n\nHot Take: ${story.hot_take}`
    }

    prompt += `\n\nGenerate only the script text, no additional formatting or explanations.`

    return prompt
  }
}

// Export a singleton instance
export const scriptService = new ScriptService()