# What the script leaves to you

`scripts/inspect.mjs` reports evidence. Everything below needs a judgement it
cannot make, usually because the answer lives in the owner's head rather than
on the disk.

## Whether there is a problem at all

The script reports sizes and a retention verdict. It does not decide whether
the total is too large, because that depends on the disk it sits on and what
else wants the space.

Resolve it before anything else:

- **Cleanup running, kept areas modest.** The directory is at a steady state.
  The honest recommendation is to change nothing, or at most shorten the
  retention window. Say so plainly.
- **Cleanup running, kept areas large or growing.** The transcripts are a red
  herring. Look at plugins and caches.
- **Transcripts older than the window present.** Cleanup is not running. That
  is the finding, and it needs explaining — a window set unusually long, a
  permissions problem, a directory the agent no longer manages — before any
  manual deletion papers over it.

A directory holding a large but bounded rolling set is working as designed. The
measurement exists to establish that, not to justify a cleanup.

## Which sessions still matter

The script cannot know which sessions the owner intends to resume. Age is a
weak signal — a transcript from three weeks ago may be the one piece of work
they most want back, and today's may be disposable.

Only the owner can answer this, and getting it wrong is unrecoverable, so ask
rather than infer. Where they are unsure, keeping is the cheap option: the
retention window will take it soon enough anyway.

## Whether a missing project is genuinely gone

The script resolves ambiguous encoded paths against the filesystem and reports
a project as missing only when no interpretation resolves. That is reliable as
far as it goes, but "not on this disk now" is not "deleted".

It is equally consistent with a project that was renamed or moved, sits on an
unmounted external volume or network share, belongs to another machine sharing
a synced home directory, or was checked out, archived and will return.

Confirm each one. Where a project directory holds a `memory/` directory, ask
separately about reading those notes out before anything is discarded.

## Whether a plugin is still wanted

Plugins are never cleared automatically, so they are a real candidate for
unbounded growth. But size says nothing about use, and the script does not
guess: a large plugin used weekly stays, a small one never used may go.

Ask, and prefer the agent's own plugin commands to deleting directories.

## Whether one large transcript is a signal

The script lists the largest transcripts because a single oversized one usually
means a specific runaway task — a large file read repeatedly, a long loop, a
tool returning far more than expected — rather than ordinary use.

That is worth mentioning when it stands out sharply from the rest, as the
cause may recur. It is diagnosis, not a cleanup target: the file ages out on
its own.

In the project view this is flagged against the median session rather than a
fixed share of the total, because a share means different things at different
scales: one session of three is naturally a third of the project, while one of
eighty taking a tenth is not natural at all. The flag says a session is
unusual *for this project*. Whether that matters is still a judgement — a
single long migration session is a fine reason to be large, and no reason to
act.

## Whether one project's size is a problem

A project view answers "what is this costing", not "is something wrong". A
project can hold the largest share of the directory simply by being the one in
daily use.

Read it against use, not size: state for a project worked on today is a
working set, and the same figure for a project untouched for weeks is already
ageing out. Neither is a leak. Resist concluding anything about the directory
as a whole from one project — that needs the whole-directory view, where the
retention verdict and the kept areas live.

## What the script does not measure

- **Anything outside the agent directory.** Caches elsewhere in the home
  directory, logs written by other tools, and anything the agent installed
  outside its own tree are out of scope. Say so rather than implying the
  measurement is the whole picture.
- **What the disk needs overall.** If the owner is short of space, the agent
  directory may not be the largest thing worth looking at.
- **Whether deleting will actually help.** On a copy-on-write filesystem, with
  snapshots, or inside a backed-up home directory, deleted files may not return
  space immediately. Worth a sentence where it applies rather than promising a
  figure.
