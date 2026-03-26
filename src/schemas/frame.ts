import { z } from 'zod';

const assumptionSchema = z.object({
  claim: z
    .string()
    .min(1)
    .describe('A specific assumption underlying the problem. State it as a falsifiable claim.'),
  source: z
    .enum(['verified', 'recalled', 'assumed'])
    .describe(
      'How was this assumption obtained? "verified" = checked against a source, "recalled" = from memory/training, "assumed" = taken as given without evidence.'
    ),
  how_to_disprove: z
    .string()
    .min(1)
    .describe(
      'Describe a concrete way to disprove this assumption. What evidence or test would show it is wrong?'
    ),
});

export const frameInputSchema = z.object({
  problem_statement: z
    .string()
    .min(1)
    .describe(
      'The problem or question to reason about. Be specific — vague framing leads to vague reasoning.'
    ),

  assumptions: z
    .array(assumptionSchema)
    .describe(
      'List every assumption underlying your understanding of the problem. Each must include how it could be disproved.'
    ),

  alternative_interpretations: z
    .array(z.string().min(1))
    .min(2)
    .describe(
      'At least 2 alternative ways to interpret the problem. Forces you to consider that your first reading may not be the only valid one.'
    ),

  chosen_interpretation: z
    .string()
    .min(1)
    .describe(
      'Which interpretation you are committing to for this reasoning session. Must be one you listed above or a synthesis of them.'
    ),

  justification: z
    .string()
    .min(1)
    .describe(
      'Why did you choose this interpretation over the alternatives? What makes it the strongest framing?'
    ),

  stakes: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe(
      'How consequential is getting this wrong? "low" = minor inconvenience, "medium" = meaningful impact, "high" = critical failure. Affects depth of reasoning recommended.'
    ),

  prior_frames: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      'IDs of previous frames this builds on. Use when refining or extending an earlier problem framing.'
    ),

  session_id: z
    .string()
    .optional()
    .describe(
      'Optional session identifier. When provided, reasoning history is scoped to this session, allowing parallel reasoning threads.'
    ),
});

export type FrameInput = z.infer<typeof frameInputSchema>;
