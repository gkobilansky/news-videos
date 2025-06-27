import { getStoryWithScriptAction } from '@/app/actions/script-actions'
import { MultiVideoManager } from '@/components/multi-video-manager'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GeneratePage({ params }: PageProps) {
  const { id } = await params
  const storyResult = await getStoryWithScriptAction(id)
  
  if (!storyResult.success) {
    notFound()
  }

  const { story, script } = storyResult

  // Check if story has a script before showing video generation
  if (!script) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Script Required</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">A script is required before generating videos.</p>
          </div>
          <div className="flex gap-4">
            <a 
              href={`/stories/${id}/script`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Script
            </a>
            <a 
              href="/stories"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Stories
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <MultiVideoManager story={story} script={script} />
    </div>
  )
}