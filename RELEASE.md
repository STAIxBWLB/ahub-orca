# Releasing

A release is a Git tag `v<version>` on `main`. Orca installs from the tag, so a tag is permanent for
anyone who installed it. Tagging needs the person's consent.

1. On a branch, set the same `<version>` in `orca-plugin.json` and `package.json`.
2. In `CHANGELOG.md`, rename `## Unreleased` to `## <version>` and write a "New in <version>" summary
   of what a user notices first. Add the version's row to `COMPATIBILITY.md`.
3. Run the checks and keep their output for the receipt:

   ```sh
   bun test
   orca plugin validate .
   orca plugin check .
   orca plugin inspect . --json      # capabilities and content hash
   ```

4. Merge the PR. On the merged `main`, run `orca plugin release-entry . --json` and save its output under
   `receipts/` with the date and the Orca version.
5. With the person's consent: `git tag v<version> && git push origin v<version>`. CI fails a tag that does
   not equal the manifest version.
6. Record `orca plugin install STAIxBWLB/ahub-orca@v<version>`, run **without** `--approve`: it must stop
   at the approval step and list exactly the capabilities in the README.
7. Create a GitHub release for the tag with the CHANGELOG section as its notes.

Approving and loading the plugin into a real Orca profile is the person's step
([native-receipt.md](native-receipt.md)). Adding the `orca-plugin` topic lists the plugin in the
community catalog, and a listed version is permanent: never add it without the person's explicit go-ahead.
