# skills

Agent skills by Aleksandr Linde. Each skill is a standard `SKILL.md` folder, so
it works in Claude Code and in other agents that read the format.

## Install

**Claude Code**, as a plugin marketplace. Installed plugins are pinned to their
version, and their skills are namespaced (`/licensing:choose-license`):

```bash
claude plugin marketplace add alekslinde/skills
claude plugin install licensing@alekslinde
claude plugin install versioning@alekslinde
claude plugin install agent-team@alekslinde
claude plugin install npm-release@alekslinde
claude plugin install disk-usage@alekslinde
```

Or inside a session: `/plugin marketplace add alekslinde/skills`, then
`/plugin install licensing@alekslinde` (or `versioning@alekslinde`,
`agent-team@alekslinde`, `npm-release@alekslinde`, `disk-usage@alekslinde`).

**Any agent**, with [`npx skills`](https://github.com/vercel-labs/skills)
(Claude Code, Codex, Cursor, OpenCode and others). It copies the skill folders
into each agent's skills directory, in the project by default or globally with
`-g`:

```bash
npx skills add alekslinde/skills
npx skills add alekslinde/skills --skill choose-license -a codex
```

`npx skills update` fetches newer versions. Agents without an ask-the-user tool
get the skill's questions as plain text.

## Plugins

| Plugin | Skill | What it does |
| --- | --- | --- |
| [`licensing`](plugins/licensing) | `/licensing:choose-license` | Audits a repository (what ships where, bundled third-party material, dependencies, contributors, earlier releases), asks only what the code can't answer, recommends a licence per part, and applies it with REUSE and SPDX once approved |
| [`versioning`](plugins/versioning) | `/versioning:choose-versioning` | Audits what ships where, current versions, tags, releases and how things deploy today, asks only what the code can't answer, and recommends a scheme, tag format, release flow and tool per part, with the path to 1.0 left to you. Sets it up once approved |
| [`agent-team`](plugins/agent-team) | `/agent-team:plan-agent-team` | Audits the kinds of work a project has, then designs an agent team across engineering, design, security, quality, product, docs and operations: roles with evidence, ownership by path, handoffs, orchestration and review gates. Writes the team once as neutral role files and translates them for the agents you use |
| [`npm-release`](plugins/npm-release) | `/npm-release:prepare-npm-release` | Audits a package against the mistakes that cost a permanent version number — a workspace specifier in a tarball, an untested `engines` claim, a release job that can publish alone, a green build that shipped a broken package — runs the mechanical checks as a script, asks only what the code can't answer, then fixes what it found and walks the release. npm and pnpm, with every rule tagged by the toolchain it applies to |
| [`project-memory`](plugins/project-memory) | `/project-memory:write-project-memory` | Writes the `CLAUDE.md` or `AGENTS.md` an agent reads on every task. Audits what the repository already proves — the committed lockfile, the scripts that exist, where new code actually lands, the scope vocabulary in the history — asks only what the code can't answer, then recommends a file that holds just what an agent would otherwise get wrong, says what it left out and why, and checks it for anything that shouldn't be committed |
| [`disk-usage`](plugins/disk-usage) | `/disk-usage:audit-agent-disk` | Explains what an agent's own directory is costing on disk and why. Measures it with a script that separates the rolling working set the agent already clears from the state nothing ever removes, checks whether automatic cleanup is actually running, and resolves which per-project state belongs to a project that no longer exists — a lossy path encoding that makes live projects look deleted, so it is resolved against the filesystem rather than guessed. Often ends in a changed retention setting and no deletion at all |

Claude also loads a skill on its own when a request matches it, for example
"which licence should this project use?".

## Contributing

Pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the shape
these skills share, how to add a plugin, when to bump a version, and the checks
to run before opening one.

## Licence

[Apache-2.0](LICENSE) — copyright 2026 Aleksandr Linde. Use these skills
anywhere, including in commercial work: keep the licence and copyright notice,
and state significant changes you make. The licence also grants patent rights
and, under section 6, no trademark rights, so the project and marketplace names
stay reserved.

Everything in the repository is Apache-2.0 — plugin manifests, the skill
instructions in Markdown and the scripts. [REUSE.toml](REUSE.toml) records the
same per-file, verifiable with `pipx run reuse lint`.

The skills give general information, not legal or professional advice.
