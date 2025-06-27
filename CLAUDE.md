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
   - Stock footage via Pexels REST API
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
PEXELS_API_KEY=          # Stock footage access
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
- AI service integrations (OpenAI, Runway, Pexels)
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
- Mock external services (OpenAI, Runway, Pexels, ffmpeg)
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

### ✅ Recently Completed Features  
- **User Story U2**: Complete OpenAI script generation with editing interface (`/stories/[id]/script`)
  - AI-powered script generation using `gpt-4o-mini` with specialized RAG prompts
  - Real-time word count validation (≤45 words for 10-15 second videos)
  - Script editing interface with save/regenerate functionality
  - Server Actions integration for client-safe database access
  - Comprehensive error handling and loading states
  - Full test coverage (27 tests) for both service layer and UI components

- **Story Dashboard UI**: Complete `/stories` route with:
  - Status filtering (All, Draft, Editing, Generating, Done, Failed)
  - Server Actions integration to avoid client-side Supabase issues
  - Clean list layout with creation dates and source counts
  - Loading states, error handling with retry functionality
  - Responsive design with proper hover states

- **Video Generation Route**: Complete `/stories/[id]/generate` page with:
  - Next.js 15 dynamic API compatibility (awaited params)
  - Script validation before video generation
  - Status transition logic improvements
  - Error handling for failed video generation
  - Navigation between script editing and video generation

- **Video Generation Service**: Updated Runway ML integration with:
  - Two-step approach: text-to-image → image-to-video
  - Correct API endpoints (`/text_to_image`, `/image_to_video`, `/tasks`)
  - Portrait format optimization (768x1344 aspect ratio)
  - Improved error handling and task polling
  - Service layer architecture with comprehensive error types

### 🚧 Active Development Areas
- **Video Generation Pipeline**: Finalizing Runway ML API integration and video assembly

### 📋 Next Priority Tasks
1. Complete Runway ML API implementation and testing
2. Implement TTS service with OpenAI `tts-1` model
3. Create video assembly pipeline with ffmpeg

## Development Workflow

### Test-First Approach
**CRITICAL**: Always follow TDD for new features:
1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass
3. **Refactor**: Improve code quality
4. **Validate**: Ensure all tests pass

### Current Test Status
- **116 total tests** (114 passing, 2 skipped) across validation, service, and UI layers
- **Story creation (U1)**: ✅ Complete with full-stack testing (backend + UI)
- **Story dashboard**: ✅ Complete with 12 comprehensive tests covering all states
- **Script generation (U2)**: ✅ Complete with 27 tests covering service logic and UI interactions
- **Video generation (U3)**: 📋 Not started

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