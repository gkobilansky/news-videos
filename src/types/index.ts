export type StoryStatus = 'draft' | 'editing' | 'generating' | 'done' | 'failed'

export interface Story {
  id: string
  headline: string
  hot_take?: string
  sources: string[]
  status: StoryStatus
  created_at: string
  updated_at: string
}

export interface Script {
  id: string
  story_id: string
  text: string
  edited_at: string
  created_at: string
}

export interface Asset {
  id: string
  story_id: string
  kind: 'video' | 'image' | 'audio'
  provider: string
  filepath: string
  metadata?: Record<string, any>
  created_at: string
}

export interface Video {
  id: string
  story_id: string
  filepath: string
  duration_sec?: number
  created_at: string
}

export interface StoryInput {
  headline: string
  hot_take?: string
  sources: string[]
}