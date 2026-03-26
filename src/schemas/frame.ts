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
      'List every assumption underlying your understanding of the problem. Include implicit ones — things you\'re taking for granted. Each must include how it could be disproved.'
    ),

  alternative_interpretations: z
    .array(z.string().min(1))
    .min(2)
    .describe(
      'At least 2 GENUINELY DIFFERENT ways to interpret the problem. "It could be A" and "It could be A but slightly different" is not two alternatives. Each should point to a different root cause or a different solution direction.'
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

  strongest_objection: z
    .string()
    .optional()
    .describe(
      'What\'s the best argument AGAINST your chosen interpretation? Steel-man the opposition — if you can\'t argue against your own choice, you haven\'t thought hard enough.'
    ),

  pre_mortem: z
    .string()
    .optional()
    .describe(
      'Imagine you\'re wrong. What\'s the most likely reason your interpretation failed? Name the specific failure mode, not a vague "I might be wrong."'
    ),

  predictions: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'If your interpretation is correct, name 2-3 specific, observable things that should be true. These become your verification targets for subsequent reasoning steps.'
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
