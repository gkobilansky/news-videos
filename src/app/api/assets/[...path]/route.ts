import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    
    // Reconstruct the file path
    const filePath = path.join(process.cwd(), 'assets', ...pathSegments)
    
    // Security check: ensure the path is within the assets directory
    const assetsDir = path.join(process.cwd(), 'assets')
    const resolvedPath = path.resolve(filePath)
    const resolvedAssetsDir = path.resolve(assetsDir)
    
    if (!resolvedPath.startsWith(resolvedAssetsDir)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    
    // Check if file exists
    try {
      await fs.access(resolvedPath)
    } catch {
      return new NextResponse('Not Found', { status: 404 })
    }
    
    // Read the file
    const fileBuffer = await fs.readFile(resolvedPath)
    
    // Determine content type based on file extension
    const ext = path.extname(resolvedPath).toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.webp':
        contentType = 'image/webp'
        break
      case '.svg':
        contentType = 'image/svg+xml'
        break
      case '.mp4':
        contentType = 'video/mp4'
        break
      case '.wav':
        contentType = 'audio/wav'
        break
      case '.mp3':
        contentType = 'audio/mpeg'
        break
      case '.srt':
        contentType = 'text/plain'
        break
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving asset:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}