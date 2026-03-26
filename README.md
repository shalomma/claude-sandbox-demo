# Using Vercel Sandbox to run Claude’s Agent SDK | Vercel Knowledge Base

The [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) operates as a long-running process that executes commands, manages files, and maintains conversational state. Because the SDK runs shell commands and modifies files on behalf of the AI agent, it’s important to isolate it in a sandboxed container. This prevents the agent from accessing your production systems, consuming unlimited resources, or interfering with other processes.

[Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) provides an ephemeral space with security, customization for dependencies, resource limits and isolation.

This guide shows you how to run Claude Code CLI inside a Vercel Sandbox, exposed as an HTTP API you can run locally or deploy as a Vercel serverless function.

## Prerequisites

Before you begin, make sure you have:

- Vercel CLI installed on your machine. If you don't have it, install it with `npm install -g vercel`
- Node.js 22 or later installed locally
- A [Vercel project](https://vercel.com/docs/projects) to link your sandbox to

Create a new directory for your project and set up the required files:

```bash
mkdir claude-sandbox-demo
cd claude-sandbox-demo
npm init -y
npm install @vercel/sandbox ms
npm install -D @types/ms @types/node
```

The packages you installed:

- `@vercel/sandbox`: Vercel's SDK for creating and managing sandboxes
- `ms`: Helper for working with time durations
- Type definitions for TypeScript support

Update your `package.json` to enable ES modules by adding `"type": "module"`:

```json
{
  "name": "claude-sandbox-demo",
  "type": "module",
  "dependencies": {
    "@vercel/sandbox": "^1.0.2",
    "ms": "^2.1.3"
  },
  "devDependencies": {
    "@types/ms": "^2.1.0",
    "@types/node": "^24.10.0"
  }
}
```

Create a `tsconfig.json` file for TypeScript configuration:

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "types": ["node"]
  }
}
```

Link your project to Vercel:

```bash
vercel link
```

This command connects your local project to a new or existing Vercel project, which is required for sandbox authentication.

To securely connect your Vercel deployment with your sandbox, you can use the [Vercel OIDC token](https://vercel.com/docs/oidc) automatically created with a project. Pull the authentication token to your local `.env.local` file:

```bash
vercel env pull
```

This creates a `.env.local` file with a `VERCEL_OIDC_TOKEN` that the Vercel Sandbox SDK uses for authentication. The OIDC token expires after 12 hours, so you'll need to run `vercel env pull` again if you're developing for extended periods.

You also need an `ANTHROPIC_API_KEY` set in your environment (add it to `.env.local` or export it directly) for the query endpoints to work.

The project has two entry points:

### Local HTTP Server (`claude-sandbox.ts`)

A standalone HTTP server using `node:http` that accepts prompts and runs Claude Code CLI inside an ephemeral Vercel Sandbox.

**Endpoints:**

- `GET /health` — Health check, returns `{ "status": "ok" }`
- `POST /query` — Accepts `{ "prompt": "..." }`, runs Claude Code in a sandbox, returns `{ "result": "..." }`

For each query, the server:

1. Creates a sandbox with 4 vCPUs, node22 runtime, and a 10-minute timeout
2. Installs Claude Code CLI globally (with `sudo`)
3. Runs `claude --print --output-format text --verbose` with the prompt and `ANTHROPIC_API_KEY`
4. Returns the stdout output
5. Stops the sandbox in a `finally` block

Run the server:

```bash
node --env-file .env.local --experimental-strip-types ./claude-sandbox.ts
```

Test it:

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2 + 2?"}'
```

### Vercel Serverless Function (`api/query.ts`)

A deployable serverless function using the Web API `Request`/`Response` pattern. Same sandbox logic as the local server, with a `maxDuration` of 300 seconds.

Deploy to Vercel:

```bash
vercel deploy
```

### Monitoring Sandboxes

To monitor your [sandboxes in the Vercel dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fai%2Fsandbox&title=Go+to+your+project+sandboxes):

1. Navigate to your project on [vercel.com](http://vercel.com/)
2. Click the Observability tab
3. Click Sandboxes in the left sidebar
4. View sandbox history, command execution, and resource usage

## Best Practices

Always call `sandbox.stop()` when your work is complete to avoid unnecessary charges. Both entry points in this project use `try/finally` to ensure cleanup:

```javascript
try {
  // Your sandbox operations
} finally {
  await sandbox.stop();
}
```

Configure timeouts based on your requirements. The maximum is 5 hours for Pro/Enterprise and 45 minutes for Hobby plans:

```javascript
const sandbox = await Sandbox.create({
  timeout: ms('10m'),
});
```

### Related Documentation

- [Vercel Sandbox documentation](https://vercel.com/docs/vercel-sandbox)
- [Vercel SDK docs](https://vercel.com/docs/vercel-sandbox/sdk-reference)
- [Hosting Claude Agent Guide](https://docs.claude.com/en/api/agent-sdk/hosting)
- [Claude Agent SDK documentation](https://docs.anthropic.com/en/api/agent-sdk) to learn about building AI agents
