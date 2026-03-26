# Step 3: First reasoning step linked to frame

## Tool: `delve-reason`

Begin premise-tracked reasoning, linked to the frame from step 2.

## Payload

```json
{
  "step": 1,
  "frame_id": 1,
  "thought": "If the shared PostgreSQL cluster is the bottleneck, we should see correlated slow query logs across all three services during the error windows. The first step is to check pg_stat_activity and slow query logs during a known incident window.",
  "premises": [
    {
      "claim": "All three services connect to the same PostgreSQL cluster",
      "source": "verified",
      "source_detail": "Confirmed in infrastructure diagram and connection strings in service configs",
      "confidence": 0.95
    },
    {
      "claim": "PostgreSQL slow query log is enabled in production",
      "source": "assumed",
      "source_detail": "Most production setups have this enabled, but haven't verified for this cluster",
      "confidence": 0.5
    },
    {
      "claim": "The error timestamps can be correlated with database metrics",
      "source": "assumed",
      "source_detail": "Assuming monitoring captures both application errors and DB metrics at sufficient granularity",
      "confidence": 0.6
    }
  ],
  "outcome": "Need to verify slow query logging is active and pull pg_stat_activity snapshots from the incident window to confirm or refute the shared-DB-bottleneck hypothesis.",
  "next_action": {
    "tool": "Bash",
    "action": "Query the PostgreSQL cluster for slow query log configuration and recent activity",
    "parameters": {
      "command": "psql -h prod-db-cluster -c \"SHOW log_min_duration_statement;\""
    },
    "expectedOutput": "The slow query threshold setting, confirming whether logging is active"
  },
  "tools_used": ["Read"]
}
```

## Expected response

```json
{
  "step": 1,
  "completed": false,
  "total_steps": 1,
  "warnings": ["...unverified assumptions..."],
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

- [ ] `completed` is `false`
- [ ] `total_steps` is `1`
- [ ] `warnings` array is non-empty (2 "assumed" premises)
- [ ] `contradictions` is empty `[]`
- [ ] `stability.risk_level` is `"fragile"` (weakest premise is 0.5)
- [ ] `stability.weakest_premise.confidence` is `0.5`
- [ ] `stability.weakest_premise.claim` references the slow query log premise
- [ ] `unverified_assumptions` is `2` (the two "assumed" source premises)
