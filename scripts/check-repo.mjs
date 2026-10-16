#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// Checks that the repository agrees with itself: the marketplace, each plugin
// manifest, each skill's frontmatter, the README, and the version bumps the
// contributing guide asks for.
//
//   node scripts/check-repo.mjs [repo-root] [--base <git-ref>]
//
// Without --base the version-bump rule is skipped. With it, every plugin whose
// files differ from that ref must have a new version. CI passes the pull
// request's base branch.
//
// Deliberately dependency-free and read-only. Exits non-zero on any problem and
// prints each one, so a failure says what to fix.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const base = baseIndex === -1 ? null : args[baseIndex + 1];
const baseValue = baseIndex === -1 ? -1 : baseIndex + 1;
const positional = args.filter((a, i) => !a.startsWith("--") && i !== baseValue);
const root = resolve(positional[0] ?? join(import.meta.dirname, ".."));

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

const SEMVER = /^\d+\.\d+\.\d+$/;
const readText = (p) => readFileSync(join(root, p), "utf8");
const readJson = (p) => JSON.parse(readText(p));
const isDir = (p) => existsSync(join(root, p)) && statSync(join(root, p)).isDirectory();

/** Parses `name: value` lines between the leading `---` fences, or null. */
function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

// --- Marketplace and plugin directories -----------------------------------

const marketplacePath = ".claude-plugin/marketplace.json";
let marketplace = null;
try {
  marketplace = readJson(marketplacePath);
} catch (error) {
  fail(marketplacePath, `does not parse (${error.message})`);
}

const pluginDirs = existsSync(join(root, "plugins"))
  ? readdirSync(join(root, "plugins")).filter((d) => isDir(`plugins/${d}`))
  : [];

const listed = new Map();
for (const entry of marketplace?.plugins ?? []) {
  if (!entry.name || !entry.source) {
    fail(marketplacePath, `entry is missing name or source: ${JSON.stringify(entry)}`);
    continue;
  }
  listed.set(entry.name, entry.source);
}

for (const dir of pluginDirs) {
  if (![...listed.values()].includes(`./plugins/${dir}`)) {
    fail(`plugins/${dir}`, `not listed in ${marketplacePath}`);
  }
}

// --- Each plugin --------------------------------------------------------

const pluginNames = [];
for (const [name, source] of listed) {
  const dir = source.replace(/^\.\//, "");
  const manifestPath = `${dir}/.claude-plugin/plugin.json`;
  if (!existsSync(join(root, manifestPath))) {
    fail(marketplacePath, `${name} points at ${source}, which has no plugin.json`);
    continue;
  }
  pluginNames.push(name);

  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    fail(manifestPath, `does not parse (${error.message})`);
    continue;
  }

  if (manifest.name !== name) {
    fail(manifestPath, `name "${manifest.name}" does not match marketplace name "${name}"`);
  }
  if (!SEMVER.test(manifest.version ?? "")) {
    fail(manifestPath, `version "${manifest.version}" is not MAJOR.MINOR.PATCH`);
  }
  for (const field of ["description", "repository", "license"]) {
    if (!manifest[field]) fail(manifestPath, `missing "${field}"`);
  }
  if (manifest.license && manifest.license !== "Apache-2.0") {
    fail(manifestPath, `license "${manifest.license}" differs from the repository licence`);
  }
  if (!manifest.author?.name) fail(manifestPath, `missing author.name`);
  if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0) {
    fail(manifestPath, `missing keywords`);
  }

  // --- Skills under the plugin ---------------------------------------------

  const skillsDir = `${dir}/skills`;
  const skills = isDir(skillsDir) ? readdirSync(join(root, skillsDir)) : [];
  if (skills.length === 0) fail(dir, `has no skills`);
  for (const skill of skills) {
    const skillPath = `${skillsDir}/${skill}/SKILL.md`;
    if (!existsSync(join(root, skillPath))) {
      fail(`${skillsDir}/${skill}`, `has no SKILL.md`);
      continue;
    }
    const fields = frontmatter(readText(skillPath));
    if (!fields) {
      fail(skillPath, `has no frontmatter`);
      continue;
    }
    if (fields.name !== skill) fail(skillPath, `name "${fields.name}" does not match folder "${skill}"`);
    if (!fields.description) fail(skillPath, `description is empty`);
  }
}

// --- README -------------------------------------------------------------

const readme = existsSync(join(root, "README.md")) ? readText("README.md") : "";
for (const name of pluginNames) {
  if (!readme.includes(`plugins/${name})`)) {
    fail("README.md", `no table row links to plugins/${name}`);
  }
  if (!readme.includes(`claude plugin install ${name}@alekslinde`)) {
    fail("README.md", `no \`claude plugin install ${name}@alekslinde\` line in the install section`);
  }
}

// --- Version bumps against a base ref -----------------------------------

if (base) {
  const git = (...gitArgs) => execFileSync("git", gitArgs, { cwd: root, encoding: "utf8" });
  let changed;
  try {
    changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  } catch (error) {
    fail("--base", `cannot diff against "${base}" (${error.message.split("\n")[0]})`);
    changed = [];
  }
  for (const name of pluginNames) {
    const dir = listed.get(name).replace(/^\.\//, "");
    if (!changed.some((file) => file.startsWith(`${dir}/`))) continue;
    const manifestPath = `${dir}/.claude-plugin/plugin.json`;
    const now = readJson(manifestPath).version;
    let before;
    try {
      before = JSON.parse(git("show", `${base}:${manifestPath}`)).version;
    } catch {
      continue; // new plugin: nothing installed to pin against yet
    }
    if (now === before) {
      fail(manifestPath, `${name} changed since ${base} but its version is still ${now}; bump it`);
    }
  }
}

// --- Report -------------------------------------------------------------

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`ok: ${pluginNames.length} plugin(s) consistent${base ? `, versions bumped since ${base}` : ""}`);
