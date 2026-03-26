# Step 1: Reason without framing (requireFraming=true)

## Tool: `delve-reason`

## Precondition

Set `DELVE_REQUIRE_FRAMING=true` before starting the server:
```bash
DELVE_REQUIRE_FRAMING=true NODE_ENV=production pnpm start
```

## Payload

```json
{
  "step": 1,
  "thought": "Jumping straight into solving. The API rate limiter should use a sliding window algorithm instead of fixed windows to avoid burst traffic at window boundaries.",
  "premises": [
    {
      "claim": "Fixed window rate limiting allows burst traffic at window boundaries",
      "source": "recalled",
      "source_detail": "Standard distributed systems knowledge",
      "confidence": 0.85
    },
    {
      "claim": "Sliding window eliminates the boundary burst problem",
      "source": "recalled",
      "source_detail": "Redis ZRANGEBYSCORE can implement sliding windows efficiently",
      "confidence": 0.8
    }
  ],
  "outcome": "Should switch from fixed to sliding window rate limiting.",
  "next_action": "Implement sliding window rate limiter using Redis sorted sets."
}
```

## Expected response

```json
{
  "step": 1,
  "completed": false,
  "total_steps": 1,
  "warnings": [
    "Reasoning without prior problem framing."
  ],
  "contradictions": [],
  "stability": { "...": "..." },
  "unverified_assumptions": 0
}
```

## Verify

- [ ] `warnings` contains `"Reasoning without prior problem framing."` (because `requireFraming=true` and no `frame_id` provided)
- [ ] The step is NOT rejected — it's a warning, not an error
- [ ] Processing continues normally despite the warning
- [ ] All other fields (stability, contradictions) work as expected
- [ ] This nudges the agent to use `delve-frame` first, without blocking progress
