# receipt: validate and inspect after the icon and author (#5 U1)

Run: 2026-11-11, local Orca CLI 1.4.256, macOS, on the U1 branch before the PR. CI runs the same commands on Ubuntu with the pinned CLI 1.4.255.

What changed for Orca: `icon` (`assets/icon.png`, 256x256 PNG, 9368 bytes) and `author` in `orca-plugin.json`. Capabilities are unchanged: `workspace:read, workspace:write, terminal:send, settings:own`.

Content hash of the plugin folder (`orca plugin inspect . --json`, `contentHash`):

- before (T1, `receipts/inspect.json`): `8d9afb33f4d367f485e26b2abca397c1024729d697a9154fb0982edf994dd30a`
- after (this branch's working tree): `024f3a6cfab927de7a823d408ce5fab820b526b3114ed4541895de6a15f0eb4d`

The "after" hash is of the working tree at the time of the run, not of any commit: every later commit, including this receipt's, changes it. It is not a reproducibility or release claim. The release hash is the one `orca plugin release-entry .` prints for the tagged commit ([RELEASE.md](../RELEASE.md)).

Not run: install from a tag (no tag), and anything with `--approve`.

## `orca plugin validate .`

```
<repo>/orca-plugin.json: ok
local.agent-hub-companion 0.1.0 (trusted-worker)
  Runs its own code in a separate Node.js process on the Orca host, with your user account’s access to that machine.
  - Read the name, branch, and terminal list of your focused workspace, and get notified when workspaces are created or removed
  - Open and rename your workspaces, open their files in Orca, and run its built-in commands
  - Type and run commands in your terminals, local and SSH
  - Read and change the plugin's own settings
  adds panels: agent-hub
  Loading or enabling it needs --approve <fingerprint>; Orca prints the fingerprint.
```
