'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StoryboardShot, Story, Storyboard, Asset } from '@/types'
import { StoryboardEditor } from '@/components/storyboard-editor'
import { StoryboardImages } from '@/components/storyboard-images'
import { 
  generateStoryboardAction,
  updateStoryboardAction,
  addShotToStoryboardAction,
  insertShotAtPositionAction,
  removeShotFromStoryboardAction
} from '@/app/actions/storyboard-actions'
import {
  generateStoryboardImagesAction,
  regenerateStoryboardImagesAction,
  generateImageForShotAction,
  getStoryImageAssetsAction
} from '@/app/actions/image-generation-actions'

interface StoryboardPageClientProps {
  story: Story
  storyboard: Storyboard | null
  storyId: string
  initialImages?: Asset[]
}

export function StoryboardPageClient({ story, storyboard: initialStoryboard, storyId, initialImages = [] }: StoryboardPageClientProps) {
  const [storyboard, setStoryboard] = useState<Storyboard | null>(initialStoryboard)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<Asset[]>(initialImages)
  const [isGeneratingImages, setIsGeneratingImages] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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

  const handleAddShot = async (newShot: StoryboardShot) => {
    setError(null)
    
    try {
      const result = await addShotToStoryboardAction(storyId, newShot)
      
      if (result.success) {
        setStoryboard(result.storyboard)
      } else {
        setError(result.error)
        throw new Error(result.error)
      }
    } catch (err) {
      setError('Failed to add shot to storyboard')
      throw err
    }
  }

  const handleInsertShot = async (position: number, newShot: StoryboardShot) => {
    setError(null)
    
    try {
      const result = await insertShotAtPositionAction(storyId, position, newShot)
      
      if (result.success) {
        setStoryboard(result.storyboard)
      } else {
        setError(result.error)
        throw new Error(result.error)
      }
    } catch (err) {
      setError('Failed to insert shot at position')
      throw err
    }
  }

  const handleRemoveShot = async (position: number) => {
    setError(null)
    
    try {
      const result = await removeShotFromStoryboardAction(storyId, position)
      
      if (result.success) {
        setStoryboard(result.storyboard)
      } else {
        setError(result.error)
        throw new Error(result.error)
      }
    } catch (err) {
      setError('Failed to remove shot from storyboard')
      throw err
    }
  }

  // Load images on component mount
  useEffect(() => {
    const loadImages = async () => {
      try {
        const result = await getStoryImageAssetsAction(storyId)
        if (result.success) {
          setImages(result.images)
        }
      } catch (err) {
        console.error('Failed to load images:', err)
      }
    }
    
    if (storyboard) {
      loadImages()
    }
  }, [storyId, storyboard])

  const handleGenerateImages = async () => {
    setIsGeneratingImages(true)
    setError(null)
    
    try {
      console.log('Starting image generation for story:', storyId)
      const result = await generateStoryboardImagesAction(storyId)
      
      console.log('Image generation result:', result)
      
      if (result.success) {
        setImages(result.images)
        console.log('Images set successfully:', result.images)
        setSuccessMessage(`Successfully generated ${result.totalGenerated} reference images!`)
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(result.error)
        console.error('Image generation error:', result.error)
      }
    } catch (err) {
      console.error('Image generation exception:', err)
      setError('Failed to generate images')
    } finally {
      setIsGeneratingImages(false)
    }
  }

  const handleRegenerateImages = async () => {
    setIsGeneratingImages(true)
    setError(null)
    
    try {
      const result = await regenerateStoryboardImagesAction(storyId)
      
      if (result.success) {
        setImages(result.images)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to regenerate images')
    } finally {
      setIsGeneratingImages(false)
    }
  }

  const handleGenerateImageForShot = async (shotIndex: number, promptText: string) => {
    setIsGeneratingImages(true)
    setError(null)
    
    try {
      const result = await generateImageForShotAction(storyId, shotIndex, promptText)
      
      if (result.success) {
        // Add the new image to the existing images
        setImages(prev => [...prev, result.image])
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to generate image for shot')
    } finally {
      setIsGeneratingImages(false)
    }
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

      {/* Success Display */}
      {successMessage && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <div className="mt-2 text-sm text-green-700">
                  {successMessage}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Storyboard Editor */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Storyboard Editor</h2>
              </div>
              <div className="p-6">
                <StoryboardEditor
                  story={story}
                  storyboard={storyboard}
                  onSave={handleSave}
                  onGenerate={handleGenerate}
                  onGenerateVideo={handleGenerateVideo}
                  onAddShot={handleAddShot}
                  onInsertShot={handleInsertShot}
                  onRemoveShot={handleRemoveShot}
                  isLoading={isGenerating}
                />
              </div>
            </div>
          </div>
          
          {/* Reference Images */}
          <div className="space-y-6">
            <StoryboardImages
              storyId={storyId}
              images={images}
              isGenerating={isGeneratingImages}
              onGenerateImages={storyboard ? handleGenerateImages : undefined}
              onRegenerateImages={handleRegenerateImages}
              onGenerateImageForShot={handleGenerateImageForShot}
              shotPrompts={storyboard?.shots.map(shot => shot.promptText) || []}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 