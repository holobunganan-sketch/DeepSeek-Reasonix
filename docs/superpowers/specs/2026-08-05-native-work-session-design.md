# Northwing Native Work Session Design

## Goal

Integrate CoWork into Reasonix as a native Work session type. A Work reuses the existing Reasonix project, tab, session, model catalog, Goal runtime, Delivery profile, permissions, tools, checkpoints, recovery, and provider configuration. Northwing contributes a structured Work specification, persisted executor-model and quality policy, artifact lifecycle, and document-focused Harness.

## Product contract

A workspace can create Chat sessions and Work sessions without a separate “Enable CoWork” step. Creating the first Work lazily creates `.northwing/project.json`. Work sessions continue through the existing Reasonix session path and topic anchor.

The main Work entry contains:

- one free-text goal;
- optional source-material paths;
- a Work type;
- a quality level;
- a source policy;
- an executor model selected from the Reasonix model catalog.

Advanced fields contain title, audience, deliverables, constraints, completion criteria, pause policy, and reasoning effort. Planner, subagent, and review-model behavior continues to inherit the user's existing Reasonix configuration so a Work never rewrites global model settings.

## Architecture

### Existing Reasonix ownership

Reasonix remains authoritative for:

- provider credentials and model catalog;
- tabs, topics, sessions, and transcript persistence;
- model switching and reasoning effort;
- Planner, subagent, and profile-level model settings;
- Goal, Planner, Executor, subagents, Skills, MCP, and tools;
- Delivery runtime enforcement;
- permissions, approvals, sandboxing, checkpoints, rewind, and recovery.

### Northwing ownership

Northwing owns:

- `WorkSpec`: the user goal, audience, materials, deliverables, constraints, completion criteria, source policy, and pause policy;
- `ModelBinding`: the executor model and optional reasoning effort applied to the Work tab;
- `WorkPolicy`: Work type, quality level, Harness version, stage requirements, review requirements, and verification requirements;
- `ArtifactRegistry`: versioned files and final selection.

The persisted `WorkRef` stores compact policy fields required to restore execution behavior. The full provider configuration and credentials remain in Reasonix.

## Data model

`WorkRef` gains optional backward-compatible fields:

```text
kind             general|research|report|presentation|analysis|review|batch
quality          quick|standard|deep
sourcePolicy     project_only|project_plus_web|verified_web
modelRef         configured Reasonix model reference
reasoningEffort  provider-supported effort level
harnessVersion   integer
```

Missing fields on existing manifests resolve to:

```text
kind=general
quality=standard
sourcePolicy=project_only
modelRef="" (inherit current/default Reasonix model)
reasoningEffort="" (inherit current/default effort)
harnessVersion=2
```

## Model selection

The Work dialog reads `app.Models()` and presents every configured Reasonix model. It never requests or stores API keys. The catalog's current model is selected initially; the user can choose any other configured model. A selected model is applied to the new tab with `SetModelForTab` before the initial Goal request. Opening or continuing the Work reapplies the persisted executor model and effort.

OpenCode Go remains an optional Reasonix provider preset in Settings. The Work surface contains no OpenCode-specific setup card.

## WorkSpec compiler

The compiler converts the short form into one deterministic task contract:

1. context and audience;
2. request;
3. material references;
4. output format;
5. source policy;
6. constraints;
7. acceptance criteria;
8. pause policy;
9. Harness execution contract.

Work-type defaults:

- `general`: directly usable output in the requested format;
- `research`: evidence inventory, claim-source traceability, uncertainty disclosure;
- `report`: editable DOCX by default, coherent section structure, facts and citations checked;
- `presentation`: editable PPTX by default, slide-level narrative, legibility and file validation;
- `analysis`: editable XLSX plus an interpretation summary, formulas and totals checked;
- `review`: preserve valid content, identify issues, apply scoped revisions, revalidate;
- `batch`: deterministic handling of every input item, manifest of successes and failures.

Quality policies:

- `quick`: inspect, produce, validate;
- `standard`: inventory, plan, produce, review, repair, validate;
- `deep`: evidence ledger, full plan, staged production, independent review when available, targeted repair, requirement-by-requirement audit, deterministic file validation.

## Harness behavior

The Harness extends the existing Delivery contract. It does not create another agent loop.

Every Work requires:

- a concrete acceptance list before formal output work;
- formal files under `deliverables/<work-id>/`;
- source-policy compliance;
- validation after the latest change;
- no completion claim while acceptance items remain unresolved.

Standard and Deep require a structured self-review. Deep requests an isolated reviewer or review Skill when available and requires a targeted repair pass for unresolved findings. Office deliverables use `northwing_office` inspection and independent package parsers already present in CI.

Low-cost models receive stronger decomposition through explicit stages, smaller bounded actions, evidence-first drafting, deterministic checks, and targeted repair instructions. The policy is model-agnostic and works with any configured provider.

## User interface

The separate Chat/Work rail and OpenCode Go card are removed. The project sidebar contains a compact native Work launcher above the existing Reasonix tree:

- New Work;
- Work and artifacts;
- latest Work status when available.

The control uses the existing sidebar visual language and does not repeat the Northwing product brand. The Work dialog contains a short default form and a collapsed advanced section.

Artifact management remains scoped to the workspace and linked Reasonix session. Existing previews, open/reveal, final selection, continuation, and revision actions remain available.

## Startup sequence

`launchCoworkWork` performs this ordered transaction:

1. ensure a local workspace target;
2. lazily create the Northwing project manifest when missing;
3. create a native project tab;
4. apply selected executor model and effort;
5. apply Delivery runtime profile;
6. persist the Work link and policy before provider execution;
7. submit the Goal and compiled WorkSpec through the existing atomic Goal method;
8. activate the tab.

Failures before provider submission remain visible as a prepared Work that can be resumed. No credential or provider state is duplicated.

## Compatibility

Existing project manifests and Works remain readable. Existing Works inherit current/default Reasonix model behavior and Standard quality. Existing artifact paths and versions do not change. Reasonix-only workspaces remain valid and receive `.northwing` metadata only after the user creates a Work.

## Verification

Required tests cover:

- Work field normalization and backward-compatible manifest loading;
- model and effort application before initial Goal submission;
- Work restoration reapplying the binding;
- short-form compiler defaults for each Work type;
- Quick, Standard, and Deep stage contracts;
- absence of OpenCode API-key UI in the Work surface;
- lazy project creation;
- project-tree wrapper retaining the complete Reasonix tree;
- full frontend typecheck/tests/build;
- Go tests and Windows packaging in GitHub Actions.
