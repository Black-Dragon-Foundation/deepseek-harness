/**
 * The `_drgnx/panel` ACP extension (drgnx's editor panel), version 1.
 *
 * The server advertises `agentCapabilities._meta["_drgnx/panel"] = {version, features}`
 * only to a client that sent `clientCapabilities._meta["_drgnx/panel"] = {version: 1}`,
 * and only with the features the harness can serve:
 * - `context`: a `_drgnx/context` notification after each assistant message, from the
 *   token meter's heuristic system, tools, and message composition.
 * - `before-tool`: a `_drgnx/before_tool` request before every tool call of a top-level
 *   session agent, honouring the answer.
 *
 * Not advertised: `drop` and `pin` (no logged edit of the surface is wired to the panel),
 * `compact-preview` (a compaction is a model call and has no dry run).
 */

import type { Context } from '@deepseek-ai/cordis'
import type { AgentContext, InitializeRequest } from '@agentclientprotocol/sdk'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { toolKind } from '@deepseek-ai/dsh-acp-drgnx-ask'
import type { Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-token-meter'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'

export const DRGNX_PANEL_KEY = '_drgnx/panel'
export const DRGNX_CONTEXT_METHOD = '_drgnx/context'
export const DRGNX_BEFORE_TOOL_METHOD = '_drgnx/before_tool'
const VERSION = 1
const FEATURES = ['context', 'before-tool']

/** Whether the client offered `_drgnx/panel` version 1. */
export function clientOffersPanel(params: InitializeRequest): boolean {
  const meta = params.clientCapabilities?._meta as Record<string, { version?: number } | undefined> | null | undefined
  return meta?.[DRGNX_PANEL_KEY]?.version === VERSION
}

/** The `agentCapabilities._meta` entry for a client that offered the extension. */
export function panelCapability(): { [DRGNX_PANEL_KEY]: { version: number; features: string[] } } {
  return { [DRGNX_PANEL_KEY]: { version: VERSION, features: [...FEATURES] } }
}

interface ContextPart {
  kind: 'system' | 'tools' | 'conversation'
  tokens: number
}

/** The `_drgnx/context` parameters, or undefined when the meter or the window size is unknown. */
export function contextOf(ctx: Context, session: Session): { used: number; size: number; parts: ContextPart[] } | undefined {
  const size = session.requestContext()?.contextWindow
  const meter = ctx.get('tokenMeter')
  if (size === undefined || meter === undefined) return undefined
  const { systemTokens, toolsTokens, messageTokens } = meter.contextBreakdown(session)
  const parts: ContextPart[] = [
    { kind: 'system', tokens: systemTokens },
    { kind: 'tools', tokens: toolsTokens },
    { kind: 'conversation', tokens: messageTokens },
  ]
  return { used: meter.measure(session).totalTokens, size, parts: parts.filter(part => part.tokens > 0) }
}

/** The tool call the hub reads in `_drgnx/before_tool`. */
function toolCallOf(exec: ToolExecution): Record<string, unknown> {
  return {
    toolCallId: exec.callId,
    title: exec.name,
    kind: toolKind(exec.name),
    status: 'pending',
    rawInput: exec.arguments,
  }
}

/** Dependencies of the panel, owned by the bridge. */
export interface PanelOptions {
  ctx: Context
  conn: () => AgentContext
  /** The session record's pending-update drain for an agent, when the bridge owns it. */
  drain: (agent: Agent) => Promise<void> | undefined
}

/** The extension's state for one ACP connection. */
export class DrgnxPanel {
  private offered = false

  constructor(private readonly options: PanelOptions) {}

  /** Remember what the client offered. */
  initialize(params: InitializeRequest): void {
    this.offered = clientOffersPanel(params)
  }

  /** The extension's capability entry, only for a client that offered it. */
  capability(): { [DRGNX_PANEL_KEY]: { version: number; features: string[] } } | undefined {
    return this.offered ? panelCapability() : undefined
  }

  /** Send `_drgnx/context` for a session; a failed send is logged and never fails the turn. */
  async pushContext(session: Session): Promise<void> {
    if (!this.offered) return
    const context = contextOf(this.options.ctx, session)
    if (context === undefined) return
    try {
      await this.options.conn().notify(DRGNX_CONTEXT_METHOD, { sessionId: session.id, ...context })
    } catch (error: unknown) {
      this.options.ctx.logger.warn(`acp: ${DRGNX_CONTEXT_METHOD} failed: ${String(error)}`)
    }
  }

  /**
   * Ask the client before a tool of an owned agent runs. An allow only continues the
   * chain; a deny, a failed request, or an answer that is neither denies the tool.
   */
  async beforeTool(exec: ToolExecution, next: () => Promise<PreToolDecision>): Promise<PreToolDecision> {
    const agent = exec.agent
    if (!this.offered || agent === undefined) return next()
    const drained = this.options.drain(agent)
    if (drained === undefined) return next()
    try {
      await drained
      const answer = await this.options.conn().request<{ outcome?: unknown; reason?: unknown } | undefined>(
        DRGNX_BEFORE_TOOL_METHOD,
        { sessionId: agent.session.id, toolCall: toolCallOf(exec) },
        { cancellationSignal: exec.signal },
      )
      if (answer?.outcome === 'allow') return await next()
      const reason = typeof answer?.reason === 'string' && answer.reason.length > 0
        ? answer.reason
        : 'denied by the editor'
      return { kind: 'deny', reason }
    } catch (error: unknown) {
      if (exec.signal.aborted) return { kind: 'cancel' }
      return { kind: 'deny', reason: `the editor's tool check failed: ${String(error)}` }
    }
  }
}
