'use client'

import { useRouter } from 'next/navigation'
import { StoryCreationForm } from '@/components/story-creation-form'

export default function NewStoryPage() {
  const router = useRouter()

  const handleSuccess = (storyId: string) => {
    // Redirect to story script editing page after successful creation
    router.push(`/stories/${storyId}/script`)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Story</h1>
          <p className="mt-2 text-gray-600">
            Enter your headline, optional hot take, and source links to create a new vertical newsbite video.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <StoryCreationForm onSuccess={handleSuccess} />
        </div>

        {/* Back Link */}
        <div className="mt-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-500 text-sm font-medium"
          >
            ← Back to Stories
          </button>
        </div>
      </div>
    </div>
  )
}