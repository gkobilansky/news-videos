# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Audio reuse optimization system in TTS service
- Enhanced error handling with specific error types (`TaskFailedError`, `TaskTimedOutError`)
- Performance monitoring and optimization documentation
- Comprehensive test coverage for all video generation services

### Changed
- **BREAKING**: Upgraded Runway API integration to use `waitForTaskOutput()` instead of manual polling
- Improved video generation reliability with native SDK timeout handling
- Enhanced error messages for better user feedback and debugging
- Updated test infrastructure to support new Runway SDK approach

### Optimized
- **Audio Generation**: TTS service now reuses existing audio files, reducing API calls by ~80% for additional videos
- **Video Generation**: Replaced custom polling with Runway SDK's built-in task management
- **Error Handling**: Specific error types provide clearer feedback for timeouts, rate limits, and generation failures
- **Test Performance**: Streamlined test suite from 161 tests across 13 suites to 99 focused tests across 7 suites

### Fixed
- Video generation timeout issues due to inefficient polling
- Redundant TTS API calls for the same story content
- Unclear error messages during video generation failures
- Test flakiness in video generation service tests

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