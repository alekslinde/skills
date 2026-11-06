# Reclaiming Actions storage

Only after the owner has approved a specific list of run ids. Everything here
assumes that approval already exists and names exactly what it covers.

## Order of preference

1. **Shorten the retention setting.** The durable fix — see
   `references/layout.md`. Often the only change actually needed; it costs
   nothing to apply alongside a one-off prune.
2. **Run `scripts/reclaim.mjs` without `--apply` first**, always, and show the
   owner the real output before anything is removed.
3. **Re-run with `--apply`** only once the dry run's list matches what was
   approved.

## Running it

```
node scripts/reclaim.mjs <owner/repo> --run-ids 123,456,789            # dry run
node scripts/reclaim.mjs <owner/repo> --run-ids 123,456,789 --apply    # deletes
```

Add `--delete-runs` to also remove the run record itself, not just its
artifacts. Without it the run stays visible in the Actions tab with its
artifacts gone — which is the lower-risk choice, since the run's logs and
history survive. Only add it if the owner specifically wants the Actions tab
tidied, not just the quota freed.

**Tidying the run list with no artifacts in play** is the same script, just
with an empty artifact loop: `reclaim.mjs` lists zero artifacts for each id,
then deletes the run record if `--delete-runs` was passed. This is the entire
path for a repository like one with thousands of runs and 0 B of artifact
storage — there is nothing to free, so `--delete-runs` is not optional here,
it's the only thing the command does.

**The run-id list comes from the owner's approval, never from re-deriving
"older than the kept N" inside the reclaim step.** `inspect.mjs` reports which
runs that threshold would catch; copy that list into the approval, and pass
exactly those ids. If `inspect.mjs` was run again between measuring and
reclaiming and a new run has aged past the threshold, that new run is not on
the approved list and should not be passed, even though it would now qualify
by the same rule — go back and ask rather than widening the scope.

**Always dry run, and show the real output**, not a summary of it. The dry
run is where a wrong run id gets caught, and that is the failure this whole
phase exists to prevent — once an artifact is deleted there is no undo, and
GitHub does not keep a trash.

If the dry run lists an artifact the owner did not expect — far larger than
estimated, or from a run that looked already expired — stop and go back to
them rather than proceeding on the assumption it is fine.

## What this does not touch

- **The retention setting itself.** Apply that separately in
  `Settings → Actions → General`; no API call in this skill changes it.
- **Logs.** Only artifacts and, with `--delete-runs`, run records. A
  logs-heavy repository with few artifacts will not see much change from this
  script; the retention setting is what shortens log lifetime.
- **Other repositories in the same account.** Quota is pooled; running this
  against one repository does not free space another repository's artifacts
  are holding. See `references/layout.md`.

## Afterwards

Re-run `scripts/inspect.mjs` and report the measured total, not the count
`reclaim.mjs` printed while deleting — GitHub's own accounting can lag a
delete by a short while, so if the number looks unchanged say that rather
than concluding the delete failed.

State what is now in place to stop it recurring: the retention window in
force, and which workflow (if any) is still the largest contributor and worth
revisiting if it grows again.
