// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// Runs every script the plugins ship, plus the repository checks, against
// fixtures. Syntax is checked in CI; this checks behaviour: that each script
// reads what it is given, reports it, and exits with the status the
// contributing guide promises. Run with:
//
//   node --test tests/scripts.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const script = (rel) => join(repo, rel);

const run = (file, args = [], options = {}) =>
  spawnSync(process.execPath, [file, ...args], { encoding: "utf8", ...options });

/** A throwaway directory, removed when the test process ends. */
const fixture = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "skills-test-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// --- Repository checks --------------------------------------------------

test("check-repo passes on this repository", () => {
  const result = run(script("scripts/check-repo.mjs"));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^ok: \d+ plugin\(s\) consistent/);
});

test("check-repo reports a plugin missing from the marketplace and a skill with the wrong name", () => {
  const plugin = (name) =>
    JSON.stringify({
      name,
      version: "0.1.0",
      description: "d",
      author: { name: "a" },
      repository: "https://example.com/r",
      license: "Apache-2.0",
      keywords: ["k"],
    });
  const dir = fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "m",
      plugins: [{ name: "alpha", source: "./plugins/alpha" }],
    }),
    "plugins/alpha/.claude-plugin/plugin.json": plugin("alpha"),
    "plugins/alpha/skills/alpha-skill/SKILL.md": "---\nname: other\ndescription: x\n---\n",
    "plugins/beta/.claude-plugin/plugin.json": plugin("beta"),
    "plugins/beta/skills/b/SKILL.md": "---\nname: b\ndescription: x\n---\n",
    "README.md": "plugins/alpha) claude plugin install alpha@alekslinde",
  });
  const result = run(script("scripts/check-repo.mjs"), [dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /plugins\/beta: not listed/);
  assert.match(result.stderr, /name "other" does not match folder "alpha-skill"/);
});

test("check-repo requires a version bump for a changed plugin", () => {
  const plugin = (version) =>
    JSON.stringify({
      name: "alpha",
      version,
      description: "d",
      author: { name: "a" },
      repository: "https://example.com/r",
      license: "Apache-2.0",
      keywords: ["k"],
    });
  const dir = fixture({
    ".claude-plugin/marketplace.json": JSON.stringify({
      name: "m",
      plugins: [{ name: "alpha", source: "./plugins/alpha" }],
    }),
    "plugins/alpha/.claude-plugin/plugin.json": plugin("0.1.0"),
    "plugins/alpha/skills/alpha/SKILL.md": "---\nname: alpha\ndescription: x\n---\nv1\n",
    "README.md": "plugins/alpha) claude plugin install alpha@alekslinde",
  });
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "base");

  // Change the skill body without a version bump: must fail.
  writeFileSync(join(dir, "plugins/alpha/skills/alpha/SKILL.md"), "---\nname: alpha\ndescription: x\n---\nv2\n");
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qam", "change");
  const unbumped = run(script("scripts/check-repo.mjs"), [dir, "--base", "HEAD~1"]);
  assert.equal(unbumped.status, 1);
  assert.match(unbumped.stderr, /version is still 0\.1\.0; bump it/);

  // Bump the version: must pass.
  writeFileSync(join(dir, "plugins/alpha/.claude-plugin/plugin.json"), plugin("0.1.1"));
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qam", "bump");
  const bumped = run(script("scripts/check-repo.mjs"), [dir, "--base", "HEAD~2"]);
  assert.equal(bumped.status, 0, bumped.stderr || bumped.stdout);
});

test("shared ask-the-user wording is identical in every skill", () => {
  const result = run(script("scripts/check-shared-blocks.mjs"));
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

// --- Audit scripts ------------------------------------------------------

test("npm-release check gates a package that is missing release metadata", () => {
  const dir = fixture({
    "package.json": JSON.stringify({ name: "fixture", version: "1.0.0", main: "index.js" }),
    "index.js": "module.exports = 1\n",
  });
  const result = run(script("plugins/npm-release/skills/prepare-npm-release/scripts/check.mjs"), [dir, "."]);
  assert.equal(result.status, 1, "a bare package should fail, not pass silently");
  assert.match(result.stdout, /FAIL\s+\[R8\]/);
  assert.match(result.stdout, /Still yours to judge/);
});

test("project-memory inspect reports evidence for a plain repository", () => {
  const dir = fixture({ "README.md": "# fixture\n" });
  const result = run(script("plugins/project-memory/skills/write-project-memory/scripts/inspect.mjs"), [dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Project memory audit:/m);
});

test("project-memory inspect refuses a path that does not exist", () => {
  const result = run(script("plugins/project-memory/skills/write-project-memory/scripts/inspect.mjs"), [
    join(tmpdir(), "no-such-dir-for-skills-tests"),
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no such directory/);
});

test("disk-usage inspect --project says so when a repository has no agent state", () => {
  // A fresh directory has never had a session, so there is nothing to report.
  // The script must say that and exit 1, not print an empty report.
  const dir = fixture({ "README.md": "# fixture\n" });
  const result = run(script("plugins/disk-usage/skills/audit-agent-disk/scripts/inspect.mjs"), ["--project", dir]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /no agent state for:/);
});
