'use client'

import { useState, useEffect } from 'react'
import { Asset } from '@/types'
import Image from 'next/image'
import path from 'path'

interface StoryboardImagesProps {
  storyId: string
  images: Asset[]
  isGenerating?: boolean
  onGenerateImages?: () => Promise<void>
  onRegenerateImages?: () => Promise<void>
  onGenerateImageForShot?: (shotIndex: number, promptText: string) => Promise<void>
  shotPrompts?: string[]
}

export function StoryboardImages({ 
  storyId, 
  images, 
  isGenerating = false, 
  onGenerateImages, 
  onRegenerateImages,
  onGenerateImageForShot,
  shotPrompts = []
}: StoryboardImagesProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  // Group images by shot index from metadata
  const imagesByShot = images.reduce((acc, image) => {
    const shotIndex = image.metadata?.shotIndex || 0
    if (!acc[shotIndex]) {
      acc[shotIndex] = []
    }
    acc[shotIndex].push(image)
    return acc
  }, {} as Record<number, Asset[]>)

  const handleImageError = (imagePath: string) => {
    setImageErrors(prev => new Set([...prev, imagePath]))
  }

  const getImageUrl = (asset: Asset): string => {
    // Convert relative path to API route URL
    // Remove leading slash if present and remove assets prefix since API route handles it
    const cleanPath = asset.filepath.startsWith('/') ? asset.filepath.slice(1) : asset.filepath
    // Remove 'assets/' prefix if present since our API route expects paths relative to assets
    const pathWithoutAssets = cleanPath.startsWith('assets/') ? cleanPath.slice(7) : cleanPath
    // Add cache-busting timestamp to prevent browser caching issues
    const timestamp = asset.created_at ? new Date(asset.created_at).getTime() : Date.now()
    return `/api/assets/${pathWithoutAssets}?t=${timestamp}`
  }

  const hasImages = images.length > 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Reference Images
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {images.length} image{images.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            {hasImages && onRegenerateImages && (
              <button
                onClick={onRegenerateImages}
                disabled={isGenerating}
                className="px-3 py-1 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Regenerating...' : 'Regenerate All'}
              </button>
            )}
            {!hasImages && onGenerateImages && (
              <button
                onClick={() => {
                  console.log('Generate Images button clicked')
                  onGenerateImages()
                }}
                disabled={isGenerating}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : 'Generate Images'}
              </button>
            )}
          </div>
        </div>
      </div>

      {!hasImages && !isGenerating && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">No reference images generated yet</p>
          <p className="text-sm text-gray-500">
            Generate reference images to visualize your storyboard shots before creating videos
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-900 font-medium mb-2">Generating reference images...</p>
          <p className="text-gray-600 text-sm">This may take a few moments. AI is creating images for each shot.</p>
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      )}

      {hasImages && (
        <div className="space-y-6">
          {Object.entries(imagesByShot)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([shotIndex, shotImages]) => (
              <div key={shotIndex} className="bg-gray-50 border border-gray-200 rounded-lg p-4 border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-medium text-gray-800">
                    Shot {shotIndex}
                  </h4>
                  {onGenerateImageForShot && shotPrompts[parseInt(shotIndex) - 1] && (
                    <button
                      onClick={() => onGenerateImageForShot(parseInt(shotIndex), shotPrompts[parseInt(shotIndex) - 1])}
                      disabled={isGenerating}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shotImages.map((image, index) => (
                    <div key={image.id} className="relative group">
                      <div className="aspect-[9/16] bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                        {!imageErrors.has(image.filepath) ? (
                          <Image
                            src={getImageUrl(image)}
                            alt={`Shot ${shotIndex} reference image ${index + 1}`}
                            fill
                            className="object-cover cursor-pointer group-hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedImage(getImageUrl(image))}
                            onError={() => handleImageError(image.filepath)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Image metadata overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-xs rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="truncate">
                          {image.metadata?.promptText || 'No prompt text'}
                        </p>
                        <p className="text-gray-300">
                          {image.metadata?.duration || 5}s · {image.metadata?.camera?.movement || 'static'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal for viewing larger image */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 text-white hover:text-gray-300 z-10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Image
              src={selectedImage}
              alt="Reference image preview"
              width={800}
              height={1200}
              className="object-contain max-h-[85vh] rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}