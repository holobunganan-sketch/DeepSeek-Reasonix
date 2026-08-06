# Native Work Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the attached CoWork surface with native Reasonix Work sessions that reuse configured models and add structured, quality-controlled document delivery.

**Architecture:** Keep Reasonix as the sole runtime. Persist compact Work policy in the existing project manifest, compile a short user form into a deterministic task contract, apply model/effort/profile to the native tab before Goal submission, and use Delivery plus document-specific Harness instructions for review and verification.

**Tech Stack:** Go, Wails v2, React, TypeScript, tsx tests, pnpm, GitHub Actions, NSIS.

## Global Constraints

- Do not add a second agent loop, planner, task state machine, memory, permission, checkpoint, or recovery system.
- Do not duplicate Provider credentials or require a CoWork-specific API key.
- Existing `.northwing/project.json` manifests remain readable.
- Existing Reasonix project tree, Composer, Model catalog, Goal, Delivery, Skills, MCP, and recovery behavior remain authoritative.
- Formal outputs remain under `deliverables/<work-id>/`.
- Ordinary Chat sessions do not receive Northwing Office tools unless explicitly enabled by existing rules.

---

### Task 1: Persist native Work policy

**Files:**
- Modify: `internal/cowork/project.go`
- Create: `internal/cowork/work_policy.go`
- Modify: `internal/cowork/project_test.go`

**Interfaces:**
- Produces: optional `WorkRef.Kind`, `Quality`, `SourcePolicy`, `ModelRef`, `ReasoningEffort`, and `HarnessVersion` JSON fields.
- Produces: `NormalizeWorkPolicy(*WorkRef) error` and `ValidateWorkPolicy(WorkRef) error`.

- [ ] Add failing tests for default normalization, valid values, invalid values, and loading a legacy manifest without the new fields.
- [ ] Run `go test ./internal/cowork -run 'Test.*WorkPolicy' -count=1` and confirm the new tests fail.
- [ ] Add the backward-compatible fields and normalization helpers.
- [ ] Call normalization from `LinkWork` and validation from manifest validation.
- [ ] Run `go test ./internal/cowork -count=1` and confirm all tests pass.

### Task 2: Build the WorkSpec compiler

**Files:**
- Create: `desktop/frontend/src/lib/northwingWorkSpec.ts`
- Create: `desktop/frontend/src/__tests__/northwing-work-spec.test.ts`
- Modify: `desktop/frontend/package.json` only if the explicit test list requires registration.

**Interfaces:**
- Produces: `WorkKind`, `WorkQuality`, `SourcePolicy`, `WorkModelBinding`, `WorkSpecDraft`, `NormalizedWorkSpec`.
- Produces: `normalizeWorkSpec(draft)`, `workSpecSummary(spec)`, and `compileWorkBrief(workID, spec)`.

- [ ] Write tests for Work-type defaults, source policy wording, quality stage contracts, automatic deliverables, acceptance criteria, and output-directory confinement.
- [ ] Run the focused tsx test and confirm failure because the compiler does not exist.
- [ ] Implement deterministic normalization and compilation.
- [ ] Run the focused test and confirm it passes.

### Task 3: Apply Reasonix model bindings to Work sessions

**Files:**
- Modify: `desktop/frontend/src/lib/northwingCowork.ts`
- Create: `desktop/frontend/src/__tests__/northwing-native-session.test.ts`

**Interfaces:**
- Consumes: WorkSpec compiler types and `compileWorkBrief`.
- Produces: `launchCoworkWork`, `openCoworkWork`, and `continueCoworkWork` that apply `SetModelForTab`, `SetEffortForTab`, and Delivery before execution.

- [ ] Write a source-contract test that requires lazy project creation, model/effort application before Goal submission, policy persistence before provider execution, and binding replay on resume.
- [ ] Run the focused test and confirm the current adapter fails the assertions.
- [ ] Replace the free-text draft with `WorkSpecDraft`, ensure the project manifest lazily, apply selected model and effort, persist the normalized policy, and submit the compiled Work Brief.
- [ ] Run the focused test and existing delivery-worktree and project-center tests.

### Task 4: Replace the long free-text form with a guided Work dialog

**Files:**
- Modify: `desktop/frontend/src/components/NorthwingWorkDialog.tsx`
- Modify: `desktop/frontend/src/components/NorthwingWorkDialog.css`
- Create: `desktop/frontend/src/__tests__/northwing-work-dialog.test.ts`

**Interfaces:**
- Consumes: `normalizeWorkSpec`, `workSpecSummary`, `app.Models()`, and `launchCoworkWork`.
- Produces: one-goal short form with Work type, quality, source policy, configured-model selector, material paths, and collapsed advanced fields.

- [ ] Write source-contract tests requiring no API-key field, model catalog loading, fixed mode selectors, generated summary, and advanced disclosure.
- [ ] Run the test and confirm the current five-textarea form fails.
- [ ] Implement the guided form and catalog states, including a disabled start state when no goal or no model is available under explicit selection.
- [ ] Run the focused test and frontend typecheck.

### Task 5: Remove the attached CoWork rail and make Work a native project action

**Files:**
- Modify: `desktop/frontend/src/components/ProjectTree.tsx`
- Modify: `desktop/frontend/src/components/NorthwingProjectCenter.tsx`
- Modify: `desktop/frontend/src/components/NorthwingProjectCenter.css`
- Delete or stop importing: `desktop/frontend/src/components/NorthwingOpenCodeSetup.tsx`
- Stop importing: `desktop/frontend/src/components/NorthwingCoworkRail.tsx`
- Modify: `desktop/frontend/src/__tests__/northwing-project-center.test.ts`
- Modify: `desktop/frontend/src/__tests__/northwing-branding.test.ts`

**Interfaces:**
- Produces: a compact Work launcher rendered directly beside the existing Reasonix project tree.
- Preserves: `ReasonixProjectTree` as the complete navigation implementation.

- [ ] Update tests to require direct ProjectCenter integration, no Chat/Work rail, no OpenCode setup card, no “Enable CoWork” action, and lazy project creation through Work start.
- [ ] Run the tests and confirm the old rail assertions fail.
- [ ] Simplify the ProjectCenter to `New Work`, `Work and artifacts`, current counts, and latest Work status using existing sidebar styling.
- [ ] Update the wrapper to render ProjectCenter directly above `ReasonixProjectTree`.
- [ ] Run focused UI source tests and typecheck.

### Task 6: Expose persisted policy in Work and Artifact management

**Files:**
- Modify: `desktop/frontend/src/components/NorthwingArtifactCenter.tsx`
- Modify: `desktop/frontend/src/components/NorthwingArtifactCenter.css`
- Modify: `desktop/frontend/src/lib/northwingCowork.ts`

**Interfaces:**
- Consumes: persisted `CoworkWorkRef` policy fields.
- Produces: visible Work type, quality, model binding, source policy, and output directory in the Work list.

- [ ] Add focused source assertions for policy badges and inherited-model copy.
- [ ] Run the test and confirm failure.
- [ ] Render compact policy metadata without changing existing preview/open/reveal/final/revise behavior.
- [ ] Run project-center and artifact tests.

### Task 7: Document Harness behavior and migrate product guidance

**Files:**
- Modify: `docs/NORTHWING_ARCHITECTURE.md`
- Modify: `docs/NORTHWING_USER_GUIDE.md`
- Modify: `docs/NORTHWING_RELEASE_NOTES.md`
- Modify: `docs/NORTHWING_TOOL_CONTRACT.md`
- Modify: `docs/NORTHWING_TOOL_CONTRACT.zh-CN.md`

**Interfaces:**
- Documents: native Work session ownership, configured-model reuse, WorkSpec fields, Quick/Standard/Deep policies, source policies, restoration behavior, and removal of the OpenCode-specific prerequisite.

- [ ] Update documentation with exact UI and storage behavior.
- [ ] Run documentation/source contract tests.

### Task 8: Full verification and PR

**Files:**
- Modify tests or implementation only in response to observed failures.

- [ ] Run `go test ./internal/cowork ./internal/office ./internal/tool/builtin -count=1`.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, and `pnpm build` in `desktop/frontend`.
- [ ] Run `git diff --check` equivalent through generated file review and GitHub CI.
- [ ] Push all files to `agent/northwing-native-work-session`.
- [ ] Open a PR to `main-v2` with implementation scope, compatibility notes, test evidence, and known limitations.
- [ ] Inspect every GitHub Actions job; fix failures on the branch until required checks pass.
