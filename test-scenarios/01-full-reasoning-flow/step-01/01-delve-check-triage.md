# Step 1: Triage the task complexity

## Tool: `delve-check`

Determine whether this debugging task warrants full structured reasoning.

## Payload

```json
{
  "situation": "Production API returning 500 errors intermittently. Happens under load, not reproducible locally. Three services involved: auth gateway, user service, billing service. Logs show timeouts but unclear which service is the bottleneck.",
  "complexity_signals": [
    "Multiple services involved with unclear failure boundary",
    "Not reproducible locally — environment-dependent",
    "Intermittent failures suggest race condition or resource exhaustion",
    "Logs are ambiguous — timeouts could originate from any service"
  ]
}
```

## Expected response

```json
{
  "recommendation": "use_reasoning",
  "reason": "...",
  "suggested_depth": 8
}
```

## Verify

- [ ] `recommendation` is `"use_reasoning"` (4 signals → full reasoning)
- [ ] `suggested_depth` is `8` (4 signals * 2, capped at 20)
- [ ] `reason` string is non-empty and references the complexity signals
