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

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('processCheck', () => {
  let server: DelveServer;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server = new DelveServer(createConfig());
  });

  it('0 signals returns "proceed"', () => {
    const result = server.processCheck({
      situation: 'Simple rename of a variable',
      complexity_signals: [],
    });

    expect(result.recommendation).toBe('proceed');
    expect(result.suggested_depth).toBe(0);
    expect(result.reason).toContain('No complexity signals');
  });

  it('1 signal returns "proceed"', () => {
    const result = server.processCheck({
      situation: 'Add a utility function',
      complexity_signals: ['multiple files affected'],
    });

    expect(result.recommendation).toBe('proceed');
    expect(result.suggested_depth).toBe(2);
    expect(result.reason).toContain('Only 1 complexity signal');
  });

  it('2 signals returns "frame_first"', () => {
    const result = server.processCheck({
      situation: 'Refactor authentication flow',
      complexity_signals: ['security implications', 'multiple services involved'],
    });

    expect(result.recommendation).toBe('frame_first');
    expect(result.suggested_depth).toBe(4);
    expect(result.reason).toContain('2 complexity signals');
  });

  it('3 signals returns "frame_first"', () => {
    const result = server.processCheck({
      situation: 'Migrate database schema',
      complexity_signals: [
        'data integrity risk',
        'backward compatibility needed',
        'downtime considerations',
      ],
    });

    expect(result.recommendation).toBe('frame_first');
    expect(result.suggested_depth).toBe(6);
  });

  it('4 signals returns "use_reasoning"', () => {
    const result = server.processCheck({
      situation: 'Design new distributed caching layer',
      complexity_signals: [
        'multiple trade-offs',
        'performance implications',
        'cost considerations',
        'team expertise gap',
      ],
    });

    expect(result.recommendation).toBe('use_reasoning');
    expect(result.suggested_depth).toBe(8);
    expect(result.reason).toContain('4 complexity signals');
  });

  it('5+ signals returns "use_reasoning"', () => {
    const result = server.processCheck({
      situation: 'Complete system redesign',
      complexity_signals: [
        'architectural change',
        'security audit needed',
        'performance regression risk',
        'multi-team coordination',
        'compliance requirements',
        'legacy migration',
      ],
    });

    expect(result.recommendation).toBe('use_reasoning');
    expect(result.suggested_depth).toBe(12);
  });

  it('suggested_depth is capped at 20', () => {
    // 11 signals * 2 = 22, but should be capped at 20
    const signals = Array.from({ length: 11 }, (_, i) => `signal-${i + 1}`);

    const result = server.processCheck({
      situation: 'Extremely complex task',
      complexity_signals: signals,
    });

    expect(result.recommendation).toBe('use_reasoning');
    expect(result.suggested_depth).toBe(20);
  });

  it('suggested_depth scales correctly: signals * 2', () => {
    const testCases = [
      { signals: 0, expected: 0 },
      { signals: 1, expected: 2 },
      { signals: 2, expected: 4 },
      { signals: 5, expected: 10 },
      { signals: 7, expected: 14 },
      { signals: 10, expected: 20 }, // capped
      { signals: 15, expected: 20 }, // capped
    ];

    for (const { signals, expected } of testCases) {
      const signalList = Array.from({ length: signals }, (_, i) => `signal-${i}`);
      const result = server.processCheck({
        situation: 'Test',
        complexity_signals: signalList,
      });

      expect(result.suggested_depth).toBe(expected);
    }
  });

  it('reason string includes signal names for frame_first', () => {
    const result = server.processCheck({
      situation: 'Test situation',
      complexity_signals: ['alpha', 'beta'],
    });

    expect(result.reason).toContain('alpha');
    expect(result.reason).toContain('beta');
  });

  it('reason string includes signal names for use_reasoning', () => {
    const result = server.processCheck({
      situation: 'Test situation',
      complexity_signals: ['gamma', 'delta', 'epsilon', 'zeta'],
    });

    expect(result.reason).toContain('gamma');
    expect(result.reason).toContain('delta');
    expect(result.reason).toContain('epsilon');
    expect(result.reason).toContain('zeta');
  });
});
