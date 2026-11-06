# drgnx changes

What the drgnx fork adds on top of the upstream release it is based on. Upstream's own files stay as upstream
released them.

## drgnx fork

Based on `@deepseek-ai/dsh` 0.2.2-rc.1.

- `@deepseek-ai/dsh-acp`: the `_drgnx/panel` extension, version 1. A client that sends `clientCapabilities._meta["_drgnx/panel"].version == 1` gets `agentCapabilities._meta["_drgnx/panel"] = {version: 1, features: ["context", "before-tool"]}`.
  - `context`: a `_drgnx/context` notification after each assistant message (system, tools and conversation tokens from the token meter).
  - `before-tool`: a `_drgnx/before_tool` request before each tool call of a session's agent; an allow continues, a deny, a failed request or an unreadable answer denies the tool.
  - `tool_call` updates and permission requests carry the tool's ACP `kind`; permission requests also carry `title` and `rawInput`.
- `@deepseek-ai/dsh-acp-drgnx-ask` (new): a `tools/pre-execute` listener that asks for the tools of the configured ACP kinds, for use with the unforked `dsh-acp`.
- `@deepseek-ai/dsh-token-meter`: `contextBreakdown(session)`.
