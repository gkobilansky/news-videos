#!/usr/bin/env node

/**
 * CLI tool for reassembling existing videos without making AI calls
 * Usage: npm run reassemble <story-id>
 * 
 * This tool will:
 * 1. Find existing assets (audio, video, script)
 * 2. Reassemble them using the FFmpeg service
 * 3. Test the caption generation refactoring
 */

import { ffmpegService } from '../src/services/ffmpeg-service'
import { storyService } from '../src/services/story-service'
import fs from 'fs/promises'
import path from 'path'

interface AssetInfo {
  storyId: string
  audioFile?: string
  videoFiles: string[]
  script?: string
  hasStoryboard: boolean
}

async function findExistingAssets(storyId: string): Promise<AssetInfo> {
  const assetsPath = path.join(process.cwd(), 'assets')
  const audioPath = path.join(assetsPath, 'audio')
  const videoPath = path.join(assetsPath, 'video')
  
  const info: AssetInfo = {
    storyId,
    videoFiles: [],
    hasStoryboard: false
  }
  
  // Find audio file
  try {
    const audioFile = path.join(audioPath, `${storyId}.wav`)
    await fs.access(audioFile)
    info.audioFile = audioFile
    console.log(`✅ Found audio: ${audioFile}`)
  } catch {
    console.log(`❌ No audio file found for ${storyId}`)
  }
  
  // Find video files
  try {
    const videoFiles = await fs.readdir(videoPath)
    
    // Look for storyboard shots first (newer format)
    const storyboardShots = videoFiles
      .filter(file => file.startsWith(`${storyId}-storyboard-shot`) && file.endsWith('.mp4'))
      .sort()
      .map(file => path.join(videoPath, file))
    
    if (storyboardShots.length > 0) {
      info.videoFiles = storyboardShots
      info.hasStoryboard = true
      console.log(`✅ Found ${storyboardShots.length} storyboard shots:`)
      storyboardShots.forEach(file => console.log(`   - ${path.basename(file)}`))
    } else {
      // Look for legacy single video files
      const singleVideoFiles = videoFiles
        .filter(file => file.startsWith(storyId) && file.endsWith('.mp4') && !file.includes('-storyboard-'))
        .map(file => path.join(videoPath, file))
      
      if (singleVideoFiles.length > 0) {
        info.videoFiles = singleVideoFiles
        console.log(`✅ Found ${singleVideoFiles.length} video files:`)
        singleVideoFiles.forEach(file => console.log(`   - ${path.basename(file)}`))
      }
    }
  } catch (error) {
    console.log(`❌ Error reading video directory: ${error}`)
  }
  
  return info
}

async function getScriptFromDatabase(storyId: string): Promise<string | null> {
  try {
    const story = await storyService.getStory(storyId)
    if (!story) {
      console.log(`❌ Story not found in database: ${storyId}`)
      return null
    }
    
    const script = await storyService.getLatestScript(storyId)
    if (!script) {
      console.log(`❌ No script found for story: ${storyId}`)
      return null
    }
    
    console.log(`✅ Found script: "${script.text}"`)
    return script.text
  } catch (error) {
    console.log(`❌ Error fetching script: ${error}`)
    return null
  }
}

async function reassembleVideo(storyId: string): Promise<void> {
  console.log(`🎬 Starting video reassembly for story: ${storyId}`)
  console.log(`📋 This will test the refactored caption generation using subtitle library`)
  console.log()
  
  // Find existing assets
  const assets = await findExistingAssets(storyId)
  
  if (!assets.audioFile) {
    console.log(`❌ Missing audio file - cannot reassemble`)
    return
  }
  
  if (assets.videoFiles.length === 0) {
    console.log(`❌ No video files found - cannot reassemble`)
    return
  }
  
  // Get script from database
  const script = await getScriptFromDatabase(storyId)
  if (!script) {
    console.log(`❌ Missing script - cannot reassemble`)
    return
  }
  
  console.log()
  console.log(`📦 Ready to reassemble:`)
  console.log(`   Audio: ${path.basename(assets.audioFile)}`)
  console.log(`   Video: ${assets.videoFiles.length} files (${assets.hasStoryboard ? 'storyboard' : 'single'})`)
  console.log(`   Script: "${script}"`)
  console.log()
  
  try {
    // Prepare assets for FFmpeg service
    const videoAssemblyAssets = {
      audioFilepath: assets.audioFile,
      videoFilepath: assets.videoFiles.length === 1 ? assets.videoFiles[0] : assets.videoFiles,
      script: script
    }
    
    console.log(`🚀 Starting video assembly...`)
    const result = await ffmpegService.assembleVideo(storyId, videoAssemblyAssets)
    
    console.log()
    console.log(`✅ Video reassembly completed successfully!`)
    console.log(`📁 Output file: ${result.filepath}`)
    console.log(`⏱️  Duration: ${result.durationSec}s`)
    console.log()
    console.log(`🎉 You can now test the video at: ${result.filepath}`)
    console.log(`💡 The captions were generated using the new subtitle library`)
    
  } catch (error) {
    console.log()
    console.log(`❌ Video reassembly failed:`)
    console.log(`   Error: ${error}`)
    
    if (error instanceof Error) {
      console.log(`   Stack: ${error.stack}`)
    }
  }
}

async function listAvailableStories(): Promise<void> {
  console.log(`📋 Available stories for reassembly:`)
  console.log()
  
  try {
    const assetsPath = path.join(process.cwd(), 'assets')
    const audioPath = path.join(assetsPath, 'audio')
    const videoPath = path.join(assetsPath, 'video')
    
    const [audioFiles, videoFiles] = await Promise.all([
      fs.readdir(audioPath).catch(() => []),
      fs.readdir(videoPath).catch(() => [])
    ])
    
    // Extract unique story IDs
    const storyIds = new Set<string>()
    
    audioFiles.forEach(file => {
      if (file.endsWith('.wav')) {
        storyIds.add(file.replace('.wav', ''))
      }
    })
    
    videoFiles.forEach(file => {
      if (file.endsWith('.mp4')) {
        const storyId = file.split('-')[0]
        storyIds.add(storyId)
      }
    })
    
    if (storyIds.size === 0) {
      console.log(`❌ No stories found with existing assets`)
      return
    }
    
    console.log(`Found ${storyIds.size} stories with assets:`)
    for (const storyId of Array.from(storyIds).sort()) {
      const assets = await findExistingAssets(storyId)
      const hasAudio = assets.audioFile ? '✅' : '❌'
      const hasVideo = assets.videoFiles.length > 0 ? '✅' : '❌'
      const videoCount = assets.videoFiles.length
      const type = assets.hasStoryboard ? 'storyboard' : 'single'
      
      console.log(`   ${storyId}`)
      console.log(`     Audio: ${hasAudio}  Video: ${hasVideo} (${videoCount} files, ${type})`)
    }
    
    console.log()
    console.log(`Usage: npm run reassemble <story-id>`)
    
  } catch (error) {
    console.log(`❌ Error listing stories: ${error}`)
  }
}

// Main CLI logic
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`🎬 Video Reassembly Tool`)
    console.log(`Testing the refactored caption generation with subtitle library`)
    console.log()
    await listAvailableStories()
    return
  }
  
  const storyId = args[0]
  
  if (!storyId || storyId.length < 5) {
    console.log(`❌ Invalid story ID: ${storyId}`)
    console.log(`Usage: npm run reassemble <story-id>`)
    return
  }
  
  await reassembleVideo(storyId)
}

// Run the CLI
main().catch(error => {
  console.error(`❌ CLI error: ${error}`)
  process.exit(1)
})