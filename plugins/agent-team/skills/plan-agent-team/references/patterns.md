# How agent teams work together

## Orchestration patterns

| Pattern | How it works | Fits | Watch for |
| --- | --- | --- | --- |
| Lead and workers | A lead plans, delegates tasks to role agents, and assembles results | Requests that span several roles | The lead becomes a bottleneck; give it clear delegation rules |
| Pipeline | Work moves through fixed stages: spec → design → build → test → review | Feature work with a stable process | Slow for small changes; allow a fast path |
| Parallel owners | Each area's owner works independently in its own branch or worktree | Repos with independent parts | Changes that cross areas need a lead or a contract |
| Reviewer loop | A producer and a reviewer iterate until the reviewer passes the work | Security, copy, design quality | Cap the number of rounds |
| Scheduled and background | Agents run on a schedule or event (dependency updates, research sweeps, CI watching) | Recurring chores | Make every run produce a reviewable artifact, or stay silent when nothing changed |

Most teams mix them: a lead for cross-cutting requests, parallel owners for
day-to-day work, reviewer loops at the gates, and scheduled agents for chores.

## Handoffs

Every handoff is an artifact a person can open:

| From → to | Artifact |
| --- | --- |
| Product → design | Spec with acceptance criteria (an issue or doc) |
| Design → engineering | Flow, mock-up or interaction spec, plus copy |
| Engineering → quality | Pull request with what changed and how to test it |
| Quality → engineering | Test report or failing test, in the pull request |
| Any → security | Pull request or design flagged for review |
| Any → owner | Pull request, review summary or decision request |

Each role's definition names what it accepts and what it produces.

## Avoiding conflicts

- **Ownership by path.** Map each directory or artifact to one owning role.
  Other roles open pull requests or request changes; they do not edit there.
- **Isolation.** Parallel writers use separate branches or worktrees and merge
  through pull requests, so two agents never edit one checkout at once.
- **Contracts at the seams.** Where areas meet (an API between frontend and
  backend, a schema between backend and database), the contract has its own
  owner and changes first.
- **Small units.** One task, one branch, one pull request. Long-lived agent
  branches drift and conflict.

## Gates

| Gate | Who or what | Can an agent waive it? |
| --- | --- | --- |
| CI: lint, types, tests, security scans | Automated | Never |
| Cross-role review (security, accessibility, copy) | A different role from the author | No |
| Merge, release, deploy, anything public | The owner | No, unless the owner delegated a specific, limited right |

## Cost

- Every agent call starts without the others' context and re-reads what it
  needs; many small agents can cost more than one well-instructed agent.
- Put read-heavy work (exploring, reviewing) on cheaper or faster models, and
  reasoning-heavy work (architecture, security, design decisions) on the
  strongest.
- Scheduled agents should exit early when there is nothing to do.
- Measure: after the first week, compare cost per merged change and review
  burden against working with a single agent.
