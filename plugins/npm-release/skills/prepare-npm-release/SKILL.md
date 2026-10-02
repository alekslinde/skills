---
name: prepare-npm-release
description: Get a JavaScript or TypeScript package ready to publish to npm safely, by auditing the repository against the mistakes that cost a permanent version number, asking the owner only what the code cannot answer, then fixing what it found and walking the release. Use when someone is about to publish a package for the first time, wants a pre-publish or release-readiness check, is setting up a new library repo, is wiring npm trusted publishing or provenance or staged releases, or is debugging a release that failed with a 404, EUNSUPPORTEDPROTOCOL, a missing attestation or a green build that shipped a broken package.
---

# Prepare an npm release

Work in four phases, in order: **audit, ask, recommend, apply**. Never publish,
tag, stage, approve or push anything before the owner approves that specific
action.

This skill targets npm and pnpm publishing to a registry. Rules in
`references/rules.md` are tagged `[any]`, `[npm]`, `[pnpm]` or `[changesets]`;
a rule tagged for a toolchain the project does not use is one to skip. Say
which tag applies when you cite a rule, because most publishing advice is
written for one toolchain without saying so.

## What this is protecting against

A published version can never be replaced, and npm restricts unpublishing after
72 hours. Everything the audit checks ships into that. State this once, early:
the cost of a mistake here is a burnt version number and a migration note, not
a revert.

The shape of a correct release, independent of toolchain:

```
commit → CI (build, lint, test, smoke-test the BUILT artifact)
       → tag or version PR
       → workflow STAGES a tarball        ← no human can skip this
       → maintainer approves with 2FA     ← no workflow can skip this
       → installable
```

Two properties do the work, and both belong in the recommendation:

1. **CI tests the built output, not just the source.** A green unit suite says
   nothing about whether `exports`, `.d.ts` or a bin entry survived the build.
2. **No single actor can publish alone.** CI only stages; a human cannot build
   the artifact. A mistyped tag then costs a staged tarball you discard.

## Verify version claims before relying on them

Several rules depend on tool versions, and those rot. Each dated claim in the
references carries `Checked: YYYY-MM`; anything over a year old is a claim, not
a fact. Before citing one, check it:

- `npm -v` for what the owner has, and `node -v` for what bundles it. Node
  bundles its own npm, so never infer npm's version from Node's.
- `npm help stage` for whether staging exists in the installed npm.
- <https://endoflife.date/nodejs> before recommending any `engines.node` floor.

Where a check contradicts a dated claim, trust the check, tell the owner the
reference is stale, and say so in the recommendation.

## Phase 1: Audit

Read the repository before asking anything. Run the bundled checker first:

```bash
node <skill-dir>/scripts/check.mjs <repo-path> [package-dir ...]
```

It is read-only and dependency-free. It decides the mechanical half — whether a
claim in one file contradicts a fact in another — and prints what is still a
human judgement. It discovers packages under `packages/`, falls back to a
publishable root manifest, and takes explicit directories for any other layout.
It exits non-zero on failure, so it can also gate a release later.

Then cover what a script cannot, following `references/audit.md`:

1. **What ships, and whether this is a first publish.** Each publishable
   manifest, its name and scope, and `npm view <pkg> version` for each (a 404
   means the name is free and the first publish is manual by necessity).
2. **The packed tarball**, not the manifest in the editor. `npm pack`, then
   read the packed `package.json`: `exports` pointing at built output, zero
   `workspace:` specifiers, `README.md` and `LICENSE` present, `engines.node`
   as intended. This is where the permanent mistakes are visible.
3. **Whether CI tests the built artifact** and whether its smoke suite asserts
   anything worth asserting — and whether it skips visibly when no build is
   present, so a fresh clone is not blocked but a silent pass is impossible.
4. **The release workflow**: what triggers it, whether it stages or publishes,
   its Node version, whether a long-lived token is present, whether
   `--provenance` is passed at the call site, and its concurrency settings.
5. **Build order.** Whether a clean clone builds — stale `dist/` hides
   build-order bugs that only appear in CI.
6. **Inter-package dependencies** and the publish order they imply.
7. **Settings outside the repo**, which the owner must confirm because nothing
   in the clone reveals them: npm 2FA, the scope's existence, the trusted
   publisher's fields, and the absence of an `NPM_TOKEN` secret. These do not
   fail until a release does.

Report what you found as one short table before the first question: per
package, its name, current version, whether it is published, and the failing
checks by rule.

## Phase 2: Ask

Ask only what the audit left open. Use the AskUserQuestion tool when available:
at most four questions per call, two to four options each, the recommended
option first and labelled "(Recommended)", and a description on every option
saying what choosing it means in practice. Without it, ask in plain text,
numbered. Explain any term the owner may not know (provenance, trusted
publishing, staging, the workspace protocol) in a sentence before asking.

Skip anything the audit answered, and word the rest around what you found.

### Permanent choices

- **Is the name final**, including scope? Renaming after publishing is a
  breaking change for every consumer plus a migration note. Both a rename and a
  move into `packages/` are free before the first publish and cost a release
  afterwards (→ R18).
- **Which Node versions are supported?** The claimed floor must be what CI
  tests and must not be EOL. Widen the matrix first, then the range — never the
  other way round (→ R11, R11a).
- **Public or restricted**, and is the scope's org created?

### Release model

- **Stage and approve, or publish from CI directly?** Recommend staging and
  explain the tradeoff plainly: it costs a manual 2FA approval per release and
  removes the case where one workflow run can put something permanent in front
  of users (→ R5).
- **Trusted publishing (OIDC) or a token?** Recommend OIDC; it needs a new
  enough npm in the release job and no token at all (→ R1).
- **Provenance?** Recommend yes, requested at the call site *and* in the
  manifest, so a manifest edit cannot silently drop the attestation (→ R3).
- **Who versions and tags** — a release tool, or by hand? If the project
  already has a versioning model, work within it rather than proposing another.

### First publish, if the package is unpublished

- **Publish from the main branch or from the feature branch?** Provenance names
  the commit it was built from, so publishing from an unpushed branch attests a
  commit nobody can fetch. But merging first makes any public claim about the
  package live before the package exists. Neither is wrong; make the owner pick
  knowingly (→ `references/first-publish.md`, step 2).

### New repository, if there is nothing yet

- **Monorepo or single package**, and which package manager and release tool?
  `references/scaffold.md` has the decisions to settle before any code is
  written, because each is free now and costs a release later.

## Phase 3: Recommend

Present, in this order:

1. **One table, one row per failing check:** the rule, what is wrong, what it
   costs if shipped, and the fix.
2. **The release flow you are proposing**, as a short numbered list, from
   commit to installable.
3. **What must happen by hand**, and why each step cannot be automated: the
   first publish (a trusted publisher can only attach to a package that already
   exists), the 2FA approval, any store or dashboard step.
4. **The order of work**, permanent-if-wrong items first.
5. **Settings the owner must change themselves**, as a checklist they can tick
   off — nothing here is in version control.
6. **Open questions** that remain.

Ask for approval. Adjust and re-present if the owner changes anything.

## Phase 4: Apply (only after approval)

Follow `references/apply.md`. Fix the audit's findings first, verify each fix,
then walk the release itself from `references/first-publish.md` (first release)
or the staged loop in `references/apply.md` (every release after).

Three rules hold throughout:

- **Verify each fix by breaking the thing.** A publish-readiness check that
  passes against a broken manifest is worse than none — it reports a safety it
  never checked. Break it, confirm the failure is for the reason you expect,
  restore (→ R15).
- **Prefer a check to a promise.** Where a rule can be encoded as a test or a
  CI step, encode it instead of writing a note asking someone to remember
  (→ R17).
- **Never run the irreversible step yourself** without the owner's explicit
  go-ahead for that action: `npm publish`, `npm stage approve`, `git push
  --tags`, or anything that creates a release. Prepare it, show the exact
  command, and let the owner run it or say go.

When a release fails, read `references/rules.md` for the symptom — the table of
failures there is keyed by what the owner actually sees (a bare 404,
`EUNSUPPORTEDPROTOCOL`, a missing attestation, a green build that shipped a
broken package), because the message rarely names its cause. Debug a publish
404 in this order: trusted-publisher fields, then the release job's Node and
npm version, then the package manager's version.
