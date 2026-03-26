import type { MCPServer } from 'mcp-use/server';
import { text, error } from 'mcp-use/server';
import { reasonInputSchema } from '../schemas/reason.js';
import type { DelveServer } from '../engine/delve-server.js';

export function registerReasonTool(server: MCPServer, engine: DelveServer): void {
  server.tool(
    {
      name: 'delve-reason',
      description: `Record a premise-tracked reasoning step. Each premise declares its own confidence and source, enabling the server to detect contradictions, surface weak assumptions, and score chain stability.

USE WHEN:
- Working through a multi-step problem
- You need to track what you're assuming vs. what you've verified
- Building on previous reasoning steps
- You want server-side contradiction detection

WORKFLOW:
1. Start with step=1
2. Declare premises with per-premise confidence and source (verified/recalled/assumed/derived)
3. State your thought process and outcome
4. Optionally link to a delve-frame result via frame_id
5. Use revises_step to correct earlier reasoning
6. Set is_final_step=true when done

RESPONSE INCLUDES:
- warnings: unframed reasoning, weak premises, unverified assumptions
- contradictions: premises that conflict with earlier steps
- stability: chain confidence score and risk level (stable/fragile/critical)`,
      schema: reasonInputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: false,
        destructiveHint: false,
      },
    },
    async (args) => {
      try {
        const result = await engine.processReason(args);
        return text(JSON.stringify(result, null, 2));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return error(message);
      }
    },
  );
}
