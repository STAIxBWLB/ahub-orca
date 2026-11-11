# Changelog

## Unreleased

- Panel (#5 U2): styled from Orca's theme tokens in light and dark, a version label and a folded "What it never does" note. Whole rows are selectable by click, arrow keys and Enter or Space (`listbox`/`option`). A filter box appears above 8 workspaces. Workspaces that cannot be opened here fold under "N not available on this Mac" with their reason. A refusal that names a command shows it with a Copy command button. The status state is a badge, and peers show state badges.
- Worker: a `remote` or `unsupported_platform` refusal now carries the `'ahub' 'console'` command, on list rows as well as on open, so the panel holds no command text of its own.
- Brought up from `integrations/orca/` of STAIxBWLB/agent-hub at commit `16b8251657a2196a472aa3c578450489286637d7` (STAIxBWLB/agent-hub#1387, T1). No behaviour change.
- Added `repository` and `homepage` to `orca-plugin.json` (accepted by `orca plugin validate` 1.4.255).
- Added `contract/companion-cli-v1.json` (copied from agent-hub PR #1388 head `0c427dd06a600fb0003977a8bde75bec097eb3e9`, ahub 0.37.0 unreleased; see `contract/SOURCE.md`) and `test/companion-cli-contract.test.ts`: the `shellQuote` vectors, the argv forms, the no-hub prefix and every status field the reader touches are checked against it.
- Added CI: `bun test`, then `plugin validate`, `plugin check` and `plugin inspect` of a pinned Orca CLI, and a tag check against the manifest version.

## 0.1.0

Not tagged yet. The tag needs the person's release consent (STAIxBWLB/agent-hub#1387).
