# Northwing 0.3.0 Acceptance

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

## Windows security

- [x] northwing.exe signature path: Authenticode SHA-256 + RFC3161 in release workflow
- [x] update-helper signature path: same signing pipeline
- [x] setup signature path: same signing pipeline
- [x] manifest signature: detached RSA SHA-256; verified before URL trust
- [x] forced-kill removed: normal update uses graceful exit + PID wait
- [x] signtool verify: required in release workflow; CREDENTIAL gate
- [x] release gate: blocks publication without NORTHWING_WINDOWS_RELEASE_CREDENTIAL

## Git

- [x] branch: agent/northwing-0.3-work-first-shell
- [x] base: main-v2
- [x] commits: Tasks 1–16
- [x] northwing-v0.1.0 and northwing-v0.2.0: zero diff from main-v2
- [x] diff --check: clean (CRLF normalization only)

## Known external requirement

NORTHWING_WINDOWS_RELEASE_CREDENTIAL (PFX base64 + password)
Must be configured in GitHub Environment before creating northwing-v0.3.0 tag.

Without this credential, CI produces unsigned test artifacts; formal release is blocked.

## Release checklist (post-merge)

- [ ] PR merged to main-v2
- [ ] main-v2 CI green
- [ ] Windows build green
- [ ] UI E2E green
- [ ] Migration green
- [ ] Brand audit green
- [ ] NORTHWING_WINDOWS_RELEASE_CREDENTIAL configured
- [ ] signtool verify /pa /all passes on northwing.exe, update-helper.exe, setup.exe
- [ ] manifest .sig verification passes
- [ ] Create tag northwing-v0.3.0
- [ ] Publish GitHub Release with setup.exe, portable.zip, SHA256SUMS, update.json, update.json.sig