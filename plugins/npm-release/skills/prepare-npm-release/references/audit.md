# Audit: an existing repo, before its first publish

Twelve checks, ordered so the ones that are permanent to get wrong come first.
Each gives the command, what a pass looks like, and the rule it enforces. Run
them from the repo root.

**Run the bundled checker first** — `node <skill-dir>/scripts/check.mjs <repo>`
does checks 3, 4, 5, 8, 9, 10 and 11 mechanically and prints what it could not
judge. This page is then the remainder, plus the reasoning for every finding.

Placeholders: `<pkg>` is the package name, `<dir>` its directory.

---

## Permanent if wrong — do these first

A published version cannot be replaced, and unpublishing is restricted after 72
hours. Everything in this section ships into that.

### 1. The package name is final `[any]`

```bash
node -p "require('./<dir>/package.json').name"
npm view <pkg> version      # 404 means the name is free
```

**Pass:** the name the owner wants forever, including scope.

Renaming after publishing is a breaking change for every consumer plus a
migration note. Check the scope exists on npm too — a scoped package cannot be
published into an org that does not exist yet.

→ R1, R18

### 2. No workspace protocol survives into the tarball `[any]`

```bash
npm pack --workspace <pkg> --pack-destination /tmp/audit
tar xzOf /tmp/audit/<file>.tgz package/package.json | grep -c "workspace:"
```

**Pass:** `0`.

pnpm rewrites `workspace:*` to a real range on publish; **npm does not**. A
tarball carrying it fails every install with `EUNSUPPORTEDPROTOCOL`, and the
only fix is a new version number.

→ R2

### 3. `engines.node` equals what CI actually tests `[any]`

```bash
node -p "require('./<dir>/package.json').engines.node"
grep -n "node-version" .github/workflows/ci.yml
```

**Pass:** the claimed floor appears in the CI matrix.

Then check the floor is still alive — <https://endoflife.date/nodejs>.
Publishing an untested claim is worse than a narrow one: the install succeeds
and the failure arrives as somebody else's bug report.

→ R11, R11a

### 4. Every file in `files` exists `[any]`

```bash
node -e "const j=require('./<dir>/package.json');
for (const f of j.files) console.log(f, require('fs').existsSync('<dir>/'+f));"
```

**Pass:** no `false`, and `README.md` and `LICENSE` are both listed.

A listed file that does not exist is silently absent from the tarball — no
warning, no failure, just a package with no readme on its registry page.

→ R8

### 5. Manifest metadata is complete `[any]`

```bash
node -p "const j=require('./<dir>/package.json');
JSON.stringify({repository:j.repository,homepage:!!j.homepage,bugs:!!j.bugs,
license:j.license,access:j.publishConfig?.access},null,2)"
```

**Pass:** `repository.url` set, `repository.directory` correct for a monorepo,
`homepage` and `bugs` present, `license` matching the `LICENSE` file,
`publishConfig.access: "public"` for a scoped package.

Provenance **requires** `repository`. `directory` has to track the package's
real path — it goes stale the moment a package moves.

→ R8

### 6. Inter-package ranges resolve `[any]`

```bash
node -p "require('./<companion-dir>/package.json').dependencies"
```

**Pass:** every in-repo dependency is a semver range (`^1.2.3`), and the
version it names exists in the tree or on the registry.

Publish order follows the dependency graph: core first, companions after. A
*staged* core does not count — `npm view` only sees published versions.

→ R2, R6a

---

## Release machinery

### 7. CI tests the built artifact, not just source `[any]`

```bash
grep -n "build" .github/workflows/ci.yml
```

**Pass:** CI builds each published package, then runs a suite that loads
`dist/` through the real resolver.

Unit tests run against `src/`. A broken `exports` map, a dropped export, a
non-executable bin, a `.d.ts` full of extensionless imports — none are visible
from source. Make the suite skip *visibly* without a build, so a fresh clone is
not blocked but a silent pass is impossible.

→ R12

### 8. The release job runs on a new enough Node `[any]`

```bash
grep -n "node-version" .github/workflows/*publish*.yml .github/workflows/release.yml 2>/dev/null
```

**Pass:** 24 or later, if using OIDC trusted publishing.

OIDC needs npm ≥ 11.5.1; Node 22 bundles npm 10.x. On an old npm no token
exchange happens, the PUT goes out unauthenticated, and the registry answers
**404** — which reads as "package missing", not "credential missing".

*Checked: 2026-10.*

→ R1

### 9. No long-lived token in the workflow `[any]`

```bash
grep -n "NODE_AUTH_TOKEN\|NPM_TOKEN" .github/workflows/*.yml
```

**Pass:** no matches outside comments, and `id-token: write` is present.

An empty `NODE_AUTH_TOKEN` is worse than none: it reads as absent while
implying a token signs these releases.

→ R1, R5

### 10. Releases stage rather than publish `[any]`

```bash
grep -n "stage publish\|npm publish\|pnpm publish" .github/workflows/*.yml
```

**Pass:** `npm stage publish` (or `pnpm stage publish`), never a bare publish.

Staging holds the tarball until a human approves with 2FA. Without it, any
workflow run — including one triggered by a mistyped tag — reaches installers
directly.

`npm stage` exists in npm ≥ 12; confirm with `npm help stage`.
*Checked: 2026-10.*

→ R5

### 11. Provenance is requested explicitly `[any]`

```bash
grep -n "provenance" .github/workflows/*.yml <dir>/package.json
```

**Pass:** `--provenance` on the publish or stage command **and**
`publishConfig.provenance: true` in the manifest.

At the call site as well as the manifest, so a manifest edit cannot silently
drop the attestation. Some tools ignore `NPM_CONFIG_PROVENANCE` entirely.

→ R3

### 12. Packing leaves the tree clean `[any]`

```bash
npm pack --workspace <pkg> --pack-destination /tmp/audit
git diff --exit-code -- <dir>/package.json
```

**Pass:** no diff.

Only applies if `prepack` rewrites the manifest. A pack killed between
`prepack` and `postpack` leaves the rewritten file behind, and the next publish
ships a doubly-rewritten manifest.

→ R19

---

## Build order, from a clean clone

Not a single command, but it catches what nothing else does:

```bash
rm -rf node_modules */*/dist && <install> && <build> && <lint> && <test>
```

**Pass:** green. A companion resolving the core through its *built* types works
locally only because stale `dist/` is lying around; a clean checkout has
nothing to import. Read the first error, not the loudest.

→ R9

---

## Lock it in

Checks rot. Encode what a test can hold:

- `engines.node` equals the CI matrix floor
- no `workspace:` specifier in any published manifest
- no token in any release workflow; `id-token: write` present
- release commands stage, never publish outright
- every path in `files` exists
- `repository.directory` points at a real package

**Verify each by mutation.** Break the thing, confirm the test fails for the
reason you expect, restore. A publish-readiness test that passes against a
broken manifest is worse than none — it reports a safety it never checked.

→ R15

---

## Settings that live outside the repo

Nothing here is in version control, so nothing fails until a release does. The
owner must confirm each, and they belong in `CONTRIBUTING.md`:

- [ ] npm org or scope exists
- [ ] 2FA on the npm account, set to **Authorization and Publishing**
- [ ] Package published once by hand — a trusted publisher can only attach to a
      package that already exists
- [ ] Trusted publisher set: owner, repo, **workflow filename only**,
      environment **empty**, "Allow npm publish" **unchecked**
- [ ] No `NPM_TOKEN` repo secret (there should be nothing to delete)
- [ ] Actions → allow creating pull requests, if versioning opens one
- [ ] Branch protection requiring the test and smoke checks

A mismatched trusted publisher surfaces as a bare 404 on the PUT. Debug order:
**publisher fields → Node and npm version → package manager version.**

→ R1, R5
