import type { DelveConfig } from '../config.js';
import type {
  Frame,
  ReasonStep,
  DelveHistory,
  DelveMetadata,
  SessionEntry,
  Contradiction,
  StabilityReport,
  FrameResult,
  ReasonResult,
  CheckRequest,
  CheckResult,
  StakeLevel,
} from '../types.js';
import { SESSION_CLEANUP_INTERVAL } from '../constants.js';
import { PremiseRegistry } from './premise-registry.js';
import { ContradictionDetector } from './contradiction-detector.js';
import { StabilityScorer } from './stability-scorer.js';

export class DelveServer {
  private history: DelveHistory;
  private readonly config: DelveConfig;
  private readonly sessions: Map<string, SessionEntry> = new Map();

  // O(1) indexes
  private stepIndex: Map<number, ReasonStep> = new Map();
  private stepNumbers: Set<number> = new Set();
  private frameIndex: Map<number, Frame> = new Map();

  private frameCounter = 0;
  private toolsUsedSet: Set<string> = new Set();
  private stepsSinceCleanup = 0;

  // Engine components
  private readonly premiseRegistry: PremiseRegistry;
  private readonly contradictionDetector: ContradictionDetector;
  private readonly stabilityScorer: StabilityScorer;

  private readonly startTime: number;

  constructor(config: DelveConfig) {
    this.config = config;
    this.history = this.createNewHistory();
    this.premiseRegistry = new PremiseRegistry();
    this.contradictionDetector = new ContradictionDetector();
    this.stabilityScorer = new StabilityScorer();
    this.startTime = Date.now();
  }

  createNewHistory(): DelveHistory {
    return {
      frames: [],
      steps: [],
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        total_duration_ms: 0,
        revisions_count: 0,
        frames_created: 0,
        tools_used: [],
        unverified_assumption_count: 0,
        weakest_premise_confidence: null,
        contradiction_count: 0,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Frame processing
  // ──────────────────────────────────────────────────────────────

  processFrame(input: {
    problem_statement: string;
    assumptions: Array<{
      claim: string;
      source: 'verified' | 'recalled' | 'assumed';
      how_to_disprove: string;
    }>;
    alternative_interpretations: string[];
    chosen_interpretation: string;
    justification: string;
    strongest_objection?: string;
    pre_mortem?: string;
    predictions?: string[];
    stakes?: StakeLevel;
    prior_frames?: number[];
    session_id?: string;
  }): FrameResult {
    const frameWarnings: string[] = [];

    // Handle session switching if session_id is provided
    if (input.session_id && this.config.features.enableSessions) {
      this.handleSessionSwitch(input.session_id);
    } else if (input.session_id && !this.config.features.enableSessions) {
      frameWarnings.push(
        'session_id provided but sessions are disabled (DELVE_ENABLE_SESSIONS=false). All state is shared globally.'
      );
    }

    // Validate prior_frames reference existing frame IDs
    if (input.prior_frames) {
      for (const priorId of input.prior_frames) {
        if (!this.frameIndex.has(priorId)) {
          frameWarnings.push(
            `Prior frame ${priorId} not found. It may have been trimmed or does not exist.`
          );
        }
      }
    }

    // Warn about missing strongest_objection on high-stakes frames
    if (input.stakes === 'high' && !input.strongest_objection) {
      frameWarnings.push(
        'High-stakes framing without a counter-argument. What\'s the best case against your chosen interpretation?'
      );
    }

    // Assign frame ID
    this.frameCounter++;
    const frameId = this.frameCounter;

    // Create frame object
    const frame: Frame = {
      frame_id: frameId,
      problem_statement: input.problem_statement,
      assumptions: input.assumptions,
      alternative_interpretations: input.alternative_interpretations,
      chosen_interpretation: input.chosen_interpretation,
      justification: input.justification,
      stakes: input.stakes,
      strongest_objection: input.strongest_objection,
      pre_mortem: input.pre_mortem,
      predictions: input.predictions,
      prior_frames: input.prior_frames,
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
    };

    // Store in indexes and history
    this.frameIndex.set(frameId, frame);
    this.history.frames.push(frame);
    this.history.metadata.frames_created++;
    this.history.updated_at = new Date().toISOString();

    return {
      frame_id: frameId,
      assumptions_count: input.assumptions.length,
      alternatives_count: input.alternative_interpretations.length,
      predictions_count: input.predictions?.length ?? 0,
      stakes: input.stakes ?? 'unspecified',
      warnings: frameWarnings,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Reason processing (core method)
  // ──────────────────────────────────────────────────────────────

  processReason(input: {
    step: number;
    thought: string;
    premises: Array<{
      claim: string;
      source: 'verified' | 'recalled' | 'assumed' | 'derived';
      source_detail: string;
      confidence: number;
      if_wrong?: string;
      verification_action?: string;
      confidence_reasoning?: string;
      derived_from?: number[];
    }>;
    outcome: string;
    next_action: string | {
      tool?: string;
      action: string;
      parameters?: Record<string, unknown>;
      expectedOutput?: string;
    };
    frame_id?: number;
    revises_step?: number;
    revision_reason?: string;
    is_final_step?: boolean;
    dependencies?: number[];
    missing_evidence?: string[];
    tools_used?: string[];
    external_context?: Record<string, unknown>;
    session_id?: string;
  }): ReasonResult {
    const warnings: string[] = [];
    const stepStartTime = Date.now();

    // 1. Session management
    if (input.session_id && this.config.features.enableSessions) {
      this.stepsSinceCleanup++;

      // Batched cleanup: only every SESSION_CLEANUP_INTERVAL steps
      if (this.stepsSinceCleanup >= SESSION_CLEANUP_INTERVAL) {
        this.cleanupExpiredSessions();
        this.stepsSinceCleanup = 0;
      }

      this.handleSessionSwitch(input.session_id);
    } else if (input.session_id && !this.config.features.enableSessions) {
      warnings.push(
        'session_id provided but sessions are disabled (DELVE_ENABLE_SESSIONS=false). All state is shared globally.'
      );
    }

    // 1b. Reject duplicate step numbers
    if (this.stepNumbers.has(input.step)) {
      warnings.push(
        `Step ${input.step} already exists and will be overwritten. Use a new step number or revises_step to correct previous steps.`
      );
    }

    // 2. Validate dependencies
    const allDeps = new Set<number>(input.dependencies ?? []);

    if (input.dependencies) {
      for (const dep of input.dependencies) {
        if (dep === input.step) {
          warnings.push(
            `Circular dependency: step ${input.step} depends on itself. Ignored.`
          );
        } else if (dep >= input.step) {
          warnings.push(
            `Future dependency: step ${input.step} depends on step ${dep} which hasn't happened yet. Ignored.`
          );
        } else if (!this.stepNumbers.has(dep)) {
          warnings.push(
            `Missing dependency: step ${dep} not found in history.`
          );
        }
      }
    }

    // 2b. Auto-wire derived_from into dependency graph
    for (const premise of input.premises) {
      if (premise.source === 'derived' && premise.derived_from) {
        for (const fromStep of premise.derived_from) {
          allDeps.add(fromStep);
        }
      }
      // Warn about derived without derived_from
      if (premise.source === 'derived' && !premise.derived_from) {
        warnings.push(
          `Derived premise "${premise.claim.slice(0, 50)}..." without derived_from. Which prior step conclusions does this build on?`
        );
      }
    }

    // 3. Validate frame_id
    if (input.frame_id !== undefined) {
      if (!this.frameIndex.has(input.frame_id)) {
        warnings.push(
          `Frame ${input.frame_id} not found. Proceeding without frame context.`
        );
      }
    } else if (this.config.features.requireFraming) {
      warnings.push('Reasoning without prior problem framing.');
    }

    // 4. Handle revision
    if (input.revises_step !== undefined) {
      if (input.revises_step >= input.step) {
        warnings.push(
          `Cannot revise step ${input.revises_step} from step ${input.step}: revisions must target earlier steps.`
        );
      } else {
        const original = this.stepIndex.get(input.revises_step);
        if (original) {
          original.revised_by = input.step;
          this.history.metadata.revisions_count++;

          // 4b. Confidence anchoring detection
          this.detectConfidenceAnchoring(input, original, warnings);
        } else {
          warnings.push(
            `Step ${input.revises_step} not found for revision.`
          );
        }
      }
    }

    // 5. Register premises
    this.premiseRegistry.addPremises(input.step, input.premises);

    // 6. Contradiction detection
    let contradictions: Contradiction[] = [];
    if (this.config.features.contradictionCheck) {
      contradictions = this.contradictionDetector.detect(
        input.step,
        input.premises,
        this.premiseRegistry
      );
      this.history.metadata.contradiction_count += contradictions.length;

      if (contradictions.length > 0) {
        warnings.push(
          `${contradictions.length} contradiction(s) detected with prior premises.`
        );
      }
    }

    // 7. Stability scoring (use allDeps which includes auto-wired derived_from)
    const depsArray = Array.from(allDeps);
    const depGraph = this.buildDepGraph(input.step, depsArray.length > 0 ? depsArray : undefined);
    const stability: StabilityReport = this.stabilityScorer.score(
      input.step,
      this.premiseRegistry,
      depGraph
    );

    // Update weakest premise confidence in metadata
    if (
      stability.weakest_premise !== null &&
      (this.history.metadata.weakest_premise_confidence === null ||
        stability.weakest_premise.confidence <
          this.history.metadata.weakest_premise_confidence)
    ) {
      this.history.metadata.weakest_premise_confidence =
        stability.weakest_premise.confidence;
    }

    // 8. Unverified assumptions count
    const unverifiedAssumptions =
      this.premiseRegistry.getUnverifiedAssumptions().length;
    this.history.metadata.unverified_assumption_count = unverifiedAssumptions;

    // 8b. Warn about weak/assumed premises in this step
    const stepAssumed = input.premises.filter(p => p.source === 'assumed');
    if (stepAssumed.length > 0 && stepAssumed.length === input.premises.length) {
      warnings.push(
        `All ${stepAssumed.length} premise(s) in this step are unverified assumptions. Consider verifying at least one before building further.`
      );
    } else if (stepAssumed.length > 0) {
      warnings.push(
        `${stepAssumed.length} of ${input.premises.length} premise(s) in this step are unverified assumptions.`
      );
    }

    const weakPremises = input.premises.filter(p => p.confidence < 0.4);
    if (weakPremises.length > 0) {
      warnings.push(
        `${weakPremises.length} premise(s) have critically low confidence (< 0.4). Your reasoning chain is only as strong as its weakest link.`
      );
    }

    // 8c. Warn about assumed premises missing verification_action or if_wrong
    for (const premise of input.premises) {
      if (premise.source === 'assumed') {
        if (!premise.verification_action) {
          warnings.push(
            `Assumed premise "${premise.claim.slice(0, 50)}..." without verification_action. How would you check this?`
          );
        }
        if (!premise.if_wrong) {
          warnings.push(
            `Assumed premise "${premise.claim.slice(0, 50)}..." without if_wrong. What would disprove this?`
          );
        }
      }
    }

    // 8d. Compound premise detection
    for (const premise of input.premises) {
      if (/ and /i.test(premise.claim) && premise.claim.length > 30) {
        warnings.push(
          `Premise "${premise.claim.slice(0, 50)}..." may contain multiple claims (detected "and"). Consider splitting for more precise confidence tracking.`
        );
      }
    }

    // 9. Track tools used
    if (input.tools_used) {
      for (const tool of input.tools_used) {
        this.toolsUsedSet.add(tool);
      }
      this.history.metadata.tools_used = Array.from(this.toolsUsedSet);
    }

    // 10. Build step and add to history
    const reasonStep: ReasonStep = {
      step: input.step,
      thought: input.thought,
      premises: input.premises,
      outcome: input.outcome,
      next_action: input.next_action,
      frame_id: input.frame_id,
      revises_step: input.revises_step,
      revision_reason: input.revision_reason,
      is_final_step: input.is_final_step,
      dependencies: depsArray.length > 0 ? depsArray : input.dependencies,
      missing_evidence: input.missing_evidence,
      tools_used: input.tools_used,
      external_context: input.external_context,
      session_id: input.session_id,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - stepStartTime,
    };

    this.history.steps.push(reasonStep);
    this.stepIndex.set(input.step, reasonStep);
    this.stepNumbers.add(input.step);
    this.history.updated_at = new Date().toISOString();
    this.history.metadata.total_duration_ms = Date.now() - this.startTime;

    // 11. Completion
    if (input.is_final_step === true) {
      this.history.completed = true;
    }

    // 12. Trim history
    if (this.history.steps.length > this.config.system.maxHistorySize) {
      this.trimHistory();
    }

    // 12b. Reasoning velocity warning (after 5+ steps)
    if (this.history.steps.length >= 5) {
      this.detectReasoningStall(warnings);
    }

    // 13. Build and return result
    return {
      step: input.step,
      completed: this.history.completed,
      total_steps: this.history.steps.length,
      warnings,
      contradictions,
      stability,
      unverified_assumptions: unverifiedAssumptions,
      missing_evidence_count: input.missing_evidence?.length ?? 0,
      revised_step: input.revises_step,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Check processing
  // ──────────────────────────────────────────────────────────────

  processCheck(input: CheckRequest): CheckResult {
    const signalCount = input.complexity_signals.length;

    let recommendation: 'proceed' | 'frame_first' | 'use_reasoning';
    let reason: string;

    if (signalCount <= 1) {
      recommendation = 'proceed';
      reason =
        signalCount === 0
          ? 'No complexity signals detected. This task appears straightforward — proceed directly.'
          : `Only 1 complexity signal ("${input.complexity_signals[0]}"). Likely manageable without structured reasoning.`;
    } else if (signalCount <= 3) {
      recommendation = 'frame_first';
      reason = `${signalCount} complexity signals detected (${input.complexity_signals.join(', ')}). Consider framing the problem with delve-frame before reasoning.`;
    } else {
      recommendation = 'use_reasoning';
      reason = `${signalCount} complexity signals detected (${input.complexity_signals.join(', ')}). This warrants full structured reasoning with delve-frame followed by delve-reason steps.`;
    }

    const suggestedDepth = Math.min(signalCount * 2, 20);

    return {
      recommendation,
      reason,
      suggested_depth: suggestedDepth,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Confidence anchoring detection
  // ──────────────────────────────────────────────────────────────

  private detectConfidenceAnchoring(
    input: { premises: Array<{ claim: string; confidence: number }> },
    original: ReasonStep,
    warnings: string[]
  ): void {
    if (original.premises.length === 0 || input.premises.length === 0) return;

    const originalAvgConf = original.premises.reduce((s, p) => s + p.confidence, 0) / original.premises.length;
    const newAvgConf = input.premises.reduce((s, p) => s + p.confidence, 0) / input.premises.length;
    const confDelta = Math.abs(newAvgConf - originalAvgConf);

    // If claims changed (revision) but confidence barely moved
    if (confDelta < 0.1) {
      warnings.push(
        'Revision with barely-changed confidence. If the claim changed, the confidence should too — are you anchoring on your original estimate?'
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Reasoning velocity / stall detection
  // ──────────────────────────────────────────────────────────────

  private detectReasoningStall(warnings: string[]): void {
    const steps = this.history.steps;
    const recentCount = Math.min(5, steps.length);
    const recentSteps = steps.slice(-recentCount);

    // Count assumed premises across recent steps
    let assumedCount = 0;
    for (const step of recentSteps) {
      for (const p of step.premises) {
        if (p.source === 'assumed') assumedCount++;
      }
    }

    // If we have 5+ steps and assumed count is still high with no verification
    const totalPremises = recentSteps.reduce((s, st) => s + st.premises.length, 0);
    if (totalPremises > 0 && assumedCount / totalPremises > 0.5) {
      warnings.push(
        'Reasoning chain has stalled: over half of recent premises are still unverified assumptions. Consider verifying your weakest assumption before adding more steps.'
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Session management
  // ──────────────────────────────────────────────────────────────

  private handleSessionSwitch(sessionId: string): void {
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      existingSession.lastAccessed = Date.now();

      if (this.history !== existingSession.history) {
        this.saveCurrentHistoryIfNeeded();
        this.history = existingSession.history;
        this.rebuildIndexes();
      }
      return;
    }

    this.saveCurrentHistoryIfNeeded();

    const newHistory = this.createNewHistory();
    this.sessions.set(sessionId, {
      history: newHistory,
      lastAccessed: Date.now(),
    });
    this.history = newHistory;
    this.rebuildIndexes();
  }

  private saveCurrentHistoryIfNeeded(): void {
    if (this.history.steps.length > 0) {
      const currentSessionId = this.history.steps[0]?.session_id;
      if (currentSessionId && !this.sessions.has(currentSessionId)) {
        this.sessions.set(currentSessionId, {
          history: this.history,
          lastAccessed: Date.now(),
        });
      }
    }
  }

  private rebuildIndexes(): void {
    this.stepIndex.clear();
    this.stepNumbers.clear();
    this.frameIndex.clear();
    this.toolsUsedSet.clear();
    this.premiseRegistry.clear();

    for (const step of this.history.steps) {
      this.stepIndex.set(step.step, step);
      this.stepNumbers.add(step.step);
      if (step.tools_used) {
        for (const tool of step.tools_used) {
          this.toolsUsedSet.add(tool);
        }
      }
    }

    this.premiseRegistry.rebuildFromSteps(this.history.steps);

    for (const frame of this.history.frames) {
      this.frameIndex.set(frame.frame_id, frame);
    }

    this.frameCounter = 0;
    for (const frame of this.history.frames) {
      if (frame.frame_id > this.frameCounter) {
        this.frameCounter = frame.frame_id;
      }
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const timeoutMs = this.config.system.sessionTimeout * 60 * 1000;

    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessed > timeoutMs) {
        if (session.history !== this.history) {
          this.sessions.delete(id);
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Dependency graph
  // ──────────────────────────────────────────────────────────────

  private buildDepGraph(
    currentStep?: number,
    currentDeps?: number[]
  ): Map<number, number[]> {
    const graph = new Map<number, number[]>();

    for (const step of this.history.steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        graph.set(step.step, step.dependencies);
      }
    }

    if (currentStep !== undefined && currentDeps && currentDeps.length > 0) {
      graph.set(currentStep, currentDeps);
    }

    return graph;
  }

  // ──────────────────────────────────────────────────────────────
  // History trimming
  // ──────────────────────────────────────────────────────────────

  private trimHistory(): void {
    const excess = this.history.steps.length - this.config.system.maxHistorySize;
    if (excess <= 0) return;

    const removed = this.history.steps.splice(0, excess);

    const removedStepNumbers = new Set<number>();
    for (const step of removed) {
      removedStepNumbers.add(step.step);
      this.stepIndex.delete(step.step);
      this.stepNumbers.delete(step.step);
    }

    this.premiseRegistry.removePremisesForSteps(removedStepNumbers);

    const referencedFrameIds = new Set<number>();
    for (const step of this.history.steps) {
      if (step.frame_id !== undefined) {
        referencedFrameIds.add(step.frame_id);
      }
    }

    this.history.frames = this.history.frames.filter((frame) => {
      if (referencedFrameIds.has(frame.frame_id)) {
        return true;
      }
      this.frameIndex.delete(frame.frame_id);
      return false;
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────

  clearHistory(): void {
    this.history = this.createNewHistory();
    this.stepIndex.clear();
    this.stepNumbers.clear();
    this.frameIndex.clear();
    this.frameCounter = 0;
    this.toolsUsedSet.clear();
    this.stepsSinceCleanup = 0;
    this.premiseRegistry.clear();
    this.sessions.clear();
  }

  getHistory(): DelveHistory {
    return this.history;
  }

  getSessions(): Map<string, SessionEntry> {
    return this.sessions;
  }

  getFrameCount(): number {
    return this.frameCounter;
  }
}
