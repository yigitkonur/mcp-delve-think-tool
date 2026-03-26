import type { MCPServer } from 'mcp-use/server';
import { text, error } from 'mcp-use/server';
import { checkInputSchema } from '../schemas/check.js';
import type { DelveServer } from '../engine/delve-server.js';

export function registerCheckTool(server: MCPServer, engine: DelveServer): void {
  server.tool(
    {
      name: 'delve-check',
      description: `Quick triage: should you use structured reasoning for this task? Analyzes complexity signals and recommends an approach.

USE WHEN:
- Before starting any task, to decide if full reasoning is warranted
- You're unsure if a problem needs structured decomposition
- You want to avoid reasoning overhead on simple tasks

RETURNS:
- "proceed": task is simple, just do it without structured reasoning
- "frame_first": task is ambiguous, use delve-frame to clarify the problem
- "use_reasoning": task is complex, use delve-frame then delve-reason for full structured reasoning
- suggested_depth: estimated number of reasoning steps needed`,
      schema: checkInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const result = engine.processCheck(args);
        return text(JSON.stringify(result, null, 2));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return error(message);
      }
    },
  );
}
