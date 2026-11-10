# receipt: orca plugin validate and inspect (T1 bring-up)

Run: 2026-11-10, local Orca CLI 1.4.255, macOS, on the T1 branch before the PR. CI runs the same commands on Ubuntu with the pinned CLI (see the CI log of the PR).

Not run: `orca plugin install STAIxBWLB/ahub-orca@v0.1.0` without `--approve` (there is no tag yet, and the tag needs the person's consent). `--approve` was never passed.

## `orca plugin validate .`

```
<repo>/orca-plugin.json: ok
local.agent-hub-companion 0.1.0 (trusted-worker)
  Runs its own code in a separate Node.js process on the Orca host, with your user account’s access to that machine.
  - Read the name, branch, and terminal list of your focused workspace, and get notified when workspaces are created or removed
  - Open your workspaces and their files in Orca, and run its built-in commands
  - Type and run commands in your terminals, local and SSH
  - Read and change the plugin's own settings
  adds panels: agent-hub
  Loading or enabling it needs --approve <fingerprint>; Orca prints the fingerprint.
```

## `orca plugin check .`

```
<repo>/orca-plugin.json: ok
No components panels or custom editors to check.
```

## `orca plugin inspect .`

```
local.agent-hub-companion 0.1.0 (trusted-worker)
  Runs its own code in a separate Node.js process on the Orca host, with your user account’s access to that machine.
  - Read the name, branch, and terminal list of your focused workspace, and get notified when workspaces are created or removed
  - Open your workspaces and their files in Orca, and run its built-in commands
  - Type and run commands in your terminals, local and SSH
  - Read and change the plugin's own settings
  adds panels: agent-hub
  Loading or enabling it needs --approve <fingerprint>; Orca prints the fingerprint.
Content hash: fee2143ef2b970c1f6d45a44ca8c6376ce2c98121c83443867a3ca384673767b (36 files, 222630 bytes)
```

Note: the content hash covers every file of the plugin folder, `receipts/` and `contract/` included, so it changes whenever one of them changes. The hash that counts is the one `inspect` prints for the tagged tree. The full JSON of this run is `inspect.json`.
