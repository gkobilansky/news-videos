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

// New Storyboard Types for Runway Integration
export interface StoryboardCamera {
  movement?: 'static' | 'dolly-in' | 'dolly-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down' | 'handheld' | 'zoom-in' | 'zoom-out'
  angle?: 'eye-level' | 'low-angle' | 'high-angle' | 'bird-eye' | 'worm-eye'
  fov?: 'wide' | 'medium' | 'close'
  focusDistance?: number
}

export interface StoryboardReferenceImage {
  uri: string
  tag?: string
}

export interface StoryboardShot {
  promptText: string
  promptImage?: string
  referenceImages?: StoryboardReferenceImage[]
  duration: 5 | 10 | 16 // Gen-4 duration options
  seed?: number
  camera?: StoryboardCamera
}

export interface Storyboard {
  id: string
  story_id: string
  model: 'gen4_turbo' | 'gen4' | 'gen3_alpha_turbo'
  ratio: '1280:720' | '1584:672' | '1104:832' | '720:1280' | '832:1104' | '672:1584' // Landscape and portrait options
  shots: StoryboardShot[]
  fps: 24 | 30
  output_format: 'mp4' | 'gif'
  created_at: string
  updated_at: string
}

export interface SourceContent {
  url: string
  title?: string
  content: string
  extractedAt: string
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