'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Story, Script } from '@/types'
import { 
  generateScriptAction, 
  updateScriptAction, 
  getStoryWithScriptAction 
} from '@/app/actions/script-actions'

export default function ScriptPage() {
  const params = useParams()
  const router = useRouter()
  const storyId = params.id as string

  const [story, setStory] = useState<Story | null>(null)
  const [script, setScript] = useState<Script | null>(null)
  const [scriptText, setScriptText] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load story and script data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const result = await getStoryWithScriptAction(storyId)

        if (!result.success) {
          setError(result.error)
          return
        }

        setStory(result.story)
        setScript(result.script)
        setScriptText(result.script?.text || '')
      } catch (err) {
        setError('Failed to load story data')
        console.error('Error loading story:', err)
      } finally {
        setLoading(false)
      }
    }

    if (storyId) {
      loadData()
    }
  }, [storyId])

  // Generate script using OpenAI
  const handleGenerateScript = async () => {
    if (!story) return

    try {
      setGenerating(true)
      setError(null)

      const result = await generateScriptAction(story.id)

      if (!result.success) {
        setError(result.error)
        return
      }

      setScript(result.script)
      setScriptText(result.script.text)
      setStory({ ...story, status: 'editing' })
    } catch (err) {
      setError('Failed to generate script. Please try again.')
      console.error('Error generating script:', err)
    } finally {
      setGenerating(false)
    }
  }

  // Save script changes
  const handleSaveScript = async () => {
    if (!story || !scriptText.trim()) return

    try {
      setSaving(true)
      setError(null)

      const result = await updateScriptAction(story.id, scriptText)

      if (!result.success) {
        setError(result.error)
        return
      }

      setScript(result.script)
    } catch (err) {
      setError('Failed to save script. Please try again.')
      console.error('Error saving script:', err)
    } finally {
      setSaving(false)
    }
  }

  // Calculate word count and validation
  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).filter(Boolean).length : 0
  const isValidLength = wordCount <= 45
  const hasChanges = script && script.text.trim() !== scriptText.trim()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  if (error && !story) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-red-600 text-center mb-4">{error}</div>
          <button
            onClick={() => router.push('/stories')}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700"
          >
            Back to Stories
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Back to Stories
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Script Editor</h1>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{story?.headline}</h2>
            {story?.hot_take && (
              <p className="text-gray-600 italic">"{story.hot_take}"</p>
            )}
            <div className="mt-2 text-sm text-gray-500">
              Sources: {story?.sources.length || 0}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && story && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Script Generation/Editing */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {!script ? (
            // No script exists - show generation option
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Generate Script with AI
              </h3>
              <p className="text-gray-600 mb-6">
                Create a 10-15 second script (max 45 words) using OpenAI based on your headline and sources.
              </p>
              <button
                onClick={handleGenerateScript}
                disabled={generating}
                className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate Script'}
              </button>
            </div>
          ) : (
            // Script exists - show editor
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Edit Script</h3>
                <div className="text-sm text-gray-600">
                  <span className={wordCount > 45 ? 'text-red-600 font-semibold' : ''}>
                    {wordCount} / 45 words
                  </span>
                </div>
              </div>

              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Enter your script here..."
                className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {!isValidLength && (
                <p className="text-red-600 text-sm mt-2">
                  Script too long! Please keep it under 45 words for a 10-15 second video.
                </p>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSaveScript}
                  disabled={saving || !isValidLength || !scriptText.trim()}
                  className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Save Script'}
                </button>

                <button
                  onClick={handleGenerateScript}
                  disabled={generating}
                  className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {generating ? 'Regenerating...' : 'Regenerate with AI'}
                </button>
              </div>
              
              {/* Debug info */}
              <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
                <div>Current word count: {wordCount}</div>
                <div>Has changes: {hasChanges ? 'Yes' : 'No'}</div>
                <div>Valid length: {isValidLength ? 'Yes' : 'No'}</div>
                <div>Script text length: {scriptText.length} characters</div>
                <div>Original script length: {script?.text?.length || 0} characters</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {script && (
          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => router.push('/stories')}
              className="bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700"
            >
              Back to Stories
            </button>
            
            <button
              onClick={() => router.push(`/stories/${storyId}/storyboard`)}
              disabled={wordCount === 0}
              className="bg-purple-600 text-white py-2 px-6 rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue to Storyboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}