# Version schemes

## Schemes

| Scheme | Format | Tells the consumer | Fits |
| --- | --- | --- | --- |
| SemVer | `MAJOR.MINOR.PATCH` (`2.4.1`), pre-release `2.5.0-rc.1` | Whether upgrading can break them | Libraries, packages, APIs, CLIs, extensions, apps people refer to by version |
| SemVer 0.x | `0.MINOR.PATCH` | "Not stable yet; anything may change" | Anything before the owner declares a stable promise |
| CalVer | `YYYY.MM.MICRO` (`2026.10.0`), `YY.MM` (`26.10`) | When it was released | Scheduled releases, tools whose compatibility is not the message (Ubuntu `YY.MM`, pip `YY.N`) |
| None (deploy id) | Commit SHA, build number or deploy date | Which build is running | Hosted services nobody depends on programmatically |

SemVer rules (semver.org): MAJOR for incompatible changes, MINOR for
backward-compatible features, PATCH for backward-compatible fixes. Define
"incompatible" by what the part's own consumers would notice: an API
signature for a library, a behaviour or promise for an end-user app.

## 0.x in practice

- Package managers treat the 0.x minor as breaking: npm `^0.2.3` and Cargo
  `0.2.3` both mean `>=0.2.3, <0.3.0`. So in 0.x, a breaking change bumps the
  minor and a feature usually bumps the patch.
- Release tools can encode this: release-please `bump-minor-pre-major` and
  `bump-patch-for-minor-pre-major`; Changesets and semantic-release need the
  author or config to choose the bump.
- Staying on 0.x is legitimate for as long as the owner needs. 1.0.0 is a
  deliberate declaration, usually with its own announcement.

## Pre-releases

SemVer pre-releases sort before their release: `1.0.0-beta.1 < 1.0.0-rc.1 <
1.0.0`. Mark them as pre-releases on GitHub, and publish them under a
non-default registry tag (`npm publish --tag next`) so a plain install does
not pick them up.

## Monorepos

| Model | Means | Fits |
| --- | --- | --- |
| Independent | Each part has its own version line and tag prefix (`engine-v0.4.0`, `app-v1.2.0`) | Parts with different consumers and schedules |
| Fixed (locked) | All parts share one version; every release bumps all of them | Parts that must always be installed together |
| Linked groups | Parts in a group share the version they move to, but only changed parts release | Packages released as a family |

Tag prefixes: `<part>-v<version>` (release-please default),
`<package>@<version>` (Changesets, Lerna). A bare `v<version>` is only safe in
a single-part repository.

## Channel constraints

| Channel | Constraint |
| --- | --- |
| npm, PyPI, crates.io | A published version can never be replaced. npm allows unpublishing only within 72 hours or under strict conditions. Plan bumps accordingly. |
| PyPI | Versions follow PEP 440: `1.0.0rc1`, not `1.0.0-rc.1`. |
| Go modules | `v2` and above need a `/v2` suffix in the module path. Tags must be `vX.Y.Z` (with a directory prefix for nested modules: `sub/v1.2.0`). |
| Chrome extensions | `version` is one to four dot-separated integers, no pre-release suffix; every submission must be higher than the last. Use `version_name` for a display string. |
| Firefox extensions | Must increase with every submission; check the current format rules on addons.mozilla.org before using anything beyond dot-separated integers. |
| Apple App Store | A marketing version (`CFBundleShortVersionString`) plus a build number that must increase for every upload. |
| Google Play | An integer `versionCode` that must increase for every upload, plus a display `versionName`. |
| Container images | Tag images with the version and the commit SHA; avoid relying on `latest`. |
| Hosted services | No format constraint. Record the deployed version or SHA somewhere a bug report can show it. |
