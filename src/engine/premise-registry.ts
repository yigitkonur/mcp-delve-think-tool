import type { Premise, ReasonStep } from '../types.js';

export class PremiseRegistry {
  readonly premisesByStep: Map<number, Premise[]> = new Map();

  addPremises(step: number, premises: Premise[]): void {
    this.premisesByStep.set(step, premises);
  }

  /**
   * Returns all premises with confidence below the given threshold.
   */
  getWeakPremises(threshold = 0.4): Array<{ step: number; premise: Premise }> {
    const results: Array<{ step: number; premise: Premise }> = [];
    for (const [step, premises] of this.premisesByStep) {
      for (const premise of premises) {
        if (premise.confidence < threshold) {
          results.push({ step, premise });
        }
      }
    }
    return results;
  }

  /**
   * Returns all premises whose source is 'assumed' (unverified).
   */
  getUnverifiedAssumptions(): Array<{ step: number; premise: Premise }> {
    const results: Array<{ step: number; premise: Premise }> = [];
    for (const [step, premises] of this.premisesByStep) {
      for (const premise of premises) {
        if (premise.source === 'assumed') {
          results.push({ step, premise });
        }
      }
    }
    return results;
  }

  /**
   * Walks the dependency DAG recursively from the given step,
   * returning the minimum confidence across the entire chain.
   * If no premises are found for any step in the chain, returns 1.
   */
  getWeakestInChain(
    stepNumber: number,
    depGraph: Map<number, number[]>
  ): number {
    let minConfidence = 1;
    const visited = new Set<number>();

    const walk = (current: number): void => {
      if (visited.has(current)) return;
      visited.add(current);

      const premises = this.premisesByStep.get(current);
      if (premises) {
        for (const premise of premises) {
          if (premise.confidence < minConfidence) {
            minConfidence = premise.confidence;
          }
        }
      }

      const deps = depGraph.get(current);
      if (deps) {
        for (const dep of deps) {
          walk(dep);
        }
      }
    };

    walk(stepNumber);
    return minConfidence;
  }

  /**
   * Remove premises for the given step numbers (used during history trim).
   */
  removePremisesForSteps(stepNumbers: Set<number>): void {
    for (const step of stepNumbers) {
      this.premisesByStep.delete(step);
    }
  }

  /**
   * Clear all stored premises (used on session switch).
   */
  clear(): void {
    this.premisesByStep.clear();
  }

  /**
   * Rebuild the registry from an array of reason steps (used on session switch).
   */
  rebuildFromSteps(steps: ReasonStep[]): void {
    this.clear();
    for (const step of steps) {
      if (step.premises.length > 0) {
        this.addPremises(step.step, step.premises);
      }
    }
  }
}
