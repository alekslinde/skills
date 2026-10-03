# Reclaiming space

Only after the owner has approved a specific list. Everything here assumes
that approval already exists and names exactly what it covers.

Verify each command against the installed version before running it. The CLI
changes between releases, and a flag that moved is better found by
`--help` than by a failed delete.

## Order of preference

1. **Change the retention window.** The durable fix, and often the only one
   needed.
2. **Use the agent's own commands.** They know which files belong together.
3. **Delete by hand**, narrowly, only where no command covers it.

A manual purge today is a manual purge again next month. Prefer the setting.

## Shortening retention

`cleanupPeriodDays` in `settings.json` controls how long transcripts survive.
Unset, a default applies — confirm the current default against the installed
version rather than assuming, and report which is in force.

```json
{ "cleanupPeriodDays": 14 }
```

Cleanup runs at startup, so the effect appears on the next session, not
immediately. Say that, otherwise the owner re-measures, sees no change, and
concludes it failed.

What it costs: sessions age out of `--resume` and `--continue` sooner. What it
does not touch: plugins, caches, memory, or anything outside `projects/`.

Edit the file with the tools already available rather than redirecting shell
output over it — a clobbered settings file costs far more than the disk.

## Purging per-project state

The agent's own purge command removes everything belonging to a project —
transcripts, task state, file history and its configuration entry — and
understands which files those are. Prefer it to any glob.

```
claude project purge --dry-run <path>   # always first
claude project purge <path>             # after the owner sees the dry run
```

**Always pass the path.** Without one the command opens an interactive picker,
and an agent's shell has no terminal to answer it with: the process sits at
idle forever rather than failing, which reads like a slow scan of a large
directory and is not one. With a path it completes in well under a second
whatever the directory holds. If it produces nothing in a few seconds, it is
blocked, not working — stop it and supply the path.

The path is the repository path, the same one `inspect.mjs --project` takes —
so a project audited by that command is purged with the same argument, and
there is no encoded directory name to transcribe wrongly in between.

`--all` covers every project, `-i` prompts per item, `-y` skips confirmation.
`--all` and `-y` have the same interactive problem in reverse: they are how a
purge proceeds with no prompt at all. Use `-y` only when the owner has
approved that exact list; it removes the last checkpoint between a
misidentification and permanent loss.

**Always dry run, and show the real output.** Not a summary of it. The dry run
is where a wrongly identified project gets caught, and that is the failure this
whole phase is built to prevent.

If the dry run lists anything the owner did not approve, stop and go back to
them. Do not widen the scope on their behalf.

### What the plan covers beyond the project directory

The dry run prints the full list, and it reaches further than the project's
own directory. Expect to see:

- **One `file-history/` directory per session**, keyed by session id rather
  than by project. These are not inside the project directory and are easy to
  miss when estimating what a purge frees.
- **The project directory itself**, transcripts *and* `memory/` together. The
  command does not separate them, so read the memory notes out first if they
  are wanted — purge is the one path where essential state goes with the rest.
- **The project's entry in the agent's config**, carrying trust, history and
  MCP server settings for that project. Re-running an agent there starts from
  an untrusted state.
- **Prompt history entries** typed in that project.

It also says what it does *not* touch — shell snapshots are not project-scoped,
and rotating config backups may still hold the project entry for a while.
Quote those caveats rather than promising a clean sweep.

Count the items against what the audit measured. The plan's item count is
files and directories, not bytes, so it will not match a size estimate and is
not meant to.

### Before purging a project that holds memory

Purging removes the project's `memory/` directory with everything else. Those
are written notes, not cache. Read them out and save them somewhere the owner
chooses first, then purge.

## Plugins

Use the agent's plugin commands rather than deleting directories, so the
installed-plugin records stay consistent with what is on disk:

```
claude plugin list
claude plugin uninstall <plugin>
claude plugin prune          # auto-installed dependencies no longer needed
```

`prune` is the safe first move: it removes only what was pulled in as a
dependency and is now unreferenced. Uninstalling a plugin the owner still
wants is an annoyance, not a disaster — it reinstalls — but ask anyway.

Marketplace clones and plugin caches rebuild on demand. Removing one costs a
slower next start.

## Manual deletion

Only where no command covers it, and only inside a directory classified as
cleared or a rebuildable cache in `references/layout.md`.

- Target a specific named directory. Never a glob across `projects/`, which
  is how `memory/` gets caught.
- Never `rm -rf` the agent directory or any whole top-level area holding
  written state.
- Debug logs are the safest thing to remove.

Print what matches before deleting it, and delete exactly that.

## Afterwards

Re-run the inspect script and report the measured total, not the estimate. If
less came back than expected, say so and why — a copy-on-write filesystem,
snapshots, or a backup holding the blocks can all delay the space returning.

Then state what is now in place to stop it recurring: the retention window in
force, and what remains unbounded and worth re-checking later.

If the run ended with no deletion because the directory was healthy, that is
the result. Report it as such.
