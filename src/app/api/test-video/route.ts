import { NextRequest, NextResponse } from 'next/server'
import { ffmpegService } from '@/services/ffmpeg-service'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { storyId, script, skipCaptions = false } = body

    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔧 DEBUG: Testing video assembly for story ${storyId}`)
    if (skipCaptions) {
      console.log(`⚠️ SKIP_CAPTIONS mode enabled - captions will not be applied`)
    }

    // Check available assets
    const audioPath = path.join(process.cwd(), 'assets', 'audio', `${storyId}.wav`)
    const videoDir = path.join(process.cwd(), 'assets', 'video')
    const captionPath = path.join(process.cwd(), 'assets', 'captions', `${storyId}.srt`)

    // Find available video files for this story
    const videoFiles = []
    try {
      const allVideoFiles = await fs.readdir(videoDir)
      const storyVideoFiles = allVideoFiles.filter(file => 
        file.includes(storyId) && file.endsWith('.mp4')
      )
      
      // Prefer storyboard clips if available
      const storyboardClips = storyVideoFiles
        .filter(file => file.includes('storyboard'))
        .sort() // Sort to get shot1, shot2, shot3 in order
      
      if (storyboardClips.length > 0) {
        videoFiles.push(...storyboardClips.map(file => path.join(videoDir, file)))
        console.log(`📹 Found ${storyboardClips.length} storyboard clips:`, storyboardClips)
      } else {
        // Fall back to other video files
        const otherVideoFiles = storyVideoFiles.filter(file => !file.includes('storyboard'))
        if (otherVideoFiles.length > 0) {
          videoFiles.push(path.join(videoDir, otherVideoFiles[0]))
          console.log(`📹 Using single video file:`, otherVideoFiles[0])
        }
      }
    } catch (error) {
      console.error('Error reading video directory:', error)
    }

    // Check if assets exist
    const assetChecks = await Promise.allSettled([
      fs.access(audioPath),
      ...videoFiles.map(file => fs.access(file)),
      skipCaptions ? Promise.resolve() : fs.access(captionPath)
    ])

    console.log(`🔍 Asset availability:`)
    console.log(`  Audio: ${audioPath} - ${assetChecks[0].status === 'fulfilled' ? '✅' : '❌'}`)
    videoFiles.forEach((file, index) => {
      console.log(`  Video ${index + 1}: ${path.basename(file)} - ${assetChecks[1 + index].status === 'fulfilled' ? '✅' : '❌'}`)
    })
    if (!skipCaptions) {
      console.log(`  Captions: ${captionPath} - ${assetChecks[assetChecks.length - 1].status === 'fulfilled' ? '✅' : '❌'}`)
    }

    if (assetChecks[0].status === 'rejected') {
      return NextResponse.json(
        { error: `Audio file not found: ${audioPath}` },
        { status: 404 }
      )
    }

    if (videoFiles.length === 0 || assetChecks.slice(1, 1 + videoFiles.length).some(check => check.status === 'rejected')) {
      return NextResponse.json(
        { error: `Video files not found for story ${storyId}` },
        { status: 404 }
      )
    }

    // Read caption file to show content
    let captionContent = 'Not available'
    if (!skipCaptions && assetChecks[assetChecks.length - 1].status === 'fulfilled') {
      try {
        captionContent = await fs.readFile(captionPath, 'utf-8')
        console.log(`📝 Caption file content (first 500 chars):`)
        console.log(captionContent.substring(0, 500) + '...')
      } catch (error) {
        console.error('Error reading caption file:', error)
      }
    }

    // Use provided script or try to read from caption file
    const finalScript = script || (!skipCaptions ? extractScriptFromCaptions(captionContent) : 'Test script for video without captions')
    console.log(`📄 Using script: "${finalScript}"`)

    if (skipCaptions) {
      // Special mode: generate video without captions for comparison
      console.log(`🎬 Starting video assembly WITHOUT captions...`)
      
      // Use FFmpeg directly for this special case
      const timestamp = Date.now()
      const outputPath = path.join(process.cwd(), 'output', `${storyId}-no-captions-${timestamp}.mp4`)
      
      // We'll need to implement this logic or modify the FFmpeg service
      // For now, let's use the regular service but skip caption generation
      const result = await ffmpegService.assembleVideo(storyId + '-no-captions', {
        audioFilepath: audioPath,
        videoFilepath: videoFiles,
        script: finalScript
      })
      
      const relativePath = path.relative(process.cwd(), result.filepath)
      
      return NextResponse.json({
        success: true,
        message: 'Video assembly completed successfully (without captions)',
        result: {
          filepath: relativePath,
          durationSec: result.durationSec,
          mode: 'no-captions',
          assetsUsed: {
            audio: path.relative(process.cwd(), audioPath),
            video: videoFiles.map(file => path.relative(process.cwd(), file)),
            captions: 'skipped'
          }
        }
      })
    }

    // Regular mode with captions
    console.log(`🎬 Starting video assembly with captions...`)
    const result = await ffmpegService.assembleVideo(storyId, {
      audioFilepath: audioPath,
      videoFilepath: videoFiles,
      script: finalScript
    })

    console.log(`✅ Video assembly completed: ${result.filepath}`)

    // Get relative path for response
    const relativePath = path.relative(process.cwd(), result.filepath)

    return NextResponse.json({
      success: true,
      message: 'Video assembly completed successfully',
      result: {
        filepath: relativePath,
        durationSec: result.durationSec,
        assetsUsed: {
          audio: path.relative(process.cwd(), audioPath),
          video: videoFiles.map(file => path.relative(process.cwd(), file)),
          captions: path.relative(process.cwd(), captionPath)
        },
        captionContent: captionContent.substring(0, 1000), // First 1000 chars for debugging
        videoUrl: `/api/videos/${path.basename(result.filepath)}` // Direct URL to the video
      }
    })

  } catch (error) {
    console.error('Test video assembly failed:', error)
    return NextResponse.json(
      { 
        error: 'Video assembly failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Extract script text from SRT caption content
function extractScriptFromCaptions(srtContent: string): string {
  const lines = srtContent.split('\n')
  const textLines = lines.filter(line => {
    const trimmed = line.trim()
    // Skip empty lines, sequence numbers, and timestamp lines
    return trimmed.length > 0 && 
           !trimmed.match(/^\d+$/) && 
           !trimmed.match(/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/)
  })
  
  return textLines.join(' ').trim()
}

export async function GET() {
  try {
    // List available stories for testing
    const outputDir = path.join(process.cwd(), 'output')
    const audioDir = path.join(process.cwd(), 'assets', 'audio')
    
    const [outputFiles, audioFiles] = await Promise.all([
      fs.readdir(outputDir),
      fs.readdir(audioDir)
    ])

    const availableStories = audioFiles
      .filter(file => file.endsWith('.wav'))
      .map(file => file.replace('.wav', ''))
      .slice(0, 10) // Limit to first 10 for readability

    return NextResponse.json({
      message: 'Test video assembly endpoint',
      usage: 'POST with { "storyId": "story-id", "script": "optional script text" }',
      availableStories: availableStories,
      outputVideos: outputFiles.filter(file => file.endsWith('.mp4')).slice(0, 10)
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list available stories' },
      { status: 500 }
    )
  }
}