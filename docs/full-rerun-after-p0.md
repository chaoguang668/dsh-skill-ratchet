# Full 3-prompt rerun after the P0 boundary fix

- **Date**: 2026-10-21 (Asia/Shanghai)
- **Skill under test**: `deepseek-harness-plugin-creator`, after the raw-`register` / `defineTool` boundary warning was added.
- **Runner**: headless DSH (standard preset), one process per run; test-only dependency shims in each target directory.
- **Oracles**:
  - WSL `validate_plugin.mjs` (package/export/patch/runtime-pair structure)
  - `harness/check-mount.mjs` (mock mount + `assertSupportedJsonSchema` on every `output.schema` + raw-JSON-Schema check on `parameters`)
  - the plugin's own test where present

## Results

| Task | Condition | Validator | Mount | Parameters | Test |
|---|---|---|---|---|---|
| P1 `eval_echo` | with skill | PASS | PASS | raw JSON Schema | — |
| P1 `eval_echo` | without skill | PASS | PASS | raw JSON Schema | — |
| P2 Service + tools + timer | with skill | PASS | PASS | raw JSON Schema | **PASS** |
| P2 Service + tools + timer | without skill | PASS | PASS | raw JSON Schema | **HANG >120s** |
| P3 fixture repair | with skill | PASS | PASS | raw JSON Schema | — |
| P3 fixture repair | without skill | PASS | PASS | **not raw JSON Schema** | — |

## Tally

| Task | Winner | Why |
|---|---|---|
| P1 | **tie** | both mount with correct raw JSON Schema |
| P2 | **with skill** | with-skill test mounts, disposes, asserts cleanup, and passes; baseline plugin mounts but its test hangs |
| P3 | **with skill** | with-skill converted the fixture's `parameters` to raw JSON Schema; baseline left the shorthand map, which `register()` does not compile |

**Net: with-skill 2 wins, 1 tie.** The previous P2 fatal `type: 'json'` regression is gone.

## Caveats

- The static validator passes all six. It cannot see the P2 output-schema failure or the P3 parameter-schema difference; the mount checker is required.
- P2's difference is test quality: the baseline plugin itself mounts under the checker; its test hangs on the lifecycle await.
- P3's difference is parameter-schema correctness: both pass the structural validator, but the baseline's shorthand `parameters` would reach the model as a malformed schema.
- N=1 per prompt. This is directional evidence for the P0 fix, not a statistical claim.

## Durable check added to the optimizer

`SKILL.md` now has a fixed P0 "DSH 插件 schema 边界" item, and `references/dsh-plugin-schema-boundary.md` records the rule and a minimal mount check. The optimizer repo commit is `bf00324`.

## Conclusion

The P0 fix removed the fatal regression and produced a positive directional result (2 wins, 1 tie). Keep the boundary check as a fixed P0 item; do not rely on the static validator alone for plugin skills.
