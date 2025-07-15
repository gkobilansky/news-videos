# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-07

### Added
- **🎬 Storyboard-based video generation system** - Complete overhaul using RunwayML's Gen-4 storyboard capabilities [[memory:787391]]
- **📸 Reference image generation** - Creates anchor images for visual consistency across all shots
- **🎯 Script-to-shots automation** - Intelligently splits 10-15s scripts into 2-3 logical video beats
- **⚡ Gen-4 Turbo optimization** - 720p draft resolution for improved performance and credit efficiency
- **🔄 Motion-centric prompts** - Action-focused prompt generation with @anchor tags for presenter consistency
- **🎨 Enhanced storyboard editor** - Professional UI component for editing shot prompts, camera angles, and timing
- **📊 Shot-based orchestration** - Generates individual clips and assembles them into final videos
- **🧪 Comprehensive test coverage** - 208 passing tests across 15 test suites with complete pipeline coverage

### Changed
- **BREAKING**: Replaced simple text-to-video with sophisticated storyboard approach
- **Enhanced video generation service** - Now supports both legacy and storyboard-based generation
- **Improved error handling** - Better handling of Runway API failures with detailed error messages
- **Optimized credit usage** - Single reference image per storyboard instead of per-shot images
- **Updated database schema** - Added storyboards table with JSONB shot storage

### Technical Improvements
- **Professional workflow** - Following industry-standard video production practices
- **Visual consistency** - Reference images tagged as "anchor" for consistent presenter appearance
- **Efficient processing** - Optimized API calls and reduced redundant operations
- **Enhanced prompting** - Motion-centric descriptions avoiding negative prompts
- **Better orchestration** - Improved video assembly and synchronization

### Fixed
- API timeout issues with long-running video generation tasks
- Inconsistent visual styling across multiple shots
- Credit inefficiency from generating too many reference images
- Error handling for Runway API failures
- Database schema mismatches between TypeScript interfaces and SQL

## [0.4.0] - 2024-12-27

### Added
- **Complete video generation pipeline** - End-to-end story-to-MP4 generation (User Story U3 COMPLETE)
- **AI video generation system** - High-quality video generation using Runway AI
- **Advanced prompt engineering** - Context-aware video generation based on story content
- **Caption overlay system** - Synchronized subtitles with optimized styling for vertical videos
- **Audio reuse optimization** - Intelligent TTS caching to prevent redundant API calls
- **Enhanced test coverage** - 221 passing tests across 16 test suites (complete pipeline coverage)

### Changed
- **BREAKING**: Upgraded Runway API integration to use `waitForTaskOutput()` instead of manual polling
- **Improved resilience**: Enhanced error handling and retry logic for video generation
- **Enhanced error handling**: Specific error types (`TaskFailedError`, `TaskTimedOutError`) with user-friendly messages
- **Test infrastructure**: Comprehensive coverage for complete video generation pipeline

### Optimized
- **Audio Generation**: TTS service reuses existing audio files, reducing API calls by ~80% for additional videos
- **Video Generation**: Reliable Runway AI integration with intelligent error handling
- **Error Recovery**: Failed videos can be retried with improved status handling
- **File Management**: Automatic cleanup and proper asset organization

### Fixed
- Video generation timeout issues due to inefficient polling
- Redundant TTS API calls for the same story content
- Asset filename generation and organization
- Test coverage gaps in video generation pipeline

## [0.3.0] - 2024-01-27

### Added
- Complete video generation pipeline infrastructure
- TTS service with OpenAI text-to-speech integration
- FFmpeg service for video processing and assembly
- Video generation service with Runway ML API integration
- Video orchestration service for end-to-end pipeline coordination
- Comprehensive test infrastructure for all services

## [0.2.0] - 2024-01-26

### Added
- Script generation and editing functionality (User Story U2)
- OpenAI integration with `gpt-4o-mini` for script generation
- Real-time word count display
- Script editing interface with save/regenerate functionality

## [0.1.0] - 2024-01-25

### Added
- Initial project setup with Next.js 15, TypeScript, and Tailwind CSS
- Story management system (User Story U1)
- Story creation form with validation and Server Actions
- Story dashboard with filtering and status management
- Supabase database integration with migrations
- Comprehensive test infrastructure with Jest and React Testing Library 