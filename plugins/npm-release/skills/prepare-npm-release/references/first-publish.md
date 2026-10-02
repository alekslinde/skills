# First publish, by hand

The first release of a package is manual **by necessity**: npm's OIDC trusted
publisher can only be configured on a package that already exists on the
registry — there is no package settings page to attach it to otherwise. That is
a chicken-and-egg step no amount of CI removes. Every release after this one
goes through the pipeline.

Follow this once per package.

**Before starting:** a published version can never be replaced, and after 72
hours it cannot be unpublished either. Step 5 is the last point where a mistake
costs nothing.

Placeholders: `<pkg>` the package name (`@scope/name`), `<dir>` its directory,
`<version>` what is in its manifest.

Never run step 6, 8 or 9 without the owner's explicit go-ahead for that
specific action. Prepare the command, show it, and let them run it or say go.

---

## Step 0 — A new enough npm

```bash
npm -v
```

Needs **≥ 12** for `npm stage`, **≥ 11.5.1** for anything OIDC. Node 22 bundles
npm 10.x and Node 24 bundles 11.x, so check rather than infer from the Node
version. Confirm staging exists with `npm help stage` rather than trusting the
version number alone.

```bash
npm install -g npm@latest
```

The Node version does not matter for a manual publish — only npm's does. The
*workflows* are a separate question (→ R1).

*Checked: 2026-10.*

---

## Step 1 — Account, 2FA, scope

1. `npm login`, then `npm whoami` to confirm.
2. **2FA** on npmjs.com → Account → Two-Factor Authentication →
   **Authorization and Publishing**. Staging approval requires it, and it
   cannot be applied retroactively to a publish that already happened.
3. Scoped package? Create the org first: npmjs.com → **Add an Organization**.
   The free tier covers public packages.

```bash
npm org ls <scope>          # should list the owner
npm view <pkg> version      # 404 means available
```

This is step 1 and not step 5 because the answer can force a rename, and a
rename after publishing is a breaking change plus a migration note (→ R18).

---

## Step 2 — Publish from the branch you want attested

Provenance names the commit it was built from. Publishing from an unpushed
branch produces an attestation pointing at a commit nobody can fetch.

```bash
git checkout main && git pull
git merge <branch>
npm test
git push
```

**The tradeoff to decide deliberately:** if the repo has a public site that
advertises the package, merging makes that claim live *before* the package
exists — a window of however long steps 3 to 7 take. Publishing from the branch
first closes the window, at the cost of an attestation naming a branch commit.

Neither is wrong. Make the owner pick knowingly.

---

## Step 3 — Build and verify

```bash
npm ci
npm run build
npm run typecheck && npm run lint && npm test
node <skill-dir>/scripts/check.mjs .
```

Anything failing here is about to become permanent (→ `audit.md`).

---

## Step 4 — Read the tarball

`npm pack` writes the exact bytes `npm publish` uploads. This is where you
catch what every source-level check cannot.

```bash
npm pack --workspace <pkg> --pack-destination /tmp/pub
tar tzf /tmp/pub/*.tgz | head -20
tar xzOf /tmp/pub/*.tgz package/package.json
```

Confirm, in the **packed** manifest — not the one in the editor:

- `exports` points at built output (`./dist/*.js`), not source. If a `prepack`
  script rewrites this, here is where you find out whether it ran (→ R19).
- No `workspace:` anywhere. npm ships that literal string and every install
  then fails with `EUNSUPPORTEDPROTOCOL` (→ R2).
- `README.md` and `LICENSE` present — a path listed in `files` that does not
  exist is silently absent (→ R8).
- `engines.node` is what the owner intends to support (→ R11).

Then confirm packing left the tree alone:

```bash
git diff --exit-code -- <dir>/package.json && echo clean
```

A diff means a pack died between `prepack` and `postpack`. Restore the file and
pack again, or you publish a doubly-rewritten manifest.

---

## Step 5 — Install the tarball somewhere clean

Three minutes that catch what nothing else does: whether it works when
installed the way a stranger installs it.

```bash
mkdir -p /tmp/trial && cd /tmp/trial && npm init -y
npm install /tmp/pub/<tarball>.tgz

node -e "import('<pkg>').then(m => console.log(Object.keys(m)))"
# a bin? run it:
node node_modules/<pkg>/dist/cli.js --help
```

Import the barrel **and** a subpath, because a subpath export resolves
differently and is the half that breaks.

**This is the last point where a mistake is free.**

---

## Step 6 — Publish, dependencies first

Order follows the dependency graph: a package depending on a sibling needs that
sibling **published** first — a staged one does not count (→ R6a).

```bash
npm publish --workspace <pkg> --access public --provenance=false
```

A 2FA prompt follows.

> **Provenance needs `--provenance=false` here, not just omitting the flag.**
> Provenance is generated from a CI identity (GitHub Actions OIDC) and there is
> not one on a laptop — leaving the flag off can still try to generate it and
> fail. `--provenance=false` publishes with no attestation, which is
> acceptable: step 8 makes every release after it attested.
>
> **Do not drop `--access public`.** A scoped package defaults to restricted,
> and restricted on a free org fails with `402 Payment Required`.

```bash
npm view <pkg> version
```

Repeat for each package, in dependency order, checking the dependency resolves
before publishing its dependent:

```bash
npm view "<dependency>@<range>" version   # must print something
```

---

## Step 7 — Install from the registry

```bash
rm -rf /tmp/real && mkdir -p /tmp/real && cd /tmp/real && npm init -y
npm install <pkg>
node -e "import('<pkg>').then(m => console.log(Object.keys(m)))"
```

From the registry, not a path. This is the first time the real resolution path
is exercised end to end.

---

## Step 8 — Attach the trusted publisher

What retires the manual path. Per package: npmjs.com → package → Settings →
**Trusted publisher**.

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization | the GitHub owner |
| Repository | repo name |
| Workflow filename | **filename only** — `release.yml`, not a path |
| Environment | **empty** |
| Allow npm publish | **unchecked** |

"Allow npm publish" unchecked is what forces staging. Checked, a workflow run
can publish directly and the approval gate is decorative (→ R5).

Do **not** create an `NPM_TOKEN` secret. There should be nothing to delete
(→ R1).

---

## Step 9 — Tag what you published

```bash
git tag <prefix>-v<version>
git push --tags
```

In a monorepo releasing several packages, prefix the tag with the package
(`core-v1.2.0`) — a bare `v1.2.0` does not say which one it means.

If the workflows trigger on these tags they will run and their publish step
will fail, because the version already exists. Harmless: the tag's job is to
record which commit a version came from.

**From here on:** bump → tag → push → CI builds, tests and **stages** → the
owner approves.

```bash
npm stage list
npm stage approve <id>      # 2FA
```

---

## When it goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| `402 Payment Required` | scoped package defaulting to restricted | add `--access public` |
| `404 Not Found` | scope does not exist, not a member, or (in CI) a mismatched trusted publisher | step 1; in CI → R1 |
| `403 Forbidden` | name taken, or 2FA not satisfied | `npm view <pkg>` |
| `EUNSUPPORTEDPROTOCOL` on install | a `workspace:` specifier shipped | step 4 catches this; afterwards it needs a new version (→ R2) |
| Provenance error locally | no OIDC identity outside CI | `--provenance=false` for this publish |
| Published something wrong | — | `npm unpublish <pkg>@<version>` works **within 72 hours** |

`npm unpublish` inside 72 hours does **not** free the version number for reuse.
After 72 hours: publish a fixed version and `npm deprecate` the bad one.
