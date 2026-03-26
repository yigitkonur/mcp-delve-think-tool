import type { Premise, Contradiction } from '../types.js';
import type { PremiseRegistry } from './premise-registry.js';

const STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'to', 'and', 'or', 'of', 'in', 'for',
  'that', 'it', 'with', 'on', 'at', 'by', 'from', 'as', 'this',
]);

const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'false', 'incorrect', 'wrong',
  "isn't", "doesn't", "won't", "can't",
]);

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function extractSignificantWords(text: string): Set<string> {
  const normalized = normalize(text);
  const words = normalized.split(' ');
  const significant = new Set<string>();
  for (const word of words) {
    if (!STOP_WORDS.has(word) && word.length > 0) {
      significant.add(word);
    }
  }
  return significant;
}

function hasNegation(words: Set<string>): boolean {
  for (const word of words) {
    if (NEGATION_WORDS.has(word)) {
      return true;
    }
  }
  return false;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) {
    if (!b.has(word)) return false;
  }
  return true;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of a) {
    if (b.has(word)) intersectionSize++;
  }

  const unionSize = a.size + b.size - intersectionSize;
  if (unionSize === 0) return 0;
  return intersectionSize / unionSize;
}

export class ContradictionDetector {
  /**
   * Detects contradictions between new premises and all existing premises
   * in the registry. Uses simple string comparison — no NLP.
   *
   * Detection strategies:
   * 1. Direct contradiction: one claim's significant words are a subset of the
   *    other, and one contains negation words while the other does not.
   * 2. Confidence contradiction: two claims have Jaccard similarity > 0.6 on
   *    significant words but confidence delta > 0.4.
   */
  detect(
    newStep: number,
    newPremises: Premise[],
    registry: PremiseRegistry
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const newPremise of newPremises) {
      const newWords = extractSignificantWords(newPremise.claim);
      const newHasNegation = hasNegation(newWords);

      for (const [existingStep, existingPremises] of registry.premisesByStep) {
        // Don't compare a step against itself
        if (existingStep === newStep) continue;

        for (const existingPremise of existingPremises) {
          const existingWords = extractSignificantWords(existingPremise.claim);
          const existingHasNegation = hasNegation(existingWords);

          // Strategy 1: Direct contradiction via negation
          // One claim's significant words are a subset of the other,
          // and exactly one contains negation
          if (newHasNegation !== existingHasNegation) {
            if (isSubset(newWords, existingWords) || isSubset(existingWords, newWords)) {
              contradictions.push({
                step_a: existingStep,
                claim_a: existingPremise.claim,
                step_b: newStep,
                claim_b: newPremise.claim,
              });
              continue; // Already flagged, skip strategy 2
            }
          }

          // Strategy 2: High similarity but large confidence gap
          const similarity = jaccardSimilarity(newWords, existingWords);
          if (similarity > 0.6) {
            const confidenceDelta = Math.abs(
              newPremise.confidence - existingPremise.confidence
            );
            if (confidenceDelta > 0.4) {
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
    }

    return contradictions;
  }
}
