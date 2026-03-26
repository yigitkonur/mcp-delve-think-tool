# Step 4: Final reasoning step — mark completion

## Tool: `delve-reason`

Conclude the reasoning chain with verified findings.

## Payload

```json
{
  "step": 2,
  "frame_id": 1,
  "thought": "After checking pg_stat_activity during the incident window, confirmed that connection pool saturation on the billing service's connection pool was causing cascading timeouts. The billing service uses a pool of 10 connections but needs 25+ during peak. Auth and user services were waiting for billing-initiated transactions to release connections.",
  "premises": [
    {
      "claim": "Billing service connection pool is configured for 10 connections",
      "source": "verified",
      "source_detail": "Read from billing-service/config/database.yml, pool_size=10",
      "confidence": 0.99
    },
    {
      "claim": "Peak load requires 25+ concurrent database connections from billing service",
      "source": "verified",
      "source_detail": "pg_stat_activity showed 25 active connections from billing service IP during incident",
      "confidence": 0.95
    },
    {
      "claim": "Increasing pool size to 30 will resolve the intermittent 500 errors",
      "source": "derived",
      "source_detail": "Derived from the gap between required (25+) and configured (10) connections",
      "confidence": 0.8
    }
  ],
  "outcome": "Root cause identified: billing service connection pool exhaustion under load. Fix: increase pool_size from 10 to 30 and add connection pool monitoring alerts.",
  "next_action": "Apply the connection pool configuration change and deploy to staging for load testing.",
  "dependencies": [1],
  "is_final_step": true,
  "tools_used": ["Read", "Bash", "Grep"]
}
```

## Expected response

```json
{
  "step": 2,
  "completed": true,
  "total_steps": 2,
  "warnings": [],
  "contradictions": [],
  "stability": {
    "weakest_premise": {
      "step": 1,
      "claim": "PostgreSQL slow query log is enabled in production",
      "confidence": 0.5
    },
    "chain_confidence": 0.5,
    "risk_level": "fragile"
  },
  "unverified_assumptions": 2
}
```

## Verify

- [ ] `completed` is `true` (is_final_step was set)
- [ ] `total_steps` is `2`
- [ ] `contradictions` is empty
- [ ] `stability.chain_confidence` reflects the weakest premise across the dependency chain (step 1's 0.5 premise carries through)
- [ ] Chain includes step 1's unverified assumptions in the overall count
- [ ] No errors — clean completion
