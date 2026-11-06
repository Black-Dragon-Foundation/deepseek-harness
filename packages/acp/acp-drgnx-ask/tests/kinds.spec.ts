import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toolKind } from '../src/index.ts'

// Tool names with no standard ACP kind of their own.
const OTHER_BY_DESIGN = new Set<string>([])

describe('toolKind', () => {
  it('maps the shipped tool catalog: every registered tool name has a kind', () => {
    const catalog = readFileSync(fileURLToPath(new URL('../../../../docs/tool-catalog.md', import.meta.url)), 'utf8')
    const names = [...new Set([...catalog.matchAll(/^### `([a-z_]+)`/gm)].map(match => match[1]!))]
    expect(names.length).toBeGreaterThan(50)
    const unmapped = names.filter(name => toolKind(name) === 'other' && !OTHER_BY_DESIGN.has(name))
    expect(unmapped).toEqual([])
  })

  it('names the kinds of the common tools', () => {
    expect(toolKind('read')).toBe('read')
    expect(toolKind('edit')).toBe('edit')
    expect(toolKind('grep')).toBe('search')
    expect(toolKind('bash')).toBe('execute')
    expect(toolKind('web_fetch')).toBe('fetch')
    expect(toolKind('exit_plan_mode')).toBe('switch_mode')
  })

  it('gives other to a tool it does not know, including inherited object keys', () => {
    expect(toolKind('mcp__server__tool')).toBe('other')
    expect(toolKind('constructor')).toBe('other')
    expect(toolKind('toString')).toBe('other')
  })
})
