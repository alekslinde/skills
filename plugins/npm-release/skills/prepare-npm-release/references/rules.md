# Rules

Every rule, with the symptom that reveals it. Search the symptom if something
is failing; read top to bottom if you are setting up.

Tags say what a rule depends on: `[any]` · `[npm]` · `[pnpm]` · `[changesets]`.
A rule tagged for a toolchain the project does not use is one to skip.

Version-dependent claims carry `Checked: YYYY-MM`. Anything over a year old is
a claim, not a fact — verify it against the installed tool before relying on
it.

## Symptom index

| What the owner sees | Rule |
| --- | --- |
| Bare **404** on publish, for a package that exists | R1 |
| Every install fails with `EUNSUPPORTEDPROTOCOL` | R2 |
| `402 Payment Required` | R8 (scoped package defaulting to restricted) |
| `403 Forbidden` | name taken, or 2FA not satisfied |
| No attestation on the registry page | R3 |
| `ERR_PNPM_INVALID_VERSION_BUMP` on a correct-looking workflow | R6 |
| A companion installs, then cannot resolve its own dependency | R6a |
| Green suite, unusable package | R12 |
| `ERR_MODULE_NOT_FOUND` on a consumer's first import | R12 |
| `TS2835` for a consumer on `nodenext` | R12 |
| Green locally, red on a clean checkout | R9 |
| CI fails before reaching any of your code | R10 |
| An install that succeeds and fails later, as someone else's bug report | R11 |
| A published `exports` map pointing somewhere impossible | R19 |
| Release tags exist on the runner, nowhere else | R20 |
| No source link on the npm page | R8 |
| Underscore-prefixed files missing from a deployed site | R22 |

---

## Publishing

### R1 — Release jobs need a new enough npm for OIDC `[any]`
**Symptom:** bare **404** on publish, for a package that exists. Not an auth
error — a 404.

Trusted publishing exchanges the Actions OIDC token for a short-lived
credential. That needs npm ≥ 11.5.1, and Node 22 bundles npm 10.x. On an old
npm no exchange happens and the PUT goes out unauthenticated; the registry
answers 404, which reads as "package missing" rather than "credential
missing".

Three separate layers produce the same 404. **Debug in this order:**

1. Trusted-publisher fields (owner, repo, workflow filename, environment)
2. Node and npm version in the release job
3. Package-manager version — pnpm below 11.1.3 sent the literal
   `${NODE_AUTH_TOKEN}` placeholder from the `.npmrc` that `setup-node`
   writes `[pnpm]`

**Rule:** release job on Node 24+, `registry-url` set on `setup-node`,
`id-token: write`, and no `NODE_AUTH_TOKEN` at all.

*Checked: 2026-10.*

### R2 — `workspace:` never reaches a tarball `[any]`, bites hardest `[npm]`
**Symptom:** every install fails with `EUNSUPPORTEDPROTOCOL`.

pnpm rewrites `workspace:*` to a real range on publish. **npm does not** — it
ships the literal string, with no warning. The exposure is asymmetric: on pnpm
this is handled, on npm it is yours to get right. Mixing them is worst of all,
because a companion published once with `npm publish` in an otherwise-pnpm
repo looks correct in every local check.

On npm workspaces, write real semver ranges between your own packages and let
the publish order enforce them (→ R6a).

**Rule:** publish with the tool that owns the workspace, and inspect the packed
manifest before the first release:

```bash
npm pack --workspace <pkg> --pack-destination /tmp/x
tar xzOf /tmp/x/*.tgz package/package.json | grep -c "workspace:"   # want 0
```

A `*` range has the same problem for a different reason: it publishes a range
that cannot resolve.

The fix after the fact is a version bump with no source change, because
versions are immutable.

### R3 — Ask for provenance at the call site `[any]`
**Symptom:** no attestation on the registry page, while a comment in the repo
claims there is one.

`NPM_CONFIG_PROVENANCE` is not read by every tool, and some publish wrappers
build a fixed argument list that cannot forward `--provenance`.

**Rule:** pass `--provenance` explicitly **and** set
`publishConfig.provenance: true`. Belt and braces, because the manifest alone
can be edited away silently. Provenance also requires `repository` in the
manifest (→ R8), and a CI identity — it cannot be generated on a laptop.

### R5 — Stage; let a human approve `[any]`
**Symptom:** none. This is the rule with no symptom until the day it matters.

A version on npm cannot be replaced and unpublishing is restricted after 72
hours. If CI can publish, a mistyped tag is permanent.

**Rule:** CI stages, a maintainer approves with 2FA.

```bash
npm stage publish --workspace <pkg> --provenance   # in CI
npm stage list && npm stage approve <id>           # by hand, with 2FA
```

Leave "Allow npm publish" **unchecked** on the trusted publisher, or the gate
can be bypassed. Merging reviews the change; approving reviews the artifact.

`npm stage` exists in npm ≥ 12 and takes `--workspace` and `--provenance`.
Confirm with `npm help stage` before recommending it. *Checked: 2026-10.*

### R6 — Don't name a script after a builtin `[pnpm]`
**Symptom:** `ERR_PNPM_INVALID_VERSION_BUMP`, on a workflow that looks correct.

`pnpm version` is a builtin and shadows a script of the same name.

**Rule:** name it `version:packages`, and invoke scripts with `pnpm run <name>`
everywhere. npm has no equivalent shadowing, so this is pnpm-only.

### R6a — Publish order follows the dependency graph `[any]`
**Symptom:** a companion installs, then fails to resolve its own dependency.

A package depending on its sibling by version range needs that version **on the
registry** first. A *staged* sibling does not count: `npm view` only sees
published versions.

**Rule:** core first, approve it, then companions. Put the check in the
companion's workflow so the ordering is enforced rather than remembered:

```bash
npm view "<dependency>@<range>" version   # must print something
```

### R7 — Queue releases, never cancel them `[any]`
```yaml
concurrency: { group: release, cancel-in-progress: false }
```

Cancelling a run that may be mid-publish is how a set half-releases.
`cancel-in-progress: true` is right for CI and Pages, wrong here.

### R8 — Manifest metadata is not optional `[any]`
**Symptom:** no source link on the npm page; provenance refuses to generate;
`402 Payment Required` on a scoped package.

**Rule:** `repository` (with `directory` in a monorepo), `homepage`, `bugs`,
`license`, and `publishConfig.access: "public"` for a scoped package — a scoped
package defaults to restricted, and restricted on a free org fails with 402.

Update `repository.directory` when a package moves; it goes stale silently.

Every path in `files` must exist: a listed file that does not is absent from the
tarball with no warning, which is how a package reaches the registry with no
readme.

### R19 — A rewritten manifest must be restored `[any]`
**Symptom:** a published `exports` map pointing somewhere impossible.

Only applies if `prepack` rewrites the manifest, a common way to resolve source
in-repo and `dist/` on the registry. A pack killed between `prepack` and
`postpack` leaves the rewritten file on disk, and the next publish ships a
doubly-rewritten manifest.

**Rule:** `git diff --exit-code -- <pkg>/package.json` after packing, in CI.

### R20 — Tags must be pushed `[changesets]`
**Symptom:** release tags exist on the runner, nowhere else.

`changeset git-tag` tags locally; the action only pushes tags in its own publish
flow, which a staging flow bypasses.

**Rule:** `… && changeset git-tag && git push --tags`. Use `--tags`, not
`--follow-tags`, so the step can never push a commit to the main branch.

---

## CI

### R11 — `engines.node` must equal what CI tests `[any]`
**Symptom:** an install that succeeds and fails later, as someone else's bug
report.

**Rule:** the claimed floor appears in the CI matrix. Widen the matrix first,
then the range — never the other way round.

### R11a — Check the floor is still alive `[any]`
A claim written once keeps being published. Check
<https://endoflife.date/nodejs> when you touch `engines`.

As of **2026-10**: Node 18 EOL April 2025, Node 20 EOL April 2026, Node 22 EOL
April 2027, Node 24 EOL April 2028. Check the live dates rather than trusting
this line.

A `>=18` claim written in 2024 covered two dead runtimes by late 2026. Narrow
it rather than back-filling tests nobody will act on — `engines` is advisory
(npm warns, it does not refuse), so a reader on an older runtime is informed,
not blocked.

### R10 — The Node floor is the toolchain's, not the library's `[any]`
**Symptom:** CI fails before reaching any of your code.

pnpm 11+ imports `node:sqlite` (Node ≥ 22.13), so a Node 20 matrix entry dies
in the package manager. The library's own floor is irrelevant if the tool
cannot start. *Checked: 2026-10.*

### R12 — Unit tests cannot catch a broken build `[any]`
**Symptom:** green suite, unusable package.

Suites run on `src/`. A bad `exports` map, a dropped export, a `.d.ts` full of
extensionless imports, a non-executable bin — all invisible from source.

**Rule:** a smoke suite that imports `dist/` through the real resolver and
asserts headline behaviour. Make it skip **visibly** without a build, so a
fresh clone is not blocked but a silent pass is impossible. Build it in CI, or
it never runs there. Import the barrel **and** a subpath: a subpath export
resolves differently and is the half that breaks.

Three ways a build has shipped broken *while reporting success*:

- emitted JS keeping extensionless imports — `ERR_MODULE_NOT_FOUND` on a
  consumer's first import
- declarations keeping them too — `TS2835` for any consumer on `nodenext`
- a file-per-module build emitting declarations with no JavaScript behind them,
  because `bundle: false` splits per *entry*, not per module in the graph

### R9 — Build dependencies before linting or testing `[any]`
**Symptom:** green locally, red on a clean checkout.

A companion resolving the core through its *built* types works locally only
because stale `dist/` is lying around.

**Rule:** CI order is install → build → lint → test. Test from a clean clone.
**Read the first error, not the loudest** — a downstream "property does not
exist" is usually a cascade from an unresolved import.

### R13 — Pin transitive advisories where the tool reads them `[pnpm]`
pnpm 11 reads `overrides` from `pnpm-workspace.yaml`, **not** `package.json`.
npm reads `overrides` from `package.json`. Comment each override with the
advisory and the condition for removing it. A caret does not cross a 0.x minor,
so a 0.x transitive pin needs an override rather than a bump.

### R14 — Allow only the build scripts you use `[pnpm]`
pnpm blocks postinstalls unless listed. Allow explicitly (`esbuild: true`),
deny explicitly with a reason (`@parcel/watcher: false`).

---

## Tests

### R15 — Verify a test by breaking the thing `[any]`
**Symptom:** none, which is the problem.

A test can pass for a reason unrelated to what it claims. A boundary test has
passed because of a different code path entirely, while the real bug shipped
under a green suite.

**Rule:** break the specific thing, confirm the test fails **for the reason you
expect**, restore. Assert against real data — the actual fixture, not an
assumed one.

Two shapes worth knowing:

- **Vacuous iteration.** `for (const x of items.filter(cond))` passes while
  checking nothing once the filter is empty, which happens the day the last
  matching item ships. Assert the set is non-empty, or assert over everything.
- **Scope too narrow.** A check reading only between two markers misses a value
  built outside them and passed in. If a mutation reinstating the bug survives,
  the test is decorative.

### R16 — Test the API boundary `[any]`
Off-by-one and `NaN`/`Infinity` cases live at the edges: a non-positive `limit`
returning one result because the push happened before the cap check; an
aggregate returning `Infinity` on empty input. Test `0`, negative, empty and
single-element for every option.

### R17 — Siblings change together `[any]`
**Symptom:** a footer saying MIT while the licence is Apache-2.0.

Documented state drifts from real state silently. When one doc changes, change
its siblings in the **same** change: README, site, CONTRIBUTING, agent
instructions, manifest.

Prefer a check to a promise. A test comparing a README's claims to the code is
worth more than a note asking someone to remember. None of these drifts fail
anything — they are found by a reader who then trusts the rest of the
documentation less.

### R18 — Choose name and layout before writing code `[any]`
Renaming to a scope changes peer deps, bundler externals, every import, install
snippets and site links. Moving a package into `packages/` changes
`repository.directory`. Both are free on day one and cost a release afterwards.

---

## Site and generated files

### R21 — Generated artefacts drift `[any]`
If a generated file is committed, CI must rebuild it and `git diff --quiet` to
warn. Gitignore compiled CSS entirely. List generated paths under an **Off
Limits** heading in the project's agent instructions so nothing hand-edits
them.

### R22 — GitHub Pages specifics `[any]`
- Pages → Source → **GitHub Actions**, or the deploy job fails.
- `.nojekyll`, or underscore-prefixed files vanish silently.
- Assemble the output directory from an **explicit file list** — never upload a
  folder containing `node_modules`, sources or manifests.
- Project sites live under `/<repo>/`: relative asset paths only.
- Filter the workflow on source paths with a glob, so new packages are covered
  without editing it.
- Tailwind v4: `@apply` cannot reference custom classes.

### R23 — Keep the site out of a published package `[any]`
A demo site inside the published package drags its dependencies, tsconfig and
manifest along. Make it a separate private package from the start.

### R24 — Define design tokens before building components `[any]`
Roughly ten commits of piecemeal polish — spacing, radius, nav, theme toggle —
is what skipping this costs. Decide radius, spacing and colour (light **and**
dark) first. Test at 320px in both themes before committing.

---

## Process

- **Commit small, explain why.** Conventional commits, subject under 50
  characters. The body carries the reasoning.
- **Comment the fragile line.** Every line that breaks something when changed
  (the release job's Node version, the deliberately absent token, `pnpm run`)
  says what breaks.
- **Document what lives in settings.** Trusted publisher, Pages source, npm
  scope — none are in the repo, so none fail until a release does. List them in
  `CONTRIBUTING.md`.
- **Treat every repo as public.** No absolute paths, usernames, internal hosts,
  or notes about unfixed weaknesses — in files, comments or commit messages.
