<!--
Thanks for the pull request. Delete any section that does not apply.
Contributions are accepted under Apache-2.0; see CONTRIBUTING.md.
-->

## What this changes

<!-- One or two sentences. For a new skill, what it does and when an agent
     should load it. -->

## Why

<!-- The problem this solves. For a skill, the mistake it stops someone
     making, or the question it answers that they would otherwise get wrong. -->

## How it was verified

<!-- These skills are judged by what they do to a real repository, so please
     say more than "validated". Which project did you run it against, and what
     did it do? Paste the recommendation table or the questions it asked if
     they are the point of the change. -->

- [ ] `claude plugin validate .` passes
- [ ] `claude plugin validate plugins/<name>` passes for each plugin touched
- [ ] `pipx run reuse lint` passes
- [ ] Ran the skill end to end against a real project

## Version

- [ ] Bumped `version` in the changed plugin's `plugin.json` — installed copies
      are pinned and stay on the old version until this changes
- [ ] Not needed (no plugin behaviour changed)

## Checklist

- [ ] One change per pull request
- [ ] `README.md` table updated if a plugin was added, renamed or repurposed
- [ ] New `SKILL.md` frontmatter `description` names the triggers that should
      load it
- [ ] Long material lives in `references/`, keeping `SKILL.md` short
- [ ] The work is mine to submit under Apache-2.0, or any third-party material
      is noted below with its licence so it can be added to `NOTICE`
- [ ] No absolute paths, usernames, hostnames, tokens or other local details in
      the diff

## Third-party material

<!-- Name, origin, licence, and where it is used. Write "none" if there is
     none. -->

none
