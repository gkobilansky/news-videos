# Vertical Newsbite Generator

A self-hosted Next.js application that converts headlines and source links into 10-15 second portrait videos with AI voice-over, captions, and b-roll footage.

## 🎯 Project Status

### ✅ Completed (TDD Foundation)
- **Environment Setup**: Next.js 15 + TypeScript + Tailwind CSS
- **Testing Framework**: Jest + React Testing Library with 87 passing tests
- **Database**: Supabase Postgres with migrations and schema
- **Story Management**: Complete CRUD operations with validation
- **User Story U1**: Story creation form with Server Actions
- **Story Dashboard**: Complete `/stories` route with filtering and Server Actions

### 🚧 In Progress
- Script generation with OpenAI integration (User Story U2)

### 📋 Roadmap
- **v0.1**: Next.js UI forms, RAG script, TTS, static placeholder visuals → MP4
- **v0.2**: Runway Gen-3 integration, stock b-roll pull, Supabase persistence  
- **v1.0**: Asset caching, batch queue, template theming

## 🛠️ Development Setup

### Prerequisites
- Node.js 20+
- pnpm
- Docker (for Supabase)
- OpenAI API key
- Runway API key
- Pexels API key

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
- **AI Services**: OpenAI (chat + TTS), Runway Gen-3, Pexels
- **Video Processing**: ffmpeg (local)

### Database Schema

```sql
stories: id, headline, hot_take, sources[], status (draft/editing/generating/done/failed)
scripts: story_id, text, edited_at  
assets: story_id, kind (video|image|audio), provider, filepath
videos: story_id, filepath, duration_sec
```

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
- **Story Validation**: 28 tests covering input validation, business rules
- **Story Service**: 20 tests covering CRUD operations, error handling
- **Story Creation Form**: 11 tests covering UI validation, form behavior, Server Actions
- **Story Dashboard**: 12 tests covering list display, filtering, loading/error states
- **Type Definitions**: Comprehensive type safety validation
- **Test Utilities**: Mock data factories and database helpers

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

### 🚧 U2: Script Editing  
*As a creator, I can review/edit the AI-drafted ≤45-word script in the web UI before rendering.*

**Status**: Planning
- 🚧 OpenAI integration for script generation
- 🚧 Script editing interface
- 🚧 Word count validation

### 📋 U3: Video Generation
*As a creator, I hit "Generate Video" and, after processing, see the MP4 path plus a Download/Open link.*

**Status**: Not started
- 📋 TTS integration (OpenAI)
- 📋 Visual asset generation (Runway, Pexels)
- 📋 Video assembly with ffmpeg
- 📋 Status tracking and file output

## 🔑 Environment Variables

```env
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
RUNWAY_API_KEY=your_runway_api_key_here  
PEXELS_API_KEY=your_pexels_api_key_here

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