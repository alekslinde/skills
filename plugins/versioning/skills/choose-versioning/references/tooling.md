# Release tooling

Pick the tool after the scheme and process are agreed; the tool encodes them.

| Tool | Bump comes from | Release happens | Monorepo | Notes |
| --- | --- | --- | --- | --- |
| [release-please](https://github.com/googleapis/release-please) | Conventional Commit types | When a maintainer merges the release PR it keeps open | Yes, manifest mode, one PR per part with `separate-pull-requests` | Language-agnostic (`release-type` per part). Writes `CHANGELOG.md`, tags and GitHub Releases. Strongly recommends squash merges. |
| [Changesets](https://github.com/changesets/changesets) | A `.changeset/*.md` file each PR adds, naming parts and bump levels | When the "Version Packages" PR merges, then `changeset publish` | Yes, built for JS workspaces; `fixed` and `linked` groups | Notes are written for readers, not derived from commits. Private packages need `privatePackages` config to be versioned and tagged. |
| [semantic-release](https://github.com/semantic-release/semantic-release) | Conventional Commit types | On every qualifying merge, fully automatic | Via plugins; single-package by design | No review step before a release. Fits libraries with strong CI. |
| Nx release, Lerna | Conventional commits or explicit plans | From a CLI command or CI job | Yes, fixed or independent | Fits repos already using Nx or Lerna. |
| Ecosystem tools (`cargo-release`, `bump-my-version`, GoReleaser) | The person running them | From a CLI command | Varies | Good for single-ecosystem repos; GoReleaser builds and publishes Go binaries from a tag. |
| By hand | Edits in each PR | Someone types a tag | n/a | Acceptable for tiny projects; the usual source of drift. |

## Choosing

- Commits already follow Conventional Commits, several parts in several
  languages, owner wants to release on demand → **release-please**.
- JavaScript or TypeScript workspace, owner wants reader-written notes → **Changesets**.
- Single library, every merge should ship → **semantic-release**.
- Already on Nx or Lerna → use its release command before adding another tool.

## Conventional Commits

`type(scope): subject`, with `fix` → patch, `feat` → minor, `!` after the type
or a `BREAKING CHANGE:` footer → major (minor while on 0.x with the pre-major
options). `docs`, `chore`, `refactor`, `test`, `ci` do not release on their
own. With squash merges, the PR title becomes the commit, so check PR titles
in CI (for example with `amannn/action-semantic-pull-request`) rather than
every commit.
