import {
  DEFAULT_MAX_HISTORY,
  DEFAULT_SESSION_TIMEOUT,
  VALID_OUTPUT_FORMATS,
} from './constants.js';

export interface DelveConfig {
  features: {
    enableSessions: boolean;
    requireFraming: boolean;
    contradictionCheck: boolean;
  };
  display: {
    colorOutput: boolean;
    outputFormat: 'console' | 'json' | 'markdown';
  };
  system: {
    maxHistorySize: number;
    sessionTimeout: number; // minutes
  };
  server: {
    port: number;
    host: string;
    allowedOrigins: string[];
  };
}

export const DEFAULT_CONFIG: DelveConfig = {
  features: {
    enableSessions: false,
    requireFraming: false,
    contradictionCheck: true,
  },
  display: {
    colorOutput: true,
    outputFormat: 'console',
  },
  system: {
    maxHistorySize: DEFAULT_MAX_HISTORY,
    sessionTimeout: DEFAULT_SESSION_TIMEOUT,
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedOrigins: [],
  },
};

function parseIntEnv(value: string | undefined, min: number = 1): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min) return undefined;
  return parsed;
}

function parseBoolEnv(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseCsvEnv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function loadConfig(): DelveConfig {
  const config: DelveConfig = {
    features: { ...DEFAULT_CONFIG.features },
    display: { ...DEFAULT_CONFIG.display },
    system: { ...DEFAULT_CONFIG.system },
    server: { ...DEFAULT_CONFIG.server },
  };

  // Features
  const enableSessions = parseBoolEnv(process.env.DELVE_ENABLE_SESSIONS);
  if (enableSessions !== undefined) config.features.enableSessions = enableSessions;

  const requireFraming = parseBoolEnv(process.env.DELVE_REQUIRE_FRAMING);
  if (requireFraming !== undefined) config.features.requireFraming = requireFraming;

  const contradictionCheck = parseBoolEnv(process.env.DELVE_CONTRADICTION_CHECK);
  if (contradictionCheck !== undefined) config.features.contradictionCheck = contradictionCheck;

  // Display
  if (process.env.DELVE_NO_COLOR === 'true') {
    config.display.colorOutput = false;
  }

  if (process.env.DELVE_OUTPUT_FORMAT) {
    const format = process.env.DELVE_OUTPUT_FORMAT.toLowerCase();
    if ((VALID_OUTPUT_FORMATS as readonly string[]).includes(format)) {
      config.display.outputFormat = format as DelveConfig['display']['outputFormat'];
    } else {
      console.error(
        `Warning: Invalid DELVE_OUTPUT_FORMAT '${process.env.DELVE_OUTPUT_FORMAT}', using default 'console'. Valid: ${VALID_OUTPUT_FORMATS.join(', ')}`
      );
    }
  }

  // System
  const maxHistory = parseIntEnv(process.env.DELVE_MAX_HISTORY, 1);
  if (maxHistory !== undefined) config.system.maxHistorySize = maxHistory;

  const sessionTimeout = parseIntEnv(process.env.DELVE_SESSION_TIMEOUT, 1);
  if (sessionTimeout !== undefined) config.system.sessionTimeout = sessionTimeout;

  // Server
  const port = parseIntEnv(process.env.PORT, 1);
  if (port !== undefined) config.server.port = port;

  const host = process.env.HOST?.trim();
  if (host) config.server.host = host;

  const origins = parseCsvEnv(process.env.ALLOWED_ORIGINS);
  if (origins) config.server.allowedOrigins = origins;

  return config;
}
