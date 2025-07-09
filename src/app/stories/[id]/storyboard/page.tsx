import { notFound } from 'next/navigation'
import { 
  getStoryWithStoryboardAction
} from '@/app/actions/storyboard-actions'
import { getStoryImageAssetsAction } from '@/app/actions/image-generation-actions'
import { StoryboardPageClient } from './storyboard-page-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StoryboardPage({ params }: PageProps) {
  const { id } = await params
  const result = await getStoryWithStoryboardAction(id)
  
  if (!result.success) {
    notFound()
  }

  const { story, storyboard } = result

  // Load existing images if storyboard exists
  let initialImages: any[] = []
  if (storyboard) {
    try {
      const imagesResult = await getStoryImageAssetsAction(id)
      if (imagesResult.success) {
        initialImages = imagesResult.images
      }
    } catch (error) {
      console.error('Failed to load initial images:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StoryboardPageClient 
        story={story} 
        storyboard={storyboard} 
        storyId={id}
        initialImages={initialImages}
      />
    </div>
  )
} 