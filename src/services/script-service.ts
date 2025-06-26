import { Story, Script } from '@/types'
import { supabaseAdmin } from '@/lib/supabase'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

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