import { NextRequest, NextResponse } from 'next/server'
import { generateVideoAction } from '@/app/actions/video-actions'

export async function POST(request: NextRequest) {
  try {
    const { storyId } = await request.json()
    
    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      )
    }

    const result = await generateVideoAction(storyId)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        video: result.video,
        message: 'Video generation completed successfully'
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Video generation API endpoint',
    usage: 'POST with { "storyId": "your-story-id" }'
  })
}