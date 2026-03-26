import type { MCPServer } from 'mcp-use/server';
import { text, error } from 'mcp-use/server';
import { frameInputSchema } from '../schemas/frame.js';
import type { DelveServer } from '../engine/delve-server.js';

export function registerFrameTool(server: MCPServer, engine: DelveServer): void {
  server.tool(
    {
      name: 'delve-frame',
      description: `Force a problem perception check before solving. Surfaces assumptions, explores alternative interpretations, and commits to a justified framing.

USE WHEN:
- Starting a new problem or task
- The problem statement is ambiguous or multi-faceted
- You want to verify you're solving the right problem
- Multiple stakeholders might define success differently

WORKFLOW:
1. State the problem as you understand it
2. List your assumptions with how each could be disproved
3. Provide at least 2 alternative interpretations
4. Choose one and justify why

Returns a frame_id to link subsequent reasoning steps.`,
      schema: frameInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const result = engine.processFrame(args);
        return text(JSON.stringify(result, null, 2));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return error(message);
      }
    },
  );
}
