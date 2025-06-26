import { StoryInput, StoryStatus } from '@/types'
import {
  validateStoryInput,
  validateHeadline,
  validateSources,
  validateHotTake,
  isValidStoryStatus,
  sanitizeStoryInput,
  validateStatusTransition,
} from '../story-validation'

describe('Story Validation', () => {
  describe('validateStoryInput', () => {
    it('should validate a complete story input successfully', () => {
      const validInput: StoryInput = {
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        hot_take: 'This could revolutionize how we work with AI systems.',
        sources: ['https://techcrunch.com/news', 'https://reuters.com/tech'],
      }

      const result = validateStoryInput(validInput)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation when headline is missing', () => {
      const invalidInput: Partial<StoryInput> = {
        hot_take: 'This could revolutionize how we work with AI systems.',
        sources: ['https://techcrunch.com/news'],
      }

      const result = validateStoryInput(invalidInput as StoryInput)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Headline is required')
    })

    it('should fail validation when sources array is empty', () => {
      const invalidInput: StoryInput = {
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        sources: [],
      }

      const result = validateStoryInput(invalidInput)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('At least one source is required')
    })

    it('should pass validation when hot_take is optional', () => {
      const validInput: StoryInput = {
        headline: 'Breaking: Major Tech Company Announces AI Breakthrough',
        sources: ['https://techcrunch.com/news'],
        // hot_take is optional
      }

      const result = validateStoryInput(validInput)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should collect multiple validation errors', () => {
      const invalidInput: Partial<StoryInput> = {
        headline: '', // Invalid: empty headline
        sources: [], // Invalid: empty sources
      }

      const result = validateStoryInput(invalidInput as StoryInput)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
      expect(result.errors).toContain('Headline is required')
      expect(result.errors).toContain('At least one source is required')
    })
  })

  describe('validateHeadline', () => {
    it('should validate a proper headline', () => {
      const validHeadline = 'Breaking: Major Tech Company Announces AI Breakthrough'

      const result = validateHeadline(validHeadline)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for empty headline', () => {
      const emptyHeadline = ''

      const result = validateHeadline(emptyHeadline)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Headline is required')
    })

    it('should fail validation for headline that is too short', () => {
      const shortHeadline = 'AI'

      const result = validateHeadline(shortHeadline)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Headline must be at least 10 characters long')
    })

    it('should fail validation for headline that is too long', () => {
      const longHeadline = 'A'.repeat(201) // 201 characters

      const result = validateHeadline(longHeadline)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Headline must be less than 200 characters long')
    })

    it('should handle headline with whitespace', () => {
      const headlineWithWhitespace = '  Breaking: Major Tech News  '

      const result = validateHeadline(headlineWithWhitespace)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for whitespace-only headline', () => {
      const whitespaceHeadline = '   '

      const result = validateHeadline(whitespaceHeadline)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Headline is required')
    })
  })

  describe('validateSources', () => {
    it('should validate an array of valid URLs', () => {
      const validSources = [
        'https://techcrunch.com/news',
        'https://reuters.com/tech',
        'https://internal/123'
      ]

      const result = validateSources(validSources)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for empty sources array', () => {
      const emptySources: string[] = []

      const result = validateSources(emptySources)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('At least one source is required')
    })

    it('should fail validation for invalid URL formats', () => {
      const invalidSources = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'https://',
        'javascript:alert(1)'
      ]

      const result = validateSources(invalidSources)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => error.includes('Invalid URL format'))).toBe(true)
    })

    it('should allow internal sources with https://internal/ format', () => {
      const internalSources = [
        'https://internal/123',
        'https://internal/story-456',
        'https://techcrunch.com/news'
      ]

      const result = validateSources(internalSources)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for too many sources', () => {
      const tooManySources = Array.from({ length: 11 }, (_, i) => 
        `https://example${i}.com/news`
      )

      const result = validateSources(tooManySources)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Maximum of 10 sources allowed')
    })

    it('should handle duplicate sources', () => {
      const sourcesWithDuplicates = [
        'https://techcrunch.com/news',
        'https://reuters.com/tech',
        'https://techcruch.com/news', // duplicate
      ]

      const result = validateSources(sourcesWithDuplicates)

      // Should still validate the unique sources
      expect(result.isValid).toBe(true)
    })
  })

  describe('validateHotTake', () => {
    it('should validate a proper hot take', () => {
      const validHotTake = 'This could revolutionize how we work with AI systems.'

      const result = validateHotTake(validHotTake)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should pass validation when hot take is undefined', () => {
      const result = validateHotTake(undefined)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should pass validation when hot take is empty string', () => {
      const result = validateHotTake('')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for hot take that is too long', () => {
      const longHotTake = 'A'.repeat(501) // 501 characters

      const result = validateHotTake(longHotTake)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Hot take must be less than 500 characters long')
    })
  })

  describe('isValidStoryStatus', () => {
    it('should validate all valid story statuses', () => {
      const validStatuses: StoryStatus[] = ['draft', 'editing', 'generating', 'done', 'failed']

      validStatuses.forEach(status => {
        const result = isValidStoryStatus(status)
        expect(result).toBe(true)
      })
    })

    it('should reject invalid story statuses', () => {
      const invalidStatuses = ['pending', 'completed', 'error', 'processing', '']

      invalidStatuses.forEach(status => {
        const result = isValidStoryStatus(status)
        expect(result).toBe(false)
      })
    })
  })

  describe('sanitizeStoryInput', () => {
    it('should trim whitespace from all fields', () => {
      const inputWithWhitespace: StoryInput = {
        headline: '  Breaking: Major Tech News  ',
        hot_take: '  This is a hot take  ',
        sources: [' https://example.com ', ' https://news.com '],
      }

      const result = sanitizeStoryInput(inputWithWhitespace)

      expect(result.headline).toBe('Breaking: Major Tech News')
      expect(result.hot_take).toBe('This is a hot take')
      expect(result.sources).toEqual(['https://example.com', 'https://news.com'])
    })

    it('should handle empty hot_take', () => {
      const input: StoryInput = {
        headline: 'Breaking News',
        hot_take: '',
        sources: ['https://example.com'],
      }

      const result = sanitizeStoryInput(input)

      expect(result.hot_take).toBeUndefined()
    })

    it('should filter out empty sources', () => {
      const input: StoryInput = {
        headline: 'Breaking News',
        sources: ['https://example.com', '', ' ', 'https://news.com'],
      }

      const result = sanitizeStoryInput(input)

      expect(result.sources).toEqual(['https://example.com', 'https://news.com'])
    })
  })

  describe('validateStatusTransition', () => {
    it('should allow valid status transitions', () => {
      const validTransitions: Array<[StoryStatus, StoryStatus]> = [
        ['draft', 'editing'],
        ['editing', 'generating'],
        ['generating', 'done'],
        ['generating', 'failed'],
        ['failed', 'draft'],
      ]

      validTransitions.forEach(([from, to]) => {
        const result = validateStatusTransition(from, to)
        expect(result.isValid).toBe(true)
      })
    })

    it('should reject invalid status transitions', () => {
      const invalidTransitions: Array<[StoryStatus, StoryStatus]> = [
        ['done', 'draft'],
        ['done', 'editing'],
        ['done', 'generating'],
        ['draft', 'generating'],
        ['draft', 'done'],
      ]

      invalidTransitions.forEach(([from, to]) => {
        const result = validateStatusTransition(from, to)
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })
  })
})