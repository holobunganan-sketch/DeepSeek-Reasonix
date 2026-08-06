# Northwing Native Work Architecture

Northwing is a local-first knowledge-work distribution built on the complete Reasonix engine. A Work is a native Reasonix project session with a structured task contract, a persisted model binding, a Delivery quality policy, and a versioned artifact boundary.

## Product model

The desktop exposes two session intents through the same Reasonix workspace:

1. **Chat** — ordinary Reasonix conversations and direct tool work.
2. **Work** — a Reasonix session configured for Goal and Delivery, linked to a formal output directory and compact Work policy.

There is no separate CoWork runtime, Provider store, Agent Loop, planner, task state machine, memory, permission system, checkpoint system, or recovery system.

## Ownership boundary

Reasonix remains authoritative for:

- projects, tabs, topics, sessions, and transcripts;
- configured Providers, credentials, model catalog, model switching, and reasoning effort;
- Goal, Planner, Executor, subagents, Skills, MCP, Hooks, and tools;
- runtime profiles and Delivery enforcement;
- permissions, approvals, sandboxing, checkpoints, rewind, and recovery;
- CLI, ACP, Remote Workbench, bots, terminal, Git, and developer workflows.

Northwing stores only:

- Project/Work links;
- compact Work type, quality, source policy, model reference, effort, and Harness version;
- artifact hashes, versions, and final selection.

No transcript, provider secret, model configuration, tool output, or shadow progress state is copied into the Northwing manifest.

## Storage

Each workspace receives metadata only after its first Work is created:

```text
<workspace>/.northwing/project.json
<workspace>/.northwing/final-artifacts.json
```

Each Work has one deterministic formal-output directory:

```text
<workspace>/deliverables/<work-id>/
```

The project manifest remains movable because every artifact path is workspace-relative. Registered versions use SHA-256 content hashes. Re-scanning unchanged content does not create another version.

## Work reference

A Work reference links to an ordinary Reasonix session and contains compact restoration policy:

```text
id
sessionPath
goalId/topic anchor
profile=delivery
kind=general|research|report|presentation|analysis|review|batch
quality=quick|standard|deep
sourcePolicy=project_only|project_plus_web|verified_web
modelRef=configured Reasonix model reference
reasoningEffort=optional provider-supported effort
harnessVersion=2
```

Legacy Work references without these fields load as:

```text
kind=general
quality=standard
sourcePolicy=project_only
modelRef=current/default Reasonix model
reasoningEffort=current/default model effort
harnessVersion=2
```

## Native Work startup

Creating a Work performs one ordered product transaction:

1. establish the local Reasonix workspace target;
2. lazily create `.northwing/project.json` when absent;
3. create a native Reasonix project tab;
4. apply the selected Reasonix model and optional effort;
5. switch the tab to Delivery;
6. persist the Work/session link and policy;
7. submit the compiled task contract through Reasonix Goal;
8. activate the tab.

The Work link is durable before the first Provider request. A successful first request refreshes the saved session path. Opening or continuing the Work restores the same topic/session, reapplies the saved model and effort, and resumes the existing Goal when available.

If a saved model is no longer configured, Work restoration reports that binding explicitly so the user can configure or replace the model. Northwing never requests a Provider key in the Work surface.

## Guided Work specification

The short form contains:

- one free-text goal;
- optional project-relative material paths;
- Work type;
- quality level;
- source policy;
- executor model selected from `app.Models()`.

Advanced fields contain:

- title;
- audience;
- deliverable override;
- constraints;
- extra completion criteria;
- pause policy;
- reasoning effort.

The compiler turns these inputs into a deterministic Reasonix task contract with Context, Request, Materials, Output format, Source policy, Constraints, Acceptance criteria, Pause policy, and Harness execution contract sections.

## Work types

- **General** — directly usable output in the requested format.
- **Research** — evidence inventory, claim-source traceability, uncertainty disclosure, and concise conclusions.
- **Report** — editable DOCX defaults, coherent sections, and checked facts, figures, citations, tables, and headings.
- **Presentation** — editable PPTX defaults, slide-level narrative, legibility, and file validation.
- **Analysis** — editable XLSX defaults, reproducible calculations, checked formulas and totals, and interpretation.
- **Review** — preservation of valid content, scoped revisions, issue resolution, and revalidation.
- **Batch** — deterministic processing for every input item plus a success/failure manifest.

## Quality policies

### Quick

```text
inspect → produce → validate
```

Quick keeps scope bounded and performs the minimum deterministic verification needed for a usable result.

### Standard

```text
inventory → plan → produce → review → repair → validate
```

Standard requires an acceptance list, a structured self-review, a targeted repair pass, and validation after the latest mutation.

### Deep

```text
inventory → evidence ledger → plan → produce → review
→ independent review → repair → validate → requirement audit
```

Deep requests an isolated reviewer, review Skill, or read-only subagent when available. Completion requires a requirement-by-requirement evidence audit and resolution of every high-priority finding.

## Harness relationship to Delivery

The Harness extends the existing Reasonix Delivery contract. It does not implement another controller.

Every Work instructs the runtime to:

- create a concrete `todo_write` acceptance list before formal output work;
- save formal files under the Work output directory;
- keep intermediate material outside that directory;
- follow the selected evidence policy;
- review and repair the result at the selected quality depth;
- validate after the latest change;
- use `complete_step` only after all acceptance items have evidence.

Delivery continues to enforce its native acceptance, mutation, review, verification, permission, lease, and completion gates.

## Model adaptation

Northwing uses the same Harness with every configured Reasonix model. Low-cost models receive stronger explicit decomposition, evidence-first drafting, smaller stages, deterministic checks, and targeted repair instructions. Stronger models can complete the same contract with fewer internal iterations.

Planner, subagent, and reviewer models continue to follow the user's Reasonix configuration. Northwing persists the executor binding and optional effort for reliable restoration.

## Artifact lifecycle

After a Reasonix turn completes, Northwing scans the Work output directories locally. The scanner:

- skips hidden and temporary files;
- resolves symlinks and rejects workspace escape;
- hashes files without injecting their bodies into model context;
- appends a version only when content changes;
- writes manifests atomically.

The Artifact surface supports:

- Work continuation;
- visible Work type, quality, evidence policy, model binding, and effort;
- text, image, PDF, and Office structure preview;
- open and reveal actions;
- version history and final selection;
- scoped revision in the original Reasonix session.

## Desktop integration

The detached Chat/Work rail and OpenCode Go setup card have been removed. The project sidebar now contains a compact native Work launcher directly beside the complete Reasonix project tree.

The Work launcher does not own navigation or project lifecycle. It opens the guided Work dialog and the existing Work/Artifact manager. Ordinary Reasonix Composer controls remain available in the resulting session, including model, effort, Goal, Delivery, permissions, and tool access.

## Cache and token rules

- Project manifests do not enter the stable system prompt.
- The compiled Work contract enters once as a normal user turn.
- File contents are read on demand through existing tools.
- Artifact synchronization makes no model call.
- Stable Reasonix tool schemas and capability brokers remain authoritative.
- Model switching uses the existing per-session cache boundary.
- Planner and subagents receive only the context required by their Reasonix task.

## Compatibility

Existing Reasonix workspaces remain valid. Existing Northwing manifests remain readable. Existing Works inherit Standard quality and the current/default Reasonix model. Artifact paths, versions, final selections, and Office tooling keep their existing format.
