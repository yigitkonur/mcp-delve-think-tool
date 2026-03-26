import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DelveServer } from '../src/engine/delve-server.js';
import { DEFAULT_CONFIG, type DelveConfig } from '../src/config.js';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function createConfig(overrides: Partial<DelveConfig> = {}): DelveConfig {
  return {
    features: { ...DEFAULT_CONFIG.features, ...overrides.features },
    display: { ...DEFAULT_CONFIG.display, ...overrides.display },
    system: { ...DEFAULT_CONFIG.system, ...overrides.system },
    server: { ...DEFAULT_CONFIG.server, ...overrides.server },
  };
}

function makeReasonInput(step: number, overrides: Record<string, unknown> = {}) {
  return {
    step,
    thought: `Thinking about step ${step}`,
    premises: [
      {
        claim: `Claim for step ${step}`,
        source: 'verified' as const,
        source_detail: 'test data',
        confidence: 0.85,
      },
    ],
    outcome: `Outcome of step ${step}`,
    next_action: 'continue to next step',
    ...overrides,
  };
}

function makeFrameInput() {
  return {
    problem_statement: 'Test problem',
    assumptions: [
      {
        claim: 'Test assumption',
        source: 'assumed' as const,
        how_to_disprove: 'Check the docs',
      },
    ],
    alternative_interpretations: ['Option A', 'Option B'],
    chosen_interpretation: 'Option A',
    justification: 'It is simpler',
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('processReason', () => {
  let server: DelveServer;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server = new DelveServer(createConfig());
  });

  it('valid step returns step number, completed=false, total_steps', () => {
    const result = server.processReason(makeReasonInput(1));

    expect(result.step).toBe(1);
    expect(result.completed).toBe(false);
    expect(result.total_steps).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('total_steps increments with each call', () => {
    server.processReason(makeReasonInput(1));
    const r2 = server.processReason(makeReasonInput(2));

    expect(r2.total_steps).toBe(2);
  });

  it('revision marks original step revised_by and increments revision count', () => {
    server.processReason(makeReasonInput(1));

    const result = server.processReason(
      makeReasonInput(2, {
        revises_step: 1,
        revision_reason: 'Found better approach',
      }),
    );

    expect(result.revised_step).toBe(1);

    // Verify the original step was marked
    const history = server.getHistory();
    expect(history.steps[0]!.revised_by).toBe(2);
    expect(history.metadata.revisions_count).toBe(1);
  });

  it('rejects revision of future step', () => {
    server.processReason(makeReasonInput(1));

    const result = server.processReason(
      makeReasonInput(2, { revises_step: 3 }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('revisions must target earlier steps'),
    );
  });

  it('rejects revision of same step', () => {
    const result = server.processReason(
      makeReasonInput(1, { revises_step: 1 }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('revisions must target earlier steps'),
    );
  });

  it('warns when revising a non-existent step', () => {
    server.processReason(makeReasonInput(1));

    const result = server.processReason(
      makeReasonInput(3, { revises_step: 2 }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Step 2 not found for revision'),
    );
  });

  it('dependency validation: rejects circular (self-dep)', () => {
    const result = server.processReason(
      makeReasonInput(1, { dependencies: [1] }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Circular dependency'),
    );
  });

  it('dependency validation: rejects future deps', () => {
    const result = server.processReason(
      makeReasonInput(1, { dependencies: [5] }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Future dependency'),
    );
  });

  it('dependency validation: warns about missing deps', () => {
    server.processReason(makeReasonInput(1));

    const result = server.processReason(
      makeReasonInput(3, { dependencies: [2] }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Missing dependency: step 2 not found'),
    );
  });

  it('valid dependency produces no warning', () => {
    server.processReason(makeReasonInput(1));

    const result = server.processReason(
      makeReasonInput(2, { dependencies: [1] }),
    );

    // No dependency-related warnings
    const depWarnings = result.warnings.filter(
      (w) =>
        w.includes('Circular') ||
        w.includes('Future') ||
        w.includes('Missing dependency'),
    );
    expect(depWarnings).toHaveLength(0);
  });

  it('is_final_step marks completion', () => {
    server.processReason(makeReasonInput(1));
    const result = server.processReason(
      makeReasonInput(2, { is_final_step: true }),
    );

    expect(result.completed).toBe(true);

    // History also reflects completion
    const history = server.getHistory();
    expect(history.completed).toBe(true);
  });

  it('warns when no frame_id provided and requireFraming is enabled', () => {
    server = new DelveServer(
      createConfig({ features: { enableSessions: false, requireFraming: true, contradictionCheck: true } }),
    );

    const result = server.processReason(makeReasonInput(1));

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Reasoning without prior problem framing'),
    );
  });

  it('no framing warning when frame_id is provided', () => {
    server = new DelveServer(
      createConfig({ features: { enableSessions: false, requireFraming: true, contradictionCheck: true } }),
    );

    const frame = server.processFrame(makeFrameInput());
    const result = server.processReason(
      makeReasonInput(1, { frame_id: frame.frame_id }),
    );

    const framingWarnings = result.warnings.filter((w) =>
      w.includes('Reasoning without prior problem framing'),
    );
    expect(framingWarnings).toHaveLength(0);
  });

  it('warns when frame_id references non-existent frame', () => {
    const result = server.processReason(
      makeReasonInput(1, { frame_id: 999 }),
    );

    expect(result.warnings).toContainEqual(
      expect.stringContaining('Frame 999 not found'),
    );
  });

  it('contradiction detection produces contradictions array', () => {
    server.processReason(
      makeReasonInput(1, {
        premises: [
          {
            claim: 'Feature enabled',
            source: 'verified',
            source_detail: 'test',
            confidence: 0.9,
          },
        ],
      }),
    );

    const result = server.processReason(
      makeReasonInput(2, {
        premises: [
          {
            claim: 'Feature not enabled',
            source: 'verified',
            source_detail: 'test',
            confidence: 0.85,
          },
        ],
      }),
    );

    expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
    expect(result.contradictions[0]!.step_a).toBe(1);
    expect(result.contradictions[0]!.step_b).toBe(2);

    // Warning about contradictions should also be present
    expect(result.warnings).toContainEqual(
      expect.stringContaining('contradiction(s) detected'),
    );
  });

  it('contradiction detection can be disabled via config', () => {
    server = new DelveServer(
      createConfig({ features: { enableSessions: false, requireFraming: false, contradictionCheck: false } }),
    );

    server.processReason(
      makeReasonInput(1, {
        premises: [
          { claim: 'Feature enabled', source: 'verified', source_detail: 'test', confidence: 0.9 },
        ],
      }),
    );

    const result = server.processReason(
      makeReasonInput(2, {
        premises: [
          { claim: 'Feature not enabled', source: 'verified', source_detail: 'test', confidence: 0.85 },
        ],
      }),
    );

    expect(result.contradictions).toHaveLength(0);
  });

  it('weak premise surfacing in stability report', () => {
    const result = server.processReason(
      makeReasonInput(1, {
        premises: [
          {
            claim: 'Very uncertain claim',
            source: 'assumed',
            source_detail: 'guess',
            confidence: 0.2,
          },
        ],
      }),
    );

    expect(result.stability.weakest_premise).not.toBeNull();
    expect(result.stability.weakest_premise!.confidence).toBe(0.2);
    expect(result.stability.risk_level).toBe('critical');
  });

  it('unverified assumptions counted correctly', () => {
    server.processReason(
      makeReasonInput(1, {
        premises: [
          { claim: 'Verified fact', source: 'verified', source_detail: 'doc', confidence: 0.9 },
          { claim: 'Assumed thing', source: 'assumed', source_detail: 'guess', confidence: 0.5 },
        ],
      }),
    );

    server.processReason(
      makeReasonInput(2, {
        premises: [
          { claim: 'Another assumption', source: 'assumed', source_detail: 'guess', confidence: 0.6 },
        ],
      }),
    );

    const result = server.processReason(makeReasonInput(3));
    // Steps 1 and 2 have 2 assumed premises total, step 3 has 0
    expect(result.unverified_assumptions).toBe(2);
  });

  it('history trimming at maxHistorySize', () => {
    server = new DelveServer(
      createConfig({ system: { maxHistorySize: 3, sessionTimeout: 60 } }),
    );

    // Add 5 steps; max is 3, so oldest 2 should be trimmed
    for (let i = 1; i <= 5; i++) {
      server.processReason(makeReasonInput(i));
    }

    const history = server.getHistory();
    expect(history.steps).toHaveLength(3);
    // Oldest steps (1 and 2) should be gone; steps 3, 4, 5 remain
    expect(history.steps[0]!.step).toBe(3);
    expect(history.steps[1]!.step).toBe(4);
    expect(history.steps[2]!.step).toBe(5);
  });

  it('session isolation: separate histories per session_id', () => {
    server = new DelveServer(
      createConfig({ features: { enableSessions: true, requireFraming: false, contradictionCheck: true } }),
    );

    // Session A: add 2 steps
    server.processReason(makeReasonInput(1, { session_id: 'session-a' }));
    server.processReason(makeReasonInput(2, { session_id: 'session-a' }));

    // Session B: add 1 step
    server.processReason(makeReasonInput(1, { session_id: 'session-b' }));

    // Switch back to session A
    const result = server.processReason(
      makeReasonInput(3, { session_id: 'session-a' }),
    );

    // Session A should now have 3 steps
    expect(result.total_steps).toBe(3);

    // Switch to session B and verify isolation
    const resultB = server.processReason(
      makeReasonInput(2, { session_id: 'session-b' }),
    );
    expect(resultB.total_steps).toBe(2);
  });

  it('tools_used tracked in metadata', () => {
    server.processReason(
      makeReasonInput(1, { tools_used: ['grep', 'read'] }),
    );
    server.processReason(
      makeReasonInput(2, { tools_used: ['grep', 'write'] }),
    );

    const history = server.getHistory();
    const toolsUsed = history.metadata.tools_used;
    expect(toolsUsed).toContain('grep');
    expect(toolsUsed).toContain('read');
    expect(toolsUsed).toContain('write');
    // grep appears in both but should be deduplicated
    expect(toolsUsed.filter((t) => t === 'grep')).toHaveLength(1);
  });

  it('stability report includes dependency chain', () => {
    server.processReason(
      makeReasonInput(1, {
        premises: [
          { claim: 'Root weak', source: 'assumed', source_detail: 'guess', confidence: 0.3 },
        ],
      }),
    );

    const result = server.processReason(
      makeReasonInput(2, {
        dependencies: [1],
        premises: [
          { claim: 'Strong leaf', source: 'verified', source_detail: 'test', confidence: 0.95 },
        ],
      }),
    );

    // The chain should reflect the weak root premise
    expect(result.stability.chain_confidence).toBe(0.3);
    expect(result.stability.risk_level).toBe('critical');
    expect(result.stability.weakest_premise!.step).toBe(1);
  });
});
