import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@/lib/test-utils'
import { StoryCreationForm } from '../story-creation-form'
import { createStoryRaw } from '@/app/actions/story-actions'

// Mock the Server Action
jest.mock('@/app/actions/story-actions', () => ({
  createStoryRaw: jest.fn(),
}))

const mockCreateStoryRaw = createStoryRaw as jest.MockedFunction<typeof createStoryRaw>

describe('StoryCreationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders form with all required fields', () => {
    render(<StoryCreationForm />)
    
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/hot take/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sources/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create story/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields', async () => {
    render(<StoryCreationForm />)
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/headline is required/i)).toBeInTheDocument()
      expect(screen.getByText(/at least one source is required/i)).toBeInTheDocument()
    })
  })

  it('validates headline length constraints', async () => {
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const shortHeadline = 'Hi'
    const longHeadline = 'A'.repeat(201)
    
    // Test too short
    fireEvent.change(headlineInput, { target: { value: shortHeadline } })
    fireEvent.blur(headlineInput)
    
    await waitFor(() => {
      expect(screen.getByText(/headline must be at least 10 characters long/i)).toBeInTheDocument()
    })
    
    // Test too long
    fireEvent.change(headlineInput, { target: { value: longHeadline } })
    fireEvent.blur(headlineInput)
    
    await waitFor(() => {
      expect(screen.getByText(/headline must be less than 200 characters long/i)).toBeInTheDocument()
    })
  })

  it('validates hot take length constraints', async () => {
    render(<StoryCreationForm />)
    
    const hotTakeInput = screen.getByLabelText(/hot take/i)
    const longHotTake = 'A'.repeat(501)
    
    fireEvent.change(hotTakeInput, { target: { value: longHotTake } })
    fireEvent.blur(hotTakeInput)
    
    await waitFor(() => {
      expect(screen.getByText(/hot take must be less than 500 characters long/i)).toBeInTheDocument()
    })
  })

  it('validates source URL format', async () => {
    render(<StoryCreationForm />)
    
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    fireEvent.change(sourcesInput, { target: { value: 'invalid-url' } })
    fireEvent.blur(sourcesInput)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid url format/i)).toBeInTheDocument()
    })
  })

  it('accepts valid internal URLs', async () => {
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    fireEvent.change(headlineInput, { target: { value: 'Valid Headline' } })
    fireEvent.change(sourcesInput, { target: { value: 'https://internal/story123' } })
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    // Should not show URL validation error
    await waitFor(() => {
      expect(screen.queryByText(/invalid url format/i)).not.toBeInTheDocument()
    })
  })

  it('handles multiple sources separated by newlines', async () => {
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    const validSources = 'https://example.com/source1\nhttps://example.com/source2'
    
    fireEvent.change(headlineInput, { target: { value: 'Valid Headline' } })
    fireEvent.change(sourcesInput, { target: { value: validSources } })
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockCreateStoryRaw).toHaveBeenCalledWith({
        headline: 'Valid Headline',
        hot_take: '',
        sources: ['https://example.com/source1', 'https://example.com/source2'],
      })
    })
  })

  it('successfully creates story with valid data', async () => {
    const mockStory = {
      id: 'new-story-id',
      headline: 'Test Headline',
      hot_take: 'Test hot take',
      sources: ['https://example.com/source1'],
      status: 'draft' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    mockCreateStoryRaw.mockResolvedValueOnce({ success: true, story: mockStory })
    
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const hotTakeInput = screen.getByLabelText(/hot take/i)
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    fireEvent.change(headlineInput, { target: { value: 'Test Headline' } })
    fireEvent.change(hotTakeInput, { target: { value: 'Test hot take' } })
    fireEvent.change(sourcesInput, { target: { value: 'https://example.com/source1' } })
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockCreateStoryRaw).toHaveBeenCalledWith({
        headline: 'Test Headline',
        hot_take: 'Test hot take',
        sources: ['https://example.com/source1'],
      })
    })
  })

  it('shows loading state during submission', async () => {
    mockCreateStoryRaw.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    fireEvent.change(headlineInput, { target: { value: 'Test Headline' } })
    fireEvent.change(sourcesInput, { target: { value: 'https://example.com/source1' } })
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    expect(screen.getByText(/creating story/i)).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('handles creation errors gracefully', async () => {
    const errorMessage = 'Failed to create story'
    mockCreateStoryRaw.mockResolvedValueOnce({ success: false, error: errorMessage })
    
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    fireEvent.change(headlineInput, { target: { value: 'Test Headline' } })
    fireEvent.change(sourcesInput, { target: { value: 'https://example.com/source1' } })
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('resets form after successful submission', async () => {
    const mockStory = {
      id: 'new-story-id',
      headline: 'Test Headline',
      hot_take: '',
      sources: ['https://example.com/source1'],
      status: 'draft' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    
    mockCreateStoryRaw.mockResolvedValueOnce({ success: true, story: mockStory })
    
    render(<StoryCreationForm />)
    
    const headlineInput = screen.getByLabelText(/headline/i)
    const sourcesInput = screen.getByLabelText(/sources/i)
    
    fireEvent.change(headlineInput, { target: { value: 'Test Headline' } })
    fireEvent.change(sourcesInput, { target: { value: 'https://example.com/source1' } })
    
    const submitButton = screen.getByRole('button', { name: /create story/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockCreateStoryRaw).toHaveBeenCalled()
    })
    
    // Form should be reset
    expect(headlineInput).toHaveValue('')
    expect(sourcesInput).toHaveValue('')
  })
})