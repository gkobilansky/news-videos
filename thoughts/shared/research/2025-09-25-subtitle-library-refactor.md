---
date: 2025-09-25T14:42:33-04:00
researcher: Codex
git_commit: 7b9e4a00d19b7733bc6c3f6f89a50a311331d8b9
branch: refactor/subtitle-library
repository: news-videos
topic: "Subtitle library refactoring status"
tags: [research, codebase, ffmpeg-service, subtitles]
status: complete
last_updated: 2025-09-25
last_updated_by: Codex
---

# Research: Subtitle library refactoring status

**Date**: 2025-09-25T14:42:33-04:00  
**Researcher**: Codex  
**Git Commit**: 7b9e4a00d19b7733bc6c3f6f89a50a311331d8b9  
**Branch**: refactor/subtitle-library  
**Repository**: news-videos

## Research Question
What is the current status of the subtitle library refactoring, and what is the branch status?

## Summary
The active branch `refactor/subtitle-library` introduces a caption generation pipeline that relies on the `subtitle` npm package to build SRT files from OpenAI Whisper word-level timestamps, then overlays those subtitles via FFmpeg with enhanced styling tuned for vertical video. The branch is aligned with `origin/refactor/subtitle-library` in commit history (no ahead/behind commits) but the working tree carries additional local, uncommitted modifications in other service files. Supporting tests assert subtitle-specific behavior, and documentation plus API tooling describe how the refactored caption workflow is exercised.

## Detailed Findings

### FFmpeg Service Subtitle Workflow
- `src/services/ffmpeg-service.ts:60` sets up `assembleVideo` to verify inputs, generate caption files, and build FFmpeg commands that inject subtitles.
- `src/services/ffmpeg-service.ts:96` calls `generateCaptionFileWithWhisper`, which requests OpenAI Whisper transcripts, builds caption chunks, and serializes them with `stringifySync` from the `subtitle` library.
- `src/services/ffmpeg-service.ts:247` maps Whisper word chunks into subtitle cues, while `src/services/ffmpeg-service.ts:269` writes the SRT output.
- `src/services/ffmpeg-service.ts:426` defines the `subtitleStyle` string used in both `-vf subtitles=` and `-filter_complex` paths so the overlay styling is consistent across single- and multi-video assemblies.
- Multi-clip handling splits video inputs, trims durations, concatenates them, and adds subtitles in the final filter graph (`src/services/ffmpeg-service.ts:465`, `src/services/ffmpeg-service.ts:487`, `src/services/ffmpeg-service.ts:493`).

### Testing Coverage
- `src/services/__tests__/ffmpeg-service.test.ts:96` verifies FFmpeg arguments include subtitle filters for single-video builds.
- `src/services/__tests__/ffmpeg-service.test.ts:321` exercises caption generation, asserting that SRT content reflects two-word chunking and timing expectations from the subtitle library output.
- Additional scenarios ensure multi-video filter graphs integrate `[concat]subtitles=...` sections and respect individual shot durations (`src/services/__tests__/ffmpeg-service.test.ts:535`, `src/services/__tests__/ffmpeg-service.test.ts:575`).

### API and Tooling Integration
- `src/app/api/test-video/route.ts:6` routes provide a debugging surface that drives `ffmpegService.assembleVideo`, logging whether caption assets exist and enabling a comparison mode that reuses the refactored pipeline.
- The API inspects assets, reads generated SRT files, and forwards the assembled video path, reflecting the refactored subtitle flow (`src/app/api/test-video/route.ts:63`, `src/app/api/test-video/route.ts:136`).

### Documentation and Dependencies
- `CAPTION_IMPROVEMENTS.md:1` documents the refactoring goals, detailing two-word chunking, styling parameters, and testing modes introduced with the subtitle library change.
- `package.json:24` lists the `subtitle@4.2.2-alpha.0` dependency that powers SRT serialization.
- `CHANGELOG.md:49` summarizes the caption overlay system addition as synchronized subtitles optimized for vertical video.

### Branch Status
- `git status -sb` shows `refactor/subtitle-library...origin/refactor/subtitle-library` with no ahead/behind commits but notes unstaged edits in other service files (`src/services/image-generation-service.ts`, `src/services/video-generation-service.ts`, related tests, and `supabase/.temp/cli-latest`).
- `git rev-list --left-right --count origin/refactor/subtitle-library...refactor/subtitle-library` reports `0	0`, confirming commit parity with origin.
- The head commit `7b9e4a00d19b7733bc6c3f6f89a50a311331d8b9` ("remove legacy video gen") is the latest recorded change on the branch (`git show -1`).
- Attempted metadata generation via `hack/spec_metadata.sh` failed because the script is absent in this repository; no automated metadata output is available.

## Code References
- `src/services/ffmpeg-service.ts:60` – Subtitle-aware video assembly workflow.
- `src/services/ffmpeg-service.ts:269` – SRT serialization using the subtitle library.
- `src/services/ffmpeg-service.ts:493` – Complex filter graph appending `[concat]subtitles=...` stage.
- `src/services/__tests__/ffmpeg-service.test.ts:321` – Subtitle library SRT expectations in tests.
- `src/app/api/test-video/route.ts:63` – Asset inspection and assembly trigger for captioned videos.
- `CAPTION_IMPROVEMENTS.md:1` – Narrative describing the refactor deliverables.
- `package.json:24` – Dependency entry for `subtitle` package.
- `CHANGELOG.md:49` – Release note covering the caption overlay system.
- `git status -sb` – Branch parity and local modification indicators.

## Architecture Documentation
The refactored pipeline centers on `FFmpegService`, which now orchestrates caption generation and overlay in three phases: (1) word-level timestamp extraction through Whisper, (2) cue preparation plus SRT serialization via `subtitle`, and (3) FFmpeg invocation that applies consistent ASS force-style options. The service flexibly builds commands for single-clip or multi-clip assemblies, trimming and concatenating video inputs before overlaying the subtitles filter. Downstream, the `/api/test-video` route drives the same service for manual verification, while documentation and tests outline usage patterns, styling parameters, and expected outputs.

## Historical Context (from thoughts/)
No `thoughts/` directory or related documents are present in this workspace, so no historical notes were available for this topic.

## Related Research
None located.

## Open Questions
- Confirm whether a replacement for the missing `hack/spec_metadata.sh` script exists elsewhere for future metadata collection.
- Determine the intent behind the current unstaged edits in other service files before further updates to the subtitle refactor branch.
