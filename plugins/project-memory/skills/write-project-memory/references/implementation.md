# Applying the recommendation

Only after the owner has approved it. Order matters here: verify before
writing, and reconcile before adding.

## 1. Verify every claim

A memory file that names something which does not exist teaches an agent to
invent things. Check, do not assume:

- **Every command runs.** Each one appears in `package.json` scripts, the
  Makefile or the task runner. Where it is cheap and safe, run it. A `test`
  script that fails for everyone is worth knowing about before it becomes a
  rule.
- **Every path exists**, spelled exactly as written, case included.
- **Every tool named is a dependency**, in the manifest rather than assumed.
- **Every convention still holds** in files added recently, not only in old
  ones.

Fix what the check finds before writing, and tell the owner what changed from
what they approved.

## 2. Reconcile what already exists

Adding a file next to contradicting ones leaves the agent exactly where it
started, and now with a third voice.

For each instruction file the audit found:

- **Superseded** — offer to delete it, or to replace its body with a pointer
  to the new file. Never delete without asking.
- **Still used by another agent** — reconcile the content so they agree, and
  prefer the single-source arrangement in `references/formats.md` over two
  maintained copies.
- **Different scope** — a `CONTRIBUTING.md` aimed at humans can coexist. Say
  how they divide, so the next person does not merge them.

Where a `CLAUDE.md` is being added to a repository that has an `AGENTS.md`,
remember that this stops Claude reading the `AGENTS.md` at all by default.
Import it rather than stranding it.

## 3. Write it

Write the approved text. Keep sections in the order presented, since the owner
reviewed that order.

For a monorepo with per-package files: write the root first, then each package
file with only its own differences. After each one, re-read the root and check
you have not duplicated a rule into both. A rule in two places becomes a
contradiction the first time one copy is edited.

Where the owner's agents read different filenames, set up the single-source
arrangement from `references/formats.md` — import for most cases, symlink only
where there is no agent-specific content and no Windows clone.

## 4. Confirm it loads

Writing the file is not evidence that an agent reads it.

In Claude Code, `/context` lists what actually loaded under **Memory files**.
Worth checking for anything nested, imported or symlinked, where the failure
is silent and the file looks fine on disk.

If it does not appear: check the filename and location against
`references/formats.md`, and check whether an `AGENTS.md`/`CLAUDE.md`
interaction or a `claudeMdExcludes` pattern is suppressing it.

## 5. Leave it maintainable

A memory file decays. Two things make the decay visible:

- **Note what will need revisiting** — the rules tied to a layout or a
  migration in progress. An HTML comment is free in Claude Code, since
  block-level comments are stripped before the content reaches the context.
- **Point the contributing guide at it**, where one exists, so a human
  changing the conventions knows there is a second place to update.

Mention `/doctor prompt-audit` as the periodic check for staleness and
contradictions. It is cheaper than a rewrite and it catches the common decay.

## 6. Stop there

Do not commit unless the owner asks. Report what you wrote, where, and what
you verified.

If the audit turned up something that should be a hook, a lint rule or a CI
check rather than a line of advisory text, say so once — a rule the toolchain
enforces beats a rule an agent is asked to remember. Do not build it unasked.
