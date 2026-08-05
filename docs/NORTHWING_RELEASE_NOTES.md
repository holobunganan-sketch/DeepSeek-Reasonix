Northwing is a local-first Work desktop application powered by the complete Reasonix kernel.

## Included in the 0.1 product line

- Native Work sessions over Reasonix project tabs, sessions, Goal, Delivery, permissions, checkpoints, and recovery.
- Direct selection of any configured Reasonix model; Work never requires a second API key.
- Persisted executor model and reasoning-effort restoration for saved Works.
- Guided Work creation with Work type, Quick/Standard/Deep quality, evidence policy, optional materials, and collapsed advanced settings.
- Deterministic WorkSpec compilation with acceptance criteria, pause policy, staged review, repair, and verification requirements.
- Project, Work, and Artifact organization with lazy `.northwing/project.json` creation.
- Durable Work/session recovery and deterministic `deliverables/<work-id>/` directories.
- Native editable DOCX, PPTX, XLSX, and searchable PDF generation.
- Local Office structure validation and independent interoperability checks.
- Artifact versioning, preview, final selection, open, reveal, scoped revision, and visible Work policy.
- Compact Work actions integrated directly beside the complete Reasonix project tree.
- Independent Northwing data directories, branding, URL protocol, update source, CLI, and Windows packaging.
- Per-user Windows installer, portable package, and SHA-256 checksums.

## Migration from the initial CoWork foundation

- The detached Chat/Work rail has been removed.
- The Work surface no longer contains an OpenCode Go API-key card. OpenCode Go remains an optional Reasonix Provider preset.
- Existing manifests load with `general`, `standard`, `project_only`, the current/default Reasonix model, and Harness version 2.
- Existing Artifact paths, versions, final selections, and Reasonix sessions remain unchanged.

## Installation

Use the Windows x64 installer for a normal per-user installation, or download the portable ZIP. Verify the selected package with `SHA256SUMS.txt` before running it.

Preview and unsigned builds may display a Windows SmartScreen warning. Review the release source and checksum before proceeding.

## Compatibility and attribution

Northwing preserves the complete Reasonix feature set and MIT license. See `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `docs/NORTHWING_USER_GUIDE.md` for details.
