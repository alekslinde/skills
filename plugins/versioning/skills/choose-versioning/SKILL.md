---
name: choose-versioning
description: Work out how a project should version, tag and release each of its parts, by auditing the repository first and then asking the owner only what the code cannot answer, and set it up once approved. Use when someone asks how versioning or releases should work, which version scheme or release tool to adopt, how tags, GitHub Releases, changelogs and deploys relate, how to reach 1.0, or says their release process is a mess.
---

# Choose a versioning and release model

Work in four phases, in order: **audit, ask, recommend, apply**. Never change a
file, tag, release or setting before the owner approves the recommendation.

Hold to these conventions throughout. They are what the recommendation is
judged against, so state the relevant ones when you explain a choice:

- **A version identifies something someone receives.** Version the parts that
  have consumers; a part nobody receives separately needs no version line.
- **One version, one tag.** The tag sits on the exact commit that was built
  and shipped, is annotated, and is never moved, reused or deleted. Each part
  that versions independently gets its own tag prefix.
- **Tags mark versions, nothing else.** Milestones are versions whose notes
  say so; planning toward one belongs in the issue tracker's milestones.
- **Every released version gets notes**, as a GitHub Release, a changelog
  entry, or both. Automation makes this free.
- **Release, then deploy.** A release (tag plus notes) is cut first; publishing
  and deploying follow from it. Deploying "whatever is on a branch" is the
  weaker model.
- **Automate the bump, the tag and the notes.** Hand-typed versions and tags
  are where release processes become a mess.
- **1.0.0 is the owner's decision.** It declares a stable promise. Never
  propose a major bump as a side effect of other work; ask.

## Phase 1: Audit

Read the repository before asking anything, and report what you found as one
short table before the first question.

Find:

1. **Parts that ship separately.** Published packages, hosted apps and APIs,
   mobile and desktop apps, browser extensions, CLIs and binaries, container
   images, workers and functions, docs sites. Use manifests, workspace config,
   build and publish scripts, CI workflows and store-listing files. For each:
   who receives it, through which channel, and whether anyone depends on it
   programmatically (an API, a library, a package range) or only uses it.
2. **Current version numbers** in every manifest, and whether they move
   together or independently.
3. **Tags and releases.** `git tag -l` (fetch tags if the clone is shallow),
   where each tag points (`git branch -r --contains <tag>`), the GitHub
   Releases list, and published versions on each registry or store. Note tag
   formats in use and any that conflict.
4. **How things ship today.** Which workflow or script publishes or deploys
   each part, and what triggers it: a tag, a branch push, a manual dispatch, a
   person. Note deploy branches (`production`, `release`), promotion
   workflows, approval gates, and anything that silently depends on a tag or
   Release existing.
5. **Commit and merge conventions.** Recent commit subjects (Conventional
   Commits or not), merge commits versus squash merges, PR title patterns,
   any commit-message hooks.
6. **Existing docs and changelogs.** `CHANGELOG.md`, release or versioning
   docs, CONTRIBUTING sections about bumping. Note where they disagree with
   what the history shows.
7. **Channel constraints** for each part (see `references/schemes.md`), for
   example store version formats or registry immutability.

## Phase 2: Ask

Ask only what the audit left open. Use the AskUserQuestion tool when it is
available: at most four questions per call, two to four options each, the
recommended option first and labelled "(Recommended)", and a description on
every option saying what choosing it means in practice. Without it, ask in
plain text, numbered. Explain any term the owner may not know (SemVer,
CalVer, Conventional Commits, release PR) in a sentence before asking.

Skip any question the audit answered, and word the rest around what you found
("Your npm package..." rather than "Any packages...").

### Scope and scheme

- Which parts should carry their own version? Offer to drop version lines for
  parts nobody receives separately, and to merge parts that always ship
  together.
- Per part, which scheme fits? SemVer for anything others depend on; CalVer
  for things released on a schedule where compatibility is not the message;
  none (deploy id or commit) for a hosted service with no external consumers.
  See `references/schemes.md`.
- Independent versions per part, or one shared ("fixed") version across
  parts that must always match?

### Stability

- Is each part at 1.0 yet, or still 0.x? Explain what 0.x tells consumers, and
  that package-manager ranges treat a 0.x minor as breaking.
- What would make the owner call it 1.0? Record the answer; do not schedule a
  bump.
- Are pre-releases (`-beta.1`, `-rc.1`) needed before majors?

### Process

- Should bumps come from commit messages (Conventional Commits) or from a
  per-change note (changesets), or stay manual?
- Should a release be cut by merging a release PR (reviewable, on demand) or
  on every merge (continuous)?
- Is switching to squash merges acceptable, so each PR becomes one commit
  whose title drives the version?

### Shipping

- Per part: what should a release trigger (registry publish, store package,
  deploy)? Which steps must stay manual (store uploads, approval gates)?
- For a hosted app with a deploy branch: should the release move the branch,
  should CI deploy the tag directly, or should the branch model stay?
- Hotfixes: release from the main line, or from a maintenance branch?

### History

- Existing tags and Releases stay. Should the new tag prefixes start fresh
  beside them, or continue an existing line?
- Should old Release pages get a line pointing to the new scheme?

## Phase 3: Recommend

Present, in this order:

1. **One table, one row per part:** scheme, starting version, tag format,
   what a release triggers, and what stays manual.
2. **The release flow**, as a short numbered list or a diagram: merge →
   release PR or automatic release → tag, notes, changelog → publish or
   deploy.
3. **Tooling**, with the reason over the alternatives
   (`references/tooling.md`).
4. **The path to 1.0** for each part still on 0.x: what keeps it on 0.x, and
   how the owner cuts 1.0 when they decide to.
5. **What changes** for contributors (commit or PR title format, no more
   manual bumps) and what is retired (promotion workflows, manual tagging).
6. **Migration order**, with each part keeping a working path until its new
   one is proven.
7. **Open questions** that remain.

Ask for approval. Adjust and re-present if the owner changes anything. If the
change is large, offer to write the recommendation up as a document first.

## Phase 4: Apply (only after approval)

Follow `references/implementation.md`. Move one part at a time, starting with
the lowest-risk one, and keep the old path working until the new one has
shipped a release. Verify each step (dry runs, validation commands, the
project's own tests) before committing, and never push tags, create Releases
or publish anything yourself without the owner's explicit go-ahead for that
specific action.
