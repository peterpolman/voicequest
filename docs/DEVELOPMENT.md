# Development

This repo is a Next.js (Pages Router) app that streams OpenAI text to the UI and speaks it using the Web Speech API. Development focuses on three areas: Next.js UI, API route `/api/text-stream` that calls OpenAI, and in-browser speech features.

## Prerequisites
- Node 18+ (recommended LTS)
- An OpenAI API key in `OPENAI_API_KEY`
- macOS/iOS/Chrome/Edge with Web Speech APIs for speech features

## Quick Start
1. Install deps: `npm install`
2. Set env: create `.env.local` with:
   ```ini
   OPENAI_API_KEY=sk-...
   # Optional: override summarizer model
   SUMMARY_MODEL=gpt-4o-mini
   ```
3. Run dev server: `npm run dev`
4. Open http://localhost:3000

## HTTPS for local testing (iOS/Safari voices)
Some browsers (notably iOS Safari) require a user gesture and often behave better over HTTPS for speech APIs.

- Easiest: `npm run dev:https` (uses Next.js `--experimental-https`). On first run, accept the self-signed cert in your browser.

## NPM Scripts
- `npm run dev` – Next dev server
- `npm run dev:https` – Dev over HTTPS (experimental)
- `npm run build` – Production build
- `npm start` – Start production server
- `npm run lint` – Run ESLint (uses Next config)

## Key Paths
- UI: `src/pages/index.tsx`
- API: `src/pages/api/text-stream.ts`
- Hooks: `src/hooks/*` (speech recognition/synthesis, story stream)
- Game state/session: `src/utils/sessions.ts`
- Prompt shaping: `src/utils/prompt.ts`
- Summarization: `src/utils/summarizer.ts`
- Types: `src/types.ts`

## Env Vars
- `OPENAI_API_KEY` – required to call OpenAI
- `SUMMARY_MODEL` – optional override for summarizer model (defaults to `gpt-4o-mini`)

## Coding Notes
- The API route streams Server-Sent Events (SSE). The UI reads `data:` lines, parses JSON, and updates state.
- The LLM must return a fenced ```json PatchBundle code block. See docs/PROMPTS.md.
- Inventory is normalized to a record on the client; keep the server shape consistent with `GameState`.
- Keep changes minimal and focused. Avoid adding new libs unless necessary.

## Testing Manual Flows
- Mic access: click Start Adventure and allow microphone when prompted.
- Speech synthesis: use Settings → “Test Speech Synthesis”.
- Story: click Record, speak a sentence, confirm streaming text and spoken narration.

## Troubleshooting
See docs/TROUBLESHOOTING.md for common issues (SSE, OpenAI, Speech APIs).
