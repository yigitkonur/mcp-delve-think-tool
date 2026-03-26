import type { StabilityReport } from '../types.js';
import type { PremiseRegistry } from './premise-registry.js';

export class StabilityScorer {
  /**
   * Scores chain stability by finding the weakest premise in the
   * entire dependency path from the given step back to all roots.
   *
   * Algorithm:
   * 1. BFS from the given step through the dependency DAG.
   * 2. At each step, find the minimum premise confidence.
   * 3. chain_confidence = global minimum across all visited steps.
   * 4. weakest_premise = the specific premise with lowest confidence.
   * 5. risk_level:  >= 0.7 → "stable", >= 0.4 → "fragile", < 0.4 → "critical"
   */
  score(
    stepNumber: number,
    registry: PremiseRegistry,
    depGraph: Map<number, number[]>
  ): StabilityReport {
    let chainConfidence = 1.0;
    let weakestPremise: { step: number; claim: string; confidence: number } | null = null;

    const visited = new Set<number>();
    const queue: number[] = [stepNumber];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const premises = registry.premisesByStep.get(current);
      if (premises) {
        for (const premise of premises) {
          if (premise.confidence < chainConfidence) {
            chainConfidence = premise.confidence;
            weakestPremise = {
              step: current,
              claim: premise.claim,
              confidence: premise.confidence,
            };
          }
        }
      }

      const deps = depGraph.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    let riskLevel: 'stable' | 'fragile' | 'critical';
    if (chainConfidence >= 0.7) {
      riskLevel = 'stable';
    } else if (chainConfidence >= 0.4) {
      riskLevel = 'fragile';
    } else {
      riskLevel = 'critical';
    }

    return {
      weakest_premise: weakestPremise,
      chain_confidence: chainConfidence,
      risk_level: riskLevel,
    };
  }
}
