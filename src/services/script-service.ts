import { Story, Script, Storyboard, StoryboardShot, SourceContent } from '../types'
import { supabaseAdmin } from '../lib/supabase'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
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

      // Validate script length (≤50 words recommended)
      const wordCount = text.trim().split(/\s+/).length
      if (wordCount > 50) {
        console.warn(`⚠️  Generated script is longer than recommended: ${wordCount} words (recommended max 50)`)
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
   * Generates a storyboard for a story using AI with optimized prompts for Runway
   */
  async generateStoryboard(story: Story): Promise<Storyboard> {
    if (!story) {
      throw new ScriptServiceError('Story is required', 'VALIDATION_ERROR')
    }

    // Get the script for this story to split into logical beats
    const script = await this.getScript(story.id)
    if (!script) {
      throw new ScriptServiceError('Script must exist before generating storyboard', 'SCRIPT_NOT_FOUND')
    }

    // Fetch source content for context
    const sourcesContent = await this.fetchSourcesContent(story.sources)

    try {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You are a professional video storyboard creator specializing in news content for Runway ML Gen-4.

CRITICAL WORKFLOW REQUIREMENTS:
1. Split the script into 2-3 logical beats/segments
2. Create ONE shot per beat (2-3 shots total)
3. Each shot should be 5-10 seconds (total video 10-15 seconds)
4. Use motion-centric, action-focused prompts
5. Avoid negatives and conversational fluff
6. Include presenter/anchor references for consistency

SHOT DISTRIBUTION STRATEGY:
- 2 shots: Establishing shot + Close-up/detail shot
- 3 shots: Wide establishing + Medium focus + Close resolution

PROMPT STYLE GUIDE:
✅ Good: "handheld camera follows presenter walking through newsroom"
✅ Good: "dolly-in on anchor gesturing at data visualization"
✅ Good: "dynamic pan across breaking news graphics"
❌ Avoid: "don't show sad faces"
❌ Avoid: "the anchor is talking about..."

REFERENCE IMAGES:
- Use @anchor tag in prompts for presenter consistency
- Include camera movements and angles
- Focus on visual storytelling, not dialogue

Return a JSON object with this exact structure:
{
  "model": "gen4_turbo",
  "ratio": "768:1280",
  "shots": [
    {
      "promptText": "motion-centric action description with @anchor tag",
      "duration": 5,
      "camera": {
        "movement": "dolly-in|dolly-out|pan-left|pan-right|handheld|static|zoom-in|zoom-out",
        "angle": "eye-level|low-angle|high-angle|bird-eye|worm-eye"
      }
    }
  ],
  "fps": 24,
  "output_format": "mp4"
}`
          },
          {
            role: 'user',
            content: `Create a storyboard for this news story:

HEADLINE: ${story.headline}
HOT TAKE: ${story.hot_take || 'N/A'}
SCRIPT TO SPLIT: "${script.text}"

SOURCES: ${story.sources.map((url, index) => `${index}: ${url}`).join('\n')}

${sourcesContent.length > 0 ? 'SOURCE CONTENT:\n' + sourcesContent.map((content, i) => `${i + 1}. ${content.title || 'Source'}: ${content.content.substring(0, 200)}...`).join('\n') : ''}

Split the script into logical beats and create 2-3 dynamic shots that bring this news story to life. Each shot should advance the narrative and use engaging camera work.`
          }
        ]
      })

      let storyboardData: any

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
        
        console.log('🎬 Generated storyboard JSON:', jsonText.substring(0, 200) + '...')
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

      // Validate and optimize storyboard structure
      const validatedShots = this.validateAndOptimizeShots(storyboardData.shots)

      // Create storyboard object with optimized settings
      const storyboard: Omit<Storyboard, 'id' | 'created_at' | 'updated_at'> = {
        story_id: story.id,
        model: 'gen4_turbo', // Use turbo for faster processing
        ratio: '768:1280', // Portrait format optimized for social media
        shots: validatedShots,
        fps: 24, // Standard frame rate
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

      console.log('✅ Storyboard generated successfully with', validatedShots.length, 'optimized shots')
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
    if (!Array.isArray(shots) || shots.length < 1) {
      throw new ScriptServiceError('Storyboard must have at least 1 shot', 'INVALID_SHOTS')
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
   * Validates and optimizes storyboard shots according to Runway best practices
   */
  private validateAndOptimizeShots(shots: any[]): StoryboardShot[] {
    if (!Array.isArray(shots) || shots.length === 0) {
      throw new ScriptServiceError('Storyboard must have at least one shot', 'VALIDATION_ERROR')
    }

    if (shots.length > 3) {
      // Limit to 3 shots for optimal performance and credits
      shots = shots.slice(0, 3)
      console.log('🎬 Limited storyboard to 3 shots for optimal performance')
    }

    return shots.map((shot, index) => {
      // Validate required fields
      if (!shot.promptText || typeof shot.promptText !== 'string') {
        throw new ScriptServiceError(`Shot ${index + 1} missing valid promptText`, 'VALIDATION_ERROR')
      }

      if (!shot.duration || typeof shot.duration !== 'number') {
        throw new ScriptServiceError(`Shot ${index + 1} missing valid duration`, 'VALIDATION_ERROR')
      }

      // Optimize prompt text for Runway
      let optimizedPrompt = shot.promptText.trim()
      
      // Ensure motion-centric language
      if (!this.hasMotionWords(optimizedPrompt)) {
        const cameraMovement = shot.camera?.movement || 'static'
        optimizedPrompt = `${cameraMovement} shot: ${optimizedPrompt}`
      }

      // Ensure it's action-focused and concise
      if (optimizedPrompt.length > 200) {
        optimizedPrompt = optimizedPrompt.substring(0, 197) + '...'
      }

      // Validate duration constraints for Gen-4 Turbo
      const validDurations = [5, 10, 16]
      const duration = validDurations.includes(shot.duration) ? shot.duration : 5

      return {
        promptText: optimizedPrompt,
        duration: duration as 5 | 10 | 16,
        camera: {
          movement: shot.camera?.movement || 'static',
          angle: shot.camera?.angle || 'eye-level'
        }
      }
    })
  }

  /**
   * Checks if prompt contains motion-centric words
   */
  private hasMotionWords(prompt: string): boolean {
    const motionWords = [
      'camera', 'shot', 'dolly', 'pan', 'zoom', 'handheld', 'tracking',
      'follows', 'moves', 'sweeps', 'glides', 'pushes', 'pulls'
    ]
    
    const lowercasePrompt = prompt.toLowerCase()
    return motionWords.some(word => lowercasePrompt.includes(word))
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

    // Validate script length (≤50 words recommended)
    const wordCount = text.trim().split(/\s+/).length
    if (wordCount > 50) {
      console.warn(`⚠️  Script is longer than recommended: ${wordCount} words (recommended max 50)`)
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
- 50 words maximum
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

  /**
   * Adds a new shot to the end of an existing storyboard
   */
  async addShotToStoryboard(storyId: string, newShot: StoryboardShot): Promise<Storyboard> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    // Validate the new shot
    this.validateSingleShot(newShot)

    try {
      // Get existing storyboard
      const existingStoryboard = await this.getStoryboard(storyId)
      if (!existingStoryboard) {
        throw new ScriptServiceError('Storyboard not found', 'STORYBOARD_NOT_FOUND')
      }

      // Add new shot to the end
      const updatedShots = [...existingStoryboard.shots, newShot]

      // Update the storyboard
      const { data, error } = await supabaseAdmin
        .from('storyboards')
        .update({
          shots: updatedShots,
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
      throw new ScriptServiceError(`Failed to add shot to storyboard: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Inserts a new shot at a specific position in the storyboard
   */
  async insertShotAtPosition(storyId: string, position: number, newShot: StoryboardShot): Promise<Storyboard> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    // Validate the new shot
    this.validateSingleShot(newShot)

    try {
      // Get existing storyboard
      const existingStoryboard = await this.getStoryboard(storyId)
      if (!existingStoryboard) {
        throw new ScriptServiceError('Storyboard not found', 'STORYBOARD_NOT_FOUND')
      }

      // Validate position bounds
      if (position < 0 || position > existingStoryboard.shots.length) {
        throw new ScriptServiceError('Invalid position', 'INVALID_POSITION')
      }

      // Insert shot at the specified position
      const updatedShots = [...existingStoryboard.shots]
      updatedShots.splice(position, 0, newShot)

      // Update the storyboard
      const { data, error } = await supabaseAdmin
        .from('storyboards')
        .update({
          shots: updatedShots,
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
      throw new ScriptServiceError(`Failed to insert shot at position: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Removes a shot from the storyboard at a specific position
   */
  async removeShotFromStoryboard(storyId: string, position: number): Promise<Storyboard> {
    if (!storyId || storyId.trim().length === 0) {
      throw new ScriptServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    try {
      // Get existing storyboard
      const existingStoryboard = await this.getStoryboard(storyId)
      if (!existingStoryboard) {
        throw new ScriptServiceError('Storyboard not found', 'STORYBOARD_NOT_FOUND')
      }

      // Validate position bounds
      if (position < 0 || position >= existingStoryboard.shots.length) {
        throw new ScriptServiceError('Invalid position', 'INVALID_POSITION')
      }

      // Remove shot at the specified position
      const updatedShots = [...existingStoryboard.shots]
      updatedShots.splice(position, 1)

      // Update the storyboard
      const { data, error } = await supabaseAdmin
        .from('storyboards')
        .update({
          shots: updatedShots,
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
      throw new ScriptServiceError(`Failed to remove shot from storyboard: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Validates a single shot structure
   */
  private validateSingleShot(shot: StoryboardShot): void {
    if (!shot.promptText || typeof shot.promptText !== 'string' || shot.promptText.trim().length === 0) {
      throw new ScriptServiceError('Invalid shot data: promptText is required', 'INVALID_SHOT_DATA')
    }

    if (!shot.duration || ![5, 10, 16].includes(shot.duration)) {
      throw new ScriptServiceError('Invalid shot data: duration must be 5, 10, or 16', 'INVALID_SHOT_DATA')
    }

    if (shot.camera) {
      const validMovements = ['static', 'dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'handheld', 'zoom-in', 'zoom-out']
      const validAngles = ['eye-level', 'low-angle', 'high-angle', 'bird-eye', 'worm-eye']

      if (shot.camera.movement && !validMovements.includes(shot.camera.movement)) {
        throw new ScriptServiceError('Invalid shot data: invalid camera movement', 'INVALID_SHOT_DATA')
      }

      if (shot.camera.angle && !validAngles.includes(shot.camera.angle)) {
        throw new ScriptServiceError('Invalid shot data: invalid camera angle', 'INVALID_SHOT_DATA')
      }
    }
  }
}

// Export a singleton instance
export const scriptService = new ScriptService()