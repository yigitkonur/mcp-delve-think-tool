# delve

a think tool for ai agents. makes them stop and question what they're actually assuming before they commit to an answer.

## the problem

ai agents rush. they get a problem, pattern-match to the first plausible solution, and go. most of the time this works. but when it doesn't, it fails silently — the agent confidently builds a beautiful answer on top of a wrong assumption, and nobody catches it until it's too late.

the real failure modes aren't about reasoning ability. frontier models can reason fine. they fail because:

- **they solve the wrong problem** (~40% of failures). the agent misunderstands what you actually need and optimizes for the wrong thing.
- **they build on unverified assumptions** (~30%). the agent "knows" something from training data that's outdated, wrong, or doesn't apply to your specific situation.
- **they commit too early** (~15%). first viable path looks good enough, so they never explore alternatives.
- **errors cascade unchecked** (~10%). a wrong assumption in step 2 poisons everything that follows.

existing "think harder" tools (sequential thinking, chain-of-thought scaffolds) address maybe 25% of this. they structure _how_ the model thinks but never question _what_ it's thinking about. they add step numbers and confidence scores to conclusions — but confidence on a conclusion is meaningless. the model that made a bad assumption will also fail to notice it's bad.

## what delve does differently

three tools instead of one. each targets a different failure mode.

### `delve-check` — should i even think hard about this?

not everything needs structured reasoning. a typo fix doesn't need a 10-step analysis. delve-check triages: is this simple enough to just do, or complex enough to warrant slowing down?

```
1 signal  → "proceed" (just do it)
2-3       → "frame_first" (clarify the problem before solving)
4+        → "use_reasoning" (full structured reasoning)
```

this exists because the overhead of structured thinking on simple tasks destroys more value than it creates.

### `delve-frame` — am i solving the right problem?

before any reasoning starts, forces the agent to:

1. state what it thinks the problem is
2. list its assumptions — and for each one, say what would prove it wrong
3. come up with at least 2 alternative interpretations
4. pick one and justify why

this is the highest-leverage intervention. if you're solving the wrong problem, no amount of careful reasoning helps.

### `delve-reason` — what am i actually building on?

step-by-step reasoning, but the confidence tracking is on **premises**, not conclusions.

every claim the model builds on gets tagged:

```
"the api returns json"     → source: verified (read the docs)
"rate limit is 100/min"    → source: recalled (from training data)
"auth token doesn't expire" → source: assumed (no evidence)
```

the server then does three things no other think tool does:

1. **contradiction detection** — if step 5 says "the api returns xml" but step 2 said "the api returns json", the server catches it. models silently contradict themselves all the time. an external validator catches what self-reflection misses.

2. **stability scoring** — your conclusion is only as strong as the weakest assumption it's built on. if step 1 has a 0.25-confidence assumed premise and step 3 depends on step 1, step 3's chain confidence is 0.25 — no matter how brilliant the reasoning in step 3 is. weakest link in the chain.

3. **unverified assumption surfacing** — the response tells you exactly how many "assumed" premises you're carrying and which ones are the riskiest. the nudge isn't "be more confident" — it's "go verify this before you build more on top of it."

## the philosophy

### confidence on premises, not conclusions

when a model says "confidence: 0.7" on a conclusion, that number is performance art. the model isn't computing a probability — it's generating text that looks like what 0.7-confident text looks like.

but asking "how sure are you about _this specific fact you're building on_?" and tagging it with where it came from (verified vs. assumed) — that's a genuinely useful forcing function. the number might still be uncalibrated, but the act of having to think about it activates something real.

### the self-reference problem is real

every think tool has the same fundamental flaw: you're asking the model to evaluate its own reasoning. a model that made a bad assumption will also fail to notice it's bad. delve doesn't pretend to solve this. what it does instead:

- moves evaluation from conclusions to premises (smaller, more verifiable claims)
- uses server-side string matching for contradictions (doesn't ask the model to find its own contradictions)
- surfaces unverified assumptions as data, not judgment ("you have 3 unverified assumptions" is a fact, not a self-assessment)

the honest limit: no tool makes a model genuinely self-aware. what a tool _can_ do is make the model's reasoning visible enough that the surrounding system — human, tool, verification loops — catches what the model alone would miss.

### less structure, more substance

crash-mcp (the tool this was built on top of) had step numbers, estimated totals, purpose categories ("analysis", "reflection", "hypothesis"), thought prefix validation, branching as a primary feature. all of it was form without substance:

- **estimated_total**: the model has no idea how many steps it needs. it guesses 7 and hits 7 regardless of whether the problem is solved.
- **purpose labels**: the model picks "analysis" or "reflection" to satisfy the schema, not because it's genuinely in a different cognitive mode.
- **branching**: in practice, models create "alternative branches" that are trivially similar to the main path.

delve stripped all of that. no step counts. no cognitive mode cosplay. no branching theater. what's left is the stuff that actually changes outcomes: premise tracking, contradiction detection, stability scoring, and problem framing.

### you're not simulating human thinking

the "step, evaluate options, score, pick, backtrack" loop sounds like human deliberation but it's actually tree search (mcts, a*). real human experts don't enumerate and score — they pattern-match and satisfice (find good enough and go). that's fine — algorithmic search scaffolding on a language model is a legitimate strategy. but being honest about what you're building leads to better design decisions than pretending you're simulating human cognition.

## quick start

### connect to the hosted version

```json
{
  "mcpServers": {
    "delve": {
      "url": "https://think.yigitkonur.com/mcp"
    }
  }
}
```

### or run it yourself

```bash
git clone https://github.com/yigitkonur/mcp-delve-think-tool.git
cd mcp-delve-think-tool
pnpm install
pnpm dev
```

server starts on `http://localhost:3001/mcp`.

### environment variables

| variable | default | what it does |
|----------|---------|-------------|
| `PORT` | `3001` | server port |
| `HOST` | `0.0.0.0` | bind address |
| `DELVE_REQUIRE_FRAMING` | `false` | warn when reasoning without a frame |
| `DELVE_CONTRADICTION_CHECK` | `true` | enable cross-step contradiction detection |
| `DELVE_ENABLE_SESSIONS` | `false` | separate history per session id |
| `DELVE_MAX_HISTORY` | `100` | max reasoning steps to keep in memory |
| `DELVE_SESSION_TIMEOUT` | `60` | session expiry in minutes |
| `ALLOWED_ORIGINS` | (none) | comma-separated cors origins |

## example flow

```
you: debug why prod api returns 500 intermittently

agent calls delve-check:
  → 4 complexity signals → "use_reasoning"

agent calls delve-frame:
  → states problem, lists 3 assumptions (2 unverified),
    explores 4 alternative interpretations,
    picks "shared db bottleneck" with justification
  → gets frame_id: 1

agent calls delve-reason step 1:
  → premises: "all services share postgres" (verified, 0.95),
    "slow query log is enabled" (assumed, 0.5)
  → response: stability "fragile", 1 unverified assumption
  → the 0.5-confidence premise is flagged as the weak link

agent calls delve-reason step 2:
  → verified: connection pool is 10, peak needs 25+
  → depends on step 1
  → response: chain_confidence 0.5 (inherited from step 1's weak premise)
  → even though step 2's own premises are 0.95+, the chain is only
    as strong as its weakest link

agent calls delve-reason step 3:
  → revises_step: 1 (verified the slow query assumption)
  → is_final_step: true
  → root cause: billing service connection pool exhaustion
```

the key moment: step 2 has perfect premises of its own (0.95+), but the server tells the agent "your chain confidence is 0.5 because you're building on an unverified assumption from step 1." that's the intervention that matters — not "think harder," but "check your foundations."

## what the responses look like

### delve-check

```json
{
  "recommendation": "use_reasoning",
  "reason": "4 complexity signals detected...",
  "suggested_depth": 8
}
```

### delve-frame

```json
{
  "frame_id": 1,
  "assumptions_count": 3,
  "alternatives_count": 4,
  "stakes": "high"
}
```

### delve-reason

```json
{
  "step": 2,
  "completed": false,
  "total_steps": 2,
  "warnings": ["1 contradiction(s) detected with prior premises."],
  "contradictions": [
    {
      "step_a": 1,
      "claim_a": "auth tokens expire after 24 hours",
      "step_b": 2,
      "claim_b": "auth tokens do not expire after 24 hours"
    }
  ],
  "stability": {
    "weakest_premise": {
      "step": 1,
      "claim": "slow query log is enabled",
      "confidence": 0.5
    },
    "chain_confidence": 0.5,
    "risk_level": "fragile"
  },
  "unverified_assumptions": 2
}
```

## architecture

```
index.ts                          server bootstrap, health, shutdown
src/
  config.ts                       env-based config
  types.ts                        all type definitions
  constants.ts                    bounds, defaults
  schemas/
    frame.ts                      zod schema for delve-frame
    reason.ts                     zod schema for delve-reason
    check.ts                      zod schema for delve-check
  engine/
    premise-registry.ts           premise storage + dependency graph
    contradiction-detector.ts     cross-step contradiction detection
    stability-scorer.ts           chain stability (weakest link)
    delve-server.ts               main engine (history, sessions, indexes)
  tools/
    registry.ts                   registerAllTools()
    frame.ts, reason.ts, check.ts tool handlers
tests/
  engine.test.ts                  71 tests covering all engine components
  frame.test.ts                   frame processing
  reason.test.ts                  reasoning + contradictions + stability
  check.test.ts                   triage logic
```

built on `mcp-use` for http transport. no external dependencies beyond zod for schema validation. the engine is pure typescript with zero api calls — all detection and scoring happens server-side with simple string matching and graph traversal.

## development

```bash
pnpm dev          # dev server with hmr
pnpm test         # run 71 tests
pnpm typecheck    # tsc --noEmit
pnpm build        # production build
pnpm deploy       # deploy to manufact cloud
```

## prior art and credits

built on top of [crash-mcp](https://github.com/nikkoxgonzales/crash-mcp) by nikko gonzales. crash was a good starting point — clean code, solid test coverage, well-structured. delve keeps the session management, revision mechanism, dependency validation, and history trimming patterns, but replaces the reasoning model entirely based on first-principles analysis of where ai agents actually fail.

## license

mit
