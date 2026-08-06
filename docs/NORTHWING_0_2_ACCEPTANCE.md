# Northwing 0.2 Acceptance Contract

Northwing 0.2.0 is acceptable only when all of the following are true:

- Work is represented as a native enhanced project session.
- The detached Northwing project-center toolbar is absent.
- Project create actions include Chat, Work, and Add project folder.
- Work rows use the native project-tree row visual and runtime state.
- The active Work exposes a compact native header and Work-scoped drawer.
- Existing 0.1.x Work and artifact data migrate with backup and idempotence.
- Runtime and release code use only Northwing update sources.
- Windows installation never skips `northwing.exe` and safely replaces a running version.
- The in-app update flow downloads, verifies, closes, replaces, validates, and restarts.
- All user-visible and packaged versions are 0.2.0.
- The release publishes only Northwing-named setup, portable, checksum, and update-manifest assets.
