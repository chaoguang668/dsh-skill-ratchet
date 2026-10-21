# DSH tool-schema boundary (P0 check)

This is the fixed check for plugin-authoring skills. Run it before the 9-dimension
score; a hit here is a correctness failure, not a style issue.

## Rule

- At the `ctx.tools.register()` boundary, `parameters` **is raw JSON Schema**:
  `{ type: 'object', properties: { ... }, required: [...] }`.
- The `{ param: { type, required: true } }` shorthand and `type: 'json'` are
  `defineTool` authoring forms only. `register()` never compiles them.
- `register()` validates `output.schema` with `assertSupportedJsonSchema`.
  `type: 'json'` is not a supported wire type there and throws at registration;
  use `{}` for unconstrained JSON.
- A test that mocks the tools registry must call `assertSupportedJsonSchema` on
  every captured `output.schema`, or it can pass an unmountable plugin.

## Run the bundled checker

```bash
node scripts/check-tool-schema.mjs <plugin-dir> --dsh-checkout <dsh-checkout>
```

`--json` returns a machine-readable report. Exit 1 means: mount failed, an
`output.schema` was rejected, `parameters` was not raw JSON Schema,
`render`/`execute` was missing, or no tool was registered.

For an installed DSH package, bypass the checkout layout:

```bash
node scripts/check-tool-schema.mjs <plugin-dir> \
  --json-schema-lib node_modules/@deepseek-ai/dsh-tools/lib/types/json-schema.js \
  --cordis-lib node_modules/@deepseek-ai/cordis/lib/index.js
```

## Failure this catches

A skill-guided P2 candidate used `value: { type: 'json' }` inside
`eval_get.output.schema`, then called `ctx.tools.register()` directly. The
second tool registration threw and the plugin never mounted. Its test was green
because the mock recorded definitions without validating schemas.

## Minimal check

1. Grep every `register(` call for a `parameters` that lacks
   `type: 'object'` / `properties` / `required: [...]`.
2. Grep every `output.schema` for `type: 'json'`; replace with `{}` or a real
   JSON type.
3. Mount the plugin with a mock context and call
   `assertSupportedJsonSchema(tool.output.schema)` for each captured tool.
4. Decide pass/fail from the mount + schema check, not from the static
   `validate_plugin.mjs` alone.

Reference oracle used by the DSH evaluation:

```js
import { assertSupportedJsonSchema } from '<dsh-checkout>/packages/core/tools/lib/types/json-schema.js'

const tools = []
const ctx = {
  tools: { register(definition) { tools.push(definition); return () => {} } },
  effect(fn) { const disposer = fn(); return () => {} },
  provide() {}, set() {}, get() {},
  reflect: { provide() {}, set() {}, get() {} },
}
await module.apply(ctx, {})
for (const tool of tools) {
  assertSupportedJsonSchema(tool.output.schema)
  if (tool.parameters?.type !== 'object' || typeof tool.parameters?.properties !== 'object') {
    throw new Error(`${tool.name}: parameters is not raw JSON Schema`)
  }
}
```

If the plugin default-exports a `Service` class instead of named `apply`, mount
it through a real Cordis `Context` with a mock `tools` service, then apply the
same check.
