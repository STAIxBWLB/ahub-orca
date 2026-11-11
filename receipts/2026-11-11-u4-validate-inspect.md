# receipt: validate and inspect after the entry points (#5 U4)

Run: 2026-11-11, local Orca CLI 1.4.256, macOS, on the U4 branch before the PR. CI runs the same commands on Ubuntu with the pinned CLI 1.4.255.

What changed for Orca: capability `storage:own` (the remembered selection), three palette commands and one keybinding (`Mod+Alt+Shift+H`, Open console). Capabilities now: `workspace:read, workspace:write, terminal:send, settings:own, storage:own`.

Content hash of the working tree at the time of the run (`orca plugin inspect . --json`, `contentHash`): `1b07ebdcddced93141aaa56bf62edb564e448d14371d35b3976496baa23978f9`. Every later commit, including this receipt's, changes it; it is not a release claim ([RELEASE.md](../RELEASE.md)).

Not run: loading into a real Orca profile (`--approve` is the person's step), the keybinding and palette commands in Orca, storage surviving a restart, and the workspace events in Orca. All of those are checked against fixtures only.

## `orca plugin validate .`

```
<repo>/orca-plugin.json: ok
local.agent-hub-companion 0.1.0 (trusted-worker)
  Runs its own code in a separate Node.js process on the Orca host, with your user account’s access to that machine.
  - Read the name, branch, and terminal list of your focused workspace, and get notified when workspaces are created or removed
  - Open and rename your workspaces, open their files in Orca, and run its built-in commands
  - Type and run commands in your terminals, local and SSH
  - Read and change the plugin's own settings
  - Store data in the plugin's own storage folder
  adds panels: agent-hub
  adds commands: agent-hub: Open console (remembered workspace)
  adds commands: agent-hub: Open dashboard (remembered workspace)
  adds commands: agent-hub: Show status (remembered workspace)
  adds keybindings: Mod+Alt+Shift+H
  Loading or enabling it needs --approve <fingerprint>; Orca prints the fingerprint.
```
