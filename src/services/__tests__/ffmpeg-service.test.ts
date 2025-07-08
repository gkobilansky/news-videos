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
    it('should generate synchronized SRT subtitle file with chunked captions', async () => {
      mockFs.writeFile.mockResolvedValue(undefined)

      const script = 'This is a test script with multiple words for subtitle generation.'
      const audioFilepath = 'assets/audio/story-123.wav'
      const audioDurationMs = 8000 // 8 seconds

      const captionPath = await (ffmpegService as any).generateCaptionFile(
        'story-123',
        script,
        audioFilepath,
        audioDurationMs
      )

      expect(captionPath).toMatch(/story-123\.srt$/)

      // Get the written SRT content
      const writtenContent = mockFs.writeFile.mock.calls[0][1] as string

      // Should have multiple SRT entries (script is broken into 4-word chunks)
      // With 3 chunks over 8 seconds: 8000ms / 3 = 2667ms per chunk
      expect(writtenContent).toMatch(/1\n00:00:00,000 --> 00:00:02,667\nThis is a test\n\n/)
      expect(writtenContent).toMatch(/2\n00:00:02,667 --> 00:00:05,333\nscript with multiple words\n\n/)
      expect(writtenContent).toMatch(/3\n00:00:05,333 --> 00:00:08,000\nfor subtitle generation\.\n\n/)

      // Should contain proper timing distribution across 8 seconds
      expect(writtenContent).toContain('00:00:00,000 --> 00:00:02,667')
      expect(writtenContent).toContain('00:00:02,667 --> 00:00:05,333')
      expect(writtenContent).toContain('00:00:05,333 --> 00:00:08,000')

      // Should not contain the entire script as a single caption
      expect(writtenContent).not.toMatch(/00:00:00,000 --> 00:00:08,000.*This is a test script with multiple words for subtitle generation\./)
    })

    it('should handle short scripts properly', async () => {
      mockFs.writeFile.mockResolvedValue(undefined)

      const script = 'Short script here'
      const audioDurationMs = 3000 // 3 seconds

      const captionPath = await (ffmpegService as any).generateCaptionFile(
        'story-123',
        script,
        'audio.wav',
        audioDurationMs
      )

      const writtenContent = mockFs.writeFile.mock.calls[0][1] as string

      // Should have single entry for short script (3 words)
      expect(writtenContent).toMatch(/1\n00:00:00,000 --> 00:00:03,000\nShort script here\n\n/)
      expect(writtenContent).not.toContain('2\n')
    })
  })

  describe('createCaptionChunks', () => {
    it('should break script into 4-word chunks', () => {
      const script = 'This is a longer test script with multiple words for testing chunk creation'
      const chunks = (ffmpegService as any).createCaptionChunks(script)

      expect(chunks).toEqual([
        'This is a longer',
        'test script with multiple',
        'words for testing chunk',
        'creation'
      ])
    })

    it('should handle scripts with exact multiple of 4 words', () => {
      const script = 'One two three four five six seven eight'
      const chunks = (ffmpegService as any).createCaptionChunks(script)

      expect(chunks).toEqual([
        'One two three four',
        'five six seven eight'
      ])
    })

    it('should handle very short scripts', () => {
      const script = 'One two'
      const chunks = (ffmpegService as any).createCaptionChunks(script)

      expect(chunks).toEqual(['One two'])
    })
  })

  describe('generateSRTContent', () => {
    it('should create properly timed SRT entries for chunks', () => {
      const chunks = ['First chunk here', 'Second chunk now', 'Final chunk end']
      const audioDurationMs = 6000 // 6 seconds (2 seconds per chunk)

      const srtContent = (ffmpegService as any).generateSRTContent(chunks, audioDurationMs)

      expect(srtContent).toBe(
        '1\n00:00:00,000 --> 00:00:02,000\nFirst chunk here\n\n' +
        '2\n00:00:02,000 --> 00:00:04,000\nSecond chunk now\n\n' +
        '3\n00:00:04,000 --> 00:00:06,000\nFinal chunk end\n\n'
      )
    })

    it('should handle fractional timing correctly', () => {
      const chunks = ['First', 'Second', 'Third']
      const audioDurationMs = 5000 // 5 seconds (1666.67ms per chunk)

      const srtContent = (ffmpegService as any).generateSRTContent(chunks, audioDurationMs)

      // 5000ms / 3 chunks = 1666.67ms ≈ 1667ms per chunk
      expect(srtContent).toContain('00:00:00,000 --> 00:00:01,667')
      expect(srtContent).toContain('00:00:01,667 --> 00:00:03,333')
      expect(srtContent).toContain('00:00:03,333 --> 00:00:05,000')
    })
  })

  describe('buildFFmpegCommand', () => {
    it('should build correct ffmpeg command with single video file', () => {
      const inputs = {
        audioFile: 'assets/audio/story-123.wav',
        videoFiles: ['assets/video/story-123.mp4'],
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
      
      // Single video file should still use simple -vf filtering
      expect(command).toContain('-vf')
      expect(command).not.toContain('-filter_complex')
    })

    it('should build correct ffmpeg command with multiple video files', () => {
      const inputs = {
        audioFile: 'assets/audio/story-123.wav',
        videoFiles: [
          'assets/video/story-123-runway.mp4',
          'assets/video/story-123-additional.mp4'
        ],
        captionFile: 'assets/captions/story-123.srt'
      }
      const outputFile = 'output/story-123.mp4'

      const command = (ffmpegService as any).buildFFmpegCommand(inputs, outputFile)

      // Should contain inputs for all video files
      expect(command).toContain('-i')
      expect(command).toContain('assets/audio/story-123.wav')
      expect(command).toContain('assets/video/story-123-runway.mp4') 
      expect(command).toContain('assets/video/story-123-additional.mp4')
      
      // Should use filter_complex for multiple videos
      expect(command).toContain('-filter_complex')
      expect(command).toContain('-map')
      expect(command).toContain('[outv]')
      
      // Should still have basic encoding options
      expect(command).toContain('-c:v')
      expect(command).toContain('libx264')
      expect(command).toContain('-c:a')
      expect(command).toContain('aac')
      
      // Should NOT have separate -vf filter when using complex filtergraph
      expect(command).not.toContain('-vf')
    })

    it('should build valid filter_complex syntax for multiple video files', () => {
      const inputs = {
        audioFile: 'assets/audio/story-123.wav',
        videoFiles: [
          'assets/video/story-123-runway.mp4',
          'assets/video/story-123-additional.mp4'
        ],
        captionFile: 'assets/captions/story-123.srt'
      }
      const outputFile = 'output/story-123.mp4'

      const command = (ffmpegService as any).buildFFmpegCommand(inputs, outputFile)

      // Find the filter_complex argument
      const filterComplexIndex = command.indexOf('-filter_complex')
      expect(filterComplexIndex).not.toBe(-1)
      
      const filterComplex = command[filterComplexIndex + 1]
      
      // Should contain valid trim filters with duration
      expect(filterComplex).toMatch(/\[1:v\]trim=duration=\d+,scale=768:1280,setsar=1\[v0\]/)
      expect(filterComplex).toMatch(/\[2:v\]trim=duration=\d+,scale=768:1280,setsar=1\[v1\]/)
      
      // Should contain concatenation filter
      expect(filterComplex).toMatch(/\[v0\]\[v1\]concat=n=2:v=1:a=0\[concat\]/)
      
      // Should contain subtitles filter integrated into complex filtergraph
      expect(filterComplex).toMatch(/\[concat\]subtitles=.*story-123\.srt.*\[outv\]/)
      
      // Should NOT contain invalid "duration=" filter (without trim=)
      expect(filterComplex).not.toMatch(/\[1:v\]duration=/)
      expect(filterComplex).not.toMatch(/\[2:v\]duration=/)
      
      // Should calculate proper segment duration (30 seconds / 2 videos = 15 seconds each)
      expect(filterComplex).toContain('trim=duration=15')
      
      // Should NOT have separate -vf filter for multiple video files
      expect(command).not.toContain('-vf')
    })

    it('should handle different numbers of video files correctly', () => {
      const inputs = {
        audioFile: 'assets/audio/story-123.wav',
        videoFiles: [
          'assets/video/story-123-runway.mp4',
          'assets/video/story-123-additional.mp4',
          'assets/video/story-123-extra.mp4'
        ],
        captionFile: 'assets/captions/story-123.srt'
      }
      const outputFile = 'output/story-123.mp4'

      const command = (ffmpegService as any).buildFFmpegCommand(inputs, outputFile)

      const filterComplexIndex = command.indexOf('-filter_complex')
      const filterComplex = command[filterComplexIndex + 1]
      
      // Should have 3 video inputs with proper duration (30/3 = 10 seconds each)
      expect(filterComplex).toContain('trim=duration=10')
      expect(filterComplex).toMatch(/\[v0\]\[v1\]\[v2\]concat=n=3:v=1:a=0\[concat\]/)
      
      // Should have all 3 video streams
      expect(filterComplex).toContain('[v0]')
      expect(filterComplex).toContain('[v1]')
      expect(filterComplex).toContain('[v2]')
      
      // Should have subtitles integrated into complex filtergraph
      expect(filterComplex).toMatch(/\[concat\]subtitles=.*\[outv\]/)
      
      // Should NOT have separate -vf filter for multiple video files
      expect(command).not.toContain('-vf')
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