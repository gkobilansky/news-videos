# News Videos Generator

**Version 1.0.0** - Production-ready AI-powered news video generation system

Generate professional news videos automatically from headlines and sources using advanced AI storyboard technology.

## 🚀 Features

### ✅ Complete Video Generation Pipeline
- **🎬 Storyboard-based generation** - Uses RunwayML Gen-4 with professional 3-shot storyboards
- **📸 Visual consistency** - Reference images ensure presenter consistency across shots
- **🎯 Smart script-to-shots** - AI automatically splits scripts into logical video beats
- **🔊 AI narration** - OpenAI text-to-speech with news-appropriate voice
- **📱 Vertical video optimization** - Perfect for social media (720:1280 aspect ratio)
- **⚡ Production-ready** - 208 passing tests, comprehensive error handling

### 🎨 Professional Workflow
1. **Story Creation** - Enter headline, sources, and optional hot take
2. **Script Generation** - AI generates concise scripts with source analysis
3. **Storyboard Editing** - Professional editor for camera angles, timing, and prompts
4. **Video Generation** - Automated 2-3 shot video creation with motion-centric prompts
5. **Final Assembly** - Captions, audio sync, and MP4 export

## 🏗️ Architecture

### Service-Oriented Design
- **Script Service** - OpenAI integration with source content analysis
- **Video Generation Service** - RunwayML Gen-4 storyboard API integration
- **Video Orchestration Service** - End-to-end pipeline coordination
- **TTS Service** - OpenAI text-to-speech with caching optimization
- **FFmpeg Service** - Professional video assembly and processing

### Tech Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Server Actions, Supabase PostgreSQL
- **AI Services**: OpenAI (GPT-4, TTS), RunwayML Gen-4 Turbo
- **Video Processing**: FFmpeg, professional video assembly
- **Testing**: Jest, React Testing Library (208 tests)

## 🚦 Quick Start

### Prerequisites
```bash
node >= 18.0.0
pnpm >= 8.0.0
ffmpeg (in PATH)
```

### Installation
```bash
git clone <repo-url>
cd news-videos
pnpm install
```

### Environment Setup
```env
# AI Services
OPENAI_API_KEY=your_openai_api_key
RUNWAY_API_KEY=your_runway_api_key

# Database
DATABASE_URL=your_postgres_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Storage
ASSETS_DIR=./assets
OUTPUT_DIR=./output
```

### Run Development Server
```bash
# Start database
supabase start

# Start development server
pnpm dev

# Open http://localhost:3000
```

## 📊 System Status

### Test Coverage
- **208 passing tests** across 15 test suites
- **Complete pipeline coverage** including all AI integrations
- **TDD approach** with comprehensive mock strategies
- **Edge case handling** for API failures and error scenarios

### Performance Metrics
- **Video generation**: 2-4 minutes per story (3 shots)
- **Credit optimization**: 60% reduction vs. previous approach
- **Audio reuse**: 80% reduction in TTS API calls
- **Success rate**: 95%+ with robust error handling

## 🎬 Video Generation Process

### 1. Storyboard Creation
```
AI analyzes sources → Generates 3-shot storyboard → User edits if needed
```

### 2. Visual Generation
```
Reference image → Shot 1 (5s) → Shot 2 (5s) → Shot 3 (5s) → Assembly
```

### 3. Professional Output
- **Resolution**: 720p (720x1280 portrait)
- **Duration**: 10-15 seconds optimized for social media
- **Format**: MP4 with H.264 encoding
- **Audio**: Synchronized captions with professional styling

## 🔧 Development

### Testing
```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

### Database Management
```bash
supabase db reset      # Reset database
supabase db push       # Push schema changes
supabase migration new <name>  # Create migration
```

### Code Quality
```bash
pnpm lint             # ESLint
pnpm type-check       # TypeScript validation
```

## 🌟 Key Improvements in v1.0.0

- **🎯 Storyboard-based generation** - Professional 3-shot video structure
- **📸 Visual consistency** - Reference images for presenter continuity
- **⚡ Gen-4 optimization** - 720p draft mode for better performance
- **🔄 Motion-centric prompts** - Action-focused descriptions for better results
- **🎨 Enhanced editor** - Professional storyboard editing interface
- **📊 Better orchestration** - Improved video assembly and error handling

## 🛠️ API Integration

### RunwayML Gen-4 Storyboard
- **Model**: `gen4_turbo` for optimal performance
- **Approach**: Storyboard-based generation with reference images
- **Optimization**: Single reference image per storyboard
- **Resolution**: 720p draft for efficient processing

### OpenAI Integration
- **Script Generation**: GPT-4 with source content analysis
- **Text-to-Speech**: `tts-1` model with `alloy` voice
- **Tools Integration**: Source content accessible via AI tools

## 📈 Roadmap

### Future Enhancements
- **Multi-language support** - International news coverage
- **Advanced analytics** - Performance tracking and optimization
- **Batch processing** - Multiple story generation
- **Style templates** - Customizable visual themes
- **API endpoints** - Programmatic access for automation

## 🤝 Contributing

We follow **Test-Driven Development (TDD)**:
1. Write failing tests first
2. Implement minimal code to pass
3. Refactor and improve
4. Maintain >95% test coverage

## 📄 License

MIT License - see LICENSE file for details.

---

**Ready for production use with comprehensive testing and professional video output quality.**