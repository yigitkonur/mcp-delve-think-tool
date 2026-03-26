# AGENTS.md

## what this is

mcp-delve-think-tool — an mcp server that gives ai agents a way to question their own assumptions. three tools: `delve-check`, `delve-frame`, `delve-reason`. http transport via mcp-use.

## commands

```bash
pnpm dev              # dev server with hmr on :3001
pnpm build            # production build -> dist/
pnpm start            # run built server
pnpm test             # 71 unit tests via vitest
pnpm typecheck        # tsc --noEmit
npx mcp-use deploy    # deploy to manufact cloud (not pnpm deploy)
```

## how to use the tools (for agents consuming this mcp)

this is the important part. if you're an agent connected to delve, here's how to think with it.

### when to use delve

not everything needs structured reasoning. the whole point of `delve-check` is to prevent you from wasting tokens on simple tasks.

- **fixing a typo, renaming a variable, adding a log line** — just do it. don't call delve.
- **task has ambiguity, multiple possible interpretations, or you're not sure what the user actually wants** — call `delve-check` first. if it says "proceed", skip the rest.
- **multi-step debugging, architecture decisions, anything where being wrong early cascades** — use the full flow: check -> frame -> reason.

### the flow

```
1. delve-check   → do i need to think hard about this?
2. delve-frame   → am i solving the right problem?
3. delve-reason  → what am i building on, and is it solid?
```

you don't always need all three. `delve-check` might say "proceed" and you skip everything else. `delve-frame` might clarify the problem enough that you don't need step-by-step reasoning.

### how to use delve-frame well

the quality of your frame determines the quality of everything that follows. bad frames:

- "the problem is X" with zero assumptions listed (you always have assumptions — surface them)
- alternative interpretations that are trivially similar ("it could be A" / "it could be A but slightly different")
- choosing an interpretation without justifying why the others are less likely

good frames force you to ask: "what would i need to be wrong about for my understanding to be incorrect?" if you can't answer that, you don't understand the problem well enough.

### how to use delve-reason well

the key concept: **confidence goes on premises, not conclusions**.

don't do this:
```
thought: "the cache is stale because redis ttl expired"
confidence: 0.7  ← meaningless number on the conclusion
```

do this:
```
premises:
  - claim: "redis ttl is set to 3600s"
    source: "verified"  (read from config)
    confidence: 0.95
  - claim: "cache was last written 2 hours ago"
    source: "assumed"  (haven't checked)
    confidence: 0.4
```

now the server can tell you: "your chain is fragile because you're building on an unverified assumption about cache write time."

### source tags matter

- `verified` — you read a file, hit an api, checked a config. you have evidence.
- `recalled` — from training data or prior context. might be outdated.
- `assumed` — no evidence. you're guessing. the server will flag these.
- `derived` — logically follows from other premises. only as strong as what it's derived from.

be honest. marking everything as "verified" defeats the purpose. the whole point is surfacing what you're assuming without evidence so you can go verify the risky ones.

### reading the response

the response tells you three things no other think tool provides:

1. **contradictions** — "step 3 says X but step 1 said not-X". you silently contradicted yourself and the server caught it.
2. **stability** — chain_confidence is the weakest premise in your entire dependency chain. if it's "critical" (< 0.4), you're building on sand.
3. **unverified_assumptions** — count of premises tagged "assumed". if this number is high, go verify before building more on top.

### when to revise

use `revises_step` when you discover a previous step was wrong. don't just move on and hope the reader figures it out — formally mark the old step as superseded. this keeps the reasoning chain clean and prevents cascading from stale conclusions.

## architecture (for agents modifying this codebase)

```
index.ts              → mcp server bootstrap, health endpoint, shutdown
src/config.ts         → env-based config (DELVE_* vars)
src/types.ts          → all type definitions
src/schemas/          → zod input schemas (one per tool)
src/engine/           → the brain: premise registry, contradiction detection, stability scoring
src/engine/delve-server.ts → main engine class, session management, history
src/tools/            → tool handlers that wire schemas to engine
tests/                → 71 vitest tests
```

### key patterns

- **tools never throw** — every handler wraps in try/catch, returns `error()` on failure
- **engine is pure** — no api calls, no side effects. all detection and scoring is string matching + graph traversal
- **schemas are the contract** — every field has `.describe()`. this is how agents know what to pass. if you change a schema, the description is more important than the type.
- **sessions are optional** — engine state is in-memory by default. set `DELVE_ENABLE_SESSIONS=true` for per-session isolation.

### never

- never add external api dependencies to the engine. the engine must stay pure computation.
- never remove `.describe()` from schema fields. agents depend on these descriptions to use the tools correctly.
- never make contradiction detection ai-powered. it uses simple string matching + basic stemming on purpose — to avoid the recursive self-evaluation problem (asking the model to find its own contradictions).
- never return raw engine internals. tool responses are curated for agent consumption.

### when changing tools

1. update the zod schema in `src/schemas/`
2. update the engine method in `src/engine/delve-server.ts`
3. update the tool handler in `src/tools/`
4. run `pnpm test` — all 71 tests must pass
5. run `pnpm typecheck` — zero errors

### testing

single command: `pnpm test`. tests cover:
- engine components individually (premise registry, contradiction detector, stability scorer)
- frame processing (id assignment, validation, prior frame linking)
- reason processing (revision, dependencies, contradictions, stability cascade, history trimming, sessions)
- check processing (triage logic, depth calculation, capping)

if you add a new feature to the engine, add tests in the matching `tests/*.test.ts` file.

## environment variables

| var | default | what |
|-----|---------|------|
| `PORT` | `3001` | server port |
| `DELVE_REQUIRE_FRAMING` | `false` | warn on reasoning without a frame |
| `DELVE_CONTRADICTION_CHECK` | `true` | cross-step contradiction detection |
| `DELVE_ENABLE_SESSIONS` | `false` | per-session history isolation |
| `DELVE_MAX_HISTORY` | `100` | max steps in memory |
| `DELVE_SESSION_TIMEOUT` | `60` | session expiry (minutes) |
