# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately
through GitHub's private vulnerability reporting: on the repository's
**Security** tab, choose **Report a vulnerability**.

Include what the skill or script does, what it reads or changes, the steps to
reproduce, and the version (the `version` in the plugin's `plugin.json`).

This is maintained by one person, so response times are best effort. A fix ships as a patch version of the
affected plugin, with a note in [CHANGELOG.md](CHANGELOG.md) that describes the
impact without the exploit.

## Scope

These are instructions and Node scripts that run on your machine, with your
permissions. In scope: a script that deletes, overwrites or sends data it should
not, a skill that tells an agent to do something unsafe, or a path that leaks
local details. Out of scope: a skill giving a legal or technical answer you
disagree with; open an ordinary issue for that.
