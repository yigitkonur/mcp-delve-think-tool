# Step 3: Formally revise step 1

## Tool: `delve-reason`

Use `revises_step` to formally correct step 1's incorrect conclusion.

## Payload

```json
{
  "step": 3,
  "thought": "Formally revising step 1. The memory leak source is the unpruned request context Map in worker/context.ts, not event listener accumulation. The fix is to add a cleanup hook that deletes entries when request completes.",
  "premises": [
    {
      "claim": "Request context Map at worker/context.ts:12 is the memory leak source",
      "source": "verified",
      "source_detail": "Confirmed via heap snapshot diff: Map entries account for 95% of retained objects",
      "confidence": 0.98
    },
    {
      "claim": "Adding contextMap.delete(reqId) in the response finalizer will fix the leak",
      "source": "derived",
      "source_detail": "Standard Map cleanup pattern; entries should be deleted when request lifecycle ends",
      "confidence": 0.85
    }
  ],
  "outcome": "Root cause confirmed and fix identified. Step 1 is revised — event listeners were a red herring.",
  "next_action": "Implement the fix: add contextMap.delete(reqId) in the response finalizer and verify with a 24h soak test.",
  "revises_step": 1,
  "revision_reason": "Step 1 incorrectly hypothesized event listener accumulation as the leak source. Actual investigation in step 2 revealed the unpruned request context Map is the real cause.",
  "dependencies": [2],
  "is_final_step": true
}
```

## Expected response

## Verify

- [ ] `revised_step` is `1` in the response
- [ ] `completed` is `true` (is_final_step)
- [ ] Step 1 in engine now has `revised_by: 3`
- [ ] The revision chain: step 1 (wrong) → step 2 (discovery) → step 3 (formal revision)
- [ ] `stability.risk_level` should reflect step 2's premises (the dependency chain goes through step 2)
- [ ] This demonstrates the full correction workflow: hypothesize → investigate → discover error → formally revise
