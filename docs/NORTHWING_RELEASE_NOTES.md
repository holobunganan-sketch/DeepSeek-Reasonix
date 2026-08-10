# Northwing 0.3.0

Northwing 0.3.0 is a full product rebuild that makes Northwing a Work-first CoWork desktop product. Reasonix is retained as the internal execution kernel and is no longer visible in the product.

## Work-first product shell

- Northwing opens to Home, not an empty chat window.
- The left navigation centers on New Work, Home, Projects, Work, and Artifacts.
- Quick Chat is available as a secondary entry point for questions, exploration, and informal tasks.
- Developer tools (Terminal, Git, code workflows) are accessible through Advanced tools but do not occupy the default navigation.

## Native Work Session identity

- Sessions carry a native `sessionKind` field: `chat` or `work`.
- Each Work session holds a stable `workId` that persists across restarts, rebinding, and session recovery.
- Tab metadata, project tree metadata, and history metadata all expose `sessionKind` and `workId`.
- The UI no longer scans `project.json` to determine whether a session is a Work.

## 0.2 to 0.3 migration

- Existing 0.2 Work references are migrated into native session identity.
- Migration is idempotent; repeated launches produce no additional changes.
- Artifact hashes, versions, final selections, Work IDs, model bindings, and quality/source policies are preserved.
- Sessions that cannot be safely matched are preserved as legacy WorkRef entries with a "needs rebinding" marker.

## Unified Work lifecycle

- `WorkStage` (user-visible): intake, planning, producing, reviewing, repairing, validating, waiting_user, completed, failed.
- `HarnessStep` (internal quality): inspect, inventory, evidence_ledger, plan, produce, review, independent_review, repair, validate, requirement_audit.
- Stage progression is driven by real runtime evidence (Goal, todo, tool events, approvals, turn lifecycle), not timers.

## CoWork Harness v3

- Work Contract is versioned as Northwing Harness v3.
- Contract explicitly separates Goal, Work type, Inputs, Materials, Expected artifact, Source policy, Constraints, Acceptance, Execution policy, and Internal Harness steps.
- Quick, Standard, and Deep quality tiers are preserved.
- Source policies (project_only, project_plus_web, verified_web) are preserved.
- Work metadata does not enter the stable system prompt; the Contract is submitted once as a normal user task at Work start.

## Northwing UI Shell

- Components are organized under `desktop/frontend/src/northwing/` with dedicated Shell, Home, Projects, Work, Artifacts, Navigation, and DesignSystem modules.
- `NorthwingShell` replaces the Reasonix sidebar as the primary product wrapper.
- Reasonix ProjectTree is retained as a compatibility/internal component, not as the main navigation.

## Work Workspace

- Three-panel desktop layout: Work Plan (left), Activity (center), Materials/Artifacts (right).
- Work Plan shows stages, harness steps, acceptance items, and unresolved findings.
- The central Activity panel reuses the validated Transcript, Composer, Approval, Ask, Reasoning, and Tool event components within the Northwing Work Workspace.
- The right panel displays Materials, Artifacts, and Versions with preview, open, reveal, revise, mark-final, and history actions.
- Work Header shows title, project, status, acceptance progress, quality, source policy, and executor model.

## New Work entry

- New Work is the primary CTA, visible from Home, Projects, Work list, and command palette.
- Creation flow: What do you want to finish? → Materials → Output type → Quality → Source policy → Model.
- Advanced options (Audience, Constraints, Acceptance overrides, Pause policy, Reasoning effort) are collapsible.
- From a Project, New Work auto-binds the current Project. From Home, the user selects an existing or new Project.

## Quick Chat and Convert to Work

- Chat sessions carry `sessionKind=chat` and do not display Work acceptance or artifact lifecycle UI.
- Chat provides the full Reasonix kernel capability for questions, exploration, and informal tasks.
- Convert to Work preserves the chat history, creates a formal Work with a Work ID, extracts goals from the existing conversation, and requires explicit user confirmation.

## Artifacts as first-class objects

- Global Artifacts page with filters by Project, Work, file type, final-only, and update time.
- Artifacts are stored under `deliverables/<work-id>/` with SHA-256 deduplication and versioning.
- Office CoWork (DOCX, PPTX, XLSX, PDF) is preserved with create, inspect, validate, and replace/revise capabilities.
- Generated Office files appear immediately in the Artifact panel with file type, version, validation status, update time, and final badge.

## Brand isolation

- Reasonix is removed from all user-visible surfaces: window title, splash, sidebar, menus, settings, dialogs, update UI, and error screens.
- Automated brand surface tests verify that "Reasonix" does not appear in the normal UI DOM.
- Reasonix is acknowledged in About, Licenses, and third-party attribution as the kernel baseline.

## Windows package and graceful updates

- Northwing 0.3.0 is distributed as an unsigned Windows package. Windows may display an Unknown Publisher or SmartScreen warning during download and installation.
- SHA-256 checksums are published so downloads can be checked for integrity before installation.
- The updater no longer uses forced process termination; it launches the helper, exits cleanly, and the helper waits for the Northwing process before replacing files.
- Signed update-manifest verification remains implemented, but the unsigned 0.3.0 release does not publish an update manifest or enable automatic updates. Install later versions manually from GitHub Releases until a trusted signing service is configured.

## UI acceptance testing

- 33 Playwright browser tests cover the full Work-first path: Home → New Work → Work Workspace → Artifact lifecycle → restart → state preservation → Quick Chat → convert to Work.
- Brand surface audit verifies no Reasonix in user-facing DOM.
- Bundle boundary tests confirm that Home does not load Office preview, terminal, Git diff, or large settings modules.
- Viewport is fixed at 1440×900.

## Packages

- `Northwing-0.3.0-windows-x64-setup.exe`
- `Northwing-0.3.0-windows-x64-portable.zip`
- `Northwing-0.3.0-SHA256SUMS.txt`

> Windows signing notice: these 0.3.0 binaries do not carry an Authenticode publisher signature. Verify the SHA-256 checksum and download only from the official Northwing GitHub Release.
