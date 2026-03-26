# Step 1: Triage a simple task — bypass reasoning

## Tool: `delve-check`

Test that simple tasks get the "proceed" recommendation, avoiding unnecessary overhead.

## Payload — Simple fix (expect "proceed")

```json
{
  "situation": "Fix a typo in the README: 'recieve' should be 'receive'",
  "complexity_signals": [
    "Single file change"
  ]
}
```

## Expected response

```json
{
  "recommendation": "proceed",
  "reason": "...",
  "suggested_depth": 2
}
```

## Verify

- [ ] `recommendation` is `"proceed"` (1 signal → no structured reasoning needed)
- [ ] `suggested_depth` is `2` (1 * 2)
- [ ] The system correctly identifies this as too simple for full reasoning

---

## Payload — Moderate ambiguity (expect "frame_first")

```json
{
  "situation": "User reports the search feature returns stale results. Need to investigate caching behavior.",
  "complexity_signals": [
    "Multiple caching layers involved (CDN, Redis, application)",
    "User report is vague — 'stale' could mean different things"
  ]
}
```

## Expected response

```json
{
  "recommendation": "frame_first",
  "reason": "...",
  "suggested_depth": 4
}
```

## Verify

- [ ] `recommendation` is `"frame_first"` (2 signals → ambiguous, frame before solving)
- [ ] `suggested_depth` is `4` (2 * 2)

---

## Payload — High complexity (expect "use_reasoning")

```json
{
  "situation": "Redesigning the payment processing pipeline to support multi-currency and cross-border transactions.",
  "complexity_signals": [
    "Regulatory compliance varies by country",
    "Exchange rate fluctuations during transaction processing",
    "Multiple payment providers with different APIs",
    "Existing tests don't cover multi-currency scenarios",
    "Rollback strategy needed for partial transaction failures",
    "Performance requirements: sub-200ms for currency conversion"
  ]
}
```

## Expected response

```json
{
  "recommendation": "use_reasoning",
  "reason": "...",
  "suggested_depth": 12
}
```

## Verify

- [ ] `recommendation` is `"use_reasoning"` (6 signals → full structured reasoning)
- [ ] `suggested_depth` is `12` (6 * 2)
