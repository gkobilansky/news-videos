import { notFound } from 'next/navigation'
import { 
  getStoryWithStoryboardAction
} from '@/app/actions/storyboard-actions'
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

  return (
    <div className="min-h-screen bg-gray-50">
      <StoryboardPageClient 
        story={story} 
        storyboard={storyboard} 
        storyId={id}
      />
    </div>
  )
} 