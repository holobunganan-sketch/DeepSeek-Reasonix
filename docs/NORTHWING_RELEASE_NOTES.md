# Northwing 0.2.0

Northwing 0.2.0 promotes Work into the native Reasonix project/session architecture and establishes an independent Northwing distribution chain.

## Native Work sessions

- Work is represented by the existing Reasonix project topic and session, with compact Northwing Work metadata layered onto it.
- The detached `NorthwingProjectCenter` toolbar has been removed.
- The project create menu now exposes Chat, Work, and Add project folder in one native entry.
- Work creation applies the selected configured model, optional reasoning effort, Delivery profile, Goal contract, Harness policy, and deterministic `deliverables/<work-id>/` boundary before the first provider request.
- Work rows reuse project-tree runtime states and display Work quality plus acceptance progress.
- The active Work shows a compact context header and a Work-scoped Artifact drawer.
- Artifact sync, preview, Office inspection, final selection, open, reveal, revision, and continuation remain bound to the owning Work session.
- Work stage and acceptance progress persist across restarts and session rebinding.

## Migration

- Project manifests advance to version 2.
- Existing version-1 manifests are backed up byte-for-byte as `.northwing/project.v1.backup.json` before atomic migration.
- Migration is idempotent. When a safe backup or write is impossible, the legacy project remains available as a read-only projection instead of being modified.
- Existing session paths, topic/Goal links, Artifact versions, hashes, and final selections are preserved.

## Independent updates and Windows installation

- Northwing checks only the `northwing-v*` release line and exact Northwing package names.
- The inherited Reasonix update endpoints and apply path are not used by the Northwing product flow.
- Automatic Windows x64 updates require the exact setup asset and the matching Northwing SHA-256 checksum entry.
- A dedicated `northwing-update-helper.exe` waits for the running app to exit, applies the verified installer, validates `northwing 0.2.0`, restarts the application, and removes staging files.
- The installer requests a normal Northwing shutdown before replacement, retries locked executable writes, provides no Ignore path, and restores the previous executable when replacement fails.
- Windows acceptance runs a real silent overwrite while Northwing is running, followed by CLI version, GUI startup, protocol, uninstall, portable-content, and checksum checks.

## Packages

The release contains only Northwing distribution assets:

- `Northwing-0.2.0-windows-x64-setup.exe`
- `Northwing-0.2.0-windows-x64-portable.zip`
- `Northwing-0.2.0-SHA256SUMS.txt`
- `northwing-update.json`

Northwing remains local-first and retains the complete frozen Reasonix kernel, applicable MIT license, and third-party notices.
