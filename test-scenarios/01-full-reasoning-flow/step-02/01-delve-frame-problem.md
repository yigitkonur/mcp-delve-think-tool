# Step 2: Frame the problem before solving

## Tool: `delve-frame`

Force problem perception check. Surface assumptions, explore alternative interpretations.

## Payload

```json
{
  "problem_statement": "Production API returning intermittent 500 errors under load across auth gateway, user service, and billing service.",
  "assumptions": [
    {
      "claim": "The 500 errors originate from one of the three backend services",
      "source": "assumed",
      "how_to_disprove": "Check if the load balancer or API gateway itself is returning 500 without forwarding to any backend"
    },
    {
      "claim": "The timeouts in logs correspond to the 500 errors users see",
      "source": "assumed",
      "how_to_disprove": "Correlate specific 500 response timestamps with timeout log entries — they might be different incidents"
    },
    {
      "claim": "The issue is load-related, not time-of-day or data-dependent",
      "source": "recalled",
      "how_to_disprove": "Check if errors correlate with specific data patterns (e.g., large billing accounts) rather than pure request volume"
    }
  ],
  "alternative_interpretations": [
    "A single service is the bottleneck and cascading failures make it look like all three are involved",
    "The database shared by these services is the actual bottleneck, not any individual service",
    "Connection pool exhaustion at the gateway level is causing all downstream timeouts",
    "A recent deployment introduced a memory leak that manifests under sustained load"
  ],
  "chosen_interpretation": "The database shared by these services is the actual bottleneck, not any individual service",
  "justification": "All three services share a PostgreSQL cluster. Timeout patterns in logs show similar timing across services, suggesting a shared dependency rather than independent failures. This interpretation also explains why local testing (which uses a separate DB) doesn't reproduce the issue.",
  "stakes": "high"
}
```

## Expected response

```json
{
  "frame_id": 1,
  "assumptions_count": 3,
  "alternatives_count": 4,
  "stakes": "high"
}
```

## Verify

- [ ] `frame_id` is `1` (first frame in this session)
- [ ] `assumptions_count` is `3`
- [ ] `alternatives_count` is `4`
- [ ] `stakes` is `"high"`
- [ ] No errors returned
