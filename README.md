# Using Vercel Sandbox to run Claude’s Agent SDK | Vercel Knowledge Base

The [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) operates as a long-running process that executes commands, manages files, and maintains conversational state. Because the SDK runs shell commands and modifies files on behalf of the AI agent, its important to isolate it in a sandboxed container. This prevents the agent from accessing your production systems, consuming unlimited resources, or interfering with other processes.

The SDK needs specific runtime dependencies installed before it can run:

- Claude Code CLI: Executes commands and manages the development environment
- Anthropic SDK: Provides the API client for Claude Code

[Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) provides an ephemeral space with security, customization for dependencies, resource limits and isolation.

This guide shows you how to install the Claude Agent dependencies in a Vercel Sandbox and verify they work correctly before building your agent application.

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

```javascript
vercel env pull
```

This creates a `.env.local` file with a `VERCEL_OIDC_TOKEN` that the Vercel Sandbox SDK uses for authentication. The OIDC token expires after 12 hours, so you'll need to run `vercel env pull` again if you're developing for extended periods.

Create a new file called `claude-sandbox.ts` that sets up a Vercel Sandbox, installs both Claude Code CLI and the Anthropic SDK, and verifies the installation:

```javascript
import ms from 'ms';
import { Sandbox } from '@vercel/sandbox';
async function main() {
  const sandbox = await Sandbox.create({
    resources: { vcpus: 4 },
    // Timeout in milliseconds: ms('10m') = 600000
    // Defaults to 5 minutes. The maximum is 5 hours for Pro/Enterprise, and 45 minutes for Hobby.
    timeout: ms('10m'),
    runtime: 'node22',
  });
  console.log(\`Sandbox created: ${sandbox.sandboxId}\`);
  console.log(\`Installing Claude Code CLI...\`);
  // Install Claude Code CLI globally
  const installCLI = await sandbox.runCommand({
    cmd: 'npm',
    args: ['install', '-g', '@anthropic-ai/claude-code'],
    stderr: process.stderr,
    stdout: process.stdout,
    sudo: true,
  });
  if (installCLI.exitCode != 0) {
    console.log('installing Claude Code CLI failed');
    process.exit(1);
  }
  console.log(\`✓ Claude Code CLI installed\`);
  console.log(\`Installing Anthropic SDK...\`);
  // Install @anthropic-ai/sdk in the working directory
  const installSDK = await sandbox.runCommand({
    cmd: 'npm',
    args: ['install', '@anthropic-ai/sdk'],
    stderr: process.stderr,
    stdout: process.stdout,
  });
  if (installSDK.exitCode != 0) {
    console.log('installing Anthropic SDK failed');
    process.exit(1);
  }
  console.log(\`✓ Anthropic SDK installed\`);
  console.log(\`Verifying SDK connection...\`);
  // Create a simple script to verify the SDK can be imported
  const verifyScript = \`
import Anthropic from '@anthropic-ai/sdk';
console.log('SDK imported successfully');
console.log('Anthropic SDK version:', Anthropic.VERSION);
console.log('SDK is ready to use');
\`;
  await sandbox.writeFiles([
    {
      path: '/vercel/sandbox/verify.mjs',
      content: Buffer.from(verifyScript),
    },
  ]);
  // Run the verification script
  const verifyRun = await sandbox.runCommand({
    cmd: 'node',
    args: ['verify.mjs'],
    stderr: process.stderr,
    stdout: process.stdout,
  });
  if (verifyRun.exitCode != 0) {
    console.log('SDK verification failed');
    process.exit(1);
  }
  console.log(\`✓ Anthropic SDK is properly connected\`);
  console.log(\`\\nSuccess! Both Claude Code CLI and Anthropic SDK are installed and ready to use.\`);
  // Stop the sandbox
  await sandbox.stop();
  console.log(\`Sandbox stopped\`);
}
main().catch(console.error);
```

1. Creates a sandbox with 4 vCPUs and a 10-minute timeout
2. Installs Claude Code CLI globally using `sudo` for system-level access
3. Installs the Anthropic SDK in the working directory
4. Writes a verification script to the sandbox filesystem using `writeFiles()` with a Buffer
5. Runs the verification to confirm the SDK is properly connected
6. Stops the sandbox when complete
- Uses `sandbox.sandboxId ` to access the unique sandbox identifier
- Checks exit codes with `!= 0 ` for command failures
- Uses `writeFiles()` which accepts an array of file objects with `content ` as a Buffer
- Streams output to `process.stderr` and `process.stdout` for real-time feedback

Run your script with the environment variables from `.env.local`:

```bash
node --env-file .env.local --experimental-strip-types ./claude-sandbox.ts
```

The output should look similar to this:

```javascript
Sandbox created: sbx_abc123...
Installing Claude Code CLI...
✓ Claude Code CLI installed
Installing Anthropic SDK...
✓ Anthropic SDK installed
Verifying SDK connection...
SDK imported successfully
Anthropic SDK version: 1.2.3
SDK is ready to use
✓ Anthropic SDK is properly connected
Success! Both Claude Code CLI and Anthropic SDK are installed and ready to use.
Sandbox stopped
```

To monitor your [sandboxes in the Vercel dashboard](https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fai%2Fsandbox&title=Go+to+your+project+sandboxes):

1. Navigate to your project on [vercel.com](http://vercel.com/)
2. Click the Observability tab
3. Click Sandboxes in the left sidebar
4. View sandbox history, command execution, and resource usage

The script automatically stops the sandbox after verification completes, but you can also manually stop sandboxes from the dashboard if needed.

## Best Practices

Always call `sandbox.stop()` when your work is complete to avoid unnecessary charges:

```javascript
try {
  // Your sandbox operations
} finally {
  await sandbox.stop();
  console.log('Sandbox stopped');
}
```

Configure timeouts based on your installation requirements. For simple dependency installation, 5-10 minutes is usually sufficient:

```javascript
const sandbox = await Sandbox.create({
  timeout: ms('10m'), // 10 minutes for installation
  // Maximum: 5 hours for Pro/Enterprise, 45 minutes for Hobby
});
```

## Next Steps

Now that you've verified Claude Code CLI and Anthropic SDK work in Vercel Sandbox, you can:

1. Add API Authentication: Set up your Anthropic API key to enable agent execution
2. Build AI Features: Use the verified setup to build AI-powered code generation or analysis tools
3. Scale to Production: Deploy your sandbox-based AI applications

## Conclusion

You've successfully installed Claude Code CLI and the Anthropic SDK in a Vercel Sandbox and verified they're properly connected. This setup confirms that your deployment environment can support Claude's Agent SDK.

### Related Documentation

- [Vercel Sandbox documentation](https://vercel.com/docs/vercel-sandbox)
- [Vercel SDK docs](https://vercel.com/docs/vercel-sandbox/sdk-reference)
- [Hosting Claude Agent Guide](https://docs.claude.com/en/api/agent-sdk/hosting)
- [Claude Agent SDK documentation](https://docs.anthropic.com/en/api/agent-sdk) to learn about building AI agents
