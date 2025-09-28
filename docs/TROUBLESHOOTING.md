# Troubleshooting

## Speech Recognition not supported
- Chrome desktop supports `webkitSpeechRecognition`. Safari tech preview and iOS availability varies.
- Fallback: use text input via Settings popup if recognition is unavailable.

## Speech Synthesis is silent on iOS
- iOS needs a user gesture before speech. Use the Settings → Test button.
- Try HTTPS locally: `npm run dev:https` and accept the cert.
- Prefer local voices: the code selects localService voices when possible.

## SSE not streaming
- Check console for `Connection error` from `useStoryStream`.
- Ad blockers or corporate proxies can break SSE; try another network or browser.
- Verify the API route logs in your terminal while making a request.

## OpenAI errors
- Ensure `OPENAI_API_KEY` is set in `.env.local` and server restarted.
- Rate limits or network blips can occur; try again.
- If the model omits the fenced json, the server will warn and skip state apply.

## JSON Patch errors
- The server applies RFC6902. Ensure the first op `test /version` matches, and end with `replace /version`.
- Only patch existing fields with `replace` (except inventory add/remove).

## Type mismatch: location
- Current `Player.location` type is `string` but session uses `{ area, x, y }`.
- Either adjust the type in `src/types.ts` or simplify the default session value to a string.
