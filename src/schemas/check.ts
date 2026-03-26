import { z } from 'zod';

export const checkInputSchema = z.object({
  situation: z
    .string()
    .min(1)
    .describe(
      'Brief description of the task or question you are about to tackle. Used to assess whether structured reasoning is warranted.'
    ),

  complexity_signals: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Indicators that suggest complexity. Examples: "multiple stakeholders", "conflicting requirements", "uncertain data", "high stakes", "novel domain". More signals → deeper reasoning recommended.'
    ),
});

export type CheckInput = z.infer<typeof checkInputSchema>;
