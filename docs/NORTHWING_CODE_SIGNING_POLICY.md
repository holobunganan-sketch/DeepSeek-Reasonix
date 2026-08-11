# Northwing Code Signing Policy

Effective date: August 11, 2026

This policy covers official Windows artifacts published from
<https://github.com/holobunganan-sketch/DeepSeek-Reasonix>.

## Application status

Northwing is applying to the SignPath Foundation open-source program. The
application is pending. This repository does not claim that an existing
Northwing artifact has a SignPath Foundation signature.

> Free code signing provided by SignPath.io, certificate by SignPath Foundation.

The sentence above identifies the requested service and certificate authority.
It becomes a statement about an artifact only when that artifact passes
Authenticode verification and its GitHub Release identifies it as signed.

All Northwing Windows packages currently published on GitHub are unsigned.
Historical release pages and checksums remain the authority for their actual
status. Unsigned packages must never be relabeled as signed.

## Signing scope

A formal Northwing Stable Windows release must sign and verify all of these
files:

- `northwing.exe`;
- `northwing-update-helper.exe`;
- `Northwing-<version>-windows-x64-setup.exe`.

Portable ZIP files and checksum files are not Authenticode containers. Their
contents are covered by the signed executables, SHA-256 checksums, and the signed
Northwing update manifest.

## Source and trusted build path

- Canonical repository:
  <https://github.com/holobunganan-sketch/DeepSeek-Reasonix>
- Release branch: `main-v2`
- Stable tag format: `northwing-v<major>.<minor>.<patch>`
- Build system: GitHub Actions
- Stable release workflow: `.github/workflows/northwing-release.yml`
- Product version authority: `desktop/wails.json`

A Stable tag must identify a commit contained in `main-v2`. The release
workflow builds from a clean checkout, repeats the root Go, desktop Go,
frontend, production-entry browser, Windows native smoke, package, signature,
Microsoft Defender, and checksum gates, and publishes only after every required
gate succeeds.

Unsigned artifacts can be produced only by the separate CI/test path and must be
named `UNSIGNED-TEST-ONLY`. They are not Stable releases.

## Maintainer and approval roles

Northwing currently has one individual maintainer:

- Committer: [@holobunganan-sketch](https://github.com/holobunganan-sketch)
- Reviewer: [@holobunganan-sketch](https://github.com/holobunganan-sketch)
- Release approver: [@holobunganan-sketch](https://github.com/holobunganan-sketch)
- SignPath organization administrator, after approval:
  [@holobunganan-sketch](https://github.com/holobunganan-sketch)

The project does not claim two-person separation while it has one maintainer.
The repository records ownership in `.github/CODEOWNERS`; the release workflow
uses scoped GitHub Actions permissions and a clean/tag-ancestry gate. Required
branch rules, the SignPath trusted-build definition, and SignPath provider-side
approvals will be verified during provisioning before the first SignPath-signed
Stable release. Additional maintainers will be listed here before receiving
signing or release authority.

## Fork and upstream signing boundary

Northwing is a modified GitHub fork of the upstream Reasonix repository:

<https://github.com/esengine/DeepSeek-Reasonix>

The frozen Northwing baseline is commit
`b1f9471da9b7bceb0566f46f45d695c8fc9bae34`. See
[Reasonix Baseline](./REASONIX_BASELINE.md) and
[Third-Party Notices](../THIRD_PARTY_NOTICES.md).

The inherited `.signpath/contracts/release-signing.yml`, Reasonix release
workflows, and `docs/SIGNPATH_WINDOWS_ADMIN_SOP.md` remain bound to the upstream
`esengine/DeepSeek-Reasonix` SignPath project. Artifact-configuration XML files
in this fork have been adapted to describe Northwing payload filenames, but
they are repository-side templates and confer no signing authority. None of
these files authorizes Northwing to use an upstream certificate, token,
organization, project, signing policy, or approval.

After Foundation approval, Northwing will use a separate SignPath organization
and/or project identity bound to this fork and its Northwing release workflow.
No upstream credential will be copied or reused.

## Required release verification

Before a signed Stable release can be published, the release job must record:

- valid Authenticode signatures for the app, update helper, and setup executable;
- the expected signer identity and a trusted timestamp;
- matching signer public-key identity across all signed files;
- SHA-256 for the setup executable, app executable, update helper, and portable
  package;
- a successful Windows native launch/process/window smoke test;
- a clean file-level Microsoft Defender scan for each executable;
- successful installer, portable package, version, update-helper, and signed
  update-manifest verification.

A missing signing credential, incomplete signature, skipped Defender scan,
failed verification, or mismatched signer fails closed. It cannot publish a
Stable GitHub Release.

## Key and credential handling

Signing credentials must be held by SignPath or in the GitHub Actions secret
store with access limited to the release workflow. They must not be committed
to the repository, included in artifacts, printed to logs, exported to
untrusted jobs, or made available to pull-request code.

The Northwing release workflow currently supports a repository Actions secret
`NORTHWING_WINDOWS_RELEASE_CREDENTIAL` for a conventional Authenticode
certificate. SignPath integration will replace or isolate that credential path
after Foundation provisioning; the Stable fail-closed requirements remain the
same.

## Incident and revocation policy

If a signing credential, workflow, release account, or signed artifact may be
compromised, the maintainer will:

1. stop Stable publication and automatic update publication;
2. disable or rotate affected credentials and GitHub environment access;
3. request certificate revocation through the signing provider when warranted;
4. remove affected downloadable artifacts without rewriting their Git history;
5. publish a security advisory and replacement release with new checksums;
6. preserve logs and evidence needed to investigate the incident.

A certificate may also be revoked for malware, policy violations, deceptive
signing, loss of project control, or termination of Foundation eligibility.

## Signing-status reporting

Every GitHub Release must state whether its Windows artifacts are:

- **SIGNED** — all required Authenticode and release gates passed;
- **UNSIGNED-TEST-ONLY** — a CI artifact that is not a Stable release; or
- **UNSIGNED HISTORICAL RELEASE** — a previously published package retained for
  transparency.

A Git commit's GitHub “Verified” badge is a commit/tag signature. It is not an
Authenticode signature on a Windows executable.
