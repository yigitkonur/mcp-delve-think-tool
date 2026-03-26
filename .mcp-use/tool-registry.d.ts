// Auto-generated tool registry types - DO NOT EDIT MANUALLY
// This file is regenerated whenever tools are added, removed, or updated during development
// Generated at: 2026-03-26T15:51:01.759Z

declare module "mcp-use/react" {
  interface ToolRegistry {
    "delve-check": {
      input: { "situation": string; "complexity_signals": Array<string> };
      output: Record<string, unknown>;
    };
    "delve-frame": {
      input: { "problem_statement": string; "assumptions": Array<{ "claim": string; "source": "verified" | "recalled" | "assumed"; "how_to_disprove": string }>; "alternative_interpretations": Array<string>; "chosen_interpretation": string; "justification": string; "strongest_objection"?: string | undefined; "pre_mortem"?: string | undefined; "predictions"?: Array<string> | undefined; "stakes"?: "low" | "medium" | "high" | undefined; "prior_frames"?: Array<number> | undefined; "session_id"?: string | undefined };
      output: Record<string, unknown>;
    };
    "delve-reason": {
      input: { "step": number; "thought": string; "premises": Array<{ "claim": string; "source": "verified" | "recalled" | "assumed" | "derived"; "source_detail": string; "confidence": number; "if_wrong"?: string | undefined; "verification_action"?: string | undefined; "confidence_reasoning"?: string | undefined; "derived_from"?: Array<number> | undefined }>; "outcome": string; "next_action": string | { "tool"?: string | undefined; "action": string; "parameters"?: Record<string, unknown> | undefined; "expectedOutput"?: string | undefined }; "frame_id"?: number | undefined; "revises_step"?: number | undefined; "revision_reason"?: string | undefined; "is_final_step"?: boolean | undefined; "dependencies"?: Array<number> | undefined; "missing_evidence"?: Array<string> | undefined; "tools_used"?: Array<string> | undefined; "external_context"?: Record<string, unknown> | undefined; "session_id"?: string | undefined };
      output: Record<string, unknown>;
    };
  }
}

export {};
