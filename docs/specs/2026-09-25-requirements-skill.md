# Requirements skill and traceable product documents

Status: Confirmed for implementation  
Date: 2026-09-25  
Source: User's request and decision rounds in this conversation

## Outcome

Create one open source skill named `requirements` in this repository. A person can invoke it in a software project to discover what users need, inspect existing behavior, gather evidence, and maintain a concise, current requirements set that a software factory can implement. The documents should explain who uses the product, what they do, what they see at meaningful points, what outcome they get, and how they recover from important failures. The skill favors user value and convenience; cosmetic decisions can wait.

## Current state

`my-ba-skills` was empty on 2026-09-25: no files, Git repository, or existing conventions. The neighboring `/Users/luu.nguyen/personal/my-dev-skills` is the packaging reference. It has shared `skills/<name>/SKILL.md` files, metadata for Claude Code, Codex, Cursor, and OpenCode, MIT licensing, installer tests, and release guidance. Reference those artifacts for packaging patterns; do not copy unrelated skill behavior. This handoff creates a local open source package. Publishing a public remote is deferred.

## Artifact contract in each target project

- `docs/requirements/README.md`: short current overview of user groups, their goals, and links to journeys. No introduction, change history, implementation plan, or source bibliography.
- `docs/requirements/journeys/<slug>.md`: one short current document per user journey. Each states a stable requirement ID, actor, goal and user value, entry point, ordered user actions and visible system responses, success result, and meaningful failure and recovery. Name screens only when that helps a reader understand what the user sees or does. Keep engineering details and minor visual choices out.
- `docs/requirements/non-functional.md`: current measurable quality constraints such as accessibility, performance, reliability, privacy, or visual standards. Give each constraint a stable ID and a measurable condition or an explicitly unresolved measure. Put a meaningful user interaction outcome in a journey even when a related measurable standard also appears here.
- `docs/requirements/evidence.md`: source records with stable IDs, provenance, date accessed where relevant, finding, confidence or uncertainty, and links to the requirement IDs they support. Current requirements may cite evidence IDs tersely. Do not copy secrets or sensitive personal information.
- `docs/requirements/ledger.md`: one history file, grouped by local `YYYY-MM-DD` date, newest date first. Use stable entry IDs. An accepted update records its decision and reason, affected requirement IDs, and before/after user behavior or quality condition. Record additions and removals. Entries are logically immutable; new entries under an existing date may be inserted in that date group. Exploratory questions and rejected ideas do not become entries unless needed to explain an accepted change.
- Machine-readable integrity metadata may accompany these documents. It must identify the current document set and revision, bind it to the latest ledger entry, and contain hashes sufficient to detect untracked edits. Its exact format is an implementation choice. It must not make the human-readable requirements longer.

The requirements and nonfunctional documents show the latest confirmed state, not dated snapshots. The ledger carries earlier accepted states. The baseline of an existing project is one entry with inspected sources, initial scope and known gaps, `before: no maintained requirements`, and `after: baseline requirements`; it does not invent prior product history. A new product's first confirmed requirements also create one baseline entry.

## Skill behavior

1. On first use, inspect the target project broadly enough to discover its users and meaningful flows: code, UI, tests, existing docs, configuration, and runnable behavior where practical. For a new product, elicit the same information from the user. Record inspected sources and gaps. Targeted external research should use relevant primary sources when a material claim needs verification. Ask the user about actual workflows and priorities; never treat inference as an agreed requirement.
2. On later use, read the current documents and ledger, inspect relevant project changes, and report possible drift. Code and observed UI show current behavior; old docs and user statements provide other evidence. Investigate conflicts and ask the user to confirm intended behavior. Do not silently promote changed code into product intent.
3. Ask questions that change actor goals, flow, success, recovery, scope, or meaningful quality thresholds. Defer cosmetic details. Keep confirmed decisions distinct from unresolved claims. If a material behavior or research claim remains unresolved, preserve confirmed work as a reviewable draft and withhold final status.
4. Present the concise proposed current state and material changes for user confirmation. After confirmation, update current documents and add exactly one ledger entry per accepted change, or one baseline entry on first use. Validate the whole proposed set before replacing the last valid canonical set. If validation fails, retain that last set and show the draft and concrete errors.
5. The target project needs Git for final status. If Git is absent, produce a reviewable draft and explain the missing history guarantee. The skill writes and validates; the caller decides when to commit. The validator reports uncommitted output separately. A committed history check must detect a committed requirements revision without its ledger update, or a ledger update without its corresponding current-state metadata. A script cannot prove that prose reflects the latest real product behavior; the skill's inspection and user confirmation cover that semantic gap.

## Deterministic checks and human review

Package runnable scripts with the installed skill, usable against a target project without copying development-only tooling there. Provide a documented check command and an update or staging mechanism that keeps the canonical set intact on failure. Checks should reject missing required files or fields, malformed dates and IDs, duplicate IDs, broken journey/evidence/ledger references, invalid newest-first date grouping, a mismatch between current-document hashes and integrity metadata, and a mismatch between the current revision and latest ledger entry. Include Git-aware checks of committed revisions and clear diagnostics for missing Git or uncommitted changes. Define the precise historical invariant in the implementation so fixtures can prove it; do not claim that a local hash alone proves append-only history.

A separate human review checklist asks whether each requirement states user value, makes the user flow and recovery understandable, is short, avoids introductions/history/implementation detail, and defers minor UI choices. Scripts may enforce simple syntax or length budgets but must not claim to prove semantic quality.

## Distribution and scope

Match the local `my-dev-skills` pattern for a single explicitly invoked skill on Claude Code, Codex, Cursor, and OpenCode. Include MIT license, README with local installation and use, agent metadata, packaged scripts and references, test fixtures, and release guidance. Validate that installation carries every runtime file. A public GitHub release, remote publication, integrations with external accounts, and automatic commits are outside this handoff.

## Acceptance criteria and public test seams

| Observable outcome | Public test seam |
| --- | --- |
| A user can install and invoke `requirements` in each of the four agents, and its scripts are present. | Real installer fixture and agent discovery metadata checks. |
| First use on an existing project yields short current journey docs, separate nonfunctional and evidence docs, and exactly one baseline ledger entry after user confirmation. | Skill invocation against a small fixture project; inspect public output files. |
| First use on a new product can elicit actor, goal, flow, result, and recovery without an existing codebase. | Skill scenario evaluation with a new-project prompt and inspect output files. |
| Later accepted additions, edits, and removals change the latest docs and create dated entries with reason, affected IDs, and before/after behavior. Unconfirmed code drift does not silently change docs. | Skill scenario evaluation plus before/after file inspection; validator CLI on fixtures. |
| Unverified material claims, unresolved conflicts, or missing Git leave reviewable drafts and no final status. | Skill scenario evaluation with conflicting evidence, missing source, and no-Git fixtures. |
| Bad IDs, references, dates, hashes, revision links, and incomplete paired updates fail with actionable messages; valid current state passes. | Public validator CLI with positive and negative fixtures. |
| Failed validation leaves the last valid canonical set byte-for-byte intact and exposes the rejected draft. | Public update/staging command with a deliberately invalid candidate. |
| Committed history checks detect missing paired updates and rewritten historical entries where Git history exposes them; uncommitted output is reported without a false historical guarantee. | Validator CLI against temporary Git repositories with staged commit sequences. |
| Reviewers can judge user value and brevity without technical implementation text or invented confidence claims. | Documented human review checklist and representative output examples. |

## Risks and deferred decisions

Automated checks cannot establish that a user flow is useful, complete, or the latest intended behavior. Whole-project inspection may be costly or impossible for very large or inaccessible systems; the skill must state gaps and ask about material uncertainty. Git can reveal committed changes but cannot attest to uncommitted history or prevent force rewriting a remote. Exact integrity file schema, CLI names, and document length thresholds are implementation choices, provided the artifact contract and observable checks above hold.

## Fresh-session handoff

Read this entire spec and inspect the current workspace before implementation. In a new session, invoke `$implement` with `docs/specs/2026-09-25-requirements-skill.md`. Implement the confirmed behavior and verify the acceptance criteria at their public seams.
