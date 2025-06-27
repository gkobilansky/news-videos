import { generateVideoAction } from '@/app/actions/video-actions'
import { getStoryWithScriptAction } from '@/app/actions/script-actions'
import { notFound, redirect } from 'next/navigation'

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

  // Check if story has a script before generating
  if (!script) {
    redirect(`/stories/${id}/script`)
  }

  // If already generating or done, redirect to story dashboard
  if (story.status === 'generating' || story.status === 'done') {
    redirect('/stories')
  }

  // Start video generation
  const videoResult = await generateVideoAction(id)
  
  if (videoResult.success) {
    redirect('/stories')
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Video Generation Failed</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{videoResult.error}</p>
        </div>
        <div className="flex gap-4">
          <a 
            href={`/stories/${id}/script`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Script
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