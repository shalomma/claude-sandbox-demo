import http from "node:http";
import ms from "ms";
import { Sandbox } from "@vercel/sandbox";

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required. Set it in .env.local or environment.");
  process.exit(1);
}

async function handleQuery(prompt: string): Promise<string> {
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
    if (install.exitCode !== 0) {
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
    });

    if (command.exitCode !== 0) {
      const stderr = await command.output("stderr");
      throw new Error(`Claude Code exited with code ${command.exitCode}: ${stderr}`);
    }

    return await command.output("stdout");
  } finally {
    await sandbox.stop();
  }
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Main endpoint
  if (req.method === "POST" && req.url === "/query") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    let prompt: string;
    try {
      const parsed = JSON.parse(body);
      prompt = parsed.prompt;
      if (!prompt) throw new Error("missing prompt");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: 'Invalid request. Send JSON: { "prompt": "..." }' }));
      return;
    }

    console.log(`[${new Date().toISOString()}] Query: ${prompt.slice(0, 100)}...`);

    try {
      const result = await handleQuery(prompt);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result }));
    } catch (err) {
      console.error("Query failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. POST to /query" }));
});

server.listen(PORT, () => {
  console.log(`Claude Code API server running on http://localhost:${PORT}`);
  console.log(`POST /query with { "prompt": "your request" }`);
});
