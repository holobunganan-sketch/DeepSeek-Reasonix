# Northwing CoWork Architecture

Northwing is a CoWork-focused distribution and product layer built on the full
Reasonix engine. The engine remains intact. Northwing adds a small amount of
software that helps knowledge workers organize projects, delegate multi-step
work, and receive versioned artifacts.

## Product contract

Northwing turns a user goal and selected source material into a finished,
reviewable file while preserving Reasonix's existing development, terminal,
remote, and advanced-agent capabilities.

The primary desktop concepts are deliberately limited to:

1. **Project** — links one workspace to its sessions, Goals, and artifacts.
2. **Work** — links a user-facing work item to the authoritative Reasonix session
   and Goal. Reasonix continues to own execution and progress.
3. **Artifact** — records a versioned file produced inside the workspace.

## Architecture boundary

Northwing must not create replacements for these Reasonix systems:

- agent loop and controller
- Planner, Executor, and subagents
- Goal, Todo, Plan, and runtime profiles
- provider and model routing
- Skills, MCP, Hooks, and tools
- permission, approval, and sandbox policy
- session, memory, context, checkpoint, rewind, and recovery
- CLI, ACP, remote workbench, bot, and developer workflows

The CoWork layer links these resources through stable identifiers and paths. It
stores no transcript copies, model context copies, tool output copies, or shadow
progress state.

## Storage

Each project has one lightweight manifest:

```text
<workspace>/.northwing/project.json
```

The manifest contains project metadata, Reasonix work references, and artifact
records. Source files and generated files stay in their original workspace
locations. Artifact paths are workspace-relative and each registered version is
identified by SHA-256.

This layout keeps projects movable, avoids duplicate file trees, and prevents
project organization from increasing provider context.

## Desktop integration

The desktop shell exposes a narrow binding surface:

- `CreateCoworkProject`
- `LoadCoworkProject`
- `LinkCoworkWork`
- `RegisterCoworkArtifact`

The next UI slice will build Project Center and Artifact views on these methods.
Existing Reasonix tabs and controllers remain the execution surface underneath.

## Token and cache rules

Northwing follows the existing Reasonix cache-first design:

- Project manifests never enter the stable system prompt wholesale.
- Work briefs contain only the goal, selected source references, output request,
  constraints, and acceptance criteria.
- File contents are read on demand through existing tools.
- Dynamic Office, research, browser, and connector capabilities are exposed
  through stable capability brokers instead of permanently expanding tool
  schemas.
- Planner and subagents receive the minimum context required for their task.
- Artifact revisions operate on the smallest addressable document region when a
  format supports it.

Token reduction is an architectural outcome. Required evidence, source reading,
validation, and instruction-following remain mandatory.

## Planned vertical slices

1. **CoWork foundation** — project manifest, work links, artifact registry.
2. **Project Center** — create/open/recent projects and restore linked sessions.
3. **Work entry** — a compact brief that maps to Goal and Delivery profiles.
4. **Artifact surface** — preview, versions, open/export, and local edits.
5. **Capability packs** — Office first, then research and browser/desktop tools.
6. **Northwing identity** — isolated app name, data paths, protocol, updater, and
   Windows packages after the functional seams are stable.

Each slice must preserve the complete Reasonix feature set and remain small
enough to review, test, and rebase onto upstream changes.
