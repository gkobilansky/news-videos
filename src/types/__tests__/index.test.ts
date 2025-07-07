import { StoryStatus, Story, Script, Asset, Video, StoryInput } from '../index'

describe('Type Definitions', () => {
  describe('StoryStatus', () => {
    it('should include all valid status values', () => {
      const validStatuses: StoryStatus[] = ['draft', 'editing', 'generating', 'done', 'failed']
      
      validStatuses.forEach(status => {
        expect(['draft', 'editing', 'generating', 'done', 'failed']).toContain(status)
      })
    })
  })

  describe('Story', () => {
    it('should have all required fields', () => {
      const story: Story = {
        id: 'test-id',
        headline: 'Test Headline',
        hot_take: 'Test hot take',
        sources: ['https://example.com'],
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(story.id).toBe('test-id')
      expect(story.headline).toBe('Test Headline')
      expect(story.hot_take).toBe('Test hot take')
      expect(story.sources).toEqual(['https://example.com'])
      expect(story.status).toBe('draft')
      expect(story.created_at).toBe('2024-01-01T00:00:00Z')
      expect(story.updated_at).toBe('2024-01-01T00:00:00Z')
    })

    it('should allow hot_take to be optional', () => {
      const story: Story = {
        id: 'test-id',
        headline: 'Test Headline',
        sources: ['https://example.com'],
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      expect(story.hot_take).toBeUndefined()
    })
  })

  describe('Script', () => {
    it('should have all required fields', () => {
      const script: Script = {
        id: 'script-id',
        story_id: 'story-id',
        text: 'Script content',
        edited_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      }

      expect(script.id).toBe('script-id')
      expect(script.story_id).toBe('story-id')
      expect(script.text).toBe('Script content')
      expect(script.edited_at).toBe('2024-01-01T00:00:00Z')
      expect(script.created_at).toBe('2024-01-01T00:00:00Z')
    })
  })

  describe('Asset', () => {
    it('should have all required fields', () => {
      const asset: Asset = {
        id: 'asset-id',
        story_id: 'story-id',
        kind: 'video',
        provider: 'runway',
        filepath: '/path/to/asset.mp4',
        metadata: { duration: 15 },
        created_at: '2024-01-01T00:00:00Z',
      }

      expect(asset.id).toBe('asset-id')
      expect(asset.story_id).toBe('story-id')
      expect(asset.kind).toBe('video')
      expect(asset.provider).toBe('runway')
      expect(asset.filepath).toBe('/path/to/asset.mp4')
      expect(asset.metadata).toEqual({ duration: 15 })
      expect(asset.created_at).toBe('2024-01-01T00:00:00Z')
    })

    it('should allow valid asset kinds', () => {
      const videoAsset: Asset = {
        id: 'asset-id',
        story_id: 'story-id',
        kind: 'video',
        provider: 'runway',
        filepath: '/path/to/video.mp4',
        created_at: '2024-01-01T00:00:00Z',
      }

      const imageAsset: Asset = {
        id: 'asset-id',
        story_id: 'story-id',
        kind: 'image',
        provider: 'runway',
        filepath: '/path/to/image.jpg',
        created_at: '2024-01-01T00:00:00Z',
      }

      const audioAsset: Asset = {
        id: 'asset-id',
        story_id: 'story-id',
        kind: 'audio',
        provider: 'openai',
        filepath: '/path/to/audio.wav',
        created_at: '2024-01-01T00:00:00Z',
      }

      expect(videoAsset.kind).toBe('video')
      expect(imageAsset.kind).toBe('image')
      expect(audioAsset.kind).toBe('audio')
    })
  })

  describe('Video', () => {
    it('should have all required fields', () => {
      const video: Video = {
        id: 'video-id',
        story_id: 'story-id',
        filepath: '/output/final-video.mp4',
        duration_sec: 15,
        created_at: '2024-01-01T00:00:00Z',
      }

      expect(video.id).toBe('video-id')
      expect(video.story_id).toBe('story-id')
      expect(video.filepath).toBe('/output/final-video.mp4')
      expect(video.duration_sec).toBe(15)
      expect(video.created_at).toBe('2024-01-01T00:00:00Z')
    })

    it('should allow duration_sec to be optional', () => {
      const video: Video = {
        id: 'video-id',
        story_id: 'story-id',
        filepath: '/output/final-video.mp4',
        created_at: '2024-01-01T00:00:00Z',
      }

      expect(video.duration_sec).toBeUndefined()
    })
  })

  describe('StoryInput', () => {
    it('should have all required fields for creating a story', () => {
      const storyInput: StoryInput = {
        headline: 'New Story Headline',
        hot_take: 'Hot take content',
        sources: ['https://source1.com', 'https://source2.com'],
      }

      expect(storyInput.headline).toBe('New Story Headline')
      expect(storyInput.hot_take).toBe('Hot take content')
      expect(storyInput.sources).toEqual(['https://source1.com', 'https://source2.com'])
    })

    it('should allow hot_take to be optional', () => {
      const storyInput: StoryInput = {
        headline: 'New Story Headline',
        sources: ['https://source1.com'],
      }

      expect(storyInput.hot_take).toBeUndefined()
      expect(storyInput.headline).toBe('New Story Headline')
      expect(storyInput.sources).toEqual(['https://source1.com'])
    })

    it('should require sources array to be non-empty conceptually', () => {
      const storyInput: StoryInput = {
        headline: 'New Story Headline',
        sources: [],
      }

      // Type allows empty array, but business logic should validate
      expect(storyInput.sources).toEqual([])
      expect(storyInput.sources.length).toBe(0)
    })
  })
})