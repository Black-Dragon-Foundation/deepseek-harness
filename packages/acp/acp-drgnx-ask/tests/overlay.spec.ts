import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { Config } from '../src/index.ts'

const overlay = fileURLToPath(new URL('./fixtures/drgnx.overlay.yml', import.meta.url))
const baseBundle = readFileSync(fileURLToPath(new URL('../../../bundle/base/cordis.patch.yml', import.meta.url)), 'utf8')

describe('the drgnx overlay', () => {
  const patches = loadOverlayPatches('test', overlay)

  it('parses with the loader the `--patch` flag uses', () => {
    expect(patches).toEqual([
      { id: 'sandbox-policy', config: { mode: 'danger-full-access' } },
      { id: 'approval', config: { policy: 'ask' } },
      { insert: [{ id: 'drgnx-ask', name: '@deepseek-ai/dsh-acp-drgnx-ask', config: { kinds: ['execute', 'edit'] } }] },
    ])
  })

  it('patches plugin ids the base bundle still declares', () => {
    for (const id of ['sandbox-policy', 'approval']) expect(baseBundle).toContain(`- id: ${id}\n`)
  })

  it('mounts the package under its real name with a config the plugin accepts', () => {
    const entry = patches.at(-1)?.insert?.[0]
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { name: string }
    expect(entry?.name).toBe(pkg.name)
    expect(Config(entry?.config as never)).toEqual({ kinds: ['execute', 'edit'] })
  })
})
