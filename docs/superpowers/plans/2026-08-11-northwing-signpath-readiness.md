# Northwing SignPath Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Northwing's privacy behavior and public repository materials complete, truthful, and internally consistent for a SignPath Foundation application.

**Architecture:** Remove user-controlled provider/model identifiers from aggregate metric buckets at their collection boundary. Keep legal/product disclosures in focused public Markdown documents and link them from both README languages. Verify every repository-local link, the English/Chinese entry-point parity, Markdown hygiene, and the executable telemetry/release-signing contracts without encoding legal prose as brittle source-string tests.

**Tech Stack:** Markdown, Go standard-library tests, GitHub Actions repository metadata.

## Global Constraints

- Do not claim an existing artifact is signed when it is unsigned.
- Do not claim SignPath approval before approval exists.
- Keep inherited Reasonix SignPath authorization separate from Northwing.
- Publish no personal email address; use GitHub Issues for public privacy contact.
- Describe only data flows verified in the repository.

---

### Task 1: Remove custom identifiers from aggregate metrics

**Files:**
- Modify: `desktop/metrics_app_test.go`
- Modify: `desktop/metrics_app.go`

**Interfaces:**
- Consumes: configured provider/model selections
- Produces: only fixed `configured`/`unresolved` model/provider states and
  allowlisted finish-reason buckets

- [x] **Step 1: Change the settings-metrics regression fixture to contain distinctive private identifier fragments and expect only fixed buckets.**
- [x] **Step 2: Confirm the pre-fix implementation leaks those fragments.**
- [x] **Step 3: Replace raw provider/model-derived buckets with fixed configuration-state buckets and provider-controlled finish reasons with an allowlist plus `other` fallback.**
- [ ] **Step 4: Run the focused Go regression in CI because the local workspace has no Go runtime.**

### Task 2: Publish privacy, signing, and derivation disclosures

**Files:**
- Create: `docs/NORTHWING_PRIVACY_POLICY.md`
- Create: `docs/NORTHWING_CODE_SIGNING_POLICY.md`
- Modify: `docs/REASONIX_BASELINE.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `.github/CODEOWNERS`
- Modify: `docs/SIGNPATH_WINDOWS_ADMIN_SOP.md`
- Modify: `SECURITY.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/NORTHWING_USER_GUIDE.md`
- Modify: `docs/NORTHWING_0_3_ACCEPTANCE.md`

**Interfaces:**
- Consumes: verified telemetry, provider, update, storage, and upstream source behavior
- Produces: stable public URLs for the SignPath application

- [x] **Step 1: Document local storage, provider/tool data flows, telemetry/metrics/crash reporting, updates, retention/deletion, security, children, changes, and contact.**
- [x] **Step 2: Document Northwing signing scope, trusted build path, roles, approval state, release gates, incident response, and the inherited Reasonix SignPath boundary.**
- [x] **Step 3: Add the exact upstream URL and frozen baseline commit to both derivation documents.**
- [x] **Step 4: Align fork CODEOWNERS and mark the inherited upstream SignPath SOP as non-authoritative for Northwing.**
- [x] **Step 5: Replace stale upstream support/contribution identity, clarify user-guide signing status, and prevent the historical 0.3.0 unsigned exception from being treated as current policy.**

### Task 3: Expose the disclosures at project and download entry points

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Interfaces:**
- Consumes: the policy documents from Task 2
- Produces: discoverable application/download-page statements in English and Chinese

- [x] **Step 1: Link Privacy, Code signing, Third-party notices, and upstream Reasonix from both READMEs.**
- [x] **Step 2: Include the exact SignPath Foundation phrase with a truthful application-pending qualifier.**
- [x] **Step 3: State that currently published Windows artifacts are unsigned and release pages are authoritative for signing status.**
- [x] **Step 4: Verify every new repository-local link resolves to a tracked file.**

### Task 4: Verify and publish the branch

**Files:**
- Verify all modified files

**Interfaces:**
- Consumes: completed repository changes
- Produces: a reviewable GitHub branch and pull request

- [x] **Step 1: Run a repository-local Markdown link target check for both READMEs and the new policies.**
- [ ] **Step 2: Run `cd desktop && go test ./...`, `go test ./...`, and `git diff --check` to preserve the existing executable signing/release contracts.**
- [x] **Step 3: Review `git diff` for unsupported claims, placeholders, personal data, and signing-status ambiguity.**
- [x] **Step 4: Commit only the intentional policy/readme/test files.**
- [ ] **Step 5: Push `docs/northwing-signpath-readiness` and open a PR to `main-v2`.**
