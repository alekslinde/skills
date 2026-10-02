# What goes in the file, and what does not

A memory file is read before every task in the repository. Its budget is
attention, not bytes: each line makes every other line slightly less likely to
be followed. Write accordingly.

## The test for a line

A line earns its place when an agent would get it wrong without it.

Apply it honestly. "Use TypeScript" fails — the agent can see the `.ts` files.
"Prefer `type` over `interface`" passes only if the codebase is consistent
about it. "Don't add dependencies without asking" passes in most repositories,
because agents do this freely otherwise.

Three questions that settle most cases:

1. Would an agent reading the code already do this? If yes, cut it.
2. Can an agent act on it? "Be careful with auth" cannot be acted on. "Changes
   under `src/auth/` need a human reviewer" can.
3. Is it still true next quarter? Line counts and file inventories go stale in
   weeks. Rules about intent survive.

## Sections worth having

Not every project needs all of these, and a file with three good sections
beats one with eight padded ones.

**What this project is** — one or two sentences, enough to orient. Stack,
runtime, and whether it is one deliverable or several. Skip what the manifests
already say plainly.

**Package manager** — only the name and the install command, and only when
more than one is plausible. Worth its line because the failure is costly.

**Structure** — where new code of each kind goes. Name the directories that
receive new work, not an inventory of everything present. A tree is only worth
including when the layout is genuinely non-obvious.

**Commands** — the ones an agent should run, and the ones it must not run
unprompted. Verified to exist.

**Off limits** — generated, vendored and externally managed paths, each with
what regenerates it.

**Conventions** — only where the codebase is consistent and the convention is
not visible from a single file. Test placement, import style, and the state or
data library actually in use are the usual earners.

**Project-specific gotchas** — the things a new contributor always has to be
told. These are the highest-value lines in the file and the hardest to
discover; they come from asking the owner, not from reading code.

## What to leave out

**Anything in the global memory file.** It already applies. Repeating it
wastes the budget twice and creates two copies to keep in sync.

**Generic engineering advice.** "Write tests", "handle errors", "keep
functions small". Every agent already weights these; restating them adds
nothing and makes the file look like boilerplate, which invites skimming.

**What the code says plainly.** Dependency lists, the framework's own
conventions, anything a glance at a file would answer.

**Aspirations.** If the codebase does not do it, it is not a convention. Write
it down only once it is true, or write it as a stated migration with the
direction named.

**Volatile detail.** File counts, line counts, inventories, "currently
has N components". These are wrong within weeks and make the whole file look
untrustworthy.

**Anything from `references/safety.md`.** Machine paths, identifiers,
credentials, infrastructure names, and where the project is weak.

## Length

Aim for under a hundred lines for a single-project repository. Past that,
check whether sections are describing the code rather than correcting an
agent's default behaviour.

Length is a symptom, not the problem. A hundred and fifty lines of
hard-won gotchas is a good file. Forty lines of generic advice is a bad one.
Apply the test for a line, and the length follows.

## Monorepos

Two shapes work, and the choice is about whether packages genuinely differ.

**One root file** when packages share a stack and rules. Simpler, and nothing
goes stale in a corner nobody reads. Name per-package exceptions inline.

**Root plus per-package files** when packages differ in stack, framework or
constraints — a React app and a Go service, say. Claude Code reads the root
file and the one nearest the files being edited, so the root holds what is
shared and each package file holds only its own differences.

Do not duplicate shared rules into package files. A rule in two places becomes
a contradiction the first time one copy is updated.

Default to one root file and split only when the audit shows real divergence.
Splitting early produces thin files nobody maintains.

## Tone

Write rules as instructions, in the imperative. "Run `pnpm test` before
committing" lands better than "tests should be run before committing", which
reads as a wish.

State the reason only where it is not obvious and where knowing it changes how
the rule generalises. "Don't edit `src/api/generated/` — regenerate with
`pnpm codegen`" needs its clause. "Use pnpm" does not.
