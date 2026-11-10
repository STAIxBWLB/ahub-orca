# Changelog

## Unreleased

- Brought up from `integrations/orca/` of STAIxBWLB/agent-hub at commit `16b8251657a2196a472aa3c578450489286637d7` (STAIxBWLB/agent-hub#1387, T1). No behaviour change.
- Added `repository` and `homepage` to `orca-plugin.json` (accepted by `orca plugin validate` 1.4.255).
- Added `contract/companion-cli-v1.json` (copied from agent-hub PR #1388 head `b2ec055d504658e3d280a64c3810bc79f494352d`, ahub 0.37.0 unreleased; see `contract/SOURCE.md`) and `test/companion-cli-contract.test.ts`: the `shellQuote` vectors, the argv forms, the no-hub prefix and every status field the reader touches are checked against it.
- Added CI: `bun test`, then `plugin validate`, `plugin check` and `plugin inspect` of a pinned Orca CLI, and a tag check against the manifest version.

## 0.1.0

Not tagged yet. The tag needs the person's release consent (STAIxBWLB/agent-hub#1387).
