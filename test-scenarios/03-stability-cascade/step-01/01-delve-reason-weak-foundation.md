# Step 1: Lay a weak foundation premise

## Tool: `delve-reason`

Establish a reasoning step with a critically weak premise (low confidence, assumed source). Later steps will build on this — their stability should inherit the weakness.

## Payload

```json
{
  "step": 1,
  "thought": "Starting the migration planning. I believe the legacy database uses MySQL 5.7, which means we need to account for its JSON column limitations when designing the new schema.",
  "premises": [
    {
      "claim": "Legacy database runs MySQL 5.7",
      "source": "assumed",
      "source_detail": "Someone mentioned this in a meeting last month, but I haven't verified",
      "confidence": 0.25
    },
    {
      "claim": "MySQL 5.7 has limited JSON column support",
      "source": "recalled",
      "source_detail": "General knowledge about MySQL version capabilities",
      "confidence": 0.85
    }
  ],
  "outcome": "Schema design should avoid heavy JSON usage due to MySQL 5.7 limitations.",
  "next_action": "Design the migration schema with denormalized columns instead of JSON."
}
```

## Expected response

## Verify

- [ ] `stability.risk_level` is `"critical"` (0.25 < 0.4 threshold)
- [ ] `stability.weakest_premise.confidence` is `0.25`
- [ ] `stability.weakest_premise.claim` references the MySQL version premise
- [ ] `stability.chain_confidence` is `0.25`
- [ ] `unverified_assumptions` is `1` (the MySQL version claim)
- [ ] `warnings` mentions weak/unverified premises
