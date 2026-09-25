---
name: requirements
description: Discover user needs and maintain concise, traceable product requirements in a software project.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
---

# Requirements

Maintain the project's current, confirmed user requirements. Invoke this skill explicitly when starting a product or revisiting an existing one. The deliverable is a small `docs/requirements/` set that explains who uses the product, what they do and see, the value they receive, and recovery from important failures. Favor user value and convenience. Leave cosmetic choices until they change a meaningful interaction.

## Discover before proposing

On first use in an existing project, inspect code, UI, tests, docs, configuration, and runnable behavior where practical. Map actors and meaningful journeys. Ask the user how people actually complete those flows, where the observed behavior differs, and which outcomes have priority. Record the sources inspected and gaps; do not infer a requirement merely from code. For a new product, elicit actor, goal, entry point, ordered actions and visible responses, success, and recovery from the user. Ask about priority and scope. Research a material external claim with relevant primary sources when needed; record provenance, date accessed where relevant, and uncertainty. Never copy secrets or sensitive personal information into these documents.

On later use, first read every current requirement file, integrity metadata, and the ledger. Inspect relevant code and UI changes since the documented revision and report possible drift. Code and observed behavior show what exists; the user's confirmation establishes what is intended. Investigate contradictions between those sources. Never silently adopt changed code as a requirement or silently revert a confirmed requirement because code differs.

Ask only questions that could change actor goals, flow, outcome, recovery, scope, or meaningful quality thresholds. Keep confirmed decisions separate from hypotheses. State inspection gaps and unresolved material claims plainly. If material uncertainty remains, keep the confirmed work in a reviewable draft and withhold final status. Do not invent confidence.

## Draft the current state

Prepare a candidate directory outside the canonical `docs/requirements/` directory. Use the format and integrity rules in [integrity.md](references/integrity.md). The candidate contains the complete proposed set, including metadata and ledger. Run `node <installed-skill>/scripts/requirements.mjs stamp <candidate-directory> <latest-ledger-id>` after editing its documents to produce the hash metadata. Keep current documents short:

- `README.md`: user groups, goals, and links to journeys only. Omit an introduction, history, plan, and bibliography.
- `journeys/<slug>.md`: one journey per file, with stable requirement ID, actor, goal and user value, entry point, ordered user actions paired with visible system responses, success result, and meaningful failure and recovery. Name a screen only when it clarifies what a user sees or does. Avoid engineering details and minor visual choices.
- `non-functional.md`: stable IDs and measurable quality conditions, or an explicitly unresolved measure. Put a meaningful interaction outcome in a journey even when a related standard is also here.
- `evidence.md`: stable source IDs, provenance, access date where relevant, finding, confidence or uncertainty, and supported requirement IDs. Current requirements may cite evidence IDs tersely.
- `ledger.md`: one history file with local `YYYY-MM-DD` date groups, newest first, and stable entry IDs. Record each accepted addition, edit, or removal once, with decision, reason, affected IDs, and before/after user behavior or quality condition. Entries are logically immutable. A new entry may join today's existing group.

For an existing project, the first confirmed set gets exactly one baseline ledger entry: inspected sources, scope, known gaps, `before: no maintained requirements`, and `after: baseline requirements`. Do not invent earlier product history. The first confirmed set for a new product also gets one baseline entry. Later accepted changes get one entry per distinct decision; do not put exploratory or rejected ideas in the ledger unless they explain an accepted change. Preserve stable IDs across edits and document removals in the ledger.

Use [example.md](references/example.md) as a shape example, not as a source of product facts. Apply the [human review checklist](references/review.md) to every proposed set.

## Confirm, validate, and apply

Present the concise proposed current state and each material change to the user. Obtain explicit confirmation before changing the canonical set. Silence is not confirmation. If the project has no Git repository, keep the candidate as a reviewable draft and explain that committed history checks are unavailable; do not claim final status. Likewise, unresolved material behavior or research claims remain drafts even when some other decisions are confirmed.

After confirmation, apply the **whole** candidate using the packaged script from this installed skill:

```sh
node <installed-skill>/scripts/requirements.mjs apply <target-project> <candidate-directory>
node <installed-skill>/scripts/requirements.mjs validate <target-project>
```

The candidate directory is a complete `docs/requirements` tree, with `README.md` at its root. The `apply` command validates before replacing canonical files and retains a rejected candidate for review. Do not manually copy a failed candidate over the last valid set. Revalidate the target after apply. The checker reports uncommitted output separately. The caller chooses whether and when to commit; this skill never commits automatically.

The script checks document structure, IDs, dates, references, hashes, metadata revision links, and observable Git history constraints. It cannot prove that prose is useful, that the inspected behavior is the latest product intent, or that uncommitted changes have an append-only history. Your investigation, user confirmation, and human review address those gaps. Report the changed files, accepted decisions, validation result, uncommitted status, and any remaining inspection gaps.
