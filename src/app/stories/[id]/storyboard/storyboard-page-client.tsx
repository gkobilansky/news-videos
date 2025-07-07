'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StoryboardShot, Story, Storyboard } from '@/types'
import { StoryboardEditor } from '@/components/storyboard-editor'
import { 
  generateStoryboardAction,
  updateStoryboardAction 
} from '@/app/actions/storyboard-actions'

interface StoryboardPageClientProps {
  story: Story
  storyboard: Storyboard | null
  storyId: string
}

export function StoryboardPageClient({ story, storyboard: initialStoryboard, storyId }: StoryboardPageClientProps) {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(initialStoryboard)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const result = await generateStoryboardAction(storyId)
      
      if (result.success) {
        setStoryboard(result.storyboard)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async (shots: StoryboardShot[]) => {
    setError(null)
    
    try {
      const result = await updateStoryboardAction(storyId, shots)
      
      if (result.success) {
        setStoryboard(result.storyboard)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to save storyboard')
      throw err // Re-throw to let the component handle loading states
    }
  }

  const handleGenerateVideo = () => {
    router.push(`/stories/${storyId}/generate`)
  }

  return (
    <div>
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <nav className="flex items-center space-x-4 text-sm">
            <a href="/stories" className="text-gray-500 hover:text-gray-700">
              Stories
            </a>
            <span className="text-gray-400">/</span>
            <a href={`/stories/${storyId}/script`} className="text-gray-500 hover:text-gray-700">
              Script
            </a>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 font-medium">Storyboard</span>
          </nav>
          
          <div className="flex items-center gap-3">
            <a
              href={`/stories/${storyId}/script`}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Back to Script
            </a>
            {storyboard && (
              <button
                onClick={handleGenerateVideo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Generate Video →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storyboard Editor */}
      <StoryboardEditor
        story={story}
        storyboard={storyboard}
        onSave={handleSave}
        onGenerate={handleGenerate}
        onGenerateVideo={handleGenerateVideo}
        isLoading={isGenerating}
      />
    </div>
  )
} 