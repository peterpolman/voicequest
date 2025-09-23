# VoiceQuest - AI Voice-Driven RPG

## Architecture Overview

VoiceQuest is a Next.js app that creates real-time voice-driven RPG experiences using OpenAI streaming, Web Speech APIs, and persistent session state. The core flow: user speaks → speech-to-text → AI story generation → text-to-speech → immersive audio RPG.

### Key Components & Data Flow

- **`src/pages/index.tsx`**: Main game controller orchestrating voice I/O, character state, and story streaming
- **`src/pages/api/text-stream.ts`**: OpenAI streaming endpoint with session persistence and language-specific prompts
- **`src/hooks/`**: Custom hooks for speech recognition, synthesis, and story streaming with real-time callbacks
- **`src/utils/sessions.ts`**: In-memory session management with compressed summaries and recent history
- **`src/utils/summarizer.ts`**: Story compression for maintaining long-term narrative context

### Critical Development Patterns

**Session Management**: Sessions persist story state in-memory using compressed summaries + recent exchanges. Each session gets a unique timestamp ID and maintains `summary`, `lastScene`, `recent[]`, and optional `state` objects.

**Real-time Speech Synthesis**: The `useSpeechSynthesis` hook provides `speakRealtimeText()` which receives OpenAI stream chunks and speaks them as they arrive, enabling immediate audio feedback during story generation.

**Language Support**: Character language (`en`|`nl`) drives both speech recognition locale and story prompts. All speech APIs and AI prompts adapt to the selected language.

**Error Recovery**: Speech APIs require careful error handling - microphone permissions, browser support checks, and graceful fallbacks are essential for the voice-first UX.

## Development Workflows

### Local Development

```bash
npm run dev          # Standard development server
npm run dev:https    # HTTPS server for microphone access (uses certificates/)
```

**HTTPS is required** for microphone access in most browsers. The project includes localhost certificates in `certificates/` for local HTTPS development.

### Environment Variables

Required in `.env.local`:

- `OPENAI_API_KEY`: OpenAI API access
- `MODEL`: AI model (default: `gpt-4o-mini`)
- `SUMMARY_MODEL`: Model for story summarization

### Key File Patterns

**Component Structure**: Components use TypeScript interfaces exported alongside the default export (see `Character` interface in `CharacterSetupPopup.tsx`).

**CSS Modules**: All styling uses CSS Modules with `AudioRPG.module.css`. The design uses glassmorphism effects, Pixelify Sans font, and fixed positioning for game UI elements.

**Hook Dependencies**: Custom hooks have specific dependency patterns - `useStoryStream` manages SSE connections, `useSpeechRecognition` handles microphone state, and `useSpeechSynthesis` provides real-time audio callbacks.

## AI Integration Specifics

**Streaming Response Handling**: The `/api/text-stream` endpoint uses Server-Sent Events with specific payload types (`delta`, `status`) that drive both UI updates and real-time speech synthesis.

**Prompt Engineering**: Story prompts use language-specific templates in `PROMPT_TEMPLATES` with strict constraints:

- 40-word maximum responses for voice compatibility
- 2nd person narration ("you...")
- Mandatory A/B choice endings: `1) <option 1>\n2) <option 2>`
- Choice actions detected via regex `^[ab]$/i` and normalized to uppercase
- Bilingual support (en/nl) with translated section headers and rules

**Memory Management**: Three-tier memory system for long-term narrative continuity:

- `session.summary`: Compressed story memory (bullet points, ~200-300 tokens)
- `session.recent[]`: Last 3 action/scene exchanges for immediate context
- `session.lastScene`: Full text of previous scene with A/B options
- Auto-summarization triggered every 3 exchanges, clearing recent buffer

**Summarization Strategy**: The `updateSummary()` function compresses story exchanges into durable facts:

- Preserves: setting, NPCs, goals, clues, promises, unresolved threads, inventory
- Removes: prose, temporary descriptions, repeated information
- Merges with existing summary rather than replacing
- Language-aware prompts for bilingual story compression

## Browser API Integration

**Speech Recognition**: Uses browser-native `webkitSpeechRecognition`/`SpeechRecognition` with language-specific configuration and microphone permission handling.

**Speech Synthesis**: Real-time TTS integration where AI response chunks are immediately spoken as they stream, creating seamless voice interaction.

**Responsive Voice UI**: Record button uses mouse/touch events with global mouse-up handling for intuitive voice controls.

## Critical Files for AI Understanding

- `src/pages/index.tsx`: Core game state and interaction flows
- `src/pages/api/text-stream.ts`: AI streaming logic and prompt templates
- `src/hooks/useStoryStream.ts`: SSE handling and real-time callbacks
- `src/utils/sessions.ts`: Session persistence patterns
- `src/styles/AudioRPG.module.css`: Game UI styling patterns

When adding features, maintain the real-time voice interaction paradigm and ensure all speech APIs handle errors gracefully across different browsers and devices.
