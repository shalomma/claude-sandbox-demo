# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Demo project showing how to run Claude's Agent SDK inside Vercel Sandbox containers. Two entry points:

- `claude-sandbox.ts` — Local HTTP server (node:http) that accepts prompts via `POST /query` and runs Claude Code CLI in an ephemeral Vercel Sandbox
- `api/query.ts` — Vercel serverless function (Web API `Request`/`Response` style) doing the same thing, deployable to Vercel

Both follow the same pattern: create sandbox → install Claude Code CLI → run `claude --print` with the prompt → return output → stop sandbox.

## Commands

```bash
# Run the local server
node --env-file .env.local --experimental-strip-types ./claude-sandbox.ts

# Test the server
curl -X POST http://localhost:3000/query -H "Content-Type: application/json" -d '{"prompt": "hello"}'

# Deploy to Vercel
vercel deploy
```

No build step, test runner, or linter is configured.

## Environment Setup

- Requires `vercel link` to connect to a Vercel project
- Run `vercel env pull` to get `.env.local` with `VERCEL_OIDC_TOKEN` (expires after 12h)
- `ANTHROPIC_API_KEY` must be set in env for the query endpoints to work

## Key Details

- ES modules (`"type": "module"` in package.json) — use `import`, not `require`
- TypeScript executed directly via `--experimental-strip-types` (no compile step)
- `api/query.ts` uses `await install.exitCode` (promise-based) while `claude-sandbox.ts` uses `install.exitCode` directly — the Vercel Sandbox SDK supports both patterns
- Sandbox config: 4 vCPUs, node22 runtime, 10-minute timeout
- Claude Code CLI is installed with `sudo: true` for global installation inside the sandbox
