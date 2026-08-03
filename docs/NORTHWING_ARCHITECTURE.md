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

Each project has one lightweight manifest and one optional final-selection
sidecar:

```text
<workspace>/.northwing/project.json
<workspace>/.northwing/final-artifacts.json
```

Each Work has a deterministic formal-output boundary:

```text
<workspace>/deliverables/<work-id>/
```

The project manifest contains project metadata, Reasonix work references, and
artifact records. Source files and generated files stay in their original
workspace locations. Artifact paths are workspace-relative and each registered
version is identified by SHA-256. Re-scanning an unchanged file does not create
a duplicate version.

This layout keeps projects movable, avoids duplicate file trees, and prevents
project organization from increasing provider context.

## Work lifecycle

The desktop Work entry collects only:

- goal
- material references
- requested deliverable
- constraints
- completion criteria

Northwing compiles these fields into one compact Work Brief. The brief is the
first normal user input in an existing Reasonix project session; it is not added
to the stable system prompt. The transcript displays the compact Work title, the
Reasonix Goal stores the concise objective, and the full Work Brief remains the
actual model input and durable session context.

Before the provider request starts, Northwing:

1. creates a durable Work ID;
2. opens a normal Reasonix project topic and session;
3. switches that session to the existing Delivery runtime profile;
4. links the Work to the Reasonix topic and session in `project.json`;
5. submits the first Goal through Reasonix's atomic target-aware Goal method.

Tool approval uses Reasonix Auto rather than YOLO. Permission rules, fresh
approvals, sandbox boundaries, checkpoints, Planner/Executor routing, reviews,
and Delivery completion gates remain active.

Opening a saved Work restores its Reasonix topic and exact session. An active
Goal resumes directly. A completed or stopped Goal receives one explicit
continuation turn in the same session.

## Artifact lifecycle

After a Reasonix turn completes, Northwing performs a debounced local scan of
`deliverables/<work-id>/`. The scanner:

- skips hidden and temporary files;
- remains confined to the project workspace after symlink resolution;
- hashes candidate files without loading their bodies into the desktop UI or
  model context;
- appends one Artifact version only when a file's hash changed;
- publishes all changes through one atomic project-manifest write.

The Artifact surface provides:

- Work continuation;
- artifact version history;
- text, image, and PDF preview through the owning project tab;
- open and reveal actions scoped to the owning project;
- final-version selection through a small sidecar index;
- scoped revision requests that return to the linked Reasonix session and run
  through Goal plus Delivery.

Office formats that do not have a safe embedded preview continue to open in the
registered desktop application. Format-aware Office generation and validation
remain a separate capability-pack slice.

## Desktop integration

The desktop shell exposes a narrow binding surface:

- `CreateCoworkProject`
- `LoadCoworkProject`
- `CoworkProjectState`
- `CoworkProjectSummaries`
- `UpsertCoworkWork`
- `LinkCoworkWork`
- `SyncCoworkArtifacts`
- `SetCoworkArtifactFinal`
- `RegisterCoworkArtifact`

The React layer augments the generated Wails contract with optional Northwing
methods, preserving the existing browser-development mock. The complete
Reasonix project tree remains the base component; Northwing adds one thin Project
Center wrapper above it.

## Token and cache rules

Northwing follows the existing Reasonix cache-first design:

- Project manifests never enter the stable system prompt wholesale.
- Work briefs contain only the goal, selected source references, output request,
  constraints, and acceptance criteria.
- Work briefs enter once as normal user-turn content and then remain in the
  existing Reasonix session history.
- File contents are read on demand through existing tools.
- Artifact synchronization uses filesystem hashes and metadata, with no model
  call and no context injection.
- Dynamic Office, research, browser, and connector capabilities are exposed
  through stable capability brokers instead of permanently expanding tool
  schemas.
- Planner and subagents receive the minimum context required for their task.
- Artifact revisions operate on the smallest addressable document region when a
  format supports it.

Token reduction is an architectural outcome. Required evidence, source reading,
validation, and instruction-following remain mandatory.

## Vertical slices

Completed in the current foundation PR:

1. **CoWork foundation** — project manifest, work links, artifact registry.
2. **Project Center** — enable projects and restore their linked resources.
3. **Work entry** — compact brief mapped directly to Goal and Delivery.
4. **Work restoration** — durable topic/session links and Goal continuation.
5. **Artifact surface** — discovery, versions, previews, open/reveal, final
   selection, and scoped revision.

Remaining major slices:

6. **Capability packs** — Office first, then research and browser/desktop tools.
7. **Northwing identity** — isolated app name, data paths, protocol, updater, and
   Windows packages after the functional seams are stable.
8. **Full validation and release** — execute the complete test matrix, repair
   failures, build installers, and perform clean-machine acceptance.

Each slice must preserve the complete Reasonix feature set and remain small
enough to review, test, and rebase onto upstream changes.
