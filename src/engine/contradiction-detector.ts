import type { Premise, Contradiction } from '../types.js';
import type { PremiseRegistry } from './premise-registry.js';

const STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'to', 'and', 'or', 'of', 'in', 'for',
  'that', 'it', 'with', 'on', 'at', 'by', 'from', 'as', 'this',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'shall', 'can',
]);

const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'false', 'incorrect', 'wrong', 'without',
  "isn't", "doesn't", "won't", "can't", "don't", "didn't", "hasn't",
  "haven't", "wasn't", "weren't", "couldn't", "shouldn't", "wouldn't",
]);

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Basic English stemming — strips common suffixes so "returns" and "return"
 * match, "running" and "run" match, etc. Not a full Porter stemmer, just
 * enough for contradiction detection.
 */
function basicStem(word: string): string {
  if (word.length <= 3) return word;

  // Order matters: check longest suffixes first
  if (word.endsWith('ying')) return word.slice(0, -4) + 'y';
  if (word.endsWith('ting') && word.length > 5) return word.slice(0, -4) + 'te';
  if (word.endsWith('ling') && word.length > 5) return word.slice(0, -4) + 'le';
  if (word.endsWith('ning') && word.length > 5 && word[word.length - 5] === word[word.length - 4]) {
    return word.slice(0, -4);
  }
  if (word.endsWith('ing') && word.length > 4) return word.slice(0, -3);
  if (word.endsWith('ied')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);

  return word;
}

function extractSignificantWords(text: string): Set<string> {
  const normalized = normalize(text);
  const words = normalized.split(' ');
  const significant = new Set<string>();
  for (const word of words) {
    if (!STOP_WORDS.has(word) && word.length > 0) {
      significant.add(basicStem(word));
    }
  }
  return significant;
}

/**
 * Extract significant words but strip negation words out.
 * Used for comparing the "core content" of two claims.
 */
function extractContentWords(text: string): Set<string> {
  const normalized = normalize(text);
  const words = normalized.split(' ');
  const content = new Set<string>();
  for (const word of words) {
    if (!STOP_WORDS.has(word) && !NEGATION_WORDS.has(word) && word.length > 0) {
      content.add(basicStem(word));
    }
  }
  return content;
}

function hasNegation(words: Set<string>): boolean {
  for (const word of words) {
    if (NEGATION_WORDS.has(word)) {
      return true;
    }
  }
  return false;
}

function hasNegationInText(text: string): boolean {
  const normalized = normalize(text);
  const words = normalized.split(' ');
  for (const word of words) {
    if (NEGATION_WORDS.has(word)) return true;
  }
  return false;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0) return false;
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
   * in the registry. Uses simple string comparison + basic stemming — no NLP.
   *
   * Detection strategies:
   * 1. Direct negation: claims share core content words but exactly one
   *    contains negation. Compares stemmed content words (negation stripped).
   * 2. Confidence conflict: stemmed significant words have Jaccard > 0.6
   *    and confidence delta > 0.4.
   */
  detect(
    newStep: number,
    newPremises: Premise[],
    registry: PremiseRegistry
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const newPremise of newPremises) {
      const newContentWords = extractContentWords(newPremise.claim);
      const newAllWords = extractSignificantWords(newPremise.claim);
      const newHasNeg = hasNegationInText(newPremise.claim);

      for (const [existingStep, existingPremises] of registry.premisesByStep) {
        if (existingStep === newStep) continue;

        for (const existingPremise of existingPremises) {
          const existingContentWords = extractContentWords(existingPremise.claim);
          const existingAllWords = extractSignificantWords(existingPremise.claim);
          const existingHasNeg = hasNegationInText(existingPremise.claim);

          // Strategy 1: Direct negation contradiction
          // Same core content, but exactly one has negation
          if (newHasNeg !== existingHasNeg) {
            const contentSimilarity = jaccardSimilarity(newContentWords, existingContentWords);
            if (
              contentSimilarity > 0.5 ||
              isSubset(newContentWords, existingContentWords) ||
              isSubset(existingContentWords, newContentWords)
            ) {
              contradictions.push({
                step_a: existingStep,
                claim_a: existingPremise.claim,
                step_b: newStep,
                claim_b: newPremise.claim,
              });
              continue;
            }
          }

          // Strategy 2: High similarity but large confidence gap
          const similarity = jaccardSimilarity(newAllWords, existingAllWords);
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
