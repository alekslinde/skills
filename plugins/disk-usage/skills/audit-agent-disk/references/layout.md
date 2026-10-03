# What an agent directory holds

Claude Code keeps its state in `~/.claude`. The areas below look alike in `du`
output and are not alike at all. Classify before touching anything.

Three classes matter:

- **Cleared** — the agent removes it itself once it ages past the retention
  window. Space here is a rolling working set. It refills by design, so
  deleting it early is a one-off saving, not a fix.
- **Kept** — nothing removes it. Only these can grow without bound, so a real
  disk problem lives here.
- **Essential** — removing it destroys something nobody can rebuild. Never a
  cleanup candidate, whatever its size.

Verify this against the installed version rather than trusting the table.
Directory layouts change between releases, and the inspect script reports any
top-level entry it does not recognise rather than quietly omitting it.

## projects/ — cleared, and partly essential

One directory per project, holding that project's sessions.

| Inside | Class | What it is |
| --- | --- | --- |
| `*.jsonl` | cleared | Session transcripts, one per session |
| `subagents/` | cleared | Subagent transcripts and metadata |
| `tool-results/` | cleared | Overflow output too large to inline |
| `memory/` | **essential** | Written project memory |

Transcripts are usually the largest single area and the one that most looks
like a problem. It generally is not: they age out on the retention window.

**What depends on them.** A transcript is what `--resume` and `--continue`
replay, and what the resume picker lists. Delete one and that session is
unrecoverable — the work it describes is gone, not just its history. Judge a
transcript by whether its session may still be wanted, never by its size.

**`memory/` is not session data.** It is the persistent memory an agent writes
deliberately and reads at the start of later sessions: notes about the project,
the owner and decisions already made. It sits inside `projects/` and so gets
swept up by anything matching on the parent directory. Never delete it as part
of a cleanup. Where a project is genuinely gone, offer to read its memory out
first.

This includes the agent's own purge command, which removes a project's
transcripts and its `memory/` as one unit and offers no way to keep the
notes. Purging is therefore the one operation that destroys essential state by
design — read the notes out before running it, not after.

## file-history/ — cleared

Snapshots of files before the agent edited them, behind rewind and checkpoint
restore. Bounded by the same retention window.

Organised by **session id, not by project**: one directory per session, all of
them siblings at the top level, with nothing in the name saying which project
a session belonged to. So a project's true footprint is its own directory plus
a scattering of directories here, and measuring the project directory alone
understates it. The agent's own purge command resolves the mapping; a size
estimate made by hand will not.

Pruning it costs the ability to rewind edits in sessions still inside the
window. Rarely worth it: it is typically a small fraction of the total.

## plugins/ — kept

Installed plugins, cloned marketplaces and their caches. Nothing ages this out,
so it only grows — which makes it the most likely home of a genuine unbounded
problem even when it is not the largest area today.

Caches and marketplace clones rebuild on demand; removing one costs a slower
next start. A plugin the owner still uses is not a cleanup candidate, and size
does not indicate disuse. Ask rather than infer, and prefer the agent's own
plugin commands to deleting directories by hand.

## Caches and bookkeeping — kept, low value

`cache/`, `shell-snapshots/`, `statsig/`, `debug/` and similar. All rebuild.
Usually small; check before bothering. Debug logs are diagnostic only and the
safest thing in the directory to remove.

## plans/, todos/, sessions/, state/, ide/ — kept, mostly essential

Small, and they hold written or live state: saved plans, task lists, session
bookkeeping, IDE integration. Deleting them frees almost nothing and can reset
things the owner set up. Leave them alone.

## backups/ — kept

Configuration backups. These are the safety net for a bad settings change, so
keeping them is the point. Low value as a cleanup target.

## Never touch

- `settings.json`, `settings.local.json` — configuration.
- Anything holding credentials or authentication state.
- `CLAUDE.md` — the owner's global instructions.
- Any `memory/` directory.

A cleanup that removes configuration or credentials has not freed disk space;
it has broken the install.

## Identifying which project state belongs to what

Each directory under `projects/` is named after the project's absolute path
with every `/` replaced by `-`. That encoding is **lossy and ambiguous**: a
directory whose own name contains a hyphen is indistinguishable from a path
separator. `-home-me-src-my-app` may be `/home/me/src/my-app` or
`/home/me/src/my/app`.

This matters because decoding by naive string replacement reports live projects
as deleted. Acting on that means purging the state of a repository that is
sitting right there on disk — and since a wrong answer here is unrecoverable,
it is the one piece of this audit that must not be eyeballed.

The inspect script resolves it by testing every possible split against the
filesystem and calling a project missing only when no split resolves to a real
directory. Use the script's answer rather than reading the names.

Even a correct "no such directory" is not proof the project was deleted. It is
equally consistent with a project that was renamed or moved, lives on an
unmounted volume, or belongs to another machine sharing the home directory.
Confirm with the owner before treating it as dead.
