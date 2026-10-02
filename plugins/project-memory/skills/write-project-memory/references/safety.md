# What must not go in the file

A project memory file is committed, read by every contributor and every agent,
and preserved in git history. Treat it as world-readable and permanent. A line
removed today stays in every existing clone.

This matters more for a memory file than for most files, because the audit that
produces it goes looking for exactly the things that should not be written
down: where the project is weak, what is fragile, what the owner's machine
looks like.

Run the proposed text through this list before presenting it, and say that you
did.

## Machine and identity

- Absolute paths from a home directory. Write repository-relative paths.
- Usernames, hostnames, machine names.
- Personal email addresses. Git authorship is the place for those.
- Internal URLs, dashboards, wikis, ticket systems on private hosts.
- Local port numbers tied to one person's setup, as opposed to the project's
  documented dev port.

## Credentials and infrastructure

- Keys, tokens, connection strings — including expired or example ones, which
  reveal the format and the service.
- Bucket names, queue names, project ids, account ids.
- Staging and internal hostnames, IP addresses.
- Names of internal services not already public in the codebase.

Where an agent needs to know a secret exists, name the variable, never the
value: "`STRIPE_SECRET_KEY` is required in `.env.local`" is fine.

## Security posture

This is the category the audit is most likely to surface and the easiest to
write down without thinking.

- Unfixed vulnerabilities or known gaps.
- "We don't currently validate X."
- Which checks can be bypassed, and how.
- Where authentication is weak, missing or stubbed.
- Which tests are disabled, skipped or known to be flaky in a way that hides
  real failures.

A memory file saying where a project is weak is a map for anyone who reads the
repository. If an agent genuinely needs the boundary, state the rule
positively: "All input to `src/api/` must be validated with the shared schema"
says what to do without saying what is currently missing.

## Private context

- Planning notes, internal reasoning, roadmap detail.
- Client, team or employer names not already public in the repository.
- Commercial terms, pricing discussions, contract detail.
- Anything written for an audience of one.

## Saying nothing about what you left out

When something must stay out, leave it out silently.

Do not write "kept private", "not documented here", "see internal notes", or
name a category and explain its absence. **Describing a withheld thing
discloses more than omitting it** — it confirms the thing exists and signals
that it is worth looking for.

State what does belong and stop. An allowlist discloses nothing.

The same applies to the explanation of a removal. When you take a leak out of
an existing file, the commit message and the surrounding text are the next
leak, and this is the common way the mistake happens twice.

## Reference by content, not by location

A rule should survive on its own and point nowhere. "Changes under `src/auth/`
need review from someone who knows the token flow" is self-contained. "See the
auth discussion in the team channel" points at something a reader cannot
reach, and tells them it exists.

## Prefer a check to a promise

Where the repository can enforce something, suggest the check rather than the
note. A rule in a memory file is advisory — agents treat it as context, not as
enforcement. A hook, a lint rule or a CI job is not.

If a check is added for paths that must never be committed, match a *shape* — a
path pattern — never a list of the exact strings being kept out. Such a list
is self-defeating: it makes that file the one place they all appear.

## If the audit finds a leak already committed

Report it plainly, including how far it spread: committed, pushed, published,
released. Say what is and is not recoverable.

Be accurate about the limits. Rewriting history does not reach existing clones,
forks, caches or anyone's local checkout, and a credential that was pushed
should be treated as disclosed and rotated, not merely removed. Do not imply
that deleting the line undoes the exposure.
