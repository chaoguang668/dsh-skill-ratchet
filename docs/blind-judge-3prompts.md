# Blind paired judge: 3 prompts × with/without skill

- **Date**: 2026-10-21 (Asia/Shanghai)
- **Mode**: `paired` blind A/B, 3 independent judges, same anonymized artifact set.
- **Artifacts**: the six `full_test` outputs from `docs/full-test-3prompts.md`.
- **Mapping**: P1 `A = with skill`, `B = without`; P2 `A = without`, `B = with`; P3 `A = with`, `B = without`.
- **Judge inputs**: files only; no `with`/`without` labels; no WSL; both candidates already pass the structural validator.

## Verdicts

| Judge | P1 | P2 | P3 |
|---|---|---|---|
| J1 | **A** (high) | **A** (medium) | tie (high) |
| J2 | **A** (high) | **A** (medium) | tie (high) |
| J3 | **A** (high) | **A** (high) | tie (high) |

Tally in condition terms:

| Task | With skill | Without skill | Verdict |
|---|---|---|---|
| P1 (`eval_echo`) | **3/3 wins** | 0 | with skill better |
| P2 (Service + tools + timer + test) | 0 | **3/3 wins** | **without skill better — with-skill output is load-fatal** |
| P3 (fixture repair) | tie | tie | no difference (byte-identical) |

**Net: 1 win, 1 loss, 1 tie. No overall advantage; one fatal regression.**

## Why

### P1 — with skill wins

`ctx.tools.register` forwards `parameters` to the model as raw JSON Schema. The with-skill candidate declared:

```js
parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }
```

The without-skill candidate declared the `defineTool` authoring shorthand:

```js
parameters: { text: { type: 'string', required: true } }
```

Only `defineTool` compiles shorthand to JSON Schema (`packages/core/tools/src/schema.ts:577`); `register` does not. The without-skill schema reaches the model without an object root and with an invalid boolean `required`, and the checkout validator rejects `schema.text` as an unsupported keyword.

### P2 — with skill loses, fatally

The with-skill candidate put `value: { type: 'json' }` inside `eval_get`'s **output** schema. `register()` validates `output.schema` with `assertSupportedJsonSchema`, whose closed type set has no `json` (`json` is a `defineTool` DSL type). The second tool registration throws, so the plugin never mounts.

The without-skill candidate's output schemas are register-safe (`value: {}` for unconstrained JSON), so it loads. Its `parameters` still use the uncompiled shorthand, but that is a degraded, non-fatal defect.

Both P2 tests are green because the test mocks record tool definitions without validating output schemas. This is a real test blind spot, not evidence of a working plugin.

### P3 — tie

All three files (`index.js`, `package.json`, `cordis.patch.yml`) are byte-identical between A and B. Both fix the same four fixture defects and preserve `eval_echo`. Both retain the same uncompiled shorthand `parameters` flaw, so there is no differentiator.

## Ground truth to carry forward

- At the `ctx.tools.register` boundary, `parameters` **is raw JSON Schema**.
- The `{param:{type,required:true}}` shorthand and `type:'json'` are **`defineTool` authoring forms only**; `register()` never compiles them.
- `register()` validates `output.schema`; `type:'json'` there is fatal.
- A test that mocks the tools registry must validate `output.schema` or it can bless an unmountable plugin.

## Action for the optimizer skill

This is the concrete P0 fix suggested by the sample: add a boundary warning to `references/api-quick-reference.md` (and the relevant SKILL.md section) that raw `ctx.tools.register` takes raw JSON Schema, while shorthand and `type:'json'` require `defineTool`. Do not edit the target skill based on the sample; fix the optimizer's guidance first, then re-run the same P2 prompt.
