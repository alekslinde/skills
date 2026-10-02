# Filenames, and how agents actually load them

Decide the content first. This file is only about where it goes.

Loading rules change faster than this document. Verify against the agent's
current documentation before relying on a detail here, and prefer what the
owner's installed version actually does over what any guide says.

## Claude Code

Reads, in load order from broadest to most specific:

1. A managed policy file, where an organisation deploys one
2. `~/.claude/CLAUDE.md` — the user's own, every project
3. `./CLAUDE.md` or `./.claude/CLAUDE.md` — the project
4. `./CLAUDE.local.md` — personal, project-specific, gitignored

Files are concatenated, not overridden. Across directories the order runs from
the filesystem root down to the working directory, so the file nearest the
launch point is read last. Within a directory, `CLAUDE.local.md` is appended
after `CLAUDE.md`.

Files in the working directory and above load at launch. Files in
*subdirectories* load on demand, when Claude reads a file in that directory.
This is what makes per-package files in a monorepo cheap: they cost nothing
until work touches that package.

Anthropic's own guidance targets **under 200 lines per file**, and warns that
longer files reduce adherence. A file over 4 MiB is skipped entirely.

`@path/to/file.md` imports another file, relative to the file containing the
import, up to four hops deep. Imports are expanded at launch, so they organise
a long file without reducing its context cost. Paths inside backticks or code
blocks are not imported. An import resolving outside the working directory
prompts for approval the first time.

Block-level HTML comments are stripped before the content reaches the context,
so `<!-- note to maintainers -->` costs nothing. Useful for a "why this rule
exists" note aimed at humans.

`.claude/rules/*.md` holds topic files loaded at launch. A rule with a `paths:`
frontmatter list of globs loads only when Claude reads a matching file — the
right home for a rule that matters to one file type or one directory, and the
main tool for keeping the always-loaded file short.

## AGENTS.md

An open specification stewarded by the Agentic AI Foundation under the Linux
Foundation, read by a long list of agents including Codex, Cursor, Copilot,
Devin, Jules and Aider. It is plain Markdown with no required fields or
headings.

Claude Code reads it too, from v2.1.277, but **by default only when there is no
`CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` in the working directory
or above it**. Two consequences worth knowing before recommending a layout:

- Adding a `CLAUDE.md` to a repository that relies on `AGENTS.md` silently
  stops Claude reading the `AGENTS.md`.
- So does a personal, gitignored `CLAUDE.local.md`. This one surprises people,
  because nothing in the committed tree explains the change.

The `/config` setting **Project instructions** changes this:
`claude-md-or-agents-md` (the default), `claude-md-and-agents-md` (both, each
directory's `CLAUDE.md` first), `claude-md`, or `managed-only`. It is a
per-user setting, not something a repository can commit, so a recommendation
must not depend on the owner's collaborators having changed it.

The user's `~/.claude/CLAUDE.md`, managed files and `.claude/rules/` do not
count for the check, and keep loading alongside `AGENTS.md`.

## Other agents

| File | Status | Agent |
| --- | --- | --- |
| `.cursor/rules/*.mdc` | current | Cursor |
| `.cursorrules` | legacy, superseded | Cursor |
| `.github/copilot-instructions.md` | current | GitHub Copilot |
| `.windsurf/rules/` or `.windsurfrules` | current | Windsurf |
| `.clinerules` | current | Cline |
| `.devin/rules/` | current | Devin |
| `GEMINI.md` | current | Gemini CLI |

When the audit finds any of these, reconcile rather than adding another voice.
Two instruction files that disagree mean some agent is already following the
wrong one.

## One file, several agents

Where the owner uses more than one agent, do not maintain parallel copies. A
rule changed in one and not the other is worse than no rule, because the
divergence is invisible until an agent acts on the stale copy.

**Import** is the safer default. Keep `AGENTS.md` as the shared content, and
add a `CLAUDE.md` beside it:

```markdown
@AGENTS.md

## Claude Code

Use plan mode for changes under `src/billing/`.
```

Claude reads the imported file first, then anything below it. This works on
every platform and leaves room for agent-specific sections.

**Symlink** suits a repository with no Claude-specific content:

```bash
ln -s AGENTS.md CLAUDE.md
```

Two constraints decide against it more often than people expect. Edit and Write
refuse to write through a symlink, redirecting to the target. And on Windows,
creating one needs Administrator or Developer Mode, while Git checks a
committed symlink out as a plain text file unless `core.symlinks` is enabled —
leaving that clone with a one-line `CLAUDE.md` where the instructions should
be. If anyone who clones the repository uses Windows, use the import.

**Letting Claude read `AGENTS.md` directly** is cleanest of all, and needs no
`CLAUDE.md` at all — but only while nobody adds one, including a personal
`CLAUDE.local.md`. Recommend it with that caveat stated.

## Related Claude Code commands

Worth knowing, and worth telling the owner about rather than duplicating:

- `/init` generates a starting `CLAUDE.md` from the codebase, and reads
  `.cursor/rules/`, `.cursorrules` and `.github/copilot-instructions.md` while
  doing it. With `CLAUDE_CODE_NEW_INIT=1` it runs an interactive multi-phase
  flow and also reads `AGENTS.md`, `.devin/rules/`, `.windsurf/rules/` and
  `.clinerules`.
- `/doctor prompt-audit` checks existing instruction files for staleness,
  contradictions and references to files or commands that no longer exist.
- `/memory` lists and opens the memory files for the session; `/context` shows
  which ones actually loaded.

If the owner only wants a first draft from the codebase, `/init` is the shorter
path and it is honest to say so. This skill earns its place when the file needs
to inherit from a global file, encode rules the code cannot show, survive a
review for what to leave out, or be split across a monorepo.

## Verifying it loaded

After writing, `/context` lists the files actually in context under **Memory
files**. A file that does not appear there is a file Claude cannot see.

Worth doing in Phase 4 rather than assuming, particularly for a nested file or
anything reached through a symlink.
