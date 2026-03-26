# Step 3: Resolve the contradiction by revising step 1

## Tool: `delve-reason`

Use the revision mechanism to formally correct the earlier incorrect step.

## Payload

```json
{
  "step": 3,
  "thought": "Step 1's conclusion was based on outdated documentation. The verified configuration shows 1-hour token TTL. Revising step 1 to correct the record and update the implementation plan.",
  "premises": [
    {
      "claim": "Auth token TTL is 3600 seconds (1 hour) in production",
      "source": "verified",
      "source_detail": "auth-service/config/jwt.yml confirmed in step 2",
      "confidence": 0.95
    },
    {
      "claim": "Token refresh must be implemented for sessions longer than 1 hour",
      "source": "derived",
      "source_detail": "Direct consequence of 1-hour TTL with multi-hour sessions",
      "confidence": 0.9
    }
  ],
  "outcome": "Step 1 is formally revised. Token refresh is required. Updated implementation plan to include refresh-on-expiry logic.",
  "next_action": "Implement refresh token flow using the /auth/refresh endpoint.",
  "revises_step": 1,
  "revision_reason": "Step 1 relied on outdated API documentation. Verified config shows 1-hour TTL, not 24 hours.",
  "dependencies": [2]
}
```

## Expected response

## Verify

- [ ] `revised_step` is `1` in the response
- [ ] Step 1 in the engine now has `revised_by: 3`
- [ ] `contradictions` should be empty or reduced (step 3's claims don't contradict step 2)
- [ ] `stability.risk_level` should be `"stable"` (all premises in step 3 are >= 0.9)
- [ ] The revision cleanly closes the contradiction from step 2
