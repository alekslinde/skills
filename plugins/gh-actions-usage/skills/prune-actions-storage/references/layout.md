# What is actually billed

GitHub's Actions storage quota is charged against **artifacts and logs**, not
against the list of workflow runs itself. A run with its artifacts already
expired costs nothing to leave in the Actions tab — hiding it there would not
free anything.

- **Artifacts** (`actions/upload-artifact`, cache misses that got uploaded,
  coverage reports, build output kept for a job) are the bulk of what fills
  the quota on most repositories. Each has a `size_in_bytes` and an
  `expired` flag once GitHub's own retention has passed it — expired
  artifacts are already excluded from new storage charges but can still show
  in a listing until GitHub's own sweep clears the row.
- **Logs** also count, but are far smaller per run and have no API-level
  per-run size the way artifacts do; they are not what this skill measures or
  deletes.
- **The run record itself** (status, timing, the workflow file reference) is
  metadata. Deleting it does not change the quota. It is worth removing only
  for tidiness in the Actions tab, and removing it loses the run's logs and
  history along with its artifacts.

Quota is billed at the **account or organisation level**, pooled across every
repository that account owns — not per repository. A repository that looks
small can still be contributing to an account that is over quota, and
emptying one repository's artifacts may not be the fix if another repository
in the same account holds more.

## Retention

`Settings → Actions → General → Artifact and log retention` sets how long a
newly uploaded artifact survives before GitHub expires it automatically,
default 90 days, configurable down to 1. This is the durable fix, the same
role `cleanupPeriodDays` plays for an agent's own transcripts — shortening it
stops the next quarter's backlog without anyone deleting anything by hand.
It has no effect on artifacts already uploaded under the old setting.

A workflow can also set retention per artifact, in the `upload-artifact` step
(`retention-days:`), which is where a logs-heavy job can be trimmed to a few
days while a release-artifact job keeps the account default.

## Why "workflow" and "run" are not the same thing

A **workflow** is the YAML file (`ci.yml`, `release.yml`) — there are usually
only a handful per repository. A **run** is one execution of it, and a busy
workflow can have thousands. "Keep the last 5" means 5 per workflow, not 5
across the repository — a repository with three workflows and `--keep 5` has
up to 15 runs left untouched, not 5.
