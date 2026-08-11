# Northwing Privacy Policy

Effective date: August 11, 2026

This policy applies to official Northwing distributions and the Northwing source
repository at <https://github.com/holobunganan-sketch/DeepSeek-Reasonix>. It does
not govern independent builds of the upstream Reasonix project or third-party
services that a user chooses to connect.

## Summary

Northwing is a local-first desktop application. It has no Northwing account
system, advertising service, hosted model proxy, or maintainer-operated cloud
workspace. Project files, conversations, configuration, credentials, and
artifacts are stored on the user's device or in workspaces selected by the user.

Some features make network requests. These requests are described below.
Telemetry, update checks, AI providers, and extensions have separate controls
and recipients.

The Northwing project does not sell personal data, build advertising profiles,
or include third-party advertising SDKs.

## Data stored on the device

Depending on the features used, Northwing stores:

- project files and generated artifacts in user-selected workspaces;
- compact Work metadata under `<workspace>/.northwing/`;
- sessions, conversation history, runtime state, recovery data, settings, and
  logs under the inherited Reasonix data directories;
- provider configuration in `config.toml` and provider API keys in the
  user-global Reasonix `.env` file;
- a random desktop installation identifier used by optional telemetry;
- pending aggregate metric counters used when metrics are enabled;
- scrubbed crash diagnostics that can be queued until the next launch, then
  sent when desktop telemetry is enabled or deleted unsent when it is disabled.

The exact platform paths and credential protections are documented in
[Configuration paths](./CONFIG_PATHS.md). Northwing does not copy transcripts,
provider secrets, model configuration, or tool output into the
`<workspace>/.northwing/` metadata directory. The Reasonix execution layer may
still retain session history and tool events in its own local data directory.

## Network data flows

### User-configured AI providers

When a user submits a Chat or Work request, Northwing sends the request to the AI
provider endpoint selected by the user. A request can include prompts,
conversation context, selected file content, tool results, model settings, and
other material required to complete the request. The provider API key is sent
to that provider for authentication.

Northwing does not route these requests through a Northwing-operated model
proxy, and the Northwing maintainer does not receive the provider API key.
Each provider processes data under its own terms and privacy policy.

### Tools, MCP servers, Skills, plugins, and external commands

Northwing can run user-enabled tools, MCP servers, Skills, plugins, terminal
commands, Git operations, and other integrations. An integration can read local
data or transmit data to a service according to its configuration, its code,
and the approval granted by the user. Users should review an integration before
enabling it and should not grant access to data the integration does not need.

### Desktop launch telemetry

Official non-development desktop builds send one launch ping per application
start when **Anonymous usage ping** is enabled. This setting is enabled by
default. The request goes to `https://crash.reasonix.io/v1/ping` and contains:

- a random 128-bit installation identifier generated on the device;
- Northwing/Reasonix build version;
- operating system and processor architecture;
- operating-system version when available.

It does not contain conversations, API keys, repository names, workspace paths,
or file contents.

If the previous desktop process ended abnormally, the next launch may send a
scrubbed native diagnostic to `https://crash.reasonix.io/v1/report` while
**Anonymous usage ping** is enabled. A diagnostic can include the lifecycle
phase, error category, scrubbed message and stack, recent scrubbed breadcrumbs,
build/channel/language/view information, operating-system version, CPU model,
core count, and rounded RAM size. The code removes panic values, email
addresses, personal home-directory segments, credential patterns, tokens, and
long identifiers before transmission.

A report explicitly sent from a diagnostic screen can include the same bounded
diagnostic fields. That report is sent only after the user selects the send
action.

### Aggregate desktop metrics

Official non-development desktop builds send aggregate quality metrics to
`https://crash.reasonix.io/v1/metrics` when **Share aggregate quality
metrics** is enabled. This setting is enabled by default. A batch can include:

- the random desktop installation identifier, build version, and operating
  system;
- allowlisted signal/bucket counts for lifecycle health, recovery, errors, UI
  preferences, feature configuration, finish-reason categories, latency ranges,
  and usage ranges; unknown provider-supplied categories become `other`;
- only `configured` or `unresolved` state for model/provider selections.

Northwing does not send custom provider names, model IDs, provider base URLs,
prompts, answers, reasoning, tool arguments/output, paths, repositories,
session IDs, exact token/cost values, credentials, or environment variables in
these metrics.

### CLI telemetry and crash reports

The inherited Reasonix CLI has a separate telemetry choice. Before the first
eligible CLI telemetry request, an interactive release build displays the data
boundary and asks for consent. CLI telemetry is disabled in CI and development
builds and when `DO_NOT_TRACK` or `REASONIX_TELEMETRY=0` is set.

CLI crash reports are saved locally, are scrubbed, and are never uploaded
automatically. The user must review and explicitly send a report with the
`reasonix report` command.

### Software updates

Northwing checks the Northwing GitHub Releases channel for updates on startup
when **Check for updates** is enabled. This setting is enabled by default. The
app requests a signed update manifest and signature from GitHub and downloads an
installer only after the user starts an update. These requests disclose ordinary
network information such as the user's IP address and user agent to GitHub and
its download infrastructure.

## Controls

Desktop controls are available under **Settings → Updates**:

- turn off **Anonymous usage ping** to stop future launch pings and automatic
  native-crash uploads;
- turn off **Share aggregate quality metrics** to stop future aggregate metric
  uploads;
- turn off **Check for updates** to stop automatic startup checks. Manual checks
  remain available.

The same controls can be set in the user-global `config.toml`:

```toml
[desktop]
telemetry = false
metrics = false
check_updates = false
```

CLI telemetry can be disabled with:

```text
reasonix config telemetry off
```

Disabling a network feature does not delete unrelated local project or session
data. Pending local metric files can be removed by deleting them from the
Reasonix data directory after Northwing is closed.

## Retention and deletion

Local data remains until the user deletes the relevant workspace, artifact,
session, configuration, credential, log, or application-data files. Uninstalling
the application may leave user data so that an installation can be recovered
later.

Northwing does not operate an account database that can be deleted centrally.
The `crash.reasonix.io` endpoints are inherited upstream services. Their server
logs and retention are outside this repository's local-data controls. Users who
do not want data sent to those endpoints should disable desktop telemetry and
metrics before using an official release.

To request help locating or deleting Northwing local data, open a minimal issue
at <https://github.com/holobunganan-sketch/DeepSeek-Reasonix/issues>. Do not post
API keys, prompts, file contents, personal identifiers, or other sensitive data
in a public issue. The maintainer can arrange a private channel if a request
requires sensitive details.

## Security

Northwing limits credential storage and transmission as described in
[Configuration paths](./CONFIG_PATHS.md). Release automation requires
cryptographic package verification and treats unsigned Stable artifacts as a
release failure. No software can guarantee absolute security; users should
protect their device, workspaces, provider accounts, and API keys.

Security vulnerabilities should be reported through GitHub's private security
reporting channel when it is available. Do not disclose exploitable details in a
public issue.

## Children

Northwing is a developer and knowledge-work tool and is not directed to children
under 13. The project does not knowingly create accounts for or collect data
directly from children.

## Changes to this policy

Material changes are committed to the public repository. The effective date at
the top of this file will be updated when the policy changes. Repository history
preserves earlier versions.
