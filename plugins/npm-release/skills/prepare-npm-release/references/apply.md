# Applying the fixes

Only after the owner approves. Fix in the order below — permanent-if-wrong
first, so the expensive mistakes are closed before anything is published.
Verify each fix before moving on, and keep the project's existing release path
working until the new one has shipped once.

## Order of work

1. **Name, scope and layout**, if either is changing. Do this before anything
   else: a rename touches manifests, peer dependencies, bundler externals,
   every import, install snippets and site links, and `repository.directory`
   for a move (→ R18). After the first publish it is a breaking change.
2. **Manifest metadata** — `repository` (with `directory`), `homepage`, `bugs`,
   `license`, `publishConfig.access` for a scoped package,
   `publishConfig.provenance` (→ R8, R3). Confirm every path in `files` exists.
3. **Dependency specifiers** — no `workspace:` and no `*` in anything that will
   be published; real semver ranges between in-repo packages on npm workspaces
   (→ R2).
4. **`engines.node`**, narrowed to what CI tests and nothing EOL. Widen the CI
   matrix first, then the range (→ R11, R11a). Check
   <https://endoflife.date/nodejs> rather than any dated table.
5. **CI**: order install → build → lint → test (→ R9); add a smoke suite
   against `dist/` that skips visibly without a build (→ R12).
6. **The release workflow**: Node 24+, `registry-url`, `id-token: write`, no
   token (→ R1); stage rather than publish (→ R5); `--provenance` at the call
   site (→ R3); `cancel-in-progress: false` (→ R7); push tags explicitly if the
   release tool only tags locally (→ R20).
7. **Encoded checks** for what the audit found, so it cannot regress — see
   "Lock it in" in `audit.md`.
8. **Docs**: `CONTRIBUTING.md` gains the settings that live outside the repo,
   because nothing in the clone reveals them and none of them fail until a
   release does.

## Verifying a fix

Every fix gets verified the same way, and a check gets verified by breaking
what it checks:

- **Mutation.** Reintroduce the fault, confirm the check fails **for the reason
  you expect**, restore. A publish-readiness check that passes against a broken
  manifest reports a safety it never checked (→ R15).
- **The tarball, not the manifest.** For anything that affects what ships,
  `npm pack` and read the packed `package.json`. The file in the editor is not
  the file that is published (→ R19).
- **A clean clone.** For anything affecting build order, `rm -rf node_modules
  */*/dist` and run the full sequence. Stale `dist/` hides exactly the bug CI
  will find (→ R9).
- **The checker.** `node <skill-dir>/scripts/check.mjs <repo>` after each
  batch; it exits non-zero, so it can also become a CI gate.

Read the first error, not the loudest — a downstream type error is usually a
cascade from an unresolved import.

## What you never run unprompted

Ask for the owner's explicit go-ahead for each of these, every time. Prepare
the command, show it, and let them run it or say go:

- `npm publish`, `npm stage publish`, `npm stage approve`
- `git push --tags`, creating or moving a tag, creating a GitHub Release
- `npm unpublish`, `npm deprecate`
- Anything that changes npm account, org or trusted-publisher settings — the
  owner does these in the dashboard; your job is the exact field values

Never move, delete or reuse an existing tag. Never bump a version as a side
effect of other work.

## The release loop, once set up

1. Record the change for the release tool, or bump by hand if that is the model
2. Merge → the tool opens a version PR; the owner reviews the bump
3. Merge it → CI builds, tests, **stages** the tarball, pushes tags
4. The owner approves with 2FA:

```bash
npm stage list
npm stage approve <id>
```

5. Confirm it is real, from the registry rather than a path:

```bash
npm view <pkg> version
cd "$(mktemp -d)" && npm init -y && npm install <pkg>
node -e "import('<pkg>').then(m => console.log(Object.keys(m)))"
```

For several packages, approve in dependency order and confirm each dependency
resolves before approving its dependent — a staged package is invisible to
`npm view` (→ R6a).

## Report back

Tell the owner, concisely: what was fixed and where, what is now enforced by a
check rather than a note, what remains manual and why, which settings are
theirs to change, and anything the audit could not judge.
