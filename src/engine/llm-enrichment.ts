import type { Premise, Contradiction } from '../types.js';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 10_000;

interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

async function llmCall(config: LLMConfig, prompt: string, maxTokens: number = 200): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model ?? DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as ChatResponse;
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Semantic contradiction detection via LLM.
 * Only called as a second pass when string matching found nothing.
 * Sends pairs of short claims (100-200 tokens total per call).
 */
export async function detectSemanticContradictions(
  config: LLMConfig,
  newStep: number,
  newPremises: Premise[],
  existingPremises: Map<number, Premise[]>
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];

  for (const newPremise of newPremises) {
    for (const [existingStep, premises] of existingPremises) {
      if (existingStep === newStep) continue;

      for (const existingPremise of premises) {
        const prompt =
          `Do these two claims contradict each other? Answer ONLY "yes" or "no".\n\n` +
          `Claim A: "${existingPremise.claim}"\n` +
          `Claim B: "${newPremise.claim}"`;

        const result = await llmCall(config, prompt, 10);
        if (result && result.toLowerCase().startsWith('yes')) {
          contradictions.push({
            step_a: existingStep,
            claim_a: existingPremise.claim,
            step_b: newStep,
            claim_b: newPremise.claim,
          });
        }
      }
    }
  }

  return contradictions;
}

/**
 * Generate natural language feedback for the agent.
 * Summarizes warnings, contradictions, and stability into actionable guidance.
 */
export async function generateFeedback(
  config: LLMConfig,
  context: {
    step: number;
    warnings: string[];
    contradictions: Contradiction[];
    chainConfidence: number;
    riskLevel: string;
    unverifiedCount: number;
  }
): Promise<string | null> {
  if (context.warnings.length === 0 && context.contradictions.length === 0 && context.riskLevel === 'stable') {
    return null; // Nothing to say — don't waste a call
  }

  const parts: string[] = [];

  if (context.contradictions.length > 0) {
    const contList = context.contradictions
      .map(c => `- Step ${c.step_a}: "${c.claim_a}" vs Step ${c.step_b}: "${c.claim_b}"`)
      .join('\n');
    parts.push(`Contradictions found:\n${contList}`);
  }

  if (context.riskLevel !== 'stable') {
    parts.push(`Chain stability: ${context.riskLevel} (confidence: ${context.chainConfidence})`);
  }

  if (context.unverifiedCount > 0) {
    parts.push(`Unverified assumptions: ${context.unverifiedCount}`);
  }

  if (parts.length === 0) return null;

  const prompt =
    `You are reviewing an AI agent's reasoning chain at step ${context.step}. ` +
    `Give 1-2 sentences of direct, actionable feedback. No preamble. Be specific about what to fix.\n\n` +
    parts.join('\n\n');

  return llmCall(config, prompt, 150);
}

/**
 * Check if LLM enrichment is available (API key configured).
 */
export function getLLMConfig(): LLMConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL,
    model: process.env.DELVE_LLM_MODEL ?? DEFAULT_MODEL,
  };
}
