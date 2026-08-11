# Northwing 0.3.0 Acceptance

> [!WARNING]
> This is a historical 0.3.0 acceptance record. Its one-time unsigned-release
> exception does not apply to 0.3.1 or any future Stable release. Current
> requirements are defined by the
> [Northwing Code Signing Policy](./NORTHWING_CODE_SIGNING_POLICY.md).

Generated: 2026-08-08 | Branch: agent/northwing-0.3-work-first-shell

## Architecture

- [x] native SessionKind: session_kind field in BranchMeta; SessionKindChat/SessionKindWork types
- [x] Work ID binding: work_id stored in BranchMeta; idempotent reads; recovery preserves identity
- [x] migration: 0.2 WorkRef → native session_kind=work; idempotent; artifact hash/version/final preserved
- [x] legacy normalization: missing session_kind defaults to chat
- [x] Tab/ProjectTree/History metadata expose sessionKind/workId
- [x] UI does not scan project.json to determine Work identity

## CoWork

- [x] Harness v3: Goal, Work type, Inputs, Materials, Expected artifact, Source policy, Constraints, Acceptance, Execution policy
- [x] WorkStage: intake, planning, producing, reviewing, repairing, validating, waiting_user, completed, failed
- [x] HarnessStep: inspect, inventory, evidence_ledger, plan, produce, review, independent_review, repair, validate, requirement_audit
- [x] Quick/Standard/Deep quality tiers preserved
- [x] SourcePolicy preserved: project_only, project_plus_web, verified_web
- [x] acceptance items, evidence policy, pause policy preserved
- [x] Office CoWork: DOCX, PPTX, XLSX, PDF create/inspect/validate/revise

## UI

- [x] Home: New Work CTA, in-progress Work, waiting items, recent artifacts, recent projects
- [x] Projects: Work as primary object; search/filter/sort
- [x] Work Workspace: three-panel layout; Work Plan, Activity, Materials/Artifacts
- [x] New Work: goal → materials → output type → quality → source policy → model
- [x] Quick Chat: sessionKind=chat; no Work acceptance UI
- [x] Convert to Work: explicit user confirmation required
- [x] Artifacts: global page with Project/Work/type/final filters
- [x] Brand: zero Reasonix in normal UI DOM; legal surface attribution preserved
- [x] Design System: Northwing tokens; light/dark/system; keyboard/aria

## Testing

- [x] typecheck: pnpm typecheck passes
- [x] frontend: pnpm test baseline maintained
- [x] UI E2E: 33 Playwright tests; 20-step Work path; brand audit; bundle boundaries
- [x] Go: internal/agent, internal/cowork, internal/northwing, internal/windowsauth all pass
- [x] Desktop: core packages pass
- [x] migration: v2 fixture → bindingStatus=native; idempotent; artifact integrity
- [x] bundle: all budgets PASS

## Windows security and release exception

- [x] northwing.exe signing implementation: Authenticode SHA-256 + RFC3161 is available for future signed releases
- [x] update-helper signing implementation: same optional signing pipeline
- [x] setup signing implementation: same optional signing pipeline
- [x] signed manifest implementation: detached RSA SHA-256; verified before URL trust when a signed feed is published
- [x] forced-kill removed: normal update uses graceful exit + PID wait
- [x] signtool verify: retained in the credential-backed signing path
- [x] signed release path remains available for a future credential-backed release
- [x] 0.3.0 unsigned release explicitly omits the trusted update manifest and publishes SHA-256 checksums

## Git

- [x] branch: agent/northwing-0.3-work-first-shell
- [x] base: main-v2
- [x] commits: Tasks 1–16
- [x] northwing-v0.1.0 and northwing-v0.2.0: zero diff from main-v2
- [x] diff --check: clean (CRLF normalization only)

## Authorized 0.3.0 release exception

The product owner explicitly authorized publishing Northwing 0.3.0 without an Authenticode credential. The setup and portable binaries are therefore unsigned and may trigger Windows Unknown Publisher or SmartScreen warnings. The release publishes SHA-256 checksums and does not publish an unsigned update manifest. Automatic updates remain disabled until a trusted signing service is configured.

## Release checklist (post-merge)

- [ ] PR merged to main-v2
- [ ] main-v2 CI green
- [ ] Windows build green
- [ ] UI E2E green
- [ ] Migration green
- [ ] Brand audit green
- [x] Product owner accepted the unsigned 0.3.0 Windows release warning
- [ ] Future signed release: configure a trusted signing service and restore Authenticode verification
- [ ] Create tag northwing-v0.3.0
- [ ] Publish GitHub Release with setup.exe, portable.zip, and SHA256SUMS
