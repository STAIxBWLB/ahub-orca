# Compatibility

| Plugin | Orca (`engines.orca`) | Checked with Orca CLI | Platform | ahub CLI contract | ahub |
| --- | --- | --- | --- | --- | --- |
| 0.1.0 | `>=1.4.252` | 1.4.255 (CI pin) | macOS, local workspaces | [companion-cli v1](contract/companion-cli-v1.json) | 0.37.0 (ships contract v1) and later v1 releases |

- **Orca.** `engines.orca` is the oldest Orca the manifest may load on. CI runs `plugin validate`, `check` and
  `inspect` with the pinned CLI in `.github/workflows/ci.yml` (`ORCA_VERSION`). No version is claimed as
  natively verified until [native-receipt.md](native-receipt.md) is run.
- **ahub.** The companion reads only the commands and fields listed in the contract copy under `contract/`
  (source and hash in [contract/SOURCE.md](contract/SOURCE.md)). An older ahub that does not report a status
  field shows "unavailable version" in the status view instead of a wrong value. The open buttons use
  `ahub ui`, `ahub console` and `acon ui`, which predate the contract.
- **Platforms.** Only `macos-local-desktop` is in scope, and it is checked against fixtures only. Every
  combination and its verdict is in [support-matrix.json](support-matrix.json).

A row is added for each released version. When `engines.orca` is raised, the previous row stays.
