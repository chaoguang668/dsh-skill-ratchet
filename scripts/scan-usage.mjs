#!/usr/bin/env node
/**
 * DSH skill usage scanner.
 *
 * Usage:
 *   node scripts/scan-usage.mjs [--sessions <dir>] [--usage <file>] [--json]
 *
 * Counts real `skill` tool calls in DSH session logs, then merges the
 * `~/.dsh/evolve/usage.json` injection counts. Injection is not usage:
 * a skill entry can be injected into the system prompt and never invoked.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { homedir } from 'node:os'
import { zstdDecompressSync } from 'node:zlib'

if (typeof zstdDecompressSync !== 'function') {
  console.error('This script needs Node 22.15+ or 24+ (zlib.zstdDecompressSync).')
  process.exit(1)
}

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const sessionsRoot = arg('--sessions', join(homedir(), '.dsh', 'sessions'))
const usagePath = arg('--usage', join(homedir(), '.dsh', 'evolve', 'usage.json'))
const asJson = args.includes('--json')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else if (entry.name.endsWith('.zstd')) out.push(path)
  }
  return out
}

function decompress(file) {
  const buf = readFileSync(file)
  const starts = []
  let idx = buf.indexOf(MAGIC)
  while (idx !== -1) {
    starts.push(idx)
    idx = buf.indexOf(MAGIC, idx + 4)
  }
  const chunks = []
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : buf.length
    try {
      chunks.push(zstdDecompressSync(buf.subarray(starts[i], end)))
    } catch {
      // A damaged frame should not hide the rest of the session.
    }
  }
  return Buffer.concat(chunks).toString('utf8')
}

const calls = new Map()
const sessions = new Map()
for (const file of walk(sessionsRoot)) {
  let text = ''
  try {
    text = decompress(file)
  } catch {
    continue
  }
  const session = basename(dirname(file))
  for (const line of text.split('\n')) {
    if (!line.includes('"skill"')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const content = event?.data?.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block?.type !== 'tool-call') continue
      const tool = block.name ?? block.toolName
      if (tool !== 'skill') continue
      let input = block.arguments
      if (typeof input === 'string') {
        try {
          input = JSON.parse(input)
        } catch {
          input = null
        }
      }
      const skill = input?.name
      if (!skill) continue
      calls.set(skill, (calls.get(skill) ?? 0) + 1)
      if (!sessions.has(skill)) sessions.set(skill, new Set())
      sessions.get(skill).add(session)
    }
  }
}

const injections = new Map()
if (existsSync(usagePath)) {
  try {
    const usage = JSON.parse(readFileSync(usagePath, 'utf8'))
    for (const [key, value] of Object.entries(usage?.counts ?? {})) {
      if (key.startsWith('skill:') && typeof value === 'number') injections.set(key.slice(6), value)
    }
  } catch {
    // A missing or malformed usage file only removes the secondary signal.
  }
}

const names = new Set([...calls.keys(), ...injections.keys()])
const rows = [...names]
  .map(name => ({
    name,
    calls: calls.get(name) ?? 0,
    sessions: sessions.get(name)?.size ?? 0,
    injections: injections.get(name) ?? 0,
  }))
  .sort((a, b) => b.calls - a.calls || b.injections - a.injections || a.name.localeCompare(b.name))

if (asJson) {
  console.log(JSON.stringify({ sessionsRoot, usagePath, rows }, null, 2))
} else {
  const width = Math.max(5, ...rows.map(row => row.name.length)) + 2
  console.log(`sessions: ${sessionsRoot}`)
  console.log(`usage:    ${usagePath}`)
  console.log('')
  console.log('Skill'.padEnd(width) + 'calls  sessions  injections')
  for (const row of rows) {
    console.log(
      row.name.padEnd(width) + String(row.calls).padEnd(6) + String(row.sessions).padEnd(10) + row.injections,
    )
  }
  if (rows.length === 0) console.log('(no skill usage found)')
}
