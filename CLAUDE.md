# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Vertical Newsbite Generator** - a self-hosted Next.js application that converts headlines and source links into 10-15 second portrait videos with AI voice-over, captions, and b-roll footage. The app is designed to be local-first, outputting MP4 files to a local `/output` directory.

## Tech Stack & Architecture

- **Frontend/API**: Next.js 14 with App Router, React Server Components + Server Actions
- **Database**: Supabase Postgres (Docker) or SQLite via Prisma
- **AI Services**: OpenAI AI SDK for chat completions and TTS, Runway Gen-3 for video generation
- **Video Processing**: Local ffmpeg for video assembly and processing
- **Storage**: Local filesystem (`/assets`, `/output`) with DB storing relative paths

## Core Data Flow

1. **Story Creation**: User inputs headline, hot take, sources via web UI
2. **Script Generation**: OpenAI chat completions generate ≤45 word script with RAG prompt
3. **Asset Generation**: 
   - TTS via OpenAI (`tts-1` model, `alloy_news` voice) → WAV + timestamps
   - Video b-roll via Runway Gen-3 two-step process:
     * Text-to-Image: Generate portrait format image (768x1344) from script prompt
     * Image-to-Video: Convert image to 10-second video with motion
   - Optional charts via DALL·E or QuickChart
4. **Video Assembly**: ffmpeg child process concatenates assets, adds captions and watermark
5. **Output**: Final MP4 saved to `/output/<storyId>.mp4`

## Key Routes & Components

- `/stories` - Story dashboard with list and status
- `/stories/new` - Story creation form 
- `/stories/[id]/script` - Script editing interface
- `/stories/[id]/generate` - Video generation trigger and status page
- `/api/generate` - Main orchestration endpoint for video generation

## Database Schema

```sql
-- Core tables
stories: id, headline, hot_take, sources[], status (draft/editing/generating/done/failed)
scripts: story_id, text, edited_at  
assets: story_id, kind (video|image), provider, filepath
videos: story_id, filepath, duration_sec
```

## Development Commands

```bash
# Setup
pnpm i                    # Install dependencies
supabase start           # Start Postgres (if using Supabase)
pnpm dev                 # Start development server (localhost:3000)

# Database Management (Supabase CLI)
supabase db reset        # Reset database to clean state
supabase db push         # Push schema changes to database
supabase db pull         # Pull schema changes from remote
supabase migration new <name>  # Create new migration
supabase migration up    # Run pending migrations
supabase status          # Check Supabase services status

# Testing & Quality
pnpm test                # Run test suite
pnpm test:watch          # Run tests in watch mode
pnpm test:coverage       # Run tests with coverage report
pnpm test:ci             # Run tests for CI/CD
pnpm test:debug          # Run tests with debugging info
pnpm lint                # Lint code
pnpm type-check          # TypeScript checks

# Video Generation
open output/<storyId>.mp4  # View generated videos
```

## Required Environment Variables

```env
OPENAI_API_KEY=          # OpenAI API for chat + TTS
RUNWAY_API_KEY=          # Runway Gen-3 for video generation  
DATABASE_URL=            # Postgres connection (if using Supabase)
```

## Development Workflow

This project follows **Test-Driven Development (TDD)**:

1. **Red Phase**: Write failing tests that capture desired functionality
2. **Green Phase**: Implement minimal code to pass tests
3. **Refactor Phase**: Improve code structure and readability
4. **Validate Phase**: Ensure 100% test suite passes

Key areas requiring comprehensive testing:
- Video generation pipeline (ffmpeg orchestration)
- AI service integrations (OpenAI, Runway)
- File system operations and asset management
- Story state management and transitions

## Testing Framework

**Jest + React Testing Library** setup with:
- TypeScript support via `ts-jest`
- JSX/TSX component testing
- Supabase client mocking
- Test utilities in `src/lib/test-utils.tsx`
- Mock data factories for all core types
- Database cleanup utilities for integration tests

**Test Structure:**
```
src/
├── __tests__/           # General test utilities
├── types/__tests__/     # Type definition tests
├── lib/__tests__/       # Library function tests
└── components/__tests__/ # Component tests
```

**Testing Best Practices:**
- Always write tests before implementation (TDD)
- Use mock data factories from `test-utils.tsx`
- Mock external services (OpenAI, Runway, ffmpeg)
- Test error handling and edge cases
- Maintain >80% code coverage

## Architecture Considerations

- **Server Actions**: Use for form submissions and state mutations
- **API Routes**: Reserve for external service integrations and video processing
- **Error Handling**: Robust error boundaries for AI service failures and ffmpeg issues
- **File Management**: Proper cleanup of temporary assets and failed generations
- **Status Tracking**: Real-time updates for long-running video generation processes

## Database Development

Use the **Supabase CLI** for all database operations:
- Schema changes should be made via migrations (`supabase migration new`)
- Use `supabase db reset` to get a clean database state during development
- Always use `supabase db push` to apply local schema changes
- Check service health with `supabase status` before starting development

## Common Gotchas

- ffmpeg must be available in system PATH or via container
- Video generation is CPU/memory intensive - implement proper queue management
- AI services have rate limits - implement retry logic and exponential backoff
- Large video files require streaming responses for download links
- Cross-platform path handling for Windows/Mac/Linux compatibility

## Success Criteria

A generated video file must:
1. Play without errors in standard video players
2. Accurately reflect the input story content
3. Be saved to `/output/<storyId>.mp4` with correct filename
4. Have proper captions synchronized with audio
5. Include appropriate b-roll footage relevant to the headline

## Current Development Status

### ✅ Completed Features
- **TDD Foundation**: Complete testing framework with Jest + React Testing Library
- **Story Validation**: Comprehensive input validation with business rules (`src/lib/story-validation.ts`)
- **Story Service**: Full CRUD operations with error handling (`src/services/story-service.ts`)
- **Database Schema**: Supabase migrations with proper relationships
- **Type Safety**: Complete TypeScript definitions with test coverage
- **User Story U1**: Complete story creation form with Server Actions (`/stories/new`)
  - Form validation with real-time error feedback
  - Multi-source URL input support
  - Server Action integration for database operations
  - Success navigation to script editing
- **Story Dashboard UI**: Complete `/stories` route with:
  - Status filtering (All, Draft, Editing, Generating, Done, Failed)
  - Server Actions integration to avoid client-side Supabase issues
  - Clean list layout with creation dates and source counts
  - Loading states, error handling with retry functionality
  - Responsive design with proper hover states

### ✅ Recently Completed Features  
- **User Story U2**: Complete OpenAI script generation with editing interface (`/stories/[id]/script`)
  - AI-powered script generation using `gpt-4o-mini` with specialized RAG prompts
  - Real-time word count validation (≤45 words for 10-15 second videos)
  - Script editing interface with save/regenerate functionality
  - Server Actions integration for client-safe database access
  - Comprehensive error handling and loading states
  - Full test coverage for both service layer and UI components

- **Video Generation Infrastructure**: Comprehensive service layer architecture with:
  - **Script Service**: OpenAI integration for RAG-based script generation (`src/services/script-service.ts`)
  - **TTS Service**: OpenAI text-to-speech integration (`src/services/tts-service.ts`)
  - **FFmpeg Service**: Local video processing and assembly (`src/services/ffmpeg-service.ts`)
  - **Video Generation Service**: Runway ML API integration with two-step process (`src/services/video-generation-service.ts`)
  - **Video Orchestration Service**: End-to-end pipeline coordination (`src/services/video-orchestration-service.ts`)
  - **Complete Test Infrastructure**: 161 passing tests across all service layers and UI components
  - **API Test Endpoints**: `/api/test-story` and `/api/test-video` for validation and testing

- **Video Generation Route**: Complete `/stories/[id]/generate` page with:
  - Next.js 15 dynamic API compatibility (awaited params)
  - Script validation before video generation
  - Status transition logic improvements
  - Error handling for failed video generation
  - Integration with video orchestration pipeline

- **Manual Shot Creation**: Complete storyboard customization system (`/stories/[id]/storyboard`)
  - **Service Layer**: New methods in `ScriptService` for shot management
    - `addShotToStoryboard()` - Adds shots to the end of storyboard
    - `insertShotAtPosition()` - Inserts shots at specific positions
    - `removeShotFromStoryboard()` - Removes shots from storyboard
    - `validateSingleShot()` - Validates shot data before operations
  - **Server Actions**: Full CRUD operations via server actions
    - `addShotToStoryboardAction()`, `insertShotAtPositionAction()`, `removeShotFromStoryboardAction()`
  - **UI Components**: Rich interactive storyboard editor
    - Insert shot controls with inline forms
    - Remove shot controls with confirmation
    - Add shot form for appending new shots
    - Full shot configuration (duration, camera movement, angle, description)
  - **Test Coverage**: 7 comprehensive tests covering all new functionality
  - **TDD Implementation**: Tests written first, then implementation
  - **Error Handling**: Robust validation and user feedback

- **Reference Image Generation**: Separated image and video generation workflow (`/stories/[id]/storyboard`)
  - **Image Generation Service**: Dedicated service for creating reference images (`src/services/image-generation-service.ts`)
    - `generateStoryboardImages()` - Generate images for all shots in storyboard
    - `generateImageForShot()` - Generate single image for specific shot
    - `regenerateStoryboardImages()` - Regenerate all images with cleanup
    - `getStoryImageAssets()` - Retrieve existing image assets
  - **Server Actions**: Complete image generation workflow (`src/app/actions/image-generation-actions.ts`)
    - `generateStoryboardImagesAction()`, `regenerateStoryboardImagesAction()`
    - `generateImageForShotAction()`, `getStoryImageAssetsAction()`
  - **UI Components**: Reference image display alongside storyboard (`src/components/storyboard-images.tsx`)
    - Side-by-side layout with storyboard editor and image gallery
    - Image generation controls (generate, regenerate, per-shot regeneration)
    - Modal image preview with metadata overlay
    - Grouped images by shot with proper organization
  - **Database Integration**: Uses existing assets table for image storage
  - **Test Coverage**: 13 comprehensive tests covering all image generation functionality
  - **TDD Implementation**: Service and UI components built test-first
  - **Error Handling**: Robust API error handling and user feedback

- **Storyboard Layout Improvements**: Enhanced visual design and responsive layout (`/stories/[id]/storyboard`)
  - **Proper Containers**: Added max-width container with responsive padding for better page structure
  - **Side-by-Side Layout**: Fixed grid system to display storyboard editor and reference images side by side
  - **Visual Separation**: Added card-style containers with borders and background colors for clear section separation
  - **Image Sizing**: Optimized reference image grid from 3-column to 2-column layout for better visibility
  - **Responsive Design**: Improved breakpoints and mobile/tablet experience with proper spacing
  - **Section Headers**: Added clear section titles with consistent styling throughout the interface

- **Video Generation Pipeline Optimization**: Eliminated image generation duplication and improved efficiency
  - **Video Generation Service**: Updated to use existing reference images (`src/services/video-generation-service.ts`)
    - `generateVideoFromStoryboard()` - Now retrieves existing images instead of generating new ones
    - `getExistingImageAssets()` - Fetches pre-generated reference images from database
    - `createStoryboardVideoTaskFromExistingImages()` - Creates videos using existing images
    - No image generation during video generation phase - only uses existing reference images
  - **Video Orchestration Service**: Simplified coordination without image generation
    - Removed debugging complexity while maintaining pipeline coordination
    - Manages TTS, video generation, FFmpeg assembly, and database operations
    - Clear error handling when reference images are missing
  - **Test Coverage**: Updated 17 tests to verify no image duplication during video generation
  - **Architectural Improvement**: Clean separation of concerns between image and video generation phases
  - **Flow Verification**: Ensured script gen → storyboard gen → image gen → video gen with no duplication

### 🚧 Active Development Areas
- **User Story U3**: Final video generation pipeline integration and testing
- **Video Pipeline Optimization**: Performance tuning and error recovery

### 📋 Next Priority Tasks
1. Complete end-to-end video generation pipeline testing
2. Implement video file output and download functionality
3. Add video generation status tracking and real-time updates

## Development Workflow

### Test-First Approach
**CRITICAL**: Always follow TDD for new features:
1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass
3. **Refactor**: Improve code quality
4. **Validate**: Ensure all tests pass

### Current Test Status
- **231 total tests** (227 passing, 2 skipped, 2 failed) across validation, service, and UI layers
- **Story creation (U1)**: ✅ Complete with full-stack testing (backend + UI)
- **Story dashboard**: ✅ Complete with comprehensive tests covering all states
- **Script generation (U2)**: ✅ Complete with full test coverage for service logic and UI interactions
- **Video generation infrastructure**: ✅ Complete with comprehensive test suites for all services:
  - FFmpeg service testing (video processing and assembly)
  - TTS service testing (OpenAI text-to-speech integration)
  - Video generation service testing (Runway ML API integration)
  - Video orchestration service testing (end-to-end pipeline coordination)
- **Manual shot creation**: ✅ Complete with comprehensive test coverage:
  - Service layer testing (add, insert, remove shots)
  - Input validation and error handling
  - Position bounds validation
  - Shot data validation
- **Video generation (U3)**: ✅ Complete with optimized pipeline eliminating image generation duplication
- **Video pipeline optimization**: ✅ Complete with existing reference image integration

## Project Guidance

- Testing is a core component of this project. Always start with testing
- Use existing mock factories from `src/lib/test-utils.tsx`
- Follow established patterns in `src/services/story-service.ts`
- All business logic must have corresponding tests before UI implementation
- **Review git history** (`git log --oneline`) to understand recent changes and project evolution

## Debugging Notes

- **Supabase Client Initialization**: 
  - Use server actions to avoid Error: supabaseKey is required when calling supabase from client
- **Using Actions to Access DB from Client**:
  - Prefer server actions to handle database interactions from the client side
  - Ensures secure and consistent database access
  - Helps avoid client-side Supabase initialization errors
- **Tailwind CSS Configuration**:
  - Use Tailwind CSS v3.4.x for stability (v4.x has breaking config changes)
  - Ensure PostCSS config uses `tailwindcss: {}` not `@tailwindcss/postcss: {}`
  - Clear Next.js cache (`rm -rf .next`) after Tailwind config changes