---
name: plan-agent-team
description: Assess which agent roles a project needs across engineering, design, product, security, quality, docs and operations, design the team (roles, ownership, handoffs, orchestration, review gates) and set it up in an agent-neutral form, translated for whichever coding agents the owner uses. Use when someone asks whether a project would benefit from multiple agents or subagents, wants an agent team or roles defined, wants to split work across agents, or asks how agents should coordinate on a codebase.
---

# Plan an agent team

Work in four phases, in order: **audit, ask, recommend, apply**. Never create
or change agent definitions, instructions, hooks or schedules before the owner
approves the recommendation.

This skill is agent-neutral. It designs the team once, as plain role files,
then translates them for the agents the owner actually uses. Before naming any
agent-specific feature (subagents, agent files, worktrees, background or
scheduled agents), check that agent's current documentation: these features
change faster than this skill.

Hold to these principles, and state the relevant ones when you explain a
choice:

- **Roles follow the work, not an org chart.** A role exists because the
  project has work of that kind, often enough, that benefits from its own
  focus, context or tools. Name the evidence for every role.
- **Right-size the team.** Start with the roles that pay for themselves now and
  list the rest as "add when". Every agent costs tokens and starts without the
  others' context; coordination costs grow with team size.
- **One owner per area.** Each file path or artifact has exactly one role that
  writes it. Others read, review or request changes. This is what prevents
  agents overwriting each other.
- **Handoffs are artifacts.** Roles pass work through things a person can read:
  an issue, a spec, a design, a pull request, a review, a test report. Never
  through memory of a conversation.
- **Independent review.** Work is checked by a different role than the one that
  produced it, and by automated gates (CI, linters, tests) that no agent can
  waive.
- **People decide.** The owner approves direction, merges, releases, and
  anything outward-facing. Agents propose.
- **Least privilege.** Each role gets only the capabilities it needs: a
  reviewer reads, an explorer searches, only builders edit, only release roles
  ship.

## Phase 1: Audit

Read the repository and its surroundings before asking anything, and report
what you found as one short table before the first question.

Find:

1. **What the product is and its parts.** Frontend, backend and APIs, data
   stores, mobile, extensions, packages, workers, infrastructure, docs, and how
   each ships.
2. **Kinds of work the project has, with evidence.** Use recent commits, open
   issues and pull requests, CI workflows, scheduled jobs and the docs. Look
   for UI and design work (components, styles, design tokens, assets,
   copy), security work (threat models, scanners, security policy, auth code),
   data work (schemas, migrations), quality work (test suites, e2e, visual or
   accessibility tests), operations (deploy scripts, infrastructure as code,
   monitoring), content (docs, research, translations), and recurring jobs
   (dependency updates, sweeps, triage).
3. **Volume and rhythm.** Which areas change most, which work recurs on a
   schedule, which work waits on review. A role for work that happens twice a
   year is rarely worth defining.
4. **Existing agent setup.** Instruction files (`AGENTS.md`, `CLAUDE.md` and
   other agents' equivalents), skills, agent or subagent definitions, hooks,
   scheduled or background agents, bots in CI. Note what each agent tool in use
   reads.
5. **Constraints the team must respect.** Rules in the instruction files and
   CONTRIBUTING (things that must never happen, areas needing sign-off),
   protected branches, required checks, privacy or security commitments,
   licensing boundaries between directories.
6. **People.** Who maintains the project and who reviews what (CODEOWNERS,
   review history). Agents should route work to these people, not around them.

## Phase 2: Ask

Ask only what the audit left open. Use the AskUserQuestion tool when it is
available: at most four questions per call, two to four options each, the
recommended option first and labelled "(Recommended)", and a description on
every option saying what choosing it means in practice. Without it, ask in
plain text, numbered.

### Goals

- What should the team take off the owner's plate: building features, reviews,
  design, security, testing, recurring chores, research, or all of these?
- How autonomous should it be: propose only, open pull requests for review, or
  merge within limits? Recommend pull requests for review.

### Roles

- Show the candidate roles from `references/roles.md` that the audit found
  evidence for, grouped by discipline, and ask which to include now, later or
  never. Offer subtypes where the work is distinct (UX research is not visual
  design; application security is not infrastructure security).
- Are there roles the audit could not see: product management, analytics,
  marketing, support, legal or compliance, domain research?

### Working together

- How should work flow: a lead that plans and delegates, a pipeline (spec →
  design → build → test → review), parallel owners per area, or a mix? See
  `references/patterns.md`.
- Where do handoffs live: issues, pull requests, design files, docs?
- Which decisions need the owner every time?

### Platforms and budget

- Which agents will run the roles (one tool, or several)? Which can run in
  parallel or in the background?
- Is there a budget per day or per task, and which roles warrant the strongest
  models?

## Phase 3: Recommend

Present, in this order:

1. **The roster.** One table, one row per role: discipline, what it does,
   evidence from the audit, what it owns (paths or artifacts), capabilities,
   model tier, who reviews its work. Separate "now" from "add when".
2. **How it works together.** The orchestration pattern, and the flow of a
   typical piece of work from request to merge as a numbered list or a
   diagram, with each handoff artifact named.
3. **Gates and guardrails.** Automated checks, cross-role reviews, human
   checkpoints, and the project rules each role must follow.
4. **Cost and risk.** Which roles run often and on which model tier, where
   parallel agents could conflict, and how ownership prevents it.
5. **Single-agent improvements first.** Instruction-file, skill or hook changes
   that help every role, and that the team depends on.
6. **Implementation breakdown.** The files and settings to create, per role
   and per platform, from `references/implementation.md`, in the order they
   should land.

Ask for approval. Adjust and re-present if the owner changes anything. For a
large team, offer to write the plan up as a document first.

## Phase 4: Apply (only after approval)

Follow `references/implementation.md`. Write the neutral team files first, then
the translation for each agent platform in use, checking that platform's
current documentation for file locations and fields. Start with the smallest
useful team, have it handle one real task end to end, and report what worked
before adding roles. Never grant a role merge, release or deploy rights the
owner did not approve explicitly.
