---
name: prune-actions-storage
description: Explain what a repository's GitHub Actions artifacts and logs are costing against the account's storage quota, across every workflow or for one, separating runs still worth keeping from artifacts nothing points back to, then reclaim only what the owner agrees to delete. Also handles tidying the Actions run list itself (deleting old run records) when that is what's being asked for, as a separate concern from freeing storage. Use when someone asks why Actions storage is full, has run out of GitHub Actions storage, wants to free up Actions quota, asks what is safe to delete from workflow runs or artifacts, wants to keep only the last N runs per workflow, wants to clean up or tidy the Actions tab / workflow run history, or asks for a free alternative to GitHub Actions because of storage limits.
---

# Prune GitHub Actions storage

Work in four phases, in order: **measure, explain, ask, reclaim**. Never
delete anything before the owner approves a specific list of run ids.

GitHub's Actions storage quota is billed for artifacts and logs, pooled
across every repository in the account — not for the list of workflow runs
itself. A run with no artifacts left costs nothing to leave alone. Most of
what looks like "too many old runs" is actually a small number of heavy
artifacts, and identifying which ones matters more than how many runs get
touched.

Hold to these principles, and state the relevant ones when you explain a
choice:

- **Measure before alarming.** A large artifact total is not automatically a
  problem; find out whether the account is actually near its quota before
  proposing deletion.
- **Artifacts are billed; run records mostly are not.** Deleting a run
  without artifacts tidies the Actions tab and frees nothing. Say which one
  the owner is actually asking for. Tidying the run list is a legitimate ask
  on its own — handle it as that, not as a lesser version of freeing quota.
- **Deleted is deleted.** GitHub keeps no trash for artifacts or runs. Weigh
  a mistaken deletion as far worse than quota left in use.
- **Fix the cause, not the symptom.** A shortened retention setting keeps
  working on its own. A manual prune today is a manual prune again next
  month.
- **The run-id list the owner approves is exactly what gets deleted** — never
  re-derive a wider list at delete time, even if more runs have aged past the
  same threshold since measuring.

## Phase 1: Measure

Run `scripts/inspect.mjs` for the mechanical half. It is read-only, deletes
nothing, and needs only the `gh` CLI, authenticated with access to the
repository:

```
node scripts/inspect.mjs <owner/repo>                # default: keep 5 per workflow
node scripts/inspect.mjs <owner/repo> --keep 10       # a different active-set size
node scripts/inspect.mjs <owner/repo> --json          # machine-readable
```

It reports the total artifact storage, how much of it is already past
GitHub's own expiry, a breakdown by workflow with how much sits in runs older
than the kept set, the largest individual artifacts across the repository,
and — separately — how many run records per workflow sit past the kept
threshold regardless of whether they hold any artifacts, since a repository
can have thousands of empty runs and 0 B of billed storage at the same time.

`--json` emits the same data as a structured object: top-level `totalRuns`,
`totalArtifactBytes`, `expiredArtifactBytes`, `totalStaleRuns`, plus
`workflows[]` (each with `name`, `runCount`, `bytes`, `prunableRuns`,
`prunableBytes`, `staleRunCount`, `staleRunIds` — the exact ids past the kept
threshold for that workflow, artifacts or not) and `largestArtifacts[]`.
`staleRunIds` across all workflows, flattened, is the list to carry into
Phase 3's approval when the ask is to tidy run records rather than free
storage.

Read `references/layout.md` for what is actually billed, why "keep the last
5" means 5 per workflow rather than 5 total, and why the account's quota is
pooled across every repository it owns — a healthy-looking repository can
still share an over-quota account.

If the owner has not said which repository, ask rather than guessing from the
working directory — the repo over quota is not always the one Claude is
currently open in.

## Phase 2: Explain

Report before asking. Lead with the total and whether the account is
actually constrained, not with a list of candidates to delete:

1. **The total**, split into artifact storage and what has already expired on
   GitHub's side.
2. **By workflow**, largest first: total size, run count, and how much sits
   in runs past the kept threshold.
3. **The largest individual artifacts**, since a handful of oversized ones
   (a debug build, an uncompressed coverage report) are often most of the
   total on their own.
4. **The retention setting**, if known or checkable — whether a shorter
   window would prevent this recurring, independent of any one-off prune.
5. **What this does not reach** — logs, the retention setting itself, and
   other repositories in the same account, briefly, so the conversation does
   not assume a full fix.

If the total is small or mostly already expired, say that plainly rather than
manufacturing a cleanup — but if the run count past the kept threshold is
large, say that too, as its own fact: it's a real tidy-up opportunity even
when storage is at 0 B, and the owner may want it regardless of quota.

## Phase 3: Ask

Ask only what the measurement left open. Use the AskUserQuestion tool when it
is available: at most four questions per call, two to four options each, the
recommended option first and labelled "(Recommended)", and a description on
every option saying what choosing it means in practice. Without it, ask in
plain text, numbered.

### Retention

- Is the current retention window right for how this repository is used?
  Offer shortening it when the backlog is large and old runs are rarely
  needed; keep it when builds are referenced long after the fact (a release
  artifact someone downloads months later).

### Scope

- How many runs per workflow to keep as the active set — the default of 5, or
  a different number.
- Delete artifacts only, or also the run records (`--delete-runs`)? Removing
  the run record loses that run's logs and history along with its artifacts,
  and only tidies the Actions tab — it does not free more quota than deleting
  the artifacts alone.
- Is anything being kept deliberately — a release build someone still
  downloads, a run kept as a reference?

Once scope is agreed, state the exact run-id list `inspect.mjs` identified as
older than the kept threshold, and get it approved as a list, not as a rule —
see `references/reclaim.md` for why the list is fixed at approval time. When
the ask is purely to tidy the run list (no artifacts involved), the approved
list is `staleRunIds` and the reclaim call always carries `--delete-runs` —
without it nothing in the Actions tab changes, since those runs already hold
no artifacts to delete.

## Phase 4: Reclaim (only after approval)

Follow `references/reclaim.md`. It covers running `scripts/reclaim.mjs`, which
only acts on the exact run-id list it is given — it does not decide which
runs qualify, that is `inspect.mjs`'s job, read by a person first.

The order that matters:

1. **Point the owner at the retention setting** first if shortening it was
   agreed (`Settings → Actions → General → Artifact and log retention`), so
   next quarter needs no manual prune. This is manual for the owner — there
   is no API call in this skill that sets it, so don't attempt one on their
   behalf.
2. **Dry run `reclaim.mjs` first**, always, and show the owner the real
   output before anything is removed. For more than a few hundred ids this
   runs for minutes, not seconds — let it finish before reading its output
   as final (see `references/layout.md` on rate limits).
3. **Delete only what was named in the approved list.** If the dry run shows
   something unexpected, stop and go back to the owner rather than widening
   the scope.
4. **Report what was actually freed**, measured by re-running `inspect.mjs`,
   not the count printed while deleting — GitHub's own accounting can lag a
   delete by a short while.

This skill gives general information about GitHub's billing and retention
behaviour, not an authoritative answer about a specific account's quota or
charges — confirm anything billing-sensitive against the account's own
`Settings → Billing` page.
