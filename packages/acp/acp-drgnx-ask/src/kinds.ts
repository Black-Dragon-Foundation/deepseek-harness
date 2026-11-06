/** Standard ACP tool kinds for the harness's tool names. */

/** The ACP tool kinds a client can subscribe to. */
export type ToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other'

const KINDS_BY_TOOL: Readonly<Record<string, ToolKind>> = {
  read: 'read',
  read_image: 'read',
  read_mcp_resource: 'read',
  list_mcp_resources: 'read',
  list_mcp_resource_templates: 'read',
  get_goal: 'read',
  session_event_read: 'read',
  terminal_read: 'read',
  terminal_list: 'read',
  job_list: 'read',
  job_output: 'read',
  list_agents: 'read',
  list_subagent_models: 'read',
  team_task_get: 'read',
  team_task_list: 'read',
  schedule_list: 'read',
  schedule_view: 'read',
  stagehand_observe: 'read',
  stagehand_extract: 'read',
  stagehand_screenshot: 'read',
  edit: 'edit',
  write: 'edit',
  apply_patch: 'edit',
  str_replace_editor: 'edit',
  create_worktree: 'edit',
  working_directory: 'edit',
  glob: 'search',
  grep: 'search',
  lsp: 'search',
  session_search: 'search',
  session_trace: 'search',
  session_event_search: 'search',
  session_event_trace: 'search',
  cordis_inspect_list: 'search',
  cordis_inspect_query: 'search',
  web_search: 'search',
  web_fetch: 'fetch',
  plugin_market: 'fetch',
  stagehand_navigate: 'fetch',
  bash: 'execute',
  pwsh: 'execute',
  run_code: 'execute',
  terminal_open: 'execute',
  terminal_close: 'execute',
  terminal_send: 'execute',
  terminal_signal: 'execute',
  job_kill: 'execute',
  workflow: 'execute',
  ralph: 'execute',
  subagent: 'execute',
  subagent_oar: 'execute',
  spawn_teammate: 'execute',
  stagehand_act: 'execute',
  stagehand_tabs: 'execute',
  plugin_manager: 'execute',
  load_workspace_dependencies: 'execute',
  skill: 'think',
  todo_write: 'think',
  create_goal: 'think',
  update_goal: 'think',
  schedule_create: 'think',
  schedule_edit: 'think',
  team_task_create: 'think',
  team_task_update: 'think',
  propose_action: 'think',
  ask_user_question: 'think',
  present: 'think',
  send_message: 'think',
  interrupt_agent: 'think',
  wait_agent: 'think',
  exit_plan_mode: 'switch_mode',
}

/** A map, so inherited object keys such as `constructor` are never read as tool names. */
const KIND_BY_NAME = new Map(Object.entries(KINDS_BY_TOOL))

/**
 * The ACP kind of a tool.
 * @param name - the harness tool name.
 * @returns the kind, or `other` for a tool that has none (MCP tools among them).
 */
export function toolKind(name: string): ToolKind {
  return KIND_BY_NAME.get(name) ?? 'other'
}
