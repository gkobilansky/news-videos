import { StoryInput, StoryStatus } from '@/types'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Validates a complete story input
 */
export function validateStoryInput(input: StoryInput): ValidationResult {
  const errors: string[] = []

  // Validate headline
  const headlineValidation = validateHeadline(input.headline)
  if (!headlineValidation.isValid) {
    errors.push(...headlineValidation.errors)
  }

  // Validate sources
  const sourcesValidation = validateSources(input.sources)
  if (!sourcesValidation.isValid) {
    errors.push(...sourcesValidation.errors)
  }

  // Validate hot take (optional)
  if (input.hot_take !== undefined) {
    const hotTakeValidation = validateHotTake(input.hot_take)
    if (!hotTakeValidation.isValid) {
      errors.push(...hotTakeValidation.errors)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates a story headline
 */
export function validateHeadline(headline: string): ValidationResult {
  const errors: string[] = []

  if (!headline || headline.trim().length === 0) {
    errors.push('Headline is required')
    return { isValid: false, errors }
  }

  const trimmedHeadline = headline.trim()

  if (trimmedHeadline.length < 10) {
    errors.push('Headline must be at least 10 characters long')
  }

  if (trimmedHeadline.length > 200) {
    errors.push('Headline must be less than 200 characters long')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates an array of source URLs
 */
export function validateSources(sources: string[]): ValidationResult {
  const errors: string[] = []

  if (!sources || sources.length === 0) {
    errors.push('At least one source is required')
    return { isValid: false, errors }
  }

  if (sources.length > 10) {
    errors.push('Maximum of 10 sources allowed')
  }

  // Remove duplicates
  const uniqueSources = [...new Set(sources)]
  
  // Validate each URL
  uniqueSources.forEach((source, index) => {
    const trimmedSource = source.trim()
    
    if (!isValidUrl(trimmedSource)) {
      errors.push(`Invalid URL format: ${source}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates a hot take (optional field)
 */
export function validateHotTake(hotTake?: string): ValidationResult {
  const errors: string[] = []

  // Hot take is optional, so undefined or empty string is valid
  if (!hotTake || hotTake.trim().length === 0) {
    return { isValid: true, errors: [] }
  }

  if (hotTake.length > 500) {
    errors.push('Hot take must be less than 500 characters long')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Checks if a status is a valid story status
 */
export function isValidStoryStatus(status: string): status is StoryStatus {
  const validStatuses: StoryStatus[] = ['draft', 'editing', 'generating', 'done', 'failed']
  return validStatuses.includes(status as StoryStatus)
}

/**
 * Validates URL format including internal URLs
 */
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    
    // Allow https and internal URLs
    if (urlObj.protocol !== 'https:') {
      return false
    }

    // Allow internal sources
    if (urlObj.hostname === 'internal') {
      return urlObj.pathname.length > 1 // Must have a path after /
    }

    // For external URLs, ensure hostname is valid
    if (urlObj.hostname.length === 0) {
      return false
    }

    // Reject javascript and other dangerous protocols
    if (url.toLowerCase().startsWith('javascript:')) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Sanitizes story input data
 */
export function sanitizeStoryInput(input: StoryInput): StoryInput {
  return {
    headline: input.headline?.trim() || '',
    hot_take: input.hot_take?.trim() || undefined,
    sources: input.sources?.map(source => source.trim()).filter(Boolean) || [],
  }
}

/**
 * Validates status transitions based on business rules
 */
export function validateStatusTransition(
  currentStatus: StoryStatus,
  newStatus: StoryStatus
): ValidationResult {
  const errors: string[] = []

  // Define valid transitions
  const validTransitions: Record<StoryStatus, StoryStatus[]> = {
    draft: ['editing', 'failed'],
    editing: ['generating', 'draft', 'failed'],
    generating: ['done', 'failed'],
    done: ['failed'], // Can only fail a completed video
    failed: ['draft', 'editing'], // Can restart from failed state
  }

  if (!validTransitions[currentStatus].includes(newStatus)) {
    errors.push(`Cannot transition from ${currentStatus} to ${newStatus}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}