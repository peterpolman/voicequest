# VoiceQuest

Voice-driven, streaming, turn-based adventure powered by Next.js, Web Speech APIs, and OpenAI. Speak or type actions; hear the story unfold with real-time narration. The game state is updated by RFC6902 patches returned from the model.

## Quick Start
- Install: `npm install`
- Env: create `.env.local` with `OPENAI_API_KEY=sk-...`
- Run: `npm run dev` (or `npm run dev:https` for HTTPS)
- Open: http://localhost:3000

## Documentation
- Architecture: docs/ARCHITECTURE.md
- Development: docs/DEVELOPMENT.md
- API: docs/API.md
- Prompt & Patch contract: docs/PROMPTS.md
- Troubleshooting: docs/TROUBLESHOOTING.md
- Contributing: CONTRIBUTING.md

## Tech
- Next.js (Pages Router), TypeScript
- OpenAI SDK (streamed completions)
- Web Speech Recognition/Synthesis (browser-dependent)
- JSON Patch via `fast-json-patch`

Notes: Sessions are in-memory only. iOS Safari requires user gestures for speech; HTTPS improves reliability.
