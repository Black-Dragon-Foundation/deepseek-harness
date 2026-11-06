---
description: "A tools/pre-execute listener that turns the tools of chosen ACP kinds into permission requests for an ACP client."
kind: "package-reference"
---

# @deepseek-ai/dsh-acp-drgnx-ask

## Summary

`dsh-acp-drgnx-ask` makes `dsh-acp` ask its client before a tool of a chosen ACP kind runs. It lists the kinds in `kinds`; for a call of such a tool it returns `{kind: 'ask'}`, and the approval service sends `session/request_permission` (with `kind`, `title` and `rawInput`) to the client. It works with the unforked `dsh-acp`, and it also exports `toolKind(name)`, the kind of each harness tool.

## Use this package

Mount it beside the ACP server, keeping the approval policy at `ask` (the base bundle ties `never` to the full-access sandbox mode, and `never` rejects every ask). A host passes this overlay as `dsh --profile acp --patch overlay.yml`:

```yaml
- id: sandbox-policy
  config:
    mode: danger-full-access
- id: approval
  config:
    policy: ask
- insert:
    - id: drgnx-ask
      name: '@deepseek-ai/dsh-acp-drgnx-ask'
      config:
        kinds: [execute, edit]
```

| Field | Default | Meaning |
|---|---|---|
| `kinds` | `[]` | ACP kinds (`read`, `edit`, `delete`, `move`, `search`, `execute`, `think`, `fetch`, `switch_mode`, `other`) whose tools are asked about |

A tool with no kind of its own, such as an MCP tool, has the kind `other`.

## Understand the implementation

The listener calls `next()` first and changes only an `allow` into an `ask`, so it never turns another listener's denial or cancellation into a question and never allows anything. Without an approval service the pipeline denies an ask.

## Model Experience

None. The plugin adds nothing to a model request; a denied tool returns the usual tool error.

## Known Limitations and Deferred Work

- Tools of subagents run in their own agents; the listener asks for them only where the pipeline reaches this plugin's scope (global).
- The kind table is written by hand; `tests/kinds.spec.ts` fails when a tool in `docs/tool-catalog.md` has no kind.

## Dev Note

None.
