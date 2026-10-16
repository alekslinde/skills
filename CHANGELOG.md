# Changelog

All notable changes to this repository are recorded here, by plugin. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each plugin's
`version` in its `plugin.json` is the number installed copies are pinned to, so
every bump gets an entry.

## [Unreleased]

### Added
- Repository checks (`scripts/check-repo.mjs`): marketplace and plugin
  manifests agree, skill frontmatter matches its folder, the README lists every
  plugin, and changed plugins bump their version.
- Behaviour tests for the repository checks and every shipped script
  (`tests/scripts.test.mjs`).
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.gitignore`, `CODEOWNERS`, Dependabot
  for GitHub Actions, and issue templates.

### Changed
- Every plugin manifest declares `"license": "Apache-2.0"`. Patch bumps:
  agent-team 0.1.2, disk-usage 0.1.1, licensing 0.1.2, npm-release 0.1.2,
  project-memory 0.1.1, versioning 0.1.2.
- CI validates the marketplace and each plugin with the Claude Code CLI, pins
  its actions to commit SHAs, and sets timeouts.
- README install commands include `project-memory`, and state the Node version
  the scripts need.
