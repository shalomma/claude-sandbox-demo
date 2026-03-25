import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

export const maxDuration = 300;

export async function POST(req: Request) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let prompt: string;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) throw new Error("missing prompt");
  } catch {
    return Response.json({ error: 'Invalid request. Send JSON: { "prompt": "..." }' }, { status: 400 });
  }

  const sandbox = await Sandbox.create({
    resources: { vcpus: 4 },
    timeout: ms("10m"),
    runtime: "node22",
  });

  try {
    // Install Claude Code CLI
    const install = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "-g", "@anthropic-ai/claude-code"],
      sudo: true,
    });
    const installExit = await install.exitCode;
    if (installExit !== 0) {
      const err = await install.output("stderr");
      throw new Error(`Failed to install Claude Code CLI: ${err}`);
    }

    // Run Claude Code with --print for non-interactive, full agentic mode
    const command = await sandbox.runCommand({
      cmd: "claude",
      args: [
        "--print",
        "--output-format", "text",
        "--verbose",
        prompt,
      ],
      env: { ANTHROPIC_API_KEY },
      timeout: ms("5m"),
    });

    const exitCode = await command.exitCode;
    if (exitCode !== 0) {
      const stderr = await command.output("stderr");
      throw new Error(`Claude Code exited with code ${exitCode}: ${stderr}`);
    }

    const result = await command.output("stdout");
    return Response.json({ result });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  } finally {
    await sandbox.stop();
  }
}
