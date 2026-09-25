# Release guidance

The package starts at version `0.1.0` in the three plugin manifests. This checkout has no public remote or published release. Preparing a release locally does not publish it.

Before a release, choose a SemVer version and set the same value in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, and `.cursor-plugin/plugin.json`. Review the skill and all runtime files, run `npm ci` and `npm test`, and inspect the resulting diff. Confirm the installer fixture carries the validator, references, examples, and agent metadata.

Once a maintainer creates a public repository, they can review and commit the release, create an immutable `vX.Y.Z` tag, publish it, and smoke-test installation from that tag in disposable projects for all four agents. A stable `latest` branch should point to the chosen published stable commit only after publication. Do not move an existing version tag; issue a new version to correct a release. Remote publication, repository permissions, and GitHub release automation are outside this local handoff.
