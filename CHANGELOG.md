# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2024-12-27

### Added
- **Complete video generation pipeline** - End-to-end story-to-MP4 generation (User Story U3 COMPLETE)
- **Pexels stock footage integration** - Alternative video source with intelligent search queries
- **Dual-provider video generation** - Resilient system with Runway AI + Pexels fallback
- **Provider-specific asset management** - Automatic filename conflict prevention (`-runway`, `-pexels` suffixes)
- **Caption overlay system** - Synchronized subtitles with optimized styling for vertical videos
- **Audio reuse optimization** - Intelligent TTS caching to prevent redundant API calls
- **Enhanced test coverage** - 221 passing tests across 16 test suites (complete pipeline coverage)

### Changed
- **BREAKING**: Upgraded Runway API integration to use `waitForTaskOutput()` instead of manual polling
- **Improved resilience**: Video generation continues with successful provider when one fails
- **Enhanced error handling**: Specific error types (`TaskFailedError`, `TaskTimedOutError`) with user-friendly messages
- **Test infrastructure**: Comprehensive coverage including Pexels service and dual-provider orchestration

### Optimized
- **Audio Generation**: TTS service reuses existing audio files, reducing API calls by ~80% for additional videos
- **Video Generation**: Parallel provider attempts with intelligent fallback logic
- **Error Recovery**: Failed videos can be retried with improved status handling
- **File Management**: Automatic cleanup and conflict prevention across multiple providers

### Fixed
- Video generation timeout issues due to inefficient polling
- Redundant TTS API calls for the same story content
- Provider conflicts in asset filename generation
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
- Real-time word count validation (≤45 words)
- Script editing interface with save/regenerate functionality

## [0.1.0] - 2024-01-25

### Added
- Initial project setup with Next.js 15, TypeScript, and Tailwind CSS
- Story management system (User Story U1)
- Story creation form with validation and Server Actions
- Story dashboard with filtering and status management
- Supabase database integration with migrations
- Comprehensive test infrastructure with Jest and React Testing Library 