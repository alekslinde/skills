# Scaffold: a new library

For a repo that does not exist yet, or one with no release machinery. Write
files that fit the toolchain the owner chose, not a fixed one; the structure
below is what to produce, and `rules.md` says which rules each piece exists to
satisfy.

Already have a repo that publishes? → `audit.md`.

## 0. Decide before writing code

These are free now and cost a release later (→ R18). Settle all of them before
creating a single file.

- [ ] **Name and scope.** Create the npm org first — a scoped package cannot be
      published into an org that does not exist. `npm view <pkg> version`
      returning 404 confirms the name is free.
- [ ] **Layout.** A package directory (`packages/<name>`), not the repo root,
      if there will ever be a second package. Moving it later changes every
      path and `repository.directory`.
- [ ] **Licence**, once, consistently: `LICENSE`, every manifest, README, site
      footer (→ R17).
- [ ] **Runtime dependencies:** zero if possible. Companions take the core as a
      peer dependency.
- [ ] **Support claim:** `engines.node` equals what CI will test, and nothing
      EOL (→ R11, R11a).
- [ ] **Package manager and release tool**, decided together — they determine
      which `[npm]` / `[pnpm]` / `[changesets]` rules apply.

## 1. What to create

| Path | Purpose |
| --- | --- |
| Root manifest, workspace config | Private root, pinned package manager, release script |
| `packages/<name>/` | The published package: dual ESM/CJS build, strict tsconfig, test runner |
| Versioning config | Whatever the chosen release tool needs |
| `.github/workflows/ci.yml` | Build → lint → test on the supported Node matrix, then smoke test |
| `.github/workflows/release.yml` | Version PR → staged publish, OIDC, provenance |
| `.github/scripts/smoke.mjs` | Imports the **built** package, asserts headline behaviour |
| `packages/site/` + `pages.yml` | Optional private docs or demo site |
| `CONTRIBUTING.md`, agent instructions, PR template | Conventions, written once |

The pieces that are easy to get wrong:

- **The root is private.** `"private": true`, so the workspace root can never
  be published.
- **The package manager is pinned** with its integrity hash (`corepack use
  <pm>@latest` writes `packageManager`). The release job's package manager
  version is one of the three layers behind a publish 404 (→ R1).
- **The release job runs on Node 24+**, with `registry-url` on `setup-node`,
  `id-token: write`, and **no token at all** (→ R1).
- **The release workflow stages**, never publishes (→ R5), passes
  `--provenance` at the call site (→ R3), and sets
  `concurrency: { group: release, cancel-in-progress: false }` (→ R7).
- **The smoke script loads `dist/`** through the real resolver, imports both the
  barrel and a subpath, and skips *visibly* when no build is present (→ R12).
- **CI order is install → build → lint → test** (→ R9).
- **Do not name a script after a package-manager builtin** — `version:packages`,
  not `version` (→ R6) `[pnpm]`.
- **Comment every fragile line** with what breaks if it changes: the release
  job's Node version, the deliberately absent token, the concurrency setting.

## 2. Verify before the first commit

- [ ] Replace any placeholder API; write a real first test
- [ ] `<build> && <lint> && <test> && node .github/scripts/smoke.mjs`
- [ ] Repeat from a **clean clone** (`rm -rf node_modules packages/*/dist`) —
      stale `dist/` hides build-order bugs (→ R9)
- [ ] `npm pack` each package and read the tarball: `exports`, `files`, and
      zero `workspace:` specifiers (→ R2)
- [ ] `node <skill-dir>/scripts/check.mjs .`

## 3. GitHub settings

Not in the repo, so nothing fails until a release does. The owner does these:

- [ ] Push; default branch set
- [ ] Settings → Actions → General → allow Actions to create pull requests, if
      the release tool opens one
- [ ] Pages → Source → **GitHub Actions**, if using the site (→ R22)
- [ ] Branch protection requiring the test and smoke checks

## 4. npm setup

The first release is manual: a trusted publisher can only attach to a package
that already exists on the registry. → `first-publish.md`, then return here.

## 5. The release loop, afterwards

1. Record the change for the release tool (a changeset, a conventional commit)
2. Merge to the main branch → the tool opens a version PR; review the bump
3. Merge it → the workflow builds, tests, **stages**, pushes tags (→ R20)
4. The owner approves with 2FA: `npm stage list`, then `npm stage approve <id>`
5. Confirm: `npm view <pkg> version`, then install it in a scratch directory
   and import it

## 6. Docs site, if wanted

- [ ] Pages → Source → **GitHub Actions**
- [ ] The demo must call the real library, not a copy of its logic
- [ ] `packages/site` is **private** and excluded from the root build (→ R23)
- [ ] Generated output: compiled CSS gitignored; any committed bundle rebuilt in
      CI with a drift check (→ R21)
- [ ] The deployed directory assembled from an **explicit file list**; ships
      `.nojekyll`; relative asset URLs only (→ R22)
- [ ] Design tokens before components (→ R24); test at 320px in both themes
- [ ] Quality bar: no horizontal scroll from 320px, tap targets ≥ 44px, WCAG AA
      in both themes

## 7. Working with agents on the repo afterwards

- Project instructions carry the conventions and an **Off Limits** list of
  generated paths, so nothing hand-edits them (→ R21)
- Never write absolute paths, hostnames or usernames into repo files, comments
  or commit messages
