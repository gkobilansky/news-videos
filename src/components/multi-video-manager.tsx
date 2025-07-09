'use client'

import { useState, useEffect } from 'react'
import { Video, Story, Script } from '@/types'
import { getVideosForStoryAction, generateAdditionalVideoAction, reassembleVideoAction } from '@/app/actions/video-actions'

interface MultiVideoManagerProps {
  story: Story
  script: Script
}

export function MultiVideoManager({ story, script }: MultiVideoManagerProps) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reassembling, setReassembling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('gen3a_turbo')

  const loadVideos = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getVideosForStoryAction(story.id)
      if (result.success) {
        setVideos(result.videos)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load videos. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAdditionalVideo = async () => {
    try {
      setGenerating(true)
      setError(null)
      const result = await generateAdditionalVideoAction(story.id, selectedModel)
      if (result.success) {
        // Add the new video to the list
        setVideos(prev => [result.video, ...prev])
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to generate additional video. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleReassembleVideo = async () => {
    try {
      setReassembling(true)
      setError(null)
      const result = await reassembleVideoAction(story.id)
      if (result.success) {
        // Add the reassembled video to the list
        setVideos(prev => [result.video, ...prev])
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to reassemble video. Please try again.')
    } finally {
      setReassembling(false)
    }
  }

  useEffect(() => {
    loadVideos()
  }, [story.id])

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading videos...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Generation</h1>
        <p className="text-gray-600">
          Generate multiple videos from the same script with different AI-generated visuals
        </p>
      </div>

      {/* Story and Script Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{story.headline}</h2>
        {story.hot_take && (
          <p className="text-gray-700 mb-4">{story.hot_take}</p>
        )}
        
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Script ({script.text.split(' ').length} words)</h3>
          <p className="text-gray-800 leading-relaxed">{script.text}</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Model Selection and Generate Button */}
      <div className="mb-8">
        {story.status === 'failed' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <p className="text-orange-800 text-sm">
              <strong>Previous video generation failed.</strong> You can try generating a video again. 
              The failure might have been due to temporary issues like API rate limits or network problems.
            </p>
          </div>
        )}
        
        {/* Model Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AI Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={generating || story.status === 'generating'}
            className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="gen3a_turbo">Gen-3 Alpha Turbo (Recommended)</option>
            <option value="gen4_turbo">Gen-4 Turbo (Beta)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Gen-3 Alpha Turbo is more stable and cost-effective. Gen-4 Turbo offers higher quality but may have rate limits.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={handleGenerateAdditionalVideo}
            disabled={generating || story.status === 'generating' || reassembling}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              generating || story.status === 'generating' || reassembling
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : story.status === 'failed'
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {generating ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Video...
              </span>
            ) : videos.length === 0 ? (
              story.status === 'failed' ? 'Retry Video Generation' : 'Generate First Video'
            ) : (
              story.status === 'failed' ? 'Try Again' : 'Generate Another Video'
            )}
          </button>
          
          <button
            onClick={handleReassembleVideo}
            disabled={generating || story.status === 'generating' || reassembling}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              generating || story.status === 'generating' || reassembling
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            title="Reassemble video from existing assets without making new AI calls"
          >
            {reassembling ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reassembling...
              </span>
            ) : (
              '🔄 Reassemble Video'
            )}
          </button>
        </div>
        
        {story.status === 'generating' && (
          <p className="text-sm text-yellow-600 mt-2">
            Another video is currently being generated for this story. Please wait.
          </p>
        )}
        
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Reassemble Video:</strong> Use this to test video assembly with existing assets (audio, video, script) 
            without making new AI calls. Perfect for testing caption generation or FFmpeg changes.
          </p>
        </div>
      </div>

      {/* Videos List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900">
          Generated Videos ({videos.length})
        </h3>
        
        {videos.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">No videos generated yet</p>
            <p className="text-sm text-gray-400">
              Click "Generate First Video" to create your first video from this script
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Video {videos.length - index}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {video.duration_sec ? `${video.duration_sec}s` : 'Processing...'}
                  </span>
                </div>
                
                <div className="bg-gray-100 rounded-lg h-32 mb-3 flex items-center justify-center overflow-hidden">
                  {video.filepath ? (
                    <video
                      className="w-full h-full object-cover rounded-lg"
                      controls
                      preload="metadata"
                      poster="" // Optional: Add a poster image if available
                    >
                      <source 
                        src={`/api/videos/${video.filepath.split('/').pop() || video.filepath.split('\\').pop()}`} 
                        type="video/mp4" 
                      />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="text-gray-400 text-sm">Processing...</div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    onClick={() => {
                      // Download video logic
                      const filename = video.filepath.split('/').pop() || video.filepath.split('\\').pop()
                      const link = document.createElement('a')
                      link.href = `/api/videos/${filename}`
                      link.download = `story-${story.id}-video-${index + 1}.mp4`
                      link.click()
                    }}
                  >
                    Download
                  </button>
                  <button
                    className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      // Open video in new tab
                      const filename = video.filepath.split('/').pop() || video.filepath.split('\\').pop()
                      window.open(`/api/videos/${filename}`, '_blank')
                    }}
                  >
                    View
                  </button>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  Created {new Date(video.created_at).toLocaleDateString()} at{' '}
                  {new Date(video.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex gap-4">
        <a
          href={`/stories/${story.id}/script`}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Script
        </a>
        <a
          href="/stories"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Stories
        </a>
      </div>
    </div>
  )
} 