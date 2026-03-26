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

function makeFrameInput(overrides: Record<string, unknown> = {}) {
  return {
    problem_statement: 'How should we design the caching layer?',
    assumptions: [
      {
        claim: 'Read-heavy workload',
        source: 'verified' as const,
        how_to_disprove: 'Check write/read ratio in production metrics',
      },
      {
        claim: 'Data is mostly immutable',
        source: 'assumed' as const,
        how_to_disprove: 'Inspect update frequency in analytics',
      },
    ],
    alternative_interpretations: [
      'Use Redis as a distributed cache',
      'Use in-memory LRU per process',
      'Skip caching, optimize queries instead',
    ],
    chosen_interpretation: 'Use Redis as a distributed cache',
    justification: 'Shared state across instances, TTL support, proven at scale',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('processFrame', () => {
  let server: DelveServer;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server = new DelveServer(createConfig());
  });

  it('valid frame returns frame_id, assumptions_count, alternatives_count, warnings', () => {
    const result = server.processFrame(makeFrameInput());

    expect(result.frame_id).toBe(1);
    expect(result.assumptions_count).toBe(2);
    expect(result.alternatives_count).toBe(3);
    expect(result.warnings).toEqual([]);
  });

  it('auto-increments frame_id across calls', () => {
    const r1 = server.processFrame(makeFrameInput());
    const r2 = server.processFrame(
      makeFrameInput({ problem_statement: 'Second problem' }),
    );
    const r3 = server.processFrame(
      makeFrameInput({ problem_statement: 'Third problem' }),
    );

    expect(r1.frame_id).toBe(1);
    expect(r2.frame_id).toBe(2);
    expect(r3.frame_id).toBe(3);
  });

  it('stores frames in history', () => {
    server.processFrame(makeFrameInput());

    const history = server.getHistory();
    expect(history.frames).toHaveLength(1);
    expect(history.frames[0]!.problem_statement).toBe(
      'How should we design the caching layer?',
    );
    expect(history.metadata.frames_created).toBe(1);
  });

  it('validates prior_frames (non-existent frame warns but does not crash)', () => {
    // Frame 999 does not exist, but processFrame should not throw
    const result = server.processFrame(
      makeFrameInput({ prior_frames: [999] }),
    );

    expect(result.frame_id).toBe(1);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Prior frame 999 not found'),
    );
    // Verify it stored the prior_frames reference even if invalid
    const history = server.getHistory();
    expect(history.frames[0]!.prior_frames).toEqual([999]);
  });

  it('valid prior_frames references existing frame', () => {
    const r1 = server.processFrame(makeFrameInput());
    const r2 = server.processFrame(
      makeFrameInput({
        problem_statement: 'Refine the caching strategy',
        prior_frames: [r1.frame_id],
      }),
    );

    expect(r2.frame_id).toBe(2);
    const history = server.getHistory();
    expect(history.frames[1]!.prior_frames).toEqual([1]);
  });

  it('returns correct stakes value when provided', () => {
    const result = server.processFrame(
      makeFrameInput({ stakes: 'high' }),
    );

    expect(result.stakes).toBe('high');
  });

  it('returns "unspecified" stakes when not provided', () => {
    const result = server.processFrame(makeFrameInput());

    expect(result.stakes).toBe('unspecified');
  });

  it('frame with zero assumptions returns assumptions_count 0', () => {
    const result = server.processFrame(
      makeFrameInput({ assumptions: [] }),
    );

    expect(result.assumptions_count).toBe(0);
  });

  it('frame with zero alternatives returns alternatives_count 0', () => {
    const result = server.processFrame(
      makeFrameInput({ alternative_interpretations: [] }),
    );

    expect(result.alternatives_count).toBe(0);
  });
});
