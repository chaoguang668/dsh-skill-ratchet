# Real optimization cycle: `deepseek-harness-plugin-creator` P0

- **Date**: 2026-10-21 (Asia/Shanghai)
- **Target**: `C:\Users\110\.dsh\skills\deepseek-harness-plugin-creator`
- **Ratchet**: local git initialized for this cycle
  - baseline (pre-P0): `76915a8`
  - keep (P0 boundary warning): `5e620cb`
- **Candidate diff**: `SKILL.md` + `references/api-quick-reference.md`, 15 insertions / 1 deletion.

## Candidate

The change adds the raw-`register` / `defineTool` boundary rule:

- `ctx.tools.register()` takes raw JSON Schema in `parameters` and `output.schema`.
- The shorthand map and `type: 'json'` are `defineTool` authoring forms; `register()` never compiles them.
- `type: 'json'` in `output.schema` throws at registration; use `{}` for unconstrained JSON.
- A mock tools registry must validate captured `output.schema`.

## Paired judges

Three independent judges read both worktrees in one call and scored the 9 dimensions. A/B labels were swapped for J2 to counter position bias.

| Judge | A | B | Old total | New total | Verdict | Margin |
|---|---|---|---|---|---|---|
| J1b | old | new | 60.7 | 83.4 | **better_B (new)** | clear |
| J2 | new | old | 62.0 | 77.1 | **better_A (new)** | clear |
| J3 | old | new | 66.0 | 85.2 | **better_B (new)** | clear |

**Vote: 3-0 better (new), all clear. Decision: `keep`.**

Average absolute totals (judge-specific, triage only): **old 62.9 → new 81.9 (+19.0)**.

The gain concentrates on **dim8 (measured performance, weight 23)**: the old version's P2 plugin used `type: 'json'` in `output.schema`, `ctx.tools.register` threw, and the plugin never mounted; the new version's plugin passed the structural validator, mounted, and its test passed. Smaller gains on dim3 (failure-mode encoding), dim5 (actionable specificity), and dim9 (blacklist).

## Why this is a valid keep

The optimizer's v2.1 rule is paired majority, not absolute delta. All three judges preferred the new version; no judge voted worse. The absolute totals are not comparable to the earlier dry-run 80.0 because the judges are different and absolute scores carry ±8 noise.

## Residual gap

J3's caveat is recorded: the target skill's `scripts/validate_plugin.mjs` and `accept_plugin.mjs` are unchanged, so the static validator still cannot catch a `type: 'json'` output schema. The boundary is currently enforced by prose plus the separate `scripts/check-tool-schema.mjs` checker. The next ratchet round should wire that schema check into the target validator or troubleshooting path.

## Repo records

- `results.tsv` row: `2026-10-21T14:37  5e620cb  deepseek-harness-plugin-creator  62.9  3-0 better  keep  dim3  ...  paired`
- Target git log:
  ```
  5e620cb keep: add raw-register/defineTool boundary warning
  76915a8 baseline: pre-P0 deepseek-harness-plugin-creator
  ```
