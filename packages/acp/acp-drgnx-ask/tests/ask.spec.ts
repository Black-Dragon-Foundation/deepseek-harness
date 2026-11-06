import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { type PreToolDecision } from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { defineContentToolFixture, executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import * as DrgnxAsk from '../src/index.ts'

const agent = { id: 'agent' } as unknown as Agent
const signal = new AbortController().signal

describe('drgnx ask plugin', () => {
  const contexts: Context[] = []

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  })

  async function mount(kinds: DrgnxAsk.Config['kinds'], outcome: string = 'allowed-once') {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(NativeToolExecutor)
    const request = vi.fn(() => Promise.resolve(outcome))
    ctx.provide('approval', { request } as never)
    await ctx.plugin(DrgnxAsk, DrgnxAsk.Config({ kinds }))
    const ran: string[] = []
    for (const name of ['bash', 'read']) {
      ctx.tools.register(defineContentToolFixture({
        name, description: name, parameters: {},
        execute: () => { ran.push(name); return Promise.resolve([{ type: 'text', text: 'ok' }]) },
      }))
    }
    const run = (name: string) => executeToolFixture(ctx, { signal, callId: ToolCallId(`call-${name}`), name, arguments: {}, agent })
    return { ctx, request, ran, run }
  }

  it('asks for a tool of a subscribed kind and runs it when allowed', async () => {
    const { request, ran, run } = await mount(['execute'])
    await run('bash')
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'bash', callId: 'call-bash' }))
    expect(ran).toEqual(['bash'])
  })

  it('does not run a subscribed tool the client rejects', async () => {
    const { ran, run } = await mount(['execute'], 'rejected')
    const result = await run('bash')
    expect(ran).toEqual([])
    expect(result.isError).toBe(true)
  })

  it('leaves a tool of another kind alone', async () => {
    const { request, ran, run } = await mount(['execute'])
    await run('read')
    expect(request).not.toHaveBeenCalled()
    expect(ran).toEqual(['read'])
  })

  it('asks for nothing with no kinds', async () => {
    const { request, run } = await mount([])
    await run('bash')
    expect(request).not.toHaveBeenCalled()
  })

  it('never turns a denial from another listener into a question', async () => {
    const { ctx, request, ran, run } = await mount(['execute'])
    ctx.on('tools/pre-execute', (): Promise<PreToolDecision> => Promise.resolve({ kind: 'deny', reason: 'blocked' }))
    const result = await run('bash')
    expect(result.isError).toBe(true)
    expect(request).not.toHaveBeenCalled()
    expect(ran).toEqual([])
  })
})
