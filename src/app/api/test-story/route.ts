import { NextRequest, NextResponse } from 'next/server'
import { storyService } from '@/services/story-service'
import { scriptService } from '@/services/script-service'

export async function POST(request: NextRequest) {
  try {
    const { headline, hotTake, sources, script } = await request.json()
    
    // Create a test story
    const story = await storyService.createStory({
      headline: headline || 'Breaking: AI Breakthrough Revolutionizes Video Creation',
      hot_take: hotTake || 'This could change content creation forever',
      sources: sources || [
        'https://example.com/ai-breakthrough',
        'https://example.com/tech-news'
      ]
    })

    // Generate or set script
    if (script) {
      // Use provided script directly
      await scriptService.updateScript(story.id, script)
    } else {
      // Generate script using AI
      await scriptService.generateScript(story)
    }

    // Update story status to editing so it's ready for video generation
    const updatedStory = await storyService.updateStoryStatus(story.id, 'editing')

    return NextResponse.json({
      success: true,
      story: updatedStory,
      message: 'Test story created successfully'
    })
  } catch (error) {
    console.error('Test story creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create test story' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test story creation API endpoint',
    usage: 'POST with optional { "headline": "...", "hotTake": "...", "sources": [...], "script": "..." }'
  })
}