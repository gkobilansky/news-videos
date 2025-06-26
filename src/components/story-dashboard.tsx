'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getAllStoriesAction } from '@/app/actions/story-actions'
import { Story, StoryStatus } from '@/types'

const STATUS_STYLES: Record<StoryStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  editing: 'bg-yellow-100 text-yellow-800',
  generating: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const FILTER_OPTIONS: Array<{ label: string; value: StoryStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Editing', value: 'editing' },
  { label: 'Generating', value: 'generating' },
  { label: 'Done', value: 'done' },
  { label: 'Failed', value: 'failed' },
]

export function StoryDashboard() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<StoryStatus | 'all'>('all')

  const loadStories = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getAllStoriesAction()
      if (result.success) {
        setStories(result.stories)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load stories. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStories()
  }, [])

  const filteredStories = stories.filter(story => 
    activeFilter === 'all' || story.status === activeFilter
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stories...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading stories</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadStories}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No stories found</h2>
          <p className="text-gray-600 mb-4">Create your first story to get started</p>
          <Link
            href="/stories/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors inline-block"
          >
            Create New Story
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Stories</h1>
          <Link
            href="/stories/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            New Story
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                activeFilter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Stories List */}
        <div className="space-y-3">
          {filteredStories.map((story) => (
            <div
              key={story.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/stories/${story.id}/script`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors no-underline block mb-2"
                    >
                      {story.headline}
                    </Link>
                    {story.hot_take && (
                      <p className="text-gray-600 text-sm mb-2 leading-relaxed">
                        {story.hot_take}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{story.sources.length} source{story.sources.length !== 1 ? 's' : ''}</span>
                      <span>Created {new Date(story.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[story.status]}`}>
                    {story.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}