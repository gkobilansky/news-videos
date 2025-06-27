import { FFmpegService, FFmpegServiceError } from '../ffmpeg-service'
import { createMockVideo, createTestDirectories, cleanupTestDirectories } from '../../lib/test-utils'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

// Mock child_process
jest.mock('child_process')

// Mock fs operations
jest.mock('fs/promises')

describe('FFmpegService', () => {
  let ffmpegService: FFmpegService
  let mockSpawn: jest.MockedFunction<typeof spawn>
  let mockFs: jest.Mocked<typeof fs>

  beforeEach(() => {
    jest.clearAllMocks()
    mockSpawn = spawn as jest.MockedFunction<typeof spawn>
    mockFs = fs as jest.Mocked<typeof fs>
    
    ffmpegService = new FFmpegService()
    
    createTestDirectories()
  })

  afterEach(async () => {
    await cleanupTestDirectories()
  })

  describe('assembleVideo', () => {
    it('should assemble video with audio, video, and captions', async () => {
      // Mock audio duration process
      const mockAudioDurationProcess = {
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Duration: 00:00:10.50, start: 0.000000'))
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 5)
          }
        })
      }

      // Mock video duration process
      const mockVideoDurationProcess = {
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Duration: 00:00:15.45, start: 0.000000'))
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 5)
          }
        })
      }

      // Mock main ffmpeg process
      const mockMainProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10) // Success exit code
          }
        }),
        kill: jest.fn()
      }

      // Setup spawn calls in order: audio duration, main ffmpeg, video duration
      mockSpawn
        .mockReturnValueOnce(mockAudioDurationProcess as any)
        .mockReturnValueOnce(mockMainProcess as any)
        .mockReturnValueOnce(mockVideoDurationProcess as any)

      mockFs.access.mockResolvedValue(undefined) // Files exist
      mockFs.writeFile.mockResolvedValue(undefined) // Caption file creation
      mockFs.mkdir.mockResolvedValue(undefined)

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'This is a test news script for video assembly.'
      }

      const result = await ffmpegService.assembleVideo('story-123', assets)

      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
        '-i', 'assets/audio/story-123.wav',
        '-i', 'assets/video/story-123.mp4',
        '-vf', expect.stringContaining('subtitles='),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-shortest',
        expect.stringMatching(/output\/story-123\.mp4$/)
      ]))

      expect(result).toEqual({
        filepath: expect.stringMatching(/output\/story-123\.mp4$/),
        durationSec: 15
      })
    })

    it('should handle missing input files gracefully', async () => {
      const fsError = new Error('ENOENT: no such file or directory')
      ;(fsError as any).code = 'ENOENT'
      mockFs.access.mockRejectedValue(fsError)

      const assets = {
        audioFilepath: 'missing/audio.wav',
        videoFilepath: 'missing/video.mp4',
        script: 'Test script'
      }

      await expect(
        ffmpegService.assembleVideo('story-123', assets)
      ).rejects.toThrow(FFmpegServiceError)

      await expect(
        ffmpegService.assembleVideo('story-123', assets)
      ).rejects.toThrow('Input file not found')
    })

    it('should handle ffmpeg command failures', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('FFmpeg error: Invalid input format'))
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10) // Error exit code
          }
        }),
        kill: jest.fn()
      }

      mockSpawn.mockReturnValue(mockProcess as any)
      mockFs.access.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.mkdir.mockResolvedValue(undefined)

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test script'
      }

      await expect(
        ffmpegService.assembleVideo('story-123', assets)
      ).rejects.toThrow(FFmpegServiceError)
    })

    it('should validate input parameters', async () => {
      const assets = {
        audioFilepath: 'audio.wav',
        videoFilepath: 'video.mp4',
        script: 'Test script'
      }

      await expect(
        ffmpegService.assembleVideo('', assets)
      ).rejects.toThrow(FFmpegServiceError)

      await expect(
        ffmpegService.assembleVideo('story-123', {
          ...assets,
          audioFilepath: ''
        })
      ).rejects.toThrow(FFmpegServiceError)

      await expect(
        ffmpegService.assembleVideo('story-123', {
          ...assets,
          videoFilepath: ''
        })
      ).rejects.toThrow(FFmpegServiceError)

      await expect(
        ffmpegService.assembleVideo('story-123', {
          ...assets,
          script: ''
        })
      ).rejects.toThrow(FFmpegServiceError)
    })

    it('should handle process timeout', async () => {
      // Mock audio duration process (normal)
      const mockAudioDurationProcess = {
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Duration: 00:00:10.50, start: 0.000000'))
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 5)
          }
        })
      }

      // Mock hanging ffmpeg process
      const mockHangingProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(), // Never calls callback - simulates hanging process
        kill: jest.fn()
      }

      mockSpawn
        .mockReturnValueOnce(mockAudioDurationProcess as any)
        .mockReturnValueOnce(mockHangingProcess as any)

      mockFs.access.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue(undefined)
      mockFs.mkdir.mockResolvedValue(undefined)

      // Mock short timeout for testing
      const originalTimeout = (ffmpegService as any).PROCESS_TIMEOUT_MS
      ;(ffmpegService as any).PROCESS_TIMEOUT_MS = 100

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test script'
      }

      await expect(
        ffmpegService.assembleVideo('story-123', assets)
      ).rejects.toThrow(FFmpegServiceError)

      expect(mockHangingProcess.kill).toHaveBeenCalledWith('SIGKILL')

      // Restore original timeout
      ;(ffmpegService as any).PROCESS_TIMEOUT_MS = originalTimeout
    }, 5000)
  })

  describe('createFinalVideo', () => {
    it('should create final video record in database', async () => {
      // Mock Supabase operations
      const mockInsert = jest.fn().mockReturnThis()
      const mockSelect = jest.fn().mockResolvedValue({
        data: [createMockVideo({
          id: 'video-123',
          story_id: 'story-123',
          filepath: 'output/story-123.mp4',
          duration_sec: 15
        })],
        error: null
      })

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: mockInsert.mockReturnValue({
            select: mockSelect
          })
        })
      }

      // Inject mock into service
      ;(ffmpegService as any).supabase = mockSupabase

      const video = await ffmpegService.createFinalVideo(
        'story-123',
        'output/story-123.mp4',
        15
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('videos')
      expect(mockInsert).toHaveBeenCalledWith({
        story_id: 'story-123',
        filepath: 'output/story-123.mp4',
        duration_sec: 15
      })

      expect(video.story_id).toBe('story-123')
      expect(video.filepath).toBe('output/story-123.mp4')
      expect(video.duration_sec).toBe(15)
    })

    it('should handle database insertion errors', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      }

      ;(ffmpegService as any).supabase = mockSupabase

      await expect(
        ffmpegService.createFinalVideo('story-123', 'output/test.mp4', 10)
      ).rejects.toThrow(FFmpegServiceError)
    })
  })

  describe('assembleVideoForStory', () => {
    it('should orchestrate complete video assembly process', async () => {
      // Mock assembleVideo
      const mockAssembleVideo = jest.spyOn(ffmpegService, 'assembleVideo')
        .mockResolvedValue({
          filepath: 'output/story-123.mp4',
          durationSec: 15
        })

      // Mock createFinalVideo
      const mockCreateFinalVideo = jest.spyOn(ffmpegService, 'createFinalVideo')
        .mockResolvedValue(createMockVideo({
          id: 'video-123',
          story_id: 'story-123',
          filepath: 'output/story-123.mp4',
          duration_sec: 15
        }))

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test news script for video assembly'
      }

      const result = await ffmpegService.assembleVideoForStory('story-123', assets)

      expect(mockAssembleVideo).toHaveBeenCalledWith('story-123', assets)
      expect(mockCreateFinalVideo).toHaveBeenCalledWith(
        'story-123',
        'output/story-123.mp4',
        15
      )

      expect(result.story_id).toBe('story-123')
      expect(result.filepath).toBe('output/story-123.mp4')
      expect(result.duration_sec).toBe(15)
    })

    it('should clean up files if database creation fails', async () => {
      const mockAssembleVideo = jest.spyOn(ffmpegService, 'assembleVideo')
        .mockResolvedValue({
          filepath: 'output/story-123.mp4',
          durationSec: 15
        })

      const mockCreateFinalVideo = jest.spyOn(ffmpegService, 'createFinalVideo')
        .mockRejectedValue(new Error('Database error'))

      mockFs.unlink = jest.fn().mockResolvedValue(undefined)

      const assets = {
        audioFilepath: 'assets/audio/story-123.wav',
        videoFilepath: 'assets/video/story-123.mp4',
        script: 'Test script'
      }

      await expect(
        ffmpegService.assembleVideoForStory('story-123', assets)
      ).rejects.toThrow(FFmpegServiceError)

      expect(mockFs.unlink).toHaveBeenCalledWith('output/story-123.mp4')
    })
  })

  describe('generateCaptionFile', () => {
    it('should generate SRT subtitle file from script', async () => {
      mockFs.writeFile.mockResolvedValue(undefined)

      const script = 'This is a test script with multiple words for subtitle generation.'
      const audioFilepath = 'assets/audio/story-123.wav'
      const audioDurationMs = 6000 // 6 seconds

      const captionPath = await (ffmpegService as any).generateCaptionFile(
        'story-123',
        script,
        audioFilepath,
        audioDurationMs
      )

      expect(captionPath).toMatch(/story-123\.srt$/)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        captionPath,
        expect.stringContaining('00:00:00,000 --> 00:00:06,000')
      )
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        captionPath,
        expect.stringContaining(script)
      )
    })
  })

  describe('buildFFmpegCommand', () => {
    it('should build correct ffmpeg command with all options', () => {
      const inputs = {
        audioFile: 'assets/audio/story-123.wav',
        videoFile: 'assets/video/story-123.mp4',
        captionFile: 'assets/captions/story-123.srt'
      }
      const outputFile = 'output/story-123.mp4'

      const command = (ffmpegService as any).buildFFmpegCommand(inputs, outputFile)

      expect(command).toEqual([
        '-i', 'assets/audio/story-123.wav',
        '-i', 'assets/video/story-123.mp4',
        '-vf', expect.stringMatching(/subtitles=.*story-123\.srt/),
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:v', '2M',
        '-b:a', '128k',
        '-r', '30',
        '-shortest',
        '-y',
        'output/story-123.mp4'
      ])
    })
  })

  describe('getVideoDuration', () => {
    it('should extract duration from ffmpeg output', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Duration: 00:00:15.45, start: 0.000000'))
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10)
          }
        }),
        kill: jest.fn()
      }

      mockSpawn.mockReturnValue(mockProcess as any)

      const duration = await (ffmpegService as any).getVideoDuration('output/story-123.mp4')

      expect(duration).toBe(15)
      expect(mockSpawn).toHaveBeenCalledWith('ffmpeg', [
        '-i', 'output/story-123.mp4',
        '-f', 'null', '-'
      ])
    })
  })
})