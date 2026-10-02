---
name: audit-agent-disk
description: Explain what an agent's own directory holds and what it costs on disk, separating the rolling working set the agent already clears from the state nothing ever removes, then reclaim only what the owner agrees is dead. Use when someone asks why ~/.claude or an agent directory is so large, wants a breakdown of agent disk usage, suspects transcripts or plugins are filling the disk, asks what is safe to delete from an agent directory, or wants old project state and sessions cleaned up.
---

# Audit an agent's disk usage

Work in four phases, in order: **measure, explain, ask, reclaim**. Never delete
anything before the owner approves a specific list.

An agent directory holds three different kinds of thing wearing the same
clothes: a rolling working set the agent clears on its own, caches that
regenerate, and written state that nothing can rebuild. They look identical in
`du` output. Telling them apart is the whole job — the deleting is trivial and
mostly unnecessary.

Hold to these principles, and state the relevant ones when you explain a
choice:

- **Measure before alarming.** A large directory is not a problem; an
  unbounded one is. Most of what looks alarming is a bounded rolling window
  that refills by design. Say which it is before suggesting anything.
- **A steady state is not a leak.** Space the agent reclaims on a timer has
  already been accounted for. Deleting it early buys a one-off saving that
  comes back, at the cost of the sessions it held.
- **The honest answer is often "nothing is wrong".** This skill frequently ends
  with no deletion and a setting changed instead. That is a successful run, not
  a failed one — say so plainly rather than manufacturing a cleanup.
- **Deleted is deleted.** There is no undo. Weigh a mistaken deletion as far
  worse than disk left in use, because one is recoverable by waiting and the
  other is not.
- **Identification is the risky step, not removal.** The common failure is
  confidently misreading which state belongs to what, and purging a live
  project. Verify, then act.
- **Fix the cause, not the symptom.** A retention window the owner chose keeps
  working. A manual purge today is a manual purge again next month.
- **Written notes are not cache.** Memory files, plans and saved state are
  someone's accumulated work. They are never "space to reclaim", whatever their
  size.

## Phase 1: Measure

Run `scripts/inspect.mjs` for the mechanical half. It is read-only, deletes
nothing, and is dependency-free:

```
node scripts/inspect.mjs                 # defaults to ~/.claude
node scripts/inspect.mjs --dir <path>    # another agent directory
node scripts/inspect.mjs --json          # machine-readable
```

It reports the total, splits every area into **cleared** (the agent removes it
past the retention window) and **kept** (nothing removes it), resolves which
per-project state belongs to a project still on disk, flags which of those hold
a `memory/` directory, and lists the largest individual transcripts.

Read `references/layout.md` for what each area is for and what depends on it,
and `references/audit.md` for what the script deliberately leaves to judgement.

Two numbers decide the shape of the whole conversation, so establish them
first:

1. **The retention window, and whether it is actually running.** The script
   compares the oldest surviving transcript against the window. If nothing is
   older, cleanup is demonstrably working and the bulk of the directory is a
   steady state. If older files are present, cleanup is not running and that is
   the finding — investigate it before deleting anything by hand.
2. **How much is "kept" rather than "cleared".** Only the kept portion can grow
   without bound. That is where a real disk problem lives, and it is usually a
   small fraction of the total.

Never report a raw total on its own. `602M` invites a cleanup; `602M, of which
464M is a rolling 30-day window that refills` invites a decision.

## Phase 2: Explain

Report before asking. Lead with the split, not the total:

1. **The breakdown**, as one table: area, size, cleared or kept, what it is for.
2. **The verdict on retention** in one sentence — running as configured, or
   not — and the window in force, noting whether it is the default or set.
3. **What could grow without bound**, from the kept areas, with what drives
   each.
4. **Genuinely dead state**: per-project directories whose project no longer
   exists on disk, with the total they hold.
5. **What is not a candidate, and why**, briefly — this is what stops the
   conversation drifting into deleting live state.

If the directory is healthy, say that first and plainly. Do not pad a clean
result into a list of marginal deletions.

Where a project directory is reported as missing, treat that as a lead rather
than a fact. A project can be absent because it was deleted, but equally
because it was renamed, moved, lives on an unmounted volume, or belongs to
another machine syncing the same home directory. Confirm before offering it.
`references/layout.md` covers why this identification is error-prone and how
the script resolves it.

## Phase 3: Ask

Ask only what the measurement left open. Use the AskUserQuestion tool when it
is available: at most four questions per call, two to four options each, the
recommended option first and labelled "(Recommended)", and a description on
every option saying what choosing it means in practice. Without it, ask in
plain text, numbered.

Word questions around what you found, and make "change nothing" a real option
wherever it is the honest recommendation.

### The retention window

- Is the window right for how they work? Offer a shorter one when the rolling
  set is large and they rarely resume old sessions, and keeping the current one
  when they do. This is the durable fix and usually the only change worth
  making.
- Note what a shorter window costs: sessions age out of `--resume` and
  `--continue` sooner.

### Dead project state

- For each project directory whose project is gone: deleted for good, or moved
  or renamed? Only the first is a candidate.
- Where one holds a `memory/` directory, ask separately whether to read it out
  first. Those are written notes, not cache.

### Scope

- Reclaim only clearly dead state, or also prune caches that will rebuild?
  Pruning a cache costs a slower next start, not data.
- Is anything being kept deliberately — a transcript they intend to resume, an
  archived project they want the history of?

## Phase 4: Reclaim (only after approval)

Follow `references/reclaim.md`. It covers the agent's own purge command, which
is the right tool for per-project state and understands what belongs to a
project; what to do by hand and how; and what to never touch.

The order that matters:

1. **Prefer the agent's own tooling** over hand-written deletes. It knows which
   files belong together; a shell glob does not.
2. **Dry run first**, always, and show the owner the real output before
   anything is removed.
3. **Delete only what was named in the approved list.** If the dry run reveals
   something unexpected, stop and go back to the owner rather than widening the
   scope on their behalf.
4. **Apply the setting change** if one was agreed, so the next month needs no
   cleanup.
5. **Report what was actually freed**, measured, not estimated — and say
   plainly if it was less than expected.

Never delete a `memory/` directory, a settings file or credentials as part of a
cleanup, whatever their size (`references/layout.md`).
