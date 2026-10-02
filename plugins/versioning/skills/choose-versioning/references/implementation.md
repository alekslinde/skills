# Applying the model

Do this only after the owner approves. Land the tooling in one pull request,
then move each part's shipping onto releases in its own pull request, lowest
risk first. Keep every part's old path working until its new path has shipped
a release.

## Steps

1. **Repository settings** (the owner changes these; you list them):
   squash-only merges with the PR title as the commit message, if agreed; a
   PR-title check; branch-protection exceptions the release workflow needs.
2. **Release tool config**, seeded with each part's current version so the
   first release continues from it. Re-read the versions on the main branch
   when you write the manifest; they move while the proposal is discussed. For release-please: a
   `release-please-config.json` (parts, `release-type`, tag component,
   `bump-minor-pre-major` while on 0.x, `separate-pull-requests` for
   independent parts, `exclude-paths` on a root `"."` part so it only counts
   its own commits) and a `.release-please-manifest.json`. Set
   `bootstrap-sha` so the first changelogs start at the switch, not at the
   beginning of history.
3. **The release workflow.** It runs the tool on pushes to the main branch and,
   when a part is released, runs that part's publish or deploy job in the same
   workflow, gated on the tool's outputs. Tags and Releases created with the
   default `GITHUB_TOKEN` do not trigger other workflows, so tag-triggered
   publish workflows silently stop firing unless they become jobs here (or the
   tool uses a GitHub App token).
   - Turn existing publish and deploy workflows into reusable ones
     (`workflow_call`) that take the release tag as an input and check out
     that tag, so they ship exactly the released commit.
   - release-please names its outputs by package **path**, not component:
     `packages/core--release_created`, `packages/core--tag_name`. The root
     part (`"."`) is unprefixed: `release_created`, `tag_name`. A mistyped key
     reads as an empty string, so the gate is false and that part never ships
     while the run reports green. Check every key against the config.
   - Run each part's checks against its built artifact in the shipping job;
     tests that skip when a build is absent prove nothing otherwise.
4. **Shipping per part.** Keep existing safety gates (registry staging and
   approval, ordering between dependent packages, manual store uploads).
   When a package depends on another that is staged for approval, its job
   cannot succeed in the same run: the registry only sees approved versions.
   Gate it with `always()` and "the dependency's job did not fail", let it
   fail when both release together, and document the re-run after approval.
   Never publish the dependent package around the gate.
   Attach store packages and binaries to the GitHub Release so the shipped
   artifact is tied to its version.
5. **Hosted app with a deploy branch:** the least disruptive move is to let
   the release workflow point the branch at the new release tag, so the host
   keeps deploying the branch and the branch always equals a release. Move it
   by fast-forward only, so a commit made directly on the branch (an
   unmerged hotfix) fails the job instead of being discarded; the fix is to
   merge the branch back into main and release again. Rollback is pointing
   it at the previous tag, by a person.
6. **Docs.** Rewrite versioning and release docs around the new flow: commit
   or PR title format, how a release is cut, what each part's release
   triggers, how to cut a pre-release and 1.0.0 (for release-please, a commit
   whose body contains `Release-As: 1.0.0`), hotfixes, rollback. Remove
   instructions to bump versions by hand.
7. **Retire** promotion workflows, manual tagging steps and drift checks that
   the release flow replaces, only after the replacement has shipped.

## Rules while applying

- Never move, delete or reuse an existing tag. New prefixes start beside old
  tags.
- Never bump a part to 1.0.0, or any major, unless the owner asked for that
  specific release.
- Never push tags, create Releases or publish to a registry or store yourself
  without the owner's explicit go-ahead for that action; a release workflow
  doing it after the owner merges a release PR is the intended path.
- Validate before committing: the tool's dry run or config check, a workflow
  lint if the project has one, and the project's own tests.

## Report back

Tell the owner per part what now happens on release, what they do by hand,
what was retired, and anything left for them (repository settings, store
dashboards, the first release PR to review).
