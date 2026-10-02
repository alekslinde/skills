# Setting up the team

Do this only after the owner approves the plan. Land it in one pull request,
starting with the smallest useful team.

## 1. Shared instructions first

Every role reads the project's general instructions. Make sure they exist and
cover what all roles need: what the product is, the structure, commands,
conventions, and the rules that must never be broken. Use the instruction
file each agent in use reads; `AGENTS.md` is read by many agents, and some
have their own (check each agent's docs). Keep role-specific instructions out
of these files.

## 2. Neutral team files

Write the team once, independent of any agent tool. Ask where they should
live if the repository has rules about where docs go; otherwise use
`agents/` at the root.

`agents/TEAM.md`: the roster table, the orchestration pattern, the flow of a
typical task, the ownership map (path → role), the gates, and what needs the
owner.

`agents/roles/<role>.md`, one per role:

```markdown
---
name: security-reviewer
description: Reviews changes that touch authentication, user input, secrets or personal data, and reports risks with fixes. Use for any pull request touching those areas.
discipline: security
owns: []                       # paths or artifacts this role writes
reads: ["**"]
capabilities: [read, search, run-scanners]   # read, search, edit, run-tests, run-app, browse, web, shell
model_tier: strongest          # fast | balanced | strongest
reviewed_by: owner
accepts: pull request, design or spec flagged for security review
produces: review comments with severity and a proposed fix
---

## Responsibilities
## How to work
## Done when
## Never
```

Keep each role short. It inherits the shared instructions; it states only
what is different about this role. "Never" lists the project rules this role
is most likely to break.

## 3. Translate per platform

Generate each agent tool's own files from the neutral ones. The neutral files
stay the source of truth; regenerate the translations when a role changes.

Before writing any translation, read that tool's current documentation for:
where agent or subagent definitions go, their file format and fields, how
tool or capability restrictions are expressed, how a model is chosen, and
whether parallel, isolated (worktree) or scheduled runs are supported.

Map the neutral fields as far as the tool allows:

| Neutral field | Becomes |
| --- | --- |
| `name`, `description` | The agent's name and the description the tool uses to decide when to delegate |
| `capabilities` | The tool's allow-list of tools; omit edit and shell tools for read-only roles |
| `model_tier` | The tool's model setting, or the default if it has none |
| `owns` | A sentence in the agent's instructions, and where the tool supports it, path rules or hooks that block edits elsewhere |
| Body | The agent's instructions |

When a tool has no concept of separate agents, the role files still work: the
owner or a lead agent loads a role's file as the prompt for a session or task.

## 4. Coordination

- **Lead.** If the plan has a lead role, its instructions include the roster,
  the ownership map and the delegation rules.
- **Isolation.** Parallel writing roles get their own branch or worktree per
  task, if the tool supports it; otherwise run them one at a time.
- **Schedules.** Recurring roles run from CI schedules or the tool's
  scheduling feature, and open an issue or pull request only when they have
  something to report.
- **Gates.** Confirm the required CI checks and review rules exist; add
  missing ones as separate, reviewable changes.

## 5. Prove it

Run one real task through the team end to end, for example a small feature
that touches design, code, tests and review. Report what each role did, what
it cost, what conflicted or stalled, and what to change before adding more
roles.

## Rules while applying

- Do not grant any role merge, release, deploy or production access unless the
  owner approved that exact right.
- Do not weaken existing project rules to make a role's work easier.
- Keep translations generated from the neutral files; never edit a
  translation by hand without updating the neutral file.
