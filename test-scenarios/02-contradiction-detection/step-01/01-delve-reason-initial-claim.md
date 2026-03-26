# Step 1: Establish initial premise about the system

## Tool: `delve-reason`

Set up a reasoning step with a clear factual claim that will be contradicted later.

## Payload

```json
{
  "step": 1,
  "thought": "Examining the authentication flow. Based on the API documentation, the auth service returns JWT tokens that expire after 24 hours. This means we don't need to handle token refresh for typical user sessions.",
  "premises": [
    {
      "claim": "Auth tokens expire after 24 hours",
      "source": "recalled",
      "source_detail": "From API documentation read last week",
      "confidence": 0.7
    },
    {
      "claim": "Typical user sessions last under 8 hours",
      "source": "assumed",
      "source_detail": "Based on general web app usage patterns",
      "confidence": 0.6
    }
  ],
  "outcome": "No token refresh mechanism needed — tokens outlive typical sessions.",
  "next_action": "Proceed to implement the auth integration without refresh logic."
}
```

## Expected response

## Verify

- [ ] Step 1 recorded successfully
- [ ] `contradictions` is empty (no prior steps to contradict)
- [ ] `unverified_assumptions` is `1` (the "assumed" session duration premise)
- [ ] `stability.risk_level` is `"fragile"` (weakest confidence is 0.6)
