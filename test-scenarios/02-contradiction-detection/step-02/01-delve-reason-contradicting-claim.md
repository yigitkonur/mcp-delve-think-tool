# Step 2: Introduce a contradicting premise

## Tool: `delve-reason`

Submit a step with a premise that directly contradicts step 1's claim about token expiry.

## Payload

```json
{
  "step": 2,
  "thought": "After actually checking the auth service configuration in production, the token expiry is set differently than documented. The config shows tokens expire much sooner, which changes our refresh requirements.",
  "premises": [
    {
      "claim": "Auth tokens do not expire after 24 hours",
      "source": "verified",
      "source_detail": "Read from auth-service/config/jwt.yml: token_ttl=3600 (1 hour)",
      "confidence": 0.95
    },
    {
      "claim": "Users will experience forced logouts without token refresh",
      "source": "derived",
      "source_detail": "Derived from 1-hour token TTL and sessions lasting up to 8 hours",
      "confidence": 0.85
    }
  ],
  "outcome": "Token refresh IS required. The documentation was outdated — actual TTL is 1 hour, not 24 hours.",
  "next_action": "Implement token refresh mechanism before proceeding with auth integration.",
  "dependencies": [1]
}
```

## Expected response

```json
{
  "step": 2,
  "completed": false,
  "total_steps": 2,
  "warnings": ["1 contradiction(s) detected with prior premises."],
  "contradictions": [
    {
      "step_a": 1,
      "claim_a": "Auth tokens expire after 24 hours",
      "step_b": 2,
      "claim_b": "Auth tokens do not expire after 24 hours"
    }
  ],
  "stability": { "...": "..." },
  "unverified_assumptions": 1
}
```

## Verify

- [ ] `contradictions` array has exactly 1 entry
- [ ] `contradictions[0].step_a` is `1` and `contradictions[0].step_b` is `2`
- [ ] `contradictions[0].claim_a` is about 24-hour expiry
- [ ] `contradictions[0].claim_b` is the negation ("do not expire after 24 hours")
- [ ] `warnings` includes a contradiction count message
- [ ] This is the KEY test: the server detected that step 2's premise negates step 1's premise
