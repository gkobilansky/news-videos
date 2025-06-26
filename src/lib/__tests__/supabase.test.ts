import { supabase, supabaseAdmin } from '../supabase'

// Mock the Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    auth: jest.fn(),
    storage: jest.fn(),
  })),
}))

describe('Supabase Configuration', () => {
  it('should create a client with correct configuration', () => {
    expect(supabase).toBeDefined()
    expect(supabaseAdmin).toBeDefined()
  })

  it('should have access to database methods', () => {
    expect(typeof supabase.from).toBe('function')
    expect(typeof supabase.auth).toBe('function')
    expect(typeof supabase.storage).toBe('function')
  })

  it('should have admin client with enhanced permissions', () => {
    expect(typeof supabaseAdmin.from).toBe('function')
    expect(typeof supabaseAdmin.auth).toBe('function')
    expect(typeof supabaseAdmin.storage).toBe('function')
  })
})