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
   - Video b-roll via Runway Gen-3 REST API
   - Stock footage via Pexels REST API
   - Optional charts via DALL·E or QuickChart
4. **Video Assembly**: ffmpeg child process concatenates assets, adds captions and watermark
5. **Output**: Final MP4 saved to `/output/<storyId>.mp4`

## Key Routes & Components

- `/stories` - Story dashboard with list and status
- `/stories/new` - Story creation form 
- `/stories/[id]/script` - Script editing interface
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

## Project Guidance

- Testing is a core component of this project. Always start with testing