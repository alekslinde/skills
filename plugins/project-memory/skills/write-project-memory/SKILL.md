---
name: write-project-memory
description: Write or repair the project memory file an agent reads on every task (CLAUDE.md, AGENTS.md and their equivalents), by auditing what the repository already proves about itself, asking the owner only what the code cannot answer, and writing a file that holds only what an agent would otherwise get wrong. Use when someone wants a CLAUDE.md or AGENTS.md written, reviewed, slimmed or split across a monorepo, says an agent keeps ignoring or breaking their project conventions, is onboarding agents to an existing codebase, or asks what belongs in project instructions.
---

# Write a project memory file

Work in four phases, in order: **audit, ask, recommend, apply**. Never write or
change a memory file before the owner approves the recommendation.

A project memory file is the text an agent reads before every task in a
repository. Claude Code reads `CLAUDE.md`; several other agents read
`AGENTS.md`. The format differs slightly, the discipline does not, so decide
the content first and write it to whichever filenames the owner's agents read
(`references/formats.md`).

Hold to these principles, and state the relevant ones when you explain a
choice:

- **Only what an agent would otherwise get wrong.** Every line competes for
  attention with every other line. A convention the code already makes obvious
  is a line that dilutes the ones that matter.
- **The repository is the evidence.** Write what the code proves, not what the
  owner wishes were true. An aspiration in a memory file is a lie an agent acts
  on.
- **Inherit, do not restate.** Anything in the owner's global memory file
  applies already. Repeating it in the project file wastes the budget twice and
  creates two copies to keep in sync.
- **Specific beats complete.** "Don't edit `src/api/generated/` — regenerate
  with `npm run codegen`" changes behaviour. "Write clean code" does not.
- **Say where, not just what.** A rule an agent cannot locate is a rule it
  cannot follow. Name real paths and real commands, verified to exist.
- **It decays.** A memory file describing a layout that moved is worse than no
  file. Prefer rules that survive refactors, and say what will need revisiting.
- **It is public.** Treat the file as world-readable and permanent
  (`references/safety.md`). It must not record machine paths, personal
  identifiers, credentials, infrastructure names, or where the project is
  weak.

## Phase 1: Audit

Read the repository before asking anything. Every fact you can find yourself is
a question the owner should not have to answer. Report what you found as one
short table before the first question.

Run `scripts/inspect.mjs <repo-path>` for the mechanical half — stack,
package manager, scripts, workspace layout, generated and vendored paths,
existing memory files, commit-scope history. It is read-only and
dependency-free. Everything it cannot decide is listed in
`references/audit.md` and stays yours to judge.

Find:

1. **What the project is.** Language, framework, runtime, and whether it is one
   deliverable or several. Read manifests and lockfiles, not the README's
   claims about itself.
2. **The package manager**, from the lockfile that is actually committed, not
   from a `packageManager` field that may be stale. A wrong answer here makes
   an agent corrupt a lockfile on its first task.
3. **The real structure**, from the directory tree as it exists. Note where new
   code of each kind actually lands, which is often not where a README says it
   should.
4. **Commands that matter**, from `package.json` scripts, Makefiles, task
   runners and CI workflows. Separate the ones an agent needs (test, lint,
   typecheck, dev, build) from the ones it must never run unprompted (deploy,
   publish, migrate, reset).
5. **What must not be edited.** Generated output, vendored dependencies, build
   artefacts, anything with a "do not edit" banner, anything in `.gitignore`
   that is nonetheless committed. For each, find what regenerates it.
6. **Conventions the code votes for.** Sample real files rather than trusting
   config: import style, test placement and naming, component and file naming,
   state and data-fetching libraries in actual use. Where the codebase is
   inconsistent, note the split and which way recent commits lean — that is a
   question, not a finding.
7. **Commit and branch history.** `git log` subjects for an existing scope
   vocabulary and message format, and branch names for a prefix convention.
   Scopes that already exist beat scopes someone invents.
8. **Existing instruction files**, including `CLAUDE.md`, `AGENTS.md`,
   `.cursorrules`, `.github/copilot-instructions.md`, `CONTRIBUTING.md` and
   editor config. Note where they disagree with each other or with the code.
9. **The owner's global memory file**, if one is readable, so the project file
   can inherit it instead of repeating it. Note every overlap you find.

## Phase 2: Ask

Ask only what the audit left open. Use the AskUserQuestion tool when it is
available: at most four questions per call, two to four options each, the
recommended option first and labelled "(Recommended)", and a description on
every option saying what choosing it means in practice. Without it, ask in
plain text, numbered.

Skip any question the audit answered, and word the rest around what you found
("Your `src/api/generated/` is committed but has a codegen script — should
agents treat it as off limits?" rather than "Any off-limits paths?").

### Intent behind what the code shows

- Where the codebase is inconsistent, which way is deliberate? Offer the way
  recent commits lean as the recommended option, and "both are fine, don't
  mention it" as a real choice.
- Which patterns are being migrated away from? A rule that enshrines the old
  way is worse than no rule.

### Boundaries

- Which paths are off limits, and why — generated, vendored, externally
  managed, or load-bearing in a way that is not visible?
- Which commands must an agent never run without being asked?

### Scope and inheritance

- Which agents read this repository, so the content lands in the filenames they
  read (`references/formats.md`)?
- If a global memory file was found: confirm it applies here, so the project
  file can drop everything it already covers.
- For a monorepo: one root file, or a root file plus per-package files? Offer
  nested files when packages genuinely differ in stack or rules, and one file
  when they do not (`references/structure.md`).
- Should the file be committed, so it applies to everyone and to CI, or stay
  local to the owner?

### Judgement the code cannot show

- What has an agent already got wrong in this repository? The best lines in a
  memory file come from this question; ask it directly.
- What does a new contributor always have to be told?

## Phase 3: Recommend

Present, in this order:

1. **The proposed file or files in full**, as they would be written. This is
   short enough to read, and reviewing the real text beats reviewing a summary
   of it.
2. **A line-by-line justification table** for anything non-obvious: the rule,
   the evidence in the repository, and what an agent does differently because
   of it.
3. **What you deliberately left out**, as categories with the reason — covered
   by the global file, obvious from the code, too volatile to be worth it.
   This is the most useful part of the review and the easiest to skip.
4. **What will need revisiting**, and the signal that it has gone stale.
5. **Where it goes**: each filename, each directory, and whether it is
   committed or ignored.
6. **Open questions** that remain.

Run the proposed text through `references/safety.md` before presenting it, and
say that you did. If the audit found something that must not be written down,
leave it out and do not describe the gap — naming a withheld thing discloses
more than omitting it silently.

Ask for approval. Adjust and re-present if the owner changes anything.

## Phase 4: Apply (only after approval)

Follow `references/implementation.md`. Write the file, verify every path and
command in it actually exists and runs, and reconcile it with the instruction
files the audit found — a new file that contradicts a `.cursorrules` left in
place puts an agent back where it started. Offer to delete or redirect the
superseded ones rather than leaving both.

Where the owner's agents read different filenames, do not maintain two copies
by hand: write the content once and point the others at it
(`references/formats.md`).

Commit only if the owner asks. If the repository has a contributing guide,
offer a line pointing to the new file.
