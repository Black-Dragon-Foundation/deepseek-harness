import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type { StreamChunk } from '@deepseek-ai/dsh-llm'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { makeBridgeHarness, textResponse, type BridgeHarness } from './harness.ts'

const PANEL = { '_drgnx/panel': { version: 1 } }

describe('_drgnx/panel extension', () => {
  let harness: BridgeHarness | undefined

  afterEach(async () => {
    await harness?.dispose()
    harness = undefined
  })

  async function start(options: { offer?: boolean; script?: StreamChunk[][] } = {}) {
    harness = await makeBridgeHarness({ script: options.script ?? [] })
    const init = await harness.client.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: options.offer === false ? {} : { _meta: PANEL },
    })
    const { sessionId } = await harness.client.newSession({ cwd: process.cwd(), mcpServers: [] })
    return { init, sessionId }
  }

  function registerEcho(ran: string[]): void {
    harness!.ctx.tools.register(defineContentToolFixture({
      name: 'bash', description: 'Run.', parameters: {},
      execute: () => { ran.push('bash'); return Promise.resolve([{ type: 'text', text: 'ran' }]) },
    }))
  }

  it('advertises context and before-tool only to a client that offered version 1', async () => {
    const { init } = await start()
    expect(init.agentCapabilities?._meta).toEqual({ '_drgnx/panel': { version: 1, features: ['context', 'before-tool'] } })
    await harness!.dispose()
    harness = await makeBridgeHarness()
    const plain = await harness.client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    expect(plain.agentCapabilities?._meta).toBeUndefined()
    await harness.dispose()
    harness = await makeBridgeHarness()
    const wrong = await harness.client.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { _meta: { '_drgnx/panel': { version: 2 } } },
    })
    expect(wrong.agentCapabilities?._meta).toBeUndefined()
  })

  it('sends the context breakdown after an assistant message', async () => {
    const { sessionId } = await start({ script: [textResponse('hello there')] })
    await harness!.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'say hello' }] })
    await vi.waitFor(() => { expect(harness!.contextNotifications).toHaveLength(1) })
    const sent: unknown = harness!.contextNotifications[0]
    expect(sent).toHaveProperty('sessionId', sessionId)
    expect(sent).toHaveProperty('size', 1_024)
    expect(sent).toHaveProperty('used')
    expect(sent).toHaveProperty('parts.0.kind')
    expect(sent).toHaveProperty('parts.0.tokens')
    expect(JSON.stringify(sent)).not.toContain('"tokens":0')
  })

  it('sends no context to a client that did not offer the extension', async () => {
    const { sessionId } = await start({ offer: false, script: [textResponse('hello')] })
    await harness!.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'hi' }] })
    await vi.waitFor(() => { expect(harness!.updates.at(-1)?.sessionUpdate).toBe('usage_update') })
    expect(harness!.contextNotifications).toHaveLength(0)
  })

  it('asks before a tool runs and continues on allow', async () => {
    const ran: string[] = []
    const { sessionId } = await start({ script: [toolCallResponse('c1', 'bash', { command: 'ls' }), textResponse('done')] })
    registerEcho(ran)
    await harness!.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'go' }] })
    expect(harness!.beforeToolRequests).toEqual([{
      sessionId,
      toolCall: { toolCallId: 'c1', title: 'bash', kind: 'execute', status: 'pending', rawInput: { command: 'ls' } },
    }])
    expect(ran).toEqual(['bash'])
  })

  it('denies the tool on deny, on a failed request and on an unreadable answer', async () => {
    for (const answer of [
      () => ({ outcome: 'deny', reason: 'not here' }),
      () => { throw new Error('client gone') },
      () => ({ outcome: 'maybe' }),
      () => ({}),
    ]) {
      const ran: string[] = []
      const { sessionId } = await start({ script: [toolCallResponse('c1', 'bash', {}), textResponse('done')] })
      registerEcho(ran)
      harness!.onBeforeTool = answer
      await harness!.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'go' }] })
      expect(ran).toEqual([])
      expect(harness!.beforeToolRequests).toHaveLength(1)
      await harness!.dispose()
      harness = undefined
    }
  })

  it('does not ask a client that did not offer the extension', async () => {
    const ran: string[] = []
    const { sessionId } = await start({ offer: false, script: [toolCallResponse('c1', 'bash', {}), textResponse('done')] })
    registerEcho(ran)
    await harness!.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'go' }] })
    expect(harness!.beforeToolRequests).toHaveLength(0)
    expect(ran).toEqual(['bash'])
  })

  it('carries kind, title and input in the permission request', async () => {
    const { sessionId } = await start({ script: [toolCallResponse('c1', 'bash', { command: 'ls' }), textResponse('done')] })
    registerEcho([])
    const { default: ApprovalService } = await import('@deepseek-ai/dsh-user-approval')
    await harness!.ctx.plugin(ApprovalService)
    harness!.ctx.on('tools/pre-execute', (_exec, next) => next().then(() => ({ kind: 'ask' as const })))
    harness!.onPermission = () => ({ outcome: { outcome: 'selected', optionId: 'allow-once' } })
    await harness!.client.prompt({ sessionId, prompt: [{ type: 'text', text: 'go' }] })
    expect(harness!.permissionRequests[0]?.toolCall).toMatchObject({
      toolCallId: 'c1', title: 'bash', kind: 'execute', rawInput: { command: 'ls' },
    })
  })
})
