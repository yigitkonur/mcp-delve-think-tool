import { z } from 'zod';

const premiseSchema = z.object({
  claim: z
    .string()
    .min(1)
    .describe('A single factual claim this reasoning step depends on.'),
  source: z
    .enum(['verified', 'recalled', 'assumed', 'derived'])
    .describe(
      'Origin of the claim. "verified" = confirmed against a source, "recalled" = from memory, "assumed" = taken without evidence, "derived" = logically derived from prior premises.'
    ),
  source_detail: z
    .string()
    .min(1)
    .describe(
      'Where exactly did this claim come from? Cite the tool, document, URL, prior step number, or reasoning that produced it.'
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Your confidence in this premise, from 0 (no confidence) to 1 (certain). Be honest — overconfidence is the root of reasoning failures.'
    ),
});

const structuredActionSchema = z.object({
  tool: z
    .string()
    .optional()
    .describe('Name of the MCP tool to invoke, if applicable.'),
  action: z
    .string()
    .min(1)
    .describe('What action to take next. Be specific about the goal.'),
  parameters: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Parameters to pass to the tool, if applicable.'),
  expectedOutput: z
    .string()
    .optional()
    .describe('What you expect the action to produce. Helps detect surprises early.'),
});

const nextActionSchema = z.union([
  z
    .string()
    .min(1)
    .describe('Free-text description of the next action to take.'),
  structuredActionSchema.describe(
    'Structured action with optional tool invocation details.'
  ),
]);

export const reasonInputSchema = z.object({
  step: z
    .number()
    .int()
    .positive()
    .describe(
      'Sequential step number. Must be unique and incrementing. Start from 1.'
    ),

  thought: z
    .string()
    .min(1)
    .describe(
      'Your actual reasoning for this step. Show your work — explain what you are considering, weighing, or concluding.'
    ),

  premises: z
    .array(premiseSchema)
    .min(1)
    .describe(
      'Every factual claim this step depends on. At least one required. Each must have a confidence score and source.'
    ),

  outcome: z
    .string()
    .min(1)
    .describe(
      'The conclusion or result of this reasoning step. What did you determine?'
    ),

  next_action: nextActionSchema.describe(
    'What should happen next? Either a free-text description or a structured action object with tool details.'
  ),

  // Optional fields
  frame_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'ID of the problem frame this step belongs to. Links reasoning to a specific problem framing created with delve-frame.'
    ),

  revises_step: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'If this step revises a previous step, provide the step number being revised. The original step will be marked as superseded.'
    ),

  revision_reason: z
    .string()
    .optional()
    .describe(
      'Why is the previous step being revised? What was wrong or incomplete about it?'
    ),

  is_final_step: z
    .boolean()
    .optional()
    .describe(
      'Set to true when this is the last reasoning step. Marks the reasoning chain as complete.'
    ),

  dependencies: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      'Step numbers this step logically depends on. Used for stability analysis — if a dependency is weak, this step inherits that weakness.'
    ),

  tools_used: z
    .array(z.string())
    .optional()
    .describe(
      'Names of tools invoked during this step. Tracked for metadata and debugging.'
    ),

  external_context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Arbitrary key-value data from external sources relevant to this step. Stored but not processed by the engine.'
    ),

  session_id: z
    .string()
    .optional()
    .describe(
      'Optional session identifier. When provided, reasoning history is scoped to this session.'
    ),
});

export type ReasonInput = z.infer<typeof reasonInputSchema>;
