export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

export const DEFAULT_MAX_HISTORY = 100;
export const DEFAULT_SESSION_TIMEOUT = 60; // minutes
export const SESSION_CLEANUP_INTERVAL = 10; // steps between cleanup runs

export const PREMISE_SOURCES = ['verified', 'recalled', 'assumed', 'derived'] as const;
export const ASSUMPTION_SOURCES = ['verified', 'recalled', 'assumed'] as const;
export const STAKE_LEVELS = ['low', 'medium', 'high'] as const;
export const COMPLEXITY_RECOMMENDATIONS = ['proceed', 'frame_first', 'use_reasoning'] as const;

export const VALID_OUTPUT_FORMATS = ['console', 'json', 'markdown'] as const;
