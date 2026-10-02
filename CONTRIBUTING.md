# Contributing

Thanks for looking. This repository holds agent skills: each one is a folder
with a `SKILL.md`, wrapped in a Claude Code plugin so it can be installed and
versioned.

## Licensing of contributions

Contributions are accepted under the project's licence, Apache-2.0. By opening
a pull request you confirm the work is yours to submit and agree it is licensed
under Apache-2.0, the same terms as the rest of the repository. There is no CLA
to sign and no sign-off trailer to remember.

You keep the copyright in what you write. New files need no SPDX header: the
`path = "**"` annotation in `REUSE.toml` covers every file in the repository.
If you want your own copyright line, add one to `REUSE.toml` for your paths.

Do not paste in material you did not write — documentation, blog posts, another
project's prompt files — unless its licence allows it and you say so in the pull
request, so the attribution can go in `NOTICE`.

## What makes a good skill here

The skills in this repository share a shape, and a new one is much easier to
review if it follows it:

- **Audit before asking.** Read the project first. Every fact the code can
  answer is a question the user should not have to.
- **Ask only what is left**, through `AskUserQuestion` where it exists, with the
  recommended option first and a description saying what each choice means in
  practice. Degrade to plain text for agents without the tool.
- **Recommend once, as a table**, with the reasoning and the constraints each
  choice creates.
- **Apply only after approval**, and never edit files before then.
- **Say when something is not advice.** The existing skills state plainly that
  they give general information, not legal or professional advice.
- **Keep the frontmatter honest.** The `description` is what an agent matches a
  request against, so it should name the triggers, not sell the skill.

Long material belongs in `references/*.md`, loaded when needed, so `SKILL.md`
stays short. Scripts belong in `scripts/`, and the one in this repository is
dependency-free and read-only on purpose — a tool that mutates what it inspects
is not one you would run twice.

## Adding a plugin

1. Create the manifest and the skill:

   ```
   plugins/<name>/.claude-plugin/plugin.json
   plugins/<name>/skills/<skill>/SKILL.md
   ```

   Give `plugin.json` a `name`, a `version` of `0.1.0`, a `description`, an
   `author`, the `repository` URL and `keywords`.

2. Add an entry to `.claude-plugin/marketplace.json` whose `name` matches the
   `name` in `plugin.json` exactly, with `source` set to `./plugins/<name>`.
   A mismatch makes the plugin uninstallable.

3. Validate both levels:

   ```bash
   claude plugin validate .
   claude plugin validate plugins/<name>
   ```

4. Add a row to the table in [README.md](README.md).

5. Install it locally and run it against a real project before opening the pull
   request. These skills are judged by what they do to a repository, which no
   amount of reading the Markdown will tell you.

## Changing an existing plugin

Bump the `version` in that plugin's `plugin.json`. Installed copies are pinned
and stay on the old version until the number changes, so a fix with no bump
reaches nobody. Patch for wording and fixes, minor for new behaviour or
questions, major when existing usage breaks.

## Checks

Before opening a pull request:

```bash
claude plugin validate .                 # marketplace manifest
claude plugin validate plugins/<name>    # each plugin you touched
pipx run reuse lint                      # licensing metadata
```

`reuse lint` reads SPDX ids wherever it finds them, including inside fenced code
blocks in documentation. Wrap example headers in `REUSE-IgnoreStart` and
`REUSE-IgnoreEnd` comments, as `plugins/licensing/.../references/implementation.md`
does.

## Pull requests

Keep one change per pull request, and fill in the template: what changed, why,
and how you verified it. For a new or changed skill, describe the project you
ran it against and what it did. Commit messages follow
`<type>(<scope>): <description>`, for example `feat(licensing): ask about
trademarks`.
