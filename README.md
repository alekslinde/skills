# skills

Claude Code plugins by Aleksandr Linde, published as a plugin marketplace.

## Install

```bash
claude plugin marketplace add alekslinde/skills
claude plugin install licensing@alekslinde
```

Or inside a session: `/plugin marketplace add alekslinde/skills`, then
`/plugin install licensing@alekslinde`.

## Plugins

| Plugin | Skill | What it does |
| --- | --- | --- |
| [`licensing`](plugins/licensing) | `/licensing:choose-license` | Audits a repository (what ships where, bundled third-party material, dependencies, contributors, earlier releases), asks only what the code can't answer, recommends a licence per part, and applies it with REUSE and SPDX once approved |

Claude also loads a skill on its own when a request matches it, for example
"which licence should this project use?".

## Adding a plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` and
   `plugins/<name>/skills/<skill>/SKILL.md`.
2. Add an entry to `.claude-plugin/marketplace.json` whose `name` matches the
   plugin's `name`.
3. Run `claude plugin validate .` and `claude plugin validate plugins/<name>`.
4. Bump the plugin's `version` in `plugin.json` when you change it; installed
   copies stay on the old version until you do.

The skills give general information, not legal or professional advice.
