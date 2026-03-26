import type { MCPServer } from 'mcp-use/server';
import type { DelveServer } from '../engine/delve-server.js';
import { registerFrameTool } from './frame.js';
import { registerReasonTool } from './reason.js';
import { registerCheckTool } from './check.js';

export function registerAllTools(server: MCPServer, engine: DelveServer): void {
  registerFrameTool(server, engine);
  registerReasonTool(server, engine);
  registerCheckTool(server, engine);
}
