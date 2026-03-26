import { describe, it, expect, beforeEach } from 'vitest';
import { PremiseRegistry } from '../src/engine/premise-registry.js';
import { ContradictionDetector } from '../src/engine/contradiction-detector.js';
import { StabilityScorer } from '../src/engine/stability-scorer.js';
import type { Premise, ReasonStep } from '../src/types.js';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makePremise(
  claim: string,
  confidence: number,
  source: Premise['source'] = 'verified',
): Premise {
  return { claim, source, source_detail: 'test', confidence };
}

function makeReasonStep(
  step: number,
  premises: Premise[],
  overrides: Partial<ReasonStep> = {},
): ReasonStep {
  return {
    step,
    thought: `Thought for step ${step}`,
    premises,
    outcome: `Outcome for step ${step}`,
    next_action: 'continue',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
// PremiseRegistry
// ──────────────────────────────────────────────────────────────

describe('PremiseRegistry', () => {
  let registry: PremiseRegistry;

  beforeEach(() => {
    registry = new PremiseRegistry();
  });

  it('addPremises stores and retrieves correctly', () => {
    const premises = [makePremise('A is true', 0.9), makePremise('B is true', 0.8)];
    registry.addPremises(1, premises);

    expect(registry.premisesByStep.get(1)).toEqual(premises);
    expect(registry.premisesByStep.size).toBe(1);
  });

  it('getWeakPremises returns only premises below threshold', () => {
    registry.addPremises(1, [makePremise('Strong claim', 0.9)]);
    registry.addPremises(2, [makePremise('Weak claim', 0.3)]);
    registry.addPremises(3, [makePremise('Borderline claim', 0.4)]);

    const weak = registry.getWeakPremises(0.4);
    expect(weak).toHaveLength(1);
    expect(weak[0]!.step).toBe(2);
    expect(weak[0]!.premise.claim).toBe('Weak claim');
  });

  it('getWeakPremises uses default threshold of 0.4', () => {
    registry.addPremises(1, [makePremise('Low', 0.2), makePremise('High', 0.8)]);

    const weak = registry.getWeakPremises();
    expect(weak).toHaveLength(1);
    expect(weak[0]!.premise.confidence).toBe(0.2);
  });

  it('getUnverifiedAssumptions returns only source:"assumed" premises', () => {
    registry.addPremises(1, [
      makePremise('Verified fact', 0.9, 'verified'),
      makePremise('Recalled info', 0.7, 'recalled'),
    ]);
    registry.addPremises(2, [
      makePremise('Assumed guess', 0.5, 'assumed'),
      makePremise('Derived conclusion', 0.8, 'derived'),
    ]);

    const unverified = registry.getUnverifiedAssumptions();
    expect(unverified).toHaveLength(1);
    expect(unverified[0]!.step).toBe(2);
    expect(unverified[0]!.premise.source).toBe('assumed');
    expect(unverified[0]!.premise.claim).toBe('Assumed guess');
  });

  it('getWeakestInChain walks dependency graph correctly (chain of 3 steps)', () => {
    // Step 1 -> Step 2 -> Step 3 (3 depends on 2, 2 depends on 1)
    registry.addPremises(1, [makePremise('Root premise', 0.5)]);
    registry.addPremises(2, [makePremise('Mid premise', 0.8)]);
    registry.addPremises(3, [makePremise('Leaf premise', 0.9)]);

    const depGraph = new Map<number, number[]>();
    depGraph.set(3, [2]);
    depGraph.set(2, [1]);

    // Walking from step 3 should find the weakest in the entire chain (step 1 = 0.5)
    const weakest = registry.getWeakestInChain(3, depGraph);
    expect(weakest).toBe(0.5);
  });

  it('getWeakestInChain returns 1 when no premises exist', () => {
    const depGraph = new Map<number, number[]>();
    const weakest = registry.getWeakestInChain(99, depGraph);
    expect(weakest).toBe(1);
  });

  it('getWeakestInChain handles cycles gracefully', () => {
    registry.addPremises(1, [makePremise('A', 0.6)]);
    registry.addPremises(2, [makePremise('B', 0.7)]);

    const depGraph = new Map<number, number[]>();
    depGraph.set(1, [2]);
    depGraph.set(2, [1]); // cycle

    // Should not infinite loop; visited set breaks the cycle
    const weakest = registry.getWeakestInChain(1, depGraph);
    expect(weakest).toBe(0.6);
  });

  it('removePremisesForSteps cleans up properly', () => {
    registry.addPremises(1, [makePremise('A', 0.9)]);
    registry.addPremises(2, [makePremise('B', 0.8)]);
    registry.addPremises(3, [makePremise('C', 0.7)]);

    registry.removePremisesForSteps(new Set([1, 3]));

    expect(registry.premisesByStep.has(1)).toBe(false);
    expect(registry.premisesByStep.has(2)).toBe(true);
    expect(registry.premisesByStep.has(3)).toBe(false);
    expect(registry.premisesByStep.size).toBe(1);
  });

  it('clear removes all premises', () => {
    registry.addPremises(1, [makePremise('A', 0.9)]);
    registry.addPremises(2, [makePremise('B', 0.8)]);

    registry.clear();
    expect(registry.premisesByStep.size).toBe(0);
  });

  it('rebuildFromSteps reconstructs registry from step array', () => {
    // Populate initially
    registry.addPremises(99, [makePremise('Stale', 0.1)]);

    const steps: ReasonStep[] = [
      makeReasonStep(1, [makePremise('First', 0.9)]),
      makeReasonStep(2, [makePremise('Second', 0.8)]),
      makeReasonStep(3, []), // empty premises should be skipped
    ];

    registry.rebuildFromSteps(steps);

    expect(registry.premisesByStep.size).toBe(2);
    expect(registry.premisesByStep.has(1)).toBe(true);
    expect(registry.premisesByStep.has(2)).toBe(true);
    expect(registry.premisesByStep.has(3)).toBe(false); // empty premises skipped
    expect(registry.premisesByStep.has(99)).toBe(false); // stale data cleared
  });
});

// ──────────────────────────────────────────────────────────────
// ContradictionDetector
// ──────────────────────────────────────────────────────────────

describe('ContradictionDetector', () => {
  let detector: ContradictionDetector;
  let registry: PremiseRegistry;

  beforeEach(() => {
    detector = new ContradictionDetector();
    registry = new PremiseRegistry();
  });

  it('detects direct negation contradiction', () => {
    // The detector uses isSubset on significant words (stop words removed).
    // Claim A words: {"cache", "valid"}
    // Claim B words: {"cache", "not", "valid"} — superset of A, and has negation
    registry.addPremises(1, [makePremise('the cache is valid', 0.9)]);

    const newPremises = [makePremise('the cache is not valid', 0.8)];
    const contradictions = detector.detect(2, newPremises, registry);

    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]!.step_a).toBe(1);
    expect(contradictions[0]!.step_b).toBe(2);
    expect(contradictions[0]!.claim_a).toBe('the cache is valid');
    expect(contradictions[0]!.claim_b).toBe('the cache is not valid');
  });

  it('detects confidence conflict (same claim, confidence delta > 0.4)', () => {
    // Two highly similar claims with very different confidence
    registry.addPremises(1, [makePremise('database query performance improves', 0.9)]);

    const newPremises = [makePremise('database query performance improves significantly', 0.3)];
    const contradictions = detector.detect(2, newPremises, registry);

    // Jaccard similarity should be high (shared significant words), delta 0.6 > 0.4
    expect(contradictions.length).toBeGreaterThanOrEqual(1);
    expect(contradictions[0]!.step_a).toBe(1);
    expect(contradictions[0]!.step_b).toBe(2);
  });

  it('no false positives on unrelated claims', () => {
    registry.addPremises(1, [makePremise('The server uses PostgreSQL', 0.9)]);

    const newPremises = [makePremise('Frontend renders React components', 0.8)];
    const contradictions = detector.detect(2, newPremises, registry);

    expect(contradictions).toHaveLength(0);
  });

  it('handles empty registry gracefully', () => {
    const newPremises = [makePremise('Something new', 0.9)];
    const contradictions = detector.detect(1, newPremises, registry);

    expect(contradictions).toHaveLength(0);
  });

  it('does not compare a step against itself', () => {
    // Add premises for step 1 with negation pair
    registry.addPremises(1, [makePremise('System works', 0.9)]);

    // Detect with the SAME step number — should skip self-comparison
    const newPremises = [makePremise('System does not work', 0.8)];
    const contradictions = detector.detect(1, newPremises, registry);

    expect(contradictions).toHaveLength(0);
  });

  it('detects multiple contradictions across steps', () => {
    // Claim A1 words: {"feature", "enabled"}
    // Claim B1 words: {"feature", "not", "enabled"} — superset + negation
    registry.addPremises(1, [makePremise('feature enabled', 0.9)]);
    // Claim A2 words: {"cache", "reliable"}
    // Claim B2 words: {"cache", "not", "reliable"} — superset + negation
    registry.addPremises(2, [makePremise('cache reliable', 0.8)]);

    const newPremises = [
      makePremise('feature not enabled', 0.85),
      makePremise('cache not reliable', 0.7),
    ];
    const contradictions = detector.detect(3, newPremises, registry);

    expect(contradictions).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────
// StabilityScorer
// ──────────────────────────────────────────────────────────────

describe('StabilityScorer', () => {
  let scorer: StabilityScorer;
  let registry: PremiseRegistry;

  beforeEach(() => {
    scorer = new StabilityScorer();
    registry = new PremiseRegistry();
  });

  it('stable chain (all premises > 0.7) produces risk_level "stable"', () => {
    registry.addPremises(1, [makePremise('Strong root', 0.9)]);
    registry.addPremises(2, [makePremise('Strong mid', 0.85)]);
    registry.addPremises(3, [makePremise('Strong leaf', 0.75)]);

    const depGraph = new Map<number, number[]>();
    depGraph.set(3, [2]);
    depGraph.set(2, [1]);

    const report = scorer.score(3, registry, depGraph);

    expect(report.risk_level).toBe('stable');
    expect(report.chain_confidence).toBe(0.75);
    expect(report.weakest_premise).toEqual({
      step: 3,
      claim: 'Strong leaf',
      confidence: 0.75,
    });
  });

  it('fragile chain (weakest premise 0.4-0.7) produces risk_level "fragile"', () => {
    registry.addPremises(1, [makePremise('Strong root', 0.9)]);
    registry.addPremises(2, [makePremise('Fragile mid', 0.5)]);
    registry.addPremises(3, [makePremise('Strong leaf', 0.8)]);

    const depGraph = new Map<number, number[]>();
    depGraph.set(3, [2]);
    depGraph.set(2, [1]);

    const report = scorer.score(3, registry, depGraph);

    expect(report.risk_level).toBe('fragile');
    expect(report.chain_confidence).toBe(0.5);
    expect(report.weakest_premise!.step).toBe(2);
  });

  it('critical chain (weakest premise < 0.4) produces risk_level "critical"', () => {
    registry.addPremises(1, [makePremise('Very weak root', 0.2)]);
    registry.addPremises(2, [makePremise('Strong leaf', 0.95)]);

    const depGraph = new Map<number, number[]>();
    depGraph.set(2, [1]);

    const report = scorer.score(2, registry, depGraph);

    expect(report.risk_level).toBe('critical');
    expect(report.chain_confidence).toBe(0.2);
    expect(report.weakest_premise!.step).toBe(1);
    expect(report.weakest_premise!.claim).toBe('Very weak root');
  });

  it('identifies correct weakest_premise among multiple', () => {
    registry.addPremises(1, [
      makePremise('Claim A', 0.9),
      makePremise('Claim B', 0.3),
      makePremise('Claim C', 0.8),
    ]);

    const depGraph = new Map<number, number[]>();

    const report = scorer.score(1, registry, depGraph);

    expect(report.weakest_premise).toEqual({
      step: 1,
      claim: 'Claim B',
      confidence: 0.3,
    });
    expect(report.chain_confidence).toBe(0.3);
    expect(report.risk_level).toBe('critical');
  });

  it('handles step with no dependencies and no premises', () => {
    const depGraph = new Map<number, number[]>();
    const report = scorer.score(1, registry, depGraph);

    expect(report.chain_confidence).toBe(1.0);
    expect(report.weakest_premise).toBeNull();
    expect(report.risk_level).toBe('stable');
  });

  it('boundary: confidence exactly 0.7 produces "stable"', () => {
    registry.addPremises(1, [makePremise('Boundary claim', 0.7)]);
    const depGraph = new Map<number, number[]>();

    const report = scorer.score(1, registry, depGraph);
    expect(report.risk_level).toBe('stable');
  });

  it('boundary: confidence exactly 0.4 produces "fragile"', () => {
    registry.addPremises(1, [makePremise('Boundary claim', 0.4)]);
    const depGraph = new Map<number, number[]>();

    const report = scorer.score(1, registry, depGraph);
    expect(report.risk_level).toBe('fragile');
  });
});
