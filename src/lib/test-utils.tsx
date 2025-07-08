import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { createClient } from '@supabase/supabase-js'

// Create a test Supabase client
export const createTestSupabaseClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Custom render function for testing React components
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Test data factories
export const createMockStory = (overrides = {}) => ({
  id: 'test-story-id',
  headline: 'Test Headline',
  hot_take: 'Test hot take',
  sources: ['https://example.com/source1'],
  status: 'draft' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockScript = (overrides = {}) => ({
  id: 'test-script-id',
  story_id: 'test-story-id',
  text: 'Test script content',
  edited_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createMockAsset = (overrides = {}) => ({
  id: 'test-asset-id',
  story_id: 'test-story-id',
  kind: 'video' as const,
  provider: 'runway',
  filepath: '/test/path/video.mp4',
  metadata: {},
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createMockVideo = (overrides = {}) => ({
  id: 'test-video-id',
  story_id: 'test-story-id',
  filepath: '/test/output/final-video.mp4',
  duration_sec: 15,
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createMockStoryboard = (overrides = {}) => ({
  id: 'test-storyboard-id',
  story_id: 'test-story-id',
  model: 'gen4_turbo' as const,
  ratio: '768:1280' as const,
  shots: [
    {
      promptText: 'Wide establishing shot of news scene, cinematic lighting',
      duration: 5 as const,
      camera: { movement: 'static' as const, angle: 'eye-level' as const }
    },
    {
      promptText: 'Close-up handheld shot focusing on key subject, dramatic',
      duration: 5 as const,
      camera: { movement: 'handheld' as const, angle: 'low-angle' as const }
    },
    {
      promptText: 'Dolly-in final shot with resolution, warm tones',
      duration: 5 as const,
      camera: { movement: 'dolly-in' as const, angle: 'eye-level' as const }
    }
  ],
  fps: 24 as const,
      output_format: 'mp4' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

// Database test utilities
export const cleanupTestDb = async (supabase: ReturnType<typeof createTestSupabaseClient>) => {
  // Clean up test data in reverse dependency order
  await supabase.from('videos').delete().neq('id', '')
  await supabase.from('assets').delete().neq('id', '')
  await supabase.from('scripts').delete().neq('id', '')
  await supabase.from('stories').delete().neq('id', '')
}

// File system test utilities
export const createTestDirectories = async () => {
  const fs = require('fs').promises
  const path = require('path')
  
  const testAssetsDir = path.join(process.cwd(), 'test-assets')
  const testOutputDir = path.join(process.cwd(), 'test-output')
  
  await fs.mkdir(testAssetsDir, { recursive: true })
  await fs.mkdir(testOutputDir, { recursive: true })
}

export const cleanupTestDirectories = async () => {
  const fs = require('fs').promises
  const path = require('path')
  
  const testAssetsDir = path.join(process.cwd(), 'test-assets')
  const testOutputDir = path.join(process.cwd(), 'test-output')
  
  try {
    await fs.rm(testAssetsDir, { recursive: true, force: true })
    await fs.rm(testOutputDir, { recursive: true, force: true })
  } catch (error) {
    // Ignore errors if directories don't exist
  }
}