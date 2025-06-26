import { StoryInput, Story, StoryStatus } from '@/types'
import { supabaseAdmin } from '@/lib/supabase'
import { 
  validateStoryInput, 
  sanitizeStoryInput, 
  validateStatusTransition,
  isValidStoryStatus 
} from '@/lib/story-validation'

export class StoryServiceError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'StoryServiceError'
  }
}

export class StoryService {
  /**
   * Creates a new story with validated input
   */
  async createStory(input: StoryInput): Promise<Story> {
    // Sanitize input first
    const sanitizedInput = sanitizeStoryInput(input)
    
    // Validate the sanitized input
    const validation = validateStoryInput(sanitizedInput)
    if (!validation.isValid) {
      throw new StoryServiceError(`Validation failed: ${validation.errors.join(', ')}`, 'VALIDATION_ERROR')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('stories')
        .insert([{
          headline: sanitizedInput.headline,
          hot_take: sanitizedInput.hot_take || null,
          sources: sanitizedInput.sources,
          status: 'draft' as StoryStatus,
        }])
        .select()
        .single()

      if (error) {
        throw new StoryServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Story
    } catch (error) {
      if (error instanceof StoryServiceError) {
        throw error
      }
      throw new StoryServiceError(`Failed to create story: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Retrieves a story by ID
   */
  async getStory(id: string): Promise<Story | null> {
    if (!id || id.trim().length === 0) {
      throw new StoryServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('stories')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        // Handle not found vs other errors
        if (error.code === 'PGRST116') {
          return null
        }
        throw new StoryServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Story
    } catch (error) {
      if (error instanceof StoryServiceError) {
        throw error
      }
      throw new StoryServiceError(`Failed to get story: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Updates a story's status with business rule validation
   */
  async updateStoryStatus(id: string, newStatus: StoryStatus): Promise<Story> {
    if (!id || id.trim().length === 0) {
      throw new StoryServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    if (!isValidStoryStatus(newStatus)) {
      throw new StoryServiceError('Invalid status', 'VALIDATION_ERROR')
    }

    // Get current story to validate transition
    const currentStory = await this.getStory(id)
    if (!currentStory) {
      throw new StoryServiceError('Story not found', 'NOT_FOUND')
    }

    // Validate status transition
    const transitionValidation = validateStatusTransition(currentStory.status, newStatus)
    if (!transitionValidation.isValid) {
      throw new StoryServiceError(
        `Invalid status transition: ${transitionValidation.errors.join(', ')}`, 
        'BUSINESS_RULE_ERROR'
      )
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('stories')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw new StoryServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return data as Story
    } catch (error) {
      if (error instanceof StoryServiceError) {
        throw error
      }
      throw new StoryServiceError(`Failed to update story status: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Deletes a story with business rule validation
   */
  async deleteStory(id: string): Promise<void> {
    if (!id || id.trim().length === 0) {
      throw new StoryServiceError('Invalid story ID format', 'VALIDATION_ERROR')
    }

    // Get current story to validate deletion rules
    const currentStory = await this.getStory(id)
    if (!currentStory) {
      throw new StoryServiceError('Story not found', 'NOT_FOUND')
    }

    // Business rule: Cannot delete stories that are currently generating
    if (currentStory.status === 'generating') {
      throw new StoryServiceError(
        'Cannot delete story while video is generating', 
        'BUSINESS_RULE_ERROR'
      )
    }

    try {
      const { error } = await supabaseAdmin
        .from('stories')
        .delete()
        .eq('id', id)

      if (error) {
        throw new StoryServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }
    } catch (error) {
      if (error instanceof StoryServiceError) {
        throw error
      }
      throw new StoryServiceError(`Failed to delete story: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Lists stories with optional filtering and pagination
   */
  async listStories(options: {
    status?: StoryStatus
    limit?: number
    offset?: number
  } = {}): Promise<Story[]> {
    try {
      let query = supabaseAdmin
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply status filter if provided
      if (options.status) {
        if (!isValidStoryStatus(options.status)) {
          throw new StoryServiceError('Invalid status filter', 'VALIDATION_ERROR')
        }
        query = query.eq('status', options.status)
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit)
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new StoryServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      return (data || []) as Story[]
    } catch (error) {
      if (error instanceof StoryServiceError) {
        throw error
      }
      throw new StoryServiceError(`Failed to list stories: ${error}`, 'UNKNOWN_ERROR')
    }
  }

  /**
   * Gets stories by status with convenience method
   */
  async getStoriesByStatus(status: StoryStatus): Promise<Story[]> {
    return this.listStories({ status })
  }

  /**
   * Counts stories by status
   */
  async countStoriesByStatus(): Promise<Record<StoryStatus, number>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('stories')
        .select('status')

      if (error) {
        throw new StoryServiceError(`Database error: ${error.message}`, 'DATABASE_ERROR')
      }

      const counts: Record<StoryStatus, number> = {
        draft: 0,
        editing: 0,
        generating: 0,
        done: 0,
        failed: 0,
      }

      data?.forEach(story => {
        if (isValidStoryStatus(story.status)) {
          counts[story.status]++
        }
      })

      return counts
    } catch (error) {
      if (error instanceof StoryServiceError) {
        throw error
      }
      throw new StoryServiceError(`Failed to count stories: ${error}`, 'UNKNOWN_ERROR')
    }
  }
}

// Export a singleton instance
export const storyService = new StoryService()