# Vertical Newsbite Generator – PRD (Local‑First with Next.js)

---

## 1. Purpose

Build a **self‑hosted Next.js app** that turns any headline + source links into a **10–15 s portrait video** with AI voice‑over, captions, and b‑roll.  Creators manage stories in a browser, click **Generate**, and find the finished MP4 in `/output` on their laptop.

---

## 2. Definition of Success

> A video file appears in `/output` that (a) plays without error **and** (b) accurately reflects the input story.

No additional KPIs for MVP.

---

## 3. Key User Stories

| ID     | Story                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **U1** | *As a creator,* I open `localhost:3000`, click **“New Story”**, enter a headline, 1–2 sentences, and source URLs.                                      |
| **U2** | *As a creator,* I can review / edit the AI‑drafted ≤45‑word script in the web UI before rendering.                                                     |
| **U3** | *As a creator,* I hit **Generate Video** and, after processing, see the MP4 path plus a **Download / Open** link pointing to `./output/<storyId>.mp4`. |

CLI helpers (e.g., `pnpm run generate`) remain optional for power users.

---

## 4. Mandatory Input Schema (unchanged)

```json
{
  "headline": "string",
  "hot_take": "string (optional)",
  "sources": ["https://…", "https://…"]
}
```

`sources[]` **required**; use `https://internal/<id>` when no public link.

---

## 5. Functional Scope (MVP)

1. **Story Dashboard (Next.js)**
   - `/stories` – list & status chips.
   - `/stories/new` – form with **Headline**, **Hot Take**, **Sources**.
   - `/stories/[id]/script` – textarea for AI draft editing.
2. **Script Generation (OpenAI AI SDK)**
   - Server Action or API route calls `openai.chat.completions` with RAG prompt → ≤45 words.
3. **TTS (OpenAI AI SDK)**
   - `openai.audio.speech.create({ model:"tts-1", voice:"alloy_news" })` → WAV + timestamps.
4. **Visual Asset Generation**
   - **Runway Gen‑3**: call via REST; prompt template uses headline keywords.
   - **Chart still**: optional DALL·E or QuickChart PNG; Ken‑Burns via ffmpeg.
5. **Captioning** – Transform timestamps → SRT (Node).
6. **Video Assembly** – Local `ffmpeg` child‑process concatenates, overlays captions, adds watermark.
7. **Output & Status Update** – Move MP4 to `/output`; update story row (`status = "done"`, `filepath`).

Out‑of‑scope: auto‑publish, cloud deploy, analytics.

---

## 6. Local Tech Stack

| Layer              | Choice                                                    | Notes                                                             |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- |
| **Frontend / API** | **Next.js 14 (App Router)**                               | React server components + server actions                          |
| **State / DB**     | **Supabase Postgres (Docker)**                            | `supabase start`; or swap to **SQLite** via Prisma if desired     |
| **AI SDK**         | **@ai‑sdk/openai** (JS)                                   | One client for Chat + TTS; wrap Runway calls in same layer |
| **Orchestration**  | **Node child‑process** inside API route (`/api/generate`) | Spawns ffmpeg, manages temp files                                 |
| **Video Tooling**  | `ffmpeg` (local install or container)                     | Cross‑platform binary detection                                   |
| **Storage**        | Local FS: `/assets`, `/output`                            | DB stores relative paths                                          |

---

## 7. Minimal Data Model

| Table     | Fields                                                                                     | Comment                        |   |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------------ | - |
| `stories` | `id`, `headline`, `hot_take`, `sources[]`, `status` (draft/editing/generating/done/failed) |                                |   |
| `scripts` | `story_id`, `text`, `edited_at`                                                            | One‑to‑one                     |   |
| `assets`  | `story_id`, `kind` (video                                                                  | image), `provider`, `filepath` |   |
| `videos`  | `story_id`, `filepath`, `duration_sec`                                                     |                                |   |

Or use file‑based `.json` if DB feels heavy.

---

## 8. Dev Environment Setup

```bash
# 0. Prereqs: Node 20+, pnpm, Docker OR local ffmpeg, OpenAI & Runway API keys

# 1. Clone & install
pnpm i

# 2. Launch Supabase (optional)
supabase start  # spins up Postgres @54322

# 3. Start web app
pnpm dev  # localhost:3000

# 4. Create story in browser, edit script, click Generate
#    Watch terminal logs for ffmpeg progress.

# 5. Find result
open output/<storyId>.mp4
```

---

## 9. Roadmap

| Phase    | Scope                                                               | ETA    |
| -------- | ------------------------------------------------------------------- | ------ |
| **v0.1** | Next.js UI forms, RAG script, TTS, static placeholder visuals → MP4 | Week 1 |
| **v0.2** | Runway Gen‑3 integration, stock b‑roll pull, Supabase persistence   | Week 3 |
| **v1.0** | Asset caching, batch queue, template theming                        | Week 6 |

---

## 10. Development Guidelines

You are the **AGI coding assistant** for this project. Follow these practices to amplify productivity while preserving code quality:

### 10.1 Core Principles

- **Test‑Driven Development (TDD)** – Always start with a failing test; let tests drive design.
- **Continuous Documentation** – Update README, comments, and architectural docs as you code to keep context fresh.
- **Learn from Tests** – Read existing test suites to understand business rules and edge cases before writing code.
- **Comprehensive Commits** – Write descriptive commit messages (\`\<feat|fix|refactor>: summary

context\`) so future AI/people can reconstruct intent from git history.

### 10.2 Red‑Green‑Refactor + AI Loop

| Phase        | Human Task                                   | AI Assistant Role                       |
| ------------ | -------------------------------------------- | --------------------------------------- |
| **Red**      | Write failing tests capturing desired change | Suggest additional edge‑case tests      |
| **Green**    | Implement minimal code to pass tests         | Generate boilerplate / pattern code     |
| **Refactor** | Improve structure, readability, perf         | Propose refactors, accessibility tweaks |
| **Validate** | Ensure **100 %** test suite passes           | Re‑run tests, highlight regressions     |

This disciplined loop lets AI excel at pattern generation while humans guard architectural intent.

---

