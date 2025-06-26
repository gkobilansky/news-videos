'use client'

import React, { useState } from 'react'
import { createStoryRaw } from '@/app/actions/story-actions'
import { validateStoryInput } from '@/lib/story-validation'
import type { StoryInput } from '@/types'

interface FormErrors {
  headline?: string
  hot_take?: string
  sources?: string
  submit?: string
}

interface StoryCreationFormProps {
  onSuccess?: (storyId: string) => void
}

export function StoryCreationForm({ onSuccess }: StoryCreationFormProps) {
  const [formData, setFormData] = useState<StoryInput>({
    headline: '',
    hot_take: '',
    sources: [],
  })
  
  const [sourcesText, setSourcesText] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field: keyof StoryInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear field-specific errors when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSourcesChange = (value: string) => {
    setSourcesText(value)
    
    // Parse sources from textarea (split by newlines, filter empty)
    const sources = value
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)
    
    setFormData(prev => ({ ...prev, sources }))
    
    // Clear sources errors when user starts typing
    if (errors.sources) {
      setErrors(prev => ({ ...prev, sources: undefined }))
    }
  }

  const validateField = (field: keyof StoryInput, value: any): string | undefined => {
    const testData = { ...formData, [field]: value }
    const validation = validateStoryInput(testData)
    
    if (!validation.isValid) {
      // Return the first error for this field
      const fieldError = validation.errors.find(error => {
        const lowerError = error.toLowerCase()
        if (field === 'headline') return lowerError.includes('headline')
        if (field === 'hot_take') return lowerError.includes('hot take')
        if (field === 'sources') return lowerError.includes('source') || lowerError.includes('url')
        return false
      })
      return fieldError
    }
    
    return undefined
  }

  const handleBlur = (field: keyof StoryInput) => {
    const value = field === 'sources' ? formData.sources : formData[field]
    const error = validateField(field, value)
    
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate entire form
    const validation = validateStoryInput(formData)
    
    if (!validation.isValid) {
      const newErrors: FormErrors = {}
      
      validation.errors.forEach(error => {
        const lowerError = error.toLowerCase()
        if (lowerError.includes('headline')) {
          newErrors.headline = error
        } else if (lowerError.includes('hot take')) {
          newErrors.hot_take = error
        } else if (lowerError.includes('source')) {
          newErrors.sources = error
        }
      })
      
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const result = await createStoryRaw(formData)
      
      if (result.success) {
        // Reset form on success
        setFormData({ headline: '', hot_take: '', sources: [] })
        setSourcesText('')
        
        onSuccess?.(result.story.id)
      } else {
        setErrors({ submit: result.error })
      }
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create story' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      {/* Headline Field */}
      <div>
        <label htmlFor="headline" className="block text-sm font-medium text-gray-700 mb-2">
          Headline *
        </label>
        <input
          type="text"
          id="headline"
          value={formData.headline}
          onChange={(e) => handleInputChange('headline', e.target.value)}
          onBlur={() => handleBlur('headline')}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.headline ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter your story headline..."
          disabled={isSubmitting}
        />
        {errors.headline && (
          <p className="mt-1 text-sm text-red-600">{errors.headline}</p>
        )}
      </div>

      {/* Hot Take Field */}
      <div>
        <label htmlFor="hot_take" className="block text-sm font-medium text-gray-700 mb-2">
          Hot Take
        </label>
        <textarea
          id="hot_take"
          value={formData.hot_take}
          onChange={(e) => handleInputChange('hot_take', e.target.value)}
          onBlur={() => handleBlur('hot_take')}
          rows={3}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.hot_take ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Add your perspective or hot take on the story..."
          disabled={isSubmitting}
        />
        {errors.hot_take && (
          <p className="mt-1 text-sm text-red-600">{errors.hot_take}</p>
        )}
      </div>

      {/* Sources Field */}
      <div>
        <label htmlFor="sources" className="block text-sm font-medium text-gray-700 mb-2">
          Sources *
        </label>
        <textarea
          id="sources"
          value={sourcesText}
          onChange={(e) => handleSourcesChange(e.target.value)}
          onBlur={() => handleBlur('sources')}
          rows={4}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.sources ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter source URLs (one per line)&#10;https://example.com/article1&#10;https://example.com/article2"
          disabled={isSubmitting}
        />
        {errors.sources && (
          <p className="mt-1 text-sm text-red-600">{errors.sources}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Enter one URL per line. Use https://internal/&lt;id&gt; for internal sources.
        </p>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating Story...' : 'Create Story'}
        </button>
      </div>
    </form>
  )
}