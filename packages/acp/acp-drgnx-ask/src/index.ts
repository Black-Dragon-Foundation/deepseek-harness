/**
 * Turns the tools of chosen ACP kinds into permission requests.
 *
 * A `tools/pre-execute` listener that returns `{kind: 'ask'}` for a tool whose
 * ACP kind is listed in `kinds`, so the approval service asks the ACP client
 * (`session/request_permission`) before the tool runs. It never turns another
 * listener's denial or cancellation into a question and never allows anything
 * the rest of the chain would not.
 *
 * @module @deepseek-ai/dsh-acp-drgnx-ask
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import { toolKind, type ToolKind } from './kinds.ts'

export { toolKind, type ToolKind } from './kinds.ts'

export const name = 'drgnx-ask'

/** Plugin config. */
export interface Config {
  /** ACP kinds whose tools are asked about before they run. */
  kinds: ToolKind[]
}

export const Config: Schema<Config> = Schema.object({
  kinds: Schema.array(Schema.union([
    'read',
    'edit',
    'delete',
    'move',
    'search',
    'execute',
    'think',
    'fetch',
    'switch_mode',
    'other',
  ])).default([]),
})

/**
 * Mount the listener.
 * @param ctx - Cordis context carrying the tool pipeline.
 * @param config - the kinds to ask about.
 */
export function apply(ctx: Context, config: Config): void {
  const asked = new Set<string>(config.kinds)
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    const decision = await next()
    if (decision.kind !== 'allow') return decision
    const kind = toolKind(exec.name)
    return asked.has(kind) ? { kind: 'ask', reason: `${exec.name} (${kind})` } : decision
  })
}
