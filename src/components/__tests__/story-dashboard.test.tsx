import { render, screen, waitFor, act } from '@/lib/test-utils'
import { StoryDashboard } from '../story-dashboard'
import { createMockStory } from '@/lib/test-utils'
import { Story } from '@/types'

// Mock the story actions
jest.mock('@/app/actions/story-actions', () => ({
  getAllStoriesAction: jest.fn(),
}))

const mockGetAllStoriesAction = require('@/app/actions/story-actions').getAllStoriesAction

describe('StoryDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading spinner while fetching stories', () => {
      mockGetAllStoriesAction.mockImplementation(() => new Promise(() => {})) // Never resolves
      
      render(<StoryDashboard />)
      
      expect(screen.getByText('Loading stories...')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows empty state when no stories exist', async () => {
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: [] })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('No stories found')).toBeInTheDocument()
        expect(screen.getByText('Create your first story to get started')).toBeInTheDocument()
      })
    })

    it('shows link to create new story in empty state', async () => {
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: [] })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        const createLink = screen.getByRole('link', { name: 'Create New Story' })
        expect(createLink).toHaveAttribute('href', '/stories/new')
      })
    })
  })

  describe('story list', () => {
    it('displays stories when they exist', async () => {
      const mockStories: Story[] = [
        createMockStory({ 
          id: '1', 
          headline: 'First Story', 
          status: 'draft' 
        }),
        createMockStory({ 
          id: '2', 
          headline: 'Second Story', 
          status: 'editing' 
        })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('First Story')).toBeInTheDocument()
        expect(screen.getByText('Second Story')).toBeInTheDocument()
      })
    })

    it('shows story status badges', async () => {
      const mockStories: Story[] = [
        createMockStory({ id: 'story-1', status: 'draft' }),
        createMockStory({ id: 'story-2', status: 'editing' }),
        createMockStory({ id: 'story-3', status: 'generating' }),
        createMockStory({ id: 'story-4', status: 'done' }),
        createMockStory({ id: 'story-5', status: 'failed' })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument()
        expect(screen.getByText('editing')).toBeInTheDocument()
        expect(screen.getByText('generating')).toBeInTheDocument()
        expect(screen.getByText('done')).toBeInTheDocument()
        expect(screen.getByText('failed')).toBeInTheDocument()
      })
    })

    it('shows clickable story links', async () => {
      const mockStories: Story[] = [
        createMockStory({ 
          id: 'story-123', 
          headline: 'Clickable Story' 
        })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        const storyLink = screen.getByRole('link', { name: /Clickable Story/ })
        expect(storyLink).toHaveAttribute('href', '/stories/story-123/script')
      })
    })
  })

  describe('status filtering', () => {
    it('shows filter buttons for all statuses when stories exist', async () => {
      const mockStories: Story[] = [
        createMockStory({ status: 'draft' })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Editing' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Generating' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Failed' })).toBeInTheDocument()
      })
    })

    it('filters stories by status when filter button is clicked', async () => {
      const mockStories: Story[] = [
        createMockStory({ id: 'draft-1', headline: 'Draft Story', status: 'draft' }),
        createMockStory({ id: 'done-2', headline: 'Done Story', status: 'done' })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      // Wait for stories to load
      await waitFor(() => {
        expect(screen.getByText('Draft Story')).toBeInTheDocument()
        expect(screen.getByText('Done Story')).toBeInTheDocument()
      })
      
      // Click draft filter
      const draftFilter = screen.getByRole('button', { name: 'Draft' })
      await act(async () => {
        draftFilter.click()
      })
      
      // Should show only draft stories
      expect(screen.getByText('Draft Story')).toBeInTheDocument()
      expect(screen.queryByText('Done Story')).not.toBeInTheDocument()
    })

    it('highlights active filter button', async () => {
      const mockStories: Story[] = [
        createMockStory({ status: 'draft' })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        const allFilter = screen.getByRole('button', { name: 'All' })
        expect(allFilter).toHaveClass('bg-blue-600') // Active state
      })
      
      // Click draft filter
      const draftFilter = screen.getByRole('button', { name: 'Draft' })
      await act(async () => {
        draftFilter.click()
      })
      
      expect(draftFilter).toHaveClass('bg-blue-600') // Now active
      expect(screen.getByRole('button', { name: 'All' })).not.toHaveClass('bg-blue-600') // No longer active
    })
  })

  describe('error handling', () => {
    it('shows error message when fetching stories fails', async () => {
      mockGetAllStoriesAction.mockResolvedValue({ success: false, error: 'Database error' })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        expect(screen.getByText('Error loading stories')).toBeInTheDocument()
        expect(screen.getByText('Database error')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockGetAllStoriesAction.mockResolvedValue({ success: false, error: 'Database error' })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      })
    })
  })

  describe('create new story button', () => {
    it('shows create new story button when stories exist', async () => {
      const mockStories: Story[] = [
        createMockStory({ status: 'draft' })
      ]
      
      mockGetAllStoriesAction.mockResolvedValue({ success: true, stories: mockStories })
      
      render(<StoryDashboard />)
      
      await waitFor(() => {
        const createButton = screen.getByRole('link', { name: 'New Story' })
        expect(createButton).toHaveAttribute('href', '/stories/new')
      })
    })
  })
})