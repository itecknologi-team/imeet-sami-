---
name: run-imeet
description: Build, run, and smoke-test the imeet video conferencing app (docker services + backend + frontend + a Playwright signup/create-meeting/recap smoke test). Use when asked to start, run, or screenshot imeet, or confirm a change works end-to-end.
---

imeet is a full-stack app: Postgres/Redis/LiveKit/MinIO/egress via
`docker-compose.yml` at the repo root, an Express+TS backend
(`backend/`, port 4000), and a Vite+React frontend (`frontend/`).

All commands below assume repo root `/home/sami/Desktop/imeet` (adjust
if the repo moved) and are run via `node .claude/skills/run-imeet/driver.mjs <cmd>`.

## Start

```bash
node .claude/skills/run-imeet/driver.mjs start
```

This runs `docker compose up -d`, then starts `backend` and `frontend`
dev servers in the background, waits for `/api/health` and for Vite's
"Local:" line, and prints the frontend URL. State (PIDs, detected
port) is saved to `.claude/skills/run-imeet/.state.json`.

## Smoke test

```bash
node .claude/skills/run-imeet/driver.mjs smoke
```

Drives a headless Chromium (via Playwright, installed into this
skill's own `node_modules` on first run — never touches the app's
`package.json`) through: signup → dashboard → create a meeting →
meeting room (LiveKit connects, live cost counter, chat, participant
list) → the recordings/recap page. Screenshots land in
`.claude/skills/run-imeet/shots/`. Prints any browser console/page
errors — **ignore `NotSupportedError`/`NotFoundError` for
mic/camera**, that's expected in a headless container with no media
devices, not a real bug.

## Stop

```bash
node .claude/skills/run-imeet/driver.mjs stop
```

Kills the backend/frontend dev server process groups and runs
`docker compose down`.

## Gotchas

- **Don't assume port 5173.** If another project on the machine
  already has it, Vite silently picks the next free port (5174, ...).
  The driver reads the actual port out of the frontend's own startup
  log instead of hardcoding it — do the same if you're not using the
  driver.
- **Phase 5 (AI transcription/summary) needs real API keys.** Without
  `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` in `backend/.env`, recording →
  transcript → summary silently ends in `status: "failed"` rows (by
  design — see `transcription.service.ts`) rather than erroring
  visibly. The smoke test above doesn't exercise recording/transcription,
  only that the recap page renders with no completed recordings yet.
- **Recap/recordings polling.** `RecordingsPage.tsx` only polls
  `/recap` once a recording with `status: "completed"` exists — if
  you're testing that path, actually start+stop a recording via the
  meeting room's Record button first.
