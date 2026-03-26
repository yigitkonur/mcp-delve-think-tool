#!/usr/bin/env node

import { MCPServer, object } from 'mcp-use/server';
import { loadConfig } from './src/config.js';
import { DelveServer } from './src/engine/delve-server.js';
import { registerAllTools } from './src/tools/registry.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig();
const engine = new DelveServer(config);

const allowedOrigins = config.server.allowedOrigins;

const server = new MCPServer({
  name: 'mcp-delve-think-tool',
  version: '1.0.0',
  title: 'delve — think tool for ai agents',
  description:
    'makes agents question their assumptions before committing. three tools: delve-check (triage), delve-frame (problem framing), delve-reason (premise-tracked reasoning with contradiction detection).',
  host: config.server.host,
  ...(allowedOrigins.length > 0
    ? {
        cors: {
          origin: allowedOrigins,
          allowMethods: ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS'],
          allowHeaders: [
            'Content-Type',
            'Accept',
            'Authorization',
            'mcp-protocol-version',
            'mcp-session-id',
          ],
          exposeHeaders: ['mcp-session-id'],
        },
        allowedOrigins,
      }
    : {}),
});

registerAllTools(server, engine);

// Health endpoint
server.get('/health', (c) =>
  c.json({
    status: 'ok',
    name: 'mcp-delve-think-tool',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    config: {
      requireFraming: config.features.requireFraming,
      contradictionCheck: config.features.contradictionCheck,
      sessions: config.features.enableSessions,
      maxHistory: config.system.maxHistorySize,
    },
  }),
);

// Health as MCP resource
server.resource(
  {
    name: 'Server Health',
    uri: 'health://status',
    description: 'delve server health and config',
  },
  async () =>
    object({
      status: 'ok',
      name: 'mcp-delve-think-tool',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
);

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string, exitCode: number): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error(`[${signal}] delve shutting down...`);

  const forceExit = setTimeout(() => {
    console.error(`Forced exit after ${SHUTDOWN_TIMEOUT_MS}ms`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await (server as unknown as { close(): Promise<void> }).close();
    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (err) {
    console.error('Shutdown error:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection', 1);
});

// Start
console.error('delve starting...');
console.error(`  Require framing: ${config.features.requireFraming}`);
console.error(`  Contradiction check: ${config.features.contradictionCheck}`);
console.error(`  Sessions: ${config.features.enableSessions}`);
console.error(`  Max history: ${config.system.maxHistorySize} steps`);

await server.listen(config.server.port);

console.error(`delve running on port ${config.server.port}`);
console.error('Tools: delve-check, delve-frame, delve-reason');
