import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    
    // Security: Only allow specific file extensions
    if (!filename.endsWith('.mp4') && !filename.endsWith('.mov') && !filename.endsWith('.avi')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
    
    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    // Construct the full path to the video file
    const outputDir = join(process.cwd(), 'output')
    const filepath = join(outputDir, filename)
    
    // Check if file exists
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }
    
    // Get file stats
    const stats = await stat(filepath)
    const fileSize = stats.size
    
    // Handle range requests for video streaming
    const range = request.headers.get('range')
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = end - start + 1
      
      const file = await readFile(filepath)
      const buffer = file.slice(start, end + 1)
      
      return new NextResponse(buffer, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4',
        },
      })
    } else {
      // Serve the entire file
      const file = await readFile(filepath)
      
      return new NextResponse(file, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
        },
      })
    }
  } catch (error) {
    console.error('Error serving video:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 