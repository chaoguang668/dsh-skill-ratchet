# Full-test sample: 3 prompts × with/without skill

- **Date**: 2026-10-21 (Asia/Shanghai)
- **Mode**: `full_test` — 3 bounded plugin tasks, each run with and without `deepseek-harness-plugin-creator`.
- **Runner**: headless DSH (`--profile headless`, standard preset), one process per run.
- **Oracle**: `validate_plugin.mjs` (real POSIX validator under WSL) plus the run's own unit test where present.
- **Why headless**: Web subagents failed before execution with `unknown prompt variable "{{cwd}}" in section "deployment:persona-prefix"`. The `router-standard` preset persona referenced `{{cwd}}`, which child agents do not register. The preset source was patched (backups preserved); the already-running Web process still holds the old preset and needs a restart. Headless uses the standard preset and was unaffected.

## Prompts

| ID | Task | With skill | Without skill |
|---|---|---|---|
| P1 | Minimal Tool plugin: `eval_echo` returns required string `text` | validator | validator |
| P2 | Service `evalStore` + `eval_set`/`eval_get` + `ctx.effect()` timer/test | validator + unit test | validator + unit test |
| P3 | Fix a fixture with four known validator errors | validator | validator |

Baseline runs were told not to call the `skill` tool or read the skill directory. P3 baseline was given the same four error messages as the with-skill run, which made the task substantially easier.

## Results

| ID | Condition | Validator | Unit test | Notes |
|---|---|---|---|---|
| P1 | with skill | **PASS** | — | minimal ESM plugin, own patch |
| P1 | without skill | **PASS** | — | same structural shape |
| P2 | with skill | **PASS** | **PASS** (1/1) | real Cordis Context or faithful mock; awaited timer disposal |
| P2 | without skill | **PASS** | **PASS** (1/1) | faithful mock; awaited cleanup |
| P3 | with skill | **PASS** | — | fixture repaired; package identity aligned |
| P3 | without skill | **PASS** | — | fixture repaired |

**Deterministic oracle: 6/6 PASS. Difference between conditions: 0.**

All runs also emitted only warnings for missing README/LICENSE/lockfile/SECURITY docs; no errors remained.

## What this says

- The sample is a **ceiling test**: the validator checks package shape, export root, patch presence, runtime pairs, and frozen-tree hygiene — not whether the tool semantics or the skill's guidance are better. Both conditions can satisfy it.
- P3 gave the baseline the exact four error strings, so the baseline did not need the skill's diagnostic taxonomy.
- P2's unit test passes in both conditions; the baseline reproduced a faithful mock and awaited cleanup.
- Conclusion for this sample: **no measurable advantage for the skill**. This is not evidence that the skill is useless; it is evidence that these three tasks are too easy and the oracle is structural.

## Next options

1. **Paired judge**: blind A/B on the three pairs for completeness, failure-mode handling, schema correctness, test fidelity, and safety. The deterministic pass/fail has no headroom.
2. **Harder prompts**: Web client extension, cross-session memory plugin, or a broken plugin with hidden (not listed) failures.
3. **Stronger oracle**: `accept_plugin.mjs --trusted-execute` (pack, install into a temporary `DSH_HOME`, boot) instead of static validation.
4. **Do not edit the target skill based on this sample**; it does not support a keep decision.
