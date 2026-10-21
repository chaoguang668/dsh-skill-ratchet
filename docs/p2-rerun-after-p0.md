# P2 rerun after the `register` / `defineTool` boundary fix

- **Date**: 2026-10-21 (Asia/Shanghai)
- **Trigger**: the blind judges found the with-skill P2 candidate load-fatal (`type: 'json'` in `output.schema`, rejected by `assertSupportedJsonSchema`).
- **Change**: added an explicit boundary warning to the target skill:
  - `references/api-quick-reference.md`: raw `ctx.tools.register` takes raw JSON Schema; the shorthand map and `type: 'json'` are `defineTool` authoring forms only; `output.schema` rejects `type: 'json'`.
  - `SKILL.md`: same rule under "Implement the Harness-native boundary", plus a note that a mock tools registry must validate captured `output.schema`.
  - Backups: `*.bak-20261021-p0`.
- **Runner**: headless DSH (standard preset), same P2 prompt, `p2b-with` / `p2b-without`.
- **Oracles**: WSL `validate_plugin.mjs`; `harness/check-mount.mjs` (mock mount + `assertSupportedJsonSchema` on every output schema + raw-JSON-Schema check on `parameters`); the plugin's own test.

## Results

| Condition | Validator | Mount | Parameters | Output schemas | Test |
|---|---|---|---|---|---|
| **with updated skill** | PASS | PASS | raw JSON Schema | ok | **PASS** (1/1) |
| without skill | PASS | PASS | raw JSON Schema | ok | **HANG > 120 s** |

## Details

- Both candidates now use `defineTool`, so their `parameters` arrive at `register` as real JSON Schema and their `output.schema` values are legal. The previous with-skill `type: 'json'` fatal regression is gone.
- The with-skill test mounts a real Cordis `Context`, provides a tools stub, uses the service and both tools, disposes the fiber, and asserts cleanup. It passes in ~145 ms.
- The without-skill plugin itself mounts under the checker, but its test hangs. Its test does `await ctx.plugin(mockTools)` and then `await fiber`; the same plugin/test shape with `ctx.provide` + a short wait (the with-skill test) passes. Treat this as a test-authoring/lifecycle-await defect, not proof that the baseline plugin is unmountable.

## Conclusion

- The P0 fix is verified: the with-skill P2 is mountable and its test passes.
- The static validator still does not discriminate (both PASS). The mount checker plus the plugin test are required to catch the previous fatal bug.
- P2 flips from "without skill wins" to "with skill wins" on test quality, but the baseline plugin is mountable; this is a test-quality difference, not a second fatal regression.
- For future P2 evaluations, use the mount checker (or a test mock that validates `output.schema`) as the primary oracle; do not rely on the static validator alone.
