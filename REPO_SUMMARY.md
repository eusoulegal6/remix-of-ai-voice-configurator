# Repo Summary

## Overview

This repository is a small voice testing app built with React, Vite, TypeScript, Tailwind, and shadcn/ui components.

The main user flow is:

1. Enter optional system instructions in the configuration panel.
2. Start a conversation with the microphone button.
3. Stream microphone audio to a Supabase Edge Function over WebSocket.
4. Have the Edge Function proxy that traffic to Google's Gemini live audio WebSocket API.
5. Receive streamed audio responses and play them back in the browser.

## What The App Does Today

- Single-page app with one main route: `/`
- Lets the user start and stop a live voice session
- Lets the user set system instructions before connecting
- Uses a backend proxy so the Gemini API key stays on the server
- Tracks connection/log state in the client hook

## Main Technical Pieces

### Frontend

- `src/pages/Index.tsx`: main screen, wires config state to the audio hook
- `src/hooks/useGeminiAudio.ts`: core browser audio capture, WebSocket handling, PCM conversion, and playback
- `src/components/TestingArea.tsx`: microphone start/stop UI and status display
- `src/components/ConfigSection.tsx`: collapsible settings area for system instructions
- `src/components/ui/*`: large generated shadcn/ui component set, mostly shared UI primitives

### Backend / Realtime Proxy

- `supabase/functions/gemini-ws/index.ts`: Edge Function that upgrades to WebSocket and proxies messages between the browser and Gemini
- The proxy reads `GEMINI_API_KEY` from the server environment
- The browser builds the WebSocket URL from `VITE_SUPABASE_URL`

## Environment Expectations

The repo expects at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY` in the Supabase function environment

## Project Structure

```text
src/
  components/      UI and feature components
  hooks/           app logic, especially realtime audio streaming
  integrations/    generated Supabase client/types
  pages/           route-level pages
  test/            Vitest setup and placeholder example test

supabase/
  functions/
    gemini-ws/     WebSocket proxy to Gemini live API
```

## Current State / Notes

- `README.md` is still a placeholder
- The app appears focused on a single proof-of-concept flow rather than a broader product surface
- `src/components/ConfigPanel.tsx` exists but does not appear to be used by the current page
- Tests are not meaningful yet; the repo only contains a trivial example test
- Running `npm test` in the current workspace failed because `vitest` is not installed locally yet, which suggests dependencies have not been installed in this environment
