# Changelog

## Unreleased

- Entry points (#5 U4): the selected workspace is remembered in the plugin's own storage (new capability `storage:own`; worker handlers `selection.remember` and `selection.recall`, which verify the binding before every write and use and drop one that no longer verifies). The panel selects it again on open. Palette commands Open console / Open dashboard / Show status act on it (Open console also on `Mod+Alt+Shift+H`); with nothing remembered, or a workspace that changed, they run nothing, and they never return a one-time link. Orca's `workspace.created` / `workspace.removed` redraw the list without running `ahub` and keep a selection still drawn with the same binding; `workspace.changed` marks a single matching row "focused in Orca?" as a hint that never selects. The content hash changes.
- Panel (#5 U3): rows that are agent-hub projects get a `hub running` / `hub stopped` badge from `ahub projects --json` (new worker handler `projects.read`, asked once after a list is drawn and only when a workspace binds on this Mac; reads only `[].root` and `[].state`; every workspace on a project's folder is matched, and a badge goes only on a row whose id, host, kind and real root are the ones matched). A missing `ahub`, or host settings that leave nothing openable, show one setup notice naming the setting. Help, Troubleshooting and Report an issue links, and the version and contract in the footer. README "Use" and "Access and privacy" describe U2 and U3.
- Panel (#5 U2): styled from Orca's theme tokens in light and dark, a version label and a folded "What it never does" note. Whole rows are selectable by click, arrow keys and Enter or Space (`listbox`/`option`). A filter box appears above 8 workspaces. Workspaces that cannot be opened here fold under "N not available on this Mac" with their reason. A refusal that names a command shows it with a Copy command button. The status state is a badge, and peers show state badges.
- Worker: a `remote` or `unsupported_platform` refusal now carries the `'ahub' 'console'` command, on list rows as well as on open, so the panel holds no command text of its own.
- Docs (#5 U1): the README is rewritten for people installing and using the plugin (requirements, install, use, settings, access and privacy, troubleshooting, uninstall, known limitations). The previous README is kept as `docs/design.md`. Added `COMPATIBILITY.md` and `RELEASE.md`.
- Added the plugin icon (`assets/icon.png`, source `assets/icon.svg`) and `author` to `orca-plugin.json`. No behaviour change; the content hash changes.
- Brought up from `integrations/orca/` of STAIxBWLB/agent-hub at commit `16b8251657a2196a472aa3c578450489286637d7` (STAIxBWLB/agent-hub#1387, T1). No behaviour change.
- Added `repository` and `homepage` to `orca-plugin.json` (accepted by `orca plugin validate` 1.4.255).
- Added `contract/companion-cli-v1.json` (copied from agent-hub PR #1388 head `0c427dd06a600fb0003977a8bde75bec097eb3e9`, ahub 0.37.0 unreleased; see `contract/SOURCE.md`) and `test/companion-cli-contract.test.ts`: the `shellQuote` vectors, the argv forms, the no-hub prefix and every status field the reader touches are checked against it.
- Added CI: `bun test`, then `plugin validate`, `plugin check` and `plugin inspect` of a pinned Orca CLI, and a tag check against the manifest version.

## 0.1.0

Not tagged yet. The tag needs the person's release consent (STAIxBWLB/agent-hub#1387).
