# Vertical Newsbite Generator

A self-hosted Next.js application that converts headlines and source links into 10-15 second portrait videos with AI voice-over, captions, and b-roll footage.

## 🎯 Project Status

### ✅ Completed (TDD Foundation)
- **Environment Setup**: Next.js 15 + TypeScript + Tailwind CSS
- **Testing Framework**: Jest + React Testing Library with 161 passing tests
- **Database**: Supabase Postgres with migrations and schema
- **Story Management**: Complete CRUD operations with validation
- **User Story U1**: Story creation form with Server Actions (`/stories/new`)
- **Story Dashboard**: Complete `/stories` route with filtering and Server Actions
- **User Story U2**: Complete OpenAI script generation with editing interface (`/stories/[id]/script`)
  - AI-powered script generation using `gpt-4o-mini` with specialized prompts
  - Real-time word count validation (≤45 words)
  - Script editing interface with save/regenerate functionality
  - Full test coverage for service layer and UI components

### ✅ Recently Completed
- **Video Generation Pipeline**: Complete end-to-end implementation with dual-provider resilience
  - ✅ Audio reuse optimization to prevent redundant TTS generation
  - ✅ Runway SDK integration with `waitForTaskOutput()` for reliable video generation

  - ✅ Resilient dual-provider strategy: continues with successful provider when one fails
  - ✅ Enhanced error handling with specific error types and better user feedback
  - ✅ Complete test coverage updates (221 passing tests across all services)
  - ✅ End-to-end video generation pipeline producing final MP4 outputs

### ✅ User Story U3: Video Generation - COMPLETE
- **Complete Pipeline**: Full video generation from story to final MP4 output
  - ✅ All core services implemented: TTS, FFmpeg, Video Generation, Orchestration
  - ✅ Runway AI video generation system
  - ✅ Comprehensive test infrastructure for all services  
  - ✅ Video generation route and Server Actions with complete integration
  - ✅ Performance optimizations and reliable API integration
  - ✅ Final video output to `/output/<storyId>.mp4` with captions and audio sync

### 📋 Roadmap
- **v0.1**: Complete video generation pipeline and file output
- **v0.2**: Asset caching, performance optimization, error recovery
- **v1.0**: Batch processing, template theming, advanced features

## 🛠️ Development Setup

### Prerequisites
- Node.js 20+
- pnpm
- Docker (for Supabase)
- OpenAI API key
- Runway API key


### Installation

```bash
# Clone and install dependencies
pnpm install

# Start Supabase (Postgres database)
supabase start

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development server
pnpm dev

# Open http://localhost:3000
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router) + React + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase Postgres (local via Docker)
- **Testing**: Jest + React Testing Library
- **AI Services**: OpenAI (chat + TTS), Runway Gen-3 (video generation)
- **Video Processing**: ffmpeg (local)

### Database Schema

```sql
stories: id, headline, hot_take, sources[], status (draft/editing/generating/done/failed)
scripts: story_id, text, edited_at  
assets: story_id, kind (video|image|audio), provider, filepath
videos: story_id, filepath, duration_sec
```

## ⚡ Performance Optimizations

### Audio Reuse System
The TTS service now intelligently reuses existing audio files for the same story content:
- **Before**: Every video generation triggered new TTS API calls (~3-5 seconds + API costs)
- **After**: Existing audio files are detected and reused (near-instant + zero API cost)
- **Implementation**: `getExistingAudioAsset()` checks database and filesystem before generation

### Runway API Integration
Replaced manual polling with Runway SDK's built-in task management:
- **Before**: Custom polling logic prone to timeouts and race conditions
- **After**: Native `waitForTaskOutput()` with proper timeout and error handling
- **Benefits**: More reliable video generation, better error messages, reduced timeout issues

### AI Video Generation
- **Runway Integration**: High-quality AI-generated custom visuals using Runway Gen-3
- **Intelligent Processing**: Advanced prompt engineering based on story content and themes

### Enhanced Error Handling
- **Specific Error Types**: `TaskFailedError`, `TaskTimedOutError` for precise error identification
- **User-Friendly Messages**: Clear feedback for API rate limits, timeouts, and generation failures
- **Retry Logic**: Failed videos can be regenerated with improved status handling

### Key Routes
- `/stories` - Story dashboard with list and status
- `/stories/new` - Story creation form 
- `/stories/[id]/script` - Script editing interface
- `/api/generate` - Video generation orchestration

## 🧪 Test-Driven Development

This project follows strict TDD principles:

1. **Red Phase**: Write failing tests that capture desired functionality
2. **Green Phase**: Implement minimal code to pass tests
3. **Refactor Phase**: Improve code structure and readability  
4. **Validate Phase**: Ensure 100% test suite passes

### Test Coverage
- **Story Validation**: Comprehensive tests covering input validation, business rules
- **Story Service**: Complete tests covering CRUD operations, error handling
- **Story Creation Form**: Full tests covering UI validation, form behavior, Server Actions
- **Story Dashboard**: Complete tests covering list display, filtering, loading/error states
- **Script Service**: Full test coverage for OpenAI integration, RAG prompts, validation
- **Script UI**: Complete tests for editing interface, word count validation, Server Actions
- **Video Generation Infrastructure**: Comprehensive test suites for all services:
  - FFmpeg service testing (video processing and assembly)
  - TTS service testing (OpenAI text-to-speech integration with audio reuse)
  - Video generation service testing (Runway ML API integration with waitForTaskOutput)

  - Video orchestration service testing (end-to-end pipeline coordination)
  - Video service testing (database operations and file management)
- **Type Definitions**: Comprehensive type safety validation
- **Test Utilities**: Mock data factories and database helpers
- **Total**: 221 passing tests, 2 skipped, 16 test suites (complete pipeline coverage)

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── actions/         # Server Actions for client-server communication
│   └── stories/         # Story-related routes (/stories, /stories/new)
├── components/          # Reusable React components
├── lib/                 # Utilities and configurations
│   ├── story-validation.ts
│   ├── supabase.ts
│   └── test-utils.tsx
├── services/            # Business logic and API services
│   └── story-service.ts
├── types/               # TypeScript definitions
└── __tests__/           # Test utilities

supabase/
├── config.toml          # Supabase configuration
└── migrations/          # Database schema changes
```

## 🎬 User Stories

### ✅ U1: Story Creation
*As a creator, I open `localhost:3000`, click "New Story", enter a headline, 1–2 sentences, and source URLs.*

**Status**: Complete
- ✅ Story validation with business rules
- ✅ Database operations and error handling
- ✅ Input sanitization and URL validation
- ✅ Story creation form UI (`/stories/new`)
- ✅ Server Actions integration for client-server communication
- ✅ Form validation with real-time error feedback
- ✅ Multi-source URL input support
- ✅ Story dashboard with status filtering (`/stories`)

### ✅ U2: Script Editing  
*As a creator, I can review/edit the AI-drafted ≤45-word script in the web UI before rendering.*

**Status**: Complete
- ✅ OpenAI integration for script generation using `gpt-4o-mini`
- ✅ RAG-based prompt engineering for optimized script generation
- ✅ Script editing interface (`/stories/[id]/script`)
- ✅ Real-time word count validation (≤45 words)
- ✅ Save/regenerate functionality with Server Actions
- ✅ Comprehensive error handling and loading states
- ✅ Full test coverage for service layer and UI components

### ✅ U3: Video Generation
*As a creator, I hit "Generate Video" and, after processing, see the MP4 path plus a Download/Open link.*

**Status**: Complete - End-to-End Pipeline with Dual-Provider Resilience
- ✅ TTS service with OpenAI text-to-speech integration and audio reuse optimization
- ✅ FFmpeg service for video processing and assembly with caption overlay
- ✅ AI video generation: Runway ML API integration with advanced prompting
- ✅ Orchestration service coordinating the complete video generation pipeline
- ✅ Video generation route (`/stories/[id]/generate`) with complete integration
- ✅ Comprehensive test infrastructure for all services (221 passing tests)
- ✅ Performance optimizations reducing generation time and API costs
- ✅ Enhanced error handling with specific error types and user feedback
- ✅ Final video output to `/output/<storyId>.mp4` with audio sync and captions
- ✅ Comprehensive asset management with proper file organization

## 🔑 Environment Variables

```env
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
RUNWAY_API_KEY=your_runway_api_key_here  


# Database (Local Development)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54332/postgres
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# File Storage
ASSETS_DIR=./assets
OUTPUT_DIR=./output
```

## 🤝 Contributing

This project uses Test-Driven Development. Before implementing features:

1. Write failing tests that describe the desired behavior
2. Implement minimal code to pass the tests
3. Refactor and improve code quality
4. Ensure all tests pass before committing

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines.

## 📊 Success Criteria

A generated video file must:
1. Play without errors in standard video players
2. Accurately reflect the input story content  
3. Be saved to `/output/<storyId>.mp4` with correct filename
4. Have proper captions synchronized with audio
5. Include appropriate b-roll footage relevant to the headline