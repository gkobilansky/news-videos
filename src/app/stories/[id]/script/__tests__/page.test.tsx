import { render, screen, fireEvent, waitFor, act } from '@/lib/test-utils'
import { createMockStory, createMockScript } from '@/lib/test-utils'
import ScriptPage from '../page'

// Mock the script actions
jest.mock('@/app/actions/script-actions', () => ({
  generateScriptAction: jest.fn(),
  updateScriptAction: jest.fn(),
  getStoryWithScriptAction: jest.fn(),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useParams: () => ({ id: 'test-story-id' }),
}))

describe('ScriptPage', () => {
  let mockActions: any

  beforeEach(() => {
    const actions = require('@/app/actions/script-actions')
    mockActions = actions
    
    jest.clearAllMocks()
  })

  describe('initial loading', () => {
    it('should display loading state while fetching data', async () => {
      // Arrange
      mockActions.getStoryWithScriptAction.mockImplementation(() => new Promise(() => {})) // Never resolves

      // Act
      render(<ScriptPage />)

      // Assert
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should display story not found error', async () => {
      // Arrange
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: false,
        error: 'Story not found'
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/story not found/i)).toBeInTheDocument()
      })
    })

    it('should display story details when loaded', async () => {
      // Arrange
      const mockStory = createMockStory({
        headline: 'Test Story Headline',
        hot_take: 'Test hot take',
      })
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: null
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Test Story Headline')).toBeInTheDocument()
        expect(screen.getByText('"Test hot take"')).toBeInTheDocument()
      })
    })
  })

  describe('script generation', () => {
    it('should show generate script button when no script exists', async () => {
      // Arrange
      const mockStory = createMockStory()
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: null
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /generate script/i })).toBeInTheDocument()
      })
    })

    it('should generate script when button is clicked', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript({ text: 'Generated script content' })
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: null
      })
      mockActions.generateScriptAction.mockResolvedValue({
        success: true,
        script: mockScript
      })

      // Act
      render(<ScriptPage />)
      
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate script/i })
        expect(button).toBeInTheDocument()
      })
      
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /generate script/i }))
      })

      // Assert
      expect(mockActions.generateScriptAction).toHaveBeenCalledWith(mockStory.id)
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Generated script content')).toBeInTheDocument()
      })
    })

    it('should show loading state during script generation', async () => {
      // Arrange
      const mockStory = createMockStory()
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: null
      })
      mockActions.generateScriptAction.mockImplementation(() => new Promise(() => {})) // Never resolves

      // Act
      render(<ScriptPage />)
      
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate script/i })
        expect(button).toBeInTheDocument()
      })
      
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /generate script/i }))
      })

      // Assert
      expect(screen.getByText(/generating/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled()
    })

    it('should handle script generation errors', async () => {
      // Arrange
      const mockStory = createMockStory()
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: null
      })
      mockActions.generateScriptAction.mockResolvedValue({
        success: false,
        error: 'Failed to generate script. Please try again.'
      })

      // Act
      render(<ScriptPage />)
      
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /generate script/i })
        expect(button).toBeInTheDocument()
      })
      
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /generate script/i }))
      })

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/failed to generate script/i)).toBeInTheDocument()
      })
    })
  })

  describe('script editing', () => {
    it('should display existing script in textarea', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript({ text: 'Existing script content' })
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: mockScript
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing script content')).toBeInTheDocument()
      })
    })

    it('should update script when text is changed and saved', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript({ text: 'Original script' })
      const updatedScript = createMockScript({ text: 'Updated script content' })
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: mockScript
      })
      mockActions.updateScriptAction.mockResolvedValue({
        success: true,
        script: updatedScript
      })

      // Act
      render(<ScriptPage />)
      
      const textarea = await screen.findByDisplayValue('Original script')
      
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Updated script content' } })
      })
      
      const saveButton = screen.getByRole('button', { name: /save (changes|script)/i })
      
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // Assert
      expect(mockActions.updateScriptAction).toHaveBeenCalledWith(
        mockStory.id,
        'Updated script content'
      )
    })

    it('should show word count and validation', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript({ text: 'This is a test script with exactly ten words here.' })
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: mockScript
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/10 \/ 45 words/i)).toBeInTheDocument()
      })
    })

    it('should show error when script exceeds word limit', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript({ text: 'Short script' })
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: mockScript
      })

      // Act
      render(<ScriptPage />)
      
      const textarea = await screen.findByDisplayValue('Short script')
      const longText = 'This is a very long script that exceeds the maximum word limit of forty-five words by including many unnecessary words that would make the video too long for the target duration of ten to fifteen seconds which is the requirement for vertical newsbites and social media posts'
      
      await act(async () => {
        fireEvent.change(textarea, { target: { value: longText } })
      })

      // Assert
      expect(screen.getByText(/script too long/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save (changes|script)/i })).toBeDisabled()
    })

    it('should handle script update errors', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript({ text: 'Original script' })
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: mockScript
      })
      mockActions.updateScriptAction.mockResolvedValue({
        success: false,
        error: 'Failed to save script. Please try again.'
      })

      // Act
      render(<ScriptPage />)
      
      const textarea = await screen.findByDisplayValue('Original script')
      
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Updated script' } })
      })
      
      const saveButton = screen.getByRole('button', { name: /save (changes|script)/i })
      
      await act(async () => {
        fireEvent.click(saveButton)
      })

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/failed to save script/i)).toBeInTheDocument()
      })
    })
  })

  describe('navigation', () => {
    it('should have back to stories button', async () => {
      // Arrange
      const mockStory = createMockStory()
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: null
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to stories/i })).toBeInTheDocument()
      })
    })

    it('should have continue to generation button when script is ready', async () => {
      // Arrange
      const mockStory = createMockStory()
      const mockScript = createMockScript()
      
      mockActions.getStoryWithScriptAction.mockResolvedValue({
        success: true,
        story: mockStory,
        script: mockScript
      })

      // Act
      render(<ScriptPage />)

      // Assert
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue to storyboard/i })).toBeInTheDocument()
      })
    })
  })
})