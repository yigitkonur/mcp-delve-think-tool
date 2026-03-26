import type {
  PREMISE_SOURCES,
  ASSUMPTION_SOURCES,
  STAKE_LEVELS,
  COMPLEXITY_RECOMMENDATIONS,
} from './constants.js';

// --- Premise types ---

export type PremiseSource = (typeof PREMISE_SOURCES)[number];
export type AssumptionSource = (typeof ASSUMPTION_SOURCES)[number];

export interface Premise {
  claim: string;
  source: PremiseSource;
  source_detail: string;
  confidence: number; // 0-1
  if_wrong?: string;
  verification_action?: string;
  confidence_reasoning?: string;
  derived_from?: number[];
}

// --- Frame types ---

export interface Assumption {
  claim: string;
  source: AssumptionSource;
  how_to_disprove: string;
}

export type StakeLevel = (typeof STAKE_LEVELS)[number];

export interface Frame {
  frame_id: number;
  problem_statement: string;
  assumptions: Assumption[];
  alternative_interpretations: string[];
  chosen_interpretation: string;
  justification: string;
  stakes?: StakeLevel;
  strongest_objection?: string;
  pre_mortem?: string;
  predictions?: string[];
  prior_frames?: number[];
  timestamp: string;
  session_id?: string;
}

// --- Reason step types ---

export interface StructuredAction {
  tool?: string;
  action: string;
  parameters?: Record<string, unknown>;
  expectedOutput?: string;
}

export interface ReasonStep {
  step: number;
  thought: string;
  premises: Premise[];
  outcome: string;
  next_action: string | StructuredAction;

  frame_id?: number;
  revises_step?: number;
  revision_reason?: string;
  revised_by?: number;
  is_final_step?: boolean;
  dependencies?: number[];
  missing_evidence?: string[];
  tools_used?: string[];
  external_context?: Record<string, unknown>;

  timestamp?: string;
  duration_ms?: number;
  session_id?: string;
}

// --- Check types ---

export type ComplexityRecommendation = (typeof COMPLEXITY_RECOMMENDATIONS)[number];

export interface CheckRequest {
  situation: string;
  complexity_signals: string[];
}

export interface CheckResult {
  recommendation: ComplexityRecommendation;
  reason: string;
  suggested_depth: number;
}

// --- Engine result types ---

export interface Contradiction {
  step_a: number;
  claim_a: string;
  step_b: number;
  claim_b: string;
}

export interface StabilityReport {
  weakest_premise: { step: number; claim: string; confidence: number } | null;
  chain_confidence: number;
  risk_level: 'stable' | 'fragile' | 'critical';
}

export interface FrameResult {
  frame_id: number;
  assumptions_count: number;
  alternatives_count: number;
  predictions_count: number;
  stakes: StakeLevel | 'unspecified';
  warnings: string[];
}

export interface ReasonResult {
  step: number;
  completed: boolean;
  total_steps: number;
  warnings: string[];
  contradictions: Contradiction[];
  stability: StabilityReport;
  unverified_assumptions: number;
  missing_evidence_count: number;
  revised_step?: number;
  llm_feedback?: string;
}

// --- History / session types ---

export interface DelveMetadata {
  total_duration_ms: number;
  revisions_count: number;
  frames_created: number;
  tools_used: string[];
  unverified_assumption_count: number;
  weakest_premise_confidence: number | null;
  contradiction_count: number;
}

export interface DelveHistory {
  frames: Frame[];
  steps: ReasonStep[];
  completed: boolean;
  created_at: string;
  updated_at: string;
  metadata: DelveMetadata;
}

export interface SessionEntry {
  history: DelveHistory;
  lastAccessed: number;
}
