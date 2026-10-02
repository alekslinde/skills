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

`--all` covers every project, `-i` prompts per item, `-y` skips confirmation.
Use `-y` only when the owner has approved that exact list; it removes the last
checkpoint between a misidentification and permanent loss.

**Always dry run, and show the real output.** Not a summary of it. The dry run
is where a wrongly identified project gets caught, and that is the failure this
whole phase is built to prevent.

On a large directory the dry run can take a while. Let it finish rather than
interrupting and assuming.

If the dry run lists anything the owner did not approve, stop and go back to
them. Do not widen the scope on their behalf.

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
