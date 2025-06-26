import { 
  createMockStory, 
  createMockScript, 
  createMockAsset, 
  createMockVideo,
  createTestSupabaseClient 
} from '../lib/test-utils'

describe('Test Utils', () => {
  describe('Mock Data Factories', () => {
    it('should create a mock story with default values', () => {
      const story = createMockStory()
      
      expect(story.id).toBe('test-story-id')
      expect(story.headline).toBe('Test Headline')
      expect(story.hot_take).toBe('Test hot take')
      expect(story.sources).toEqual(['https://example.com/source1'])
      expect(story.status).toBe('draft')
      expect(story.created_at).toBeDefined()
      expect(story.updated_at).toBeDefined()
    })

    it('should create a mock story with overrides', () => {
      const story = createMockStory({
        headline: 'Custom Headline',
        status: 'done',
        sources: ['https://custom.com']
      })
      
      expect(story.headline).toBe('Custom Headline')
      expect(story.status).toBe('done')
      expect(story.sources).toEqual(['https://custom.com'])
      // Should keep default values for non-overridden fields
      expect(story.id).toBe('test-story-id')
    })

    it('should create a mock script with default values', () => {
      const script = createMockScript()
      
      expect(script.id).toBe('test-script-id')
      expect(script.story_id).toBe('test-story-id')
      expect(script.text).toBe('Test script content')
      expect(script.edited_at).toBeDefined()
      expect(script.created_at).toBeDefined()
    })

    it('should create a mock asset with default values', () => {
      const asset = createMockAsset()
      
      expect(asset.id).toBe('test-asset-id')
      expect(asset.story_id).toBe('test-story-id')
      expect(asset.kind).toBe('video')
      expect(asset.provider).toBe('runway')
      expect(asset.filepath).toBe('/test/path/video.mp4')
      expect(asset.metadata).toEqual({})
      expect(asset.created_at).toBeDefined()
    })

    it('should create a mock video with default values', () => {
      const video = createMockVideo()
      
      expect(video.id).toBe('test-video-id')
      expect(video.story_id).toBe('test-story-id')
      expect(video.filepath).toBe('/test/output/final-video.mp4')
      expect(video.duration_sec).toBe(15)
      expect(video.created_at).toBeDefined()
    })
  })

  describe('Test Supabase Client', () => {
    it('should create a test Supabase client', () => {
      const client = createTestSupabaseClient()
      
      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
    })
  })
})