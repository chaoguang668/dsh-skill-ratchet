#!/usr/bin/env node
/**
 * Validate a generated DSH plugin at the real `ctx.tools.register` boundary.
 *
 * The static package validator does not check tool schemas. This checker mounts
 * the package with a mock context and applies `assertSupportedJsonSchema` to
 * every `output.schema`, then verifies that `parameters` is raw JSON Schema
 * (not the `defineTool` shorthand).
 *
 * Usage:
 *   node scripts/check-tool-schema.mjs <plugin-dir> --dsh-checkout <path> [--json]
 *   node scripts/check-tool-schema.mjs <plugin-dir> \
 *     --json-schema-lib <path> --cordis-lib <path> [--json]
 *
 * `--dsh-checkout` may be omitted when DSH_CHECKOUT is set or the current
 * directory is a DSH checkout containing packages/core/tools. For an installed
 * package, pass --json-schema-lib and --cordis-lib directly.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
function arg(name) {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}
const flagValues = new Set([arg('--dsh-checkout'), arg('--json-schema-lib'), arg('--cordis-lib')])
const pluginArg = argv.find(value => !value.startsWith('--') && !flagValues.has(value))
if (!pluginArg) {
  console.error('usage: node scripts/check-tool-schema.mjs <plugin-dir> --dsh-checkout <path> [--json]')
  process.exit(2)
}
const pluginDir = resolve(pluginArg)
const checkout = resolve(arg('--dsh-checkout') ?? process.env.DSH_CHECKOUT ?? process.cwd())
const asJson = argv.includes('--json')

const jsonSchemaPath = arg('--json-schema-lib')
  ? resolve(arg('--json-schema-lib'))
  : join(checkout, 'packages', 'core', 'tools', 'lib', 'types', 'json-schema.js')
if (!existsSync(jsonSchemaPath)) {
  console.error(`missing ${jsonSchemaPath}; build the checkout or pass --json-schema-lib`)
  process.exit(2)
}
const { assertSupportedJsonSchema } = await import(pathToFileURL(jsonSchemaPath).href)

const manifestPath = join(pluginDir, 'package.json')
if (!existsSync(manifestPath)) {
  console.error(`missing ${manifestPath}`)
  process.exit(2)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

function exportTarget(exportsField) {
  if (typeof exportsField === 'string') return exportsField
  if (exportsField && typeof exportsField === 'object') {
    const dot = exportsField['.']
    if (typeof dot === 'string') return dot
    if (dot && typeof dot === 'object') return dot.default ?? dot.import ?? dot.require
  }
  return undefined
}
const entryRel = exportTarget(manifest.exports) ?? manifest.main
if (!entryRel) {
  console.error('package.json has no exports["."] or main')
  process.exit(2)
}
const entry = join(pluginDir, entryRel)
if (!existsSync(entry)) {
  console.error(`missing entry ${entryRel}`)
  process.exit(2)
}

const tools = []
const disposers = []
const services = new Map()
function makeMockContext() {
  const registry = {
    register(definition) {
      tools.push(definition)
      return () => {}
    },
    get(name) { return tools.find(tool => tool.name === name) },
    list() { return tools.slice() },
  }
  services.set('tools', registry)
  return {
    tools: registry,
    effect(fn) {
      const disposer = fn()
      if (typeof disposer === 'function') disposers.push(disposer)
      return () => {}
    },
    provide(name, value) { services.set(name, value) },
    set(name, value) { services.set(name, value) },
    get(name) { return services.get(name) },
    reflect: {
      provide(name, value) { services.set(name, value) },
      set(name, value) { services.set(name, value) },
      get(name) { return services.get(name) },
    },
    plugin() {},
    on() { return () => {} },
    emit() {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  }
}

const module = await import(pathToFileURL(entry).href)
let mount = 'ok'
let mountError
try {
  if (typeof module.apply === 'function') {
    await module.apply(makeMockContext(), {})
  } else if (typeof module.default === 'function' && module.default.prototype) {
    const cordisPath = arg('--cordis-lib')
      ? resolve(arg('--cordis-lib'))
      : join(checkout, 'vendor', 'cordis', 'lib', 'index.js')
    if (!existsSync(cordisPath)) throw new Error(`missing ${cordisPath}`)
    const { Context } = await import(pathToFileURL(cordisPath).href)
    const ctx = new Context()
    const mock = makeMockContext()
    if (typeof ctx.provide === 'function') ctx.provide('tools', mock.tools)
    else if (typeof ctx.set === 'function') ctx.set('tools', mock.tools)
    ctx.plugin(module.default)
    await new Promise(resolve => setTimeout(resolve, 20))
    try { await ctx.dispose?.() } catch {}
  } else if (typeof module.default === 'function') {
    await module.default(makeMockContext(), {})
  } else if (module.default && typeof module.default.apply === 'function') {
    await module.default.apply(makeMockContext(), {})
  } else {
    throw new Error('no callable apply/default plugin export')
  }
} catch (error) {
  mount = 'error'
  mountError = error instanceof Error ? error.message : String(error)
}

const report = {
  plugin: pluginDir,
  mount,
  ...(mountError ? { error: mountError } : {}),
  tools: [],
}
let passed = mount === 'ok' && tools.length > 0

for (const tool of tools) {
  const item = { name: tool.name, output: 'ok', parameters: 'json-schema', render: 'ok', execute: 'ok' }
  try {
    assertSupportedJsonSchema(tool.output?.schema)
  } catch (error) {
    item.output = `throw: ${error instanceof Error ? error.message : String(error)}`
    passed = false
  }
  const params = tool.parameters
  if (!params || typeof params !== 'object' || params.type !== 'object' || typeof params.properties !== 'object') {
    item.parameters = 'not-raw-json-schema'
    passed = false
  }
  if (typeof tool.output?.render !== 'function') {
    item.render = 'missing'
    passed = false
  }
  if (typeof tool.execute !== 'function') {
    item.execute = 'missing'
    passed = false
  }
  report.tools.push(item)
}

report.pass = passed

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`plugin: ${pluginDir}`)
  console.log(`mount:  ${report.mount}${report.error ? ` (${report.error})` : ''}`)
  if (report.tools.length === 0) console.log('tools:  (none registered)')
  for (const tool of report.tools) {
    console.log(`- ${tool.name}: output=${tool.output} parameters=${tool.parameters} render=${tool.render} execute=${tool.execute}`)
  }
  console.log(`result: ${passed ? 'PASS' : 'FAIL'}`)
}
process.exit(passed ? 0 : 1)
