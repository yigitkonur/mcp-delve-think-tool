# DELVE Test Scenarios

Manual e2e-style test scenarios for verifying DELVE's reasoning engine via MCP tool calls. Each scenario walks through a realistic use case step-by-step, showing the exact tool call payload and what to verify in the response.

## How to run

1. Start the server: `NODE_ENV=production pnpm start` (or `pnpm dev`)
2. Open MCP Inspector: `pnpm inspect`
3. Follow each scenario's steps in order, pasting payloads into the inspector
4. Verify the expected response fields at each step

## Scenarios

| # | Scenario | Tests | Steps |
|---|----------|-------|-------|
| 01 | Full reasoning flow | check → frame → reason chain → completion | 4 |
| 02 | Contradiction detection | conflicting premises flagged across steps | 3 |
| 03 | Stability cascade | weak premise propagates through dependency chain | 3 |
| 04 | Simple task triage | delve-check recommends skipping full reasoning | 1 |
| 05 | Revision correction | revise earlier step, verify revised_by marking | 3 |
| 06 | Unframed reasoning | reasoning without framing produces warnings | 2 |

## Naming convention

```
test-scenarios/
  [NN]-[scenario-slug]/
    step-01/
      01-tool-name-action.md    ← payload + expected response
    step-02/
      01-tool-name-action.md
```
