# My BA Skills

`requirements` is an explicitly invoked skill for discovering and maintaining software product requirements. It inspects an existing project or asks about a new product, then records current user journeys, measurable quality constraints, supporting evidence, and accepted changes in a dated ledger.

It works with Claude Code, Codex, Cursor, and OpenCode. The source is public under the MIT license.

## Install a release

Requires Node.js 22.20 or newer, Git, and one of the supported agents. From the project where you want to use the skill, run:

```sh
# Latest published stable release
npx skills@latest add https://github.com/ngthluu/my-ba-skills/tree/latest --skill requirements

# Pin the immutable first release
npx skills@latest add https://github.com/ngthluu/my-ba-skills/tree/v0.1.0 --skill requirements
```

Select your agent and project or global installation. Restart the agent afterward. `skills@latest` selects the installer version; `tree/latest` selects this repository's stable release branch. To restore a pinned version, reinstall from its tag. See [GitHub Releases](https://github.com/ngthluu/my-ba-skills/releases) for available versions.

For noninteractive project installation into all four agents:

```sh
npx skills@latest add https://github.com/ngthluu/my-ba-skills/tree/latest --skill requirements --agent claude-code codex cursor opencode -y
```

Add `--copy` to copy files instead of using the installer's default symlinks, or `--global` for a user-wide install.

## Install locally for development

From the project where you want to use the skill, run:

```sh
npx skills@latest add /absolute/path/to/my-ba-skills --skill requirements --agent claude-code codex cursor opencode -y
```

Replace the path with this checkout and select only the agents you use. The installed `skills/requirements` folder carries the validator script, references, and examples, so no development dependencies are needed in the target project.

| Agent | Explicit invocation |
| --- | --- |
| Claude Code | `/requirements` |
| Codex | `$requirements` |
| Cursor | Type `/` and select `requirements` |
| OpenCode | Ask to load `requirements` with the `skill` tool |

For example, ask: “Use `$requirements` to document the current booking flows in this project.” For a new product, describe its intended users and goal. The skill will ask about material choices and request confirmation before making a canonical requirements set. Git is required for final status; without Git, it leaves a reviewable draft.

## Requirements in a target project

The skill maintains `docs/requirements/README.md`, `journeys/*.md`, `non-functional.md`, `evidence.md`, `ledger.md`, and integrity metadata. Current documents describe the latest confirmed behavior. The ledger records each accepted addition, edit, or removal with its reason and before/after effect. The skill does not commit the files.

Validate a target project with the installed script:

```sh
node .agents/skills/requirements/scripts/requirements.mjs validate .
```

For Claude Code project installations, use `.claude/skills/requirements/scripts/requirements.mjs`. To apply a prepared candidate from a separate directory, use `node <installed-script> apply <target-project> <candidate-directory>`. The validator checks document structure, references, integrity metadata, and committed history where Git makes that possible. It reports uncommitted output separately; it cannot judge whether the prose describes the intended product. See [integrity rules](skills/requirements/references/integrity.md) and the [human review checklist](skills/requirements/references/review.md).

## Contributing

Issues and pull requests are welcome. Describe the problem, expected behavior, and verification. Edit the shared [skill](skills/requirements/SKILL.md) and keep runtime material inside its folder so installation carries it. Run `npm ci`, `npm test`, `npm run validate`, and `git diff --check` before submitting. These are development dependencies only. See [validation guidance](docs/validation.md) and the [maintainer release guide](docs/releases.md).

## License

[MIT](LICENSE) © 2026 Luu Nguyen.
