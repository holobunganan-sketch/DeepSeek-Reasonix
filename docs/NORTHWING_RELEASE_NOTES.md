# Northwing 0.3.1

Northwing 0.3.1 is the stability recovery release for the 0.3 desktop line. It repairs production wiring, first-run durability, Windows chrome, Work/Artifact projections, and release safety discovered after 0.3.0.

## Desktop stability

- Restores Minimize, Maximize/Restore, and Close controls in the outer Windows frameless shell, including draggable titlebar behavior, double-click maximize, and maximized-state synchronization.
- Gives the Northwing shell sole ownership of native window chrome. Work and Quick Chat reuse an embedded Reasonix execution surface without a second sidebar, project tree, or window-control group.
- Replaces internal kebab-case route names in user-visible breadcrumbs.
- Localizes Northwing product navigation, primary pages, forms, actions, native window labels, and state messages through the existing English/Simplified Chinese/Traditional Chinese dictionaries.
- Removes stable navigation entries that led only to placeholder pages.

## Project and Work lifecycle

- Connects every Home, navigation, Work-list, and Project New Work entry to the shared production navigation controller.
- Implements New Project through the native workspace picker and existing workspace persistence, creates the Northwing manifest, refreshes the catalog, and reopens the Project after a catalog reload.
- Initializes and validates a fresh Project before creating a runtime Work session.
- Persists durable Work metadata before initial-goal submission, so a later provider failure remains visible and recoverable instead of leaving an unidentified session.
- Preserves the selected Project when starting Work from Project detail.
- Rejects missing/unwritable workspaces, read-only manifests, unavailable models, and missing provider credentials with actionable errors before session creation where possible.
- Wires Work Back to the complete Work list.

## Work, models, and settings

- Adds a complete, deduplicated Work collection containing active, waiting, completed, and failed Work while keeping Home projections non-overlapping.
- Loads configured providers/models and reasoning-effort capability from the existing Reasonix settings authority.
- Shows an actionable “No usable model configured” state and links directly to the existing Models settings surface.
- Restores an explicit Settings entry without introducing a second configuration store.

## Artifacts

- Synchronizes Work artifacts on entry and refresh, scoped to the active `workId`.
- Connects global Artifact Preview, Open, Reveal in folder, Set final, and Open Work actions to production Wails bindings.
- Shows Project/Work ownership, search, filters, and final state.
- Sorts Versions immutably so rendering cannot mutate component input.

## Updater and release security

- Removes the update helper’s hidden `cmd.exe`/`ping` cleanup chain.
- Uses a directly spawned Go helper child to wait for the staging helper, validate staging ownership, remove the directory, and retain `cleanup-error.log` when cleanup fails.
- Keeps installer, installed-version, checksum, and update-manifest verification fail-closed.
- Unsigned packages remain test-only; a stable release requires valid Authenticode signatures for `northwing.exe`, `northwing-update-helper.exe`, and the setup executable.
- Removes user-assigned provider names, model IDs, and provider-controlled
  finish-reason text from aggregate desktop metric buckets; metrics retain only
  allowlisted categories and fixed `configured`/`unresolved` state.
- Publishes explicit Northwing privacy, code-signing, upstream-derivation, and
  historical unsigned-artifact disclosures for the 0.3.1 release process.

## Validation

- Adds behavior coverage for Windows controls, production navigation, first Project/Work creation, catalog filtering/deduplication, Artifact actions/refresh, model/settings states, and the embedded session boundary.
- Replaces the independent browser test app with controlled Wails bridge injection around the real `src/main.tsx` production bootstrap.
- Exercises the production entry at 760×480, 1024×640, 1240×720, and 1440×900, including first-run, terminal Work states, Artifact actions, model/settings states, errors, and native window-control wiring.
- Builds the production frontend after typechecking, hook linting, CSS/z-index validation, and bundle-budget checks.
- The stable tag remains gated on Windows-native smoke, installer/portable verification, Authenticode verification, separate Defender scans, and SHA-256 generation.
- Native Windows smoke now records title and 1240×720 geometry, exercises minimize/maximize/restore, validates second-launch single-instance handoff, requests a normal `WM_CLOSE`, and captures Home evidence when an interactive desktop is available.

## Packages

- `Northwing-0.3.1-windows-x64-setup.exe`
- `Northwing-0.3.1-windows-x64-portable.zip`
- `Northwing-0.3.1-SHA256SUMS.txt`
