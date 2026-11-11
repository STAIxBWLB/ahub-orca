# agent-hub for Orca

<img src="assets/icon.png" alt="" width="64" align="right">

**Open your project's agent-hub console or dashboard from Orca's sidebar.** Pick a workspace, then open
its existing agent-hub screen in one click. It is optional and removable: ahub and Orca each keep all of
their own functionality without it.

[![Orca 1.4.252+](https://img.shields.io/badge/Orca-1.4.252%2B-0f766e)](COMPATIBILITY.md)
[![macOS](https://img.shields.io/badge/platform-macOS%20local-475569)](#known-limitations)
[![MIT license](https://img.shields.io/badge/license-MIT-475569)](LICENSE)
[![CI](https://github.com/STAIxBWLB/ahub-orca/actions/workflows/ci.yml/badge.svg)](https://github.com/STAIxBWLB/ahub-orca/actions/workflows/ci.yml)

Version **0.1.0** (not tagged yet). See the [changelog](CHANGELOG.md).

## What it does

A panel in Orca's right sidebar lists Orca's workspaces. You select one, and it opens an **existing**
agent-hub screen for it:

| Button | What happens | Where it runs |
| --- | --- | --- |
| Open dashboard | runs `ahub ui` in the selected folder; ahub opens its own browser. If ahub only prints a one-time link, the panel shows an "Open the link" button | a short-lived child of the plugin worker |
| Open console | Orca creates a terminal in that workspace running `'ahub' 'console'` | a terminal you can see and close |
| Open family console | the same, running `'acon' 'ui'` | a terminal you can see and close |
| Show status | reads the project's public status once and shows counts and states: agent-hub version, tasks by state, each peer's state and queue | read-only, only when you click |

It never approves, assigns, completes, retries, stops or upgrades anything, starts a hub, or writes
configuration. Those decisions stay in the screens it opens.

## Requirements

- **Orca desktop 1.4.252 or newer** on macOS. Other platforms are refused; see [Known limitations](#known-limitations).
- **agent-hub (`ahub`) installed** on the same Mac, on `PATH` or set in the plugin's "ahub executable" setting.
  The companion reads only what the [companion CLI contract v1](contract/companion-cli-v1.json) lists;
  see [COMPATIBILITY.md](COMPATIBILITY.md) for versions.
- **An agent-hub project** in the workspace's folder. The console, dashboard and status need its hub
  running (`ahub up`); the companion never starts one.
- `acon` installed, only for "Open family console".

## Install

Nothing installs or enables itself, and `ahub setup` never turns it on. Orca shows the access the plugin
asks for, and you approve it before it runs.

**From a Git URL** (once `v0.1.0` is tagged):

1. Open **Settings → Plugins**.
2. Choose **Add plugin → From a Git URL...** and enter `https://github.com/STAIxBWLB/ahub-orca#v0.1.0`.
   Keep `#v0.1.0` at the end so the release tag is installed.
3. Review and approve the **trusted worker** and the four capabilities listed under [Access and privacy](#access-and-privacy).

Or from a terminal: `orca plugin install STAIxBWLB/ahub-orca@v0.1.0`. It stops at the approval
step and prints the fingerprint to approve.

**From a local checkout** (development, or before the first tag). Use an isolated Orca profile for a first run:

```sh
orca plugin validate .                     # offline check
orca plugin inspect .                      # the access it asks for and its content hash
orca plugin dev load .                     # prints the fingerprint and exits 3 until approved
orca plugin dev load . --approve <fingerprint>
```

It is not listed in a plugin catalog yet.

## Use

1. Open **agent-hub** from the layers icon in Orca's right sidebar.
2. Select a workspace: click its row, or move with the arrow keys and press Enter. The row shows its name,
   branch, real folder and host, and a **hub running** or **hub stopped** badge when the folder is an
   agent-hub project. With more than 8 workspaces, type in the filter box to narrow the list.
3. Choose **Open console**, **Open dashboard**, **Open family console** or **Show status**.

Open console creates a new terminal in the background; select its tab to see it. "Refresh workspaces"
reads Orca's list again. Status is read only when you click; an old reading is marked stale and is not
refreshed for you.

Workspaces that cannot be opened on this Mac are folded under "N not available on this Mac", each with
its reason. When the fix is a command to run elsewhere, **Copy command** copies it. A setup problem (no
`ahub` found, or host settings that leave nothing openable) is shown once above the list with the
setting to change. **Help**, **Troubleshooting** and **Report an issue** at the bottom open this
repository's pages.

## Settings

Under **Settings → Plugins → agent-hub**:

| Setting | Default | Set it when |
| --- | --- | --- |
| Host ids that mean this Mac (`localHostIds`) | empty | your workspaces carry a host id. List the ids that are this Mac, comma separated (for example `local`). A workspace on any other host is treated as remote and nothing is run for it here |
| Treat a missing host id as this Mac (`trustNullHostAsLocal`) | off | Orca leaves the host id empty and **all** your workspaces are on this Mac |
| ahub executable (`ahubPath`) | empty (uses `ahub` from `PATH`) | Orca's environment cannot find `ahub`. Give the absolute path to a file named `ahub` |

## Access and privacy

The plugin asks for four capabilities, and nothing else:

| Capability | Used for |
| --- | --- |
| `workspace:read` | listing Orca's workspaces |
| `workspace:write` | showing the selected workspace in Orca |
| `terminal:send` | creating the console terminal (Orca requires it for `terminal.create`) |
| `settings:own` | reading the three settings above |

- **Nothing is kept.** No CLI output, one-time link, task text or credential is written to plugin storage,
  a setting or the log. The selection lives in the panel's memory only. A one-time dashboard link is held
  in memory for at most 55 seconds, then dropped.
- **Status is a closed projection.** Only counts, ids and fixed state words are copied out of `ahub status --json`;
  no task title, peer activity line, notice or path is read.
- **Project badges read two fields.** When the list shows a workspace this Mac can open, the worker runs
  `ahub projects --json` once and reads only each project's folder and hub state; only a workspace id to
  state map reaches the panel. A list with nothing openable here runs nothing.
- **Selection is exact.** A workspace is chosen by Orca's workspace id, never by name or branch. Before every
  action the worker re-reads the list and requires the same id, host, kind and real folder; otherwise it
  refuses and runs nothing.
- A trusted worker is full-access code once approved; Orca does not confine its files or child processes.
  Treat it as code you run.

## Troubleshooting

Every refusal says what happened and runs nothing.

| Code | The panel says | Do this |
| --- | --- | --- |
| `host_unknown` | Orca did not say which machine this workspace is on | set "Host ids that mean this Mac", or turn on "Treat a missing host id as this Mac" if all workspaces are local, then click Refresh workspaces |
| `remote` | This workspace is on another host | run `ahub console` in a terminal on that host |
| `cli_missing` | The ahub command was not found | set "ahub executable" to the absolute path of `ahub` |
| `invalid_setting` | A plugin setting is not valid | "ahub executable" must be an absolute path to a file named `ahub` |
| `cli_failed` | ahub did not succeed | start the project's hub with `ahub up` in a terminal, then try again |
| `cli_timeout` | ahub did not answer in time | check that `ahub status` answers in a terminal in the project, then try again |
| `cli_output_too_large` | ahub printed more than expected | run the same command (`ahub ui` or `ahub status`) in a terminal to see what it prints; the installed ahub may not match [COMPATIBILITY.md](COMPATIBILITY.md) |
| `unrecognized_output` | ahub answered in a form this companion does not recognize | run `ahub ui` in a terminal; check the ahub version against [COMPATIBILITY.md](COMPATIBILITY.md) |
| `not_offered` | This Orca does not offer what that needs | update Orca; until then, open a terminal in the workspace and run the command shown |
| `unsupported_platform` | This companion is not qualified on this operating system | open a terminal in the workspace and run `ahub console` |
| `missing` | That workspace is no longer in Orca's list | click Refresh workspaces and select it again |
| `changed` | That workspace changed (its id, host, kind or root) | select it again; if a folder link was re-pointed, check it first |
| `unreal_root` | The workspace's folder is not a real absolute folder on this Mac | check the workspace's folder in Orca; a missing or relative folder cannot be used |
| `inventory_unavailable` | Orca did not list its workspaces | close and reopen the panel; if it repeats, restart the plugin (`orca plugin restart <plugin key>`) |
| `truncated` | Orca's workspace list was cut short | click Refresh workspaces; if it repeats, report it with `orca plugin logs <plugin key>` |
| `malformed` | Orca returned a workspace this companion cannot read exactly | check that Orca matches [COMPATIBILITY.md](COMPATIBILITY.md); report it with `orca plugin logs <plugin key>` |
| `duplicate` | Two workspaces share one id | fix or remove the duplicate workspace in Orca, then click Refresh workspaces |
| `bad_request` | That request was not valid | reopen the panel; if it repeats, report it with `orca plugin logs <plugin key>` |
| status `offline` | No agent-hub is running for this project | run `ahub up` in the project |
| status `unavailable_version` | This project's agent-hub is too old | upgrade it with `ahub upgrade` |
| status `unknown` | The reading has no time | click Show status again |
| status `failed` | ahub did not answer the status request | run `ahub status` in a terminal in the project to see why |
| status `timeout` | ahub did not answer in time | as `cli_timeout` |
| status `too_large` | ahub printed more than expected | as `cli_output_too_large` |
| none | The companion did not answer | disable and re-enable the plugin in Settings → Plugins, then check `orca plugin logs <plugin key>` |

The plugin key is `local.agent-hub-companion` for a development folder and `<publisher>.agent-hub-companion` for an install.

## Uninstall

```sh
orca plugin disable <publisher>.agent-hub-companion     # keep it installed, turn it off
orca plugin uninstall <publisher>.agent-hub-companion   # remove it
orca plugin dev unload .                                # remove a development folder
```

Removing it stops no agent, removes no worktree, edits no hub state and restores no setting,
because it never changed any.

## Known limitations

[`support-matrix.json`](support-matrix.json) gives each combination its own verdict. A combination becomes
`supported` only when its **person-run** receipt has been run. None has been run yet, so even macOS is
checked against fixtures only.

| Combination | Verdict | What happens | Receipt (person-run, NOT RUN) |
| --- | --- | --- | --- |
| `macos-local-desktop` | fixture only | everything above, checked against fixtures and real scripts | [native-receipt.md](native-receipt.md) |
| `remote-workspace` | unsupported | refused before anything runs; you are shown `'ahub' 'console'` to run on that host | [receipts/remote.md](receipts/remote.md) |
| `windows-desktop` | unsupported | every workspace is refused with `unsupported_platform` | [receipts/windows.md](receipts/windows.md) |
| `browser-or-mobile-client` | unsupported | no link is held or shown; it says to run `ahub ui` on the machine that runs the project | [receipts/browser-mobile.md](receipts/browser-mobile.md) |
| `linux-desktop` | unsupported | never exercised and not claimed | none |

- **No terminal focus.** Open console always creates a new terminal. Orca documents no mapping from a plugin
  terminal id to a terminal it can switch to, so the companion never focuses, reads or replaces one.
- **No background refresh.** Status and the workspace list are read only when you click.

## More

- [docs/design.md](docs/design.md): the design and verification record (selection rules, status states,
  action counts, what is not proven).
- [COMPATIBILITY.md](COMPATIBILITY.md): Orca, ahub and contract versions.
- [RELEASE.md](RELEASE.md): how a version is released.
- [host-contract-v1.md](host-contract-v1.md): the frozen Orca host contract the companion is built on.

## License

[MIT](LICENSE)
